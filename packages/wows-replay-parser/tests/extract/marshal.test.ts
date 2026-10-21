import { describe, expect, test } from 'vitest'
import { MarshalReader, PY_NULL, pyString, walkCodeObjects, type PyCode, type PyValue } from '../../src/extract/marshal.js'

function concat(parts: Uint8Array[]): Uint8Array {
  const length = parts.reduce((total, part) => total + part.length, 0)
  const output = new Uint8Array(length)
  let offset = 0
  for (const part of parts) {
    output.set(part, offset)
    offset += part.length
  }
  return output
}

function int32(value: number): Uint8Array {
  const output = new Uint8Array(4)
  new DataView(output.buffer).setInt32(0, value, true)
  return output
}

function marker(value: string): Uint8Array {
  return Uint8Array.of(value.charCodeAt(0))
}

function intObject(value: number): Uint8Array {
  return concat([marker('i'), int32(value)])
}

function string(value: string, interned = false): Uint8Array {
  const bytes = new TextEncoder().encode(value)
  return concat([marker(interned ? 't' : 's'), int32(bytes.length), bytes])
}

function tuple(values: Uint8Array[]): Uint8Array {
  return concat([marker('('), int32(values.length), ...values])
}

function code(values: {
  code: string
  consts: Uint8Array[]
  names: Uint8Array[]
  filename?: string
  name?: string
}): Uint8Array {
  return concat([
    marker('c'),
    int32(0),
    int32(0),
    int32(1),
    int32(0),
    string(values.code),
    tuple(values.consts),
    tuple(values.names),
    tuple([]),
    tuple([]),
    tuple([]),
    string(values.filename ?? 'test.py'),
    string(values.name ?? '<module>'),
    int32(1),
    string(''),
  ])
}

describe('python 2.7 marshal', () => {
  test('reads scalars, strings, tuples and dicts', () => {
    const buffer = concat([
      intObject(42),
      string('hello'),
      tuple([intObject(1), string('two')]),
      marker('{'),
      string('key'),
      intObject(7),
      marker('0'),
    ])

    const reader = new MarshalReader(buffer)
    expect(reader.read()).toBe(42)
    expect(pyString(reader.read())).toBe('hello')
    expect(reader.read()).toHaveLength(2)
    const map = reader.read() as Map<PyValue, PyValue>
    expect(map.size).toBe(1)
    expect([...map.values()][0]).toBe(7)
  })

  test('resolves interned string references', () => {
    const buffer = concat([string('reused', true), marker('R'), int32(0)])
    const reader = new MarshalReader(buffer)

    const interned = pyString(reader.read())
    const referenced = pyString(reader.read())

    expect(interned).toBe('reused')
    expect(referenced).toBe('reused')
  })

  test('reads code objects with nested constants', () => {
    const nested = code({ code: 'nested', consts: [intObject(2)], names: [] })
    const root = code({
      code: 'root',
      consts: [string('constant'), nested],
      names: [string('name')],
      name: '<module>',
    })

    const parsed = new MarshalReader(root).read() as PyCode
    expect(parsed.type).toBe('code')
    expect(pyString(parsed.name)).toBe('<module>')
    expect(parsed.consts[0]).toBeInstanceOf(Uint8Array)

    const visited: string[] = []
    walkCodeObjects(parsed, (value) => visited.push(pyString(value.code) ?? ''))
    expect(visited).toEqual(['root', 'nested'])
  })

  test('reports truncated data', () => {
    const reader = new MarshalReader(Uint8Array.of(0x69, 1), 0)
    expect(() => reader.read()).toThrow(/unexpected end/)
  })

  test('distinguishes NULL from None', () => {
    const value = new MarshalReader(Uint8Array.of(0x30)).read() as PyValue
    expect(value).toBe(PY_NULL)
  })
})

export const PY_NULL = Symbol('py-null')
const PY_ELLIPSIS = Symbol('py-ellipsis')
const PY_STOP_ITERATION = Symbol('py-stop-iteration')

export interface PyCode {
  type: 'code'
  argcount: number
  nlocals: number
  stacksize: number
  flags: number
  code: Uint8Array
  consts: PyValue[]
  names: PyValue[]
  varnames: PyValue[]
  freevars: PyValue[]
  cellvars: PyValue[]
  filename: PyValue
  name: PyValue
  firstlineno: number
  lnotab: PyValue
}

export type PyValue =
  | null
  | boolean
  | number
  | bigint
  | string
  | Uint8Array
  | PyValue[]
  | Map<PyValue, PyValue>
  | PyCode
  | typeof PY_NULL
  | typeof PY_ELLIPSIS
  | typeof PY_STOP_ITERATION

const TYPE_NULL = 0x30
const TYPE_NONE = 0x4e
const TYPE_FALSE = 0x46
const TYPE_TRUE = 0x54
const TYPE_STOPITER = 0x53
const TYPE_ELLIPSIS = 0x2e
const TYPE_INT = 0x69
const TYPE_INT64 = 0x49
const TYPE_LONG = 0x6c
const TYPE_FLOAT = 0x66
const TYPE_BINARY_FLOAT = 0x67
const TYPE_COMPLEX = 0x78
const TYPE_BINARY_COMPLEX = 0x79
const TYPE_STRING = 0x73
const TYPE_INTERNED = 0x74
const TYPE_STRINGREF = 0x52
const TYPE_TUPLE = 0x28
const TYPE_LIST = 0x5b
const TYPE_DICT = 0x7b
const TYPE_CODE = 0x63
const TYPE_UNICODE = 0x75
const TYPE_SET = 0x3c
const TYPE_FROZENSET = 0x3e
const TYPE_UNKNOWN = 0x3f

export class MarshalReader {
  private offset: number
  private readonly strings: PyValue[] = []

  constructor(
    private readonly buffer: Uint8Array,
    offset = 0,
  ) {
    this.offset = offset
  }

  read(): PyValue {
    const type = this.byte()
    switch (type) {
      case TYPE_NULL:
        return PY_NULL
      case TYPE_NONE:
        return null
      case TYPE_FALSE:
        return false
      case TYPE_TRUE:
        return true
      case TYPE_STOPITER:
        return PY_STOP_ITERATION
      case TYPE_ELLIPSIS:
        return PY_ELLIPSIS
      case TYPE_INT:
        return this.int32()
      case TYPE_INT64:
        return this.int64()
      case TYPE_LONG:
        return this.long()
      case TYPE_FLOAT:
        return Number(this.text(this.byte()))
      case TYPE_BINARY_FLOAT:
        return this.double()
      case TYPE_COMPLEX:
        return [Number(this.text(this.byte())), Number(this.text(this.byte()))]
      case TYPE_BINARY_COMPLEX:
        return [this.double(), this.double()]
      case TYPE_STRING:
        return this.bytes(this.int32())
      case TYPE_INTERNED: {
        const value = this.bytes(this.int32())
        this.strings.push(value)
        return value
      }
      case TYPE_STRINGREF: {
        const index = this.int32()
        if (index < 0 || index >= this.strings.length) {
          throw new Error(`marshal: string reference ${index} out of range`)
        }
        return this.strings[index]
      }
      case TYPE_UNICODE:
        return this.text(this.int32())
      case TYPE_TUPLE:
      case TYPE_LIST:
      case TYPE_SET:
      case TYPE_FROZENSET: {
        const length = this.int32()
        const values: PyValue[] = []
        for (let index = 0; index < length; index += 1) values.push(this.read())
        return values
      }
      case TYPE_DICT: {
        const result = new Map<PyValue, PyValue>()
        for (;;) {
          const key = this.read()
          if (key === PY_NULL) break
          result.set(key, this.read())
        }
        return result
      }
      case TYPE_CODE:
        return this.codeObject()
      case TYPE_UNKNOWN:
        throw new Error(`marshal: unknown type marker at offset ${this.offset - 1}`)
      default:
        throw new Error(`marshal: unsupported type 0x${type.toString(16)} at offset ${this.offset - 1}`)
    }
  }

  private codeObject(): PyCode {
    const argcount = this.int32()
    const nlocals = this.int32()
    const stacksize = this.int32()
    const flags = this.int32()
    const code = this.requireBytes(this.read(), 'co_code')
    const consts = this.requireArray(this.read(), 'co_consts')
    const names = this.requireArray(this.read(), 'co_names')
    const varnames = this.requireArray(this.read(), 'co_varnames')
    const freevars = this.requireArray(this.read(), 'co_freevars')
    const cellvars = this.requireArray(this.read(), 'co_cellvars')
    const filename = this.read()
    const name = this.read()
    const firstlineno = this.int32()
    const lnotab = this.read()

    return {
      type: 'code',
      argcount,
      nlocals,
      stacksize,
      flags,
      code,
      consts,
      names,
      varnames,
      freevars,
      cellvars,
      filename,
      name,
      firstlineno,
      lnotab,
    }
  }

  private requireBytes(value: PyValue, field: string): Uint8Array {
    if (!(value instanceof Uint8Array)) throw new Error(`marshal: ${field} is not a string`)
    return value
  }

  private requireArray(value: PyValue, field: string): PyValue[] {
    if (!Array.isArray(value)) throw new Error(`marshal: ${field} is not a tuple`)
    return value
  }

  private int32(): number {
    this.ensure(4)
    const value = this.readInt32(this.offset)
    this.offset += 4
    return value
  }

  private int64(): bigint {
    this.ensure(8)
    const value = this.readInt64(this.offset)
    this.offset += 8
    return value
  }

  private long(): bigint {
    const count = this.int32()
    const negative = count < 0
    const digits = Math.abs(count)
    this.ensure(digits * 2)
    let value = 0n
    for (let index = 0; index < digits; index += 1) {
      value += BigInt(this.buffer[this.offset + index * 2] | (this.buffer[this.offset + index * 2 + 1] << 8)) <<
        BigInt(15 * index)
    }
    this.offset += digits * 2
    return negative ? -value : value
  }

  private double(): number {
    this.ensure(8)
    const value = new DataView(this.buffer.buffer, this.buffer.byteOffset + this.offset, 8).getFloat64(0, true)
    this.offset += 8
    return value
  }

  private bytes(length: number): Uint8Array {
    if (length < 0) throw new Error(`marshal: negative string length ${length}`)
    this.ensure(length)
    const value = this.buffer.subarray(this.offset, this.offset + length)
    this.offset += length
    return value
  }

  private text(length: number): string {
    return new TextDecoder('utf-8').decode(this.bytes(length))
  }

  private byte(): number {
    this.ensure(1)
    return this.buffer[this.offset++]
  }

  private ensure(length: number): void {
    if (this.offset + length > this.buffer.length) {
      throw new Error(`marshal: unexpected end of data at offset ${this.offset}`)
    }
  }

  private readInt32(offset: number): number {
    return (
      (this.buffer[offset] |
        (this.buffer[offset + 1] << 8) |
        (this.buffer[offset + 2] << 16) |
        (this.buffer[offset + 3] << 24)) |
      0
    )
  }

  private readInt64(offset: number): bigint {
    let value = 0n
    for (let index = 0; index < 8; index += 1) {
      value |= BigInt(this.buffer[offset + index]) << BigInt(8 * index)
    }
    return BigInt.asIntN(64, value)
  }
}

export function pyString(value: PyValue): string | null {
  if (value instanceof Uint8Array) return new TextDecoder('utf-8').decode(value)
  if (typeof value === 'string') return value
  return null
}

export function walkCodeObjects(code: PyCode, visit: (code: PyCode) => void): void {
  visit(code)
  for (const value of code.consts) {
    if (isPyCode(value)) walkCodeObjects(value, visit)
  }
}

export function isPyCode(value: PyValue): value is PyCode {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Uint8Array) &&
    !(value instanceof Map) && 'type' in value && (value as PyCode).type === 'code'
}

import { readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { inflateSync } from 'node:zlib'
import { parseReplay } from './replay.js'
import type { Inflate, InflateOptions, ParsedReplay, ParseReplayOptions } from './types.js'

export type ParseReplayFileOptions = Omit<ParseReplayOptions, 'inflate'> & {
  inflate?: Inflate
}

export async function parseReplayFile(
  path: string | URL,
  options: ParseReplayFileOptions = {},
): Promise<ParsedReplay> {
  const buffer = await readFile(path)
  return parseReplay(buffer, { ...options, inflate: options.inflate ?? nodeInflate })
}

export function parseReplayFileSync(
  path: string | URL,
  options: ParseReplayFileOptions = {},
): ParsedReplay {
  const buffer = readFileSync(path)
  return parseReplay(buffer, { ...options, inflate: options.inflate ?? nodeInflate })
}

export function parseReplayBuffer(
  buffer: Uint8Array,
  options: ParseReplayFileOptions = {},
): ParsedReplay {
  return parseReplay(buffer, { ...options, inflate: options.inflate ?? nodeInflate })
}

function nodeInflate(data: Uint8Array, options?: InflateOptions): Uint8Array {
  return inflateSync(data, options?.maxOutputLength ? { maxOutputLength: options.maxOutputLength } : undefined)
}

import { readFileSync } from 'node:fs'
import { decryptPyc } from './decrypt.js'
import { pyString, walkCodeObjects, type PyCode, type PyValue } from './marshal.js'
import { ZipArchive } from './zip.js'
import type { BattleResultsMapping } from '../types.js'

export interface ExtractConstantsOptions {
  previousMapping?: BattleResultsMapping
  version?: string
  build?: number
  patch?: number
  onProgress?: (done: number, total: number) => void
}

export interface ExtractedConstants {
  mapping: BattleResultsMapping
  commonResults: string[]
  clientPublicResults: string[]
  clientVehInteractionDetails: string[]
  ribbonTailSource: 'literal' | 'previous' | 'none'
  warnings: string[]
}

interface Candidate {
  names: string[]
  entry: string
}

const FIELD_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/

export function extractConstantsFromFile(path: string, options: ExtractConstantsOptions = {}): ExtractedConstants {
  return extractConstants(new ZipArchive(readFileBytes(path)), options)
}

export function extractConstants(archive: ZipArchive, options: ExtractConstantsOptions = {}): ExtractedConstants {
  const entries = archive
    .entriesList()
    .filter((entry) => entry.name.startsWith('scripts/') && entry.name.endsWith('.pyc'))
  const candidates: Candidate[] = []
  const warnings: string[] = []
  let versionCode: PyCode | null = null

  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index]
    let code: PyCode
    try {
      code = decryptPyc(archive.read(entry))
    } catch {
      continue
    }

    if (entry.name === 'scripts/Version.pyc') versionCode = code

    walkCodeObjects(code, (candidateCode) => {
      for (const value of candidateCode.consts) {
        const names = toStringArray(value)
        if (names && names.length >= 4 && names.every((name) => FIELD_NAME.test(name))) {
          candidates.push({ names, entry: entry.name })
        }
      }
    })

    options.onProgress?.(index + 1, entries.length)
  }

  const commonResults = requireCandidate(
    candidates,
    'COMMON_RESULTS',
    (names) => names[0] === 'arena_id' && names.includes('winner_team_id') && names.includes('duration_sec') && names.length >= 18 && names.length <= 40,
  )
  const interactionDetails = requireCandidate(
    candidates,
    'CLIENT_VEH_INTERACTION_DETAILS',
    (names) => names[0] === 'is_primary_spotted_by_ship' && names.includes('hits_main_ap') && names.length >= 100,
  )

  const literalPublic = findCandidate(
    candidates,
    (names) => names[0] === 'account_db_id' && names.includes('RIBBON_MAIN_CALIBER') && names.length > 400,
  )

  let clientPublicResults: string[]
  let ribbonTailSource: ExtractedConstants['ribbonTailSource'] = 'literal'

  if (literalPublic) {
    clientPublicResults = literalPublic
  } else {
    const playerInfo = requireCandidate(
      candidates,
      'PLAYER_INFO',
      (names) => names[0] === 'account_db_id' && names.includes('name') && names.includes('clan_tag') && names.length >= 15 && names.length <= 30,
    )
    const vehCommon = requireCandidate(
      candidates,
      'VEH_COMMON_RESULTS',
      (names) => names[0] === 'remained_hp' && names.includes('is_alive') && names.includes('life_time_sec') && names.length >= 300 && names.length <= 800,
    )
    const vehClientBase = requireCandidate(
      candidates,
      'VEH_CLIENT_RESULTS base',
      (names) => names[0] === 'planes_killed_scouts' && names.includes('pt_reward_boost') && names.includes('pt_reward_slow') && names.length >= 10 && names.length <= 30,
    )

    const core = [...playerInfo, ...vehCommon, ...vehClientBase]
    const previous = previousFieldNames(options.previousMapping)
    const tail = previous.length > core.length ? previous.slice(core.length) : []
    const prefixMatches = core.every((name, index) => previous[index] === name)

    if (tail.length > 0 && prefixMatches) {
      clientPublicResults = [...core, ...tail]
      ribbonTailSource = 'previous'
    } else if (tail.length > 0) {
      warnings.push(
        'previous mapping prefix does not match the extracted core; the ribbon tail was not reused',
      )
      clientPublicResults = core
      ribbonTailSource = 'none'
    } else {
      warnings.push('no previous mapping is available; generated mapping contains core fields only')
      clientPublicResults = core
      ribbonTailSource = 'none'
    }
  }

  const versionInfo = extractVersion(versionCode, options, warnings)
  const publicResultIndices: Record<string, number> = {}
  for (let index = 0; index < clientPublicResults.length; index += 1) {
    publicResultIndices[clientPublicResults[index]] = index
  }

  return {
    mapping: {
      version: versionInfo.version,
      build: versionInfo.build,
      commonResults,
      publicResultIndices,
      interactionDetails,
    },
    commonResults,
    clientPublicResults,
    clientVehInteractionDetails: interactionDetails,
    ribbonTailSource,
    warnings,
  }
}

function extractVersion(
  code: PyCode | null,
  options: ExtractConstantsOptions,
  warnings: string[],
): { version: string; build: number; patch: number } {
  const strings: string[] = []
  const numbers: number[] = []

  if (code) {
    walkCodeObjects(code, (candidate) => {
      for (const value of candidate.consts) {
        const text = pyString(value)
        if (text && /^\d+\.\d+$/.test(text)) strings.push(text)
        if (typeof value === 'number' && Number.isInteger(value)) numbers.push(value)
        if (typeof value === 'bigint' && value <= BigInt(Number.MAX_SAFE_INTEGER)) numbers.push(Number(value))
      }
    })
  }

  const version = options.version ?? strings[0] ?? '0.0'
  const build =
    options.build ??
    numbers.filter((value) => value > 1_000_000).sort((left, right) => right - left)[0] ??
    0
  const patch = options.patch ?? 0

  if (!strings[0]) warnings.push('could not read VERSION from scripts/Version.pyc')
  if (!options.build && build === 0) warnings.push('could not read BUILD from scripts/Version.pyc')

  return { version, build, patch }
}

function requireCandidate(
  candidates: Candidate[],
  label: string,
  predicate: (names: string[]) => boolean,
): string[] {
  const found = findCandidate(candidates, predicate)
  if (!found) throw new Error(`scripts.zip: could not locate ${label}`)
  return found
}

function findCandidate(candidates: Candidate[], predicate: (names: string[]) => boolean): string[] | null {
  for (const candidate of candidates) {
    if (predicate(candidate.names)) return candidate.names
  }
  return null
}

function toStringArray(value: PyValue): string[] | null {
  if (!Array.isArray(value) || value.length === 0) return null
  const result: string[] = []
  for (const item of value) {
    const text = pyString(item)
    if (text === null) return null
    result.push(text)
  }
  return result
}

function previousFieldNames(mapping: BattleResultsMapping | undefined): string[] {
  if (!mapping) return []
  return Object.entries(mapping.publicResultIndices)
    .sort((left, right) => left[1] - right[1])
    .map(([name]) => name)
}

function readFileBytes(path: string): Uint8Array {
  return readFileSync(path)
}

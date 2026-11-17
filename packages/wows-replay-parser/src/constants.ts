import latest from '../constants/latest.json'
import type { BattleResultsMapping } from './types.js'

export const LATEST_MAPPING = latest as BattleResultsMapping

export function getLatestMappingVersion(): string {
  return LATEST_MAPPING.version
}

import { existsSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import { LATEST_MAPPING } from '../../src/constants.js'
import { extractConstantsFromFile } from '../../src/extract/constants.js'

const scriptsZip = process.env.WOWS_SCRIPTS_ZIP
const available = Boolean(scriptsZip && existsSync(scriptsZip))

describe.skipIf(!available)('scripts.zip constants extraction', () => {
  test('reproduces the shipped mapping for the current game build', () => {
    const result = extractConstantsFromFile(scriptsZip!, { previousMapping: LATEST_MAPPING })

    expect(result.mapping.version).toMatch(/^\d+\.\d+$/)
    expect(result.mapping.build).toBeGreaterThan(0)
    expect(result.commonResults).toHaveLength(18)
    expect(result.clientVehInteractionDetails.length).toBeGreaterThan(100)
    expect(result.clientPublicResults.length).toBeGreaterThan(400)
    expect(result.mapping.publicResultIndices.damage).toBeGreaterThan(0)

    if (result.mapping.version === LATEST_MAPPING.version) {
      expect(result.mapping.commonResults).toEqual(LATEST_MAPPING.commonResults)
      expect(result.mapping.interactionDetails).toEqual(LATEST_MAPPING.interactionDetails)
      expect(result.mapping.publicResultIndices).toEqual(LATEST_MAPPING.publicResultIndices)
    }
  }, 60_000)
})

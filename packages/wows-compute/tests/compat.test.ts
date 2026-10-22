import { expect, it } from 'vitest'
import type { ParsedReplay } from 'wows-replay-parser'
import type { ReplayFacts } from '../src/match/index.js'

type ReplayIsCompatible = ParsedReplay extends ReplayFacts ? true : never

const compatible: ReplayIsCompatible = true

it('accepts a parsed replay as ReplayFacts', () => {
  expect(compatible).toBe(true)
})

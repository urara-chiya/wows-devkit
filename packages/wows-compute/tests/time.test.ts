import { describe, expect, it } from 'vitest'
import { gameDay, inRange, parseBattleTime, weekBoundary } from '../src/time/index.js'

describe('parseBattleTime', () => {
  it('parses the game format in the given time zone', () => {
    expect(parseBattleTime('18.10.2026 21:50:36', 'Asia/Shanghai'))
      .toBe(Date.UTC(2026, 9, 18, 13, 50, 36))
  })

  it('honours a different time zone', () => {
    expect(parseBattleTime('18.10.2026 21:50:36', 'UTC'))
      .toBe(Date.UTC(2026, 9, 18, 21, 50, 36))
  })

  it('rejects malformed and impossible values', () => {
    expect(parseBattleTime('2026-10-18 21:50:36', 'Asia/Shanghai')).toBeNull()
    expect(parseBattleTime('31.02.2026 00:00:00', 'Asia/Shanghai')).toBeNull()
    expect(parseBattleTime('18.10.2026 24:00:00', 'Asia/Shanghai')).toBeNull()
    expect(parseBattleTime('', 'Asia/Shanghai')).toBeNull()
  })
})

describe('gameDay', () => {
  it('rolls over at the boundary hour instead of midnight', () => {
    const beforeBoundary = Date.UTC(2026, 9, 18, 19, 0, 0)
    const afterBoundary = Date.UTC(2026, 9, 18, 20, 0, 0)

    expect(gameDay(beforeBoundary, 'Asia/Shanghai')).toBe('2026-10-18')
    expect(gameDay(afterBoundary, 'Asia/Shanghai')).toBe('2026-10-19')
  })
})

describe('weekBoundary', () => {
  it('returns Monday at the boundary hour', () => {
    const wednesday = Date.UTC(2026, 9, 21, 6, 0, 0)
    expect(weekBoundary(wednesday, 'Asia/Shanghai')).toBe(Date.UTC(2026, 9, 18, 20, 0, 0))
  })

  it('is stable inside the same week', () => {
    const monday = Date.UTC(2026, 9, 18, 20, 0, 0)
    const sunday = Date.UTC(2026, 9, 25, 19, 59, 59)
    expect(weekBoundary(monday, 'Asia/Shanghai')).toBe(monday)
    expect(weekBoundary(sunday, 'Asia/Shanghai')).toBe(monday)
  })
})

describe('inRange', () => {
  it('treats bounds as inclusive and omitted bounds as open', () => {
    expect(inRange(10, 10, 20)).toBe(true)
    expect(inRange(20, 10, 20)).toBe(true)
    expect(inRange(9, 10, 20)).toBe(false)
    expect(inRange(10)).toBe(true)
    expect(inRange(10, undefined, 9)).toBe(false)
  })
})

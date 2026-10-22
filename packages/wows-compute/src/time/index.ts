const GAME_DATE_PATTERN = /^(\d{2})\.(\d{2})\.(\d{4}) (\d{2}):(\d{2}):(\d{2})$/
const SECOND_MS = 1000
const DAY_MS = 24 * 60 * 60 * 1000

interface DateTimeParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

const formatters = new Map<string, Intl.DateTimeFormat>()

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  const cached = formatters.get(timeZone)
  if (cached) return cached

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  formatters.set(timeZone, formatter)
  return formatter
}

function localParts(timestamp: number, timeZone: string): DateTimeParts {
  const parts = formatterFor(timeZone).formatToParts(new Date(timestamp))
  const values: Record<string, string> = {}

  for (const part of parts) {
    if (part.type !== 'literal') values[part.type] = part.value
  }

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  }
}

function utcFromParts(parts: DateTimeParts): number {
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
}

function offsetAt(timestamp: number, timeZone: string): number {
  return utcFromParts(localParts(timestamp, timeZone)) - timestamp
}

function localToUtc(parts: DateTimeParts, timeZone: string): number {
  const guess = utcFromParts(parts)
  const firstOffset = offsetAt(guess, timeZone)
  const firstCandidate = guess - firstOffset
  const secondOffset = offsetAt(firstCandidate, timeZone)

  return secondOffset === firstOffset ? firstCandidate : guess - secondOffset
}

function pad(value: number, length = 2): string {
  return String(value).padStart(length, '0')
}

function isValidParts(parts: DateTimeParts): boolean {
  if (
    parts.month < 1 || parts.month > 12
    || parts.day < 1 || parts.day > 31
    || parts.hour < 0 || parts.hour > 23
    || parts.minute < 0 || parts.minute > 59
    || parts.second < 0 || parts.second > 59
  ) {
    return false
  }

  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day))
  return date.getUTCFullYear() === parts.year
    && date.getUTCMonth() === parts.month - 1
    && date.getUTCDate() === parts.day
}

/**
 * Parses the game's `DD.MM.YYYY HH:mm:ss` format in an explicit time zone.
 *
 * The value itself carries no time zone: it is the recorder's local time, so
 * the caller must decide which zone the replay belongs to. Returns `null` for
 * malformed or impossible dates.
 */
export function parseBattleTime(value: string, timeZone: string): number | null {
  const match = GAME_DATE_PATTERN.exec(value)
  if (match === null) return null

  const parts: DateTimeParts = {
    day: Number(match[1]),
    month: Number(match[2]),
    year: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6]),
  }

  if (!isValidParts(parts)) return null

  return localToUtc(parts, timeZone)
}

/**
 * Local "game day" label (`YYYY-MM-DD`).
 *
 * Days roll over at `boundaryHour` instead of midnight, so a battle at 02:00
 * still belongs to the previous game day.
 */
export function gameDay(timestamp: number, timeZone: string, boundaryHour = 4): string {
  const shifted = timestamp - boundaryHour * 60 * 60 * SECOND_MS
  const parts = localParts(shifted, timeZone)
  return `${pad(parts.year, 4)}-${pad(parts.month)}-${pad(parts.day)}`
}

/** Start of the game week (Monday at `boundaryHour`, local time) containing `timestamp`. */
export function weekBoundary(timestamp: number, timeZone: string, boundaryHour = 4): number {
  const shifted = timestamp - boundaryHour * 60 * 60 * SECOND_MS
  const parts = localParts(shifted, timeZone)
  const dayOfWeek = new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay()
  const daysSinceMonday = (dayOfWeek + 6) % 7
  const monday = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day) - daysSinceMonday * DAY_MS,
  )

  return localToUtc(
    {
      year: monday.getUTCFullYear(),
      month: monday.getUTCMonth() + 1,
      day: monday.getUTCDate(),
      hour: boundaryHour,
      minute: 0,
      second: 0,
    },
    timeZone,
  )
}

/** Inclusive range check; omitted bounds are open. */
export function inRange(timestamp: number, from?: number, to?: number): boolean {
  if (from !== undefined && timestamp < from) return false
  if (to !== undefined && timestamp > to) return false
  return true
}

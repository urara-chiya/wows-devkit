import type { ReplayVersion } from './types.js'

export const MIN_SUPPORTED_VERSION = { major: 12, minor: 6, patch: 0 } as const

export function parseReplayVersion(raw: string | null | undefined): ReplayVersion | null {
  if (typeof raw !== 'string') return null

  const parts = raw.split(',').map((part) => part.trim())
  if (parts.length < 3) return null

  const [major, minor, patch, build] = parts.map((part) => Number.parseInt(part, 10))
  if (![major, minor, patch].every(Number.isFinite)) return null

  return {
    major,
    minor,
    patch,
    build: Number.isFinite(build) ? build : null,
    raw,
  }
}

export function isSupportedVersion(version: ReplayVersion | null): version is ReplayVersion {
  if (!version) return false

  if (version.major !== MIN_SUPPORTED_VERSION.major) {
    return version.major > MIN_SUPPORTED_VERSION.major
  }
  if (version.minor !== MIN_SUPPORTED_VERSION.minor) {
    return version.minor > MIN_SUPPORTED_VERSION.minor
  }
  return version.patch >= MIN_SUPPORTED_VERSION.patch
}

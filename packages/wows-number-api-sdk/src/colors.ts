import type { PersonalRatingCategory } from './types.js'

export interface CategoryColors {
  /** Canonical hue used for chips and bars. */
  primary: string
  /** Readable text colour on dark backgrounds. */
  darkText: string
  /** Readable text colour on light backgrounds. */
  lightText: string
}

/** Palette aligned with wows-numbers.com and the Rust toolkit. */
export const CATEGORY_COLORS: Record<PersonalRatingCategory, CategoryColors> = {
  bad: { primary: '#FF0000', darkText: '#F56864', lightText: '#9D0403' },
  'below-average': { primary: '#FE7903', darkText: '#FB861D', lightText: '#884305' },
  average: { primary: '#FFC71F', darkText: '#FFC71F', lightText: '#715912' },
  good: { primary: '#44B300', darkText: '#5ABA1E', lightText: '#286204' },
  'very-good': { primary: '#318000', darkText: '#7AA858', lightText: '#255D02' },
  great: { primary: '#02C9B3', darkText: '#02C9B3', lightText: '#066358' },
  unicum: { primary: '#D042F3', darkText: '#D878EC', lightText: '#802B94' },
  'super-unicum': { primary: '#A00DC5', darkText: '#C376D0', lightText: '#7F0C9B' },
}

export function categoryColor(category: PersonalRatingCategory): CategoryColors {
  return CATEGORY_COLORS[category]
}

/** Alpha used for rating-chip backgrounds (46/255, about 18%). */
export const CHIP_TINT_ALPHA = 46

/** Converts a `#RRGGBB` colour plus an alpha byte into `rgba(...)`. */
export function withAlpha(hex: string, alpha: number): string {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex)
  if (!match) throw new TypeError(`expected a #RRGGBB colour, got "${hex}"`)

  const value = Number.parseInt(match[1]!, 16)
  const red = (value >> 16) & 0xff
  const green = (value >> 8) & 0xff
  const blue = value & 0xff
  const normalized = Math.min(255, Math.max(0, alpha)) / 255

  return `rgba(${red}, ${green}, ${blue}, ${Number(normalized.toFixed(3))})`
}

/** Chip background for a band, using the canonical 18% tint. */
export function chipBackground(category: PersonalRatingCategory): string {
  return withAlpha(categoryColor(category).primary, CHIP_TINT_ALPHA)
}

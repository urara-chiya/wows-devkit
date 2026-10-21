import type { ApiErrorPayload } from '../../core/errors.js'

export type { WowsRealm } from '../../core/realms.js'
export type { ApiErrorPayload } from '../../core/errors.js'

export const LANGUAGES = [
  'cs',
  'de',
  'en',
  'es',
  'fr',
  'ja',
  'pl',
  'ru',
  'th',
  'zh-tw',
  'tr',
  'zh-cn',
  'pt-br',
  'es-mx',
] as const

export type LanguageCode = (typeof LANGUAGES)[number]

export type IdList = number | readonly number[]

export interface CommonParams {
  language?: LanguageCode
  fields?: string | readonly string[]
  extra?: string | readonly string[]
}

export interface ApiMeta {
  count?: number
  hidden?: string | null
  page?: number
  page_total?: number
  limit?: number
  [key: string]: unknown
}

export interface ApiResponseOk<T> {
  status: 'ok'
  meta: ApiMeta
  data: T
}

export interface ApiResponseError {
  status: 'error'
  error: ApiErrorPayload
}

export type ApiResponse<T> = ApiResponseOk<T> | ApiResponseError

export interface RequestOptions {
  signal?: AbortSignal
}

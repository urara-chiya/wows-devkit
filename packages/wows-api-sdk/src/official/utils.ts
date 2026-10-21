import type { ApiResponseOk } from './types/common.js'

export function unwrap<T>(response: ApiResponseOk<T>): T {
  return response.data
}

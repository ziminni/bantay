import axios from 'axios'

/**
 * An error returned by the API. The backend always answers with
 * `{ "detail": "..." }`, and validation errors (422) add an `errors` list.
 */
export class ApiError extends Error {
  readonly status: number
  readonly detail: string

  constructor(status: number, detail: string) {
    super(detail)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
  }
}

/** A readable message for any error thrown by an API call. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.detail
  if (axios.isAxiosError(error)) {
    const detail = (error.response?.data as { detail?: unknown } | undefined)?.detail
    if (typeof detail === 'string') return detail
    if (!error.response) return 'Cannot reach the server. Check that the backend is running.'
    return `Request failed (${error.response.status}).`
  }
  if (error instanceof Error) return error.message
  return 'Something went wrong.'
}

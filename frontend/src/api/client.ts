import axios from 'axios'
import { API_BASE_URL } from '@/config'
import { ApiError } from './errors'

/**
 * The HTTP client for the Bantay API.
 *
 * Not used yet: while MOCK_MODE is on, src/api/*.ts read from src/mocks/.
 * When the backend is connected, every API function calls this client.
 */
export const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30_000,
})

client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && error.response) {
      const data = error.response.data as { detail?: unknown } | undefined
      const detail = typeof data?.detail === 'string' ? data.detail : error.message
      return Promise.reject(new ApiError(error.response.status, detail))
    }
    return Promise.reject(error)
  },
)

/** Drop undefined / empty-string values so they are not sent as query params. */
export function cleanParams<T extends object>(params: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''),
  ) as Partial<T>
}

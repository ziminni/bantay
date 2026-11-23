/**
 * Front-end configuration.
 *
 * MOCK_MODE is false: every function in src/api/ calls the real backend.
 * The sample data in src/mocks/ is kept for reference and is no longer read.
 */
export const MOCK_MODE = false

/** Prefix of every backend endpoint. nginx forwards it to FastAPI in production. */
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1'

/** Where the backend serves unknown-face snapshots. */
export const MEDIA_BASE_URL = import.meta.env.VITE_MEDIA_BASE_URL ?? '/media'

/**
 * All dates are shown in the department's local time. The backend stores and
 * returns UTC, and uses this same zone to decide what counts as "today".
 */
export const TIME_ZONE = 'Asia/Manila'

/** How often the dashboard refreshes, in milliseconds. */
export const DASHBOARD_REFRESH_MS = 10_000

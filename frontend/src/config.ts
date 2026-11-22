/**
 * Front-end configuration.
 *
 * MOCK_MODE is true while the frontend is not connected to the backend. Every
 * function in src/api/ reads from the in-memory store in src/mocks/ instead of
 * calling the API. To connect: replace the bodies in src/api/*.ts with the
 * `client` calls noted above each function, then set this to false.
 */
export const MOCK_MODE = true

/** Prefix of every backend endpoint. nginx forwards it to FastAPI in production. */
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1'

/** Where the backend serves unknown-face snapshots. */
export const MEDIA_BASE_URL = import.meta.env.VITE_MEDIA_BASE_URL ?? '/media'

/** All dates are shown in the department's local time. */
export const TIME_ZONE = 'Asia/Manila'

/** How often the dashboard refreshes, in milliseconds. */
export const DASHBOARD_REFRESH_MS = 10_000

import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// The backend during development. Override with VITE_BACKEND_URL in .env.local
// when FastAPI runs somewhere other than this machine.
const DEFAULT_BACKEND = 'http://127.0.0.1:8000'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const backend = env.VITE_BACKEND_URL || DEFAULT_BACKEND

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      host: true,
      // The app calls relative paths (/api/v1, /media), so in development Vite
      // forwards them to FastAPI. In production nginx does the same job.
      proxy: {
        '/api': {
          target: backend,
          changeOrigin: true,
          // MJPEG is an endless response; it must not be buffered or timed out.
          timeout: 0,
          proxyTimeout: 0,
        },
        '/media': {
          target: backend,
          changeOrigin: true,
        },
      },
    },
  }
})

/**
 * System — /api/v1/health
 *
 * Mock implementation. Real call: client.get('/health')
 */
import { db, findLab } from '@/mocks/store'
import { respond } from '@/mocks/util'
import type { HealthResponse } from './types'

export async function getHealth(): Promise<HealthResponse> {
  const cameras = db.cameras.map((c) => ({
    id: c.id,
    name: c.name,
    lab_name: findLab(c.lab_id)?.name ?? null,
    role: c.role,
    status: c.status,
    worker_running: c.enabled,
    last_seen_at: c.last_seen_at,
    last_error: c.last_error,
  }))
  const online = cameras.filter((c) => c.status === 'ONLINE').length
  return respond(
    {
      status: 'ok',
      app: 'Bantay',
      version: '0.1.0',
      environment: 'development',
      database_reachable: true,
      recognition_engine: 'mock',
      recognition_ready: true,
      embedding_dim: 512,
      cameras_online: online,
      cameras_offline: cameras.length - online,
      cameras,
    },
    100,
  )
}

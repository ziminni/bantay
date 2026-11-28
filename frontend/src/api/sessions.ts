import { client } from './client'

export interface SessionPhotoMeta {
  index: number
  filename: string
  content_type: string
  size: number
  url: string
}

export interface SessionCreateResponse {
  session_id: string
  created_at: string
  expires_at: string
  network_ip: string
  expires_in_seconds: number
}

export interface SessionStatusResponse {
  session_id: string
  status: 'pending' | 'received' | 'completed' | 'expired'
  created_at: string
  expires_at: string
  photo_count: number
  photos: SessionPhotoMeta[]
}

export async function createEnrollmentSession(): Promise<SessionCreateResponse> {
  const { data } = await client.post<SessionCreateResponse>('/enrollment-sessions')
  return data
}

export async function getEnrollmentSession(sessionId: string): Promise<SessionStatusResponse> {
  const { data } = await client.get<SessionStatusResponse>(`/enrollment-sessions/${sessionId}`)
  return data
}

export async function uploadSessionPhotos(sessionId: string, files: File[]): Promise<SessionStatusResponse> {
  const form = new FormData()
  files.forEach((file) => {
    form.append('files', file)
  })
  const { data } = await client.post<SessionStatusResponse>(`/enrollment-sessions/${sessionId}/photos`, form)
  return data
}

export async function deleteEnrollmentSession(sessionId: string): Promise<void> {
  await client.delete(`/enrollment-sessions/${sessionId}`)
}

export async function getNetworkIp(): Promise<string> {
  const { data } = await client.get<{ network_ip: string }>('/system/network-ip')
  return data.network_ip
}

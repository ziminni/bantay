import { useCallback, useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import {
  AlertTriangle,
  Check,
  Clock,
  Copy,
  RefreshCw,
  Smartphone,
  Wifi,
} from 'lucide-react'
import {
  createEnrollmentSession,
  deleteEnrollmentSession,
  getEnrollmentSession,
  type SessionCreateResponse,
} from '@/api/sessions'

interface PhoneEnrollmentViewProps {
  onPhotosReceived: (files: File[]) => void
  disabled?: boolean
  max?: number
}

export function PhoneEnrollmentView({ onPhotosReceived, disabled }: PhoneEnrollmentViewProps) {
  const [session, setSession] = useState<SessionCreateResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mobileUrl, setMobileUrl] = useState<string>('')
  const [qrDataUrl, setQrDataUrl] = useState<string>('')
  const [copied, setCopied] = useState(false)
  const [timeLeft, setTimeLeft] = useState<string>('')
  const [transferring, setTransferring] = useState(false)
  const [transferredCount, setTransferredCount] = useState<number | null>(null)

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const mountedRef = useRef(true)
  const onPhotosReceivedRef = useRef(onPhotosReceived)

  useEffect(() => {
    onPhotosReceivedRef.current = onPhotosReceived
  }, [onPhotosReceived])

  const stopTimers = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  // Start or reset QR session
  const initSession = useCallback(async () => {
    stopTimers()
    setLoading(true)
    setError(null)
    setTransferring(false)
    setTransferredCount(null)

    try {
      const data = await createEnrollmentSession()
      if (!mountedRef.current) return
      setSession(data)

      const currentHost = window.location.hostname
      const targetHost =
        currentHost === 'localhost' || currentHost === '127.0.0.1' ? data.network_ip : currentHost
      const port = window.location.port ? `:${window.location.port}` : ''
      const url = `${window.location.protocol}//${targetHost}${port}/enroll/mobile?session=${data.session_id}`
      setMobileUrl(url)

      // Generate a 1:1 square data URL image so unmounting/remounting never reverts to a 300x150 blank canvas rectangle
      const dataUrl = await QRCode.toDataURL(url, {
        width: 220,
        margin: 1,
        color: {
          dark: '#0e2a47',
          light: '#ffffff',
        },
      })
      if (!mountedRef.current) return
      setQrDataUrl(dataUrl)

      // Countdown timer
      const expiresAt = new Date(data.expires_at).getTime()
      const updateTimer = () => {
        if (!mountedRef.current) return
        const diff = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000))
        if (diff <= 0) {
          setTimeLeft('Expired')
          stopTimers()
        } else {
          const m = Math.floor(diff / 60)
          const s = diff % 60
          setTimeLeft(`${m}:${s.toString().padStart(2, '0')}`)
        }
      }
      updateTimer()
      timerRef.current = setInterval(updateTimer, 1000)

      // Poll session status
      let consecutiveErrors = 0
      pollingRef.current = setInterval(async () => {
        if (!mountedRef.current) {
          stopTimers()
          return
        }

        try {
          const status = await getEnrollmentSession(data.session_id)
          consecutiveErrors = 0

          if (status.status === 'received' && status.photos.length > 0) {
            stopTimers()
            setTransferring(true)
            setTransferredCount(status.photos.length)

            const files: File[] = []
            for (const p of status.photos) {
              const res = await fetch(p.url)
              const blob = await res.blob()
              const file = new File([blob], p.filename, {
                type: p.content_type || blob.type || 'image/jpeg',
              })
              files.push(file)
            }

            await deleteEnrollmentSession(data.session_id).catch(() => undefined)

            if (mountedRef.current) {
              onPhotosReceivedRef.current(files)
              setTransferring(false)
              // Immediately prepare a fresh square QR session in case user scans again
              void initSession()
            }
          } else if (status.status === 'expired') {
            stopTimers()
            if (mountedRef.current) setTimeLeft('Expired')
          }
        } catch {
          consecutiveErrors++
          if (consecutiveErrors >= 2) {
            stopTimers()
            if (mountedRef.current) setTimeLeft('Expired')
          }
        }
      }, 1500)
    } catch (err) {
      if (!mountedRef.current) return
      console.error('Failed to init enrollment session:', err)
      setError('Could not initialize mobile enrollment session. Ensure the backend is reachable.')
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [stopTimers])

  useEffect(() => {
    mountedRef.current = true
    void initSession()
    return () => {
      mountedRef.current = false
      stopTimers()
    }
  }, [initSession, stopTimers])

  const copyLink = async () => {
    if (!mobileUrl) return
    try {
      await navigator.clipboard.writeText(mobileUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback
    }
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-xl bg-marigold-50 text-marigold-600 ring-1 ring-marigold-200/60">
            <Smartphone className="size-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Enroll Face Using Phone</h3>
            <p className="text-xs text-gray-500">
              Scan the QR code with your iPhone or Android to use its front selfie camera.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {session && timeLeft && timeLeft !== 'Expired' && (
            <div className="flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
              <Clock className="size-3.5 text-gray-400" />
              <span>Expires in {timeLeft}</span>
            </div>
          )}

          <button
            type="button"
            onClick={initSession}
            disabled={loading || disabled}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 shadow-xs hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>New QR</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {error ? (
        <div className="my-6 rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700">
          <div className="flex items-center gap-2 font-medium">
            <AlertTriangle className="size-4 shrink-0" />
            <span>Connection Error</span>
          </div>
          <p className="mt-1">{error}</p>
          <button
            type="button"
            onClick={initSession}
            className="mt-3 rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
          >
            Retry Connection
          </button>
        </div>
      ) : transferring ? (
        <div className="my-8 flex flex-col items-center justify-center space-y-3 py-6 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-marigold-100 text-marigold-600 shadow-inner">
            <RefreshCw className="size-7 animate-spin" />
          </div>
          <p className="text-sm font-semibold text-gray-900">Receiving photos from phone...</p>
          <p className="text-xs text-gray-500">
            Transferring {transferredCount ?? 'face'} photos into your enrollment form.
          </p>
        </div>
      ) : (
        /* QR Code & Step Instructions */
        <div className="mt-5 grid grid-cols-1 items-center gap-6 md:grid-cols-12">
          {/* Square QR Code Frame — Strictly 1:1 matching the QR code */}
          <div className="flex flex-col items-center justify-center md:col-span-5">
            <div className="relative flex size-[244px] aspect-square shrink-0 items-center justify-center rounded-2xl border-2 border-gray-200 bg-white p-3 shadow-sm">
              {/* Aligned Corner Viewfinder Accents matching the rounded-2xl QR frame */}
              <div className="pointer-events-none absolute -top-0.5 -left-0.5 size-5 rounded-tl-2xl border-t-2 border-l-2 border-marigold-500" />
              <div className="pointer-events-none absolute -top-0.5 -right-0.5 size-5 rounded-tr-2xl border-t-2 border-r-2 border-marigold-500" />
              <div className="pointer-events-none absolute -bottom-0.5 -left-0.5 size-5 rounded-bl-2xl border-b-2 border-l-2 border-marigold-500" />
              <div className="pointer-events-none absolute -bottom-0.5 -right-0.5 size-5 rounded-br-2xl border-b-2 border-r-2 border-marigold-500" />

              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="Mobile face enrollment QR code"
                  width={220}
                  height={220}
                  className="size-[220px] aspect-square rounded-xl object-contain block select-none"
                />
              ) : (
                <div className="size-[220px] aspect-square rounded-xl bg-gray-50" />
              )}

              {loading && (
                <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-white/80 backdrop-blur-xs">
                  <RefreshCw className="size-6 animate-spin text-marigold-500" />
                </div>
              )}

              {timeLeft === 'Expired' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl bg-white/95 p-4 text-center">
                  <p className="text-xs font-semibold text-red-600">QR Code Expired</p>
                  <p className="mt-1 text-[11px] text-gray-500">For security, QR codes expire after 15 minutes.</p>
                  <button
                    type="button"
                    onClick={initSession}
                    className="mt-3 rounded-lg bg-navy-900 px-3 py-1.5 text-xs font-medium text-white shadow-xs hover:bg-navy-800"
                  >
                    Generate New QR
                  </button>
                </div>
              )}
            </div>

            {/* Status Pulse */}
            <div className="mt-3 flex items-center gap-2 text-xs font-medium text-gray-600">
              <span className="relative flex size-2.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
              </span>
              <span>Waiting for phone scan...</span>
            </div>

            {/* Direct Link / Copy Button */}
            {mobileUrl && (
              <button
                type="button"
                onClick={copyLink}
                className="mt-2.5 inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-navy-900"
                title={mobileUrl}
              >
                {copied ? (
                  <>
                    <Check className="size-3.5 text-emerald-600" />
                    <span className="font-medium text-emerald-600">Mobile link copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="size-3.5" />
                    <span>Copy mobile link</span>
                  </>
                )}
              </button>
            )}
          </div>

          {/* Guide Steps */}
          <div className="space-y-4 md:col-span-7">
            <div className="space-y-3">
              <div className="flex items-start gap-3 rounded-xl border border-gray-100 bg-gray-50/60 p-3">
                <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-navy-900 text-xs font-bold text-white">
                  1
                </div>
                <div className="text-xs">
                  <p className="font-semibold text-gray-900">Scan with your phone</p>
                  <p className="text-gray-500">
                    Open your standard iOS or Android camera app and point it at the QR code.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-xl border border-gray-100 bg-gray-50/60 p-3">
                <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-navy-900 text-xs font-bold text-white">
                  2
                </div>
                <div className="text-xs">
                  <p className="font-semibold text-gray-900">Follow guided head poses</p>
                  <p className="text-gray-500">
                    Confirm when ready and move your head naturally (front, left, right, up, down) as instructed.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-xl border border-gray-100 bg-gray-50/60 p-3">
                <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-navy-900 text-xs font-bold text-white">
                  3
                </div>
                <div className="text-xs">
                  <p className="font-semibold text-gray-900">Automatic transfer to desktop</p>
                  <p className="text-gray-500">
                    Once complete, your face scan automatically syncs here in real time.
                  </p>
                </div>
              </div>
            </div>

            {/* Network Reminder */}
            {session && (
              <div className="flex items-center gap-2 rounded-xl border border-marigold-200/80 bg-marigold-50/70 p-3 text-[11px] text-navy-900">
                <Wifi className="size-4 shrink-0 text-marigold-600" />
                <span>
                  Make sure your phone is connected to the same local Wi-Fi network (<strong>{session.network_ip}</strong>).
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

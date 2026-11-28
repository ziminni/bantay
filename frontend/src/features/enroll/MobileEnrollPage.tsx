import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Play,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react'
import { detectHeadPose } from '@/api/recognition'
import { getEnrollmentSession, uploadSessionPhotos } from '@/api/sessions'
import { Button } from '@/components/ui/Button'
import { BIOMETRIC_STEPS, TOTAL_BIOMETRIC_TARGET } from '@/lib/biometrics'
import { cn } from '@/lib/cn'
import {
  ACCEPTED_IMAGE_TYPES,
  MAX_ENROLLMENT_PHOTOS,
  MAX_UPLOAD_BYTES,
  MIN_ENROLLMENT_PHOTOS,
} from '@/lib/constants'

const FLASH_COLORS = ['#06b6d4', '#ec4899', '#f59e0b', '#10b981', '#ffffff']

const YAW_THRESHOLD_DEG = 9.5
const PITCH_THRESHOLD_DEG = 6.0
const NOSE_X_THRESHOLD = 0.095
const NOSE_Y_THRESHOLD = 0.05
const REQUIRED_HOLD_MS = 350
const STEP_TRANSITION_MS = 700
const COUNTDOWN_SECONDS = 3

type ScanPhase = 'ready' | 'countdown' | 'scanning' | 'uploading' | 'done'

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

interface NeutralBaseline {
  yawDeg: number
  pitchDeg: number
  noseX: number
  noseY: number
}

export function MobileEnrollPage() {
  const [params] = useSearchParams()
  const sessionId = params.get('session')

  const [sessionLoading, setSessionLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [capturedCount, setCapturedCount] = useState(0)
  const [fallbackMode, setFallbackMode] = useState(false)

  // Camera & live pose states
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const probeCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const capturedFilesRef = useRef<File[]>([])

  const [cameraState, setCameraState] = useState<'starting' | 'running' | 'error' | 'unsupported'>('starting')
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [faceDetected, setFaceDetected] = useState(false)
  const [liveYaw, setLiveYaw] = useState(0)
  const [livePitch, setLivePitch] = useState(0)
  const [isConditionMet, setIsConditionMet] = useState(false)
  const [holdProgress, setHoldProgress] = useState(0)
  const [flashColor, setFlashColor] = useState<string | null>(null)

  const [phase, setPhaseState] = useState<ScanPhase>('ready')
  const [countdown, setCountdown] = useState<number | null>(null)
  const [currentStepIdx, setCurrentStepIdx] = useState(0)

  const phaseRef = useRef<ScanPhase>('ready')
  const stepIdxRef = useRef(0)
  const photosInStepRef = useRef(0)
  const isSnappingRef = useRef(false)
  const holdAccumMsRef = useRef(0)
  const lastEvalAtRef = useRef<number | null>(null)
  const stepPauseUntilRef = useRef(0)
  const baselineRef = useRef<NeutralBaseline | null>(null)
  const targetDotRef = useRef({ yaw: 0, pitch: 0 })
  const colorIdxRef = useRef(0)

  const setPhase = useCallback((next: ScanPhase) => {
    phaseRef.current = next
    setPhaseState(next)
  }, [])

  const targetTotal = Math.min(TOTAL_BIOMETRIC_TARGET, MAX_ENROLLMENT_PHOTOS)
  const currentStep = BIOMETRIC_STEPS[Math.min(currentStepIdx, BIOMETRIC_STEPS.length - 1)]

  // 1. Validate QR session on open
  useEffect(() => {
    if (!sessionId) {
      setError('No session ID found. Scan the QR code displayed on the Bantay computer screen.')
      setSessionLoading(false)
      return
    }

    getEnrollmentSession(sessionId)
      .then((data) => {
        if (data.status === 'expired') {
          setError('This QR session has expired. Generate a new QR code on your computer.')
        }
      })
      .catch(() => {
        setError('Invalid or expired session. Re-scan the QR code on the computer screen.')
      })
      .finally(() => setSessionLoading(false))
  }, [sessionId])

  // 2. Smooth 60fps reticle dot interpolation
  useEffect(() => {
    let raf = 0
    const animate = () => {
      setLiveYaw((prev) => {
        const diff = targetDotRef.current.yaw - prev
        return Math.abs(diff) < 0.002 ? targetDotRef.current.yaw : prev + diff * 0.28
      })
      setLivePitch((prev) => {
        const diff = targetDotRef.current.pitch - prev
        return Math.abs(diff) < 0.002 ? targetDotRef.current.pitch : prev + diff * 0.28
      })
      raf = requestAnimationFrame(animate)
    }
    raf = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(raf)
  }, [])

  // 3. Connect front selfie camera cleanly
  const connectCamera = useCallback(async () => {
    setCameraState('starting')
    setCameraError(null)

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraState('unsupported')
      setCameraError('Live camera access requires HTTPS.')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setCameraState('running')
    } catch (err: unknown) {
      setCameraState('error')
      if (err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')) {
        setCameraError('Camera permission denied. Allow camera access in your browser settings.')
      } else {
        setCameraError('Could not start front camera.')
      }
    }
  }, [])

  useEffect(() => {
    if (sessionLoading || fallbackMode || phase === 'done') return
    void connectCamera()
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }
    }
  }, [sessionLoading, fallbackMode, phase, connectCamera])

  // 4. Send captured frames to desktop and close camera
  const transmitPhotos = useCallback(
    async (filesToSend: File[]) => {
      if (!sessionId || filesToSend.length === 0) return
      setPhase('uploading')
      setError(null)

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }

      try {
        await uploadSessionPhotos(sessionId, filesToSend)
        setPhase('done')
      } catch {
        setError('Could not transfer face data. Make sure your phone is on the same Wi-Fi.')
        setPhase('ready')
      }
    },
    [sessionId, setPhase],
  )

  // 5. Countdown after user confirms Ready
  useEffect(() => {
    if (phase !== 'countdown' || countdown === null) return
    if (countdown <= 0) {
      setCountdown(null)
      holdAccumMsRef.current = 0
      lastEvalAtRef.current = null
      stepPauseUntilRef.current = Date.now() + 200
      setPhase('scanning')
      return
    }
    const timer = setTimeout(() => setCountdown((c) => (c !== null ? c - 1 : null)), 850)
    return () => clearTimeout(timer)
  }, [phase, countdown, setPhase])

  // 6. Silent frame snapshot (stored only in memory ref — never displayed as thumbnails)
  const snapFrame = useCallback(async (tag: string): Promise<void> => {
    const video = videoRef.current
    if (!video || video.readyState < 2 || isSnappingRef.current) return

    isSnappingRef.current = true
    const color = FLASH_COLORS[colorIdxRef.current % FLASH_COLORS.length]
    colorIdxRef.current += 1
    setFlashColor(color)
    await new Promise((r) => setTimeout(r, 90))

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth || 1280
    canvas.height = video.videoHeight || 720
    const ctx = canvas.getContext('2d')

    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      await new Promise((r) => setTimeout(r, 50))
      setFlashColor(null)

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', 0.92),
      )
      if (blob) {
        const file = new File([blob], `mobile_${tag}_${Date.now()}.jpg`, { type: 'image/jpeg' })
        capturedFilesRef.current.push(file)
        setCapturedCount(capturedFilesRef.current.length)
      }
    } else {
      setFlashColor(null)
    }

    await new Promise((r) => setTimeout(r, 180))
    isSnappingRef.current = false
  }, [])

  // 7. Live 68-point 3D landmark head-pose loop
  useEffect(() => {
    if (cameraState !== 'running' || phase === 'uploading' || phase === 'done' || fallbackMode) return

    const canvas = probeCanvasRef.current || document.createElement('canvas')
    canvas.width = 320
    canvas.height = 240
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let active = true
    const abortCtrl = new AbortController()

    const poll = async () => {
      while (active) {
        const video = videoRef.current
        if (!video || video.readyState < 2 || isSnappingRef.current) {
          await new Promise((r) => setTimeout(r, 60))
          continue
        }

        const vw = video.videoWidth || 480
        const vh = video.videoHeight || 640
        const scale = 320 / Math.max(vw, vh)
        const pw = Math.max(1, Math.round(vw * scale))
        const ph = Math.max(1, Math.round(vh * scale))
        if (canvas.width !== pw || canvas.height !== ph) {
          canvas.width = pw
          canvas.height = ph
        }
        ctx.drawImage(video, 0, 0, pw, ph)

        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, 'image/jpeg', 0.7),
        )
        if (!blob || !active) break

        try {
          const res = await detectHeadPose(blob, abortCtrl.signal)
          if (!active) break

          const now = Date.now()
          const dt = lastEvalAtRef.current ? Math.min(250, now - lastEvalAtRef.current) : 90
          lastEvalAtRef.current = now

          if (!res.detected || !res.pose) {
            setFaceDetected(false)
            setIsConditionMet(false)
            holdAccumMsRef.current = Math.max(0, holdAccumMsRef.current - dt)
            setHoldProgress(Math.round((holdAccumMsRef.current / REQUIRED_HOLD_MS) * 100))
          } else {
            const p = res.pose
            setFaceDetected(true)

            if (
              (phaseRef.current === 'ready' || phaseRef.current === 'countdown') &&
              Math.abs(p.yaw_deg) < 16
            ) {
              const prev = baselineRef.current
              baselineRef.current = prev
                ? {
                    yawDeg: prev.yawDeg * 0.7 + p.yaw_deg * 0.3,
                    pitchDeg: prev.pitchDeg * 0.7 + p.pitch_deg * 0.3,
                    noseX: prev.noseX * 0.7 + p.nose_x_ratio * 0.3,
                    noseY: prev.noseY * 0.7 + p.nose_y_ratio * 0.3,
                  }
                : {
                    yawDeg: p.yaw_deg,
                    pitchDeg: p.pitch_deg,
                    noseX: p.nose_x_ratio,
                    noseY: p.nose_y_ratio,
                  }
            }

            const base = baselineRef.current
            const deltaYaw = base ? p.yaw_deg - base.yawDeg : p.yaw_deg
            const deltaPitch = base ? p.pitch_deg - base.pitchDeg : 0
            const deltaNoseX = base ? p.nose_x_ratio - base.noseX : p.nose_x_ratio
            const deltaNoseY = base ? p.nose_y_ratio - base.noseY : p.nose_y_ratio - 0.56

            const fusedYawNorm =
              Math.abs(deltaNoseX / NOSE_X_THRESHOLD) > Math.abs(deltaYaw / YAW_THRESHOLD_DEG)
                ? deltaNoseX / NOSE_X_THRESHOLD
                : deltaYaw / YAW_THRESHOLD_DEG
            const fusedPitchNorm =
              Math.abs(deltaNoseY / NOSE_Y_THRESHOLD) > Math.abs(deltaPitch / PITCH_THRESHOLD_DEG)
                ? deltaNoseY / NOSE_Y_THRESHOLD
                : deltaPitch / PITCH_THRESHOLD_DEG

            targetDotRef.current = {
              yaw: clamp(fusedYawNorm * 0.22, -0.36, 0.36),
              pitch: clamp(fusedPitchNorm * 0.18, -0.36, 0.36),
            }

            if (phaseRef.current === 'scanning' && now >= stepPauseUntilRef.current) {
              const step = BIOMETRIC_STEPS[stepIdxRef.current]
              const centred =
                p.size >= 0.09 &&
                Math.abs(p.center_x - 0.5) < 0.34 &&
                Math.abs(p.center_y - 0.5) < 0.36

              let conditionMet = false
              if (step.id === 'center') {
                conditionMet = centred && Math.abs(p.yaw_deg) < 16
                if (conditionMet) {
                  baselineRef.current = base
                    ? {
                        yawDeg: base.yawDeg * 0.75 + p.yaw_deg * 0.25,
                        pitchDeg: base.pitchDeg * 0.75 + p.pitch_deg * 0.25,
                        noseX: base.noseX * 0.75 + p.nose_x_ratio * 0.25,
                        noseY: base.noseY * 0.75 + p.nose_y_ratio * 0.25,
                      }
                    : {
                        yawDeg: p.yaw_deg,
                        pitchDeg: p.pitch_deg,
                        noseX: p.nose_x_ratio,
                        noseY: p.nose_y_ratio,
                      }
                }
              } else if (step.id === 'turn_left') {
                conditionMet =
                  deltaYaw <= -YAW_THRESHOLD_DEG ||
                  p.yaw_deg <= -(YAW_THRESHOLD_DEG + 1) ||
                  deltaNoseX <= -NOSE_X_THRESHOLD
              } else if (step.id === 'turn_right') {
                conditionMet =
                  deltaYaw >= YAW_THRESHOLD_DEG ||
                  p.yaw_deg >= YAW_THRESHOLD_DEG + 1 ||
                  deltaNoseX >= NOSE_X_THRESHOLD
              } else if (step.id === 'tilt_up') {
                conditionMet =
                  deltaPitch <= -PITCH_THRESHOLD_DEG || deltaNoseY <= -NOSE_Y_THRESHOLD
              } else if (step.id === 'tilt_down') {
                conditionMet =
                  deltaPitch >= PITCH_THRESHOLD_DEG || deltaNoseY >= NOSE_Y_THRESHOLD
              }

              setIsConditionMet(conditionMet)

              if (conditionMet) {
                holdAccumMsRef.current = Math.min(REQUIRED_HOLD_MS, holdAccumMsRef.current + dt)
              } else {
                holdAccumMsRef.current = Math.max(0, holdAccumMsRef.current - dt * 0.65)
              }

              setHoldProgress(
                Math.min(100, Math.round((holdAccumMsRef.current / REQUIRED_HOLD_MS) * 100)),
              )

              if (holdAccumMsRef.current >= REQUIRED_HOLD_MS) {
                holdAccumMsRef.current = 0
                setHoldProgress(0)

                const nextSubIdx = photosInStepRef.current + 1
                photosInStepRef.current = nextSubIdx

                await snapFrame(`${step.id}_${nextSubIdx}`)
                lastEvalAtRef.current = Date.now()

                if (nextSubIdx >= step.photosToCapture) {
                  photosInStepRef.current = 0
                  const nextStepIdx = stepIdxRef.current + 1

                  if (
                    nextStepIdx >= BIOMETRIC_STEPS.length ||
                    capturedFilesRef.current.length >= targetTotal
                  ) {
                    setIsConditionMet(false)
                    await transmitPhotos([...capturedFilesRef.current])
                    break
                  } else {
                    stepIdxRef.current = nextStepIdx
                    setCurrentStepIdx(nextStepIdx)
                    setIsConditionMet(false)
                    stepPauseUntilRef.current = Date.now() + STEP_TRANSITION_MS
                  }
                }
              }
            } else {
              setIsConditionMet(false)
              setHoldProgress(0)
            }
          }
        } catch {
          if (!active) break
        }

        await new Promise((r) => setTimeout(r, 35))
      }
    }

    void poll()

    return () => {
      active = false
      abortCtrl.abort()
    }
  }, [cameraState, phase, fallbackMode, snapFrame, targetTotal, transmitPhotos])

  const startScan = () => {
    stepIdxRef.current = 0
    photosInStepRef.current = 0
    holdAccumMsRef.current = 0
    lastEvalAtRef.current = null
    capturedFilesRef.current = []
    setCapturedCount(0)
    setCurrentStepIdx(0)
    setHoldProgress(0)
    setIsConditionMet(false)
    setCountdown(COUNTDOWN_SECONDS)
    setPhase('countdown')
  }

  const cancelScan = () => {
    stepIdxRef.current = 0
    photosInStepRef.current = 0
    holdAccumMsRef.current = 0
    lastEvalAtRef.current = null
    capturedFilesRef.current = []
    setCapturedCount(0)
    setCountdown(null)
    setFlashColor(null)
    setHoldProgress(0)
    setIsConditionMet(false)
    setCurrentStepIdx(0)
    setPhase('ready')
  }

  const handleFallbackFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return
    for (const f of Array.from(fileList)) {
      if (!ACCEPTED_IMAGE_TYPES.includes(f.type) && !f.type.startsWith('image/')) continue
      if (f.size > MAX_UPLOAD_BYTES) continue
      if (capturedFilesRef.current.length >= MAX_ENROLLMENT_PHOTOS) break
      capturedFilesRef.current.push(f)
    }
    setCapturedCount(capturedFilesRef.current.length)
  }

  if (sessionLoading) {
    return (
      <div className="min-h-dvh bg-cream text-navy-900 flex flex-col items-center justify-center p-6">
        <RefreshCw className="size-7 text-marigold-500 animate-spin mb-3" />
        <p className="text-sm font-medium text-gray-600">Connecting to Bantay...</p>
      </div>
    )
  }

  const progressPct = Math.min(100, Math.round((capturedCount / targetTotal) * 100))
  const targetX = 50 + currentStep.targetYaw * 120
  const targetY = 50 + currentStep.targetPitch * 120
  const liveX = 50 + liveYaw * 120
  const liveY = 50 + livePitch * 120

  return (
    <div className="min-h-dvh bg-cream text-navy-900 flex flex-col select-none">
      <canvas ref={probeCanvasRef} className="hidden" />

      {/* Clean Compact Mobile Header */}
      <header className="shrink-0 bg-navy-900 text-cream px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="size-7 rounded-lg bg-marigold-400 flex items-center justify-center font-display font-bold text-navy-950 text-xs">
            B
          </div>
          <span className="font-display font-semibold text-sm">Bantay Face Scan</span>
        </div>

        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-medium text-cream">
          <span className="size-1.5 rounded-full bg-emerald-400" />
          Connected
        </span>
      </header>

      <main className="flex-1 w-full max-w-sm mx-auto px-5 py-5 flex flex-col justify-between gap-4">
        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-3.5 py-2.5 text-red-700 text-xs flex items-start gap-2">
            <AlertCircle className="size-4 text-red-500 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {phase === 'done' ? (
          /* Clean Completion Screen (No Photos Displayed) */
          <div className="my-auto rounded-2xl border border-gray-200 bg-white p-6 text-center space-y-5 shadow-card">
            <div className="size-16 bg-emerald-50 border border-emerald-200 rounded-full flex items-center justify-center mx-auto text-emerald-600">
              <CheckCircle2 className="size-8" />
            </div>

            <div className="space-y-1.5">
              <h2 className="font-display text-xl font-semibold text-navy-900">Face Scan Complete</h2>
              <p className="text-xs text-gray-600 leading-relaxed">
                Your face scan has been securely sent to the lab computer.
              </p>
            </div>

            <div className="rounded-xl border border-marigold-200 bg-marigold-50 p-3.5 text-left space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-navy-900">
                <ShieldCheck className="size-4 text-marigold-600" /> Finish on computer
              </div>
              <p className="text-xs text-gray-700 leading-relaxed">
                Return to the computer screen and click <strong>Enroll photos</strong> to complete registration.
              </p>
            </div>

            <Button onClick={cancelScan} className="w-full justify-center">
              Scan Again
            </Button>
          </div>
        ) : phase === 'uploading' ? (
          /* Clean Transmitting State (No Photos Displayed) */
          <div className="my-auto rounded-2xl border border-gray-200 bg-white p-8 text-center space-y-3 shadow-card">
            <RefreshCw className="size-8 text-marigold-500 animate-spin mx-auto" />
            <p className="font-display text-base font-semibold text-navy-900">Sending scan to computer…</p>
            <p className="text-xs text-gray-500">Keep this screen open for a moment.</p>
          </div>
        ) : !fallbackMode ? (
          <>
            {/* 1. Dedicated Instruction Header (Above Camera — Never Overlaps Video) */}
            <div className="text-center space-y-1 pt-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-marigold-700">
                {phase === 'ready'
                  ? 'Face Enrollment'
                  : phase === 'countdown'
                    ? 'Starting Scan'
                    : `Step ${currentStepIdx + 1} of ${BIOMETRIC_STEPS.length}`}
              </p>
              <h1 className="font-display text-xl font-semibold text-navy-900 leading-snug">
                {phase === 'ready'
                  ? 'Ready to scan your face?'
                  : phase === 'countdown'
                    ? 'Look straight ahead'
                    : currentStep.instruction}
              </h1>
              <p className="text-xs text-gray-600 min-h-[1.25rem]">
                {phase === 'ready' ? (
                  faceDetected ? (
                    <span className="font-medium text-emerald-700">✓ Face centered — tap Start Scan below</span>
                  ) : (
                    'Position your face inside the oval in good lighting'
                  )
                ) : phase === 'countdown' ? (
                  'Hold still while calibrating your position…'
                ) : isConditionMet ? (
                  <span className="font-semibold text-emerald-700">Hold steady ({holdProgress}%)…</span>
                ) : (
                  currentStep.subtext
                )}
              </p>
            </div>

            {/* 2. Uncluttered Portrait Oval Viewfinder (Zero Overlapping Text/Buttons) */}
            <div className="relative mx-auto w-full max-w-[280px] aspect-[3/4] overflow-hidden rounded-3xl bg-navy-950 border-2 border-navy-900 shadow-raised">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={cn(
                  'size-full object-cover -scale-x-100 transition-opacity duration-300',
                  cameraState === 'running' ? 'opacity-100' : 'opacity-0',
                )}
              />

              {cameraState === 'starting' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/80">
                  <div className="size-7 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                  <p className="text-xs">Opening camera…</p>
                </div>
              )}

              {(cameraState === 'error' || cameraState === 'unsupported') && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-5 text-center text-white bg-navy-950/95">
                  <p className="font-medium text-sm mb-1">{cameraError ?? 'Camera unavailable'}</p>
                  <p className="text-xs text-navy-200 mb-4">
                    Allow camera access or use the fallback option below.
                  </p>
                  <Button size="sm" variant="primary" onClick={connectCamera}>
                    Retry Camera
                  </Button>
                </div>
              )}

              {/* Chromatic Liveness Flash */}
              {flashColor && (
                <div
                  className="absolute inset-0 z-30 pointer-events-none transition-opacity duration-75"
                  style={{ backgroundColor: flashColor, opacity: 0.9 }}
                />
              )}

              {/* Clean Oval Cutout + Alignment Guides */}
              {cameraState === 'running' && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div
                    className={cn(
                      'relative w-[72%] h-[76%] rounded-[50%] border-2 transition-all duration-200 shadow-[0_0_0_9999px_rgba(9,28,49,0.58)]',
                      countdown !== null
                        ? 'border-marigold-400 scale-[1.02]'
                        : isConditionMet
                          ? 'border-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.45),0_0_0_9999px_rgba(9,28,49,0.58)]'
                          : faceDetected
                            ? 'border-marigold-400'
                            : 'border-white/65 border-dashed',
                    )}
                  >
                    {/* Corner brackets */}
                    <div className="absolute -top-1 -left-1 size-3 border-t-2 border-l-2 border-marigold-400" />
                    <div className="absolute -top-1 -right-1 size-3 border-t-2 border-r-2 border-marigold-400" />
                    <div className="absolute -bottom-1 -left-1 size-3 border-b-2 border-l-2 border-marigold-400" />
                    <div className="absolute -bottom-1 -right-1 size-3 border-b-2 border-r-2 border-marigold-400" />

                    {/* Live Head Tracking Reticle */}
                    {faceDetected && countdown === null && (
                      <div className="absolute inset-0">
                        {phase === 'scanning' && (
                          <div
                            className="absolute size-7 rounded-full border-2 border-marigold-400 bg-marigold-400/20 flex items-center justify-center -translate-x-1/2 -translate-y-1/2 transition-all duration-300"
                            style={{ left: `${targetX}%`, top: `${targetY}%` }}
                          >
                            <span className="size-2 rounded-full bg-marigold-400 animate-ping" />
                          </div>
                        )}
                        <div
                          className={cn(
                            'absolute size-3.5 rounded-full shadow -translate-x-1/2 -translate-y-1/2',
                            isConditionMet
                              ? 'bg-emerald-400 ring-4 ring-emerald-400/40 scale-125'
                              : 'bg-white ring-2 ring-white/50',
                          )}
                          style={{ left: `${liveX}%`, top: `${liveY}%` }}
                        />
                      </div>
                    )}

                    {/* Countdown Circle */}
                    {countdown !== null && countdown > 0 && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="flex size-16 items-center justify-center rounded-full bg-navy-950/75 text-3xl font-bold text-marigold-300 border-2 border-marigold-400">
                          {countdown}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 3. Clean Progress Bar & Single Action Area (No Photo Thumbnails) */}
            <div className="space-y-3 pb-2">
              {phase === 'scanning' || phase === 'countdown' ? (
                <>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-gray-600">
                      <span className="font-medium text-navy-900">Scan progress</span>
                      <span className="font-mono tabular-nums">{progressPct}%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                      <div
                        className="h-full rounded-full bg-marigold-400 transition-all duration-300"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button onClick={cancelScan} className="flex-1 justify-center">
                      Cancel
                    </Button>
                    {capturedCount >= MIN_ENROLLMENT_PHOTOS && (
                      <Button
                        variant="primary"
                        onClick={() => transmitPhotos([...capturedFilesRef.current])}
                        icon={<ArrowRight />}
                        className="flex-1 justify-center"
                      >
                        Finish &amp; Send
                      </Button>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <Button
                    variant="primary"
                    onClick={startScan}
                    disabled={cameraState !== 'running'}
                    icon={<Play className="size-4 fill-current" />}
                    className="h-11 w-full justify-center text-sm"
                  >
                    I&apos;m Ready — Start Scan
                  </Button>

                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => setFallbackMode(true)}
                      className="text-xs text-gray-500 hover:text-navy-900 underline"
                    >
                      Camera blocked? Use native phone camera instead
                    </button>
                  </div>
                </>
              )}
            </div>
          </>
        ) : (
          /* Fallback Native Camera Mode (Also Shows Zero Photo Previews) */
          <div className="my-auto rounded-2xl border border-gray-200 bg-white p-5 space-y-4 shadow-card">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-semibold text-navy-900">Native Phone Camera</h2>
              <button
                type="button"
                onClick={() => setFallbackMode(false)}
                className="text-xs font-medium text-navy-700 underline"
              >
                Use Live Scanner
              </button>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed">
              Capture at least {MIN_ENROLLMENT_PHOTOS} angles of your face (front, slightly left, slightly right).
            </p>

            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="user"
              className="hidden"
              onChange={(e) => {
                handleFallbackFiles(e.target.files)
                e.target.value = ''
              }}
            />

            <div className="rounded-xl bg-gray-50 border border-gray-200 px-3.5 py-2.5 flex items-center justify-between text-xs">
              <span className="text-gray-600">Angles captured</span>
              <span className="font-mono font-semibold text-navy-900">
                {capturedCount} / {MAX_ENROLLMENT_PHOTOS}
              </span>
            </div>

            <Button onClick={() => cameraInputRef.current?.click()} className="w-full justify-center">
              Capture Angle
            </Button>

            {capturedCount >= MIN_ENROLLMENT_PHOTOS && (
              <Button
                variant="primary"
                onClick={() => transmitPhotos([...capturedFilesRef.current])}
                icon={<ArrowRight />}
                className="w-full justify-center"
              >
                Send Scan to Computer
              </Button>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

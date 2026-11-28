import { useCallback, useEffect, useRef, useState } from 'react'
import { detectHeadPose } from '@/api/recognition'
import { Button } from '@/components/ui/Button'
import { BIOMETRIC_STEPS, TOTAL_BIOMETRIC_TARGET } from '@/lib/biometrics'
import { cn } from '@/lib/cn'

// Rapid chromatic flash sequence (GoTyme / MariBank active liveness)
const FLASH_COLORS = [
  { name: 'Cyan', hex: '#06b6d4' },
  { name: 'Magenta', hex: '#ec4899' },
  { name: 'Amber', hex: '#f59e0b' },
  { name: 'Emerald', hex: '#10b981' },
  { name: 'White', hex: '#ffffff' },
]

// Natural head-turn thresholds (degrees & keypoint ratios)
const YAW_THRESHOLD_DEG = 9.5
const PITCH_THRESHOLD_DEG = 6.0
const NOSE_X_THRESHOLD = 0.095
const NOSE_Y_THRESHOLD = 0.05
const REQUIRED_HOLD_MS = 350
const STEP_TRANSITION_MS = 700
const COUNTDOWN_SECONDS = 3

type ScanPhase = 'ready' | 'countdown' | 'scanning' | 'done'

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

function playBiometricChime(type: 'target_met' | 'snap' | 'complete') {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)

    if (type === 'target_met') {
      osc.type = 'sine'
      osc.frequency.setValueAtTime(440, ctx.currentTime)
      osc.frequency.exponentialRampToValueAtTime(587.33, ctx.currentTime + 0.08)
      gain.gain.setValueAtTime(0.05, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12)
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.12)
    } else if (type === 'snap') {
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(659.25, ctx.currentTime)
      osc.frequency.exponentialRampToValueAtTime(987.77, ctx.currentTime + 0.07)
      gain.gain.setValueAtTime(0.1, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14)
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.14)
    } else if (type === 'complete') {
      osc.type = 'sine'
      const now = ctx.currentTime
      osc.frequency.setValueAtTime(523.25, now)
      osc.frequency.setValueAtTime(659.25, now + 0.09)
      osc.frequency.setValueAtTime(783.99, now + 0.18)
      osc.frequency.setValueAtTime(1046.5, now + 0.28)
      gain.gain.setValueAtTime(0.12, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5)
      osc.start(now)
      osc.stop(now + 0.5)
    }
  } catch {
    // Ignore autoplay restriction
  }
}

interface NeutralBaseline {
  yawDeg: number
  pitchDeg: number
  noseX: number
  noseY: number
}

interface WebcamCaptureProps {
  files: File[]
  onCapture: (file: File) => void
  onComplete?: (files: File[]) => void
  max: number
  disabled?: boolean
  onSwitchToUpload?: () => void
}

export function WebcamCapture({
  files,
  onCapture,
  onComplete,
  max,
  disabled,
  onSwitchToUpload,
}: WebcamCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const probeCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const capturedPhotosRef = useRef<File[]>([])

  const [cameraState, setCameraState] = useState<'starting' | 'running' | 'error' | 'unsupported'>('starting')
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('')
  const [showLivenessInfo, setShowLivenessInfo] = useState(false)

  // Live 3D pose & flash liveness states
  const [faceDetected, setFaceDetected] = useState(false)
  const [liveYaw, setLiveYaw] = useState(0)
  const [livePitch, setLivePitch] = useState(0)
  const [isConditionMet, setIsConditionMet] = useState(false)
  const [holdProgress, setHoldProgress] = useState(0)
  const [flashColor, setFlashColor] = useState<string | null>(null)
  const [isCapturing, setIsCapturing] = useState(false)

  // Workflow states — always asks Ready before capturing
  const [phase, setPhaseState] = useState<ScanPhase>('ready')
  const [countdown, setCountdown] = useState<number | null>(null)
  const [currentStepIdx, setCurrentStepIdx] = useState(0)
  const scanFinished = phase === 'done'

  const phaseRef = useRef<ScanPhase>('ready')
  const stepIdxRef = useRef(0)
  const photosInStepRef = useRef(0)
  const isSnappingRef = useRef(false)
  const holdAccumMsRef = useRef(0)
  const lastEvalAtRef = useRef<number | null>(null)
  const stepPauseUntilRef = useRef(0)
  const targetMetChimedRef = useRef(false)
  const baselineRef = useRef<NeutralBaseline | null>(null)
  const targetDotRef = useRef({ yaw: 0, pitch: 0 })
  const colorIdxRef = useRef(0)

  const setPhase = useCallback((next: ScanPhase) => {
    phaseRef.current = next
    setPhaseState(next)
  }, [])

  const currentStep = BIOMETRIC_STEPS[Math.min(currentStepIdx, BIOMETRIC_STEPS.length - 1)]

  // Reset back to 'ready' if all photos are cleared externally
  useEffect(() => {
    if (files.length === 0 && phaseRef.current === 'done') {
      stepIdxRef.current = 0
      photosInStepRef.current = 0
      baselineRef.current = null
      capturedPhotosRef.current = []
      holdAccumMsRef.current = 0
      setCurrentStepIdx(0)
      setHoldProgress(0)
      setIsConditionMet(false)
      setPhase('ready')
    }
  }, [files.length, setPhase])

  // Smooth 60fps animation for head-tracking dot inside the oval
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

  // Countdown after user confirms they are ready
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
    const t = setTimeout(() => setCountdown((c) => (c !== null ? c - 1 : null)), 850)
    return () => clearTimeout(t)
  }, [phase, countdown, setPhase])

  const connectCamera = useCallback(async (deviceId?: string) => {
    setCameraState('starting')
    setCameraError(null)

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraState('unsupported')
      setCameraError('Camera access is not supported by your browser or environment.')
      return
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: deviceId
          ? { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
          : { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }

      const allDevices = await navigator.mediaDevices.enumerateDevices()
      const videoInputs = allDevices.filter((d) => d.kind === 'videoinput')
      setDevices(videoInputs)
      if (deviceId) {
        setSelectedDeviceId(deviceId)
      } else {
        const activeTrack = stream.getVideoTracks()[0]
        const activeSetting = activeTrack?.getSettings()
        if (activeSetting?.deviceId) {
          setSelectedDeviceId(activeSetting.deviceId)
        }
      }

      setCameraState('running')
    } catch (err: unknown) {
      setCameraState('error')
      if (err instanceof DOMException) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setCameraError('Camera permission was denied. Please allow camera access in your browser settings.')
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          setCameraError('No webcam was found on this device.')
        } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
          setCameraError('Camera is already in use by another application or tab.')
        } else {
          setCameraError(`Camera error: ${err.message}`)
        }
      } else {
        setCameraError('Failed to access webcam.')
      }
    }
  }, [])

  useEffect(() => {
    connectCamera()
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }
    }
  }, [connectCamera])

  // Capture frame with screen flash liveness illumination
  const captureFrame = useCallback(
    async (tag: string, fullChromaticSweep = false): Promise<File | null> => {
      const video = videoRef.current
      if (!video || video.readyState < 2 || isSnappingRef.current) return null

      isSnappingRef.current = true
      setIsCapturing(true)
      playBiometricChime('snap')

      if (fullChromaticSweep) {
        for (const col of FLASH_COLORS) {
          setFlashColor(col.hex)
          await new Promise((r) => setTimeout(r, 80))
        }
      } else {
        const col = FLASH_COLORS[colorIdxRef.current % FLASH_COLORS.length]
        colorIdxRef.current += 1
        setFlashColor(col.hex)
        await new Promise((r) => setTimeout(r, 95))
      }

      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth || 1280
      canvas.height = video.videoHeight || 720
      const ctx = canvas.getContext('2d')

      let resultFile: File | null = null
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        await new Promise((r) => setTimeout(r, 55))
        setFlashColor(null)

        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, 'image/jpeg', 0.95),
        )
        if (blob) {
          resultFile = new File([blob], `face_${tag}_${Date.now()}.jpg`, { type: 'image/jpeg' })
          capturedPhotosRef.current.push(resultFile)
          onCapture(resultFile)
        }
      } else {
        setFlashColor(null)
      }

      setIsCapturing(false)
      await new Promise((r) => setTimeout(r, 200))
      isSnappingRef.current = false
      return resultFile
    },
    [onCapture],
  )

  // Manual single snapshot fallback (kept intact from original design)
  const handleSnap = async () => {
    if (files.length >= max || isCapturing || disabled) return
    await captureFrame(currentStep.id, true)
  }

  // Start guided hands-free scan after user confirms Ready
  const handleStartScan = () => {
    if (files.length >= max || isCapturing || disabled) return
    stepIdxRef.current = 0
    photosInStepRef.current = 0
    holdAccumMsRef.current = 0
    lastEvalAtRef.current = null
    targetMetChimedRef.current = false
    capturedPhotosRef.current = [...files]
    setCurrentStepIdx(0)
    setHoldProgress(0)
    setIsConditionMet(false)
    setCountdown(COUNTDOWN_SECONDS)
    setPhase('countdown')
  }

  const stopGuidedSequence = () => {
    holdAccumMsRef.current = 0
    lastEvalAtRef.current = null
    targetMetChimedRef.current = false
    setCountdown(null)
    setFlashColor(null)
    setIsCapturing(false)
    setHoldProgress(0)
    setIsConditionMet(false)
    setPhase('ready')
  }

  // Real-time 68-point 3D landmark head-pose tracking loop
  useEffect(() => {
    if (cameraState !== 'running' || scanFinished) return

    const canvas = probeCanvasRef.current || document.createElement('canvas')
    canvas.width = 320
    canvas.height = 240
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let active = true
    const abortCtrl = new AbortController()

    const pollPose = async () => {
      while (active) {
        const video = videoRef.current
        if (!video || video.readyState < 2 || isSnappingRef.current) {
          await new Promise((r) => setTimeout(r, 60))
          continue
        }

        const vw = video.videoWidth || 640
        const vh = video.videoHeight || 480
        const scale = 320 / Math.max(vw, vh)
        const pw = Math.max(1, Math.round(vw * scale))
        const ph = Math.max(1, Math.round(vh * scale))
        if (canvas.width !== pw || canvas.height !== ph) {
          canvas.width = pw
          canvas.height = ph
        }
        ctx.drawImage(video, 0, 0, pw, ph)

        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, 'image/jpeg', 0.72),
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

            // Calibrate straight-ahead neutral angle while in 'ready' or 'countdown'
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
                Math.abs(p.center_x - 0.5) < 0.32 &&
                Math.abs(p.center_y - 0.5) < 0.34

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
                if (!targetMetChimedRef.current) {
                  playBiometricChime('target_met')
                  targetMetChimedRef.current = true
                }
                holdAccumMsRef.current = Math.min(REQUIRED_HOLD_MS, holdAccumMsRef.current + dt)
              } else {
                holdAccumMsRef.current = Math.max(0, holdAccumMsRef.current - dt * 0.65)
                if (holdAccumMsRef.current === 0) targetMetChimedRef.current = false
              }

              setHoldProgress(
                Math.min(100, Math.round((holdAccumMsRef.current / REQUIRED_HOLD_MS) * 100)),
              )

              if (holdAccumMsRef.current >= REQUIRED_HOLD_MS) {
                holdAccumMsRef.current = 0
                targetMetChimedRef.current = false
                setHoldProgress(0)

                const nextSubIdx = photosInStepRef.current + 1
                photosInStepRef.current = nextSubIdx

                await captureFrame(`${step.id}_angle${nextSubIdx}`, false)
                lastEvalAtRef.current = Date.now()

                if (nextSubIdx >= step.photosToCapture) {
                  photosInStepRef.current = 0
                  const nextStepIdx = stepIdxRef.current + 1

                  if (
                    nextStepIdx >= BIOMETRIC_STEPS.length ||
                    capturedPhotosRef.current.length >= Math.min(TOTAL_BIOMETRIC_TARGET, max)
                  ) {
                    setPhase('done')
                    setIsConditionMet(false)
                    playBiometricChime('complete')
                    if (onComplete) {
                      onComplete([...capturedPhotosRef.current])
                    }
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

    void pollPose()

    return () => {
      active = false
      abortCtrl.abort()
    }
  }, [cameraState, scanFinished, captureFrame, max, onComplete, setPhase])

  const targetX = 50 + currentStep.targetYaw * 120
  const targetY = 50 + currentStep.targetPitch * 120
  const liveX = 50 + liveYaw * 120
  const liveY = 50 + livePitch * 120
  const isGuidedRunning = phase === 'countdown' || phase === 'scanning'

  return (
    <div className="space-y-4">
      <canvas ref={probeCanvasRef} className="hidden" />

      {/* Viewfinder Card — Original Navy + Marigold Design */}
      <div className="relative aspect-[4/3] w-full max-w-xl mx-auto overflow-hidden rounded-2xl bg-navy-950 border border-navy-800 shadow-raised">
        {/* Live video */}
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

        {/* Loading / Starting state */}
        {cameraState === 'starting' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/80">
            <div className="size-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
            <p className="text-xs">Starting camera...</p>
          </div>
        )}

        {/* Error / Unsupported state */}
        {(cameraState === 'error' || cameraState === 'unsupported') && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-white bg-gray-900/90">
            <svg viewBox="0 0 24 24" className="size-10 text-red-400 mb-2" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="m3 3 18 18" />
            </svg>
            <p className="font-medium text-sm mb-1">{cameraError ?? 'Camera unavailable'}</p>
            <p className="text-xs text-gray-400 mb-4 max-w-sm">
              You can grant camera permissions and retry, or use the file upload option to add existing photos.
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => connectCamera(selectedDeviceId)} className="text-white border-white/20 hover:bg-white/10">
                Retry Camera
              </Button>
              {onSwitchToUpload && (
                <Button size="sm" variant="primary" onClick={onSwitchToUpload}>
                  Upload Photos Instead
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Active Flash Liveness Illumination Overlay */}
        {flashColor && (
          <div
            className="absolute inset-0 z-40 pointer-events-none transition-colors duration-75 flex items-center justify-center"
            style={{ backgroundColor: flashColor, opacity: 0.95 }}
          >
            <div className="rounded-full bg-navy-950/60 px-4 py-1.5 text-xs font-semibold text-white tracking-wide shadow-lg">
              ✨ Liveness Flash Reflection
            </div>
          </div>
        )}

        {/* Face Oval Silhouette Guide & Cutout */}
        {cameraState === 'running' && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            {/* Centered oval cutout with darkened exterior via box shadow */}
            <div
              className={cn(
                'relative w-44 h-60 sm:w-52 sm:h-72 rounded-[50%] border-2 transition-all duration-200 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]',
                countdown !== null
                  ? 'border-marigold-400 scale-105 shadow-[0_0_20px_rgba(251,191,36,0.5),0_0_0_9999px_rgba(0,0,0,0.65)]'
                  : flashColor
                    ? 'border-white scale-110 shadow-[0_0_30px_rgba(255,255,255,0.8),0_0_0_9999px_rgba(0,0,0,0.7)]'
                    : isConditionMet || scanFinished
                      ? 'border-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.45),0_0_0_9999px_rgba(0,0,0,0.55)]'
                      : faceDetected
                        ? 'border-marigold-400'
                        : 'border-white/70 border-dashed',
              )}
            >
              {/* Corner alignment brackets */}
              <div className="absolute -top-1 -left-1 size-3 border-t-2 border-l-2 border-marigold-400" />
              <div className="absolute -top-1 -right-1 size-3 border-t-2 border-r-2 border-marigold-400" />
              <div className="absolute -bottom-1 -left-1 size-3 border-b-2 border-l-2 border-marigold-400" />
              <div className="absolute -bottom-1 -right-1 size-3 border-b-2 border-r-2 border-marigold-400" />

              {/* Live Head Tracking Dot & Target Marker inside Oval */}
              {!scanFinished && faceDetected && countdown === null && (
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

              {/* Countdown overlay inside oval */}
              {countdown !== null && countdown > 0 && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="flex size-16 items-center justify-center rounded-full bg-navy-950/70 text-3xl font-bold text-marigold-300 animate-pulse border-2 border-marigold-400">
                    {countdown}
                  </div>
                </div>
              )}

              {/* Hold Steady pill inside oval when pose matches */}
              {phase === 'scanning' && isConditionMet && holdProgress > 0 && (
                <div className="absolute inset-x-0 bottom-4 flex justify-center">
                  <span className="rounded-full bg-navy-950/80 px-3 py-1 text-[11px] font-semibold text-emerald-300 border border-emerald-400/60">
                    Hold steady ({holdProgress}%)
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Top Floating Instruction Pill — Original Slim Pill Design */}
        {cameraState === 'running' && (
          <div className="absolute top-3 inset-x-3 z-20 flex items-center justify-between gap-2 pointer-events-none">
            <div className="flex items-center gap-2 rounded-full bg-navy-950/70 backdrop-blur-md px-3.5 py-1 text-xs text-white border border-white/10 shadow">
              <span
                className={cn(
                  'size-2 rounded-full shrink-0',
                  scanFinished || isConditionMet || (phase === 'ready' && faceDetected)
                    ? 'bg-emerald-400 animate-ping'
                    : 'bg-marigold-400 animate-pulse',
                )}
              />
              {scanFinished ? (
                <span className="font-semibold text-emerald-300">
                  Scan complete · {files.length} photos captured
                </span>
              ) : phase === 'ready' ? (
                <>
                  <span className="font-semibold">Are you ready?</span>
                  <span className="text-white/60">·</span>
                  <span className="text-white/90">
                    {faceDetected ? 'Face centered — click Ready below to start' : 'Center your face inside the oval'}
                  </span>
                </>
              ) : phase === 'countdown' ? (
                <>
                  <span className="font-semibold">Get ready</span>
                  <span className="text-white/60">·</span>
                  <span className="text-white/90">Look straight at the camera</span>
                </>
              ) : (
                <>
                  <span className="font-semibold">{currentStep.title}</span>
                  <span className="text-white/60">·</span>
                  <span className="text-white/90">{currentStep.instruction}</span>
                </>
              )}
            </div>

            {/* Camera switch selector if multiple cameras exist */}
            {devices.length > 1 && (
              <select
                aria-label="Select camera"
                value={selectedDeviceId}
                onChange={(e) => connectCamera(e.target.value)}
                className="pointer-events-auto rounded-full bg-navy-950/70 px-2.5 py-1 text-xs text-white border border-white/20 backdrop-blur-md focus:outline-none"
              >
                {devices.map((d, i) => (
                  <option key={d.deviceId || i} value={d.deviceId}>
                    {d.label || `Camera ${i + 1}`}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {/* Bottom Shutter & Controls Bar — Original Design */}
        {cameraState === 'running' && (
          <div className="absolute bottom-3 inset-x-3 z-20 flex items-center justify-between gap-2">
            <span className="text-[11px] font-medium text-white/80 bg-navy-950/60 px-2.5 py-1 rounded-md backdrop-blur-xs">
              {files.length} of {max} photos taken
            </span>

            <div className="flex items-center gap-2">
              {isGuidedRunning ? (
                <Button size="sm" variant="danger" onClick={stopGuidedSequence}>
                  Cancel Scan
                </Button>
              ) : (
                <>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={handleStartScan}
                    disabled={files.length >= max || isCapturing || disabled}
                  >
                    {scanFinished ? 'Scan Again' : "I'm Ready — Start Scan"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleSnap}
                    disabled={files.length >= max || isCapturing || disabled}
                    className="bg-white/15 text-white hover:bg-white/25 border-white/20"
                    title="Take a single photo with flash"
                  >
                    Snap Single
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Liveness Flash Explanation Note (GoTyme/MariBank reference) — Original Marigold Card */}
      <div className="rounded-lg border border-marigold-200 bg-marigold-50 p-3 text-xs text-gray-700">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5 font-medium text-navy-900">
            <svg viewBox="0 0 20 20" className="size-4 text-marigold-500 shrink-0" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9H9Z" clipRule="evenodd" />
            </svg>
            <span>Active Screen Flash Liveness &amp; Guided Head Tracking</span>
          </div>
          <button
            type="button"
            onClick={() => setShowLivenessInfo((v) => !v)}
            className="text-[11px] font-medium text-navy-700 hover:text-navy-900 underline"
          >
            {showLivenessInfo ? 'Hide explanation' : 'Why does the screen flash colors?'}
          </button>
        </div>

        {showLivenessInfo && (
          <p className="mt-2 text-gray-600 leading-relaxed border-t border-marigold-100 pt-2">
            Similar to banking KYC applications like <strong>GoTyme</strong> and <strong>MariBank</strong>,
            you simply confirm when ready and move your head smoothly (center, left, right, up, down) while
            the screen projects high-contrast chromatic light onto your face during automatic capture.
            This collects multi-angle embeddings for higher recognition accuracy while verifying physical liveness.
          </p>
        )}
      </div>
    </div>
  )
}

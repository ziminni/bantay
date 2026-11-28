import { useCallback, useEffect, useRef, useState } from 'react'
import { CheckCircle2, Play, RefreshCw, Volume2, VolumeX } from 'lucide-react'
import { detectHeadPose } from '@/api/recognition'
import { Button } from '@/components/ui/Button'
import { BIOMETRIC_STEPS, TOTAL_BIOMETRIC_TARGET } from '@/lib/biometrics'
import { cn } from '@/lib/cn'

// Natural head-turn thresholds (degrees & keypoint ratios) so poses feel effortless
const YAW_THRESHOLD_DEG = 9.5
const PITCH_THRESHOLD_DEG = 6.0
const NOSE_X_THRESHOLD = 0.095
const NOSE_Y_THRESHOLD = 0.05
const REQUIRED_HOLD_MS = 350
const STEP_TRANSITION_MS = 750
const COUNTDOWN_SECONDS = 3

type ScanPhase = 'ready' | 'countdown' | 'scanning' | 'done'

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

// Web Audio API chimes for condition match, snap, and completion
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
      gain.gain.setValueAtTime(0.06, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12)
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.12)
    } else if (type === 'snap') {
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(659.25, ctx.currentTime)
      osc.frequency.exponentialRampToValueAtTime(987.77, ctx.currentTime + 0.07)
      gain.gain.setValueAtTime(0.12, ctx.currentTime)
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
      gain.gain.setValueAtTime(0.15, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5)
      osc.start(now)
      osc.stop(now + 0.5)
    }
  } catch {
    // Audio autoplay restrictions ignored
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

  // Camera connection states
  const [cameraState, setCameraState] = useState<'starting' | 'running' | 'error' | 'unsupported'>('starting')
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('')
  const [audioEnabled, setAudioEnabled] = useState(true)

  // Live 3D pose tracking states
  const [faceDetected, setFaceDetected] = useState(false)
  const [liveYaw, setLiveYaw] = useState(0)
  const [livePitch, setLivePitch] = useState(0)
  const [isConditionMet, setIsConditionMet] = useState(false)
  const [holdProgress, setHoldProgress] = useState(0)
  const [isFlashing, setIsFlashing] = useState(false)
  const [poseEngineError, setPoseEngineError] = useState<string | null>(null)

  // Workflow states — ALWAYS starts in 'ready' so user confirms before capturing
  const [phase, setPhaseState] = useState<ScanPhase>('ready')
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS)
  const [currentStepIdx, setCurrentStepIdx] = useState(0)
  const scanFinished = phase === 'done'

  // Mutable refs for real-time tracking loop
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

  const setPhase = useCallback((next: ScanPhase) => {
    phaseRef.current = next
    setPhaseState(next)
  }, [])

  const currentStep = BIOMETRIC_STEPS[Math.min(currentStepIdx, BIOMETRIC_STEPS.length - 1)]

  const overallProgress = Math.min(
    100,
    Math.round((files.length / Math.min(TOTAL_BIOMETRIC_TARGET, max)) * 100),
  )

  // Reset scan back to 'ready' if parent clears all photos
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

  // Smooth 60fps animation for the white head-tracking reticle dot
  useEffect(() => {
    let raf = 0
    const animateDot = () => {
      setLiveYaw((prev) => {
        const diff = targetDotRef.current.yaw - prev
        return Math.abs(diff) < 0.002 ? targetDotRef.current.yaw : prev + diff * 0.28
      })
      setLivePitch((prev) => {
        const diff = targetDotRef.current.pitch - prev
        return Math.abs(diff) < 0.002 ? targetDotRef.current.pitch : prev + diff * 0.28
      })
      raf = requestAnimationFrame(animateDot)
    }
    raf = requestAnimationFrame(animateDot)
    return () => cancelAnimationFrame(raf)
  }, [])

  // 3-2-1 countdown after user clicks "I'm Ready"
  useEffect(() => {
    if (phase !== 'countdown') return
    if (countdown <= 0) {
      holdAccumMsRef.current = 0
      lastEvalAtRef.current = null
      stepPauseUntilRef.current = Date.now() + 200
      setPhase('scanning')
      return
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 850)
    return () => clearTimeout(timer)
  }, [phase, countdown, setPhase])

  // Connect to camera
  const connectCamera = useCallback(async (deviceId?: string) => {
    setCameraState('starting')
    setCameraError(null)

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraState('unsupported')
      setCameraError('Camera access is not supported by your browser.')
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
        } else if (err.name === 'NotFoundError') {
          setCameraError('No webcam was found on this device.')
        } else {
          setCameraError(`Camera error: ${err.message}`)
        }
      } else {
        setCameraError('Failed to access camera.')
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

  // Snap high-resolution unmirrored photo from the live video feed
  const autoSnap = useCallback(
    async (stepId: string, subIdx: number): Promise<void> => {
      const video = videoRef.current
      if (!video || video.readyState < 2 || isSnappingRef.current) return

      isSnappingRef.current = true
      setIsFlashing(true)
      if (audioEnabled) playBiometricChime('snap')

      const captureCanvas = document.createElement('canvas')
      captureCanvas.width = video.videoWidth || 1280
      captureCanvas.height = video.videoHeight || 720
      const ctx = captureCanvas.getContext('2d')

      if (ctx) {
        ctx.drawImage(video, 0, 0, captureCanvas.width, captureCanvas.height)

        await new Promise((r) => setTimeout(r, 70))
        setIsFlashing(false)

        const blob = await new Promise<Blob | null>((resolve) =>
          captureCanvas.toBlob(resolve, 'image/jpeg', 0.95),
        )
        if (blob) {
          const filename = `face_${stepId}_angle${subIdx + 1}_${Date.now()}.jpg`
          const file = new File([blob], filename, { type: 'image/jpeg' })
          capturedPhotosRef.current.push(file)
          onCapture(file)
        }
      } else {
        setIsFlashing(false)
      }

      await new Promise((r) => setTimeout(r, 220))
      isSnappingRef.current = false
    },
    [audioEnabled, onCapture],
  )

  // Real-time 3D Landmark Head-Pose Polling Loop (InsightFace 68-point 3D pose)
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
          setPoseEngineError(null)

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

            // Continuously calibrate straight-ahead neutral baseline during 'ready' and 'countdown'
            // when the person is looking roughly toward the camera.
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

            // Fuse 3D landmark Euler angle + 5-point keypoint shift so whichever responds strongest drives the dot
            const fusedYawNorm =
              Math.abs(deltaNoseX / NOSE_X_THRESHOLD) > Math.abs(deltaYaw / YAW_THRESHOLD_DEG)
                ? deltaNoseX / NOSE_X_THRESHOLD
                : deltaYaw / YAW_THRESHOLD_DEG
            const fusedPitchNorm =
              Math.abs(deltaNoseY / NOSE_Y_THRESHOLD) > Math.abs(deltaPitch / PITCH_THRESHOLD_DEG)
                ? deltaNoseY / NOSE_Y_THRESHOLD
                : deltaPitch / PITCH_THRESHOLD_DEG

            targetDotRef.current = {
              yaw: clamp(fusedYawNorm * 0.22, -0.38, 0.38),
              pitch: clamp(fusedPitchNorm * 0.18, -0.38, 0.38),
            }

            // Only evaluate pose capture conditions once user confirmed Ready and countdown finished
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
                  // Lock/refine neutral baseline while looking straight ahead in Step 1
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
                if (!targetMetChimedRef.current && audioEnabled) {
                  playBiometricChime('target_met')
                  targetMetChimedRef.current = true
                }
                holdAccumMsRef.current = Math.min(REQUIRED_HOLD_MS, holdAccumMsRef.current + dt)
              } else {
                // Gentle decay instead of abrupt zeroing so minor frame jitter never stalls the scan
                holdAccumMsRef.current = Math.max(0, holdAccumMsRef.current - dt * 0.65)
                if (holdAccumMsRef.current === 0) targetMetChimedRef.current = false
              }

              const progress = Math.min(
                100,
                Math.round((holdAccumMsRef.current / REQUIRED_HOLD_MS) * 100),
              )
              setHoldProgress(progress)

              if (holdAccumMsRef.current >= REQUIRED_HOLD_MS) {
                holdAccumMsRef.current = 0
                targetMetChimedRef.current = false
                setHoldProgress(0)

                const nextSubIdx = photosInStepRef.current + 1
                photosInStepRef.current = nextSubIdx

                await autoSnap(step.id, nextSubIdx - 1)
                lastEvalAtRef.current = Date.now()

                if (nextSubIdx >= step.photosToCapture) {
                  photosInStepRef.current = 0
                  const nextStepIdx = stepIdxRef.current + 1

                  if (nextStepIdx >= BIOMETRIC_STEPS.length || capturedPhotosRef.current.length >= max) {
                    setPhase('done')
                    setIsConditionMet(false)
                    if (audioEnabled) playBiometricChime('complete')
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
        } catch (err: unknown) {
          if (!active) break
          // Surface 503 if AI stack is disabled, ignore transient aborts
          if (err && typeof err === 'object' && 'status' in err && (err as { status: number }).status === 503) {
            setPoseEngineError('Face recognition engine is offline on the backend.')
          }
        }

        await new Promise((r) => setTimeout(r, 35))
      }
    }

    pollPose()

    return () => {
      active = false
      abortCtrl.abort()
    }
  }, [cameraState, scanFinished, audioEnabled, autoSnap, max, onComplete, setPhase])

  const handleStartScan = () => {
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

  const handleResetScan = () => {
    stepIdxRef.current = 0
    photosInStepRef.current = 0
    holdAccumMsRef.current = 0
    lastEvalAtRef.current = null
    baselineRef.current = null
    targetMetChimedRef.current = false
    capturedPhotosRef.current = []
    setCurrentStepIdx(0)
    setHoldProgress(0)
    setIsConditionMet(false)
    setPhase('ready')
  }

  const targetX = 50 + currentStep.targetYaw * 120
  const targetY = 50 + currentStep.targetPitch * 120
  const liveX = 50 + liveYaw * 120
  const liveY = 50 + livePitch * 120

  return (
    <div className="space-y-4">
      <canvas ref={probeCanvasRef} className="hidden" />

      {/* Main Biometric Viewfinder Container */}
      <div className="relative aspect-[4/3] w-full max-w-xl mx-auto overflow-hidden rounded-3xl bg-slate-950 border-2 border-slate-800 shadow-2xl">
        {/* Live Video Feed (Mirrored) */}
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

        {/* Loading State */}
        {cameraState === 'starting' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white bg-slate-950">
            <RefreshCw className="size-8 text-amber-400 animate-spin" />
            <p className="text-xs font-medium text-slate-300">Activating camera for biometric scan...</p>
          </div>
        )}

        {/* Error / Permissions Blocked State */}
        {(cameraState === 'error' || cameraState === 'unsupported') && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-white bg-slate-900/95 z-30">
            <p className="font-semibold text-sm mb-1">{cameraError ?? 'Camera unavailable'}</p>
            <p className="text-xs text-slate-400 mb-4 max-w-sm">
              Please grant camera access in your browser settings so Bantay can capture enrollment photos.
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => connectCamera(selectedDeviceId)}
                className="text-white border-white/20 hover:bg-white/10"
              >
                Retry Camera
              </Button>
              {onSwitchToUpload && (
                <Button size="sm" variant="primary" onClick={onSwitchToUpload}>
                  Upload Files Instead
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Central Biometric Oval Viewfinder & Live Tracking Rings */}
        <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-6">
          <div className="relative size-56 sm:size-68 flex items-center justify-center">
            {/* SVG Biometric Circle & Dynamic Progress Ring */}
            <svg className="absolute inset-0 size-full -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="44"
                className="stroke-white/20 fill-none"
                strokeWidth="2.5"
                strokeDasharray="4 2"
              />
              <circle
                cx="50"
                cy="50"
                r="44"
                className={cn(
                  'transition-all duration-300 fill-none',
                  scanFinished
                    ? 'stroke-emerald-400'
                    : isConditionMet
                      ? 'stroke-emerald-400'
                      : phase === 'scanning'
                        ? 'stroke-amber-400'
                        : 'stroke-white/40',
                )}
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeDasharray="276.46"
                strokeDashoffset={276.46 - (276.46 * overallProgress) / 100}
              />
            </svg>

            {/* Viewfinder Oval Target Border */}
            <div
              className={cn(
                'absolute inset-5 rounded-[46%] border-2 transition-all duration-300 pointer-events-none flex items-center justify-center',
                scanFinished
                  ? 'border-emerald-400 ring-4 ring-emerald-500/30'
                  : isConditionMet
                    ? 'border-emerald-400 ring-4 ring-emerald-400/40'
                    : faceDetected
                      ? 'border-white/80'
                      : 'border-dashed border-white/30',
              )}
            >
              {/* Reticle Visual Guide (Target Zone & User Live Face Dot) */}
              {!scanFinished && faceDetected && (
                <div className="relative size-full pointer-events-none">
                  {phase === 'scanning' && (
                    <div
                      className="absolute size-8 rounded-full border-2 border-amber-400/90 bg-amber-400/20 flex items-center justify-center transform -translate-x-1/2 -translate-y-1/2 transition-all duration-300"
                      style={{ left: `${targetX}%`, top: `${targetY}%` }}
                    >
                      <span className="size-2 rounded-full bg-amber-400 animate-ping" />
                    </div>
                  )}

                  <div
                    className={cn(
                      'absolute size-4 rounded-full shadow-lg transform -translate-x-1/2 -translate-y-1/2',
                      isConditionMet
                        ? 'bg-emerald-400 ring-4 ring-emerald-400/50 scale-125'
                        : 'bg-white ring-2 ring-white/50',
                    )}
                    style={{ left: `${liveX}%`, top: `${liveY}%` }}
                  />
                </div>
              )}
            </div>

            {/* Countdown Numbers Inside Oval */}
            {phase === 'countdown' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center z-20">
                <span className="text-6xl font-extrabold text-white drop-shadow-[0_4px_16px_rgba(0,0,0,0.8)]">
                  {countdown > 0 ? countdown : 'GO'}
                </span>
              </div>
            )}

            {/* Condition Hold Progress Meter */}
            {phase === 'scanning' && isConditionMet && !scanFinished && holdProgress > 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
                <div className="bg-slate-950/85 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-emerald-400 text-emerald-300 text-xs font-bold tracking-wide shadow-xl flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-emerald-400 animate-ping" />
                  <span>HOLD STEADY ({holdProgress}%)</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Top Floating Instruction / Ready Confirmation Banner */}
        {cameraState === 'running' && (
          <div className="absolute top-3 inset-x-3 flex justify-center z-20 pointer-events-none">
            <div className="max-w-md w-full bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-2xl px-4 py-2.5 shadow-2xl text-center">
              {scanFinished ? (
                <div className="space-y-0.5 py-0.5">
                  <div className="flex items-center justify-center gap-2 text-emerald-400 text-sm font-bold">
                    <CheckCircle2 className="size-4" />
                    <span>Biometric Face Scan Complete!</span>
                  </div>
                  <p className="text-xs text-slate-300">
                    {files.length} multi-angle face photos captured. Review below and click Enroll.
                  </p>
                </div>
              ) : phase === 'ready' ? (
                <div className="space-y-0.5">
                  <p className="text-sm font-bold text-white">Are you ready to scan your face?</p>
                  <p className="text-[11px] text-slate-300">
                    {poseEngineError ? (
                      <span className="text-red-400">{poseEngineError}</span>
                    ) : faceDetected ? (
                      <span className="text-emerald-400 font-medium">
                        ✓ Face centered &amp; tracked — click &ldquo;I&apos;m Ready&rdquo; below when set!
                      </span>
                    ) : (
                      'Position your face inside the oval frame in good lighting, then press Ready.'
                    )}
                  </p>
                </div>
              ) : phase === 'countdown' ? (
                <div className="space-y-0.5">
                  <p className="text-sm font-bold text-amber-300">Get Ready — Look Straight Ahead</p>
                  <p className="text-[11px] text-slate-300">
                    Calibrating your neutral head angle before starting automatic capture…
                  </p>
                </div>
              ) : (
                <div className="space-y-0.5">
                  <div className="flex items-center justify-between text-xs font-bold text-amber-400">
                    <span className="flex items-center gap-1.5">
                      <span className="text-base">{currentStep.angleIcon}</span>
                      <span>{currentStep.title}</span>
                    </span>
                    <span className="text-[11px] text-slate-400 font-normal">
                      {files.length}/{Math.min(TOTAL_BIOMETRIC_TARGET, max)} photos
                    </span>
                  </div>

                  <p className="text-sm font-bold text-white tracking-wide pt-0.5">
                    {currentStep.instruction}
                  </p>
                  <p className="text-[11px] text-slate-300">
                    {isConditionMet
                      ? '✨ Pose matched! Hold briefly for automatic snapshot...'
                      : currentStep.subtext}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Prominent "I'm Ready — Start Face Scan" Action Button Overlay (Before Capturing) */}
        {cameraState === 'running' && phase === 'ready' && (
          <div className="absolute bottom-12 inset-x-4 flex justify-center z-25">
            <button
              type="button"
              onClick={handleStartScan}
              disabled={disabled || files.length >= max || Boolean(poseEngineError)}
              className={cn(
                'inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold shadow-2xl transition-all active:scale-95 disabled:opacity-50',
                faceDetected
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 ring-4 ring-emerald-400/30'
                  : 'bg-amber-400 hover:bg-amber-300 text-slate-950 ring-4 ring-amber-400/25',
              )}
            >
              <Play className="size-4 fill-current" />
              <span>I&apos;m Ready — Start Scan</span>
            </button>
          </div>
        )}

        {/* Screen Flash Illumination (During Auto-Snapshot) */}
        {isFlashing && (
          <div className="absolute inset-0 bg-white/95 z-30 transition-opacity duration-75 pointer-events-none flex items-center justify-center">
            <span className="text-xs font-extrabold text-slate-950 bg-white px-4 py-1.5 rounded-full shadow-2xl">
              ⚡ AUTO-CAPTURED
            </span>
          </div>
        )}

        {/* Audio Toggle & Camera Selector */}
        <div className="absolute bottom-3 inset-x-4 flex items-center justify-between text-xs text-white/80 z-20">
          <button
            type="button"
            onClick={() => setAudioEnabled(!audioEnabled)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900/80 backdrop-blur-xs hover:bg-slate-800 text-slate-300 transition"
            title="Toggle audio chimes"
          >
            {audioEnabled ? <Volume2 className="size-3.5 text-emerald-400" /> : <VolumeX className="size-3.5" />}
            <span className="text-[11px]">{audioEnabled ? 'Chimes on' : 'Muted'}</span>
          </button>

          {devices.length > 1 && (
            <select
              value={selectedDeviceId}
              onChange={(e) => connectCamera(e.target.value)}
              className="bg-slate-900/80 backdrop-blur-xs border border-slate-700 text-[11px] rounded-lg px-2 py-1 text-slate-300 focus:outline-none"
            >
              {devices.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || `Camera ${d.deviceId.slice(0, 5)}`}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Real-Time Guided Pose Progress Indicators */}
      <div className="max-w-xl mx-auto space-y-2">
        <div className="grid grid-cols-5 gap-1.5">
          {BIOMETRIC_STEPS.map((step, idx) => {
            const isDone = scanFinished || (phase === 'scanning' && currentStepIdx > idx)
            const isCurrent = phase === 'scanning' && currentStepIdx === idx
            return (
              <div
                key={step.id}
                className={cn(
                  'flex flex-col items-center justify-center p-2 rounded-xl text-center border text-[11px] transition',
                  isDone
                    ? 'border-emerald-400 bg-emerald-50 text-emerald-800 font-semibold'
                    : isCurrent
                      ? 'border-amber-400 bg-amber-50 text-amber-900 font-bold ring-2 ring-amber-400 shadow-xs'
                      : 'border-gray-200 bg-gray-50/60 text-gray-500',
                )}
              >
                <span className="text-base">{isDone ? '✓' : step.angleIcon}</span>
                <span className="truncate w-full mt-0.5 text-[10px]">
                  {step.title.split('. ')[1]}
                </span>
              </div>
            )
          })}
        </div>

        {/* Status Callout Banner */}
        <div className="flex items-center justify-between text-xs px-1 text-gray-600">
          <div className="flex items-center gap-2">
            <span className="relative flex size-2.5">
              <span
                className={cn(
                  'animate-ping absolute inline-flex size-full rounded-full opacity-75',
                  isConditionMet || (phase === 'ready' && faceDetected) ? 'bg-emerald-400' : 'bg-amber-400',
                )}
              />
              <span
                className={cn(
                  'relative inline-flex rounded-full size-2.5',
                  isConditionMet || (phase === 'ready' && faceDetected) ? 'bg-emerald-500' : 'bg-amber-500',
                )}
              />
            </span>
            <span className="font-medium text-gray-700">
              {scanFinished
                ? `All ${files.length} multi-angle biometric photos acquired!`
                : phase === 'ready'
                  ? 'Waiting for confirmation — press "I\'m Ready — Start Scan" when set.'
                  : phase === 'countdown'
                    ? 'Starting scan — keep looking straight ahead...'
                    : isConditionMet
                      ? 'Pose matched! Holding for automatic snapshot...'
                      : faceDetected
                        ? `Move your head: ${currentStep.instruction}`
                        : 'Center your face inside the oval...'}
            </span>
          </div>

          {phase !== 'ready' && (
            <button
              type="button"
              onClick={handleResetScan}
              disabled={disabled}
              className="inline-flex items-center gap-1 text-xs text-navy-700 hover:text-navy-900 font-medium"
            >
              <RefreshCw className="size-3" />
              <span>Restart Scan</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

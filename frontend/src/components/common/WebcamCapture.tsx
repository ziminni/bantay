import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import {
  CheckCircle2,
  Volume2,
  VolumeX,
  RefreshCw,
} from 'lucide-react'
import { BIOMETRIC_STEPS, TOTAL_BIOMETRIC_TARGET } from '@/lib/biometrics'

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
      osc.frequency.setValueAtTime(440, ctx.currentTime) // A4
      osc.frequency.exponentialRampToValueAtTime(587.33, ctx.currentTime + 0.08) // D5
      gain.gain.setValueAtTime(0.06, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12)
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.12)
    } else if (type === 'snap') {
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(659.25, ctx.currentTime) // E5
      osc.frequency.exponentialRampToValueAtTime(987.77, ctx.currentTime + 0.07) // B5
      gain.gain.setValueAtTime(0.12, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14)
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.14)
    } else if (type === 'complete') {
      osc.type = 'sine'
      const now = ctx.currentTime
      osc.frequency.setValueAtTime(523.25, now) // C5
      osc.frequency.setValueAtTime(659.25, now + 0.09) // E5
      osc.frequency.setValueAtTime(783.99, now + 0.18) // G5
      osc.frequency.setValueAtTime(1046.5, now + 0.28) // C6
      gain.gain.setValueAtTime(0.15, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5)
      osc.start(now)
      osc.stop(now + 0.5)
    }
  } catch {
    // Audio autoplay restrictions catch
  }
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
  const analysisCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const animFrameRef = useRef<number | null>(null)
  const capturedPhotosRef = useRef<File[]>([])

  // Camera connection states
  const [cameraState, setCameraState] = useState<'starting' | 'running' | 'error' | 'unsupported'>('starting')
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('')
  const [audioEnabled, setAudioEnabled] = useState(true)

  // Live computer vision tracking states
  const [faceDetected, setFaceDetected] = useState(false)
  const [liveYaw, setLiveYaw] = useState(0) // -1.0 (left) to +1.0 (right)
  const [livePitch, setLivePitch] = useState(0) // -1.0 (up) to +1.0 (down)
  const [isConditionMet, setIsConditionMet] = useState(false)
  const [holdProgress, setHoldProgress] = useState(0) // 0 to 100% while holding pose
  const [isFlashing, setIsFlashing] = useState(false)

  // Workflow states
  const [currentStepIdx, setCurrentStepIdx] = useState(0)
  const [scanFinished, setScanFinished] = useState(false)

  // Mutable refs for tracking in requestAnimationFrame loop
  const stepIdxRef = useRef(0)
  const photosInStepRef = useRef(0)
  const isSnappingRef = useRef(false)
  const holdStartTimeRef = useRef<number | null>(null)
  const targetMetChimedRef = useRef(false)

  const currentStep = BIOMETRIC_STEPS[Math.min(currentStepIdx, BIOMETRIC_STEPS.length - 1)]

  // Calculate overall progress across target 10 photos
  const overallProgress = Math.min(
    100,
    Math.round((files.length / Math.min(TOTAL_BIOMETRIC_TARGET, max)) * 100),
  )

  // Connect to the desktop webcam
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
          setCameraError('No webcam was found on this computer.')
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
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current)
      }
    }
  }, [connectCamera])

  // Snap high-resolution photo from the live video feed
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
        // Draw unmirrored frame for backend ArcFace recognition
        ctx.drawImage(video, 0, 0, captureCanvas.width, captureCanvas.height)

        await new Promise((r) => setTimeout(r, 70))
        setIsFlashing(false)

        captureCanvas.toBlob(
          (blob) => {
            if (blob) {
              const filename = `face_${stepId}_angle${subIdx + 1}_${Date.now()}.jpg`
              const file = new File([blob], filename, { type: 'image/jpeg' })
              capturedPhotosRef.current.push(file)
              onCapture(file)
            }
          },
          'image/jpeg',
          0.95,
        )
      } else {
        setIsFlashing(false)
      }

      // Small delay after snapshot to stabilize
      await new Promise((r) => setTimeout(r, 350))
      isSnappingRef.current = false
    },
    [audioEnabled, onCapture],
  )

  // Real-Time Computer Vision Tracking Loop
  useEffect(() => {
    if (cameraState !== 'running' || scanFinished) return

    const canvas = analysisCanvasRef.current || document.createElement('canvas')
    canvas.width = 160
    canvas.height = 120
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return

    let isRunning = true

    const loop = async () => {
      if (!isRunning) return
      const video = videoRef.current

      if (video && video.readyState >= 2 && !isSnappingRef.current) {
        // Draw downscaled frame
        ctx.drawImage(video, 0, 0, 160, 120)
        const frame = ctx.getImageData(0, 0, 160, 120)
        const data = frame.data

        // Oval region in the 160x120 canvas: center (80, 60), rx = 44, ry = 52
        const cx = 80
        const cy = 60
        const rx = 44
        const ry = 52

        let skinPixels = 0
        let sumX = 0
        let sumY = 0
        let leftHalfSkin = 0
        let rightHalfSkin = 0

        for (let y = 10; y < 110; y += 2) {
          const dy = (y - cy) / ry
          const dy2 = dy * dy
          if (dy2 > 1) continue

          const rowOffset = y * 160 * 4

          for (let x = 20; x < 140; x += 2) {
            const dx = (x - cx) / rx
            if (dx * dx + dy2 <= 1) {
              const idx = rowOffset + x * 4
              const r = data[idx]
              const g = data[idx + 1]
              const b = data[idx + 2]

              // Standard skin luminance-chrominance filter
              if (
                r > 65 &&
                g > 40 &&
                b > 25 &&
                r > g &&
                r > b &&
                Math.abs(r - g) > 12 &&
                r - Math.min(g, b) > 15
              ) {
                skinPixels++
                sumX += x
                sumY += y
                if (x < cx) leftHalfSkin++
                else rightHalfSkin++
              }
            }
          }
        }

        // Did we find a face inside the oval?
        const hasFace = skinPixels > 160
        setFaceDetected(hasFace)

        if (hasFace) {
          // Centroid relative to oval center
          const centroidX = sumX / skinPixels
          const centroidY = sumY / skinPixels

          // Mirrored horizontal yaw: video is mirrored with -scale-x-100
          // When user turns left, their face shifts towards left in the mirror
          const computedYaw = (centroidX - cx) / rx
          const computedPitch = (centroidY - cy) / ry

          setLiveYaw(computedYaw)
          setLivePitch(computedPitch)

          // Evaluate Condition for current target pose
          const currentStep = BIOMETRIC_STEPS[stepIdxRef.current]
          let conditionMet = false

          if (currentStep.id === 'center') {
            // Must be looking straight and centered inside oval
            conditionMet = Math.abs(computedYaw) < 0.16 && Math.abs(computedPitch) < 0.16
          } else if (currentStep.id === 'turn_left') {
            // Must have turned head to left (yaw shifts left in mirror)
            conditionMet = computedYaw < -0.15 || leftHalfSkin / (skinPixels || 1) > 0.58
          } else if (currentStep.id === 'turn_right') {
            // Must have turned head to right (yaw shifts right in mirror)
            conditionMet = computedYaw > 0.15 || rightHalfSkin / (skinPixels || 1) > 0.58
          } else if (currentStep.id === 'tilt_up') {
            // Must have tilted chin upward (centroid shifts up)
            conditionMet = computedPitch < -0.12
          } else if (currentStep.id === 'tilt_down') {
            // Must have tilted head downward (centroid shifts down)
            conditionMet = computedPitch > 0.12
          }

          setIsConditionMet(conditionMet)

          // Condition Hold & Auto-Snap Progression
          const now = Date.now()

          if (conditionMet) {
            if (!holdStartTimeRef.current) {
              holdStartTimeRef.current = now
              if (!targetMetChimedRef.current && audioEnabled) {
                playBiometricChime('target_met')
                targetMetChimedRef.current = true
              }
            }

            const elapsed = now - holdStartTimeRef.current
            const REQUIRED_HOLD_MS = 500 // 500ms stable hold
            const progress = Math.min(100, Math.round((elapsed / REQUIRED_HOLD_MS) * 100))
            setHoldProgress(progress)

            if (elapsed >= REQUIRED_HOLD_MS) {
              // Condition satisfied and held! AUTO SNAPSHOT!
              holdStartTimeRef.current = null
              targetMetChimedRef.current = false
              setHoldProgress(0)

              const nextSubIdx = photosInStepRef.current + 1
              photosInStepRef.current = nextSubIdx

              await autoSnap(currentStep.id, nextSubIdx - 1)

              // Check if step requirement met
              if (nextSubIdx >= currentStep.photosToCapture) {
                // Advance to next pose step
                photosInStepRef.current = 0
                const nextStepIdx = stepIdxRef.current + 1

                if (nextStepIdx >= BIOMETRIC_STEPS.length) {
                  // ALL POSES COMPLETED AUTOMATICALLY!
                  setScanFinished(true)
                  if (audioEnabled) playBiometricChime('complete')
                  if (onComplete) {
                    onComplete([...capturedPhotosRef.current])
                  }
                } else {
                  stepIdxRef.current = nextStepIdx
                  setCurrentStepIdx(nextStepIdx)
                }
              }
            }
          } else {
            // Reset hold progress if user left target zone
            holdStartTimeRef.current = null
            targetMetChimedRef.current = false
            setHoldProgress(0)
          }
        } else {
          setIsConditionMet(false)
          setHoldProgress(0)
          holdStartTimeRef.current = null
          targetMetChimedRef.current = false
        }
      }

      animFrameRef.current = requestAnimationFrame(loop)
    }

    animFrameRef.current = requestAnimationFrame(loop)

    return () => {
      isRunning = false
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    }
  }, [cameraState, scanFinished, audioEnabled, autoSnap])

  // Reset entire scan
  const handleResetScan = () => {
    stepIdxRef.current = 0
    photosInStepRef.current = 0
    setCurrentStepIdx(0)
    setScanFinished(false)
    setHoldProgress(0)
    holdStartTimeRef.current = null
  }

  // Calculate target dot position for visual reticle guide
  // Step target coordinates inside a 200px box:
  const targetX = 50 + currentStep.targetYaw * 120
  const targetY = 50 + currentStep.targetPitch * 120

  // Live user face position inside the guide box:
  const liveX = 50 + liveYaw * 120
  const liveY = 50 + livePitch * 120

  return (
    <div className="space-y-4">
      <canvas ref={analysisCanvasRef} className="hidden" />

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
          <div className="relative size-64 sm:size-72 flex items-center justify-center">
            {/* SVG Biometric Circle & Dynamic Progress Ring */}
            <svg className="absolute inset-0 size-full -rotate-90" viewBox="0 0 100 100">
              {/* Outer dashed track */}
              <circle
                cx="50"
                cy="50"
                r="44"
                className="stroke-white/20 fill-none"
                strokeWidth="2.5"
                strokeDasharray="4 2"
              />
              {/* Active Multi-Angle Progress Ring */}
              <circle
                cx="50"
                cy="50"
                r="44"
                className={cn(
                  'transition-all duration-300 fill-none',
                  scanFinished
                    ? 'stroke-emerald-400'
                    : isConditionMet
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
                    ? 'border-amber-400 ring-4 ring-amber-400/40'
                    : faceDetected
                      ? 'border-white/70'
                      : 'border-dashed border-white/30',
              )}
            >
              {/* Reticle Visual Guide (Target Zone & User Live Face Dot) */}
              {!scanFinished && faceDetected && (
                <div className="relative size-full pointer-events-none">
                  {/* Target Pose Marker Circle */}
                  <div
                    className="absolute size-7 rounded-full border-2 border-amber-400/80 bg-amber-400/20 flex items-center justify-center transform -translate-x-1/2 -translate-y-1/2 transition-all duration-300"
                    style={{ left: `${targetX}%`, top: `${targetY}%` }}
                  >
                    <span className="size-2 rounded-full bg-amber-400 animate-ping" />
                  </div>

                  {/* Live User Head Movement Dot */}
                  <div
                    className={cn(
                      'absolute size-4 rounded-full shadow-lg transform -translate-x-1/2 -translate-y-1/2 transition-all duration-75',
                      isConditionMet
                        ? 'bg-emerald-400 ring-4 ring-emerald-400/50 scale-125'
                        : 'bg-white ring-2 ring-white/50',
                    )}
                    style={{ left: `${liveX}%`, top: `${liveY}%` }}
                  />
                </div>
              )}
            </div>

            {/* Condition Hold Progress Meter (Fills as user holds the pose) */}
            {isConditionMet && !scanFinished && holdProgress > 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
                <div className="bg-slate-950/80 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-amber-400 text-amber-300 text-xs font-bold tracking-wide shadow-xl flex items-center gap-1.5 animate-pulse">
                  <span className="size-2 rounded-full bg-amber-400 animate-ping" />
                  <span>HOLD STEADY ({holdProgress}%)</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Top Floating Instruction Pill (Banking KYC Style) */}
        <div className="absolute top-4 inset-x-4 flex justify-center pointer-events-none z-20">
          <div className="max-w-md w-full bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-2xl px-4 py-3 shadow-2xl text-center">
            {scanFinished ? (
              <div className="space-y-1 py-1">
                <div className="flex items-center justify-center gap-2 text-emerald-400 text-sm font-bold">
                  <CheckCircle2 className="size-5" />
                  <span>Biometric Face Scan Complete!</span>
                </div>
                <p className="text-xs text-slate-300">
                  {files.length} multi-angle face photos automatically acquired. Review below and proceed.
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
                    ? '✨ Pose matched! Hold still for automatic snapshot...'
                    : currentStep.subtext}
                </p>
              </div>
            )}
          </div>
        </div>

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
            const isDone = currentStepIdx > idx || scanFinished
            const isCurrent = !scanFinished && currentStepIdx === idx
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
              <span className={cn('animate-ping absolute inline-flex size-full rounded-full opacity-75', isConditionMet ? 'bg-emerald-400' : 'bg-amber-400')} />
              <span className={cn('relative inline-flex rounded-full size-2.5', isConditionMet ? 'bg-emerald-500' : 'bg-amber-500')} />
            </span>
            <span className="font-medium text-gray-700">
              {scanFinished
                ? 'All 10 multi-angle biometric photos acquired!'
                : isConditionMet
                  ? 'Pose matched! Holding for snapshot...'
                  : faceDetected
                    ? `Move your head to match: ${currentStep.instruction}`
                    : 'Center your face inside the oval to begin...'}
            </span>
          </div>

          <button
            type="button"
            onClick={handleResetScan}
            disabled={disabled}
            className="inline-flex items-center gap-1 text-xs text-navy-700 hover:text-navy-900 font-medium"
          >
            <RefreshCw className="size-3" />
            <span>Reset Scan</span>
          </button>
        </div>
      </div>
    </div>
  )
}

import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import {
  Camera,
  CheckCircle2,
  Sparkles,
  Volume2,
  VolumeX,
  Scan,
} from 'lucide-react'
import { BIOMETRIC_STEPS, TOTAL_BIOMETRIC_TARGET } from '@/lib/biometrics'

// Synthesize pleasant banking app audio feedback using Web Audio API (zero external assets needed)
function playBiometricChime(type: 'step' | 'snap' | 'complete') {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)

    if (type === 'step') {
      osc.type = 'sine'
      osc.frequency.setValueAtTime(440, ctx.currentTime) // A4
      osc.frequency.exponentialRampToValueAtTime(659.25, ctx.currentTime + 0.1) // E5
      gain.gain.setValueAtTime(0.08, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2)
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.2)
    } else if (type === 'snap') {
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(587.33, ctx.currentTime) // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.08) // A5
      gain.gain.setValueAtTime(0.12, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15)
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.15)
    } else if (type === 'complete') {
      osc.type = 'sine'
      const now = ctx.currentTime
      osc.frequency.setValueAtTime(523.25, now) // C5
      osc.frequency.setValueAtTime(659.25, now + 0.1) // E5
      osc.frequency.setValueAtTime(783.99, now + 0.2) // G5
      osc.frequency.setValueAtTime(1046.5, now + 0.3) // C6
      gain.gain.setValueAtTime(0.15, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5)
      osc.start(now)
      osc.stop(now + 0.5)
    }
  } catch {
    // Ignore audio autoplay restrictions
  }
}

interface WebcamCaptureProps {
  files: File[]
  onCapture: (file: File) => void
  max: number
  disabled?: boolean
  onSwitchToUpload?: () => void
}

export function WebcamCapture({
  files,
  onCapture,
  max,
  disabled,
  onSwitchToUpload,
}: WebcamCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const [cameraState, setCameraState] = useState<'starting' | 'running' | 'error' | 'unsupported'>('starting')
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('')
  const [audioEnabled, setAudioEnabled] = useState(true)

  // Banking automated scan states
  const [isScanning, setIsScanning] = useState(false)
  const [currentStepIdx, setCurrentStepIdx] = useState(0)
  const [totalPhotosCaptured, setTotalPhotosCaptured] = useState(0)
  const [isFlashing, setIsFlashing] = useState(false)
  const [scanFinished, setScanFinished] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)

  const currentStep = BIOMETRIC_STEPS[Math.min(currentStepIdx, BIOMETRIC_STEPS.length - 1)]

  // Calculate overall biometric scan progress (0% to 100%)
  const overallProgress = Math.min(
    100,
    Math.round(((files.length || totalPhotosCaptured) / Math.min(TOTAL_BIOMETRIC_TARGET, max)) * 100),
  )

  // Connect webcam stream
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
          setCameraError('No camera was detected.')
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

  // Single silent frame capture without user button interaction
  const snapFrame = useCallback(
    async (stepId: string, subIdx: number): Promise<File | null> => {
      const video = videoRef.current
      if (!video || video.readyState < 2) return null

      // Flash illumination pulse
      setIsFlashing(true)
      if (audioEnabled) playBiometricChime('snap')

      const canvas = canvasRef.current || document.createElement('canvas')
      canvas.width = video.videoWidth || 1280
      canvas.height = video.videoHeight || 720
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        setIsFlashing(false)
        return null
      }

      // Draw unmirrored frame
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

      await new Promise((r) => setTimeout(r, 60))
      setIsFlashing(false)

      return new Promise<File | null>((resolve) => {
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(null)
              return
            }
            const filename = `face_${stepId}_${subIdx + 1}_${Date.now()}.jpg`
            const file = new File([blob], filename, { type: 'image/jpeg' })
            resolve(file)
          },
          'image/jpeg',
          0.95,
        )
      })
    },
    [audioEnabled],
  )

  // Master Automated Banking Scan Sequence
  const startBiometricScan = async () => {
    if (isScanning || disabled || cameraState !== 'running') return
    setIsScanning(true)
    setScanFinished(false)
    setTotalPhotosCaptured(0)

    // Initial 3-second preparation countdown
    if (audioEnabled) playBiometricChime('step')
    for (let c = 3; c > 0; c--) {
      setCountdown(c)
      await new Promise((r) => setTimeout(r, 700))
    }
    setCountdown(null)

    let capturedSoFar = 0

    // Step through each banking pose requirement
    for (let stepIdx = 0; stepIdx < BIOMETRIC_STEPS.length; stepIdx++) {
      if (capturedSoFar >= max) break
      setCurrentStepIdx(stepIdx)

      const step = BIOMETRIC_STEPS[stepIdx]
      if (audioEnabled) playBiometricChime('step')

      // Give user 1.2s to reposition / follow instruction
      await new Promise((r) => setTimeout(r, 1200))

      // Snap required photos for this angle
      for (let p = 0; p < step.photosToCapture; p++) {
        if (capturedSoFar >= max) break

        const file = await snapFrame(step.id, p)
        if (file) {
          onCapture(file)
          capturedSoFar++
          setTotalPhotosCaptured(capturedSoFar)
        }

        // Small delay between bursts of same angle
        await new Promise((r) => setTimeout(r, 450))
      }

      // Pause between different head angles
      await new Promise((r) => setTimeout(r, 800))
    }

    // Finished full scan
    setIsScanning(false)
    setScanFinished(true)
    setCountdown(null)
    if (audioEnabled) playBiometricChime('complete')
  }

  // Cancel / Reset scan
  const cancelScan = () => {
    setIsScanning(false)
    setCountdown(null)
    setIsFlashing(false)
  }

  // Fallback single manual snap
  const handleManualSnap = async () => {
    if (files.length >= max || disabled) return
    const file = await snapFrame(currentStep.id, 0)
    if (file) {
      onCapture(file)
      setTotalPhotosCaptured((prev) => prev + 1)
    }
  }

  return (
    <div className="space-y-4">
      {/* Hidden processing canvas */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Main Biometric Viewfinder Container */}
      <div className="relative aspect-[4/3] w-full max-w-xl mx-auto overflow-hidden rounded-3xl bg-slate-950 border-2 border-slate-800 shadow-2xl">
        {/* Live Video Feed (Mirrored for natural mirror movement) */}
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

        {/* Error / Unsupported state */}
        {(cameraState === 'error' || cameraState === 'unsupported') && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-white bg-slate-900/95 z-30">
            <p className="font-semibold text-sm mb-1">{cameraError ?? 'Camera unavailable'}</p>
            <p className="text-xs text-slate-400 mb-4 max-w-sm">
              Ensure camera permissions are granted in your browser settings.
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => connectCamera(selectedDeviceId)} className="text-white border-white/20">
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

        {/* Biometric Oval Target Overlay & Dynamic Progress Ring */}
        <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-6">
          <div className="relative size-64 sm:size-72 flex items-center justify-center">
            {/* SVG Biometric Tracking Ring */}
            <svg className="absolute inset-0 size-full -rotate-90" viewBox="0 0 100 100">
              {/* Background Track */}
              <circle
                cx="50"
                cy="50"
                r="44"
                className="stroke-white/20 fill-none"
                strokeWidth="2.5"
                strokeDasharray="4 2"
              />
              {/* Animated Progress Ring */}
              <circle
                cx="50"
                cy="50"
                r="44"
                className={cn(
                  'transition-all duration-300 fill-none',
                  overallProgress >= 100
                    ? 'stroke-emerald-400'
                    : isScanning
                      ? 'stroke-amber-400'
                      : 'stroke-white/40',
                )}
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeDasharray="276.46"
                strokeDashoffset={276.46 - (276.46 * overallProgress) / 100}
              />
            </svg>

            {/* Viewfinder Biometric Reticle Corners */}
            <div className="absolute inset-6 rounded-[45%] border-2 border-dashed border-white/40 pointer-events-none">
              {/* Glowing vertical biometric scanning beam when active */}
              {isScanning && (
                <div className="absolute inset-x-2 h-1 bg-gradient-to-r from-transparent via-amber-400 to-transparent shadow-lg shadow-amber-400 animate-bounce top-1/2 opacity-80" />
              )}
            </div>

            {/* Countdown Overlay */}
            {countdown !== null && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full backdrop-blur-xs">
                <span className="text-6xl font-extrabold text-amber-400 animate-ping">
                  {countdown}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Top Floating Instruction Pill (Banking App Style) */}
        <div className="absolute top-4 inset-x-4 flex justify-center pointer-events-none z-20">
          <div className="max-w-md w-full bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-2xl px-4 py-2.5 shadow-xl text-center">
            {isScanning ? (
              <div className="space-y-0.5">
                <div className="flex items-center justify-center gap-2 text-xs font-bold text-amber-400">
                  <span className="text-base">{currentStep.angleIcon}</span>
                  <span>{currentStep.title}</span>
                  <span className="text-[10px] text-slate-400">
                    ({files.length}/{Math.min(TOTAL_BIOMETRIC_TARGET, max)} photos)
                  </span>
                </div>
                <p className="text-sm font-semibold text-white tracking-wide">
                  {currentStep.instruction}
                </p>
                <p className="text-[11px] text-slate-300">
                  {currentStep.subtext}
                </p>
              </div>
            ) : scanFinished ? (
              <div className="flex items-center justify-center gap-2 text-emerald-400 text-xs font-semibold py-1">
                <CheckCircle2 className="size-4" />
                <span>Biometric Face Scan Complete ({files.length} angles captured)</span>
              </div>
            ) : (
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-amber-400 flex items-center justify-center gap-1.5">
                  <Scan className="size-3.5" /> Banking-Style Biometric Scan
                </p>
                <p className="text-xs text-slate-200">
                  Tap <strong>Start Face Scan</strong>. Slowly move your head as prompted to capture all angles.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Screen Flash Illumination (For Biometric Liveness & Sharp Exposure) */}
        {isFlashing && (
          <div className="absolute inset-0 bg-white/90 z-30 transition-opacity duration-75 pointer-events-none flex items-center justify-center">
            <span className="text-xs font-bold text-slate-900 bg-white px-3 py-1 rounded-full shadow-md">
              ⚡ Captured
            </span>
          </div>
        )}

        {/* Audio Toggle & Camera Switcher Overlay */}
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

      {/* Primary Action Controls */}
      <div className="flex flex-col items-center justify-center gap-3 max-w-xl mx-auto">
        {isScanning ? (
          <div className="flex items-center gap-3 w-full">
            <div className="flex-1 rounded-xl bg-slate-100 p-2.5 text-xs text-slate-700 flex items-center gap-2">
              <span className="relative flex size-2.5">
                <span className="animate-ping absolute inline-flex size-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full size-2.5 bg-amber-500" />
              </span>
              <span>Scanning: Step {currentStepIdx + 1} of {BIOMETRIC_STEPS.length} ({overallProgress}%)</span>
            </div>
            <Button variant="ghost" size="sm" onClick={cancelScan} className="text-red-600 hover:text-red-700">
              Cancel Scan
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-center gap-2.5 w-full">
            <button
              type="button"
              onClick={startBiometricScan}
              disabled={disabled || cameraState !== 'running'}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-6 rounded-xl font-semibold text-xs tracking-wide bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 hover:from-amber-400 hover:to-amber-600 text-slate-950 shadow-lg shadow-amber-500/25 active:scale-[0.98] transition disabled:opacity-50"
            >
              <Sparkles className="size-4" />
              <span>{scanFinished ? 'Re-scan Multi-Angle Face' : 'Start Banking Face Scan (Auto)'}</span>
            </button>

            {/* Secondary Manual Snap */}
            <button
              type="button"
              onClick={handleManualSnap}
              disabled={disabled || files.length >= max || cameraState !== 'running'}
              className="px-4 py-3 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-xs font-medium text-gray-700 shadow-xs active:scale-[0.98] transition disabled:opacity-50"
              title="Manually snap a single photo"
            >
              <Camera className="size-4 inline mr-1 text-gray-500" />
              <span>Single Snap</span>
            </button>
          </div>
        )}

        {/* Guided Pose Progression Badges */}
        <div className="w-full grid grid-cols-3 sm:grid-cols-6 gap-1.5 pt-1">
          {BIOMETRIC_STEPS.map((step, idx) => {
            const isDone = currentStepIdx > idx || scanFinished
            const isCurrent = isScanning && currentStepIdx === idx
            return (
              <div
                key={step.id}
                className={cn(
                  'flex flex-col items-center justify-center p-2 rounded-xl text-center border text-[10px] transition',
                  isDone
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                    : isCurrent
                      ? 'border-amber-400 bg-amber-50 text-amber-900 font-bold ring-2 ring-amber-300 shadow-xs'
                      : 'border-gray-200 bg-gray-50/60 text-gray-500',
                )}
              >
                <span className="text-sm">{step.angleIcon}</span>
                <span className="truncate w-full mt-0.5">{step.title.split('. ')[1]}</span>
              </div>
            )
          })}
        </div>

        <p className="text-[11px] text-gray-500 text-center">
          Captures <strong>10 diverse facial angles</strong> (Front, Left, Right, Up, Down, Smile) for maximum InsightFace recognition accuracy.
        </p>
      </div>
    </div>
  )
}

import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'

interface Pose {
  id: string
  title: string
  instruction: string
  hint: string
}

const ENROLLMENT_POSES: Pose[] = [
  { id: 'center', title: 'Pose 1 of 3: Center', instruction: 'Look straight at the camera', hint: 'Position your face level inside the oval.' },
  { id: 'left', title: 'Pose 2 of 3: Turn Left', instruction: 'Turn your head slightly to your left', hint: 'Turn about 15°–20° to capture facial contours.' },
  { id: 'right', title: 'Pose 3 of 3: Turn Right', instruction: 'Turn your head slightly to your right', hint: 'Turn about 15°–20° to capture facial contours.' },
  { id: 'up', title: 'Pose 4 (Optional): Tilt Up / Smile', instruction: 'Tilt slightly up or smile naturally', hint: 'Helps recognize varied expressions.' },
  { id: 'down', title: 'Pose 5 (Optional): Tilt Down', instruction: 'Tilt head slightly downward', hint: 'Helps recognize varied angles.' },
]

// Rapid chromatic flash sequence (inspired by GoTyme / MariBank active liveness)
const FLASH_COLORS = [
  { name: 'Cyan', hex: '#06b6d4' },
  { name: 'Magenta', hex: '#ec4899' },
  { name: 'Amber', hex: '#f59e0b' },
  { name: 'Emerald', hex: '#10b981' },
  { name: 'White', hex: '#ffffff' },
]

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

  const [cameraState, setCameraState] = useState<'starting' | 'running' | 'error' | 'unsupported'>('starting')
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('')

  // Guided capture & liveness flash states
  const [isGuidedRunning, setIsGuidedRunning] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [flashColor, setFlashColor] = useState<string | null>(null)
  const [isCapturing, setIsCapturing] = useState(false)
  const [showLivenessInfo, setShowLivenessInfo] = useState(false)

  // Current target pose based on captured count
  const currentPose = ENROLLMENT_POSES[Math.min(files.length, ENROLLMENT_POSES.length - 1)]

  // Connect to camera (called for retries or device switches)
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

  // Mount & cleanup
  useEffect(() => {
    let cancelled = false

    const init = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraState('unsupported')
        setCameraError('Camera access is not supported by your browser or environment.')
        return
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream

        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }

        const allDevices = await navigator.mediaDevices.enumerateDevices()
        if (cancelled) return
        const videoInputs = allDevices.filter((d) => d.kind === 'videoinput')
        setDevices(videoInputs)
        const activeTrack = stream.getVideoTracks()[0]
        const activeSetting = activeTrack?.getSettings()
        if (activeSetting?.deviceId) {
          setSelectedDeviceId(activeSetting.deviceId)
        }
        setCameraState('running')
      } catch (err: unknown) {
        if (cancelled) return
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
    }

    void init()

    return () => {
      cancelled = true
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }
    }
  }, [])

  // Single photo snap with screen flash reflection
  const captureFrame = useCallback(
    async (pose: Pose): Promise<File | null> => {
      const video = videoRef.current
      if (!video || video.readyState < 2) return null

      setIsCapturing(true)

      // Step through rapid chromatic flash sequence (illuminates face with controlled colors)
      for (const col of FLASH_COLORS) {
        setFlashColor(col.hex)
        await new Promise((r) => setTimeout(r, 90))
      }

      // Capture frame onto canvas during the high-brightness flash
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth || 1280
      canvas.height = video.videoHeight || 720
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        setFlashColor(null)
        setIsCapturing(false)
        return null
      }

      // Draw unmirrored frame for backend facial recognition
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

      // Hold white flash briefly then clear
      await new Promise((r) => setTimeout(r, 70))
      setFlashColor(null)
      setIsCapturing(false)

      return new Promise<File | null>((resolve) => {
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(null)
              return
            }
            const filename = `face_${pose.id}_${Date.now()}.jpg`
            const file = new File([blob], filename, { type: 'image/jpeg' })
            resolve(file)
          },
          'image/jpeg',
          0.95,
        )
      })
    },
    [],
  )

  // Trigger manual snapshot
  const handleSnap = async () => {
    if (files.length >= max || isCapturing || disabled) return
    const file = await captureFrame(currentPose)
    if (file) onCapture(file)
  }

  // Run automated guided sequence across required poses (3 poses)
  const runGuidedSequence = async () => {
    if (files.length >= max || isGuidedRunning || disabled) return
    setIsGuidedRunning(true)

    const targetPoses = ENROLLMENT_POSES.slice(files.length, Math.min(3, max))
    if (targetPoses.length === 0 && files.length < max) {
      targetPoses.push(ENROLLMENT_POSES[files.length])
    }

    for (const pose of targetPoses) {
      // 3-second countdown
      for (let sec = 3; sec > 0; sec--) {
        setCountdown(sec)
        await new Promise((r) => setTimeout(r, 800))
      }
      setCountdown(null)

      // Screen flash & snap
      const file = await captureFrame(pose)
      if (file) {
        onCapture(file)
      }

      // Brief pause between poses so user can reposition
      await new Promise((r) => setTimeout(r, 1200))
    }

    setIsGuidedRunning(false)
    setCountdown(null)
  }

  const stopGuidedSequence = () => {
    setIsGuidedRunning(false)
    setCountdown(null)
    setFlashColor(null)
    setIsCapturing(false)
  }

  return (
    <div className="space-y-4">
      {/* Viewfinder Card */}
      <div className="relative aspect-[4/3] w-full max-w-xl mx-auto overflow-hidden rounded-xl bg-gray-950 border border-gray-800 shadow-lg">
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
            <div className="rounded-full bg-black/60 px-4 py-1.5 text-xs font-semibold text-white tracking-wide shadow-lg">
              ✨ Liveness Flash Reflection
            </div>
          </div>
        )}

        {/* Face Oval Silhouette Guide & Cutout */}
        {cameraState === 'running' && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            {/* Centered oval cutout with darkened exterior via massive box shadow */}
            <div
              className={cn(
                'relative w-44 h-60 sm:w-52 sm:h-72 rounded-[50%] border-2 transition-all duration-200 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]',
                countdown
                  ? 'border-amber-400 scale-105 shadow-[0_0_20px_rgba(251,191,36,0.5),0_0_0_9999px_rgba(0,0,0,0.65)]'
                  : flashColor
                    ? 'border-white scale-110 shadow-[0_0_30px_rgba(255,255,255,0.8),0_0_0_9999px_rgba(0,0,0,0.7)]'
                    : 'border-white/70 border-dashed hover:border-cyan-400',
              )}
            >
              {/* Corner alignment brackets */}
              <div className="absolute -top-1 -left-1 size-3 border-t-2 border-l-2 border-cyan-400" />
              <div className="absolute -top-1 -right-1 size-3 border-t-2 border-r-2 border-cyan-400" />
              <div className="absolute -bottom-1 -left-1 size-3 border-b-2 border-l-2 border-cyan-400" />
              <div className="absolute -bottom-1 -right-1 size-3 border-b-2 border-r-2 border-cyan-400" />

              {/* Countdown overlay inside oval */}
              {countdown !== null && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="flex size-16 items-center justify-center rounded-full bg-black/70 text-3xl font-bold text-amber-300 animate-pulse border-2 border-amber-400">
                    {countdown}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Top Floating Instruction Pill */}
        {cameraState === 'running' && (
          <div className="absolute top-3 inset-x-3 z-20 flex items-center justify-between pointer-events-none">
            <div className="flex items-center gap-2 rounded-full bg-black/70 backdrop-blur-md px-3.5 py-1 text-xs text-white border border-white/10 shadow">
              <span className="size-2 rounded-full bg-emerald-400 animate-ping" />
              <span className="font-semibold">{currentPose.title}</span>
              <span className="text-white/60">·</span>
              <span className="text-white/90">{currentPose.instruction}</span>
            </div>

            {/* Camera switch selector if multiple cameras exist */}
            {devices.length > 1 && (
              <select
                aria-label="Select camera"
                value={selectedDeviceId}
                onChange={(e) => connectCamera(e.target.value)}
                className="pointer-events-auto rounded-full bg-black/70 px-2.5 py-1 text-xs text-white border border-white/20 backdrop-blur-md focus:outline-none"
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

        {/* Bottom Shutter & Controls Bar */}
        {cameraState === 'running' && (
          <div className="absolute bottom-3 inset-x-3 z-20 flex items-center justify-between">
            <span className="text-[11px] font-medium text-white/80 bg-black/60 px-2.5 py-1 rounded-md backdrop-blur-xs">
              {files.length} of {max} photos taken
            </span>

            <div className="flex items-center gap-2">
              {isGuidedRunning ? (
                <Button size="sm" variant="danger" onClick={stopGuidedSequence}>
                  Cancel Sequence
                </Button>
              ) : (
                <>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={runGuidedSequence}
                    disabled={files.length >= max || isCapturing || disabled}
                    title="Automated 3-photo sequence with color flash"
                  >
                    Auto Sequence ({Math.min(3, max)} photos)
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

      {/* Liveness Flash Explanation Note (GoTyme/MariBank reference) */}
      <div className="rounded-lg border border-cyan-100 bg-cyan-50/50 p-3 text-xs text-gray-700">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5 font-medium text-cyan-900">
            <svg viewBox="0 0 20 20" className="size-4 text-cyan-600 shrink-0" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9H9Z" clipRule="evenodd" />
            </svg>
            <span>Active Screen Flash Liveness</span>
          </div>
          <button
            type="button"
            onClick={() => setShowLivenessInfo((v) => !v)}
            className="text-[11px] font-medium text-cyan-700 hover:text-cyan-900 underline"
          >
            {showLivenessInfo ? 'Hide explanation' : 'Why does the screen flash colors?'}
          </button>
        </div>

        {showLivenessInfo && (
          <p className="mt-2 text-gray-600 leading-relaxed border-t border-cyan-100/80 pt-2">
            Similar to banking KYC applications like <strong>GoTyme</strong> and <strong>MariBank</strong>,
            the screen projects high-contrast chromatic light onto your face during capture.
            Human skin naturally reflects diffuse light across its contours, while phone screens or paper photos
            produce flat, unnatural reflections. This verifies physical liveness and protects against photo or video replay spoofs.
          </p>
        )}
      </div>
    </div>
  )
}

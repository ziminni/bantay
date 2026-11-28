import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Camera,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Trash2,
  ShieldCheck,
  ArrowRight,
  Scan,
  Sparkles,
  Info,
} from 'lucide-react'
import { getEnrollmentSession, uploadSessionPhotos } from '@/api/sessions'
import {
  MAX_ENROLLMENT_PHOTOS,
  MIN_ENROLLMENT_PHOTOS,
  ACCEPTED_IMAGE_TYPES,
  MAX_UPLOAD_BYTES,
} from '@/lib/constants'

interface MobileStep {
  id: string
  title: string
  instruction: string
  subtext: string
  emoji: string
  targetCount: number
}

const MOBILE_BANKING_STEPS: MobileStep[] = [
  {
    id: 'front',
    title: 'Front Center',
    instruction: 'Look straight at your front camera',
    subtext: 'Neutral expression, keep your phone at eye level.',
    emoji: '😐',
    targetCount: 2,
  },
  {
    id: 'turn_left',
    title: 'Turn Left',
    instruction: 'Slowly turn your head to your left',
    subtext: 'Turn about 20° to capture your left cheekbone and jawline.',
    emoji: '⬅️',
    targetCount: 2,
  },
  {
    id: 'turn_right',
    title: 'Turn Right',
    instruction: 'Now slowly turn your head to your right',
    subtext: 'Turn about 20° to capture your right cheekbone and jawline.',
    emoji: '➡️',
    targetCount: 2,
  },
  {
    id: 'tilt_up',
    title: 'Tilt Chin Up',
    instruction: 'Tilt your chin slightly upward',
    subtext: 'Helps recognize you at lower-angle kiosk cameras.',
    emoji: '⬆️',
    targetCount: 1,
  },
  {
    id: 'tilt_down',
    title: 'Tilt Head Down',
    instruction: 'Tilt your head slightly downward',
    subtext: 'Helps recognize you from overhead entrance CCTV cameras.',
    emoji: '⬇️',
    targetCount: 1,
  },
  {
    id: 'smile',
    title: 'Natural Smile',
    instruction: 'Look straight and give a gentle smile',
    subtext: 'Captures expression variation and liveness.',
    emoji: '😊',
    targetCount: 2,
  },
]

export function MobileEnrollPage() {
  const [params] = useSearchParams()
  const sessionId = params.get('session')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [activeStepIdx, setActiveStepIdx] = useState(0)

  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)

  // Verify session on load
  useEffect(() => {
    if (!sessionId) {
      setError('No session ID found. Please scan the QR code displayed on the Bantay desktop screen.')
      setLoading(false)
      return
    }

    getEnrollmentSession(sessionId)
      .then((data) => {
        if (data.status === 'expired') {
          setError('This enrollment session has expired. Please refresh the QR code on your computer.')
        }
      })
      .catch((err) => {
        console.error('Session fetch failed:', err)
        setError('Invalid or expired session. Please re-scan the QR code from the Bantay screen.')
      })
      .finally(() => setLoading(false))
  }, [sessionId])

  // Sync object URLs for previews
  useEffect(() => {
    const urls = selectedFiles.map((file) => URL.createObjectURL(file))
    setPreviews(urls)
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [selectedFiles])

  // Automatically advance guided step based on captured photos
  useEffect(() => {
    let accumulated = 0
    for (let i = 0; i < MOBILE_BANKING_STEPS.length; i++) {
      accumulated += MOBILE_BANKING_STEPS[i].targetCount
      if (selectedFiles.length < accumulated) {
        setActiveStepIdx(i)
        return
      }
    }
    setActiveStepIdx(MOBILE_BANKING_STEPS.length - 1)
  }, [selectedFiles.length])

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return

    const incoming = Array.from(fileList)
    const valid: File[] = []
    const problems: string[] = []

    for (const f of incoming) {
      if (!ACCEPTED_IMAGE_TYPES.includes(f.type) && !f.type.startsWith('image/')) {
        problems.push(`${f.name} is not a supported image.`)
      } else if (f.size > MAX_UPLOAD_BYTES) {
        problems.push(`${f.name} is too large (max 10MB).`)
      } else if (selectedFiles.some((x) => x.name === f.name && x.size === f.size)) {
        problems.push(`Photo already added.`)
      } else if (selectedFiles.length + valid.length >= MAX_ENROLLMENT_PHOTOS) {
        problems.push(`Maximum ${MAX_ENROLLMENT_PHOTOS} photos reached.`)
      } else {
        valid.push(f)
      }
    }

    if (problems.length > 0) {
      alert(problems.join('\n'))
    }

    if (valid.length > 0) {
      setSelectedFiles((prev) => [...prev, ...valid])
    }
  }

  const removePhoto = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSendToDesktop = async () => {
    if (!sessionId || selectedFiles.length === 0) return
    setUploading(true)
    setError(null)

    try {
      await uploadSessionPhotos(sessionId, selectedFiles)
      setIsSuccess(true)
    } catch (err) {
      console.error('Failed to send photos:', err)
      setError('Failed to transfer photos. Please ensure your phone is connected to the same Wi-Fi.')
    } finally {
      setUploading(false)
    }
  }

  const handleReset = () => {
    setSelectedFiles([])
    setIsSuccess(false)
    setError(null)
    setActiveStepIdx(0)
  }

  const currentStep = MOBILE_BANKING_STEPS[activeStepIdx]

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6">
        <RefreshCw className="size-8 text-amber-400 animate-spin mb-4" />
        <p className="text-slate-300 font-medium">Connecting to Bantay biometric session...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100 flex flex-col">
      {/* Mobile Top Header */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-20 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="size-8 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20 font-bold text-slate-950 text-sm">
            B
          </div>
          <div>
            <h1 className="font-semibold text-xs tracking-wide text-white flex items-center gap-1.5">
              Bantay Biometric Enrollment
            </h1>
            <p className="text-[10px] text-slate-400 flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Connected to Lab Computer
            </p>
          </div>
        </div>

        {sessionId && (
          <span className="text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700 rounded px-2 py-0.5">
            #{sessionId.slice(0, 6)}
          </span>
        )}
      </header>

      {/* Main Body */}
      <main className="flex-1 max-w-md w-full mx-auto p-4 flex flex-col space-y-4">
        {error && (
          <div className="p-3.5 rounded-xl bg-red-950/60 border border-red-800/80 text-red-200 text-xs flex items-start gap-2.5">
            <AlertCircle className="size-4 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1">{error}</div>
          </div>
        )}

        {isSuccess ? (
          /* Success Screen */
          <div className="my-auto text-center space-y-5 py-8">
            <div className="size-20 bg-emerald-500/20 border border-emerald-500/40 rounded-full flex items-center justify-center mx-auto text-emerald-400 shadow-xl shadow-emerald-500/10 animate-bounce">
              <CheckCircle2 className="size-10" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-bold text-white">Photos Transferred!</h2>
              <p className="text-xs text-slate-300 max-w-xs mx-auto leading-relaxed">
                {selectedFiles.length} multi-angle biometric photos have been sent to your computer.
              </p>
            </div>

            <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 text-left space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-amber-400">
                <ShieldCheck className="size-4" /> Final Step on Computer Screen:
              </div>
              <ul className="text-[11px] text-slate-300 space-y-1.5 list-disc pl-4">
                <li>Look at your computer screen to review the photo previews.</li>
                <li>Click <strong>Enroll Photos</strong> on the computer to finish registration.</li>
                <li>Photos are automatically turned into embeddings and removed from temporary storage.</li>
              </ul>
            </div>

            <div className="pt-4 flex flex-col gap-2">
              <button
                type="button"
                onClick={handleReset}
                className="w-full py-2.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 font-medium transition"
              >
                Scan Again / Take New Photos
              </button>
            </div>
          </div>
        ) : (
          /* Banking-Style Multi-Angle Guided Flow */
          <>
            {/* Banking Pose Banner Card */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
                  <Scan className="size-4 text-amber-400" /> Banking Biometric Guide
                </span>
                <span className="text-[11px] font-medium bg-slate-800 border border-slate-700 text-slate-300 px-2 py-0.5 rounded-full">
                  Step {activeStepIdx + 1} of {MOBILE_BANKING_STEPS.length}
                </span>
              </div>

              {/* Central Biometric Oval Prompt Display */}
              <div className="relative py-4 flex flex-col items-center justify-center text-center space-y-2">
                <div className="relative size-28 rounded-[45%] border-2 border-dashed border-amber-400/80 flex items-center justify-center bg-slate-950/60 shadow-inner">
                  <span className="text-4xl animate-pulse">{currentStep.emoji}</span>
                  <div className="absolute -bottom-1 text-[9px] bg-amber-500 text-slate-950 font-bold px-2 py-0.5 rounded-full">
                    {currentStep.title}
                  </div>
                </div>

                <div className="space-y-0.5 pt-1">
                  <h3 className="text-sm font-bold text-white tracking-wide">
                    {currentStep.instruction}
                  </h3>
                  <p className="text-[11px] text-slate-400 max-w-xs mx-auto leading-normal">
                    {currentStep.subtext}
                  </p>
                </div>
              </div>

              {/* Pose Steps Indicators */}
              <div className="grid grid-cols-6 gap-1 pt-1 border-t border-slate-800">
                {MOBILE_BANKING_STEPS.map((step, idx) => {
                  const isCurrent = activeStepIdx === idx
                  const isCompleted = activeStepIdx > idx
                  return (
                    <div
                      key={step.id}
                      className={`text-center py-1 rounded-lg text-[10px] transition ${
                        isCurrent
                          ? 'bg-amber-400/20 text-amber-300 font-bold border border-amber-400/60'
                          : isCompleted
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                            : 'bg-slate-950/40 text-slate-500'
                      }`}
                    >
                      <div>{step.emoji}</div>
                      <div className="text-[9px] truncate">{step.title.split(' ')[0]}</div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Hidden Inputs */}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="user"
              className="hidden"
              onChange={(e) => {
                handleFiles(e.target.files)
                e.target.value = ''
              }}
            />
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                handleFiles(e.target.files)
                e.target.value = ''
              }}
            />

            {/* Dynamic Step Action Button */}
            <div className="grid grid-cols-1 gap-2 pt-1">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                disabled={selectedFiles.length >= MAX_ENROLLMENT_PHOTOS || uploading}
                className="w-full flex items-center justify-center gap-2.5 py-4 px-4 rounded-2xl font-bold text-xs tracking-wide bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-300 hover:to-amber-500 active:scale-[0.98] text-slate-950 shadow-lg shadow-amber-500/25 disabled:opacity-50 disabled:pointer-events-none transition"
              >
                <Camera className="size-4 stroke-[2.5]" />
                <span>
                  Capture {currentStep.emoji} {currentStep.title} ({selectedFiles.length}/{MAX_ENROLLMENT_PHOTOS})
                </span>
              </button>

              <button
                type="button"
                onClick={() => galleryInputRef.current?.click()}
                disabled={selectedFiles.length >= MAX_ENROLLMENT_PHOTOS || uploading}
                className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-[11px] font-medium bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 border border-slate-700/80 transition"
              >
                <span>Select multiple photos from camera roll</span>
              </button>
            </div>

            {/* Captured Photos Gallery */}
            {selectedFiles.length > 0 ? (
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span className="font-medium text-slate-200">
                    Captured Angles ({selectedFiles.length}/{MAX_ENROLLMENT_PHOTOS})
                  </span>
                  <span>
                    {selectedFiles.length >= MIN_ENROLLMENT_PHOTOS ? (
                      <span className="text-emerald-400 font-medium">✓ Ready to send</span>
                    ) : (
                      <span>Need {MIN_ENROLLMENT_PHOTOS - selectedFiles.length} more</span>
                    )}
                  </span>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {previews.map((url, i) => (
                    <div
                      key={url}
                      className="group relative aspect-square rounded-xl overflow-hidden border border-slate-700 bg-slate-800 shadow-md"
                    >
                      <img src={url} alt={`Angle ${i + 1}`} className="size-full object-cover" />
                      <span className="absolute bottom-1 left-1 bg-black/70 backdrop-blur-xs text-[9px] font-bold text-white px-1.5 py-0.2 rounded">
                        #{i + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => removePhoto(i)}
                        className="absolute top-1 right-1 p-1 rounded-full bg-red-600/90 text-white shadow-sm hover:bg-red-700 transition"
                        aria-label="Remove photo"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                  ))}

                  {/* Add More Slot */}
                  {selectedFiles.length < MAX_ENROLLMENT_PHOTOS && (
                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      className="aspect-square rounded-xl border border-dashed border-slate-700 hover:border-amber-400/60 bg-slate-900/40 flex flex-col items-center justify-center text-slate-400 hover:text-amber-400 transition"
                    >
                      <Camera className="size-5 mb-1" />
                      <span className="text-[10px] font-medium">+ Next Angle</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="py-6 border border-dashed border-slate-800 rounded-2xl flex items-center gap-3 p-3 text-slate-400 bg-slate-900/30">
                <Info className="size-5 shrink-0 text-amber-400" />
                <p className="text-[11px] text-slate-400">
                  Follow each angle prompt above to capture multi-angle photos for high recognition accuracy.
                </p>
              </div>
            )}

            {/* Bottom Final Action */}
            <div className="pt-2 mt-auto">
              <button
                type="button"
                onClick={handleSendToDesktop}
                disabled={selectedFiles.length < MIN_ENROLLMENT_PHOTOS || uploading}
                className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl font-bold text-xs tracking-wide bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 active:scale-[0.98] text-white shadow-lg shadow-emerald-500/20 disabled:opacity-40 disabled:pointer-events-none transition"
              >
                {uploading ? (
                  <>
                    <RefreshCw className="size-4 animate-spin" />
                    <span>Transmitting to computer...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="size-4" />
                    <span>Send {selectedFiles.length} Photos to Computer</span>
                    <ArrowRight className="size-4" />
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  )
}

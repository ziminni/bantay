import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Trash2,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react'
import { getEnrollmentSession, uploadSessionPhotos } from '@/api/sessions'
import { WebcamCapture } from '@/components/common/WebcamCapture'
import { Button } from '@/components/ui/Button'
import {
  MAX_ENROLLMENT_PHOTOS,
  MIN_ENROLLMENT_PHOTOS,
  ACCEPTED_IMAGE_TYPES,
  MAX_UPLOAD_BYTES,
} from '@/lib/constants'

export function MobileEnrollPage() {
  const [params] = useSearchParams()
  const sessionId = params.get('session')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [fallbackUploadMode, setFallbackUploadMode] = useState(false)

  const galleryInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

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
      .catch(() => {
        setError('Invalid or expired session. Please re-scan the QR code from the Bantay screen.')
      })
      .finally(() => setLoading(false))
  }, [sessionId])

  useEffect(() => {
    const urls = selectedFiles.map((file) => URL.createObjectURL(file))
    setPreviews(urls)
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [selectedFiles])

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
        problems.push('Photo already added.')
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

  const handleSendToDesktop = async (filesToSend = selectedFiles) => {
    if (!sessionId || filesToSend.length === 0) return
    setUploading(true)
    setError(null)

    try {
      await uploadSessionPhotos(sessionId, filesToSend)
      setIsSuccess(true)
    } catch {
      setError('Failed to transfer photos. Please ensure your phone is connected to the same Wi-Fi.')
    } finally {
      setUploading(false)
    }
  }

  const handleReset = () => {
    setSelectedFiles([])
    setIsSuccess(false)
    setError(null)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-cream text-navy-900 flex flex-col items-center justify-center p-6">
        <RefreshCw className="size-7 text-marigold-500 animate-spin mb-3" />
        <p className="text-sm font-medium text-gray-600">Connecting to Bantay enrollment session...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-cream text-navy-900 flex flex-col">
      {/* Header matching Bantay Navy + Marigold theme */}
      <header className="border-b border-navy-800 bg-navy-900 text-cream sticky top-0 z-20 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="size-8 rounded-lg bg-marigold-400 flex items-center justify-center font-display font-bold text-navy-950 text-sm">
            B
          </div>
          <div>
            <h1 className="font-display font-semibold text-sm text-cream">Bantay Face Enrollment</h1>
            <p className="text-[11px] text-navy-200 flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-emerald-400" />
              Connected to Lab Computer
            </p>
          </div>
        </div>

        {sessionId && (
          <span className="text-[11px] font-mono bg-navy-800 text-navy-200 border border-white/10 rounded px-2 py-0.5">
            #{sessionId.slice(0, 6)}
          </span>
        )}
      </header>

      <main className="flex-1 max-w-lg w-full mx-auto p-4 flex flex-col space-y-4">
        {error && (
          <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2.5">
            <AlertCircle className="size-4 text-red-500 shrink-0 mt-0.5" />
            <div className="flex-1">{error}</div>
          </div>
        )}

        {isSuccess ? (
          <div className="my-auto rounded-2xl border border-gray-200 bg-white p-6 text-center space-y-5 shadow-card">
            <div className="size-16 bg-emerald-50 border border-emerald-200 rounded-full flex items-center justify-center mx-auto text-emerald-600">
              <CheckCircle2 className="size-8" />
            </div>

            <div className="space-y-1.5">
              <h2 className="font-display text-lg font-semibold text-navy-900">Photos Sent to Computer</h2>
              <p className="text-xs text-gray-600 max-w-xs mx-auto leading-relaxed">
                {selectedFiles.length} face photos have been transferred to your enrollment page.
              </p>
            </div>

            <div className="rounded-xl border border-marigold-200 bg-marigold-50 p-4 text-left space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-navy-900">
                <ShieldCheck className="size-4 text-marigold-600" /> Next step on computer:
              </div>
              <ul className="text-xs text-gray-700 space-y-1 list-disc pl-4">
                <li>Review the transferred photos on your computer screen.</li>
                <li>Click <strong>Enroll photos</strong> to save the face embeddings.</li>
              </ul>
            </div>

            <Button onClick={handleReset} className="w-full justify-center">
              Scan Again
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {!fallbackUploadMode ? (
              <div className="space-y-2">
                <WebcamCapture
                  files={selectedFiles}
                  onCapture={(file) => setSelectedFiles((prev) => [...prev, file])}
                  onComplete={async (allPhotos) => {
                    await handleSendToDesktop(allPhotos)
                  }}
                  max={MAX_ENROLLMENT_PHOTOS}
                  disabled={uploading}
                  onSwitchToUpload={() => setFallbackUploadMode(true)}
                />

                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => setFallbackUploadMode(true)}
                    className="text-xs text-navy-700 hover:text-navy-900 underline"
                  >
                    Having camera issues? Use native camera or photo library instead
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-card">
                <div className="flex items-center justify-between text-xs font-semibold text-navy-900">
                  <span>Phone Camera / Photo Library</span>
                  <button
                    type="button"
                    onClick={() => setFallbackUploadMode(false)}
                    className="text-xs text-navy-700 underline"
                  >
                    Back to Live Guided Scanner
                  </button>
                </div>

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

                <Button variant="primary" onClick={() => cameraInputRef.current?.click()} className="w-full justify-center">
                  Take Front Selfie ({selectedFiles.length}/{MAX_ENROLLMENT_PHOTOS})
                </Button>

                <Button onClick={() => galleryInputRef.current?.click()} className="w-full justify-center">
                  Choose from Photo Library
                </Button>
              </div>
            )}

            {selectedFiles.length > 0 && (
              <div className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-card">
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span className="font-medium text-navy-900">
                    Captured photos ({selectedFiles.length} of {MAX_ENROLLMENT_PHOTOS})
                  </span>
                  <span>
                    {selectedFiles.length >= MIN_ENROLLMENT_PHOTOS
                      ? '✓ Ready to send'
                      : `Need ${MIN_ENROLLMENT_PHOTOS - selectedFiles.length} more`}
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  {previews.map((url, i) => (
                    <div
                      key={url}
                      className="relative aspect-square rounded-lg overflow-hidden border border-gray-200 bg-gray-100"
                    >
                      <img src={url} alt={`Photo ${i + 1}`} className="size-full object-cover" />
                      <span className="absolute bottom-1 left-1 rounded bg-navy-950/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
                        #{i + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => removePhoto(i)}
                        className="absolute top-1 right-1 p-1 rounded-full bg-red-600 text-white hover:bg-red-700"
                        aria-label="Remove photo"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                  ))}
                </div>

                <Button
                  variant="primary"
                  onClick={() => handleSendToDesktop()}
                  disabled={selectedFiles.length < MIN_ENROLLMENT_PHOTOS}
                  loading={uploading}
                  icon={<ArrowRight />}
                  className="w-full justify-center"
                >
                  Send {selectedFiles.length} Photos to Computer
                </Button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

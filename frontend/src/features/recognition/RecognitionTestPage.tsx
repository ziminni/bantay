import { Image as ImageIcon, LogIn, ScanSearch, SlidersHorizontal } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { errorMessage } from '@/api/errors'
import { listLabs } from '@/api/labs'
import { recognize, recognizeAndLog } from '@/api/recognition'
import type { EntryDecision, RecognizeResult } from '@/api/types'
import { LabSelect } from '@/components/common/selects'
import { PageHeader } from '@/components/layout/PageHeader'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { FileDropzone } from '@/components/ui/FileDropzone'
import { FormField } from '@/components/ui/FormField'
import { Section } from '@/components/ui/Section'
import { useAsync } from '@/hooks/useAsync'
import { ACCEPTED_IMAGE_TYPES, DEFAULT_MATCH_THRESHOLD, MAX_UPLOAD_BYTES } from '@/lib/constants'
import { DecisionResult, FaceResults } from './components/FaceResults'
import { ImageWithBoxes } from './components/ImageWithBoxes'

/**
 * Check recognition on a still photo. "Test" writes nothing, so it is safe for
 * measuring accuracy and choosing a threshold. "Test and record" runs the same
 * path as a camera frame and writes an entry.
 */
export function RecognitionTestPage() {
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [labId, setLabId] = useState('')
  const [threshold, setThreshold] = useState(Math.round(DEFAULT_MATCH_THRESHOLD * 100))
  const [busy, setBusy] = useState<'test' | 'log' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<RecognizeResult | null>(null)
  const [decision, setDecision] = useState<EntryDecision | null>(null)

  const labs = useAsync(() => listLabs(), [])
  const lab = labs.data?.find((l) => String(l.id) === labId)

  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file])
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview)
  }, [preview])

  const choose = (files: File[]) => {
    const f = files[0]
    if (!f) return
    if (!ACCEPTED_IMAGE_TYPES.includes(f.type)) return setFileError('Choose a JPEG or PNG photo.')
    if (f.size > MAX_UPLOAD_BYTES) return setFileError('The photo is larger than 10 MB.')
    setFileError(null)
    setFile(f)
    setResult(null)
    setDecision(null)
    setError(null)
  }

  const run = async (mode: 'test' | 'log') => {
    if (!file) return
    setBusy(mode)
    setError(null)
    setDecision(null)
    try {
      setResult(await recognize(file, threshold / 100))
      if (mode === 'log' && labId) setDecision(await recognizeAndLog(file, Number(labId)))
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <PageHeader
        title="Test Recognition"
        description="Upload a photo to see who Bantay thinks it is. Use it to check accuracy and choose a lab's threshold."
      />

      <div className="grid gap-6 lg:grid-cols-5">
        <Section title="Photo" icon={<ImageIcon />} className="lg:col-span-3">
          <div className="space-y-5">
            {preview ? (
              <ImageWithBoxes src={preview} faces={result?.faces ?? []} />
            ) : (
              <FileDropzone onFiles={choose} multiple={false} label="Drag a photo here, or click to choose" hint="JPEG or PNG, up to 10 MB." />
            )}
            {fileError && <Alert tone="error">{fileError}</Alert>}
            {preview && (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="truncate text-sm text-gray-500">{file?.name}</p>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setFile(null)
                    setResult(null)
                    setDecision(null)
                  }}
                >
                  Choose another photo
                </Button>
              </div>
            )}
          </div>
        </Section>

        <div className="space-y-6 lg:col-span-2">
          <Section title="Settings" icon={<SlidersHorizontal />}>
            <div className="space-y-5">
              <FormField htmlFor="recog-lab" label="Laboratory" hint="Optional. Needed only to record an entry.">
                <LabSelect
                  id="recog-lab"
                  placeholder="None"
                  value={labId}
                  onChange={(e) => {
                    setLabId(e.target.value)
                    // Start the slider at the chosen lab's own threshold.
                    const chosen = labs.data?.find((l) => String(l.id) === e.target.value)
                    if (chosen) setThreshold(Math.round(chosen.match_threshold * 100))
                  }}
                />
              </FormField>

              <FormField
                htmlFor="recog-threshold"
                label={`Threshold: ${threshold}%`}
                hint={lab ? `${lab.name} currently uses ${Math.round(lab.match_threshold * 100)}%.` : 'Faces at or above this similarity count as a match.'}
              >
                <input
                  id="recog-threshold"
                  type="range"
                  min={0}
                  max={100}
                  value={threshold}
                  onChange={(e) => setThreshold(Number(e.target.value))}
                  className="w-full accent-gray-900"
                />
              </FormField>

              <div className="flex flex-col gap-3 border-t border-gray-200 pt-5 sm:flex-row lg:flex-col xl:flex-row">
                <Button variant="primary" icon={<ScanSearch />} onClick={() => run('test')} disabled={!file || busy !== null} loading={busy === 'test'} className="flex-1">
                  Test
                </Button>
                <Button icon={<LogIn />} onClick={() => run('log')} disabled={!file || !labId || busy !== null} loading={busy === 'log'} className="flex-1">
                  Test and record entry
                </Button>
              </div>
              <p className="text-xs text-gray-500">
                &quot;Test&quot; never writes anything. &quot;Test and record entry&quot; uses the lab&apos;s own threshold and cooldown,
                exactly like a camera.
              </p>
            </div>
          </Section>

          <Section title="Result" icon={<ScanSearch />}>
            {error ? (
              <Alert tone="error">{error}</Alert>
            ) : result ? (
              <div className="space-y-4">
                {decision && <DecisionResult decision={decision} />}
                <FaceResults result={result} />
              </div>
            ) : (
              <EmptyState title="No result yet" description="Choose a photo and press Test." />
            )}
          </Section>
        </div>
      </div>
    </>
  )
}

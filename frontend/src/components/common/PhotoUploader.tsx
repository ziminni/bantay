import { useEffect, useMemo, useState } from 'react'
import { FileDropzone } from '@/components/ui/FileDropzone'
import { Alert } from '@/components/ui/Alert'
import { WebcamCapture } from './WebcamCapture'
import { ACCEPTED_IMAGE_TYPES, MAX_UPLOAD_BYTES } from '@/lib/constants'
import { formatBytes } from '@/lib/format'
import { cn } from '@/lib/cn'

interface PhotoUploaderProps {
  files: File[]
  onChange: (files: File[]) => void
  /** Most photos allowed in one upload (the backend allows 5). */
  max: number
  disabled?: boolean
}

/**
 * Capture or choose face photos, preview them and remove any before uploading.
 * Supports in-browser webcam capture with active flash liveness (like GoTyme/MariBank),
 * as well as traditional file upload.
 */
export function PhotoUploader({ files, onChange, max, disabled }: PhotoUploaderProps) {
  const [mode, setMode] = useState<'camera' | 'upload'>('camera')
  const [problems, setProblems] = useState<string[]>([])

  const previews = useMemo(() => files.map((f) => ({ file: f, url: URL.createObjectURL(f) })), [files])
  useEffect(() => () => previews.forEach((p) => URL.revokeObjectURL(p.url)), [previews])

  const add = (incoming: File[]) => {
    const issues: string[] = []
    const next = [...files]
    for (const f of incoming) {
      if (!ACCEPTED_IMAGE_TYPES.includes(f.type)) issues.push(`${f.name}: only JPEG or PNG photos are accepted.`)
      else if (f.size > MAX_UPLOAD_BYTES) issues.push(`${f.name}: larger than 10 MB.`)
      else if (next.some((x) => x.name === f.name && x.size === f.size)) issues.push(`${f.name}: already added.`)
      else if (next.length >= max) issues.push(`${f.name}: at most ${max} photos per upload.`)
      else next.push(f)
    }
    setProblems(issues)
    onChange(next)
  }

  const remove = (index: number) => {
    setProblems([])
    onChange(files.filter((_, i) => i !== index))
  }

  const clearAll = () => {
    setProblems([])
    onChange([])
  }

  return (
    <div className="space-y-4">
      {/* Mode Switch Tabs */}
      <div className="flex items-center justify-between border-b border-gray-200 pb-2">
        <div className="inline-flex rounded-lg bg-gray-100 p-1">
          <button
            type="button"
            onClick={() => setMode('camera')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              mode === 'camera' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900',
            )}
          >
            <svg viewBox="0 0 20 20" className="size-4 text-cyan-600" fill="currentColor">
              <path d="M3.25 4A2.25 2.25 0 0 0 1 6.25v7.5A2.25 2.25 0 0 0 3.25 16h7.5A2.25 2.25 0 0 0 13 13.75v-7.5A2.25 2.25 0 0 0 10.75 4h-7.5ZM14 7.5a.75.75 0 0 1 .75-.75h.01a.75.75 0 0 1 .75.75v5a.75.75 0 0 1-.75.75h-.01a.75.75 0 0 1-.75-.75v-5ZM17 8.5a.75.75 0 0 1 .75-.75h.01a.75.75 0 0 1 .75.75v3a.75.75 0 0 1-.75.75h-.01a.75.75 0 0 1-.75-.75v-3Z" />
            </svg>
            <span>Take with Camera</span>
            <span className="rounded bg-cyan-100 px-1 py-0.2 text-[10px] text-cyan-800">Flash Liveness</span>
          </button>

          <button
            type="button"
            onClick={() => setMode('upload')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              mode === 'upload' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900',
            )}
          >
            <svg viewBox="0 0 20 20" className="size-4 text-gray-500" fill="currentColor">
              <path fillRule="evenodd" d="M3 4.5A1.5 1.5 0 0 1 4.5 3h11A1.5 1.5 0 0 1 17 4.5v11a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 15.5v-11ZM4.5 4.5v7.293l2.646-2.647a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 0 .708 0l2.646-2.646a.5.5 0 0 1 .708 0L15.5 12.086V4.5h-11Zm0 11h11v-1.586l-1.646-1.646a1.5 1.5 0 0 0-2.122 0l-2.646 2.646a1.5 1.5 0 0 1-2.122 0L4.5 12.414V15.5Zm3-8a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
            </svg>
            <span>Upload Files</span>
          </button>
        </div>

        {files.length > 0 && (
          <button
            type="button"
            onClick={clearAll}
            disabled={disabled}
            className="text-xs text-red-600 hover:text-red-800 font-medium disabled:opacity-50"
          >
            Clear all ({files.length})
          </button>
        )}
      </div>

      {/* Camera Mode */}
      {mode === 'camera' && (
        <WebcamCapture
          files={files}
          onCapture={(file) => add([file])}
          max={max}
          disabled={disabled}
          onSwitchToUpload={() => setMode('upload')}
        />
      )}

      {/* File Dropzone Mode */}
      {mode === 'upload' && files.length < max && (
        <FileDropzone
          onFiles={add}
          disabled={disabled}
          hint={`JPEG or PNG, up to 10 MB each. ${files.length} of ${max} added.`}
        />
      )}

      {/* Issues / Warnings */}
      {problems.length > 0 && (
        <Alert tone="error" title="Some files were not added">
          <ul className="list-disc space-y-0.5 pl-5">
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </Alert>
      )}

      {/* Gallery of captured / selected photos */}
      {previews.length > 0 && (
        <div className="space-y-2 border-t border-gray-100 pt-3">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span className="font-medium text-gray-700">
              Captured photos ({previews.length} of {max})
            </span>
            <span>{previews.length >= 3 ? '✓ Minimum requirement met' : `Need at least ${3 - previews.length} more`}</span>
          </div>

          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {previews.map((p, i) => (
              <li key={p.url} className="group relative overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xs">
                <div className="relative aspect-square w-full bg-gray-100">
                  <img src={p.url} alt={`Photo ${i + 1}`} className="size-full object-cover" />
                  <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur-xs">
                    #{i + 1}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-1 p-2">
                  <div className="min-w-0">
                    <p className="truncate text-[11px] font-medium text-gray-900" title={p.file.name}>
                      {p.file.name}
                    </p>
                    <p className="text-[10px] text-gray-500">{formatBytes(p.file.size)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(i)}
                    disabled={disabled}
                    className="shrink-0 rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                    aria-label={`Remove photo ${i + 1}`}
                  >
                    <svg viewBox="0 0 20 20" className="size-3.5" fill="currentColor">
                      <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                    </svg>
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

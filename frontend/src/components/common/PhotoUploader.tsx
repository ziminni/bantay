import { useEffect, useMemo, useState } from 'react'
import { FileDropzone } from '@/components/ui/FileDropzone'
import { Alert } from '@/components/ui/Alert'
import { ACCEPTED_IMAGE_TYPES, MAX_UPLOAD_BYTES } from '@/lib/constants'
import { formatBytes } from '@/lib/format'

interface PhotoUploaderProps {
  files: File[]
  onChange: (files: File[]) => void
  /** Most photos allowed in one upload (the backend allows 5). */
  max: number
  disabled?: boolean
}

/**
 * Choose face photos, preview them and remove any before uploading.
 * Files are checked here for type and size so mistakes show up before upload;
 * the backend still checks each photo for exactly one clear face.
 */
export function PhotoUploader({ files, onChange, max, disabled }: PhotoUploaderProps) {
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

  return (
    <div className="space-y-4">
      {files.length < max && (
        <FileDropzone
          onFiles={add}
          disabled={disabled}
          hint={`JPEG or PNG, up to 10 MB each. ${files.length} of ${max} added.`}
        />
      )}

      {problems.length > 0 && (
        <Alert tone="error" title="Some files were not added">
          <ul className="list-disc space-y-0.5 pl-5">
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </Alert>
      )}

      {previews.length > 0 && (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {previews.map((p, i) => (
            <li key={p.url} className="overflow-hidden rounded-lg border border-gray-200 bg-white">
              <img src={p.url} alt={`Photo ${i + 1}`} className="aspect-square w-full object-cover" />
              <div className="flex items-center justify-between gap-2 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-gray-900" title={p.file.name}>
                    {p.file.name}
                  </p>
                  <p className="text-xs text-gray-500">{formatBytes(p.file.size)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => remove(i)}
                  disabled={disabled}
                  className="shrink-0 rounded px-1.5 py-0.5 text-xs text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  aria-label={`Remove ${p.file.name}`}
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

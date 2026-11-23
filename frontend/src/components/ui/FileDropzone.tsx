import { ImagePlus } from 'lucide-react'
import { useId, useRef, useState } from 'react'
import { cn } from '@/lib/cn'

interface FileDropzoneProps {
  onFiles: (files: File[]) => void
  accept?: string
  multiple?: boolean
  disabled?: boolean
  label?: string
  hint?: string
}

/** Drag files here or click to choose them. */
export function FileDropzone({
  onFiles,
  accept = 'image/jpeg,image/png',
  multiple = true,
  disabled,
  label = 'Drag photos here, or click to choose',
  hint,
}: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const id = useId()

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        if (!disabled) setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        if (!disabled) onFiles(Array.from(e.dataTransfer.files))
      }}
      className={cn(
        'rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors',
        over ? 'border-marigold-400 bg-marigold-50/60' : 'border-gray-300 bg-gray-50/50 hover:border-navy-300 hover:bg-white',
        disabled && 'opacity-50',
      )}
    >
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        className="sr-only"
        onChange={(e) => {
          onFiles(Array.from(e.target.files ?? []))
          e.target.value = ''
        }}
      />
      <label htmlFor={id} className={cn('block', !disabled && 'cursor-pointer')}>
        <span className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl bg-white text-navy-700 shadow-card ring-1 ring-gray-200">
          <ImagePlus className="size-5" aria-hidden />
        </span>
        <span className="block text-sm font-medium text-navy-900">{label}</span>
        {hint && <span className="mt-1 block text-sm text-gray-500">{hint}</span>}
        <span className="mt-4 inline-flex h-8 items-center rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-navy-900 shadow-card hover:bg-gray-50">
          Choose files
        </span>
      </label>
    </div>
  )
}

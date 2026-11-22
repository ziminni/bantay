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
        'rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors',
        over ? 'border-gray-900 bg-gray-50' : 'border-gray-300',
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
        <span className="block text-sm font-medium text-gray-900">{label}</span>
        {hint && <span className="mt-1 block text-sm text-gray-500">{hint}</span>}
        <span className="mt-4 inline-flex h-8 items-center rounded-md border border-gray-300 bg-white px-3 text-sm font-medium hover:bg-gray-100">
          Choose files
        </span>
      </label>
    </div>
  )
}

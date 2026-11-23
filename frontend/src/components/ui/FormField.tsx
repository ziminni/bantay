import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface FormFieldProps {
  /** Must match the id of the control inside. */
  htmlFor: string
  label: ReactNode
  hint?: ReactNode
  error?: string | null
  required?: boolean
  className?: string
  children: ReactNode
}

/** A label, the control, then a hint or an error underneath. */
export function FormField({ htmlFor, label, hint, error, required, className, children }: FormFieldProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-gray-900">
        {label}
        {required && (
          <span className="ml-0.5 text-marigold-500" aria-hidden>
            *
          </span>
        )}
      </label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} className="text-sm text-red-700">
          {error}
        </p>
      ) : hint ? (
        <p id={`${htmlFor}-hint`} className="text-sm text-gray-500">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

/** Stacks form fields with even spacing; `columns` puts them side by side on wide screens. */
export function FormGrid({ columns = 1, children }: { columns?: 1 | 2; children: ReactNode }) {
  return <div className={cn('grid gap-5', columns === 2 && 'sm:grid-cols-2')}>{children}</div>
}

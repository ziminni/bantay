import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

type Tone = 'info' | 'warning' | 'error' | 'success'

const tones: Record<Tone, string> = {
  info: 'border-gray-300 bg-white text-gray-700',
  warning: 'border-gray-400 bg-gray-100 text-gray-900',
  error: 'border-red-300 bg-red-50 text-red-800',
  success: 'border-gray-300 bg-white text-gray-900',
}

/** An inline message inside a page or form. */
export function Alert({
  tone = 'info',
  title,
  children,
  action,
  className,
}: {
  tone?: Tone
  title?: ReactNode
  children?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn('flex flex-wrap items-start justify-between gap-3 rounded-md border px-4 py-3 text-sm', tones[tone], className)}
    >
      <div className="min-w-0 space-y-0.5">
        {title && <p className="font-medium">{title}</p>}
        {children && <div>{children}</div>}
      </div>
      {action}
    </div>
  )
}

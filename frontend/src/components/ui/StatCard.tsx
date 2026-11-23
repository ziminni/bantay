import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface StatCardProps {
  label: string
  value: ReactNode
  hint?: ReactNode
  icon?: ReactNode
  /** The featured card is navy, for the single most important number on a page. */
  featured?: boolean
  /** Draws attention to the hint, e.g. when a camera is down. */
  alert?: boolean
}

export function StatCard({ label, value, hint, icon, featured = false, alert = false }: StatCardProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border px-5 py-5 shadow-card',
        featured ? 'border-navy-900 bg-navy-900 text-cream' : 'border-gray-200/80 bg-white',
      )}
    >
      {featured && <ScanCorners />}
      <div className="flex items-start justify-between gap-3">
        <p className={cn('text-sm font-medium', featured ? 'text-navy-200' : 'text-gray-500')}>{label}</p>
        {icon && (
          <span
            className={cn(
              'hidden size-9 shrink-0 items-center justify-center rounded-xl sm:flex [&_svg]:size-[18px]',
              featured ? 'bg-white/10 text-marigold-300' : 'bg-navy-50 text-navy-700',
            )}
          >
            {icon}
          </span>
        )}
      </div>
      <p
        className={cn(
          'mt-3 font-display text-3xl font-semibold tracking-tight tabular-nums sm:text-4xl',
          featured ? 'text-cream' : 'text-navy-900',
        )}
      >
        {value}
      </p>
      {hint && (
        <p
          className={cn(
            'mt-1.5 flex items-center gap-1.5 text-sm',
            featured ? 'text-navy-200' : alert ? 'font-medium text-red-700' : 'text-gray-500',
          )}
        >
          {alert && <span aria-hidden className="size-1.5 rounded-full bg-red-500" />}
          {hint}
        </p>
      )}
    </div>
  )
}

/** The scan-bracket corners from the Bantay mark, as a quiet decoration. */
function ScanCorners() {
  return (
    <span
      aria-hidden
      className="absolute right-3 bottom-3 size-6 rounded-br-lg border-r-2 border-b-2 border-marigold-400/50"
    />
  )
}

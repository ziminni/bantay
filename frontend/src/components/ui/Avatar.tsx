import { ScanFace } from 'lucide-react'
import { cn } from '@/lib/cn'

/** Honorifics are skipped so "Dr. Ramon Salazar" becomes "RS". */
const TITLES = new Set(['dr.', 'prof.', 'engr.', 'mr.', 'ms.', 'mrs.', 'atty.'])

function initials(name: string): string {
  const parts = name
    .split(/\s+/)
    .filter((p) => p && !TITLES.has(p.toLowerCase()))
  if (parts.length === 0) return '?'
  const first = parts[0][0]
  const last = parts.length > 1 ? parts[parts.length - 1][0] : ''
  return (first + last).toUpperCase()
}

const sizes = {
  sm: 'size-8 text-xs',
  md: 'size-10 text-sm',
  lg: 'size-14 text-lg',
}

/**
 * A person's initials in a circle. Photos are never stored by Bantay, so
 * there is no picture to show — by design.
 */
export function Avatar({
  name,
  unknown = false,
  size = 'sm',
  className,
}: {
  name?: string
  unknown?: boolean
  size?: keyof typeof sizes
  className?: string
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-display font-semibold',
        unknown ? 'bg-marigold-50 text-marigold-600 ring-1 ring-marigold-200 ring-inset' : 'bg-navy-50 text-navy-700',
        sizes[size],
        className,
      )}
    >
      {unknown || !name ? <ScanFace className="size-[55%]" strokeWidth={1.75} /> : initials(name)}
    </span>
  )
}

import { ScanFace } from 'lucide-react'
import { cn } from '@/lib/cn'
import { initials } from '@/lib/initials'

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

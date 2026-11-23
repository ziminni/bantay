import { Check } from 'lucide-react'
import { cn } from '@/lib/cn'

/** Numbered steps for multi-step flows like Enroll. */
export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-0">
      {steps.map((label, i) => {
        const done = i < current
        const active = i === current
        return (
          <li key={label} className="flex items-center sm:flex-1 sm:last:flex-none" aria-current={active ? 'step' : undefined}>
            <span
              className={cn(
                'flex size-9 shrink-0 items-center justify-center rounded-full font-display text-sm font-semibold transition-colors',
                active && 'bg-navy-900 text-cream ring-4 ring-marigold-200',
                done && 'bg-marigold-400 text-navy-950',
                !active && !done && 'bg-white text-gray-400 ring-1 ring-gray-200',
              )}
            >
              {done ? <Check className="size-4" strokeWidth={3} aria-label="Done" /> : i + 1}
            </span>
            <span
              className={cn(
                'ml-3 text-sm whitespace-nowrap',
                active ? 'font-semibold text-navy-900' : done ? 'font-medium text-navy-700' : 'text-gray-500',
              )}
            >
              {label}
            </span>
            {i < steps.length - 1 && (
              <span
                aria-hidden
                className={cn('mx-5 hidden h-0.5 flex-1 rounded-full sm:block', done ? 'bg-marigold-300' : 'bg-gray-200')}
              />
            )}
          </li>
        )
      })}
    </ol>
  )
}

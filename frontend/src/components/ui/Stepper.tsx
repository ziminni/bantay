import { cn } from '@/lib/cn'

/** Numbered steps for multi-step flows like Enroll. */
export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-0">
      {steps.map((label, i) => {
        const done = i < current
        const active = i === current
        return (
          <li key={label} className="flex items-center sm:flex-1" aria-current={active ? 'step' : undefined}>
            <span
              className={cn(
                'flex size-8 shrink-0 items-center justify-center rounded-full border text-sm font-medium',
                active && 'border-gray-900 bg-gray-900 text-white',
                done && 'border-gray-900 text-gray-900',
                !active && !done && 'border-gray-300 text-gray-400',
              )}
            >
              {done ? '✓' : i + 1}
            </span>
            <span className={cn('ml-3 text-sm', active ? 'font-medium text-gray-900' : 'text-gray-500')}>{label}</span>
            {i < steps.length - 1 && <span aria-hidden className="mx-4 hidden h-px flex-1 bg-gray-200 sm:block" />}
          </li>
        )
      })}
    </ol>
  )
}

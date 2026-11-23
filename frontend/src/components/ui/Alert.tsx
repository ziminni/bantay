import type { ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react'
import { cn } from '@/lib/cn'

type Tone = 'info' | 'warning' | 'error' | 'success'

const tones: Record<Tone, { box: string; icon: string; Icon: typeof Info }> = {
  info: { box: 'border-navy-100 bg-navy-50/60 text-navy-800', icon: 'text-navy-500', Icon: Info },
  warning: { box: 'border-marigold-200 bg-marigold-50 text-marigold-900', icon: 'text-marigold-500', Icon: AlertTriangle },
  error: { box: 'border-red-200 bg-red-50 text-red-800', icon: 'text-red-500', Icon: XCircle },
  success: { box: 'border-emerald-200 bg-emerald-50 text-emerald-900', icon: 'text-emerald-600', Icon: CheckCircle2 },
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
  const t = tones[tone]
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn('flex flex-wrap items-start gap-3 rounded-xl border px-4 py-3 text-sm', t.box, className)}
    >
      <t.Icon aria-hidden className={cn('mt-0.5 size-4 shrink-0', t.icon)} />
      <div className="min-w-0 flex-1 space-y-0.5">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="opacity-90">{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

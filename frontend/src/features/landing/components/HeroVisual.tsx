import type { ReactNode } from 'react'
import { CheckCircle2, ScanFace } from 'lucide-react'
import { BrandMark } from '@/components/brand/BrandMark'
import { cn } from '@/lib/cn'

/**
 * An illustration of what Bantay does: a camera viewfinder catching a face,
 * with entries popping into the log beside it. Sample names only.
 */
export function HeroVisual() {
  return (
    <div className="relative mx-auto w-full max-w-md" aria-hidden>
      {/* The viewfinder */}
      <div className="relative aspect-[4/5] overflow-hidden rounded-[2rem] bg-[radial-gradient(ellipse_at_top,var(--color-navy-700),var(--color-navy-950)_70%)] shadow-overlay ring-1 ring-white/10">
        <Corners />

        <div className="absolute top-5 left-6 flex items-center gap-2 text-[11px] font-semibold tracking-widest text-cream/80 uppercase">
          <span className="size-1.5 animate-pulse rounded-full bg-red-500" />
          Lab 1 · Entrance
        </div>
        <div className="absolute top-5 right-6 font-mono text-[11px] text-navy-300">07:42:18</div>

        {/* The face being recognized */}
        <div className="absolute inset-x-[22%] top-[22%] bottom-[30%] rounded-[45%] border-2 border-dashed border-marigold-400/60">
          <div className="absolute inset-0 flex items-center justify-center">
            <BrandMark tone="light" className="size-24 opacity-90" />
          </div>
          {/* The scan line */}
          <span className="absolute inset-x-2 h-0.5 animate-scan rounded-full bg-gradient-to-r from-transparent via-marigold-400 to-transparent shadow-[0_0_12px_2px_rgb(242_169_59/0.6)]" />
        </div>

        <div className="absolute inset-x-6 bottom-6 rounded-2xl bg-white/95 p-4 shadow-raised backdrop-blur">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-full bg-navy-50 font-display text-sm font-semibold text-navy-700">
              JD
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-navy-900">Juan Dela Cruz</p>
              <p className="text-xs text-gray-500">Student · 2021-12345</p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800 ring-1 ring-emerald-600/15 ring-inset">
              <CheckCircle2 className="size-3.5" />
              94%
            </span>
          </div>
        </div>
      </div>

      {/* Entries popping into the log */}
      <LogCard
        className="-right-6 top-16 hidden animate-float sm:flex lg:-right-14"
        icon={<CheckCircle2 className="size-4 text-emerald-600" />}
        title="Entry logged"
        meta="Lab 1 · 7:42 AM"
      />
      <LogCard
        className="-left-8 top-1/2 hidden animate-float [animation-delay:-3s] sm:flex lg:-left-16"
        icon={<ScanFace className="size-4 text-marigold-500" />}
        title="Unknown face"
        meta="Lab 2 · 7:44 AM"
      />
    </div>
  )
}

function LogCard({ className, icon, title, meta }: { className?: string; icon: ReactNode; title: string; meta: string }) {
  return (
    <div className={cn('absolute items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-overlay ring-1 ring-gray-200/80', className)}>
      <span className="flex size-8 items-center justify-center rounded-lg bg-gray-50">{icon}</span>
      <div>
        <p className="text-sm font-semibold text-navy-900">{title}</p>
        <p className="text-xs text-gray-500">{meta}</p>
      </div>
    </div>
  )
}

function Corners() {
  const c = 'absolute size-10 border-cream/70'
  return (
    <>
      <span className={cn(c, 'top-4 left-4 rounded-tl-2xl border-t-[3px] border-l-[3px]')} />
      <span className={cn(c, 'top-4 right-4 rounded-tr-2xl border-t-[3px] border-r-[3px]')} />
      <span className={cn(c, 'right-4 bottom-4 rounded-br-2xl border-r-[3px] border-b-[3px]')} />
      <span className={cn(c, 'bottom-4 left-4 rounded-bl-2xl border-b-[3px] border-l-[3px]')} />
    </>
  )
}

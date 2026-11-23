import { Cctv, Cpu, Database, FlaskConical, Menu } from 'lucide-react'
import type { ReactNode } from 'react'
import { getHealth } from '@/api/system'
import { Logo } from '@/components/brand/Logo'
import { MOCK_MODE } from '@/config'
import { useAsync } from '@/hooks/useAsync'
import { cn } from '@/lib/cn'

/** Top bar: the menu button on small screens and the system status at a glance. */
export function Topbar({ onMenu }: { onMenu: () => void }) {
  const health = useAsync(getHealth, [], { refreshInterval: 30_000 })
  const h = health.data
  const camerasTotal = h ? h.cameras_online + h.cameras_offline : 0

  return (
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-3 border-b border-gray-200/70 bg-cream/85 px-4 backdrop-blur-md sm:px-6 lg:px-10">
      <button
        type="button"
        onClick={onMenu}
        className="-ml-2 rounded-lg p-2 text-navy-900 transition-colors hover:bg-gray-100 lg:hidden"
        aria-label="Open menu"
      >
        <Menu className="size-5" />
      </button>
      <Logo variant="lockup" className="h-7 w-auto lg:hidden" />

      <div className="ml-auto flex items-center gap-2">
        {MOCK_MODE && (
          <StatusChip tone="warning" icon={<FlaskConical />} label="Sample data" title="Not connected to the backend; showing sample data." />
        )}
        {Boolean(health.error) && !h && (
          <StatusChip tone="danger" icon={<Database />} label="Server unreachable" title="The Bantay server is not answering." />
        )}
        {h && (
          <>
            <span className="hidden items-center gap-2 md:flex">
              <StatusChip
                tone={h.database_reachable ? 'success' : 'danger'}
                icon={<Database />}
                label={h.database_reachable ? 'Database' : 'Database down'}
                title={h.database_reachable ? 'Database is reachable' : 'Database is unreachable'}
              />
              <StatusChip
                tone={h.recognition_ready ? 'success' : 'warning'}
                icon={<Cpu />}
                label={h.recognition_ready ? 'Recognition' : 'Recognition off'}
                title={`Recognition engine: ${h.recognition_engine}${h.recognition_ready ? ' (ready)' : ' (not running)'}`}
              />
            </span>
            <StatusChip
              tone={h.cameras_offline === 0 ? 'success' : 'danger'}
              icon={<Cctv />}
              label={`${h.cameras_online}/${camerasTotal}`}
              title={`${h.cameras_online} of ${camerasTotal} cameras online`}
            />
          </>
        )}
      </div>
    </header>
  )
}

const dots = { success: 'bg-emerald-500', warning: 'bg-marigold-400', danger: 'bg-red-500' }

function StatusChip({
  tone,
  icon,
  label,
  title,
  className,
}: {
  tone: keyof typeof dots
  icon: ReactNode
  label: string
  title: string
  className?: string
}) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex h-8 items-center gap-2 rounded-full border border-gray-200 bg-white px-3 text-xs font-medium text-navy-800 shadow-card [&_svg]:size-3.5 [&_svg]:text-gray-500',
        className,
      )}
    >
      {icon}
      {label}
      <span aria-hidden className={cn('size-1.5 rounded-full', dots[tone])} />
      <span className="sr-only">{title}</span>
    </span>
  )
}

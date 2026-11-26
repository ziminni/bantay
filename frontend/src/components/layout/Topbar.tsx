import { ChevronRight, Clock, Cctv, Cpu, Database, FlaskConical, Menu, PanelLeftOpen, ScanFace, UserRound } from 'lucide-react'
import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { getHealth } from '@/api/system'
import { Logo } from '@/components/brand/Logo'
import { ButtonLink } from '@/components/ui/Button'
import { MOCK_MODE, TIME_ZONE } from '@/config'
import { useAsync } from '@/hooks/useAsync'
import { useNow } from '@/hooks/useNow'
import { cn } from '@/lib/cn'
import { AlertBell } from './AlertBell'
import { NAVIGATION, type NavItem } from './navigation'
import { ProfileMenu } from './ProfileMenu'

/** Which sidebar item the current address belongs to (detail pages count as their list). */
const PROFILE: NavItem = { to: '/profile', label: 'My profile', description: 'Your account in Bantay', icon: UserRound }

function useCurrentPage(): { item: NavItem; group?: string } | null {
  const { pathname } = useLocation()
  if (pathname === PROFILE.to) return { item: PROFILE, group: 'Account' }
  let best: { item: NavItem; group?: string } | null = null
  for (const group of NAVIGATION) {
    for (const item of group.items) {
      const hit = pathname === item.to || pathname.startsWith(`${item.to}/`)
      if (hit && (!best || item.to.length > best.item.to.length)) best = { item, group: group.label }
    }
  }
  return best
}

const clockFmt = new Intl.DateTimeFormat('en-PH', { timeZone: TIME_ZONE, hour: 'numeric', minute: '2-digit' })
const dayFmt = new Intl.DateTimeFormat('en-PH', { timeZone: TIME_ZONE, weekday: 'short', month: 'short', day: 'numeric' })

/**
 * Top bar: where you are on the left, the time and the system's health on
 * the right, and a shortcut to the task done most often — enrolling a face.
 */
export function Topbar({
  onMenu,
  sidebarOpen = true,
  onOpenSidebar,
}: {
  onMenu: () => void
  sidebarOpen?: boolean
  onOpenSidebar?: () => void
}) {
  const health = useAsync(getHealth, [], { refreshInterval: 30_000 })
  const h = health.data
  const camerasTotal = h ? h.cameras_online + h.cameras_offline : 0
  const current = useCurrentPage()
  const now = useNow(15_000)
  const onEnroll = current?.item.to === '/enroll'

  return (
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-3 border-b border-gray-200/70 bg-cream/85 px-4 backdrop-blur-md sm:px-6 lg:h-[4.5rem] lg:px-10">
      <button
        type="button"
        onClick={onMenu}
        className="-ml-2 rounded-lg p-2 text-navy-900 transition-colors hover:bg-gray-100 lg:hidden"
        aria-label="Open menu"
      >
        <Menu className="size-5" />
      </button>
      <Logo variant="lockup" className="h-7 w-auto lg:hidden" />

      {!sidebarOpen && onOpenSidebar && (
        <button
          type="button"
          onClick={onOpenSidebar}
          className="-ml-2 hidden rounded-lg p-2 text-navy-900 transition-colors hover:bg-gray-100 lg:inline-flex"
          aria-label="Open sidebar"
          title="Open sidebar"
        >
          <PanelLeftOpen className="size-5" />
        </button>
      )}

      {/* Where you are */}
      {current && (
        <div className="hidden min-w-0 items-center gap-3 lg:flex">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-navy-900 text-marigold-400 shadow-card">
            <current.item.icon className="size-5" strokeWidth={1.9} aria-hidden />
          </span>
          <div className="min-w-0 leading-tight">
            <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs font-medium text-gray-500">
              <span>Bantay</span>
              {current.group && (
                <>
                  <ChevronRight className="size-3 text-gray-300" aria-hidden />
                  <span>{current.group}</span>
                </>
              )}
              <ChevronRight className="size-3 text-gray-300" aria-hidden />
              <span className="text-navy-900" aria-current="page">
                {current.item.label}
              </span>
            </nav>
            <p className="mt-0.5 truncate font-display text-[15px] font-semibold text-navy-900">{current.item.description}</p>
          </div>
        </div>
      )}

      <div className="ml-auto flex items-center gap-2">
        {/* Local time — entries are logged in Philippine time. */}
        <span
          className="hidden h-9 items-center gap-2 rounded-full border border-gray-200 bg-white px-3.5 text-xs shadow-card xl:inline-flex"
          title="Philippine time"
        >
          <Clock className="size-3.5 text-marigold-500" aria-hidden />
          <span className="font-semibold text-navy-900 tabular-nums">{clockFmt.format(now)}</span>
          <span className="text-gray-500">{dayFmt.format(now)}</span>
        </span>

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

        <span aria-hidden className="mx-1 hidden h-6 w-px bg-gray-200 sm:block" />
        {!onEnroll && (
          <ButtonLink to="/enroll" variant="accent" size="sm" icon={<ScanFace />} className="hidden h-9 sm:inline-flex">
            Enroll
          </ButtonLink>
        )}
        <AlertBell />
        <ProfileMenu />
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
}: {
  tone: keyof typeof dots
  icon: ReactNode
  label: string
  title: string
}) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex h-9 items-center gap-2 rounded-full border border-gray-200 bg-white px-3 text-xs font-medium text-navy-800 shadow-card [&_svg]:size-3.5 [&_svg]:text-gray-500',
      )}
    >
      {icon}
      {label}
      <span aria-hidden className={cn('size-1.5 rounded-full', dots[tone])} />
      <span className="sr-only">{title}</span>
    </span>
  )
}

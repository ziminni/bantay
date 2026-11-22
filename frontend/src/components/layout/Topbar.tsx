import { getHealth } from '@/api/system'
import { MOCK_MODE } from '@/config'
import { useAsync } from '@/hooks/useAsync'
import { StatusBadge } from '@/components/ui/StatusBadge'

/** Top bar: the menu button on small screens and the system status. */
export function Topbar({ onMenu }: { onMenu: () => void }) {
  const health = useAsync(getHealth, [], { refreshInterval: 30_000 })
  const h = health.data

  return (
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-4 border-b border-gray-200 bg-white px-4 sm:px-6 lg:px-8">
      <button
        type="button"
        onClick={onMenu}
        className="-ml-2 rounded-md p-2 text-gray-700 hover:bg-gray-100 lg:hidden"
        aria-label="Open menu"
      >
        <svg viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
          <path d="M3 5h14M3 10h14M3 15h14" strokeLinecap="round" />
        </svg>
      </button>
      <span className="font-semibold lg:hidden">Bantay</span>

      <div className="ml-auto flex flex-wrap items-center justify-end gap-2 text-sm">
        {MOCK_MODE && (
          <StatusBadge on={false} title="The frontend is not connected to the backend yet; it shows sample data.">
            Sample data
          </StatusBadge>
        )}
        {h && (
          <>
            <span className="hidden gap-2 md:flex">
              <StatusBadge on={h.database_reachable}>Database {h.database_reachable ? 'OK' : 'unreachable'}</StatusBadge>
              <StatusBadge on={h.recognition_ready}>Recognition {h.recognition_ready ? 'ready' : 'off'}</StatusBadge>
            </span>
            <StatusBadge on={h.cameras_offline === 0}>
              Cameras {h.cameras_online}/{h.cameras_online + h.cameras_offline}
            </StatusBadge>
          </>
        )}
      </div>
    </header>
  )
}

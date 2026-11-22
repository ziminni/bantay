import { useId, useState, type ReactNode } from 'react'
import { Button } from './Button'

interface FilterBarProps {
  /** Always visible, usually the search box. */
  primary: ReactNode
  /** Extra filters, shown when the user opens "Filters". */
  children?: ReactNode
  /** Number of filters currently applied (shown on the toggle). */
  activeCount: number
  onClear: () => void
  /** Buttons on the right, e.g. Export. */
  actions?: ReactNode
}

/**
 * Keeps list pages calm: only the search box shows by default, the rest of the
 * filters fold away behind one button.
 */
export function FilterBar({ primary, children, activeCount, onClear, actions }: FilterBarProps) {
  const [open, setOpen] = useState(activeCount > 0)
  const panelId = useId()

  return (
    <div className="space-y-4 border-b border-gray-200 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-full min-w-0 sm:w-auto sm:max-w-sm sm:flex-1">{primary}</div>
        <div className="flex flex-wrap items-center gap-2">
          {children && (
            <Button onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-controls={panelId}>
              Filters{activeCount > 0 && ` (${activeCount})`}
            </Button>
          )}
          {activeCount > 0 && (
            <Button variant="ghost" onClick={onClear}>
              Clear all
            </Button>
          )}
        </div>
        {actions && <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div>}
      </div>

      {children && open && (
        <div id={panelId} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {children}
        </div>
      )}
    </div>
  )
}

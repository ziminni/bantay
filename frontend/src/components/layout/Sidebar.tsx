import { NavLink } from 'react-router-dom'
import { Logo } from '@/components/brand/Logo'
import { cn } from '@/lib/cn'
import { NAVIGATION } from './navigation'

/** The navy sidebar, carrying the brand. */
export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-navy-900 text-navy-100">
      <div className="flex h-20 shrink-0 items-center px-6">
        <NavLink to="/" onClick={onNavigate} aria-label="Bantay — go to the dashboard" className="rounded-md">
          <Logo variant="lockup-on-dark" className="h-10 w-auto" />
        </NavLink>
      </div>

      <nav aria-label="Main" className="relative flex-1 space-y-7 overflow-y-auto px-3 pt-4 pb-6">
        {NAVIGATION.map((group, i) => (
          <div key={group.label ?? i}>
            {group.label && (
              <p className="mb-2 px-3 text-[11px] font-semibold tracking-[0.14em] text-navy-300/80 uppercase">
                {group.label}
              </p>
            )}
            <ul className="space-y-1">
              {group.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.to === '/'}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      cn(
                        'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors',
                        isActive
                          ? 'bg-white/10 font-medium text-cream'
                          : 'text-navy-200 hover:bg-white/5 hover:text-cream',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <span
                          aria-hidden
                          className={cn(
                            'absolute top-1/2 left-0 h-5 w-1 -translate-y-1/2 rounded-r-full bg-marigold-400 transition-opacity',
                            isActive ? 'opacity-100' : 'opacity-0',
                          )}
                        />
                        <item.icon
                          aria-hidden
                          className={cn(
                            'size-[18px] shrink-0 transition-colors',
                            isActive ? 'text-marigold-400' : 'text-navy-300 group-hover:text-navy-100',
                          )}
                          strokeWidth={1.9}
                        />
                        {item.label}
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="relative border-t border-white/10 px-6 py-4">
        <p className="text-xs font-medium text-navy-100">Central Mindanao University</p>
        <p className="mt-0.5 text-[11px] text-navy-300">Computer laboratory entry log</p>
      </div>
    </div>
  )
}

import { NavLink } from 'react-router-dom'
import { BrandMark } from '@/components/brand/BrandMark'
import { Logo } from '@/components/brand/Logo'
import { cn } from '@/lib/cn'
import { NAVIGATION } from './navigation'

/**
 * The navy sidebar. Each category is a heading, and its pages hang beneath it
 * along a thin guide line, indented, like a tree. The open page lights up the
 * guide line in marigold.
 */
export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col bg-navy-900 text-navy-100">
      <div className="flex h-[4.5rem] shrink-0 items-center border-b border-white/10 px-6">
        <NavLink to="/" onClick={onNavigate} aria-label="Bantay — go to the dashboard" className="rounded-md">
          <Logo variant="lockup-on-dark" className="h-10 w-auto" />
        </NavLink>
      </div>

      <nav aria-label="Main" className="flex-1 space-y-6 overflow-y-auto px-4 py-6">
        {NAVIGATION.map((group) => (
          <section key={group.label} aria-labelledby={`nav-${group.label}`}>
            <h2
              id={`nav-${group.label}`}
              className="mb-2 flex items-center gap-2 px-2 font-sans text-[11px] font-semibold tracking-[0.14em] text-navy-300 uppercase"
            >
              <span aria-hidden className="size-1.5 rounded-full bg-marigold-400/80" />
              {group.label}
            </h2>

            {/* Pages are indented under their category, along a guide line. */}
            <ul className="ml-[0.6875rem] space-y-0.5 border-l border-white/10 pl-3">
              {group.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.to === '/'}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      cn(
                        'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                        isActive ? 'bg-white/10 font-medium text-cream' : 'text-navy-200 hover:bg-white/5 hover:text-cream',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {/* Lights up the guide line beside the open page. */}
                        <span
                          aria-hidden
                          className={cn(
                            'absolute top-1.5 bottom-1.5 -left-[0.8125rem] w-0.5 rounded-full transition-colors',
                            isActive ? 'bg-marigold-400' : 'bg-transparent group-hover:bg-white/25',
                          )}
                        />
                        <item.icon
                          aria-hidden
                          strokeWidth={1.9}
                          className={cn(
                            'size-[18px] shrink-0 transition-colors',
                            isActive ? 'text-marigold-400' : 'text-navy-300 group-hover:text-navy-100',
                          )}
                        />
                        <span className="truncate">{item.label}</span>
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </nav>

      <div className="flex items-center gap-3 border-t border-white/10 px-6 py-4">
        <BrandMark tone="light" className="size-8 opacity-80" />
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-navy-100">Central Mindanao University</p>
          <p className="truncate text-[11px] text-navy-300">Computer laboratory entry log</p>
        </div>
      </div>
    </div>
  )
}

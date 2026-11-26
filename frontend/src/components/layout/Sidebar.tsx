import { LogOut, PanelLeftClose } from 'lucide-react'
import { NavLink, useNavigate } from 'react-router-dom'
import { logout } from '@/api/auth'
import { BrandMark } from '@/components/brand/BrandMark'
import { Logo } from '@/components/brand/Logo'
import { useSession } from '@/hooks/useSession'
import { cn } from '@/lib/cn'
import { initials } from '@/lib/initials'
import { NavBadge } from './NavBadge'
import { visibleNavigation } from './navigation'

/**
 * The navy sidebar. Each category is a heading, and its pages hang beneath it
 * along a thin guide line, indented, like a tree. The open page lights up the
 * guide line in marigold.
 */
export function Sidebar({
  onNavigate,
  onClose,
}: {
  onNavigate?: () => void
  onClose?: () => void
}) {
  const user = useSession()
  const navigate = useNavigate()
  const signOut = () => {
    logout()
    navigate('/')
  }

  return (
    <div className="flex h-full flex-col bg-navy-900 text-navy-100">
      <div className="flex h-[4.5rem] shrink-0 items-center justify-between gap-2 border-b border-white/10 pr-4 pl-6">
        <NavLink to="/dashboard" onClick={onNavigate} aria-label="Bantay — go to the dashboard" className="rounded-md">
          <Logo variant="lockup-on-dark" className="h-10 w-auto" />
        </NavLink>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close sidebar"
            title="Close sidebar"
            className="rounded-lg p-2 text-navy-300 transition-colors hover:bg-white/10 hover:text-cream"
          >
            <PanelLeftClose className="size-5" />
          </button>
        )}
      </div>

      <nav aria-label="Main" className="flex-1 space-y-6 overflow-y-auto px-4 py-6">
        {visibleNavigation(user?.role).map((group) => (
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
                        {item.badge && <NavBadge kind={item.badge} />}
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </nav>

      <div className="border-t border-white/10 p-4">
        {user ? (
          <div className="flex items-center gap-1 rounded-xl bg-white/5 p-1.5 ring-1 ring-white/10">
            <NavLink
              to="/profile"
              onClick={onNavigate}
              className="flex min-w-0 flex-1 items-center gap-3 rounded-lg p-1 transition-colors hover:bg-white/5"
              title="My profile"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-marigold-400 font-display text-sm font-semibold text-navy-950">
                {initials(user.displayName)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-cream">{user.displayName}</span>
                <span className="block truncate text-[11px] text-navy-300">{user.role}</span>
              </span>
            </NavLink>
            <button
              type="button"
              onClick={signOut}
              aria-label="Log out"
              title="Log out"
              className="rounded-lg p-2 text-navy-300 transition-colors hover:bg-white/10 hover:text-cream"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3 px-2 py-1">
            <BrandMark tone="light" className="size-8 opacity-80" />
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-navy-100">Central Mindanao University</p>
              <p className="truncate text-[11px] text-navy-300">Computer laboratory entry log</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

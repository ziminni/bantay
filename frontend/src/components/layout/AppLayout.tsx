import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { cn } from '@/lib/cn'
import { WIDE_ROUTES } from './navigation'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

/** Navy sidebar on the left (a slide-over on small screens), top bar, then the page. */
export function AppLayout() {
  // The mobile menu closes itself when a link in it is followed (Sidebar's onNavigate).
  const [menuOpen, setMenuOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const { pathname } = useLocation()
  // Video and review pages use the whole screen; forms and tables keep a readable width.
  const wide = WIDE_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`))

  return (
    <div className="min-h-screen">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:shadow-raised"
      >
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 hidden w-64 transition-transform duration-200 ease-out lg:block',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </aside>

      {/* Mobile sidebar */}
      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 animate-fade-in bg-navy-950/50 backdrop-blur-[2px]" onClick={() => setMenuOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 shadow-overlay">
            <Sidebar onNavigate={() => setMenuOpen(false)} onClose={() => setMenuOpen(false)} />
          </aside>
        </div>
      )}

      <div
        className={cn(
          'flex min-h-screen flex-col transition-[padding] duration-200 ease-out',
          sidebarOpen && 'lg:pl-64',
        )}
      >
        <Topbar
          onMenu={() => setMenuOpen(true)}
          sidebarOpen={sidebarOpen}
          onOpenSidebar={() => setSidebarOpen(true)}
        />
        <main id="main" className="flex-1 px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
          <div className={cn('mx-auto', wide ? 'max-w-[1800px]' : 'max-w-7xl')}>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}

import { X } from 'lucide-react'
import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

/** Navy sidebar on the left (a slide-over on small screens), top bar, then the page. */
export function AppLayout() {
  // The mobile menu closes itself when a link in it is followed (Sidebar's onNavigate).
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="min-h-screen">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:shadow-raised"
      >
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">
        <Sidebar />
      </aside>

      {/* Mobile sidebar */}
      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 animate-fade-in bg-navy-950/50 backdrop-blur-[2px]" onClick={() => setMenuOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 shadow-overlay">
            <Sidebar onNavigate={() => setMenuOpen(false)} />
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              aria-label="Close menu"
              className="absolute top-5 right-3 rounded-lg p-2 text-navy-200 hover:bg-white/10 hover:text-cream"
            >
              <X className="size-5" />
            </button>
          </aside>
        </div>
      )}

      <div className="flex min-h-screen flex-col lg:pl-64">
        <Topbar onMenu={() => setMenuOpen(true)} />
        <main id="main" className="flex-1 px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}

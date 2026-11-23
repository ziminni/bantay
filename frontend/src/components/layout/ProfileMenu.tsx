import { ChevronDown, LogOut, UserRound } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { logout } from '@/api/auth'
import { useToast } from '@/components/ui/useToast'
import { useSession } from '@/hooks/useSession'
import { cn } from '@/lib/cn'
import { initials } from '@/lib/initials'

/** Avatar button in the top bar that opens a small menu: profile and log out. */
export function ProfileMenu() {
  const user = useSession()
  const navigate = useNavigate()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const wrapper = useRef<HTMLDivElement>(null)
  const menuId = useId()

  // Close on a click elsewhere or on Esc.
  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => {
      if (!wrapper.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!user) return null

  const signOut = () => {
    setOpen(false)
    logout()
    navigate('/')
    toast.success('You are logged out.')
  }

  return (
    <div ref={wrapper} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        className={cn(
          'flex h-10 items-center gap-2 rounded-full border bg-white py-1 pr-2.5 pl-1 shadow-card transition-colors',
          open ? 'border-navy-300' : 'border-gray-200 hover:border-gray-300',
        )}
      >
        <span className="flex size-8 items-center justify-center rounded-full bg-navy-900 font-display text-xs font-semibold text-marigold-400">
          {initials(user.displayName)}
        </span>
        <span className="hidden max-w-32 truncate text-sm font-medium text-navy-900 xl:block">{user.displayName}</span>
        <ChevronDown className={cn('size-4 text-gray-500 transition-transform', open && 'rotate-180')} aria-hidden />
        <span className="sr-only">Open the profile menu</span>
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          className="absolute right-0 z-40 mt-2 w-64 animate-fade-in overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-overlay"
        >
          <div className="flex items-center gap-3 border-b border-gray-100 bg-gray-50/70 px-4 py-3.5">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-navy-900 font-display text-sm font-semibold text-marigold-400">
              {initials(user.displayName)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-navy-900">{user.displayName}</p>
              <p className="truncate text-xs text-gray-500">
                @{user.username} · {user.role}
              </p>
            </div>
          </div>
          <div className="p-1.5">
            <Link
              to="/profile"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-navy-900 hover:bg-gray-100"
            >
              <UserRound className="size-4 text-gray-500" aria-hidden />
              My profile
            </Link>
            <button
              type="button"
              role="menuitem"
              onClick={signOut}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50"
            >
              <LogOut className="size-4" aria-hidden />
              Log out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

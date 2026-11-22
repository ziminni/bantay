import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/cn'
import { NAVIGATION } from './navigation'

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center border-b border-gray-200 px-6">
        <NavLink to="/" onClick={onNavigate} className="text-lg font-semibold tracking-tight">
          Bantay
        </NavLink>
      </div>

      <nav aria-label="Main" className="flex-1 space-y-6 overflow-y-auto px-3 py-6">
        {NAVIGATION.map((group, i) => (
          <div key={group.label ?? i}>
            {group.label && (
              <p className="mb-2 px-3 text-xs font-medium tracking-wide text-gray-500 uppercase">{group.label}</p>
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
                        'block rounded-md px-3 py-2 text-sm',
                        isActive ? 'bg-gray-900 font-medium text-white' : 'text-gray-700 hover:bg-gray-100',
                      )
                    }
                  >
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <p className="border-t border-gray-200 px-6 py-4 text-xs text-gray-500">Central Mindanao University</p>
    </div>
  )
}

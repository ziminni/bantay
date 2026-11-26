import {
  Cctv,
  Flag,
  LayoutDashboard,
  Monitor,
  MonitorPlay,
  ScanFace,
  ScanSearch,
  ScrollText,
  Users,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  description: string
  icon: LucideIcon
  /** Show a live count next to the label. */
  badge?: 'pendingFlags'
  /** Known to the breadcrumbs but not listed in the sidebar (reached from a button). */
  hidden?: boolean
}

export interface NavGroup {
  label: string
  items: NavItem[]
  /** Only lab administrators see this group (slide 28: who can do what). */
  adminOnly?: boolean
}

/**
 * The sidebar, grouped by the three moments in the project deck: watching
 * (Monitor), deciding after an incident (Review), and the people and labs
 * Bantay knows about.
 */
export const NAVIGATION: NavGroup[] = [
  {
    label: 'Overview',
    items: [{ to: '/dashboard', label: 'Dashboard', description: "Today's entries, flags and statistics", icon: LayoutDashboard }],
  },
  {
    label: 'Monitor',
    items: [
      { to: '/live', label: 'Live View', description: 'Watch the lab cameras', icon: Cctv },
      { to: '/wall', label: 'Camera Wall', description: 'Every camera in a lab at once', icon: MonitorPlay },
    ],
  },
  {
    label: 'Review',
    items: [
      { to: '/flags', label: 'Flags', description: 'Confirm or dismiss behaviour alerts', icon: Flag, badge: 'pendingFlags' },
      { to: '/logs', label: 'Entry Logs', description: 'Search the entry history', icon: ScrollText },
    ],
  },
  {
    label: 'People',
    items: [
      { to: '/users', label: 'Persons', description: 'Students, faculty and staff', icon: Users },
      { to: '/enroll', label: 'Enroll', description: "Register a person's face", icon: ScanFace, hidden: true },
    ],
  },
  {
    label: 'Manage',
    adminOnly: true,
    items: [
      { to: '/labs', label: 'Labs & Cameras', description: 'Laboratories and their cameras', icon: Monitor },
      { to: '/tools/recognition', label: 'Test Recognition', description: 'Check matching on a photo', icon: ScanSearch },
    ],
  },
]

/** Department staff can review but not manage (slide 28). Everyone else is treated as an administrator. */
export function isAdminRole(role: string | undefined): boolean {
  return !role || !/staff/i.test(role)
}

/** The groups and items this user should see in the sidebar. */
export function visibleNavigation(role: string | undefined): NavGroup[] {
  const admin = isAdminRole(role)
  return NAVIGATION.filter((g) => admin || !g.adminOnly)
    .map((g) => ({ ...g, items: g.items.filter((i) => !i.hidden) }))
    .filter((g) => g.items.length > 0)
}

/** Routes that use the full width of the screen (video and review work). */
export const WIDE_ROUTES = ['/flags', '/live', '/wall']

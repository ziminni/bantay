import { Cctv, LayoutDashboard, Monitor, ScanFace, ScanSearch, ScrollText, Users, type LucideIcon } from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  description: string
  icon: LucideIcon
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

/**
 * The sidebar. Every page sits under a category; the six main pages follow
 * the project documentation, plus the recognition test tool.
 */
export const NAVIGATION: NavGroup[] = [
  {
    label: 'Overview',
    items: [{ to: '/', label: 'Dashboard', description: "Today's entries and statistics", icon: LayoutDashboard }],
  },
  {
    label: 'Monitoring',
    items: [
      { to: '/live', label: 'Live View', description: 'Watch the lab cameras', icon: Cctv },
      { to: '/logs', label: 'Entry Logs', description: 'Search the entry history', icon: ScrollText },
    ],
  },
  {
    label: 'People',
    items: [
      { to: '/enroll', label: 'Enroll', description: "Register a person's face", icon: ScanFace },
      { to: '/users', label: 'Users', description: 'Students, faculty and staff', icon: Users },
    ],
  },
  {
    label: 'Facilities',
    items: [{ to: '/labs', label: 'Labs', description: 'Laboratories and their cameras', icon: Monitor }],
  },
  {
    label: 'Tools',
    items: [
      { to: '/tools/recognition', label: 'Test Recognition', description: 'Check matching on a photo', icon: ScanSearch },
    ],
  },
]

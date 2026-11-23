import { Cctv, LayoutDashboard, Monitor, ScanFace, ScanSearch, ScrollText, Users, type LucideIcon } from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  description: string
  icon: LucideIcon
}

export interface NavGroup {
  label?: string
  items: NavItem[]
}

/** The sidebar. The six main pages follow the project documentation. */
export const NAVIGATION: NavGroup[] = [
  {
    items: [
      { to: '/', label: 'Dashboard', description: "Today's entries and statistics", icon: LayoutDashboard },
      { to: '/live', label: 'Live View', description: 'Camera feeds', icon: Cctv },
      { to: '/enroll', label: 'Enroll', description: 'Register a face', icon: ScanFace },
      { to: '/logs', label: 'Entry Logs', description: 'Search entry history', icon: ScrollText },
    ],
  },
  {
    label: 'Manage',
    items: [
      { to: '/users', label: 'Users', description: 'Students, faculty and staff', icon: Users },
      { to: '/labs', label: 'Labs', description: 'Laboratories and cameras', icon: Monitor },
    ],
  },
  {
    label: 'Tools',
    items: [
      { to: '/tools/recognition', label: 'Test Recognition', description: 'Check matching on a photo', icon: ScanSearch },
    ],
  },
]

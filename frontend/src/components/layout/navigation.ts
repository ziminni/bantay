export interface NavItem {
  to: string
  label: string
  description: string
}

export interface NavGroup {
  label?: string
  items: NavItem[]
}

/** The sidebar. The six main pages follow the project documentation. */
export const NAVIGATION: NavGroup[] = [
  {
    items: [
      { to: '/', label: 'Dashboard', description: "Today's entries and statistics" },
      { to: '/live', label: 'Live View', description: 'Camera feeds' },
      { to: '/enroll', label: 'Enroll', description: 'Register a face' },
      { to: '/logs', label: 'Entry Logs', description: 'Search entry history' },
    ],
  },
  {
    label: 'Manage',
    items: [
      { to: '/users', label: 'Users', description: 'Students, faculty and staff' },
      { to: '/labs', label: 'Labs', description: 'Laboratories and cameras' },
    ],
  },
  {
    label: 'Tools',
    items: [{ to: '/tools/recognition', label: 'Test Recognition', description: 'Check matching on a photo' }],
  },
]

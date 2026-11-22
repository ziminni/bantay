import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { LoadingState } from '@/components/ui/LoadingState'
import { ToastProvider } from '@/components/ui/Toast'
import { NotFoundPage } from '@/features/not-found/NotFoundPage'

// Each page is loaded only when it is first visited, so the first load stays small.
const router = createBrowserRouter([
  {
    element: <AppLayout />,
    hydrateFallbackElement: <LoadingState />,
    children: [
      { index: true, lazy: () => import('@/features/dashboard/DashboardPage').then((m) => ({ Component: m.DashboardPage })) },
      { path: 'live', lazy: () => import('@/features/live-view/LiveViewPage').then((m) => ({ Component: m.LiveViewPage })) },
      { path: 'enroll', lazy: () => import('@/features/enroll/EnrollPage').then((m) => ({ Component: m.EnrollPage })) },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])

export default function App() {
  return (
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>
  )
}

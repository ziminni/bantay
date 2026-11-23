import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { LoadingState } from '@/components/ui/LoadingState'
import { ToastProvider } from '@/components/ui/Toast'
import { NotFoundPage } from '@/features/not-found/NotFoundPage'

// Each page is loaded only when it is first visited, so the first load stays small.
const router = createBrowserRouter([
  // The public landing page, with the login dialog.
  {
    path: '/',
    hydrateFallbackElement: <LoadingState />,
    lazy: () => import('@/features/landing/LandingPage').then((m) => ({ Component: m.LandingPage })),
  },
  {
    element: <AppLayout />,
    hydrateFallbackElement: <LoadingState />,
    children: [
      { path: 'dashboard', lazy: () => import('@/features/dashboard/DashboardPage').then((m) => ({ Component: m.DashboardPage })) },
      { path: 'live', lazy: () => import('@/features/live-view/LiveViewPage').then((m) => ({ Component: m.LiveViewPage })) },
      { path: 'wall', lazy: () => import('@/features/camera-wall/CameraWallPage').then((m) => ({ Component: m.CameraWallPage })) },
      { path: 'wall/:labId', lazy: () => import('@/features/camera-wall/LabWallPage').then((m) => ({ Component: m.LabWallPage })) },
      { path: 'enroll', lazy: () => import('@/features/enroll/EnrollPage').then((m) => ({ Component: m.EnrollPage })) },
      { path: 'logs', lazy: () => import('@/features/entry-logs/LogsPage').then((m) => ({ Component: m.LogsPage })) },
      { path: 'users', lazy: () => import('@/features/users/UsersPage').then((m) => ({ Component: m.UsersPage })) },
      { path: 'users/:id', lazy: () => import('@/features/users/UserDetailPage').then((m) => ({ Component: m.UserDetailPage })) },
      { path: 'labs', lazy: () => import('@/features/labs/LabsPage').then((m) => ({ Component: m.LabsPage })) },
      { path: 'labs/:id', lazy: () => import('@/features/labs/LabDetailPage').then((m) => ({ Component: m.LabDetailPage })) },
      {
        path: 'tools/recognition',
        lazy: () => import('@/features/recognition/RecognitionTestPage').then((m) => ({ Component: m.RecognitionTestPage })),
      },
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

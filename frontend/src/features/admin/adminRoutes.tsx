import { lazy } from 'react'
import { Navigate, type RouteObject } from 'react-router-dom'

// The /admin subtree (mezo-d5iy.9) — the codebase's FIRST lazy chunk (React.lazy did not
// exist anywhere in frontend/src before this task). AdminLayout and every admin page only
// import each other and the shared kit, so they all land in one chunk that the mobile PWA
// never downloads (vite.config.ts's route-splitting follow-up, noted beside the raised
// workbox precache limit, is exactly this).
//
// Task 11 adds Userek/User részlet/Feature-használat. Task 12 adds Adatböngésző. `AdminCostPage`
// and `AdminAccountsPage` (plus the `cost/:id` detail route) arrive in Task 13 — until then a
// `*` catch-all sends any of those paths back to the index page rather than 404ing or failing
// to compile.
const AdminLayout = lazy(() =>
  import('@/features/admin/AdminLayout').then((m) => ({ default: m.AdminLayout })))
const AdminOverviewPage = lazy(() =>
  import('@/features/admin/pages/AdminOverviewPage').then((m) => ({ default: m.AdminOverviewPage })))
const AdminUsersPage = lazy(() =>
  import('@/features/admin/pages/AdminUsersPage').then((m) => ({ default: m.AdminUsersPage })))
const AdminUserDetailPage = lazy(() =>
  import('@/features/admin/pages/AdminUserDetailPage').then((m) => ({ default: m.AdminUserDetailPage })))
const AdminUsagePage = lazy(() =>
  import('@/features/admin/pages/AdminUsagePage').then((m) => ({ default: m.AdminUsagePage })))
const AdminDataPage = lazy(() =>
  import('@/features/admin/pages/AdminDataPage').then((m) => ({ default: m.AdminDataPage })))

export const adminRoutes: RouteObject[] = [
  {
    path: '/admin',
    element: <AdminLayout />,
    children: [
      { index: true, element: <AdminOverviewPage /> },
      { path: 'users', element: <AdminUsersPage /> },
      { path: 'users/:id', element: <AdminUserDetailPage /> },
      { path: 'usage', element: <AdminUsagePage /> },
      { path: 'data', element: <AdminDataPage /> },
      // Task 13 registers: cost, cost/:id, accounts.
      { path: '*', element: <Navigate to="/admin" replace /> },
    ],
  },
]

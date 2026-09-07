import { lazy } from 'react'
import { Navigate, type RouteObject } from 'react-router-dom'

// The /admin subtree (mezo-d5iy.9) — the codebase's FIRST lazy chunk (React.lazy did not
// exist anywhere in frontend/src before this task). AdminLayout and every admin page only
// import each other and the shared kit, so they all land in one chunk that the mobile PWA
// never downloads (vite.config.ts's route-splitting follow-up, noted beside the raised
// workbox precache limit, is exactly this).
//
// Only routes whose pages exist today are registered. `AdminUsersPage`, `AdminUsagePage`,
// `AdminCostPage`, `AdminDataPage` and `AdminAccountsPage` (plus the `:id` detail routes)
// arrive in Tasks 11-13 — until then a `*` catch-all sends any of those paths back to the
// index page rather than 404ing or failing to compile.
const AdminLayout = lazy(() =>
  import('@/features/admin/AdminLayout').then((m) => ({ default: m.AdminLayout })))
const AdminOverviewPage = lazy(() =>
  import('@/features/admin/pages/AdminOverviewPage').then((m) => ({ default: m.AdminOverviewPage })))

export const adminRoutes: RouteObject[] = [
  {
    path: '/admin',
    element: <AdminLayout />,
    children: [
      { index: true, element: <AdminOverviewPage /> },
      // Tasks 11-13 register: users, users/:id, usage, cost, cost/:id, data, accounts.
      { path: '*', element: <Navigate to="/admin" replace /> },
    ],
  },
]

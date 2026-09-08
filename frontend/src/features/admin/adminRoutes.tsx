import { lazy } from 'react'
import { Navigate, type RouteObject } from 'react-router-dom'

// The /admin subtree (mezo-d5iy.9) — the codebase's FIRST lazy chunk (React.lazy did not
// exist anywhere in frontend/src before this task). AdminLayout and every admin page only
// import each other and the shared kit, so they all land in one chunk that the mobile PWA
// never downloads (vite.config.ts's route-splitting follow-up, noted beside the raised
// workbox precache limit, is exactly this).
//
// Task 11 adds Userek/User részlet/Feature-használat. Task 12 adds Adatböngésző. Task 13 moves
// the two pre-existing owner-only pages (the mobile AI-napló + Beta admin, both formerly under
// `/me/*`) in as `AdminCostPage`/`AdminCostDetailPage`/`AdminAccountsPage` — a move, not a
// rewrite, so they keep their mobile-shaped bodies for v1; only their routing changed.
const AdminLayout = lazy(() =>
  import('@/features/admin/AdminLayout').then((m) => ({ default: m.AdminLayout })))
const AdminOverviewPage = lazy(() =>
  import('@/features/admin/pages/AdminOverviewPage').then((m) => ({ default: m.AdminOverviewPage })))
const AdminUsersPage = lazy(() =>
  import('@/features/admin/pages/AdminUsersPage').then((m) => ({ default: m.AdminUsersPage })))
const AdminUserDetailPage = lazy(() =>
  import('@/features/admin/pages/AdminUserDetailPage').then((m) => ({ default: m.AdminUserDetailPage })))
const AdminMemoryPage = lazy(() =>
  import('@/features/admin/memory/AdminMemoryPage').then((m) => ({ default: m.AdminMemoryPage })))
const AdminFeaturesPage = lazy(() =>
  import('@/features/admin/pages/AdminFeaturesPage').then((m) => ({ default: m.AdminFeaturesPage })))
const AdminDataPage = lazy(() =>
  import('@/features/admin/pages/AdminDataPage').then((m) => ({ default: m.AdminDataPage })))
const AdminCostPage = lazy(() =>
  import('@/features/admin/pages/AdminCostPage').then((m) => ({ default: m.AdminCostPage })))
const AdminCostDetailPage = lazy(() =>
  import('@/features/admin/pages/AdminCostDetailPage').then((m) => ({ default: m.AdminCostDetailPage })))
const AdminAccountsPage = lazy(() =>
  import('@/features/admin/pages/AdminAccountsPage').then((m) => ({ default: m.AdminAccountsPage })))

export const adminRoutes: RouteObject[] = [
  {
    path: '/admin',
    element: <AdminLayout />,
    children: [
      { index: true, element: <AdminOverviewPage /> },
      { path: 'users', element: <AdminUsersPage /> },
      { path: 'users/:id', element: <AdminUserDetailPage /> },
      { path: 'users/:id/memory', element: <AdminMemoryPage /> },
      // Funkciók (mezo-kxnn) replaces the Feature-használat matrix page; /admin/usage is a
      // bookmark-preserving redirect, not a live route.
      { path: 'features', element: <AdminFeaturesPage /> },
      { path: 'usage', element: <Navigate to="/admin/features" replace /> },
      { path: 'data', element: <AdminDataPage /> },
      { path: 'cost', element: <AdminCostPage /> },
      { path: 'cost/:id', element: <AdminCostDetailPage /> },
      { path: 'accounts', element: <AdminAccountsPage /> },
      { path: '*', element: <Navigate to="/admin" replace /> },
    ],
  },
]

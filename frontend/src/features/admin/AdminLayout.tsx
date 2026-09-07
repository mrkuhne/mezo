import { Suspense, useEffect } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useMe } from '@/data/hooks'
import { AdminRail } from '@/features/admin/AdminRail'
import { ClaySprites } from '@/shared/ui/clay'
import { ErrorBoundary } from '@/shared/ui/ErrorBoundary'
import { ToastProvider } from '@/shared/ui/ToastProvider'
import { emitToast } from '@/shared/lib/toastBus'

// The /admin desktop shell (mezo-d5iy.9) — a SIBLING of AppLayout, not a child of it
// (see adminRoutes.tsx / router.tsx): left rail + Outlet, no PhoneFrame, no TabBar, no
// QuickLogFab/AppHeader/CircadianTheme/LevelUpProvider/TutorialProvider/MezoThreadProvider —
// those are the phone-shell's furniture, and the admin surface is a desktop mosaic instead.
//
// Two things AppLayout gets for free that this layout must supply itself, because both are
// mounted ONLY by AppLayout today and the two route trees are mutually exclusive (never both
// mounted at once, so no duplicate-DOM-id risk):
//  - <ClaySprites/> — the only mount point for the clay <symbol> defs; every ClayIcon's
//    <use> resolves against it, so AdminRail's icons would render empty boxes without it.
//  - <ToastProvider/> — useToast() itself works providerless (falls back to the toastBus),
//    but nothing RENDERS a toast without a host mounted somewhere above the caller.
export function AdminLayout() {
  return (
    <ToastProvider>
      <AdminLayoutInner />
    </ToastProvider>
  )
}

function AdminLayoutInner() {
  const me = useMe()
  const navigate = useNavigate()
  const location = useLocation()
  const isOwner = me.data?.role === 'OWNER'

  useEffect(() => {
    // `me.data` is undefined in real mode until the fetch resolves (`useMe` doc comment,
    // authHooks.ts) — gate on `me.isPending` too so a legitimate OWNER never gets bounced
    // during that window, and a non-owner never sees admin content in the meantime either
    // (the render below already withholds the Outlet while `!me.data`).
    //
    // `emitToast` (not `useToast().show`) deliberately: `ToastProvider`'s context value is
    // a fresh `{ show }` object literal on every one of ITS renders (ToastProvider.tsx), so
    // putting the hook's return value in this effect's deps re-fires it every time the toast
    // host itself re-renders — an infinite show-toast loop the very first time this branch
    // is taken. `emitToast` is the same stable function `useToast()`'s provider-less fallback
    // already routes through, so behavior is identical without the unstable dependency.
    if (!me.isPending && me.data && !isOwner) {
      emitToast({ kind: 'error', text: 'Ehhez a felülethez nincs jogosultságod.' })
      navigate('/', { replace: true })
    }
  }, [me.isPending, me.data, isOwner, navigate])

  // Nothing to show yet (fetch pending) or the redirect effect above is about to fire —
  // either way, don't paint the rail/outlet for a non-owner or a still-unknown account.
  if (!me.data || !isOwner) return null

  return (
    <div className="ad-shell">
      <ClaySprites />
      <AdminRail />
      <main className="ad-main">
        {/* Tab-level boundary, matching AppLayout's: a crashed admin page degrades to a
            fallback card without blanking the whole shell, and navigating away
            (resetKey) recovers automatically. */}
        <ErrorBoundary resetKey={location.pathname}>
          <Suspense fallback={<div className="ad-loading">Betöltés…</div>}>
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </main>
    </div>
  )
}

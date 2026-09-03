import { Outlet, useLocation } from 'react-router-dom'
import { AppHeader } from '@/app/AppHeader'
import { CircadianTheme } from '@/app/CircadianTheme'
import { FloatingReturnLayer } from '@/app/FloatingReturnLayer'
import { PhoneFrame } from '@/app/PhoneFrame'
import { QuickLogFab } from '@/app/QuickLogFab'
import { ScreenContent } from '@/app/ScreenContent'
import { TabBar } from '@/app/TabBar'
import { LevelUpProvider } from '@/features/progression/LevelUpProvider'
import { TutorialProvider } from '@/features/tutorial/TutorialProvider'
import { MezoThreadProvider } from '@/features/today/MezoThreadProvider'
import { ClaySprites } from '@/shared/ui/clay'
import { ErrorBoundary } from '@/shared/ui/ErrorBoundary'
import { ToastProvider } from '@/shared/ui/ToastProvider'
import { useTodayScenario, useScheduleSnapshotWriter } from '@/data/hooks'

export function AppLayout() {
  const scenario = useTodayScenario()
  // App-open notification-schedule snapshot (N3, bd mezo-h4wp.6.3): AppLayout is the root
  // route element (children of `/`) and, unlike a page under the Outlet, mounts exactly once
  // for the whole app session — nested route changes only swap the Outlet's child, never
  // remount this component. It already sits inside QueryProvider's QueryClientProvider (see
  // main.tsx), so a data hook can be called here directly. Real-mode-only, fire-and-forget,
  // once per mount — see notificationScheduleWriter.ts for the full rationale.
  useScheduleSnapshotWriter()
  const location = useLocation()
  const anchor = scenario.anchorMode && location.pathname.startsWith('/nap')
  // Full-screen surfaces where the app chrome is dead weight: the active workout session,
  // the extra-dark night page (its light would defeat the <30 lux point), and the
  // Napzárás ritual flow (mezo-ilsj). No header, no tab bar, no FAB.
  const hideChrome = ['/train/session', '/me/sleep/night', '/ritual'].includes(location.pathname)
  // mezo-vdf4: the chat's composer owns the thumb zone — the coral FAB overlapped the
  // send disc there. Chat keeps the rest of the chrome (header, tab bar).
  // mezo-bq2t: /fuel/log/uj is the same situation — its sticky save bar owns the thumb zone
  // (measured: the FAB sat right on top of it), and a "quick log" FAB on the logging page
  // itself is redundant anyway. Same deal: header and tab bar stay.
  const hideFab = hideChrome || ['/mezo/chat', '/fuel/log/uj'].includes(location.pathname)
  return (
    <>
      <CircadianTheme />
      {/* Clay sprite defs — mounted once so every ClayIcon/ClaySpot <use> resolves. */}
      <ClaySprites />
      <PhoneFrame anchor={anchor}>
        <ToastProvider>
          <LevelUpProvider>
            {/* Mezo-kalauz motor (mezo-gb1s.1): egy példány, route-váltásra dönt, a sheetet ide
                portálja (.phone-screen). A fejléc „?" gombja és a Beállítások ugyanezt a
                contextet hívja. */}
            <TutorialProvider>
              {/* A mezo-szál EGY példánya a fejlécnek és az /nap/uzenetek oldalnak (mezo-atry):
                  a fejléc az Outlet ELŐTTI testvér, tehát a két fogyasztó csak közös
                  ősként osztozhat a szálon — így az olvasatlan-vízjel is közös. */}
              <MezoThreadProvider>
                <ScreenContent>
                  {/* A fejléc a shellé, nem az oldalaké (mezo-atry): egy példány, minden
                      oldalon ugyanaz. A scrollerben ÜL, de mostantól kitapad (mezo-8az6,
                      position: sticky) — a tartalom görög alatta, ő maga a görgetőport
                      tetején marad. */}
                  {!hideChrome && <AppHeader />}
                  {/* Tab-level boundary: a crashed page degrades to a fallback card; the chrome
                      (TabBar) stays usable and navigating away (resetKey) recovers. */}
                  <ErrorBoundary resetKey={location.pathname}>
                    <Outlet />
                  </ErrorBoundary>
                </ScreenContent>
              </MezoThreadProvider>
            </TutorialProvider>
            {!hideChrome && <TabBar />}
            {/* Decision B (mezo-d20.1.1): quick log = floating coral FAB, present on
                every tab, absent on the chrome-free full-screen flows. */}
            {!hideFab && <QuickLogFab />}
            <FloatingReturnLayer />
          </LevelUpProvider>
        </ToastProvider>
      </PhoneFrame>
    </>
  )
}

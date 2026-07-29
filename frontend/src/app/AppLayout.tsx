import { Outlet, useLocation } from 'react-router-dom'
import { CircadianTheme } from '@/app/CircadianTheme'
import { PhoneFrame } from '@/app/PhoneFrame'
import { ScreenContent } from '@/app/ScreenContent'
import { TabBar } from '@/app/TabBar'
import { LevelUpProvider } from '@/features/progression/LevelUpProvider'
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
  const anchor = scenario.anchorMode && location.pathname.startsWith('/today')
  // Full-screen surfaces where the tab bar is dead chrome: the active workout session,
  // the extra-dark night page (its light would defeat the <30 lux point), and the
  // Napzárás ritual flow (mezo-ilsj).
  const hideTabBar = ['/train/session', '/me/sleep/night', '/ritual'].includes(location.pathname)
  return (
    <>
      <CircadianTheme />
      <PhoneFrame anchor={anchor}>
        <ToastProvider>
          <LevelUpProvider>
            <ScreenContent>
              {/* Tab-level boundary: a crashed page degrades to a fallback card; the chrome
                  (TabBar) stays usable and navigating away (resetKey) recovers. */}
              <ErrorBoundary resetKey={location.pathname}>
                <Outlet />
              </ErrorBoundary>
            </ScreenContent>
            {!hideTabBar && <TabBar />}
          </LevelUpProvider>
        </ToastProvider>
      </PhoneFrame>
    </>
  )
}

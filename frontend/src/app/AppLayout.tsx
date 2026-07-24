import { Outlet, useLocation } from 'react-router-dom'
import { PhoneFrame } from '@/app/PhoneFrame'
import { LiveActivityProvider } from '@/app/providers/LiveActivityProvider'
import { ScreenContent } from '@/app/ScreenContent'
import { TabBar } from '@/app/TabBar'
import { LevelUpProvider } from '@/features/progression/LevelUpProvider'
import { ErrorBoundary } from '@/shared/ui/ErrorBoundary'
import { ToastProvider } from '@/shared/ui/ToastProvider'
import { useTodayScenario } from '@/data/hooks'

export function AppLayout() {
  const scenario = useTodayScenario()
  const location = useLocation()
  const anchor = scenario.anchorMode && location.pathname.startsWith('/today')
  // Full-screen surfaces where the tab bar is dead chrome: the active workout session
  // and the extra-dark night page (its light would defeat the <30 lux point).
  const hideTabBar = ['/train/session', '/me/sleep/night'].includes(location.pathname)
  return (
    <LiveActivityProvider>
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
    </LiveActivityProvider>
  )
}

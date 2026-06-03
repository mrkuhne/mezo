import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { PhoneFrame } from './PhoneFrame'
import { ScreenContent } from './ScreenContent'
import { TabBar } from './TabBar'
import { Fab } from './Fab'
import { QuickInputSheet } from '@/features/quickinput/QuickInputSheet'
import { useTodayScenario } from '@/data/hooks'

export function AppLayout() {
  const [quickOpen, setQuickOpen] = useState(false)
  const scenario = useTodayScenario()
  const location = useLocation()
  const anchor = scenario.anchorMode && location.pathname.startsWith('/today')
  return (
    <PhoneFrame anchor={anchor}>
      <ScreenContent>
        <Outlet />
      </ScreenContent>
      <Fab onClick={() => setQuickOpen(true)} />
      {quickOpen && <QuickInputSheet onClose={() => setQuickOpen(false)} />}
      <TabBar />
    </PhoneFrame>
  )
}

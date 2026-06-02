import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { PhoneFrame } from './PhoneFrame'
import { ScreenContent } from './ScreenContent'
import { TabBar } from './TabBar'
import { Fab } from './Fab'
import { Sheet } from '@/components/ui/Sheet'

export function AppLayout() {
  const [quickOpen, setQuickOpen] = useState(false)
  return (
    <PhoneFrame>
      <ScreenContent>
        <Outlet />
      </ScreenContent>
      <Fab onClick={() => setQuickOpen(true)} />
      {quickOpen && (
        <Sheet onClose={() => setQuickOpen(false)}>
          <p>QuickInput placeholder</p>
        </Sheet>
      )}
      <TabBar />
    </PhoneFrame>
  )
}

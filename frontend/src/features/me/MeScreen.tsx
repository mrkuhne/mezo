import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { MeSubNav } from '@/features/me/MeSubNav'
import { SettingsSheet } from '@/features/me/SettingsSheet'

export type MeOutletContext = { openSettings: () => void }

export function MeScreen() {
  const [settingsOpen, setSettingsOpen] = useState(false)
  return (
    <>
      <MeSubNav />
      <Outlet context={{ openSettings: () => setSettingsOpen(true) } satisfies MeOutletContext} />
      {settingsOpen && <SettingsSheet onClose={() => setSettingsOpen(false)} />}
    </>
  )
}

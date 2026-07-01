import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { MeSubNav } from '@/features/me/pages/MeSubNav'
import { SettingsSheet } from '@/features/me/sheets/SettingsSheet'

export type MeOutletContext = { openSettings: () => void }

export function MeSection() {
  const [settingsOpen, setSettingsOpen] = useState(false)
  return (
    <>
      <MeSubNav />
      <Outlet context={{ openSettings: () => setSettingsOpen(true) } satisfies MeOutletContext} />
      {settingsOpen && <SettingsSheet onClose={() => setSettingsOpen(false)} />}
    </>
  )
}

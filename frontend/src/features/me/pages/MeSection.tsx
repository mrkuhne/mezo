import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { MeHead } from '@/features/me/components/MeHead'
import { MeSubNav } from '@/features/me/pages/MeSubNav'
import { SettingsSheet } from '@/features/me/sheets/SettingsSheet'

export function MeSection() {
  const [settingsOpen, setSettingsOpen] = useState(false)
  return (
    <>
      <MeHead onOpenSettings={() => setSettingsOpen(true)} />
      <MeSubNav />
      <Outlet />
      {settingsOpen && <SettingsSheet onClose={() => setSettingsOpen(false)} />}
    </>
  )
}

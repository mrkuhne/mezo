import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { AppHero } from '@/features/progression/components/AppHero'
import { MeSubNav } from '@/features/me/pages/MeSubNav'
import { SettingsSheet } from '@/features/me/sheets/SettingsSheet'
import { Icon } from '@/shared/ui/Icon'

export function MeSection() {
  const [settingsOpen, setSettingsOpen] = useState(false)
  return (
    <>
      <AppHero
        utilities={
          <button
            type="button"
            className="icon-btn np-press"
            onClick={() => setSettingsOpen(true)}
            aria-label="Beállítások"
          >
            <Icon name="settings" size={16} />
          </button>
        }
      />
      <MeSubNav />
      <Outlet />
      {settingsOpen && <SettingsSheet onClose={() => setSettingsOpen(false)} />}
    </>
  )
}

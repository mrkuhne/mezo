import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { AppHero } from '@/features/progression/components/AppHero'
import { ME_TABS } from '@/features/me/pages/tabs'
import { SettingsSheet } from '@/features/me/sheets/SettingsSheet'
import { Icon } from '@/shared/ui/Icon'
import { SubNavDropdown } from '@/shared/ui/SubNavDropdown'

export function MeSection() {
  const [settingsOpen, setSettingsOpen] = useState(false)
  return (
    <>
      <AppHero
        utilities={
          <SubNavDropdown
            label="Me alnavigáció"
            items={ME_TABS}
            accent="var(--lav-deep)"
            extraAction={{
              label: 'Beállítások',
              icon: <Icon name="settings" size={14} />,
              onSelect: () => setSettingsOpen(true),
            }}
          />
        }
      />
      <Outlet />
      {settingsOpen && <SettingsSheet onClose={() => setSettingsOpen(false)} />}
    </>
  )
}

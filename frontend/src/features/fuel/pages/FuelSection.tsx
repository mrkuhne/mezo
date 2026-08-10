import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { AppHero } from '@/features/progression/components/AppHero'
import { FUEL_TABS } from '@/features/fuel/pages/tabs'
import { FuelSettingsSheet } from '@/features/fuel/sheets/FuelSettingsSheet'
import { Icon } from '@/shared/ui/Icon'
import { SubNavDropdown } from '@/shared/ui/SubNavDropdown'

// Fuel-beállítások entry point (mezo-c9t5 — the keret-hero iteration): the retired `KeretBelt`'s
// own "szerkeszt ›" trigger moves here, the Me `SubNavDropdown` `extraAction` pattern
// (`features/me/pages/MeSection.tsx`) — `KeretHero` carries no settings entry of its own.
export function FuelSection() {
  const [settingsOpen, setSettingsOpen] = useState(false)
  return (
    <>
      <AppHero
        utilities={
          <SubNavDropdown
            label="Fuel alnavigáció"
            items={FUEL_TABS}
            accent="var(--sage-deep)"
            extraAction={{
              label: 'Fuel-beállítások',
              icon: <Icon name="settings" size={14} />,
              onSelect: () => setSettingsOpen(true),
            }}
          />
        }
      />
      <Outlet />
      {settingsOpen && <FuelSettingsSheet onClose={() => setSettingsOpen(false)} />}
    </>
  )
}

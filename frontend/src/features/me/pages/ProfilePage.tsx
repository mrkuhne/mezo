import { useState } from 'react'
import { Eyebrow } from '@/shared/ui/Eyebrow'
import { PageTitle } from '@/shared/ui/PageTitle'
import { Icon } from '@/shared/ui/Icon'
import { useBiometricProfile, useProgressionProfile } from '@/data/hooks'
import { BiometricCard } from '@/features/me/components/BiometricCard'
import { AthleticRadarCard } from '@/features/me/components/AthleticRadarCard'
import { MuscleLevelsCard } from '@/features/me/components/MuscleLevelsCard'
import { GrowthCard } from '@/features/me/components/GrowthCard'
import { BiometricSheet } from '@/features/me/sheets/BiometricSheet'

export function ProfilePage({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { profile: biometric } = useBiometricProfile()
  const { data: progression } = useProgressionProfile()
  const [sheet, setSheet] = useState<'biometric' | null>(null)

  return (
    <>
      {/* Header */}
      <div className="page-header">
        <div>
          <Eyebrow brand>Me</Eyebrow>
          <PageTitle className="mt-sm">Profil</PageTitle>
        </div>
        <button className="chip" onClick={onOpenSettings} aria-label="Beállítások">
          <Icon name="settings" size={12} />
        </button>
      </div>

      {/* Biometria (base-TDEE source, G6) + the gamified progression cards (P6,
          mezo-xje5): athletic radar + muscle levels + the LIFE growth octagon +
          computed traits (E2, mezo-jzca). Each ghosts before any XP. */}
      <div style={{ padding: '8px 24px 24px' }}>
        <div className="col gap-md">
          <BiometricCard profile={biometric} onEdit={() => setSheet('biometric')} />
          <AthleticRadarCard profile={progression} />
          <MuscleLevelsCard profile={progression} />
          <GrowthCard profile={progression} />
        </div>
      </div>

      {sheet === 'biometric' && (
        <BiometricSheet onClose={() => setSheet(null)} profile={biometric} />
      )}
    </>
  )
}

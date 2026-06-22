import { useState } from 'react'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { PageTitle } from '@/components/ui/PageTitle'
import { Icon } from '@/components/ui/Icon'
import { useBiometricProfile } from '@/data/hooks'
import { BiometricCard } from '../components/BiometricCard'
import { BiometricSheet } from '../BiometricSheet'

export function ProfileView({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { profile: biometric } = useBiometricProfile()
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

      {/* Biometria — the only backend-backed Profile surface; the engine computes
          the base-TDEE from it (G6, mezo-06n). Edits open the BiometricSheet. */}
      <div style={{ padding: '8px 24px 24px' }}>
        <BiometricCard profile={biometric} onEdit={() => setSheet('biometric')} />
      </div>

      {sheet === 'biometric' && (
        <BiometricSheet onClose={() => setSheet(null)} profile={biometric} />
      )}
    </>
  )
}

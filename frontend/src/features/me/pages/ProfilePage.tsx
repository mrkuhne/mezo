import { useState } from 'react'
import { useBiometricProfile, useProgressionProfile } from '@/data/hooks'
import { GoalMiniCard } from '@/features/me/components/GoalMiniCard'
import { BiometricCard } from '@/features/me/components/BiometricCard'
import { GrowthSummaryCard } from '@/features/me/components/GrowthSummaryCard'
import { BiometricSheet } from '@/features/me/sheets/BiometricSheet'

export function ProfilePage() {
  const { profile: biometric } = useBiometricProfile()
  const { data: progression } = useProgressionProfile()
  const [sheet, setSheet] = useState<'biometric' | null>(null)

  return (
    <>
      {/* Goal mini-track (spec §4.6, first) + Biometria (base-TDEE source, G6) + a
          single Growth summary card. The full athletic/muscle/LIFE detail moved to
          the dedicated /me/growth page; the three profile radar/level cards were
          consolidated into GrowthSummaryCard, whose whole surface opens that page
          (mezo-rmhr). GoalMiniCard renders null without an active goal; both
          GrowthSummaryCard/BiometricCard ghost before any XP/profile. */}
      <div style={{ padding: '8px 24px 24px' }}>
        <div className="col gap-md">
          <GoalMiniCard />
          <BiometricCard profile={biometric} onEdit={() => setSheet('biometric')} />
          <GrowthSummaryCard profile={progression} />
        </div>
      </div>

      {sheet === 'biometric' && (
        <BiometricSheet onClose={() => setSheet(null)} profile={biometric} />
      )}
    </>
  )
}

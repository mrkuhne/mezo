import { useBiometricProfile, useWeight } from '@/data/hooks'
import { ageFromBirthDate } from '@/features/me/logic/biometricFields'
import { hu1 } from '@/shared/lib/huNum'

/** One-line biometrics (was MeHead's .t2; the AppHero header is biometrics-free). */
export function MeBioRow() {
  const { profile } = useBiometricProfile()
  const { weightLog } = useWeight()
  const latestKg = weightLog.length ? weightLog[weightLog.length - 1].value : null
  const bits = [
    profile ? `${ageFromBirthDate(profile.birthDate)} év` : null,
    profile ? `${profile.heightCm} cm` : null,
    latestKg != null ? `${hu1(latestKg)} kg` : null,
    profile?.bodyFatPct != null ? `${profile.bodyFatPct}%` : null,
  ].filter(Boolean)
  if (bits.length === 0) return null
  return (
    <div className="me-biorow" style={{ fontSize: 12.5, color: 'var(--sub)', fontWeight: 600 }}>
      {bits.join(' · ')}
    </div>
  )
}

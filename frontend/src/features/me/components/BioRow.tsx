// Mezo · BioRow — the biometrics line (`34 év · 180 cm · …` → /settings/me/biometrics),
// extracted from EnHubPage (mezo-lhqw7). Body data: it lives at the bottom of both Test views.
import { useLocation, useNavigate } from 'react-router-dom'
import { useBiometricProfile, useWeight } from '@/data/hooks'
import { ageFromBirthDate } from '@/features/me/logic/biometricFields'
import { hu1 } from '@/shared/lib/huNum'

export function BioRow() {
  const navigate = useNavigate()
  const location = useLocation()
  const { profile: biometric } = useBiometricProfile()
  const { weightLog } = useWeight()
  const latestKg = weightLog.length > 0 ? weightLog[weightLog.length - 1].value : null
  // MeBioRow's rule, verbatim: `·`-joined non-null bits, nothing at zero bits. Each bit is
  // guarded on its OWN field rather than on `biometric` alone (mezo-5cmq): the contract types
  // every profile field nullable, so an unguarded read would print „null cm".
  const bioBits = [
    biometric?.birthDate ? `${ageFromBirthDate(biometric.birthDate)} év` : null,
    biometric?.heightCm != null ? `${biometric.heightCm} cm` : null,
    latestKg != null ? `${hu1(latestKg)} kg` : null,
    biometric?.bodyFatPct != null ? `${biometric.bodyFatPct}% testzsír` : null,
  ].filter((b): b is string => b !== null)
  const open = () => navigate('/settings/me/biometrics', { state: { from: location.pathname + location.search } })

  return bioBits.length > 0 ? (
    <button type="button" className="ent-bio" aria-label="Biometria szerkesztése" onClick={open}>
      {bioBits.join(' · ')}
    </button>
  ) : (
    /* zero bits: the bio line itself vanishes (MeBioRow's contract) — but the biometrics write
       path must not vanish with it, so the row carries BiometricCard's empty-state CTA copy. */
    <button type="button" className="ent-bio" onClick={open}>
      Állítsd be a biometriád
    </button>
  )
}

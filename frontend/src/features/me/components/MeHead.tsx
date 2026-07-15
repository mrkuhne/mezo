import { useProfile, useBiometricProfile, useWeight } from '@/data/hooks'
import { ageFromBirthDate } from '@/features/me/logic/biometricFields'
import { hu1 } from '@/shared/lib/huNum'
import { Icon } from '@/shared/ui/Icon'

// Me identity header (spec §4.6). Revisits the mezo-lfw "identity statics recorded,
// not wired" decision: the name is the single-user static (same in both modes) until
// a backend profile exists; the biometrics line is real-hook data (me.md §9).
export function MeHead({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { user } = useProfile()
  const { profile } = useBiometricProfile()
  const { weightLog } = useWeight()

  const initials = user.name.split(/\s+/).map((w) => w[0]).join('').toUpperCase().slice(0, 2)
  const latestKg = weightLog.length ? weightLog[weightLog.length - 1].value : null
  const bits = [
    profile ? String(ageFromBirthDate(profile.birthDate)) : null,
    profile ? `${profile.heightCm} cm` : null,
    latestKg != null ? `${hu1(latestKg)} kg` : null,
    profile?.bodyFatPct != null ? `${profile.bodyFatPct}%` : null,
  ].filter(Boolean)

  return (
    <div className="mehead">
      <div className="avatar" aria-hidden="true">{initials}</div>
      <div>
        <div className="t1">{user.name}</div>
        {bits.length > 0 && <div className="t2">{bits.join(' · ')}</div>}
      </div>
      <button type="button" className="icon-btn np-press" style={{ marginLeft: 'auto' }} onClick={onOpenSettings} aria-label="Beállítások">
        <Icon name="settings" size={16} />
      </button>
    </div>
  )
}

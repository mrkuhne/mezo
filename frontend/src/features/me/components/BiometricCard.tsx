import { Icon } from '@/shared/ui/Icon'
import type { BiometricProfileResponse } from '@/data/me/biometricProfileApi'
import { ACTIVITY_LEVELS, ACTIVITY_SHORT, ageFromBirthDate, palLabel, type ActivityLevel } from '@/features/me/logic/biometricFields'

const PAL_BY_ID = Object.fromEntries(ACTIVITY_LEVELS.map(a => [a.id, a.pal])) as Record<ActivityLevel, number>

// Resolve the activityLevel enum to its compact card label + PAL multiplier.
// Falls back to MODERATE when null/absent (the engine's default).
function resolveActivity(level: ActivityLevel | null | undefined): { label: string; pal: number } {
  const lvl = (level ?? 'MODERATE') as ActivityLevel
  return { label: ACTIVITY_SHORT[lvl], pal: PAL_BY_ID[lvl] }
}

// Biometria card on the Profile (G6, mezo-06n). Re-skinned to the Napiv .biocard
// idiom (spec §4.6, mezo-8141 Task 4): a header row (h3 + szerkesztés link) over
// a Nem/Magasság/Kor/Testzsír/Aktivitás stat grid, and the derived base-TDEE
// row (from `profile.tdeeBootstrap`, omitted when null). When no profile exists
// yet (the gate's "not set up" state) it shows a --wash-lav prompt card instead.
// `onEdit` opens the BiometricSheet either way.

function Stat({ k, children, style }: { k: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div className="bio" style={style}>
      <div className="k">{k}</div>
      <div className="v">{children}</div>
    </div>
  )
}

export function BiometricCard({
  profile,
  onEdit,
}: {
  profile: BiometricProfileResponse | null
  onEdit: () => void
}) {
  // Empty state — no profile yet: a prompt that opens the editor.
  if (!profile) {
    return (
      <button
        type="button"
        onClick={onEdit}
        className="card"
        style={{
          padding: '16px 15px',
          position: 'relative',
          overflow: 'hidden',
          width: '100%',
          textAlign: 'left',
          background: 'var(--wash-lav)',
        }}
      >
        <div className="row gap-md" style={{ alignItems: 'center' }}>
          <Icon name="sparkle" size={16} color="var(--lav-deep)" />
          <div className="col flex-1">
            <span className="eyebrow" style={{ color: 'var(--lav-deep)' }}>Biometria · TDEE</span>
            <div style={{ fontFamily: 'var(--ff-display)', fontSize: 16, marginTop: 4, color: 'var(--text-primary)' }}>
              Állítsd be a biometriád
            </div>
            <span className="text-tertiary" style={{ fontSize: 11, marginTop: 2 }}>
              Ebből számol a motor — nem · magasság · szül. dátum
            </span>
          </div>
          <Icon name="chevron-right" size={14} color="var(--text-tertiary)" />
        </div>
      </button>
    )
  }

  const sexLabel = profile.sex === 'M' ? 'Férfi' : 'Nő'
  const activity = resolveActivity(profile.activityLevel)
  const tdee = profile.tdeeBootstrap

  return (
    <div className="card biocard" style={{ padding: '14px 15px 13px' }}>
      <div className="bhd">
        <h3>Biometria</h3>
        <button type="button" onClick={onEdit}>
          szerkesztés ›
        </button>
      </div>

      <div className="biogrid">
        <Stat k="Nem">{sexLabel}</Stat>
        <Stat k="Magasság">
          {profile.heightCm} <small>cm</small>
        </Stat>
        <Stat k="Kor">
          {ageFromBirthDate(profile.birthDate)} <small>év</small>
        </Stat>
        <Stat k="Testzsír">
          {profile.bodyFatPct != null ? (
            <>
              {profile.bodyFatPct} <small>%</small>
            </>
          ) : (
            <small>—</small>
          )}
        </Stat>
        <Stat k="Aktivitás" style={{ gridColumn: '1/3' }}>
          {activity.label} <small>{palLabel(activity.pal)}</small>
        </Stat>
      </div>

      {tdee && (
        <div className="tdee">
          <span className="k">
            Alap-TDEE · {tdee.formula === 'KATCH' ? 'Katch' : 'MSJ'}
          </span>
          <span className="v">≈{Math.round(tdee.tdee)} kcal/nap</span>
        </div>
      )}
    </div>
  )
}

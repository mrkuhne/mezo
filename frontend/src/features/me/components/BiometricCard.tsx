import { Icon } from '@/shared/ui/Icon'
import type { BiometricProfileResponse } from '@/data/me/biometricProfileApi'
import { ACTIVITY_LEVELS, ACTIVITY_SHORT, ageFromBirthDate, palLabel, type ActivityLevel } from '@/features/me/biometricFields'

const PAL_BY_ID = Object.fromEntries(ACTIVITY_LEVELS.map(a => [a.id, a.pal])) as Record<ActivityLevel, number>

// Resolve the activityLevel enum to its compact card label + PAL multiplier.
// Falls back to MODERATE when null/absent (the engine's default).
function resolveActivity(level: ActivityLevel | null | undefined): { label: string; pal: number } {
  const lvl = (level ?? 'MODERATE') as ActivityLevel
  return { label: ACTIVITY_SHORT[lvl], pal: PAL_BY_ID[lvl] }
}

// Biometria card on the Profile (G6, mezo-06n). The biometric profile is a
// first-class Profile card: once set, the engine always computes the base-TDEE
// from it. Renders the validated `profile-biometria-v2` mockup — a notch-12 card
// with the brand accent bar, the sex/height/age/bodyFat/activity stat grid, and
// the derived base-TDEE line (from `profile.tdeeBootstrap`, omitted when null).
// When no profile exists yet (the gate's "not set up" state) it shows an empty
// prompt. `onEdit` opens the BiometricSheet either way.

const STAT_KEY: React.CSSProperties = {
  fontFamily: 'var(--ff-mono)',
  fontSize: 8,
  fontWeight: 600,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: 'var(--text-tertiary)',
}
const STAT_VAL: React.CSSProperties = {
  fontFamily: 'var(--ff-display)',
  fontSize: 19,
  color: 'var(--text-primary)',
  marginTop: 3,
}
const STAT_UNIT: React.CSSProperties = { fontFamily: 'var(--ff-body)', fontSize: 11, color: 'var(--text-secondary)' }

function Stat({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={STAT_KEY}>{k}</div>
      <div style={STAT_VAL}>{children}</div>
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
        className="card notch-12"
        style={{
          padding: '16px 15px',
          position: 'relative',
          overflow: 'hidden',
          width: '100%',
          textAlign: 'left',
          background: 'rgba(94, 234, 212, 0.04)',
          borderColor: 'var(--border-brand)',
        }}
      >
        <div className="row gap-md" style={{ alignItems: 'center' }}>
          <Icon name="sparkle" size={16} color="var(--brand-glow)" />
          <div className="col flex-1">
            <span className="eyebrow brand">Biometria · TDEE</span>
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
    <div className="card notch-12" style={{ padding: '14px 15px 13px', position: 'relative', overflow: 'hidden' }}>
      <span
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 3,
          background: 'linear-gradient(var(--brand-core), var(--brand-glow))',
        }}
      />
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 13 }}>
        <span className="eyebrow brand">Biometria</span>
        <button
          type="button"
          className="chip"
          onClick={onEdit}
          style={{ fontFamily: 'var(--ff-mono)', fontSize: 9, letterSpacing: '0.06em' }}
        >
          Szerkesztés ›
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '13px 16px' }}>
        <Stat k="Nem">{sexLabel}</Stat>
        <Stat k="Magasság">
          {profile.heightCm} <small style={STAT_UNIT}>cm</small>
        </Stat>
        <Stat k="Kor">
          {ageFromBirthDate(profile.birthDate)} <small style={STAT_UNIT}>év</small>
        </Stat>
        <Stat k="Testzsír">
          {profile.bodyFatPct != null ? (
            <>
              {profile.bodyFatPct} <small style={STAT_UNIT}>%</small>
            </>
          ) : (
            <small style={STAT_UNIT}>—</small>
          )}
        </Stat>
        <div>
          <div style={STAT_KEY}>Aktivitás</div>
          <div style={{ ...STAT_VAL, fontSize: 15 }}>
            {activity.label} <small style={STAT_UNIT}>{palLabel(activity.pal)}</small>
          </div>
        </div>
      </div>

      {tdee && (
        <div
          className="row"
          style={{
            marginTop: 13,
            paddingTop: 12,
            borderTop: '1px solid var(--border-subtle)',
            justifyContent: 'space-between',
            alignItems: 'baseline',
          }}
        >
          <span className="label-mono">Alap-TDEE · formula ({tdee.formula === 'KATCH' ? 'Katch' : 'MSJ'})</span>
          <span style={{ fontFamily: 'var(--ff-display)', fontSize: 20, color: 'var(--brand-glow)' }}>
            ≈{Math.round(tdee.tdee)}{' '}
            <small style={{ fontFamily: 'var(--ff-mono)', fontSize: 10, color: 'var(--text-tertiary)' }}>kcal/nap</small>
          </span>
        </div>
      )}
    </div>
  )
}

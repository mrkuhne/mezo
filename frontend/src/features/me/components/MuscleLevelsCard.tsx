import { Icon } from '@/components/ui/Icon'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { MUSCLE_LABELS } from '@/data/train'
import type { ProgressionProfileResponse, SkillLevel } from '@/lib/progressionApi'

const TOP_N = 4
const BAR_CAP = 10 // fixed level cap for the bar fill (matches the radar baseline)

const byLevelDesc = (a: SkillLevel, b: SkillLevel) =>
  b.level - a.level || b.cumulativeXp - a.cumulativeXp
const label = (skillKey: string) => MUSCLE_LABELS[skillKey] ?? skillKey

/**
 * Compact muscle-levels card: the top-N muscle groups by level + a reserve note
 * naming the lowest. Ghosts (a BiometricCard-style prompt) before any XP.
 */
export function MuscleLevelsCard({ profile }: { profile: ProgressionProfileResponse }) {
  const reduced = useReducedMotion()

  if (profile.athleteLevel == null) {
    return (
      <div
        className="card notch-12"
        style={{ padding: '16px 15px', position: 'relative', overflow: 'hidden', background: 'rgba(94, 234, 212, 0.04)', borderColor: 'var(--border-brand)' }}
      >
        <div className="row gap-md" style={{ alignItems: 'center' }}>
          <Icon name="sparkle" size={16} color="var(--brand-glow)" />
          <div className="col flex-1">
            <span className="eyebrow brand">Izom-szintek</span>
            <div style={{ fontFamily: 'var(--ff-display)', fontSize: 16, marginTop: 4 }}>Emeld a volumened</div>
            <span className="text-tertiary" style={{ fontSize: 11, marginTop: 2 }}>
              A gym-szetek volumene építi az izomcsoport-szintjeidet.
            </span>
          </div>
        </div>
      </div>
    )
  }

  const sorted = [...profile.muscle].sort(byLevelDesc)
  const top = sorted.slice(0, TOP_N)
  const lowest = sorted[sorted.length - 1]
  const restCount = Math.max(0, sorted.length - TOP_N)

  return (
    <div className="card notch-12" style={{ padding: '14px 15px 15px', position: 'relative', overflow: 'hidden' }}>
      <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: 'linear-gradient(var(--brand-core), var(--brand-primary))' }} />
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 13 }}>
        <span className="eyebrow brand">Izom-szintek</span>
        <span className="chip" style={{ fontFamily: 'var(--ff-mono)', fontSize: 9, letterSpacing: '0.06em', color: 'var(--text-tertiary)' }}>
          Mind a 13 ›
        </span>
      </div>

      <div className="col gap-sm">
        {top.map((m, i) => (
          <div key={m.skillKey} className="progress-mrow">
            <span className="progress-mrk">{String(i + 1).padStart(2, '0')}</span>
            <span className="progress-mnm">{label(m.skillKey)}</span>
            <span className="progress-mlv">Lv {m.level}</span>
            <div className="progress-mbar">
              <div
                className={`progress-mfill${reduced ? ' progress-mfill--reduced' : ''}`}
                style={{
                  ['--w' as string]: `${(Math.min(m.level, BAR_CAP) / BAR_CAP) * 100}%`,
                  ...(reduced ? { width: `${(Math.min(m.level, BAR_CAP) / BAR_CAP) * 100}%` } : { animationDelay: `${0.4 + i * 0.1}s` }),
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {restCount > 0 && lowest && (
        <div style={{ marginTop: 12, fontFamily: 'var(--ff-mono)', fontSize: 10, color: 'var(--text-tertiary)' }}>
          + {restCount} további izom · <b style={{ color: 'var(--text-secondary)' }}>{label(lowest.skillKey)} a legtöbb tartalék (Lv {lowest.level})</b>
        </div>
      )}
    </div>
  )
}

import { Icon } from '@/shared/ui/Icon'
import { useReducedMotion } from '@/shared/hooks/useReducedMotion'
import { LIFE_SKILLS, skillDisplay } from '@/features/progression/logic/levelUpMeta'
import type { ProgressionProfileResponse, SkillLevel } from '@/data/progression/progressionApi'
import { dataPolygonPoints, polarPoint, polygonPoints, radarMax } from '@/features/me/logic/radarGeometry'

const CX = 124
const CY = 124
const R = 88
const RINGS = [1, 0.66, 0.33]
const AXES = LIFE_SKILLS.length // 8 — the LIFE octagon

const byLevelDesc = (a: SkillLevel, b: SkillLevel) =>
  b.level - a.level || b.cumulativeXp - a.cumulativeXp

// text-anchor per axis position (top/bottom = middle, right = start, left = end).
function anchorFor(i: number, count: number): 'middle' | 'start' | 'end' {
  if (i === 0 || i === count / 2) return 'middle'
  return i < count / 2 ? 'start' : 'end'
}

/**
 * Growth (LIFE) card: a hand-rolled SVG octagon radar of the 8 LIFE skill levels
 * (in taxonomy order), the top-3 LIFE skills as meter rows, and two *computed*
 * behavior traits — Fegyelem (discipline) + Következetesség (consistency), never
 * self-claimed (ADR 0010). Ghosts (a BiometricCard-style prompt) before any LIFE
 * XP. Reuses AthleticRadarCard's radar chrome + the MuscleLevelsCard meter rows.
 */
export function GrowthCard({ profile }: { profile: ProgressionProfileResponse }) {
  const reduced = useReducedMotion()

  const life = profile.life ?? []

  // Ghost before any LIFE activity (empty list also .every()s to true).
  if (life.every((s) => (s?.cumulativeXp ?? 0) === 0)) {
    return (
      <div
        className="card notch-12"
        style={{ padding: '16px 15px', position: 'relative', overflow: 'hidden', background: 'rgba(94, 234, 212, 0.04)', borderColor: 'var(--border-brand)' }}
      >
        <div className="row gap-md" style={{ alignItems: 'center' }}>
          <Icon name="sparkle" size={16} color="var(--brand-glow)" />
          <div className="col flex-1">
            <span className="eyebrow brand">Growth — LIFE</span>
            <div style={{ fontFamily: 'var(--ff-display)', fontSize: 16, marginTop: 4 }}>Az élet is edzés.</div>
            <span className="text-tertiary" style={{ fontSize: 11, marginTop: 2 }}>
              Jegyezd fel az első tevékenységed a Ma nézetben — olvasás, főzés, egy hívás — és elindul a nyolc LIFE skilled.
            </span>
          </div>
        </div>
      </div>
    )
  }

  // Octagon values: the 8 LIFE levels in taxonomy order (missing row → level 1).
  const ordered = LIFE_SKILLS.map((s) => ({ ...s, row: life.find((l) => l.skillKey === s.key) }))
  const values = ordered.map((o) => o.row?.level ?? 1)
  const max = radarMax(values)

  const topSkills = [...life].sort(byLevelDesc).slice(0, 3)

  const disc = profile.traits.disciplinePct
  const weeks = profile.traits.consistencyWeeks
  const traitRows = [
    { label: 'Fegyelem', value: disc == null ? '–' : `${disc}%`, pct: disc ?? 0 },
    { label: 'Következetesség', value: `${weeks} hét`, pct: (Math.min(weeks, 12) / 12) * 100 },
  ]

  const savings = profile.savingsHuf30d

  return (
    <div className="card notch-12" style={{ padding: '14px 15px 15px', position: 'relative', overflow: 'hidden' }}>
      <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: 'linear-gradient(var(--brand-core), var(--brand-glow))' }} />
      <div className="row" style={{ marginBottom: 6 }}>
        <span className="eyebrow brand">Growth — LIFE</span>
      </div>

      <div className="col" style={{ alignItems: 'center' }}>
        {/* role=img collapses the SVG for AT, so the per-skill data lives in this sentence. */}
        <p className="sr-only">
          LIFE oktogon. {ordered.map((o) => `${o.name} Lv${o.row?.level ?? 1}`).join(', ')}.
        </p>
        <svg width="248" height="248" viewBox="0 0 248 248" style={{ overflow: 'visible' }} aria-hidden="true">
          {RINGS.map((f) => (
            <polygon key={f} className="progress-radar-grid" points={polygonPoints(CX, CY, R * f, AXES)} />
          ))}
          {ordered.map((o, i) => {
            const p = polarPoint(CX, CY, R, i, AXES)
            return <line key={o.key} className="progress-radar-axis" x1={CX} y1={CY} x2={p.x} y2={p.y} />
          })}
          <polygon
            className={`progress-radar-poly${reduced ? ' progress-radar-poly--reduced' : ''}`}
            points={dataPolygonPoints(CX, CY, R, values, max)}
          />
          {ordered.map((o, i) => {
            const p = polarPoint(CX, CY, (R * Math.min(values[i], max)) / max, i, AXES)
            return <circle key={o.key} className="progress-radar-dot" cx={p.x} cy={p.y} r={3.2} />
          })}
          {ordered.map((o, i) => {
            const lp = polarPoint(CX, CY, R + 16, i, AXES)
            return (
              <text
                key={o.key}
                className="progress-radar-label"
                x={lp.x}
                y={lp.y}
                textAnchor={anchorFor(i, AXES)}
                dominantBaseline="middle"
              >
                {o.icon}
              </text>
            )
          })}
        </svg>

        {/* Top-3 LIFE skills by (level, XP). */}
        <div className="col gap-sm" style={{ width: '100%', marginTop: 4 }}>
          {topSkills.map((row, i) => {
            const meta = skillDisplay(row.skillKey, 'LIFE')
            return (
              <div key={row.skillKey} className="progress-mrow">
                <span className="progress-mrk" aria-hidden="true">{meta.icon}</span>
                <span className="progress-mnm">{meta.name}</span>
                <span className="progress-mlv">Lv {row.level}</span>
                <div className="progress-mbar">
                  <div
                    className={`progress-mfill${reduced ? ' progress-mfill--reduced' : ''}`}
                    style={{
                      ['--w' as string]: `${row.progressPct}%`,
                      ...(reduced ? { width: `${row.progressPct}%` } : { animationDelay: `${0.4 + i * 0.1}s` }),
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>

        {/* Computed behavior traits — the numbers speak, not self-report (ADR 0010). */}
        <div className="col gap-sm" style={{ width: '100%', marginTop: 12 }}>
          {traitRows.map((t, i) => (
            <div key={t.label} className="progress-mrow">
              <span className="progress-mnm" style={{ width: 112 }}>{t.label}</span>
              <span className="progress-mlv" style={{ width: 42 }}>{t.value}</span>
              <div className="progress-mbar">
                <div
                  className={`progress-mfill${reduced ? ' progress-mfill--reduced' : ''}`}
                  style={{
                    ['--w' as string]: `${t.pct}%`,
                    ...(reduced ? { width: `${t.pct}%` } : { animationDelay: `${0.7 + i * 0.1}s` }),
                  }}
                />
              </div>
            </div>
          ))}
          {typeof savings === 'number' && savings > 0 && (
            <div className="progress-mrow" style={{ marginTop: 2 }}>
              <span className="progress-mnm" style={{ width: 'auto', flex: 1 }}>Megtakarítás (30 nap)</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--brand-glow)' }}>
                {`${savings.toLocaleString('hu-HU').replace(/[  ]/g, ' ')} Ft`}
              </span>
            </div>
          )}
          <span className="text-tertiary" style={{ fontSize: 10, marginTop: 2 }}>
            A számaid mondják ki — nem önbevallás.
          </span>
        </div>
      </div>
    </div>
  )
}

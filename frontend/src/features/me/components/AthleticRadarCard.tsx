import { Icon } from '@/components/ui/Icon'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { skillDisplay } from '@/features/progression/levelUpMeta'
import type { ProgressionProfileResponse } from '@/lib/progressionApi'
import { dataPolygonPoints, polarPoint, polygonPoints, radarMax } from './radarGeometry'

const CX = 124
const CY = 124
const R = 88
const RINGS = [1, 0.66, 0.33]

// Short axis labels (the server sends the full HU names; abbreviate for the SVG).
const AXIS_ABBR: Record<string, string> = {
  Erő: 'ERŐ',
  Robbanékonyság: 'ROBBAN.',
  Sebesség: 'SEBESSÉG',
  Állóképesség: 'ÁLLÓKÉP.',
  Mozgékonyság: 'MOZGÉK.',
  Koordináció: 'KOORD.',
}

// text-anchor per axis position (top/bottom = middle, right = start, left = end).
function anchorFor(i: number, count: number): 'middle' | 'start' | 'end' {
  if (i === 0 || i === count / 2) return 'middle'
  return i < count / 2 ? 'start' : 'end'
}

/**
 * Athletic profile card: a hand-rolled SVG hexagon radar of the 6 server-computed
 * radarAxes + an athlete-level / best-athletic / streak stat row. Ghosts (a
 * BiometricCard-style prompt) before any XP. Reuses the P5 useReducedMotion gate.
 */
export function AthleticRadarCard({ profile }: { profile: ProgressionProfileResponse }) {
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
            <span className="eyebrow brand">Atlétikai profil</span>
            <div style={{ fontFamily: 'var(--ff-display)', fontSize: 16, marginTop: 4 }}>Kezdj el edzeni</div>
            <span className="text-tertiary" style={{ fontSize: 11, marginTop: 2 }}>
              Minden logolt edzés XP-t ad a skilljeidnek — a profilod innen épül.
            </span>
          </div>
        </div>
      </div>
    )
  }

  const axes = profile.radarAxes
  const values = axes.map((a) => a.value)
  const max = radarMax(values)
  const best = profile.highlights.bestAthletic
  const bestMeta = best ? skillDisplay(best.skillKey, 'ATHLETIC') : null

  return (
    <div className="card notch-12" style={{ padding: '14px 15px 15px', position: 'relative', overflow: 'hidden' }}>
      <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: 'linear-gradient(var(--brand-core), var(--brand-glow))' }} />
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span className="eyebrow brand">Atlétikai profil</span>
        <span className="chip" style={{ fontFamily: 'var(--ff-mono)', fontSize: 9, letterSpacing: '0.06em', color: 'var(--text-tertiary)' }}>
          Teljes profil ›
        </span>
      </div>

      <div className="col" style={{ alignItems: 'center' }}>
        <svg width="248" height="248" viewBox="0 0 248 248" style={{ overflow: 'visible' }} role="img" aria-label="Atlétikai radar">
          {RINGS.map((f) => (
            <polygon key={f} className="progress-radar-grid" points={polygonPoints(CX, CY, R * f, axes.length)} />
          ))}
          {axes.map((a, i) => {
            const p = polarPoint(CX, CY, R, i, axes.length)
            return <line key={a.axis} className="progress-radar-axis" x1={CX} y1={CY} x2={p.x} y2={p.y} />
          })}
          <polygon
            className={`progress-radar-poly${reduced ? ' progress-radar-poly--reduced' : ''}`}
            points={dataPolygonPoints(CX, CY, R, values, max)}
          />
          {axes.map((a, i) => {
            const p = polarPoint(CX, CY, (R * Math.min(a.value, max)) / max, i, axes.length)
            return <circle key={a.axis} className="progress-radar-dot" cx={p.x} cy={p.y} r={3.2} />
          })}
          {axes.map((a, i) => {
            const lp = polarPoint(CX, CY, R + 16, i, axes.length)
            return (
              <text
                key={a.axis}
                className="progress-radar-label"
                x={lp.x}
                y={lp.y}
                textAnchor={anchorFor(i, axes.length)}
                dominantBaseline="middle"
              >
                {AXIS_ABBR[a.axis] ?? a.axis.toUpperCase()}
              </text>
            )
          })}
        </svg>

        <div className="progress-rstats">
          <div className="progress-rstat hl">
            <div className="rv">{profile.athleteLevel.toFixed(1)}</div>
            <div className="rl">Atléta-szint</div>
          </div>
          {bestMeta && (
            <div className="progress-rstat">
              <div className="rv" aria-hidden="true">{bestMeta.icon}</div>
              <div className="rl">{bestMeta.name}</div>
            </div>
          )}
          <div className="progress-rstat">
            <div className="rv">
              {profile.streakWeeks}
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}> hét</span>
            </div>
            <div className="rl">Streak</div>
          </div>
        </div>
      </div>
    </div>
  )
}

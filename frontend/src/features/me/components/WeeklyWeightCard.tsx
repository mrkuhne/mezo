import { Icon } from '@/shared/ui/Icon'
import { huMonthDay, huMonthDayDow } from '@/shared/lib/dates'
import type { GoalKind } from '@/data/types'
import { isImprovement, fmtSigned, type WeekAggregate, type DayRow } from '@/features/me/logic/weightStats'

const DIR_LABEL: Record<WeekAggregate['direction'], string> = { down: '↓ lefelé', up: '↑ felfelé', flat: '→ stabil' }

function rangeLabel(startIso: string, endIso: string): string {
  const sameMonth = startIso.slice(5, 7) === endIso.slice(5, 7)
  return sameMonth ? `${huMonthDay(startIso)}–${Number(endIso.slice(8, 10))}` : `${huMonthDay(startIso)}–${huMonthDay(endIso)}`
}

// mini sparkline path over the week's points, drawn in a 300×34 box
function spark(points: number[]): { line: string; area: string } {
  if (points.length < 2) return { line: '', area: '' }
  const min = Math.min(...points), max = Math.max(...points), range = max - min || 1
  const xs = (i: number) => 4 + (i / (points.length - 1)) * 292
  const ys = (v: number) => 4 + (1 - (v - min) / range) * 26
  const line = points.map((v, i) => `${i ? 'L' : 'M'}${xs(i).toFixed(1)} ${ys(v).toFixed(1)}`).join(' ')
  return { line, area: `${line} L296 34 L4 34 Z` }
}

export function WeeklyWeightCard({ week, dayRows, expanded, onToggle, goalKind }: {
  week: WeekAggregate
  dayRows: DayRow[]
  expanded: boolean
  onToggle: () => void
  goalKind?: GoalKind
}) {
  const deltaColor = week.delta === null || Math.abs(week.delta) < 0.005 ? 'var(--text-tertiary)'
    : isImprovement(week.delta, goalKind) ? 'var(--success)' : 'var(--error)'
  const dirGood = week.direction !== 'flat' && isImprovement(week.direction === 'down' ? -1 : 1, goalKind)
  const sp = spark(week.sparkPoints)

  return (
    <div className="card notch-12" style={{ padding: 14, marginBottom: 10 }}>
      <button onClick={onToggle} aria-expanded={expanded} className="row" style={{ width: '100%', justifyContent: 'space-between', background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }}>
        <span className="label-mono" style={{ fontSize: 10 }}>{rangeLabel(week.startIso, week.endIso)}</span>
        <span className="row" style={{ gap: 8 }}>
          {week.delta !== null && (
            <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 10, fontWeight: 600, color: deltaColor, background: 'color-mix(in srgb, currentColor 12%, transparent)', padding: '3px 8px', borderRadius: 999 }}>
              {fmtSigned(week.delta)} kg
            </span>
          )}
          <Icon name={expanded ? 'chevron-up' : 'chevron-down'} size={14} />
        </span>
      </button>

      <div className="row" style={{ gap: 8, alignItems: 'baseline', marginTop: 8 }}>
        <span style={{ fontFamily: 'var(--ff-display)', fontSize: 26, fontWeight: 600 }}>{week.avg.toFixed(1)}</span>
        <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 11, color: 'var(--text-tertiary)' }}>kg átlag · {week.count} bejegyzés · min {week.low}</span>
      </div>

      <svg viewBox="0 0 300 34" width="100%" height="34" aria-hidden="true" style={{ display: 'block', marginTop: 8 }}>
        <defs>
          <linearGradient id={`wwc-${week.startIso}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--brand-glow)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--brand-glow)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={sp.area} fill={`url(#wwc-${week.startIso})`} />
        <path d={sp.line} fill="none" stroke="var(--brand-glow)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" opacity="0.9" />
      </svg>
      <div className="row" style={{ justifyContent: 'space-between', marginTop: 4 }}>
        <span className="label-mono" style={{ letterSpacing: '2px' }}>H K Sz Cs P Sz V</span>
        <span className="label-mono" style={{ color: dirGood ? 'var(--success)' : 'var(--text-tertiary)' }}>{DIR_LABEL[week.direction]}</span>
      </div>

      {expanded && (
        <div className="col gap-sm" style={{ marginTop: 12 }}>
          {dayRows.map(r => {
            const c = r.dod === null || Math.abs(r.dod) < 0.005 ? 'var(--text-tertiary)' : isImprovement(r.dod, goalKind) ? 'var(--success)' : 'var(--error)'
            return (
              <div key={r.iso} className="card notch-4 row" style={{ justifyContent: 'space-between', padding: '10px 12px', background: 'var(--surface-2)' }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{huMonthDayDow(r.iso)}</span>
                <span className="row" style={{ gap: 6, alignItems: 'baseline' }}>
                  <b style={{ fontFamily: 'var(--ff-display)', fontSize: 16 }}>{r.value}</b>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>kg</span>
                  {r.dod !== null && <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 11, color: c }}>{fmtSigned(r.dod)}</span>}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

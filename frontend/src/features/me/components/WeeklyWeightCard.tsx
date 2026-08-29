// ============================================================
// Mezo · WeeklyWeightCard — Súly page's weekly-history tile
// (mezo-d20.6.3). Source of truth: en-body.html #page-suly `.wkt`:
// range label + delta pill, avg + count + min line, sparkline,
// `H K Sz Cs P Sz V` + direction word. Color is ALWAYS sage
// (improvement) or amber (not) — never red/error (handoff §2;
// the prototype's own `.deltap.up` is amber, not red).
// ============================================================
import { Icon } from '@/shared/ui/Icon'
import { cn } from '@/shared/lib/cn'
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

export function WeeklyWeightCard({ week, dayRows, expanded, onToggle, goalKind, delayMs }: {
  week: WeekAggregate
  dayRows: DayRow[]
  expanded: boolean
  onToggle: () => void
  goalKind?: GoalKind
  delayMs?: number
}) {
  const deltaGood = week.delta !== null && Math.abs(week.delta) >= 0.005 && isImprovement(week.delta, goalKind)
  const deltaFlat = week.delta === null || Math.abs(week.delta) < 0.005
  const dirGood = week.direction !== 'flat' && isImprovement(week.direction === 'down' ? -1 : 1, goalKind)
  const sp = spark(week.sparkPoints)

  return (
    <div className="wt-week rise" style={delayMs !== undefined ? ({ '--d': `${delayMs}ms` } as React.CSSProperties) : undefined}>
      <button onClick={onToggle} aria-expanded={expanded} className="wt-week-toggle">
        <span className="wt-dl">{rangeLabel(week.startIso, week.endIso)}</span>
        <span className="row" style={{ gap: 8 }}>
          {week.delta !== null && (
            <span className={cn('wt-deltap', !deltaFlat && !deltaGood && 'is-up')}>{fmtSigned(week.delta)} kg</span>
          )}
          <Icon name={expanded ? 'chevron-up' : 'chevron-down'} size={14} />
        </span>
      </button>

      <div className="row" style={{ gap: 8, alignItems: 'baseline', marginTop: 8 }}>
        <span style={{ fontFamily: 'var(--ff-display)', fontSize: 26, fontWeight: 600, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{week.avg.toFixed(1)}</span>
        <span style={{ fontSize: 11, color: 'var(--mz-ink-mut)' }}>kg átlag · {week.count} bejegyzés · min {week.low}</span>
      </div>

      <svg viewBox="0 0 300 34" width="100%" height="34" aria-hidden="true" style={{ display: 'block', marginTop: 8 }}>
        <defs>
          <linearGradient id={`wwc-${week.startIso}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--lav)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--lav)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={sp.area} fill={`url(#wwc-${week.startIso})`} />
        <path d={sp.line} fill="none" stroke="var(--lav-deep)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" opacity="0.9" />
      </svg>
      <div className="wt-days">
        <span>H K Sz Cs P Sz V</span>
        <span className={cn('wt-dir', !dirGood && 'is-warn')}>{DIR_LABEL[week.direction]}</span>
      </div>

      {expanded && (
        <div className="col gap-sm" style={{ marginTop: 12 }}>
          {dayRows.map(r => {
            const flat = r.dod === null || Math.abs(r.dod) < 0.005
            const good = !flat && isImprovement(r.dod!, goalKind)
            return (
              <div key={r.iso} className="wt-dayrow">
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{huMonthDayDow(r.iso)}</span>
                <span className="row" style={{ gap: 6, alignItems: 'baseline' }}>
                  <b style={{ fontFamily: 'var(--ff-display)', fontSize: 16, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{r.value}</b>
                  <span style={{ fontSize: 11, color: 'var(--mz-ink-mut)' }}>kg</span>
                  {r.dod !== null && (
                    <span className={cn('wt-dod', !flat && !good && 'is-up')} style={flat ? { color: 'var(--mz-ink-mut)' } : undefined}>
                      {fmtSigned(r.dod)}
                    </span>
                  )}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

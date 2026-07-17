import { Icon } from '@/shared/ui/Icon'
import { SECTION_LABEL as CAPTION } from '@/shared/ui/sectionLabel'
import type { WeightEntry, WeightTrends, Goal } from '@/data/types'
import { changeFromStart, latestValue, progressPct, etaWeeks, isImprovement, fmtSigned } from '@/features/me/logic/weightStats'

export function WeightHero({ log, weightTrends, goal, onLog }: {
  log: WeightEntry[]
  weightTrends: WeightTrends
  goal: Goal | null
  onLog: () => void
}) {
  const latest = latestValue(log)
  const start = goal?.startWeight ?? (log.length ? log[0].value : null)
  const target = goal?.targetWeight ?? null
  const change = changeFromStart(log, goal?.startWeight ?? null)
  const pct = latest !== null && start !== null ? progressPct(start, latest, target) : null
  const rate = weightTrends.last7d.weeklyRate
  const eta = latest !== null ? etaWeeks(latest, target, rate) : null
  const rateColor = Math.abs(rate) < 0.005 ? undefined : isImprovement(rate, goal?.kind) ? 'var(--success)' : 'var(--error)'

  return (
    <div style={{ padding: '0 24px 16px' }}>
      <div className="card" style={{ padding: '18px 18px 16px' }}>
        <div style={{ textAlign: 'center' }}>
          <span style={CAPTION}>Induláshoz képest</span>
          <div className="row" style={{ justifyContent: 'center', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
            <span style={{ fontFamily: 'var(--ff-display)', fontSize: 56, fontWeight: 600, lineHeight: 0.95, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>
              {change === null ? '—' : fmtSigned(change)}
            </span>
            <span style={{ fontSize: 15, color: 'var(--text-tertiary)' }}>kg</span>
          </div>
          {latest !== null && start !== null && (
            <div className="text-secondary" style={{ fontSize: 12, marginTop: 8 }}>
              {start.toFixed(1)} → <b style={{ color: 'var(--text-primary)' }}>{latest.toFixed(1)}</b>
              {target !== null && <> · cél {target} kg</>}
            </div>
          )}
          {pct !== null && (
            <div className="row" style={{ justifyContent: 'center', marginTop: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--success)', background: 'color-mix(in srgb, var(--success) 14%, transparent)', padding: '4px 10px', borderRadius: 999 }}>
                ✓ {pct}% a célig
              </span>
            </div>
          )}
        </div>

        <div style={{ height: 1, background: 'var(--border-subtle)', margin: '16px 0' }} />

        <div className="row gap-sm">
          <Stat value={latest === null ? '—' : latest.toFixed(1)} label="Jelenleg" />
          <Stat value={fmtSigned(rate)} label="7-nap/hét" color={rateColor} />
          <Stat value={eta === null ? '—' : `${eta}h`} label="ETA" />
        </div>
        <div style={{ textAlign: 'center', marginTop: 10 }}>
          <span style={CAPTION}>4-hét tempó {fmtSigned(weightTrends.last4w.weeklyRate)} kg/hét</span>
        </div>

        <button className="np-cta np-press" onClick={onLog} style={{ width: '100%', marginTop: 14 }}>
          <Icon name="plus" size={14} /> Súly naplózása
        </button>
      </div>
    </div>
  )
}

function Stat({ value, label, color }: { value: string; label: string; color?: string }) {
  return (
    <div className="flex-1 card" style={{ padding: 11, textAlign: 'center', background: 'var(--surface-2)' }}>
      <div style={{ fontFamily: 'var(--ff-display)', fontSize: 22, fontWeight: 600, lineHeight: 1, color: color ?? 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      <div style={{ ...CAPTION, marginTop: 4 }}>{label}</div>
    </div>
  )
}

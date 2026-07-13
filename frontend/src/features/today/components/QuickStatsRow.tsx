import { useQuickStats } from '@/data/hooks'
import { QuickStat } from '@/shared/ui/QuickStat'

// Ring color per stat label (Napiv palette). Kcal/fehérje are included for forward
// compatibility — useQuickStats never emits them today (mock: Alvás/Súly/HRV; real:
// Alvás/Súly only — HRV honestly dropped, see todayHooks.ts), so those two never
// actually render yet.
const RING_COLOR: Record<string, string> = {
  kcal: 'var(--coral)',
  fehérje: 'var(--sage)',
  alvás: 'var(--lav)',
  súly: 'var(--sage)',
  hrv: 'var(--lav)',
}

// Sleep is the only stat with a natural, non-personalized target (8h, a well-known
// baseline) derivable from its own value alone. Súly/HRV/Kcal/Fehérje have no target
// available to THIS component without consuming a new hook (goal weight, macro
// targets) — per the restyle scope, they render a full ring (a visual chip) instead.
const SLEEP_TARGET_H = 8

export function ringPct(label: string, value: string): number {
  if (label.toLowerCase() === 'alvás') {
    const hours = parseFloat(value)
    // Non-finite (e.g. the '—' placeholder for missing data) must render an empty
    // ring, not a full one — a full ring next to a "—" value is a dishonest visual.
    if (!Number.isFinite(hours)) return 0
    return Math.max(0, Math.min(100, (hours / SLEEP_TARGET_H) * 100))
  }
  return 100
}

export function QuickStatsRow() {
  const stats = useQuickStats()
  return (
    <div style={{ padding: '8px 24px 24px' }}>
      <div className="secthead-np">
        <h3>Ma eddig</h3>
      </div>
      <div className="snap">
        {stats.map((s) => (
          <QuickStat
            key={s.label}
            label={s.label}
            value={s.value}
            unit={s.unit}
            color={RING_COLOR[s.label.toLowerCase()] ?? 'var(--coral)'}
            pct={ringPct(s.label, s.value)}
          />
        ))}
      </div>
    </div>
  )
}

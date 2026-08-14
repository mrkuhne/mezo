import type { PatternGateVerdict } from '@/data/types'

const CHIP_META: { verdict: PatternGateVerdict; label: string; color: string; bg: string }[] = [
  { verdict: 'live', label: 'Élő', color: 'var(--success-deep)', bg: 'var(--success-bg)' },
  { verdict: 'few_days', label: 'Kevés nap', color: 'var(--warning-deep)', bg: 'var(--warning-bg)' },
  { verdict: 'no_data', label: 'Nincs adat', color: 'var(--text-secondary)', bg: 'var(--secondary-bg)' },
  { verdict: 'degenerate', label: 'Degenerált', color: 'var(--error-deep)', bg: 'var(--error-bg)' },
  { verdict: 'frozen', label: 'Fagyasztva', color: 'var(--accent-deep)', bg: 'var(--accent-bg)' },
]

/**
 * Nagy számos verdikt-chipek (mezo-18bx) — koppintásra szűrő-toggle (több is aktív lehet;
 * üres kiválasztás = nincs szűrés). Pure props, az állapot a MotorPage-é.
 */
export function VerdictFilterChips({
  counts,
  active,
  onToggle,
}: {
  counts: Record<PatternGateVerdict, number>
  active: Set<PatternGateVerdict>
  onToggle: (verdict: PatternGateVerdict) => void
}) {
  return (
    <div className="row gap-sm" style={{ overflowX: 'auto', paddingBottom: 2 }}>
      {CHIP_META.map(({ verdict, label, color, bg }) => {
        const isActive = active.has(verdict)
        return (
          <button
            key={verdict}
            type="button"
            aria-pressed={isActive}
            onClick={() => onToggle(verdict)}
            className="col"
            style={{
              alignItems: 'center',
              gap: 1,
              flexShrink: 0,
              minWidth: 64,
              padding: '8px 12px',
              borderRadius: 14,
              fontSize: 11,
              fontWeight: 700,
              color,
              background: bg,
              border: `2px solid ${isActive ? color : 'transparent'}`,
              cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: 17, lineHeight: 1.1 }}>{counts[verdict]}</span>
            {label}
          </button>
        )
      })}
    </div>
  )
}

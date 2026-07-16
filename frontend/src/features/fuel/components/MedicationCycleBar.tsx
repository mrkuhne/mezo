// ============================================================
// Mezo · MedicationCycleBar (Gyógyszer — the 7-cell cycle strip)
// Ports the approved mockup's `.cyc` strip (gyogyszer-a-szellos.html) to the real
// design system: one rad-12 cell per cycle day, tinted by phase, the current day
// outlined. The mockup's `--err/--glow/--warn` phase colors map to the real tokens
// (peak → --error, stable → --sage, trough → --warning) via PHASE_TINT — the 'stable'
// entry moved off brand-teal onto sage with the rest of Kamra/Gyógyszer (Task 7, mezo-8141).
//
// Presentational only — takes the derived MedicationCycle.week (built by the hook /
// backend, current cell flagged) and renders it. Semantic <ul>/<li> so the view's
// tests (and screen readers) can address the strip + the current cell (aria-current).
// ============================================================
import type { MedicationCycleCell } from '@/data/types'

// Per-phase glyph + the design token its tint/text derive from. `mix`/`textMix` are the
// color-mix recipes from the mockup (.peak/.stab/.trou backgrounds + lightened text).
const PHASE_TINT: Record<string, { glyph: string; token: string }> = {
  peak: { glyph: 'P', token: 'var(--error)' },
  stable: { glyph: 'S', token: 'var(--sage)' },
  trough: { glyph: 'T', token: 'var(--warning)' },
}

function Cell({ cell }: { cell: MedicationCycleCell }) {
  const tint = PHASE_TINT[cell.phaseKey] ?? { glyph: '·', token: 'var(--text-tertiary)' }
  return (
    <li
      aria-current={cell.current ? 'true' : undefined}
      aria-label={`${cell.day}. nap · ${cell.label}`}
      className="rad-12 col flex-1"
      style={{
        alignItems: 'center',
        padding: '9px 0 7px',
        background: `color-mix(in srgb, ${tint.token} 24%, transparent)`,
        // current day: a thin primary-text outline pulled inward (mockup .now)
        outline: cell.current ? '1px solid var(--text-primary)' : undefined,
        outlineOffset: cell.current ? '-1px' : undefined,
      }}
    >
      <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 9, fontWeight: 600, color: tint.token }}>
        {tint.glyph}
      </span>
      <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 8, marginTop: 4, color: 'var(--text-tertiary)' }}>
        {cell.day}
      </span>
    </li>
  )
}

export function MedicationCycleBar({ week }: { week: MedicationCycleCell[] }) {
  return (
    <ul
      role="list"
      aria-label="Kinetikus ciklus"
      className="row"
      style={{ gap: 5, marginTop: 16, padding: 0, listStyle: 'none' }}
    >
      {week.map(cell => (
        <Cell key={cell.day} cell={cell} />
      ))}
    </ul>
  )
}

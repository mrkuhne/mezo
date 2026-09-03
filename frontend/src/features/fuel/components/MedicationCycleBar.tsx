// ============================================================
// Mezo · MedicationCycleBar (Gyógyszer — the 7-cell cycle strip) — Mozaik re-face
// (mezo-d20.4.7). Ports the prototype's `.cyc` strip (fuel-body.html #page-gyogyszer,
// ×1.18) via the `.fmd-cyc` CSS recipe (prototype.css) instead of inline color-mix.
//
// Guardrail fix: the peak phase used to ride `var(--error)` — an actual-red token in
// dark mode. It now uses `--mz-no-ink`, the shared terracotta the rest of the app
// already reserves for "high but never alarming" (NOVA 4, the low-Mozgás skin) —
// the medication peak (appetite-suppression window) is information, not a warning.
//
// Presentational only — takes the derived MedicationCycle.week (built by the hook /
// backend, current cell flagged) and renders it. Semantic <ul>/<li> so the view's
// tests (and screen readers) can address the strip + the current cell (aria-current).
// ============================================================
import { cn } from '@/shared/lib/cn'
import type { MedicationCycleCell } from '@/data/types'

const PHASE_CLASS: Record<string, string> = { peak: 'peak', stable: 'stable', trough: 'trough' }
const PHASE_GLYPH: Record<string, string> = { peak: 'P', stable: 'S', trough: 'T' }

function Cell({ cell }: { cell: MedicationCycleCell }) {
  const phaseClass = PHASE_CLASS[cell.phaseKey]
  const glyph = PHASE_GLYPH[cell.phaseKey] ?? '·'
  return (
    <li
      aria-current={cell.current ? 'true' : undefined}
      aria-label={`${cell.day}. nap · ${cell.label}`}
      className={cn(phaseClass, cell.current && 'cur')}
    >
      <span className="fmd-cyc-glyph">{glyph}</span>
      <span className="fmd-cyc-day">{cell.day}</span>
    </li>
  )
}

export function MedicationCycleBar({ week }: { week: MedicationCycleCell[] }) {
  return (
    <ul role="list" aria-label="Kinetikus ciklus" className="fmd-cyc">
      {week.map((cell) => (
        <Cell key={cell.day} cell={cell} />
      ))}
    </ul>
  )
}

// ============================================================
// Mezo · HabitContextRings (mezo-08zl) — prototype `rutin-formalodas` `.ctxgrid` ×1.18.
//
// Context stability is the strongest predictor of formation in the literature (Buyalskaya 2023),
// and it is the one thing here the user can actually change — so it gets its own row of rings
// rather than a footnote. A signal we cannot measure renders as "—": no anchor means no anchor
// constancy, and too few timed completions mean no time constancy. Never a fabricated 0%.
// ============================================================
import type { HabitFormation } from '@/data/types'
import { ScoreRing } from '@/shared/ui/ScoreRing'

interface Ring {
  pct: number | null
  label: string
  sub: string
  color: string
}

export function HabitContextRings({ f, anchored }: { f: HabitFormation; anchored: boolean }) {
  const rings: Ring[] = [
    { pct: f.timeConstancyPct, label: 'Napszak', sub: 'azonos időben', color: 'var(--amber)' },
    {
      pct: f.anchorConstancyPct,
      label: 'Horgony',
      sub: anchored ? 'a horgony után' : 'nincs horgony',
      color: 'var(--lav)',
    },
    { pct: f.consistencyPct, label: 'Ritmus', sub: 'simított', color: 'var(--sage)' },
  ]
  return (
    <div className="rt-ctxgrid" data-testid="formation-context">
      {rings.map((r) => (
        <div className="rt-ctxcell" key={r.label}>
          <ScoreRing pct={(r.pct ?? 0) / 100} size={44} stroke={5} color={r.color}
            label={r.pct != null ? `${r.pct}` : '—'} />
          <b>{r.label}</b>
          <small>{r.sub}</small>
        </div>
      ))}
    </div>
  )
}

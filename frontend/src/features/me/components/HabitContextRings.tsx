// ============================================================
// Mezo · HabitContextRings (mezo-08zl; Folyadék F2 mezo-n4wf5.2) — „mikor megy a legjobban":
// three vessels (prototype vilagos/nap.js `szokas` → `.np-ctx3`).
//
// Context stability is the strongest predictor of formation in the literature (Buyalskaya 2023),
// and it is the one thing here the user can actually change — so it gets its own row of levels
// rather than a footnote. A signal we cannot measure renders as "—": no anchor means no anchor
// constancy, and too few timed completions mean no time constancy. Never a fabricated 0%.
// ============================================================
import type { HabitFormation } from '@/data/types'
import type { Icon3DName } from '@/shared/ui/clay'
import { Vials } from '@/shared/ui/folyadek'

interface Signal { pct: number | null; label: string; sub: string; icon: Icon3DName }

export function HabitContextRings({ f, anchored }: { f: HabitFormation; anchored: boolean }) {
  const signals: Signal[] = [
    { pct: f.timeConstancyPct, label: 'Napszak', sub: 'azonos időben', icon: 't-clock' },
    { pct: f.anchorConstancyPct, label: 'Horgony', sub: anchored ? 'a horgony után' : 'nincs horgony', icon: 't-anchor' },
    { pct: f.consistencyPct, label: 'Ritmus', sub: 'simított', icon: 't-calendar' },
  ]
  return (
    <div data-testid="formation-context">
      <Vials
        size="sm" height={92}
        items={signals.map((s) => ({
          label: s.label, note: s.sub, pct: s.pct ?? 0, value: s.pct != null ? `${s.pct}%` : '—', icon: s.icon,
        }))}
      />
    </div>
  )
}

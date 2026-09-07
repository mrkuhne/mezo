import { formatRollupCost } from '@/features/me/logic/llmCallFormat'
import type { components } from '@/data/_client/api.gen'

type Totals = components['schemas']['LlmUsageTotals']

// The AI-napló header (mezo-uakh): the two numbers that answer "how much did the period cost",
// with the honesty footnote right under them — the cost is a SUM OF PRICED ROWS ONLY, so the
// unpriced count is what makes it an estimate rather than a fact.
//
// Token note: the brief's `--wash-coral` does not exist on this surface (grepped
// frontend/src/styles/prototype.css — only --wash-sage/--wash-amber/--wash-lav are defined).
// Substituted --wash-sage: it pairs with --sage-deep, which is the color the sibling
// `AiUsageCard` (Profil) already uses for cost figures, so the hero's money callout stays in
// the same visual family as every other cost number on the Me surface.

// Re-faced mezo-d20.6.8 into the washed Mozaik card family (still `var(--wash-sage)` — the
// prototype's #page-ai has no matching card of its own to lift 1:1; this stays the closest
// domain wash on the surface, unchanged from before the re-face).
export function AiUsageHero({ totals, periodLabel }: { totals: Totals; periodLabel: string }) {
  return (
    <div className="card rise" style={{ padding: '14px 16px 15px', background: 'var(--wash-sage)', borderRadius: 21 }}>
      <div className="eyebrow">{periodLabel}</div>

      <div className="row" style={{ gap: 26, marginTop: 7 }}>
        <div>
          <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.05, fontVariantNumeric: 'tabular-nums' }}>
            {totals.callCount}
          </div>
          <div className="text-tertiary" style={{ fontSize: 10.5, fontWeight: 600 }}>hívás</div>
        </div>
        <div>
          <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.05, fontVariantNumeric: 'tabular-nums' }}>
            {formatRollupCost(totals.costUsd)}
          </div>
          <div className="text-tertiary" style={{ fontSize: 10.5, fontWeight: 600 }}>becsült költség</div>
        </div>
      </div>

      <div className="text-tertiary" style={{ fontSize: 11, marginTop: 9 }}>
        {totals.successCount} sikeres · {totals.errorCount} hiba · {totals.cancelledCount} megszakadt
      </div>
      {totals.unpricedCount > 0 && (
        <div className="text-tertiary" style={{ fontSize: 11, marginTop: 2 }}>
          {totals.unpricedCount} hívás árazatlan — ezek nincsenek az összegben
        </div>
      )}
    </div>
  )
}

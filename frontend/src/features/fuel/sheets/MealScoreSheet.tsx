// ============================================================
// Mezo · MealScoreSheet
// Részletes AI score breakdown egy adott ételre
// Dimenziók: kcal&macro · micro-macro · NOVA processing · context
// ============================================================
import type { FuelMeal } from '@/data/types'
import { Sheet } from '@/shared/ui/Sheet'
import { Icon } from '@/shared/ui/Icon'
import { Eyebrow } from '@/shared/ui/Eyebrow'
import { Display } from '@/shared/ui/Display'
import { SafeMarkdown } from '@/shared/lib/safeMarkdown'
import { ClaySpot } from '@/shared/ui/clay'
import { formatImpact } from '@/features/fuel/logic/formatImpact'
import { ScoreHero } from '@/features/fuel/components/ScoreHero'
import { ScoreBreakdownBody } from '@/features/fuel/components/ScoreBreakdownBody'
import { mealDisplayName } from '@/features/fuel/logic/mealDisplayName'
import { mealContextOf, MEAL_CONTEXT_LABEL } from '@/features/fuel/logic/mealContext'
import { useMealCoachFor } from '@/data/hooks'

/** "+4 pont" → the number and its unit split, so the chip can size them apart. */
const PONT_RE = /^([+−]\d+) pont$/

export function MealScoreSheet({ meal, onClose }: { meal: FuelMeal; onClose: () => void }) {
  // The coach verdict materializes on demand (mezo-mr4n): the deterministic body below renders
  // immediately from the already-loaded envelope, this only fills the prose card.
  const { verdict, isPending: coachPending } = useMealCoachFor(meal.id)
  const b = meal.breakdown
  if (!b) return null
  const scorePct = (meal.score ?? 0) * 100
  const summary = verdict?.summary ?? b.summary
  // The role the meal was SCORED under (Standard / Pre / Post) — the same chip the block wears.
  const ctx = mealContextOf(meal)
  // mezo-jcpt.1: the improve list rides the Mezo card as action chips (prototype `.impch`),
  // so the body below gets an EMPTY improve — one suggestion, one place. The recipe surface,
  // which has no coach card, still renders them as the stacked „Lehetne jobb" gain cards.
  const improve = verdict?.improve?.length ? verdict.improve : b.improve
  const breakdown = { ...b, improve: [] }

  return (
    <Sheet onClose={onClose} labelledBy="meal-score-title">
      {(close) => (
        <>
          {/* Header */}
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div className="col" style={{ flex: 1, minWidth: 0 }}>
              <Eyebrow brand>AI score · részletek</Eyebrow>
              <div id="meal-score-title" style={{ marginTop: 4 }}>
                {/* De-blank the header for title-less-but-scored pre-fix meals (mezo-u68c):
                    title → derived name → 'Étkezés'. Never blank. */}
                <Display size="md">{mealDisplayName(meal) ?? 'Étkezés'}</Display>
              </div>
              <span className="row gap-sm" style={{ alignItems: 'center', marginTop: 4 }}>
                <span className="label-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>{meal.slot}</span>
                {ctx && (
                  <span className={`fh-ctx is-${ctx}`}><i aria-hidden="true" />{MEAL_CONTEXT_LABEL[ctx]}</span>
                )}
              </span>
            </div>
            <button className="chip" onClick={close} aria-label="Bezárás" style={{ padding: '6px 8px' }}>
              <Icon name="x" size={12} />
            </button>
          </div>

          {/* Score hero */}
          <ScoreHero meal={meal} scorePct={scorePct} confidence={b.confidence} />

          {/* Mezo summary — the coach's verdict (mezo-mr4n); a skeleton while it is being
              generated, and nothing at all when the coach is off/unavailable. */}
          {!summary && coachPending && (
            <div className="card" style={{ padding: 12, marginTop: 14 }} data-testid="coach-skeleton">
              <div className="row gap-sm" style={{ alignItems: 'center' }}>
                <Icon name="sparkle" size={12} color="var(--coral)" />
                <Eyebrow className="text-tertiary">Mezo olvasata készül…</Eyebrow>
              </div>
            </div>
          )}
          {/* The coach's verdict, Mozaik 2.0 (mezo-jcpt.1): the prototype's lila `.revcard`
              with the táplálkozó orb, and the improve suggestions as `.impch` action chips
              right under the prose — the gain is a number ON the action, not a list item
              three screens further down. */}
          {summary && (
            <div className="card sb-rev" style={{ marginTop: 14 }}>
              <div className="row gap-sm" style={{ alignItems: 'flex-start' }}>
                <ClaySpot name="s-orb-taplalkozo" size={26} />
                <div className="col flex-1">
                  <Eyebrow brand>Mezo · olvasat</Eyebrow>
                  <p style={{ fontSize: 12.5, lineHeight: 1.5, marginTop: 6, color: 'var(--text-primary)' }}>
                    <SafeMarkdown text={summary} />
                  </p>
                  {improve.length > 0 && (
                    <div className="sb-improw">
                      {improve.map((it, i) => {
                        // "+0.04 score" → "+4 pont" (formatImpact); other impact text stays verbatim.
                        const gain = formatImpact(it.impact)
                        const m = PONT_RE.exec(gain)
                        return (
                          <span key={i} className="sb-impch">
                            <span><SafeMarkdown text={it.text} /></span>
                            {m ? <><b>{m[1]}</b><em>pont</em></> : <b>{gain}</b>}
                          </span>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Ledger + dimension cards + improve — shared with the recipe Pontszám (mezo-bw3y) */}
          <ScoreBreakdownBody breakdown={breakdown} scorePct={Math.round(scorePct)} />

          <div style={{ height: 12 }} />
        </>
      )}
    </Sheet>
  )
}

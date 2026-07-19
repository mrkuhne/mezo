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
import { ScoreHero } from '@/features/fuel/components/ScoreHero'
import { ScoreBreakdownBody } from '@/features/fuel/components/ScoreBreakdownBody'

export function MealScoreSheet({ meal, onClose }: { meal: FuelMeal; onClose: () => void }) {
  const b = meal.breakdown
  if (!b) return null
  const scorePct = (meal.score ?? 0) * 100

  return (
    <Sheet onClose={onClose} labelledBy="meal-score-title">
      {(close) => (
        <>
          {/* Header */}
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div className="col" style={{ flex: 1, minWidth: 0 }}>
              <Eyebrow brand>AI score · részletek</Eyebrow>
              <div id="meal-score-title" style={{ marginTop: 4 }}>
                <Display size="md">{meal.title}</Display>
              </div>
              <span className="label-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)', marginTop: 4 }}>
                {meal.slot}
              </span>
            </div>
            <button className="chip" onClick={close} aria-label="Bezárás" style={{ padding: '6px 8px' }}>
              <Icon name="x" size={12} />
            </button>
          </div>

          {/* Score hero */}
          <ScoreHero meal={meal} scorePct={scorePct} confidence={b.confidence} />

          {/* Mezo summary — deterministic v0 ships summary:null (P8 prose), the card hides honestly */}
          {b.summary && (
            <div className="card" style={{
              padding: 12, marginTop: 14,
              background: 'color-mix(in srgb, var(--coral) 5%, transparent)',
              borderColor: 'var(--line)',
            }}>
              <div className="row gap-sm" style={{ alignItems: 'flex-start' }}>
                <Icon name="sparkle" size={12} color="var(--coral)" />
                <div className="col flex-1">
                  <Eyebrow brand>Mezo · olvasat</Eyebrow>
                  <p style={{ fontSize: 12.5, lineHeight: 1.5, marginTop: 6, color: 'var(--text-primary)' }}>
                    <SafeMarkdown text={b.summary} />
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Section eyebrow */}
          <div className="row" style={{ justifyContent: 'space-between', margin: '20px 0 10px' }}>
            <Eyebrow>Súlyozott bontás</Eyebrow>
            <Eyebrow className="text-tertiary">{b.dimensions.length} dimenzió</Eyebrow>
          </div>

          {/* Dimension cards + improve + tools — shared with the recipe Pontszám (mezo-bw3y) */}
          <ScoreBreakdownBody breakdown={b} />

          <div style={{ height: 12 }} />
        </>
      )}
    </Sheet>
  )
}

import type { FuelSlot, FuelMeal, FuelKind } from '@/data/types'
import type { KIND_META } from '@/data/kindMeta'
import { SafeMarkdown } from '@/shared/lib/safeMarkdown'
import { SupplementItemRow } from '@/features/fuel/components/SupplementItemRow'

type KindMeta = (typeof KIND_META)[keyof typeof KIND_META]

// KIND_META's `icon` field names an abstract SVG glyph (fuel/pill/train/today) shared across
// kinds that need visually DIFFERENT fav emoji (meal vs snack both use 'fuel'; wake vs sport
// both use 'today') — so it can't drive the timeline avatar directly. Mapping by kind key
// instead, per the Napiv slot-card spec (mezo-8141).
const FAV_EMOJI: Record<FuelKind, string> = {
  wake: '💧',
  meal: '🥣',
  midday: '💊',
  snack: '🍎',
  preworkout: '💊',
  workout: '🏋️',
  sport: '🏐',
  evening: '💊',
}
const FAV_WASH: Record<FuelKind, string> = {
  wake: 'var(--wash-run)',
  meal: 'var(--wash-sage)',
  midday: 'var(--wash-lav)',
  snack: 'var(--wash-amber)',
  preworkout: 'var(--wash-lav)',
  workout: 'var(--wash-gym)',
  sport: 'var(--wash-sport)',
  evening: 'var(--wash-lav)',
}

export function SlotCard({
  slot,
  meta,
  scoredMeal,
  onOpenScore,
  onLogMeal,
  onAiLog,
  tagline,
}: {
  slot: FuelSlot
  meta: KindMeta
  scoredMeal: FuelMeal | null
  onOpenScore: (m: FuelMeal) => void
  onLogMeal?: (slot: FuelSlot) => void
  onAiLog?: (slot: FuelSlot) => void
  /** The coach's card-sized verdict (mezo-mr4n); null while absent — renders no row at all. */
  tagline?: string | null
}) {
  const isDone = slot.state === 'done'
  const isNow = slot.state === 'now'
  const isMissed = slot.state === 'missed'
  // Planner (P5) pending shapes — additive; absent on logged/mock slots so their render is unchanged.
  // `missed` wins over a lingering recipe suggestion: buildDayPlan's state pass can reclassify a
  // pending recipe-suggestion window to `missed` without clearing suggestedRecipeId, so gate the
  // suggestion CTA off `missed` — a missed slot renders ONLY the Pótlás retro-log, never a 2nd log.
  const isSuggestion = !isDone && !isMissed && !!slot.suggestedRecipeId
  const isBudgetSlot = !slot.mealName && (slot.kind === 'meal' || slot.kind === 'snack') && !isDone && !!slot.kcal
  const isWorkoutKind = slot.kind === 'workout' || slot.kind === 'sport'
  const hasItems = (slot.items ?? []).length > 0
  const hasKcal = slot.kcal != null
  const hasFullMacros = slot.p != null && slot.c != null && slot.f != null

  const title = slot.mealName || slot.label
  const durationSuffix = isWorkoutKind && slot.duration ? ` · ${slot.duration} perc` : ''

  return (
    <div className={`slot${isDone ? ' done' : ''}${isNow ? ' next' : ''}${isMissed ? ' missed' : ''}`}>
      <span className="fav" role="img" aria-label={meta.label} style={{ background: FAV_WASH[slot.kind] ?? FAV_WASH.meal }}>
        {FAV_EMOJI[slot.kind] ?? FAV_EMOJI.meal}
      </span>

      <div className="tx">
        <div className="t1">
          {title}
          {durationSuffix}
          {isMissed && <span className="misstag"> kihagyott</span>}
        </div>

        {/* Coach verdict cut (mezo-mr4n) — absent verdict renders nothing, so no layout shift. */}
        {tagline && (
          <div
            data-testid="coach-tagline"
            style={{ fontSize: 11.5, lineHeight: 1.35, color: 'var(--text-tertiary)', marginTop: 2 }}
          >
            {tagline}
          </div>
        )}

        <div className="mrow">
          <span>{slot.time}</span>
          {hasKcal && (
            <>
              {' · '}
              <b>{slot.kcal} kcal</b>
            </>
          )}
          {hasFullMacros && (
            <>
              <span className="mm">
                <i style={{ background: 'var(--sage)' }} />F {slot.p}
              </span>
              <span className="mm">
                <i style={{ background: 'var(--amber)' }} />Sz {slot.c}
              </span>
              <span className="mm">
                <i style={{ background: 'var(--lav)' }} />Zs {slot.f}
              </span>
            </>
          )}
          {isSuggestion && (
            <>
              {' · '}
              <span>ajánlott</span>
            </>
          )}
          {slot.windowTip && (
            <>
              {' · '}
              <span>{slot.windowTip}</span>
            </>
          )}
          {isNow && (
            <>
              {' · '}
              <span>következő</span>
            </>
          )}
        </div>

        {/* AI meal-score chip — opens MealScoreSheet on the parent-supplied scoredMeal. */}
        {scoredMeal && (
          <button
            type="button"
            aria-label="AI score"
            onClick={(e) => {
              e.stopPropagation()
              onOpenScore(scoredMeal)
            }}
            className="chx"
            style={{ marginTop: 6, marginRight: 6, background: 'var(--wash-lav)', color: 'var(--lav-deep)' }}
          >
            AI {((scoredMeal.score ?? 0) * 100).toFixed(0)}
          </button>
        )}

        {/* Planner (P5) log CTAs — recipe-suggestion prefill vs budget-only tap-to-log. */}
        {isSuggestion && (
          <button
            type="button"
            aria-label={`${slot.mealName} logolása`}
            onClick={() => onLogMeal?.(slot)}
            className="chx"
            style={{ marginTop: 6, background: 'var(--wash-amber)', color: 'var(--ink)' }}
          >
            Logolás
          </button>
        )}
        {(isBudgetSlot || isMissed) && (
          <button
            type="button"
            aria-label={`${slot.label} ${isMissed ? 'pótlása' : 'logolása'}`}
            onClick={() => onLogMeal?.(slot)}
            className="chx"
            style={{
              marginTop: 6,
              background: isMissed ? 'var(--warm)' : 'var(--wash-sage)',
              color: isMissed ? 'var(--coral-deep)' : 'var(--sage-deep)',
            }}
          >
            {isMissed ? 'Pótlás' : 'Logolás'}
          </button>
        )}
        {/* Slot-level AI logging (mezo-53su) — a second chip beside Logolás on open meal/snack
            slots; launches AiLogSheet locked to this slot's slotKey. */}
        {(isSuggestion || isBudgetSlot || isMissed) && slot.slotKey && onAiLog && (
          <button
            type="button"
            aria-label={`${slot.label} AI-logolása`}
            onClick={() => onAiLog(slot)}
            className="chx"
            style={{ marginTop: 6, marginLeft: 6, background: 'var(--wash-lav)', color: 'var(--lav-deep)' }}
          >
            AI
          </button>
        )}

        {/* Supplement items — the esti stack capsules. */}
        {hasItems && (
          <div className="col gap-sm mt-md">
            {slot.items?.map((item, i) => <SupplementItemRow key={i} item={item} />)}
          </div>
        )}

        {/* Mezo note */}
        {slot.mezoNote && (
          <div style={{ marginTop: 8, fontSize: 11, color: 'var(--sub)', lineHeight: 1.5 }}>
            <SafeMarkdown text={slot.mezoNote} />
          </div>
        )}
      </div>

      <span className="st">{isDone ? '✓' : hasItems ? '🌙' : null}</span>
    </div>
  )
}

import { slotRole } from '@/features/fuel/logic/dayZones'
import { MealScoreChip } from '@/features/fuel/components/MealScoreChip'
import { SupplementItemRow } from '@/features/fuel/components/SupplementItemRow'
import { SafeMarkdown } from '@/shared/lib/safeMarkdown'
import type { FuelKind, FuelMeal, FuelSlot } from '@/data/types'

// One row inside a DayZoneCard (mezo-rrtj) — the retired SlotCard's behaviour at zone density.
// Every gating rule is carried over verbatim (missed wins over a lingering suggestion; the AI chip
// needs a slotKey AND a handler; the duration suffix is guarded), plus two additions: an activity
// row prints the kcal it added to the target, and the hero's own window renders as a CTA-less
// anchor so the page never ships two buttons with the same aria-label.
const FAV_EMOJI: Record<FuelKind, string> = {
  wake: '💧', meal: '🥣', midday: '💊', snack: '🍎', preworkout: '💊', workout: '🏋️', sport: '🏐', evening: '💊',
}
const FAV_WASH: Record<FuelKind, string> = {
  wake: 'var(--wash-run)', meal: 'var(--wash-sage)', midday: 'var(--wash-lav)', snack: 'var(--wash-amber)',
  preworkout: 'var(--wash-lav)', workout: 'var(--wash-gym)', sport: 'var(--wash-sport)', evening: 'var(--wash-lav)',
}

export function ZoneSlotRow({
  slot,
  scoredMeal,
  tagline,
  coachPending,
  burnKcal,
  anchored,
  onOpenScore,
  onLogMeal,
  onAiLog,
  onOpenStack,
}: {
  slot: FuelSlot
  scoredMeal: FuelMeal | null
  tagline: string | null
  coachPending: boolean
  burnKcal: number
  /** The hero already renders this window's CTA — the row becomes a chronology anchor. */
  anchored: boolean
  onOpenScore: (meal: FuelMeal) => void
  onLogMeal?: (slot: FuelSlot) => void
  onAiLog?: (slot: FuelSlot) => void
  onOpenStack?: () => void
}) {
  const role = slotRole(slot)
  const isDone = slot.state === 'done'
  const isMissed = slot.state === 'missed'
  // `missed` wins over a lingering recipe suggestion: buildDayPlan's state pass can reclassify a
  // pending recipe-suggestion window to `missed` without clearing suggestedRecipeId, so gate the
  // suggestion CTA off `missed` — a missed row renders ONLY the Pótlás retro-log, never a 2nd log.
  const isSuggestion = !isDone && !isMissed && !!slot.suggestedRecipeId
  const isBudgetSlot = !slot.mealName && role === 'meal' && !isDone && !!slot.kcal
  const loggable = !anchored && (isSuggestion || isBudgetSlot || isMissed)
  const isActivity = role === 'activity'
  const title = slot.mealName || slot.label
  const durationSuffix = isActivity && slot.duration ? ` · ${slot.duration} perc` : ''

  const avatar = (
    <span className="zf" role="img" aria-label={slot.label} style={{ background: FAV_WASH[slot.kind] ?? FAV_WASH.meal }}>
      {FAV_EMOJI[slot.kind] ?? FAV_EMOJI.meal}
    </span>
  )

  // ── Supplement row: a compact line whose destination is the Stack page (logging lives there) ──
  if (role === 'supplement') {
    const labels = (slot.items ?? []).map(i => i.label).join(' · ')
    return (
      <div className="zrow">
        {avatar}
        <button
          type="button" className="zt" style={{ textAlign: 'left' }}
          aria-label={`${slot.label} · Stack megnyitása`} onClick={() => onOpenStack?.()}
        >
          <div className="a">{slot.label}</div>
          <div className="b"><span>{slot.time}</span>{labels && <span>{labels}</span>}</div>
        </button>
        <span className="zv" aria-hidden="true">🌙</span>
      </div>
    )
  }

  // ── Activity row: the burn lands where it is earned ──
  if (isActivity) {
    return (
      <div className={`zrow act${slot.kind === 'sport' ? ' sport' : ''}`}>
        {avatar}
        <div className="zt">
          <div className="a">{title}{durationSuffix}</div>
          <div className="b"><span>{slot.time}</span></div>
        </div>
        {burnKcal > 0 && (
          <div>
            <div className="bn">+{burnKcal}</div>
            <div className="bl">kcal a célban</div>
          </div>
        )}
      </div>
    )
  }

  // ── Anchored: the hero already renders this window's decision ──
  if (anchored) {
    return (
      <div className="zrow anchor">
        {avatar}
        <div className="zt">
          <div className="a">{slot.label}-ablak · most</div>
          <div className="b"><span>{slot.time}</span><span>a kártya fent ↑</span></div>
        </div>
        {slot.kcal != null && <span className="zv">{slot.kcal}</span>}
      </div>
    )
  }

  return (
    <div className={`zrow${isMissed ? ' missedrow' : ''}`}>
      {avatar}
      <div className="zt">
        <div className="a">
          {title}
          {isMissed && <span className="misstag"> kihagyott</span>}
        </div>
        <div className="b">
          <span>{slot.time}</span>
          {slot.kcal != null && <b>{slot.kcal} kcal</b>}
          {slot.p != null && <span className="mm"><i style={{ background: 'var(--sage)' }} />F {slot.p}</span>}
          {slot.c != null && <span className="mm"><i style={{ background: 'var(--amber)' }} />Sz {slot.c}</span>}
          {slot.f != null && <span className="mm"><i style={{ background: 'var(--lav)' }} />Zs {slot.f}</span>}
          {isSuggestion && <span>ajánlott</span>}
          {slot.windowTip && <span>{slot.windowTip}</span>}
        </div>
        {tagline && !coachPending && (
          <div data-testid="coach-tagline" className="coachline">{tagline}</div>
        )}
        {coachPending && !tagline && <div className="coachline sk" data-testid="coach-skeleton" />}
        {slot.mezoNote && (
          <div className="coachline"><SafeMarkdown text={slot.mezoNote} /></div>
        )}
        {(slot.items?.length ?? 0) > 0 && (
          <div className="col gap-sm mt-md">
            {slot.items?.map((item, i) => <SupplementItemRow key={i} item={item} />)}
          </div>
        )}
      </div>
      <MealScoreChip meal={scoredMeal} coachPending={coachPending} onOpen={onOpenScore} />
      {loggable && (
        <div className="zacts">
          <button
            type="button"
            className={`log${isMissed ? ' pot' : ''}`}
            aria-label={`${title} ${isMissed ? 'pótlása' : 'logolása'}`}
            onClick={() => onLogMeal?.(slot)}
          >
            {isMissed ? 'Pótlás' : 'Logolás'}
          </button>
          {slot.slotKey && onAiLog && (
            <button type="button" className="ai" aria-label={`${slot.label} AI-logolása`} onClick={() => onAiLog(slot)}>
              AI
            </button>
          )}
        </div>
      )}
    </div>
  )
}

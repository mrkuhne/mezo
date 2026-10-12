// ============================================================
// Mezo · mealSkips — pure helpers for the one-tap meal skip (Kihagyás S3, mezo-q4xt2.3):
// the reason chips, the `<slotKind>#<n>` target key and the 7-day back window.
// ============================================================
import { addDays } from '@/shared/lib/dates'
import { m } from '@/shared/i18n'
import type { SkipReason, PlannedSkip } from '@/features/train/logic/plannedSkips'
import type { SlotKey } from '@/features/fuel/logic/buildDayPlan'

type MealReason = 'NOT_HUNGRY' | 'NO_TIME' | 'STOMACH' | 'ILLNESS' | 'TRAVEL' | 'OTHER'

/** One chip. `label` is a getter: it reads the catalog when it is READ, so it follows a language switch. */
const reason = (value: MealReason, icon: string, serious: boolean): { value: SkipReason; label: string; icon: string; serious: boolean } => ({
  value,
  get label() { return m().fuelLogika.mealSkips.reasons[value] },
  icon,
  serious,
})

export const MEAL_REASONS: readonly { value: SkipReason; label: string; icon: string; serious: boolean }[] = [
  reason('NOT_HUNGRY', 't-nohunger', false),
  reason('NO_TIME', 't-clock', false),
  reason('STOMACH', 't-digestion', true),
  reason('ILLNESS', 't-ill', true),
  reason('TRAVEL', 't-travel', true),
  reason('OTHER', 't-other', false),
]

/** `<slotKind>#<n>` for every planned meal window, n = 1-based index among same-kind windows in time order. */
export function mealSkipKeys(windows: readonly { slotKey: SlotKey }[]): string[] {
  const seen = new Map<SlotKey, number>()
  return windows.map((w) => {
    const n = (seen.get(w.slotKey) ?? 0) + 1
    seen.set(w.slotKey, n)
    return `${w.slotKey}#${n}`
  })
}

/** The skip's reason as a line: 'ok nélkül' · „free text” · the chip label. */
export function mealSkipLabel(skip: Pick<PlannedSkip, 'reasonCategory' | 'reasonText'>): string {
  const M = m().fuelLogika.mealSkips
  if (skip.reasonCategory === 'NONE') return M.noReason
  if (skip.reasonCategory === 'OTHER') {
    const t = skip.reasonText?.trim()
    return t ? M.quoted(t) : M.reasons.OTHER
  }
  return MEAL_REASONS.find((r) => r.value === skip.reasonCategory)?.label ?? M.noReason
}

/** Meal skips may target today and the last 7 days — never the future. */
export function canSkipMealOn(dateIso: string, todayIso: string): boolean {
  return dateIso <= todayIso && dateIso >= addDays(todayIso, -7)
}

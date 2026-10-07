// ============================================================
// Mezo · mealSkips — pure helpers for the one-tap meal skip (Kihagyás S3, mezo-q4xt2.3):
// the reason chips, the `<slotKind>#<n>` target key and the 7-day back window.
// ============================================================
import { addDays } from '@/shared/lib/dates'
import type { SkipReason, PlannedSkip } from '@/features/train/logic/plannedSkips'
import type { SlotKey } from '@/features/fuel/logic/buildDayPlan'

export const MEAL_REASONS: readonly { value: SkipReason; label: string; icon: string; serious: boolean }[] = [
  { value: 'NOT_HUNGRY', label: 'Nem vagyok éhes', icon: 't-nohunger', serious: false },
  { value: 'NO_TIME', label: 'Nincs időm', icon: 't-clock', serious: false },
  { value: 'STOMACH', label: 'Gyomorrontás', icon: 't-digestion', serious: true },
  { value: 'ILLNESS', label: 'Beteg vagyok', icon: 't-ill', serious: true },
  { value: 'TRAVEL', label: 'Úton vagyok', icon: 't-travel', serious: true },
  { value: 'OTHER', label: 'Egyéb', icon: 't-other', serious: false },
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
  if (skip.reasonCategory === 'NONE') return 'ok nélkül'
  if (skip.reasonCategory === 'OTHER') {
    const t = skip.reasonText?.trim()
    return t ? `„${t}”` : 'Egyéb'
  }
  return MEAL_REASONS.find((r) => r.value === skip.reasonCategory)?.label ?? 'ok nélkül'
}

/** Meal skips may target today and the last 7 days — never the future. */
export function canSkipMealOn(dateIso: string, todayIso: string): boolean {
  return dateIso <= todayIso && dateIso >= addDays(todayIso, -7)
}

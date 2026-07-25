import type { CheckinSlot, IntentionDay } from '@/data/types'

export interface OpenLoops {
  checkinOpen: boolean
  reflectOpen: boolean
}

/**
 * Napzárás act 3 (Nyitott hurkok, mezo-ilsj §4) — pure derivation of which of the day's two
 * GATED loops still need closing. `checkinOpen` reuses the TodayPage next-open-slot predicate
 * (`checkins.findIndex(c => c.state === 'now' || c.state === 'pending')`, TodayPage.tsx:42) —
 * any slot still due or in its window counts as open. `reflectOpen` mirrors the IntentionBanner
 * precedent: only meaningful once the day HAS a focus to reflect on — no focus at all means
 * there is nothing to reflect on, so it is never "open" (nor ever rendered — LoopsStep.tsx).
 *
 * The journal invite is a deliberate THIRD row that stays OUT of this shape (LoopsStep.tsx) —
 * it is evergreen (you can always log one more thing, it never "closes"), so it never
 * participates in the "nothing open" beat below or in `onNext` gating (nothing here is ever
 * mandatory — Tovább always advances).
 */
export function openLoops({ checkins, intention }: { checkins: CheckinSlot[]; intention: IntentionDay }): OpenLoops {
  return {
    checkinOpen: checkins.some((c) => c.state === 'now' || c.state === 'pending'),
    reflectOpen: intention.foci.length > 0 && intention.reflection == null,
  }
}

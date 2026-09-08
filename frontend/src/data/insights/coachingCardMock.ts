import { mockCoachingDay } from '@/data/insights/coachingTraceMock'
import type { FeedMessage } from '@/data/types'

/**
 * The demo day's delivered card (mezo-6269.3). Derived FROM `mockCoachingDay` rather than typed out
 * beside it: the observer and the card page are two views of ONE decision, and a hand-copied
 * winner would let them drift into showing different rules — the exact incoherence this feature
 * exists to remove. The real companion feed mock stays `[]` (Phase-1 byte parity, and the Nap
 * thread's own goldens depend on it) — this seed is scoped to the coaching surface.
 */
export function mockCoachingCard(date: string): FeedMessage {
  const day = mockCoachingDay(date)
  const winner = day.rules.find((r) => r.flagKey === day.winner?.flagKey)
  return {
    id: day.winner?.cardId ?? 'mock-card-1',
    kind: 'advice',
    eyebrow: winner?.label ?? 'A nap kártyája',
    body: [{ type: 'p', text: 'A heti terhelésed magas, a bevitel viszont a cél alatt maradt. Ma tegyél be egy tisztességes ebédet — nem hősködés, csak fedezet.' }],
    refs: [],
    facts: winner?.facts ?? [],
    // Empty on purpose (bd mezo-wtl0): a generated advice body is prose written FROM the
    // suggestion, so the backend stopped SHOWING it — displaying both printed the same advice
    // twice. Only a once-ever question card still carries suggestions, as its answer chips.
    // Seeding them here would make mock mode — the DEFAULT mode — still show the fixed bug.
    suggestions: [],
    flagKey: winner?.flagKey,
    actions: [{ key: 'lighten_tomorrow', label: 'Könnyítsd a holnapot' }],
    generatedAt: `${date}T08:00:00Z`,
  }
}

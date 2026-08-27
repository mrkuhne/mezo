// Weekly review (mezo-p2tr) — mock seeds for the AI-generated review + its digest. Both are
// computed relative to whatever ISO Monday is requested (the meWeek.ts idiom), so a browsed
// week's dayNotes always line up with that SAME week's WeekDayCard dates. The digest is
// reused/re-dated for every browsed week (it is a raw week-window read, never gated on the
// review existing); only the REVIEW goes null for the CURRENT mock week, so the ghost
// "hamarosan" state stays demoable.
import type { components } from '@/data/_client/api.gen'
import { addDays } from '@/shared/lib/dates'
import { mondayIso } from '@/data/fuel/fuelWeekHooks'

export type WeeklyReview = components['schemas']['WeeklyReviewResponse']
export type WeeklyReviewDigest = components['schemas']['WeeklyReviewDigestResponse']

/** The seed week's review row id — also the weekly_review feedback artifactId. */
export const mockWeeklyReviewId = '9c2f6a3e-5b1a-4e7b-9d6c-2a7f0c1e3b40'

const DAY_NOTES: readonly { offset: number; note: string }[] = [
  { offset: 0, note: 'Hétfőn erős edzésnap volt — a fehérjecélt is hoztad, ez látszott az energiaszinteden.' },
  { offset: 1, note: 'A röplabda estéd rövidebb alvást hozott, de a hangulatod tartotta magát.' },
  { offset: 2, note: 'Szerdán volt a heted legjobb alvása — ez a nap vitte a legtöbb pontot.' },
  { offset: 4, note: 'Pénteken könnyebb edzés, de a makrók továbbra is célban.' },
  { offset: 6, note: 'Vasárnap pihenőnap volt, mégis logoltál mindent — ez tartja a heti ritmust.' },
]

const HIGHLIGHTS: WeeklyReview['highlights'] = [
  { kind: 'Pattern', label: 'Edzésnapokon jobban alszol' },
  { kind: 'Fact', label: 'A fehérjecél tartása javítja a check-in energiát' },
]

/** `startIso` is the requested ISO Monday. Null for the CURRENT week (not generated yet — the
 *  WeeklyReviewJob only writes a row for a COMPLETED week), the re-dated seed otherwise. */
export function mockWeeklyReview(startIso: string): WeeklyReview | null {
  if (startIso === mondayIso()) return null
  return {
    id: mockWeeklyReviewId,
    weekStart: startIso,
    summary:
      'Erős hét volt: a fehérjecélt öt napon tartottad, és a legjobb alvásod pont az edzésnappal esett egybe. ' +
      'A csütörtöki adathiány nem tört meg semmit — a hétvégi pihenőnap logolása visszahozta a ritmust.',
    dayNotes: DAY_NOTES.map((n) => ({ date: addDays(startIso, n.offset), note: n.note })),
    highlights: HIGHLIGHTS.map((h) => ({ ...h })),
    generatedAt: `${addDays(startIso, 7)}T06:15:00Z`,
    stale: false,
  }
}

const mockDigestFactId = 'b1a0c9e2-4f3d-4a2b-8e1c-6d5a9f0b2c31'
const mockDigestLifeEventId = 'd4e5f6a7-1b2c-4d3e-9f8a-0b1c2d3e4f5a'
const mockDigestPredictionId = '7f6e5d4c-3b2a-4190-8877-665544332211'

/** Reused/re-dated for every browsed week (mock has no "in-progress week" concept for the
 *  digest — it is a raw code-collected read, independent of whether the review row exists). */
export function mockWeeklyReviewDigest(startIso: string): WeeklyReviewDigest {
  return {
    patterns: [{ pairKey: 'sleep_workout', title: 'Edzésnapokon jobban alszol', event: 'confirmed' }],
    newFacts: [{ id: mockDigestFactId, text: 'A fehérjecél tartása javítja a check-in energiát.' }],
    lifeEvents: [{ id: mockDigestLifeEventId, title: 'Nyaralás kezdete', occurredOn: addDays(startIso, 5) }],
    memoir: true,
    predictions: [{ id: mockDigestPredictionId, title: 'A súly csökkenő trendje folytatódik fehérjecél mellett', status: 'pending' }],
  }
}

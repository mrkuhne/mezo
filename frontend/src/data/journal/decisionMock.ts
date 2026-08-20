import type { DecisionEntry } from '@/data/journal/decisionTypes'

/** Mock seed: one decision due for review, one still ripening, one already reviewed — so the
 * /me/naplo decisions block renders all three states in mock mode. `dec2.reviewDue` is pinned to
 * 2026-08-15 to line up with `JournalPage.test.tsx`'s frozen "today" (the same date the page's
 * own decisions-block test asserts a due chip against) — keep the two in sync if either changes. */
export const mockDecisions: DecisionEntry[] = [
  {
    id: 'dec3',
    decidedOn: '2026-08-18',
    decisionText: 'Szeptembertől heti négy edzésre váltok háromról.',
    reviewDue: '2026-09-17',
    reviewedAt: null,
    outcomeRating: null,
    outcomeText: null,
    createdAt: '2026-08-18T20:10:00Z',
  },
  {
    id: 'dec2',
    decidedOn: '2026-07-21',
    decisionText: 'Esti edzésre váltok a reggeli helyett, mert reggel sosem alszom eleget.',
    reviewDue: '2026-08-15',
    reviewedAt: null,
    outcomeRating: null,
    outcomeText: null,
    createdAt: '2026-07-21T21:30:00Z',
  },
  {
    id: 'dec1',
    decidedOn: '2026-06-10',
    decisionText: 'Kihagyom a nyári versenyt, és inkább alapozok.',
    reviewDue: '2026-07-10',
    reviewedAt: '2026-07-11T08:00:00Z',
    outcomeRating: 4,
    outcomeText: 'Jó döntés volt, ősszel sokkal frissebb voltam.',
    createdAt: '2026-06-10T19:00:00Z',
  },
]

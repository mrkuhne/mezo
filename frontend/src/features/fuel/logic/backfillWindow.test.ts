// A13 (mezo-33k6): a 7 napos pótlási ablak EGY szabály — a Mai lapozója és a naplózó
// ugyanebből olvas, hogy a lapozó ne érhessen el olyan napot, ahova a naplózó nem enged.
import { MAX_BACKFILL_DAYS, backfillDate, backfillOffset, earliestBackfillDate } from '@/features/fuel/logic/backfillWindow'

const TODAY = '2026-09-12'

test('a hét napon belüli nap a saját eltolását adja', () => {
  expect(backfillOffset('2026-09-11', TODAY)).toBe(1)
  expect(backfillOffset('2026-09-05', TODAY)).toBe(7)
  expect(backfillDate('2026-09-09', TODAY)).toBe('2026-09-09')
})

test('az ablakon kívüli, jövőbeli és értelmezhetetlen nap MA-ra esik vissza', () => {
  expect(backfillOffset('2026-09-04', TODAY)).toBe(0) // 8 nap — túl régi
  expect(backfillOffset('2026-09-13', TODAY)).toBe(0) // jövő
  expect(backfillOffset('nem-datum', TODAY)).toBe(0)
  expect(backfillOffset(null, TODAY)).toBe(0)
  expect(backfillDate('2026-09-04', TODAY)).toBe(TODAY)
})

test('a lapozó alsó kapuja pontosan az ablak széle', () => {
  expect(earliestBackfillDate(TODAY)).toBe('2026-09-05')
  expect(backfillOffset(earliestBackfillDate(TODAY), TODAY)).toBe(MAX_BACKFILL_DAYS)
})

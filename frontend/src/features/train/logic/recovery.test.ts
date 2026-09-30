import { describe, expect, test } from 'vitest'
import {
  ESTIMATE_CHIPS,
  categoryCopy,
  estimateCopy,
  protectedDayRows,
  returnCopy,
} from '@/features/train/logic/recovery'
import type { RecoveryReturn, RecoveryState } from '@/data/train/recoveryApi'

// The Fuel/skip shame vocabulary (glycemicBand.test.ts, skipCopy.test.ts) — no copy string may judge.
const SHAME = [
  'elrontott', 'elrontod', 'elrontottad', 'hiba', 'hibás', 'rossz', 'túlléptél',
  'túlléptem', 'bűn', 'kudarc', 'szégyen', 'vétek', 'tilos', 'bukta', 'mulasztottál', 'lusta',
]

const state = (over: Partial<RecoveryState> = {}): RecoveryState => ({
  period: {
    id: 'p1', category: 'ILLNESS', estimate: 'FEW_DAYS', startDate: '2026-09-28', expectedEnd: '2026-09-30',
    endedOn: null, dayIndex: 2, estimateExpired: false, checkedInToday: false,
    releasedDates: [], releasedUnlightened: [], return: null,
  },
  protectedDates: ['2026-09-28', '2026-09-29'],
  comeback: null,
  ...over,
})

const ret = (over: Partial<RecoveryReturn>): RecoveryReturn => ({
  rule: 'CONTINUE', daysOut: 2, rampSessions: 1, shiftDays: 0, newEndDate: null, ...over,
})

describe('protectedDayRows', () => {
  test('one excused, serious DAY/RECOVERY row per protected date, carrying the period category', () => {
    expect(protectedDayRows(state())).toEqual([
      { id: 'recovery:2026-09-28', kind: 'DAY', date: '2026-09-28', reasonCategory: 'ILLNESS', source: 'RECOVERY', excused: true, serious: true, freePass: false },
      { id: 'recovery:2026-09-29', kind: 'DAY', date: '2026-09-29', reasonCategory: 'ILLNESS', source: 'RECOVERY', excused: true, serious: true, freePass: false },
    ])
  })

  test('no state / no dates → no rows; no shown period → NONE, never a guessed category', () => {
    expect(protectedDayRows(undefined)).toEqual([])
    expect(protectedDayRows(state({ protectedDates: [] }))).toEqual([])
    expect(protectedDayRows(state({ period: null, protectedDates: ['2026-09-25'] }))[0]?.reasonCategory).toBe('NONE')
  })
})

test('estimate chips: Csak ma · 2–3 nap · Kb. egy hét · Nem tudom', () => {
  expect(ESTIMATE_CHIPS.map((c) => c.label)).toEqual(['Csak ma', '2–3 nap', 'Kb. egy hét', 'Nem tudom'])
  expect(ESTIMATE_CHIPS.map((c) => c.value)).toEqual(['TODAY', 'FEW_DAYS', 'WEEK', 'UNKNOWN'])
})

test('category + estimate copy (prototype kmTitle)', () => {
  expect(categoryCopy('ILLNESS')).toBe('Beteg vagy')
  expect(categoryCopy('STOMACH')).toBe('Gyomorrontás')
  expect(categoryCopy('INJURY')).toBe('Sérülés / fájdalom')
  expect(categoryCopy('TRAVEL')).toBe('Úton vagy')
  expect(categoryCopy('TIRED')).toBeNull()
  expect(estimateCopy('FEW_DAYS')).toBe('becslés: 2–3 nap')
  expect(estimateCopy('TODAY', true)).toBe('becslés: csak ma volt')
  expect(estimateCopy('UNKNOWN')).toBe('még nem tudod, meddig tart')
})

describe('returnCopy — the three rules', () => {
  test('CONTINUE (≤2 days): the programme goes on by the calendar, one lightened session', () => {
    const c = returnCopy(ret({ rule: 'CONTINUE', daysOut: 2, rampSessions: 1 }))
    expect(c.line).toBe('2 nap kiesés · a program megy tovább a naptár szerint.')
    expect(c.ramp).toBe('Az első edzés könnyített: harmadával kevesebb sorozat, kb. 10%-kal kisebb súly.')
  })

  test('RESUME (3–9 days): the week repeats, the end moves one week (prototype line verbatim)', () => {
    const c = returnCopy(ret({ rule: 'RESUME', daysOut: 3, rampSessions: 2, shiftDays: 7, newEndDate: '2026-10-25' }), { week: 3 })
    expect(c.headline).toBe('3 nap kiesés')
    expect(c.line).toBe('3 nap kiesés · onnan folytatod, ahol abbahagytad: a 3. hét ismétlődik, a program vége egy héttel később lesz (okt. 18. → okt. 25.).')
    expect(c.ramp).toBe('Az első 2 edzés könnyített: harmadával kevesebb sorozat; az elsőn kb. 10%-kal kisebb súly, a másodikon a régi.')
  })

  test('STEP_BACK (≥10 days): one week back, the end moves two weeks (prototype line verbatim)', () => {
    const c = returnCopy(ret({ rule: 'STEP_BACK', daysOut: 11, rampSessions: 2, shiftDays: 14, newEndDate: '2026-11-01' }), { week: 2 })
    expect(c.line).toBe('11 nap kiesés · egy hetet visszalépünk: a 2. héttel folytatod, a program vége 2 héttel később lesz (okt. 18. → nov. 1.).')
  })

  test('missing data is left out, never invented', () => {
    expect(returnCopy(ret({ rule: 'RESUME', daysOut: 4, rampSessions: 2, shiftDays: 7, newEndDate: null })).program)
      .toBe('onnan folytatod, ahol abbahagytad, a program vége egy héttel később lesz.')
    expect(returnCopy(ret({ rule: 'RESUME', daysOut: 3, rampSessions: 2, shiftDays: 0 })).program)
      .toBe('a programod nem csúszik, onnan folytatod, ahol abbahagytad.')
    expect(returnCopy(ret({ rule: 'STEP_BACK', daysOut: 10, rampSessions: 2, shiftDays: 0 })).program)
      .toBe('a programod nem csúszik.')
  })
})

test('no shame vocabulary in any recovery copy string', () => {
  const out: string[] = [
    ...ESTIMATE_CHIPS.map((c) => c.label),
    ...(['ILLNESS', 'STOMACH', 'INJURY', 'TRAVEL'] as const).map((c) => categoryCopy(c) ?? ''),
    ...(['TODAY', 'FEW_DAYS', 'WEEK', 'UNKNOWN'] as const).flatMap((e) => [estimateCopy(e), estimateCopy(e, true)]),
  ]
  for (const r of [
    ret({ rule: 'CONTINUE', daysOut: 1 }),
    ret({ rule: 'RESUME', daysOut: 5, rampSessions: 2, shiftDays: 7, newEndDate: '2026-10-25' }),
    ret({ rule: 'STEP_BACK', daysOut: 12, rampSessions: 2, shiftDays: 14, newEndDate: '2026-11-01' }),
    ret({ rule: 'RESUME', daysOut: 3, rampSessions: 2 }),
  ]) {
    for (const week of [undefined, 3]) {
      const c = returnCopy(r, { week })
      out.push(c.line, c.ramp)
    }
  }
  for (const s of out) for (const w of SHAME) expect(s.toLowerCase(), `„${w}": ${s}`).not.toContain(w)
})

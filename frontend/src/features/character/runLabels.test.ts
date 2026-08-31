import { describe, expect, test } from 'vitest'
import { KIND_BADGE, KIND_LABEL, lastRunLine, QUIET_LEDE, runHeroLede, runRowSubline } from './runLabels'
import type { CharacterRunSummary } from '@/data/character/characterApi'

function run(overrides: Partial<CharacterRunSummary>): CharacterRunSummary {
  return {
    id: 'r1',
    kind: 'NIGHTLY',
    day: '2026-08-27', // a Thursday
    observationCount: 0,
    callCount: 0,
    detectorKeys: [],
    expertKeys: [],
    conferenceId: null,
    ...overrides,
  }
}

describe('runHeroLede', () => {
  test('a quiet nightly run gets the proud QUIET_LEDE, never a fabricated sentence', () => {
    expect(runHeroLede(run({ kind: 'NIGHTLY', observationCount: 0 }))).toBe(QUIET_LEDE)
  })

  test('a signal nightly run derives the sentence from the real counts + expert names', () => {
    const r = run({
      kind: 'NIGHTLY', observationCount: 2, callCount: 2,
      expertKeys: ['taplalkozo', 'drill'],
    })
    const text = runHeroLede(r, (k) => (k === 'taplalkozo' ? 'Táplálkozó' : 'Drill'))
    expect(text).toContain('2 jel tüzelt')
    expect(text).toContain('2 megfigyelés készült')
    expect(text).toContain('Táplálkozó, Drill')
    expect(text).toContain('csütörtöki') // 2026-08-27 is a Thursday
  })

  test('a WEEKLY lede reports the consumed-observation count only, never a call count', () => {
    const text = runHeroLede(run({ kind: 'WEEKLY', observationCount: 7, day: '2026-08-24' }))
    expect(text).toBe('A hét 7 megfigyelését dolgoztuk fel a konzíliumon.')
  })

  test('a MONTHLY lede reports the re-evaluated claim count', () => {
    const text = runHeroLede(run({ kind: 'MONTHLY', observationCount: 16, day: '2026-08-01' }))
    expect(text).toContain('16')
  })

  test('a BOOTSTRAP lede reports the seeded claim count', () => {
    const text = runHeroLede(run({ kind: 'BOOTSTRAP', observationCount: 9, day: '2026-07-15' }))
    expect(text).toContain('9 kezdő állítás')
  })
})

describe('runRowSubline — the honest-callCount ruling', () => {
  test('NIGHTLY quiet -> "csendes nap · 0 hívás"', () => {
    expect(runRowSubline(run({ kind: 'NIGHTLY', observationCount: 0 }))).toBe('csendes nap · 0 hívás')
  })

  test('NIGHTLY signal -> observation + expert count, never a fabricated call count', () => {
    const r = run({ kind: 'NIGHTLY', observationCount: 3, expertKeys: ['doki', 'drill'] })
    expect(runRowSubline(r)).toBe('3 megfigyelés · 2 szakértő hívva')
  })

  test('WEEKLY never renders a "0 hívás" cell — callCount is omitted entirely', () => {
    const r = run({ kind: 'WEEKLY', observationCount: 7, callCount: 0 })
    const text = runRowSubline(r)
    expect(text).not.toMatch(/hívás/)
    expect(text).toBe('7 megfigyelés feldolgozva')
  })

  test('MONTHLY never renders a "0 hívás" cell', () => {
    expect(runRowSubline(run({ kind: 'MONTHLY', observationCount: 16, callCount: 0 }))).not.toMatch(/hívás/)
  })

  test('BOOTSTRAP never renders a "0 hívás" cell', () => {
    expect(runRowSubline(run({ kind: 'BOOTSTRAP', observationCount: 9, callCount: 0 }))).not.toMatch(/hívás/)
  })
})

test('lastRunLine is undefined for no run (the hub row renders nothing rather than inventing one)', () => {
  expect(lastRunLine(undefined)).toBeUndefined()
})

test('lastRunLine composes the date + row subline', () => {
  const r = run({ kind: 'NIGHTLY', observationCount: 0, day: '2026-08-30' })
  expect(lastRunLine(r)).toContain('csendes nap · 0 hívás')
})

test('KIND_BADGE and KIND_LABEL cover all four run kinds', () => {
  const kinds: CharacterRunSummary['kind'][] = ['NIGHTLY', 'WEEKLY', 'MONTHLY', 'BOOTSTRAP']
  kinds.forEach((k) => {
    expect(KIND_BADGE[k]).toBeTruthy()
    expect(KIND_LABEL[k]).toBeTruthy()
  })
})

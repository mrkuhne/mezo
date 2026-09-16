// libraryStory.test.ts
import { describe, expect, test } from 'vitest'
import { runStars, templateStory } from '@/features/train/logic/libraryStory'
import { starsFor } from '@/features/train/logic/cerScore'
import type { Mesocycle } from '@/data/types'

const meso = (over: Partial<Mesocycle> & Pick<Mesocycle, 'id' | 'status'>): Mesocycle => ({
  title: 'T',
  shortTitle: 'T',
  goal: '',
  startDate: '2026-01-01',
  endDate: '2026-02-01',
  weeks: 6,
  currentWeek: 1,
  split: 'Pull / Push / Legs · 5×/hét',
  style: 'RP · 6 hét',
  phaseCurve: [],
  ...over,
})

describe('runStars', () => {
  test('null completion -> null', () => {
    expect(runStars(null)).toBeNull()
  })

  test('0% -> 0 stars, "Ez a futam nem indult el."', () => {
    const r = runStars(0)
    expect(r).not.toBeNull()
    expect(r!.share).toBe(0)
    expect(r!.stars).toBe(starsFor(0))
    expect(r!.say).toBe('Ez a futam nem indult el.')
  })

  test('49% -> below-half say, halves stars from starsFor', () => {
    const r = runStars(49)!
    expect(r.share).toBeCloseTo(0.49)
    expect(r.stars).toBe(starsFor(0.49))
    expect(r.say).toBe('Elindult, aztán másfelé vitt az élet.')
  })

  test('50% -> "A nagyobb fele megvan."', () => {
    const r = runStars(50)!
    expect(r.say).toBe('A nagyobb fele megvan.')
  })

  test('75% -> "Erős futam volt."', () => {
    const r = runStars(75)!
    expect(r.say).toBe('Erős futam volt.')
  })

  test('95% -> "Végigvitted."', () => {
    const r = runStars(95)!
    expect(r.share).toBeCloseTo(0.95)
    expect(r.stars).toBe(starsFor(0.95))
    expect(r.say).toBe('Végigvitted.')
  })

  test('100% -> "Végigvitted.", full stars', () => {
    const r = runStars(100)!
    expect(r.share).toBe(1)
    expect(r.stars).toBe(5)
    expect(r.say).toBe('Végigvitted.')
  })
})

describe('templateStory', () => {
  test('empty mesocycle list -> all zero/false', () => {
    const s = templateStory('tpl-1', 'Erő blokk', [])
    expect(s).toEqual({ activeNow: false, plannedCount: 0, closedCount: 0 })
  })

  test('matches by templateId when the run carries one, even if the name differs', () => {
    const mesocycles: Mesocycle[] = [
      meso({ id: 'r1', status: 'active', templateId: 'tpl-1', title: 'Renamed run' }),
      meso({ id: 'r2', status: 'planned', templateId: 'tpl-2', title: 'Erő blokk' }), // different template, same name — must NOT count
    ]
    const s = templateStory('tpl-1', 'Erő blokk', mesocycles)
    expect(s).toEqual({ activeNow: true, plannedCount: 0, closedCount: 0 })
  })

  test('falls back to name matching only for runs with no templateId', () => {
    const mesocycles: Mesocycle[] = [
      meso({ id: 'r1', status: 'planned', templateId: null, title: 'Erő blokk' }),
      meso({ id: 'r2', status: 'planned', templateId: null, shortTitle: 'Erő blokk', title: 'Full name differs' }),
      meso({ id: 'r3', status: 'planned', templateId: null, title: 'Something else entirely' }),
    ]
    const s = templateStory('tpl-1', 'Erő blokk', mesocycles)
    expect(s.plannedCount).toBe(2)
    expect(s.activeNow).toBe(false)
  })

  test('counts activeNow / plannedCount / closedCount independently', () => {
    const mesocycles: Mesocycle[] = [
      meso({ id: 'r1', status: 'active', templateId: 'tpl-1' }),
      meso({ id: 'r2', status: 'planned', templateId: 'tpl-1' }),
      meso({ id: 'r3', status: 'planned', templateId: 'tpl-1' }),
      meso({ id: 'r4', status: 'archived', templateId: 'tpl-1', closedAt: '2026-03-01' }),
      meso({ id: 'r5', status: 'archived', templateId: 'tpl-1', closedAt: '2026-04-01' }),
      meso({ id: 'r6', status: 'active', templateId: 'other-tpl' }),
    ]
    const s = templateStory('tpl-1', 'Erő blokk', mesocycles)
    expect(s).toEqual({ activeNow: true, plannedCount: 2, closedCount: 2 })
  })

  test('no active run from this template -> activeNow false', () => {
    const mesocycles: Mesocycle[] = [
      meso({ id: 'r1', status: 'planned', templateId: 'tpl-1' }),
      meso({ id: 'r2', status: 'archived', templateId: 'tpl-1', closedAt: '2026-03-01' }),
    ]
    const s = templateStory('tpl-1', 'Erő blokk', mesocycles)
    expect(s.activeNow).toBe(false)
  })
})

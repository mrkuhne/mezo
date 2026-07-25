import { describe, expect, it } from 'vitest'
import { openLoops } from '@/features/ritual/logic/openLoops'
import type { CheckinSlot, IntentionDay } from '@/data/types'

const slot = (state: CheckinSlot['state']): CheckinSlot => ({ time: '08:00', state, values: null, note: null })

const intentionDay = (overrides: Partial<IntentionDay> = {}): IntentionDay => ({
  date: '2026-07-25',
  creed: 'Jelen lenni.',
  foci: [],
  reflection: null,
  focusCap: 3,
  ...overrides,
})

const FOCUS = { id: 'f1', focusDate: '2026-07-25', text: 'Jelenlét a meetingen' }

describe('openLoops', () => {
  it.each([
    ['now', true],
    ['pending', true],
    ['done', false],
    ['skipped', false],
  ] as const)('a %s slot -> checkinOpen %s (all-else closed)', (state, expected) => {
    const result = openLoops({ checkins: [slot(state)], intention: intentionDay() })
    expect(result.checkinOpen).toBe(expected)
  })

  it('any slot still now/pending among several -> checkinOpen true', () => {
    const checkins = [slot('done'), slot('done'), slot('now'), slot('pending')]
    expect(openLoops({ checkins, intention: intentionDay() }).checkinOpen).toBe(true)
  })

  it('all slots done/skipped -> checkinOpen false', () => {
    const checkins = [slot('done'), slot('done'), slot('skipped'), slot('done')]
    expect(openLoops({ checkins, intention: intentionDay() }).checkinOpen).toBe(false)
  })

  it('reflection null with >= 1 focus -> reflectOpen true', () => {
    const intention = intentionDay({ foci: [FOCUS], reflection: null })
    expect(openLoops({ checkins: [slot('done')], intention }).reflectOpen).toBe(true)
  })

  it('reflection already set -> reflectOpen false, even with foci', () => {
    const intention = intentionDay({ foci: [FOCUS], reflection: 'yes' })
    expect(openLoops({ checkins: [slot('done')], intention }).reflectOpen).toBe(false)
  })

  it('no foci at all -> reflectOpen false (nothing to reflect on)', () => {
    const intention = intentionDay({ foci: [], reflection: null })
    expect(openLoops({ checkins: [slot('done')], intention }).reflectOpen).toBe(false)
  })

  it('all closed: done check-ins + reflected focus -> both false', () => {
    const checkins = [slot('done'), slot('done'), slot('done'), slot('done')]
    const intention = intentionDay({ foci: [FOCUS], reflection: 'partial' })
    expect(openLoops({ checkins, intention })).toEqual({ checkinOpen: false, reflectOpen: false })
  })
})

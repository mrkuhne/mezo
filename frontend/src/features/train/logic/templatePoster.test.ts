import { describe, expect, test } from 'vitest'
import { daySpine, templateWash, weekArc } from '@/features/train/logic/templatePoster'
import type { MesoDay, MesoTemplate } from '@/data/types'

const day = (day: string, type: string, muscle: string): MesoDay => ({
  day, type, muscle, exerciseCount: 0, exercises: [],
})

const template = (over: Partial<MesoTemplate> = {}): MesoTemplate => ({
  id: 't1', title: 'T', shortTitle: null, goal: null, goalPreset: 'hypertrophy',
  musclePriorities: null, weeks: 6, split: null, style: null,
  phaseCurve: ['MEV', 'MAV', 'MAV', 'MAV', 'MRV', 'Deload'],
  notes: null, volumePerMuscle: null, days: [], runCount: 0, ...over,
})

describe('weekArc — the block drawn as a ramp of weekly bars', () => {
  test('one bar per phase-curve week, the deload one flagged and short', () => {
    const arc = weekArc(template())
    expect(arc).toHaveLength(6)
    expect(arc.map(w => w.deload)).toEqual([false, false, false, false, false, true])
    expect(arc[5].height).toBeLessThan(arc[0].height)
  })

  test('the ramp weeks rise from the first to the peak', () => {
    const heights = weekArc(template()).filter(w => !w.deload).map(w => w.height)
    expect(heights[heights.length - 1]).toBe(1)
    expect([...heights]).toEqual([...heights].sort((a, b) => a - b))
    expect(new Set(heights).size).toBe(heights.length)
  })

  test('an empty phase curve falls back to the length-derived one', () => {
    const arc = weekArc(template({ phaseCurve: [], weeks: 4 }))
    expect(arc).toHaveLength(4)
    expect(arc[3].deload).toBe(true)
  })

  test('a legacy curve with no deload week draws no deload bar', () => {
    const arc = weekArc(template({ phaseCurve: ['MEV', 'MAV', 'MRV'] }))
    expect(arc.some(w => w.deload)).toBe(false)
    expect(arc.map(w => w.height)).toEqual([0.45, 0.73, 1])
  })
})

describe('daySpine — the week as seven slots', () => {
  test('seven slots in DAY_ORDER, training days lettered by their type', () => {
    const spine = daySpine([
      day('Hét', 'Upper A', 'chest+back'),
      day('Kedd', 'Lower A', 'quad+ham'),
      day('Sze', 'Rest', ''),
      day('Csü', 'Push · light', 'chest+shoulder'),
    ])
    expect(spine).toHaveLength(7)
    expect(spine.map(s => s.day)).toEqual(['Hét', 'Kedd', 'Sze', 'Csü', 'Pén', 'Szo', 'Vas'])
    expect(spine.map(s => s.letter)).toEqual(['U', 'L', null, 'P', null, null, null])
  })

  test('a sport day is an off-day, not a training letter', () => {
    const spine = daySpine([day('Szo', 'Volleyball · meccs', 'sport')])
    expect(spine[5].letter).toBeNull()
  })
})

describe('templateWash — the card colour carries what the block is for', () => {
  test('a current block with an emphasised muscle keeps the Edzés coral', () => {
    expect(templateWash(template({ musclePriorities: { back: 'emphasize' } }))).toBe('coral')
  })

  test('a current block with nothing emphasised goes gold', () => {
    expect(templateWash(template({ musclePriorities: null }))).toBe('gold')
    expect(templateWash(template({ musclePriorities: { back: 'grow' } }))).toBe('gold')
  })

  test('a legacy plan is sage even with an emphasis — it converts on start', () => {
    expect(templateWash(template({
      goalPreset: 'strength',
      musclePriorities: { back: 'emphasize' },
    }))).toBe('sage')
    expect(templateWash(template({ phaseCurve: ['MEV', 'MAV'] }))).toBe('sage')
  })
})

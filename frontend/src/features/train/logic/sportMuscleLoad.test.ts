import { describe, expect, it } from 'vitest'
import type { VolleyballSession } from '@/data/types'
import type { RunPrescribedSession } from '@/data/train/runningApi'
import { sportLoadForWeek } from '@/features/train/logic/sportMuscleLoad'

const slot = (day: string, sport?: VolleyballSession['sport']): VolleyballSession => ({
  day, time: '18:00', duration: 90, court: 'X', intensity: 'közepes', role: 'edzés', ...(sport ? { sport } : {}),
})
const runSession = (kind: string, workSegments: number): RunPrescribedSession => ({
  key: `${kind}-1`, dayOfWeek: 5, timeOfDay: '09:00', label: 'Sprint-intervallum', kind,
  rpeTarget: { min: 8, max: 9 },
  segments: [
    { type: 'warmup', durationSec: 300 },
    ...Array.from({ length: workSegments }, () => ({ type: 'work' as const, durationSec: 15 })),
    { type: 'cooldown', durationSec: 300 },
  ],
})

describe('sportLoadForWeek', () => {
  it('aggregates repeated kinds per muscle with a count', () => {
    const r = sportLoadForWeek([slot('Hét'), slot('Kedd')], [])
    expect(r.perMuscle.shoulder).toEqual([{ kind: 'volleyball', label: 'Röpi', load: 3, count: 2 }])
    expect(r.perMuscle.quad?.[0]).toMatchObject({ load: 2, count: 2 })
  })
  it('maps TRX and sprint-run loads onto their muscles', () => {
    const r = sportLoadForWeek([slot('Sze', 'trx')], [runSession('sprint', 6)])
    expect(r.perMuscle.core).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'trx', load: 3 }),
      expect.objectContaining({ kind: 'run-sprint', load: 1, label: 'futás' }),
    ]))
    expect(r.perMuscle.ham?.[0]).toMatchObject({ kind: 'run-sprint', load: 3 })
  })
  it('emits one event per slot/session with region-aggregated loads', () => {
    const r = sportLoadForWeek([slot('Hét')], [runSession('sprint', 6)])
    expect(r.events).toHaveLength(2)
    const vb = r.events[0]
    expect(vb).toMatchObject({ tag: 'RÖPI', title: 'Röplabda', day: 'Hét', time: '18:00' })
    expect(vb.regionLoads).toEqual([
      { region: 'lav', label: 'Váll', load: 3 },
      { region: 'sage', label: 'Láb', load: 2 },
      { region: 'amber', label: 'Core', load: 1 },
    ])
    const run = r.events[1]
    expect(run).toMatchObject({ tag: 'FUTÁS', title: 'Sprint-intervallum', day: 'Szo', time: '09:00' })
    expect(run.regionLoads[0]).toEqual({ region: 'sage', label: 'Láb', load: 3 })
  })
  it('handles empty inputs', () => {
    expect(sportLoadForWeek([], [])).toEqual({ perMuscle: {}, events: [] })
  })
})

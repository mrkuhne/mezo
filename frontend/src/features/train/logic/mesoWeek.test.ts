import { describe, expect, it } from 'vitest'
import { muscleTiles, previousBlock, weekSummary, whereItWorks } from './mesoWeek'
import { runBands } from './mesoBands'
import type { Mesocycle, MesoVolumeArc } from '@/data/types'

const src = { baseline: { name: 'RP', mev: 10, mav: 16, mrv: 22 }, adjustments: [], confidence: 0.5 }

function week(w: number, planned: number, phase: 'MEV' | 'MAV' | 'MRV' | 'Deload', isCurrent: boolean) {
  return { week: w, phase, planned, actual: isCurrent ? planned : w < 3 ? planned : null, isCurrent }
}

const meso = {
  id: 'm1', status: 'active', title: 'T', shortTitle: 'T', goal: '', startDate: '2026-09-01', endDate: '2026-10-12',
  weeks: 6, currentWeek: 3, split: 'Upper / Lower · 4×/hét', style: 'RP · 6 hét',
  phaseCurve: ['MEV', 'MEV', 'MAV', 'MAV', 'MRV', 'Deload'],
  musclePriorities: { back: 'emphasize', calf: 'maintain' },
  volumePerMuscle: {
    back: { mev: 10, mav: 16, mrv: 22, current: 16, source: src },
    chest: { mev: 8, mav: 16, mrv: 20, current: 14, source: src },
    calf: { mev: 6, mav: 10, mrv: 16, current: 6, source: src },
  },
  volumeRecompute: { lastRun: '', nextRun: '', trigger: '', changes: [{ muscle: 'chest', change: 'tart (14)', reason: 'tartás' }] },
  days: [
    {
      day: 'Hét', type: 'Upper', muscle: 'back+chest', exerciseCount: 2,
      exercises: [
        { id: 'e1', name: 'Chest Supported Row', muscle: 'back-mid', warmupSets: 1, workingSets: 4, repMin: 8, repMax: 10, targetRIR: 1, type: 'compound' },
        { id: 'e2', name: 'Bench Press', muscle: 'chest-mid', warmupSets: 1, workingSets: 3, repMin: 6, repMax: 8, targetRIR: 1, type: 'compound' },
      ],
    },
    {
      day: 'Csü', type: 'Upper', muscle: 'back+chest', exerciseCount: 2,
      exercises: [
        { id: 'e3', name: 'Lat Pulldown', muscle: 'back-wide', warmupSets: 1, workingSets: 3, repMin: 10, repMax: 12, targetRIR: 1, type: 'compound' },
        { id: 'e4', name: 'Incline DB Press', muscle: 'chest-upper', warmupSets: 1, workingSets: 3, repMin: 8, repMax: 10, targetRIR: 1, type: 'compound' },
      ],
    },
    { day: 'Sze', type: 'Legs', muscle: 'quad', exerciseCount: 1, exercises: [
      { id: 'e5', name: 'Squat', muscle: 'quad', warmupSets: 1, workingSets: 3, repMin: 6, repMax: 8, targetRIR: 1, type: 'compound' },
    ] },
  ],
} as unknown as Mesocycle

const arc: MesoVolumeArc = {
  mesocycleId: 'm1', title: 'T', currentWeek: 3, weeks: 6, startDate: '2026-09-01', endDate: '2026-10-12',
  status: 'active', phaseCurve: ['MEV', 'MEV', 'MAV', 'MAV', 'MRV', 'Deload'],
  muscles: [
    { muscle: 'back', region: 'sky', mrv: 22, weeks: [week(1, 10, 'MEV', false), week(2, 14, 'MEV', false), week(3, 16, 'MAV', true), week(4, 18, 'MAV', false), week(5, 20, 'MRV', false), week(6, 10, 'Deload', false)] },
    { muscle: 'chest', region: 'coral', mrv: 20, weeks: [week(1, 8, 'MEV', false), week(2, 12, 'MEV', false), week(3, 14, 'MAV', true), week(4, 14, 'MAV', false), week(5, 14, 'MRV', false), week(6, 7, 'Deload', false)] },
    { muscle: 'calf', region: 'sage', mrv: 16, weeks: [week(1, 6, 'MEV', false), week(2, 6, 'MEV', false), week(3, 6, 'MAV', true), week(4, 6, 'MAV', false), week(5, 6, 'MRV', false), week(6, 6, 'Deload', false)] },
  ],
}

describe('weekSummary', () => {
  it('sums this week vs. last week and derives delta', () => {
    const s = weekSummary(arc, runBands(meso))
    expect(s.total).toBe(16 + 14 + 6)
    expect(s.prev).toBe(14 + 12 + 6)
    expect(s.delta).toBe(s.total - s.prev!)
    expect(s.up).toBe(2) // back (emphasize) + chest (grow), both under ceiling
    expect(s.hold).toBe(1) // calf (maintain)
  })

  it('prev is null at week 1', () => {
    const w1arc: MesoVolumeArc = { ...arc, currentWeek: 1 }
    const w1meso = { ...meso, currentWeek: 1 } as unknown as Mesocycle
    const s = weekSummary(w1arc, runBands(w1meso))
    expect(s.prev).toBeNull()
    expect(s.delta).toBeNull()
  })
})

describe('muscleTiles', () => {
  const tiles = muscleTiles(arc, meso)

  it('joins arc + bands, sorted by ceiling (emphasize first)', () => {
    expect(tiles.map((t) => t.group)).toEqual(['back', 'chest', 'calf'])
    expect(tiles[0]).toMatchObject({ tier: 'emphasize', current: 16, ceiling: 22, prev: 14 })
  })

  it('picks the four status variants', () => {
    expect(tiles.find((t) => t.group === 'calf')).toMatchObject({ statusTone: 'mut', status: 'MV-n tart · nem rámpázik' })
    expect(tiles.find((t) => t.group === 'chest')).toMatchObject({ statusTone: 'gold', status: '= tartás · grind a múlt héten' })
    expect(tiles.find((t) => t.group === 'back')).toMatchObject({ statusTone: 'sage' })
    expect(tiles.find((t) => t.group === 'back')!.status).toContain('▲ +2')

    // a muscle at its ceiling with no grind change reads "plafonon"
    const capMeso = {
      ...meso,
      volumeRecompute: undefined,
      volumePerMuscle: { ...meso.volumePerMuscle, chest: { mev: 8, mav: 14, mrv: 20, current: 14, source: src } },
    } as unknown as Mesocycle
    const capArc: MesoVolumeArc = {
      ...arc,
      muscles: arc.muscles.map((m) => (m.muscle === 'chest' ? { ...m, weeks: m.weeks.map((w) => (w.isCurrent ? { ...w, planned: 14 } : w)) } : m)),
    }
    const capped = muscleTiles(capArc, capMeso).find((t) => t.group === 'chest')
    expect(capped).toMatchObject({ statusTone: 'gold', status: 'plafonon' })
  })
})

describe('whereItWorks', () => {
  it('lists the two Upper days with back exercises and sets', () => {
    const rows = whereItWorks(meso, 'back')
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ day: 'Hét', type: 'Upper', sets: 4 })
    expect(rows[0].exercises).toEqual([{ name: 'Chest Supported Row', sets: 4 }])
    expect(rows[1]).toMatchObject({ day: 'Csü', type: 'Upper', sets: 3 })
    expect(rows[1].exercises).toEqual([{ name: 'Lat Pulldown', sets: 3 }])
  })

  it('empty for a group with no days', () => {
    expect(whereItWorks(meso, 'glute')).toEqual([])
  })
})

describe('previousBlock', () => {
  const archived = [
    { id: 'a1', shortTitle: 'Nyár blokk', endDate: '2026-04-01', closedAt: '2026-04-05',
      volumePerMuscle: { back: { mev: 8, mav: 14, mrv: 18, current: 14, source: src } } } as unknown as Mesocycle,
    { id: 'a2', shortTitle: 'Tél blokk', endDate: '2026-01-01', closedAt: '2026-01-10',
      volumePerMuscle: { back: { mev: 6, mav: 12, mrv: 16, current: 12, source: src } } } as unknown as Mesocycle,
  ]

  it('picks the latest archived run', () => {
    expect(previousBlock(archived, 'back')).toEqual({ start: 8, peak: 14, ceiling: 18, title: 'Nyár blokk' })
  })

  it('null when no archived run ever carried the group', () => {
    expect(previousBlock(archived, 'quad')).toBeNull()
    expect(previousBlock([], 'back')).toBeNull()
  })
})

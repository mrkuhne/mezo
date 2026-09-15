import { describe, expect, it } from 'vitest'
import type { Block } from '@/features/train/logic/trainDayEnergy'
import type { WeekZoneRow, WeekZoneStatus } from '@/features/train/logic/weekZone'
import type { SportLoadResult } from '@/features/train/logic/sportMuscleLoad'
import {
  loadGroups, loadWeekTotals, mapHeat, movementWeek, sportReach, untouchedMuscles,
} from '@/features/train/logic/loadWeek'

// Minimal WeekZoneRow builder — only the fields loadWeek.ts's exports read are meaningful,
// the rest are filled with the neutral zero/default so tests read as intent, not boilerplate.
const row = (over: Partial<WeekZoneRow>): WeekZoneRow => ({
  group: 'chest', label: 'Mell', colorMuscle: 'chest-mid', mev: 4, zoneStart: null,
  doneSets: 0, todaySets: 0, plannedSets: 0, doneBudget: 0, todayBudget: 0, planBudget: 0,
  remainingPlanSets: 0, setsToZone: 0, status: 'below',
  ...over,
})

describe('loadWeekTotals', () => {
  it('sums done and planned sets across groups and rounds the honest share', () => {
    const totals = loadWeekTotals([
      row({ doneSets: 6, plannedSets: 10 }),
      row({ group: 'back', doneSets: 4, plannedSets: 10 }),
    ])
    expect(totals).toEqual({ doneSets: 10, plannedSets: 20, percent: 50 })
  })
  it('caps percent at 100 when done overshoots the plan', () => {
    const totals = loadWeekTotals([row({ doneSets: 12, plannedSets: 10 })])
    expect(totals.percent).toBe(100)
  })
  it('is 100% when there is no plan but some work happened (custom-only group)', () => {
    expect(loadWeekTotals([row({ doneSets: 3, plannedSets: 0 })]).percent).toBe(100)
  })
  it('is 0% with nothing done and nothing planned', () => {
    expect(loadWeekTotals([row({ doneSets: 0, plannedSets: 0 })]).percent).toBe(0)
  })
})

describe('loadGroups — ordering and the word ladder', () => {
  it('orders desc by doneSets, ties broken by plannedSets', () => {
    const groups = loadGroups([
      row({ group: 'quad', label: 'Comb', doneSets: 4, plannedSets: 10, remainingPlanSets: 6 }),
      row({ group: 'back', label: 'Hát', doneSets: 4, plannedSets: 20, remainingPlanSets: 16 }),
      row({ group: 'chest', label: 'Mell', doneSets: 8, plannedSets: 8, remainingPlanSets: 0 }),
    ])
    expect(groups.map((g) => g.group)).toEqual(['chest', 'back', 'quad'])
  })

  it('says the week is covered here once nothing remains on the plan', () => {
    const [g] = loadGroups([row({ doneSets: 8, plannedSets: 8, remainingPlanSets: 0 })])
    expect(g.word).toBe('ez a hét itt már megvan')
  })
  it('says the week is covered here for a custom-only group with no plan at all', () => {
    const [g] = loadGroups([row({ doneSets: 3, plannedSets: 0, remainingPlanSets: 0 })])
    expect(g.word).toBe('ez a hét itt már megvan')
  })
  it('counts down remaining sets once some work landed but the plan is not cleared', () => {
    const [g] = loadGroups([row({ doneSets: 4, plannedSets: 10, remainingPlanSets: 6 })])
    expect(g.word).toBe('még 6 szett van hátra')
  })
  it('says the second half builds on it when the plan exists but nothing happened yet', () => {
    const [g] = loadGroups([row({ doneSets: 0, plannedSets: 10, remainingPlanSets: 10 })])
    expect(g.word).toBe('erre a hét második fele épül')
  })
})

describe('mapHeat — done vs planned honesty', () => {
  it('done mode reads each row\'s own live status', () => {
    const heat = mapHeat([
      row({ colorMuscle: 'chest-mid', doneSets: 5, status: 'in' }),
      row({ colorMuscle: 'back-wide', doneSets: 0, status: 'below' }),
    ], 'done')
    expect(heat).toEqual([
      { token: 'chest-mid', level: 'in' },
      { token: 'back-wide', level: 'none' },
    ])
  })
  it('done mode never reports a status for an untouched row even if status says otherwise', () => {
    // doneSets===0 always wins to 'none' in done mode, regardless of the row's own status field
    const heat = mapHeat([row({ colorMuscle: 'quad', doneSets: 0, status: 'in' })], 'done')
    expect(heat).toEqual([{ token: 'quad', level: 'none' }])
  })
  it('planned mode scales off planBudget/mev, not the live status', () => {
    const heat = mapHeat([
      row({ colorMuscle: 'chest-mid', plannedSets: 0, planBudget: 0, status: 'over' }),
      row({ colorMuscle: 'back-wide', plannedSets: 10, mev: 10, planBudget: 0.5, status: 'below' }),
      row({ colorMuscle: 'quad', plannedSets: 2, mev: 4, planBudget: 0.2, status: 'below' }),
      row({ colorMuscle: 'calf', plannedSets: 6, mev: 4, planBudget: 1.4, status: 'below' }),
      row({ colorMuscle: 'glute', plannedSets: 8, mev: null, planBudget: 0.3, status: 'below' }),
    ], 'planned')
    expect(heat).toEqual([
      { token: 'chest-mid', level: 'none' }, // no plan at all → never fabricated
      { token: 'back-wide', level: 'in' }, // plannedSets===mev clears the floor
      { token: 'quad', level: 'below' }, // plan alone never reaches mev
      { token: 'calf', level: 'over' }, // planBudget > 1
      { token: 'glute', level: 'in' }, // no lower bound at all
    ])
  })
  it('every group the week touches is present in both modes, none fabricated', () => {
    const rows = [row({ colorMuscle: 'chest-mid' }), row({ colorMuscle: 'back-wide', plannedSets: 5 })]
    expect(mapHeat(rows, 'done').map((h) => h.token)).toEqual(['chest-mid', 'back-wide'])
    expect(mapHeat(rows, 'planned').map((h) => h.token)).toEqual(['chest-mid', 'back-wide'])
  })
})

describe('untouchedMuscles', () => {
  it('excludes worked groups, even ones the plan also asked something of', () => {
    const rows = [
      row({ group: 'chest', label: 'Mell', plannedSets: 8, doneSets: 0 }),
      row({ group: 'back', label: 'Hát', plannedSets: 10, doneSets: 4 }),
    ]
    expect(untouchedMuscles(rows)).toEqual([{ label: 'Mell', plannedSets: 8, colorMuscle: 'chest-mid' }])
  })
  it('excludes plan-less groups (nothing to be untouched about)', () => {
    expect(untouchedMuscles([row({ plannedSets: 0, doneSets: 0 })])).toEqual([])
  })
  it('orders desc by plannedSets', () => {
    const rows = [
      row({ group: 'quad', label: 'Comb', plannedSets: 6, doneSets: 0 }),
      row({ group: 'back', label: 'Hát', plannedSets: 12, doneSets: 0 }),
    ]
    expect(untouchedMuscles(rows).map((m) => m.label)).toEqual(['Hát', 'Comb'])
  })
})

describe('sportReach', () => {
  it('names the region labels the week\'s sport touched, deduped and estimate-only', () => {
    const load: SportLoadResult = {
      perMuscle: {
        'shoulder-front': [{ kind: 'volleyball', label: 'Röpi', load: 3, count: 1 }],
        quad: [{ kind: 'volleyball', label: 'Röpi', load: 2, count: 1 }],
        calf: [{ kind: 'volleyball', label: 'Röpi', load: 2, count: 1 }],
      },
      events: [],
    }
    expect(sportReach(load)).toEqual(['Váll', 'Láb'])
  })
  it('is empty when nothing landed', () => {
    expect(sportReach({ perMuscle: {}, events: [] })).toEqual([])
  })
})

describe('movementWeek', () => {
  const gymBlock = (minutes: number, done = false): Block => ({ kind: 'gym', minutes, done })

  it('reuses trainDayEnergy\'s math for the gym share and sums logged sport kcal', () => {
    const week = movementWeek([gymBlock(60), gymBlock(30, true)], [{ minutes: 90, kcal: 400 }], 80)
    // gym: 6.0*80*(60/60) + 6.0*80*(30/60) = 480 + 240 = 720
    expect(week).toEqual({ gymMin: 90, sportMin: 90, totalMin: 180, gymKcal: 720, sportKcal: 400, known: true })
  })
  it('is unknown with a null gym kcal on a null weight — same rule as trainDayEnergy — but sport stays known', () => {
    const week = movementWeek([gymBlock(60)], [{ minutes: 30, kcal: 150 }], null)
    expect(week).toEqual({ gymMin: 60, sportMin: 30, totalMin: 90, gymKcal: null, sportKcal: 150, known: false })
  })
  it('is unknown with a null sport kcal when any logged session is missing one', () => {
    const week = movementWeek([], [{ minutes: 30, kcal: 150 }, { minutes: 20, kcal: null }], 80)
    expect(week).toEqual({ gymMin: 0, sportMin: 50, totalMin: 50, gymKcal: 0, sportKcal: null, known: false })
  })
  it('an empty gym side contributes trivially-known zero, never dragging a known sport side down', () => {
    const week = movementWeek([], [{ minutes: 90, kcal: 400 }], null)
    expect(week).toEqual({ gymMin: 0, sportMin: 90, totalMin: 90, gymKcal: 0, sportKcal: 400, known: true })
  })
  it('an empty sport side contributes trivially-known zero, never dragging a known gym side down', () => {
    const week = movementWeek([gymBlock(60)], [], 80)
    expect(week).toEqual({ gymMin: 60, sportMin: 0, totalMin: 60, gymKcal: 480, sportKcal: 0, known: true })
  })
})

// A note for `WeekZoneStatus` — kept referenced so a future vocabulary change breaks this
// file's compile rather than silently drifting the word ladder / mapHeat status mapping.
const _statusVocab: WeekZoneStatus[] = ['below', 'entering', 'in', 'over']
void _statusVocab

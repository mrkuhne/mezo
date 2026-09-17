import { describe, expect, it } from 'vitest'
import type { Block } from '@/features/train/logic/trainDayEnergy'
import type { WeekZoneRow, WeekZoneStatus } from '@/features/train/logic/weekZone'
import type { SportLoadResult } from '@/features/train/logic/sportMuscleLoad'
import type { RunPrescribedSession } from '@/data/train/runningApi'
import {
  loadGroups, loadWeekTotals, mapHeat, mapWeekHeat, movementWeek, runMinutesForWeek,
  sportReach, untouchedMuscles, workedMusclesThisWeek,
} from '@/features/train/logic/loadWeek'
import type { WorkoutDetailResponse } from '@/data/train/trainApi'

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

describe('mapWeekHeat — over must come from LOGGED work, never tonight\'s unlogged plan', () => {
  it('a group with 0 done and a big today plan does not paint over — or anything at all', () => {
    const doneRows = [row({ colorMuscle: 'quad', doneSets: 0, status: 'below' })]
    const heatRows = [row({ colorMuscle: 'quad', doneSets: 0, todaySets: 20, todayBudget: 3, status: 'over' })]
    expect(mapWeekHeat(doneRows, heatRows)).toEqual([{ token: 'quad', level: 'none' }])
  })
  it('a little logged work plus a big today plan is clamped to the LOGGED-only status, not over', () => {
    const doneRows = [row({ colorMuscle: 'chest-mid', doneSets: 1, doneBudget: 0.3, status: 'below' })]
    const heatRows = [row({
      colorMuscle: 'chest-mid', doneSets: 1, doneBudget: 0.3, todaySets: 20, todayBudget: 3, status: 'over',
    })]
    expect(mapWeekHeat(doneRows, heatRows)).toEqual([{ token: 'chest-mid', level: 'below' }])
  })
  it('over survives when the LOGGED work alone already busts the budget', () => {
    const doneRows = [row({ colorMuscle: 'back-wide', doneSets: 10, doneBudget: 1.4, status: 'over' })]
    const heatRows = [row({
      colorMuscle: 'back-wide', doneSets: 10, doneBudget: 1.4, todaySets: 2, todayBudget: 1.6, status: 'over',
    })]
    expect(mapWeekHeat(doneRows, heatRows)).toEqual([{ token: 'back-wide', level: 'over' }])
  })
  it('a non-over status (e.g. entering) rides through untouched', () => {
    const doneRows = [row({ colorMuscle: 'glute', doneSets: 2, status: 'below' })]
    const heatRows = [row({ colorMuscle: 'glute', doneSets: 2, todaySets: 3, status: 'entering' })]
    expect(mapWeekHeat(doneRows, heatRows)).toEqual([{ token: 'glute', level: 'entering' }])
  })
})

describe('runMinutesForWeek', () => {
  const session = (over: Partial<RunPrescribedSession>): RunPrescribedSession => ({
    key: 'r1', dayOfWeek: 2, label: 'Steady', kind: 'steady', rpeTarget: { min: 5, max: 6 }, segments: [],
    ...over,
  })
  it('sums every segment\'s durationSec across every session, in minutes', () => {
    const total = runMinutesForWeek([
      session({ segments: [{ type: 'work', durationSec: 1800 }] }), // 30 min
      session({ key: 'r2', segments: [{ type: 'warmup', durationSec: 300 }, { type: 'work', durationSec: 900 }] }), // 20 min
    ])
    expect(total).toBe(50)
  })
  it('is 0 with no running sessions at all', () => {
    expect(runMinutesForWeek([])).toBe(0)
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
    expect(week).toEqual({ gymMin: 0, sportMin: 50, totalMin: 50, gymKcal: null, sportKcal: null, known: false })
  })
  // Fix round 2 (mezo-88iwa.13 review): an empty side used to fabricate a known-ZERO kcal
  // ("sport · 0 kcal — naplóztad" with nothing logged) — 0 reads as "we measured zero
  // calories", which is a lie for a side with no blocks/sessions at all. It must render
  // NO kcal number (null), while still staying `known: true` overall so it never drags a
  // present, genuinely-known other side into `known: false`.
  it('an empty gym side is trivially known but renders no kcal number, never a fabricated zero', () => {
    const week = movementWeek([], [{ minutes: 90, kcal: 400 }], null)
    expect(week).toEqual({ gymMin: 0, sportMin: 90, totalMin: 90, gymKcal: null, sportKcal: 400, known: true })
  })
  it('an empty sport side is trivially known but renders no kcal number, never a fabricated zero', () => {
    const week = movementWeek([gymBlock(60)], [], 80)
    expect(week).toEqual({ gymMin: 60, sportMin: 0, totalMin: 60, gymKcal: 480, sportKcal: null, known: true })
  })
})

// A note for `WeekZoneStatus` — kept referenced so a future vocabulary change breaks this
// file's compile rather than silently drifting the word ladder / mapHeat status mapping.
const _statusVocab: WeekZoneStatus[] = ['below', 'entering', 'in', 'over']
void _statusVocab

describe('workedMusclesThisWeek', () => {
  const logged = (exercises: Array<{
    muscle: string; type?: string; sets: Array<{ skipped?: boolean; kind?: string }>
  }>): WorkoutDetailResponse => ({
    id: 'w', templateSessionId: 'ts', date: '2026-05-20', status: 'completed',
    title: 'Push', dayLabel: 'Hét',
    exercises: exercises.map((e, i) => ({
      exerciseId: `e-${i}`, name: 'Ex', muscle: e.muscle, type: e.type ?? 'compound',
      warmupSets: 0, workingSets: e.sets.length, repMin: 8, repMax: 10, targetRIR: 2, skipped: false,
      sets: e.sets.map((s, j) => ({
        id: `s-${i}-${j}`, exerciseId: `e-${i}`, setIndex: j, reps: 8, rir: 2,
        skipped: s.skipped ?? false, kind: s.kind ?? 'working',
      })),
    })),
  }) as unknown as WorkoutDetailResponse

  it('collects the muscle TOKENS a real working set landed on, never the group', () => {
    const worked = workedMusclesThisWeek([
      logged([{ muscle: 'chest-mid', sets: [{}] }]),
      logged([{ muscle: 'quad', sets: [{}, {}] }]),
    ])
    expect([...worked].sort()).toEqual(['chest-mid', 'quad'])
    // Region siblings are NOT lit by association — the screen draws one cell per token.
    expect(worked.has('chest-upper')).toBe(false)
  })

  it('ignores skipped sets, warmup sets and plyo exercises — the weekZone logged-path cuts', () => {
    const worked = workedMusclesThisWeek([logged([
      { muscle: 'chest-mid', sets: [{ skipped: true }] },
      { muscle: 'back-wide', sets: [{ kind: 'warmup' }] },
      { muscle: 'calf', type: 'plyo', sets: [{}] },
    ])])
    expect(worked.size).toBe(0)
  })

  it('an empty week is an empty set — nothing is guessed into it', () => {
    expect(workedMusclesThisWeek([]).size).toBe(0)
  })
})

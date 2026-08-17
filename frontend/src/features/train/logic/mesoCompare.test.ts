import { describe, expect, it } from 'vitest'
import {
  alignVolumeWeeks,
  contextDiff,
  sharedStrengthDeltas,
} from '@/features/train/logic/mesoCompare'
import type {
  MesocycleReportResponse,
  MesocycleVolumeArcResponse,
  MesoContext,
  MesoStrengthDelta,
} from '@/data/train/trainApi'

// --- tiny builders: only the fields the three helpers read are meaningful here ---

/** One muscle's arc from `[week, planned, actual]` triples. */
function arc(muscle: string, mrv: number, weeks: [number, number, number | null][]) {
  return {
    muscle,
    region: 'sage',
    mrv,
    weeks: weeks.map(([week, planned, actual]) => ({
      week, phase: 'MAV' as const, planned, actual, isCurrent: false,
    })),
  }
}

function volume(muscles: ReturnType<typeof arc>[]): MesocycleVolumeArcResponse {
  return {
    mesocycleId: 'x', title: 'x', currentWeek: 1, weeks: muscles[0]?.weeks.length ?? 0,
    startDate: '2026-01-01', endDate: '2026-02-01', status: 'archived',
    phaseCurve: ['MAV'], muscles,
  }
}

function report(over: Partial<MesocycleReportResponse> = {}): MesocycleReportResponse {
  return {
    mesocycleId: 'r', templateId: null, title: 'Futam', startDate: '2026-01-01',
    endDate: '2026-02-01', closedAt: null, weeks: 4, selfEval: null, aiEval: null,
    aiEvalStatus: 'ready', aiEvalGeneratedAt: null, aiEvalEnabled: false,
    adherence: { plannedSessions: 0, completedSessions: 0, plannedWeeks: 0, completedWeeks: 0, completionPct: 0 },
    volume: null, strength: [], records: { medalCount: 0, top: [] }, context: null,
    ...over,
  }
}

function lift(over: Partial<MesoStrengthDelta> & { exerciseName: string }): MesoStrengthDelta {
  return {
    muscle: 'back-mid', firstWeek: 1, lastWeek: 4, firstTopReps: 8, lastTopReps: 8,
    ...over,
  }
}

function context(totals: Partial<MesoContext['totals']>): MesoContext {
  return { weeks: [], totals: { daysTotal: 28, ...totals } }
}

describe('alignVolumeWeeks', () => {
  it('unions the muscles across both reports and aligns the weeks by week number', () => {
    const a = report({
      volume: volume([
        arc('chest', 16, [[1, 8, 8], [2, 10, 9]]),
        arc('back', 20, [[1, 10, 10]]),
      ]),
    })
    const b = report({
      volume: volume([
        arc('chest', 18, [[1, 9, 9], [2, 12, 11]]),
        arc('quad', 18, [[1, 8, 7]]),
      ]),
    })

    expect(alignVolumeWeeks(a, b)).toEqual([
      {
        muscle: 'chest',
        weeks: [
          { week: 1, aPlanned: 8, aActual: 8, bPlanned: 9, bActual: 9 },
          { week: 2, aPlanned: 10, aActual: 9, bPlanned: 12, bActual: 11 },
        ],
      },
      {
        // a-only muscle — b's side of every row is null, never a fabricated 0
        muscle: 'back',
        weeks: [{ week: 1, aPlanned: 10, aActual: 10, bPlanned: null, bActual: null }],
      },
      {
        // b-only muscle comes after a's own, keeping the order deterministic
        muscle: 'quad',
        weeks: [{ week: 1, aPlanned: null, aActual: null, bPlanned: 8, bActual: 7 }],
      },
    ])
  })

  it('pads the shorter run: weeks run W1..max(weeks) with nulls where a side has no such week', () => {
    const a = report({ volume: volume([arc('chest', 16, [[1, 8, 8], [2, 10, 10], [3, 12, 11]])]) })
    const b = report({ volume: volume([arc('chest', 16, [[1, 9, 9]])]) })

    expect(alignVolumeWeeks(a, b)[0].weeks).toEqual([
      { week: 1, aPlanned: 8, aActual: 8, bPlanned: 9, bActual: 9 },
      { week: 2, aPlanned: 10, aActual: 10, bPlanned: null, bActual: null },
      { week: 3, aPlanned: 12, aActual: 11, bPlanned: null, bActual: null },
    ])
  })

  it('keeps a null actual null (a future/unlogged week is not zero volume)', () => {
    const a = report({ volume: volume([arc('chest', 16, [[1, 8, null]])]) })
    const b = report({ volume: volume([arc('chest', 16, [[1, 9, 9]])]) })

    expect(alignVolumeWeeks(a, b)[0].weeks[0]).toEqual({
      week: 1, aPlanned: 8, aActual: null, bPlanned: 9, bActual: 9,
    })
  })

  it('drops the side whose report carries no volume at all', () => {
    const a = report({ volume: volume([arc('chest', 16, [[1, 8, 8]])]) })
    const b = report({ volume: null })

    expect(alignVolumeWeeks(a, b)).toEqual([
      { muscle: 'chest', weeks: [{ week: 1, aPlanned: 8, aActual: 8, bPlanned: null, bActual: null }] },
    ])
  })

  it('returns an empty list when NEITHER report has a volume arc', () => {
    expect(alignVolumeWeeks(report(), report())).toEqual([])
  })
})

describe('sharedStrengthDeltas', () => {
  it('matches on catalogId when both sides carry one — even if the names differ', () => {
    const a = report({
      strength: [lift({ exerciseName: 'Chest Supported Row', catalogId: 'c1', muscle: 'back-mid', deltaKg: 12.5, deltaPct: 17.2 })],
    })
    const b = report({
      strength: [lift({ exerciseName: 'Chest Row (gép)', catalogId: 'c1', muscle: 'back-mid', deltaKg: 5, deltaPct: 6.4 })],
    })

    expect(sharedStrengthDeltas(a, b)).toEqual([
      {
        exerciseName: 'Chest Supported Row', muscle: 'back-mid',
        aDeltaKg: 12.5, aDeltaPct: 17.2, bDeltaKg: 5, bDeltaPct: 6.4,
      },
    ])
  })

  it('falls back to an exact name match when either side has no catalogId', () => {
    const a = report({ strength: [lift({ exerciseName: 'Leg Press', muscle: 'quad', deltaKg: 0, deltaPct: 0 })] })
    const b = report({ strength: [lift({ exerciseName: 'Leg Press', catalogId: 'c9', muscle: 'quad', deltaKg: 10, deltaPct: 8.1 })] })

    expect(sharedStrengthDeltas(a, b)).toEqual([
      { exerciseName: 'Leg Press', muscle: 'quad', aDeltaKg: 0, aDeltaPct: 0, bDeltaKg: 10, bDeltaPct: 8.1 },
    ])
  })

  it('keeps only the shared identities and sorts by the bigger |pct| descending, nulls last', () => {
    const a = report({
      strength: [
        lift({ exerciseName: 'Small', deltaKg: 2.5, deltaPct: 3.1 }),
        lift({ exerciseName: 'Weightless' }), // no deltas at all on either side
        lift({ exerciseName: 'Big', deltaKg: 12.5, deltaPct: 4 }),
        lift({ exerciseName: 'A-only', deltaKg: 30, deltaPct: 40 }),
      ],
    })
    const b = report({
      strength: [
        lift({ exerciseName: 'Small', deltaKg: 5, deltaPct: 6.2 }),
        lift({ exerciseName: 'Weightless' }),
        // Big's b-side regressed — the ordering key is the MAGNITUDE, so -20 outranks 6.2
        lift({ exerciseName: 'Big', deltaKg: -10, deltaPct: -20 }),
        lift({ exerciseName: 'B-only', deltaKg: 1, deltaPct: 1 }),
      ],
    })

    expect(sharedStrengthDeltas(a, b).map((r) => r.exerciseName)).toEqual(['Big', 'Small', 'Weightless'])
    expect(sharedStrengthDeltas(a, b)[2]).toEqual({
      exerciseName: 'Weightless', muscle: 'back-mid',
      aDeltaKg: null, aDeltaPct: null, bDeltaKg: null, bDeltaPct: null,
    })
  })

  it('returns an empty list when the two runs share no exercise', () => {
    const a = report({ strength: [lift({ exerciseName: 'Chin-up' })] })
    const b = report({ strength: [lift({ exerciseName: 'Dip' })] })
    expect(sharedStrengthDeltas(a, b)).toEqual([])
  })
})

describe('contextDiff', () => {
  it('lines the six lifestyle totals up side by side, in a fixed order', () => {
    const a = report({
      context: context({
        sleepAvgH: 7.4, kcalAvg: 2429, energyAvg: 6.5, stressAvg: 4.8,
        weightChangeKg: -1.1, sportMinutes: 760,
      }),
    })
    const b = report({
      context: context({
        sleepAvgH: 6.8, kcalAvg: 2680, energyAvg: 6, stressAvg: 5.4,
        weightChangeKg: 1.4, sportMinutes: 620,
      }),
    })

    expect(contextDiff(a, b)).toEqual([
      { label: 'Alvás', aValue: 7.4, bValue: 6.8, unit: 'h' },
      { label: 'Kcal', aValue: 2429, bValue: 2680, unit: 'kcal' },
      { label: 'Energia', aValue: 6.5, bValue: 6, unit: '' },
      { label: 'Stressz', aValue: 4.8, bValue: 5.4, unit: '' },
      { label: 'Súlyváltozás', aValue: -1.1, bValue: 1.4, unit: 'kg' },
      { label: 'Sport', aValue: 760, bValue: 620, unit: 'perc' },
    ])
  })

  it('keeps a row where only ONE side measured, and drops the rows nobody measured', () => {
    const a = report({ context: context({ sleepAvgH: 7.4, energyAvg: 6.5 }) })
    const b = report({ context: context({ sleepAvgH: 6.8, energyAvg: null, kcalAvg: 2680 }) })

    expect(contextDiff(a, b)).toEqual([
      { label: 'Alvás', aValue: 7.4, bValue: 6.8, unit: 'h' },
      { label: 'Kcal', aValue: null, bValue: 2680, unit: 'kcal' },
      { label: 'Energia', aValue: 6.5, bValue: null, unit: '' },
      // stressz / súlyváltozás / sport: neither run measured them -> no row at all
    ])
  })

  it('handles a missing context on one side, and returns nothing when both are missing', () => {
    const a = report({ context: context({ sleepAvgH: 7.4 }) })
    expect(contextDiff(a, report())).toEqual([
      { label: 'Alvás', aValue: 7.4, bValue: null, unit: 'h' },
    ])
    expect(contextDiff(report(), report())).toEqual([])
  })
})

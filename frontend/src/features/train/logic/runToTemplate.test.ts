import { describe, expect, test } from 'vitest'
import { runToTemplate } from '@/features/train/logic/runToTemplate'
import type { Mesocycle, VolumeProfile } from '@/data/types'

const profile = (over: Partial<VolumeProfile> = {}): VolumeProfile => ({
  mev: 8, mav: 14, mrv: 20, current: 14,
  source: {
    baseline: { name: 'RP guidelines · intermediate', mev: 8, mav: 12, mrv: 18 },
    adjustments: [{ kind: 'pattern', label: 'stabil pumpa', delta: { mrv: 2 } }],
    confidence: 0.78,
  },
  ...over,
})

const meso = (over: Partial<Mesocycle> = {}): Mesocycle => ({
  id: 'meso-hyp-04',
  status: 'archived',
  title: 'Hypertrophy 04 · Tavasz',
  shortTitle: 'Hypertrophy 04',
  goal: 'Felsőtest hypertrophy',
  startDate: 'Máj 1',
  endDate: 'Jún 12',
  weeks: 6,
  currentWeek: 6,
  split: 'Pull / Push / Legs · 5×/hét',
  style: 'RP · 6 hét',
  phaseCurve: ['MEV', 'MEV', 'MAV', 'MAV', 'MRV', 'Deload'],
  notes: 'Váll niggle-kíméletes',
  days: [
    {
      day: 'Hét', type: 'Push', muscle: 'chest+shoulder', exerciseCount: 1, muscleAccent: true,
      note: 'Nehéz nap',
      exercises: [
        {
          id: 'ex-1', name: 'Barbell Bench Press', muscle: 'chest-mid',
          warmupSets: 2, workingSets: 4, repMin: 6, repMax: 8, targetRIR: 1,
          anchorWeightKg: 80, type: 'compound', warning: 'Váll', catalogId: 'barbell-bench-press',
        },
      ],
    },
    { day: 'Vas', type: 'Rest', muscle: '', exerciseCount: 0, exercises: [] },
  ],
  ...over,
})

describe('runToTemplate', () => {
  test('copies every plan field of the run, suffixing the title', () => {
    const body = runToTemplate(meso())
    expect(body.title).toBe('Hypertrophy 04 · Tavasz — sablon')
    expect(body.shortTitle).toBe('Hypertrophy 04')
    expect(body.goal).toBe('Felsőtest hypertrophy')
    expect(body.weeks).toBe(6)
    expect(body.split).toBe('Pull / Push / Legs · 5×/hét')
    expect(body.style).toBe('RP · 6 hét')
    expect(body.phaseCurve).toEqual(['MEV', 'MEV', 'MAV', 'MAV', 'MRV', 'Deload'])
    expect(body.notes).toBe('Váll niggle-kíméletes')
  })

  test('musclePriorities carries onto the template (mezo-3m5m), null when the run has none', () => {
    expect(runToTemplate(meso({ musclePriorities: { back: 'emphasize' } })).musclePriorities).toEqual({
      back: 'emphasize',
    })
    expect(runToTemplate(meso()).musclePriorities).toBeNull()
  })

  test('maps the days to day inputs — the working day keeps its recipe, ids dropped', () => {
    const body = runToTemplate(meso())
    expect(body.days).toHaveLength(2)
    const push = body.days[0]
    expect(push.day).toBe('Hét')
    expect(push.type).toBe('Push')
    expect(push.muscle).toBe('chest+shoulder')
    expect(push.muscleAccent).toBe(true)
    expect(push.note).toBe('Nehéz nap')
    expect(push.exercises).toEqual([
      {
        name: 'Barbell Bench Press', muscle: 'chest-mid',
        warmupSets: 2, workingSets: 4, repMin: 6, repMax: 8, targetRIR: 1,
        anchorWeightKg: 80, type: 'compound', warning: 'Váll', catalogId: 'barbell-bench-press',
      },
    ])
    // the exercise row ids are the server's to regenerate — they never travel in an upsert
    expect(JSON.stringify(body.days)).not.toContain('ex-1')
  })

  test('a rest day travels through untouched — empty muscle, no exercises', () => {
    const body = runToTemplate(meso())
    expect(body.days[1]).toMatchObject({ day: 'Vas', type: 'Rest', muscle: '', exercises: [] })
  })

  test('an empty string on an optional plan field becomes null, not ""', () => {
    const body = runToTemplate(meso({ goal: '', split: '', style: '', shortTitle: '' }))
    expect(body.goal).toBeNull()
    expect(body.split).toBeNull()
    expect(body.style).toBeNull()
    expect(body.shortTitle).toBeNull()
  })

  test('a run with no notes at all carries a null notes', () => {
    const { notes: _drop, ...noNotes } = meso()
    expect(runToTemplate(noNotes as Mesocycle).notes).toBeNull()
  })

  test('a run with no day plan at all yields an empty day list', () => {
    const { days: _drop, ...noDays } = meso()
    expect(runToTemplate(noDays as Mesocycle).days).toEqual([])
  })

  test('volumePerMuscle collapses each profile onto its provenance BASELINE', () => {
    const body = runToTemplate(meso({ volumePerMuscle: { chest: profile() } }))
    expect(body.volumePerMuscle).toEqual({
      chest: { name: 'RP guidelines · intermediate', mev: 8, mav: 12, mrv: 18 },
    })
  })

  test('a muscle with no resolvable baseline is SKIPPED, the rest still travel', () => {
    const baseless = { mev: 6, mav: 10, mrv: 14, current: 10 } as unknown as VolumeProfile
    const body = runToTemplate(meso({ volumePerMuscle: { chest: profile(), biceps: baseless } }))
    expect(Object.keys(body.volumePerMuscle ?? {})).toEqual(['chest'])
  })

  test('no resolvable baseline anywhere — and no volume at all — both yield null', () => {
    const baseless = { mev: 6, mav: 10, mrv: 14, current: 10 } as unknown as VolumeProfile
    expect(runToTemplate(meso({ volumePerMuscle: { biceps: baseless } })).volumePerMuscle).toBeNull()
    expect(runToTemplate(meso()).volumePerMuscle).toBeNull()
  })
})

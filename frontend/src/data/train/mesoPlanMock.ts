// Mock-mode twin of the backend generator: same frames (logic/mesoPlan), exercises from the
// mock exercise library (compound-first, stim-desc, rotating on the 2nd weekly occurrence).
import type { ExerciseLibraryItem } from '@/data/types'
import type { GymExerciseInput, MesoDayInput, MesoPlanGenerateRequest, MesoPlanGenerateResponse } from '@/data/train/trainApi'
import { GROUP_LANDMARKS, budgetGroup } from '@/features/train/logic/setBudget'
import { SPLIT_LABELS, dayFrames } from '@/features/train/logic/mesoPlan'
import { getSeason } from '@/features/train/logic/planner'

const phaseCurve = (weeks: number): MesoPlanGenerateResponse['template']['phaseCurve'] => {
  const ramp = Math.max(1, weeks - 1)
  const mevWeeks = ramp >= 4 ? 2 : 1
  const out: ('MEV' | 'MAV' | 'MRV' | 'Deload')[] = []
  for (let i = 0; i < ramp; i++) out.push(i === ramp - 1 && ramp > 1 ? 'MRV' : i < mevWeeks ? 'MEV' : 'MAV')
  out.push('Deload')
  return out
}

function pick(group: string, sets: number, library: ExerciseLibraryItem[], rotation: number): GymExerciseInput[] {
  const pool = library
    .filter((e) => e.type !== 'plyo' && budgetGroup(e.muscle) === group)
    .sort((a, b) => (a.type === 'compound' ? 0 : 1) - (b.type === 'compound' ? 0 : 1) || b.stim - a.stim || a.name.localeCompare(b.name))
  if (!pool.length || sets <= 0) return []
  const count = Math.min(pool.length, sets >= 6 ? 2 : 1)
  const offset = (rotation * count) % pool.length
  const base = Math.floor(sets / count)
  const rem = sets % count
  return Array.from({ length: count }, (_, i) => {
    const e = pool[(offset + i) % pool.length]
    const compound = e.type === 'compound'
    return {
      name: e.name, muscle: e.muscle,
      // Mock library items lack a real catalog uuid; fall back to the library row id (mock-mode only — never persisted).
      catalogId: e.catalogId ?? e.id,
      warmupSets: compound ? 2 : 1, workingSets: base + (i < rem ? 1 : 0),
      repMin: compound ? 8 : 12, repMax: compound ? 10 : 15, targetRIR: 1,
      type: e.type, countsTowardVolume: true,
    }
  })
}

export function mockMesoPlan(input: MesoPlanGenerateRequest, library: ExerciseLibraryItem[]): MesoPlanGenerateResponse {
  const priorities = Object.fromEntries(Object.entries(input.priorities ?? {}).filter(([, t]) => t !== 'grow')) as Record<string, 'emphasize' | 'maintain'>
  const frames = dayFrames(input.daysOfWeek, priorities)
  const occurrence = new Map<string, number>()
  const days: MesoDayInput[] = frames.map((f) => {
    if (f.type === 'Rest') return { day: f.day, type: 'Rest', muscle: '', note: 'Pihenőnap', exercises: [] }
    const exercises = f.muscles.flatMap((m) => {
      const rot = occurrence.get(m.group) ?? 0
      occurrence.set(m.group, rot + 1)
      return pick(m.group, m.sets, library, rot)
    })
    return { day: f.day, type: f.type, muscle: f.muscles[0]?.group ?? '', exercises }
  })
  const n = Math.min(6, Math.max(2, input.daysOfWeek.length))
  return {
    template: {
      title: `Hypertrophy · ${getSeason(new Date().toISOString().slice(0, 10))}`,
      shortTitle: 'Hypertrophy', goal: 'Izomtömeg építés', goalPreset: 'hypertrophy',
      musclePriorities: Object.keys(priorities).length ? priorities : null,
      weeks: input.weeks, split: `${SPLIT_LABELS[n]} · ${input.daysOfWeek.length}×/hét`, style: `RP · ${input.weeks} hét`,
      phaseCurve: phaseCurve(input.weeks), notes: input.goalText?.trim() || null,
      volumePerMuscle: Object.fromEntries(Object.entries(GROUP_LANDMARKS).map(([g, lm]) => [g, { name: 'RP guidelines · intermediate', ...lm }])),
      days,
    },
    rationale: 'Determinisztikus kiosztás: a split a napszámból, a szettek a MEV/MAV/MRV sávokból — bármit cserélhetsz.',
    llmUsed: false,
  }
}

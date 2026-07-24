import { describe, expect, it } from 'vitest'
import type { GymExercise, MesoDay, VolleyballSession } from '@/data/types'
import type { SkillLevel } from '@/data/progression/progressionApi'
import type { RunPrescribedSession } from '@/data/train/runningApi'
import { growthForecast, xpThreshold } from '@/features/train/logic/growthForecast'

let n = 0
const ex = (muscle: string, workingSets: number, over: Partial<GymExercise> = {}): GymExercise => ({
  id: `ex-${n++}`, name: `${muscle}-${n}`, muscle, warmupSets: 1, workingSets,
  repMin: 8, repMax: 12, targetRIR: 2, type: 'compound', ...over,
})
const day = (exercises: GymExercise[]): MesoDay => ({
  day: 'Hét', type: 'Day', muscle: 'chest', exerciseCount: exercises.length, exercises,
})
const skill = (skillKey: string, level: number, cumulativeXp: number): SkillLevel => ({
  skillKey, kind: 'ATHLETIC', level, cumulativeXp, progressPct: 50,
})
const empty = { days: [], slots: [], runSessions: [], athletic: [] }

describe('xpThreshold', () => {
  it('mirrors the backend curve (base 100, exp 1.6)', () => {
    expect(xpThreshold(1)).toBe(0)
    expect(xpThreshold(2)).toBe(100)
    expect(xpThreshold(4)).toBe(Math.round(100 * 3 ** 1.6)) // 580
  })
})

describe('growthForecast — gym', () => {
  it('estimates muscle volume XP, max_strength and strength_endurance from anchored recipes', () => {
    // chest 3×(8–12) @100kg: repMid 10 → volume 3000 → 300 muscle XP;
    // e1RM 100*(1+10/30)=133.33 → floor → 133 → 266 max_strength; endurance 3×8=24.
    const f = growthForecast({ ...empty, days: [day([ex('chest', 3, { anchorWeightKg: 100 })])] })
    expect(f.muscleXp.chest).toBe(300)
    expect(f.skills.find((s) => s.skillKey === 'max_strength')?.xpEst).toBe(266)
    expect(f.skills.find((s) => s.skillKey === 'strength_endurance')?.xpEst).toBe(24)
  })
  it('skips volume/e1RM for anchor-less exercises but keeps endurance', () => {
    const f = growthForecast({ ...empty, days: [day([ex('chest', 3)])] })
    expect(f.muscleXp.chest).toBeUndefined()
    expect(f.skills.find((s) => s.skillKey === 'max_strength')).toBeUndefined()
    expect(f.skills.find((s) => s.skillKey === 'strength_endurance')?.xpEst).toBe(24)
  })
  it('counts plyo as bodyweight reps', () => {
    // plyo 3×(4–6): repMid 5 → 15 reps ×1 XP
    const f = growthForecast({ ...empty, days: [day([ex('quad', 3, { type: 'plyo', repMin: 4, repMax: 6 })])] })
    expect(f.skills.find((s) => s.skillKey === 'strength_endurance')?.xpEst).toBe(15)
  })
})

describe('growthForecast — sport + run', () => {
  const slot = (sport?: VolleyballSession['sport']): VolleyballSession => ({
    day: 'Kedd', time: '18:00', duration: 90, court: 'X', intensity: 'közepes', role: 'edzés', ...(sport ? { sport } : {}),
  })
  it('volleyball defaults: 3 sets, RPE 7, duration from slot', () => {
    const f = growthForecast({ ...empty, slots: [slot()] })
    expect(f.skills.find((s) => s.skillKey === 'vertical_jump')?.xpEst).toBe(36)
    expect(f.skills.find((s) => s.skillKey === 'explosiveness')?.xpEst).toBe(42)
    expect(f.skills.find((s) => s.skillKey === 'aerobic_capacity')?.xpEst).toBe(360)
  })
  it('sprint run: rounds from work segments, RPE mid from target', () => {
    const rs: RunPrescribedSession = {
      key: 's1', dayOfWeek: 5, timeOfDay: null, label: 'Sprint', kind: 'sprint',
      rpeTarget: { min: 8, max: 9 },
      segments: Array.from({ length: 6 }, () => ({ type: 'work', durationSec: 15 })),
    }
    const f = growthForecast({ ...empty, runSessions: [rs] })
    expect(f.skills.find((s) => s.skillKey === 'sprint_speed')?.xpEst).toBe(150)
    expect(f.skills.find((s) => s.skillKey === 'anaerobic_capacity')?.xpEst).toBe(90)
    expect(f.skills.find((s) => s.skillKey === 'explosiveness')?.xpEst).toBe(Math.round(8.5) * 6)
  })
  it('steady run: minutes from segments (default 30 when none)', () => {
    const rs: RunPrescribedSession = {
      key: 's2', dayOfWeek: 3, timeOfDay: null, label: 'Steady', kind: 'steady',
      rpeTarget: { min: 5, max: 6 }, segments: [{ type: 'work', durationSec: 1800 }],
    }
    const f = growthForecast({ ...empty, runSessions: [rs] })
    expect(f.skills.find((s) => s.skillKey === 'strength_endurance')?.xpEst).toBe(120)
    expect(f.skills.find((s) => s.skillKey === 'aerobic_capacity')?.xpEst).toBe(150)
  })
})

describe('growthForecast — levels', () => {
  it('flags willLevelUp against the profile skill and sorts by xpEst desc', () => {
    // vertical_jump Lv3 @300 XP: threshold(4)=580 → 36 XP won't flip; explosiveness Lv1 @70: threshold(2)=100 → 42 flips.
    const f = growthForecast({
      ...empty,
      slots: [{ day: 'Kedd', time: '18:00', duration: 90, court: 'X', intensity: 'közepes', role: 'edzés' }],
      athletic: [skill('vertical_jump', 3, 300), skill('explosiveness', 1, 70)],
    })
    expect(f.skills.find((s) => s.skillKey === 'vertical_jump')).toMatchObject({ level: 3, willLevelUp: false })
    expect(f.skills.find((s) => s.skillKey === 'explosiveness')).toMatchObject({ level: 1, willLevelUp: true })
    const xps = f.skills.map((s) => s.xpEst)
    expect([...xps].sort((a, b) => b - a)).toEqual(xps)
  })
})

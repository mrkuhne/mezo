// ============================================================
// Mezo · growthForecast — planned week → estimated athletic/muscle XP
// (mezo-ly27 muscle-week sheet, spec §1.3). MIRRORS the backend economy:
// AUTHORITATIVE SOURCE = backend/src/main/resources/application.yml
// (mezo.progression.*) + ProgressionService.applyGym/applyRun/applySport.
// Keep ECONOMY in sync by hand — drift is accepted (the whole surface is
// "~ becslés"); revisit a forecast endpoint if it becomes a pain (spec §5).
// NOT forecast: PR/HR bonuses, robustness streak, quest/activity/habit XP.
// ============================================================
import type { MesoDay, VolleyballSession } from '@/data/types'
import type { RunPrescribedSession } from '@/data/train/runningApi'
import type { SkillLevel } from '@/data/progression/progressionApi'
import { sportOf } from '@/features/train/logic/sportKinds'

const ECONOMY = {
  curve: { base: 100, exp: 1.6 },
  gym: { volumeUnit: 100, volumeXpPerUnit: 10, e1rmXpPerKg: 2, strengthEnduranceXpPerSet: 8, bodyweightXpPerRep: 1 },
  run: { sprintXpPerRound: 25, anaerobicXpPerRound: 15, steadyXpPerMin: 4, aerobicXpPerMin: 5, rpeXpPerPoint: 6 },
  sport: { xpPerSet: 12, xpPerRound: 14, xpPerMin: 4, rpeXpPerPoint: 6 },
  defaults: { volleyballSets: 3, rounds: 4, rpe: 7, steadyMin: 30 },
} as const

/** Cumulative XP required to BE at `level` — mirrors ProgressionCurve.xpThreshold. */
export function xpThreshold(level: number): number {
  return level <= 1 ? 0 : Math.round(ECONOMY.curve.base * (level - 1) ** ECONOMY.curve.exp)
}

export interface ForecastSkill {
  skillKey: string
  xpEst: number
  level: number
  progressPct: number
  willLevelUp: boolean
}
export interface GrowthForecast {
  /** Athletic skills with est. XP > 0, sorted by xpEst desc. */
  skills: ForecastSkill[]
  /** Muscle key → estimated weekly volume XP (rendered in the muscle rows, not as skills). */
  muscleXp: Record<string, number>
}

export function growthForecast(input: {
  days: MesoDay[]
  slots: VolleyballSession[]
  runSessions: RunPrescribedSession[]
  athletic: SkillLevel[]
}): GrowthForecast {
  const athleticXp = new Map<string, number>()
  const muscleXp: Record<string, number> = {}
  const add = (skill: string, xp: number) => {
    if (xp > 0) athleticXp.set(skill, (athleticXp.get(skill) ?? 0) + xp)
  }
  const g = ECONOMY.gym

  // Gym — per template day (mirrors applyGym: per-workout volume/e1RM/set tallies).
  for (const d of input.days) {
    const volumeByMuscle = new Map<string, number>()
    let bestE1rm = 0
    let workSets = 0
    let bwReps = 0
    for (const ex of d.exercises) {
      if (!ex.muscle || ex.muscle === 'sport') continue
      const repMid = (ex.repMin + ex.repMax) / 2
      if (ex.type === 'plyo') {
        bwReps += ex.workingSets * repMid
        continue
      }
      workSets += ex.workingSets
      if (ex.anchorWeightKg) {
        volumeByMuscle.set(ex.muscle, (volumeByMuscle.get(ex.muscle) ?? 0) + ex.workingSets * repMid * ex.anchorWeightKg)
        bestE1rm = Math.max(bestE1rm, ex.anchorWeightKg * (1 + repMid / 30)) // Epley
      }
    }
    for (const [muscle, volume] of volumeByMuscle) {
      const xp = Math.floor(volume / g.volumeUnit) * g.volumeXpPerUnit
      if (xp > 0) muscleXp[muscle] = (muscleXp[muscle] ?? 0) + xp
    }
    if (bestE1rm > 0) add('max_strength', Math.floor(bestE1rm) * g.e1rmXpPerKg)
    add('strength_endurance', workSets * g.strengthEnduranceXpPerSet + Math.floor(bwReps) * g.bodyweightXpPerRep)
  }

  // Sport — per planned slot (mirrors applySport; plan has no sets/rounds/RPE → defaults).
  const sp = ECONOMY.sport
  const { volleyballSets, rounds, rpe } = ECONOMY.defaults
  for (const slot of input.slots) {
    switch (sportOf(slot)) {
      case 'cross':
        add('anaerobic_capacity', rounds * sp.xpPerRound)
        add('strength_endurance', rounds * sp.xpPerRound)
        add('explosiveness', rpe * sp.rpeXpPerPoint)
        add('core_stability', rpe * sp.rpeXpPerPoint)
        break
      case 'trx':
        add('core_stability', rounds * sp.xpPerRound)
        add('strength_endurance', rounds * sp.xpPerRound)
        add('anaerobic_capacity', rpe * sp.rpeXpPerPoint)
        add('mobility', slot.duration * sp.xpPerMin)
        break
      default: // volleyball
        add('vertical_jump', volleyballSets * sp.xpPerSet)
        add('agility', volleyballSets * sp.xpPerSet)
        add('coordination', volleyballSets * sp.xpPerSet)
        add('explosiveness', rpe * sp.rpeXpPerPoint)
        add('aerobic_capacity', slot.duration * sp.xpPerMin)
    }
  }

  // Running — per prescribed session of the current block week (mirrors applyRun).
  const r = ECONOMY.run
  for (const s of input.runSessions) {
    const rpeMid = Math.round((s.rpeTarget.min + s.rpeTarget.max) / 2)
    if (s.kind === 'sprint' || s.kind === 'pyramid') {
      const workRounds = s.segments.filter((seg) => seg.type === 'work').length || ECONOMY.defaults.rounds
      add('sprint_speed', workRounds * r.sprintXpPerRound)
      add('anaerobic_capacity', workRounds * r.anaerobicXpPerRound)
      add('explosiveness', rpeMid * r.rpeXpPerPoint)
    } else {
      const min = Math.round(s.segments.reduce((acc, seg) => acc + seg.durationSec, 0) / 60) || ECONOMY.defaults.steadyMin
      add('strength_endurance', min * r.steadyXpPerMin)
      add('aerobic_capacity', min * r.aerobicXpPerMin)
    }
  }

  const byKey = new Map(input.athletic.map((s) => [s.skillKey, s]))
  const skills = [...athleticXp.entries()]
    .map(([skillKey, xpEst]) => {
      const row = byKey.get(skillKey)
      const level = row?.level ?? 1
      const cumulativeXp = row?.cumulativeXp ?? 0
      return {
        skillKey, xpEst, level,
        progressPct: row?.progressPct ?? 0,
        willLevelUp: cumulativeXp + xpEst >= xpThreshold(level + 1),
      }
    })
    .sort((a, b) => b.xpEst - a.xpEst || a.skillKey.localeCompare(b.skillKey))
  return { skills, muscleXp }
}

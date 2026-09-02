import type { ProgressionProfileResponse, SkillLevel } from '@/data/progression/progressionApi'

const sumXp = (l: SkillLevel[]) => l.reduce((s, x) => s + x.cumulativeXp, 0)
const avg = (l: SkillLevel[]) => (l.length ? l.reduce((s, x) => s + x.level, 0) / l.length : null)
const best = (l: SkillLevel[]) => (l.length ? Math.max(...l.map((x) => x.level)) : null)

/** FE-derived Growth numbers (mezo-rmi0.1) — band lengths, never hardcoded 8/12/13. */
export function growthStats(p: ProgressionProfileResponse) {
  const life = p.life ?? [], athletic = p.athletic ?? [], muscle = p.muscle ?? []
  const all = [...life, ...athletic, ...muscle]
  return {
    totalXp: sumXp(all),
    skillCount: all.length,
    bestLevel: best(all) ?? 0,
    lifeAvg: avg(life),
    muscleBest: best(muscle),
    lifeXp: sumXp(life),
    athleticAvg: avg(athletic),
  }
}

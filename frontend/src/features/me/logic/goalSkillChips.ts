import type { LifeGoalDimension, LifeGoalResponse } from '@/data/lifegoal/lifegoalApi'

export interface GoalChip { title: string; dimension: LifeGoalDimension }

/**
 * `skillKey → goalchip` (mezo-iizd.12). Minden pillér hordoz `skillKey`-t, és a `.6` óta a
 * hit-napok XP-je is azon a skillen érkezik (LifeGoalXpService → ProgressionService.applyLifeGoal,
 * source_type=LIFE_GOAL) — a chip tehát azt a kapcsolatot teszi láthatóvá, ami a pontszámban
 * MÁR él, nem újat állít.
 *
 * CSAK aktív cél aktív pillére számít: ugyanaz az „evaluable" definíció, amit a motor használ.
 * Egy parkolt cél pillére nem gyűjt napot és nem ad XP-t, tehát chipet sem adhat — különben a
 * Growth-sor egy nem futó célt hirdetne.
 *
 * Ütközésnél az ELSŐ találat nyer (a célok, majd a pillérek beérkezési sorrendjében): egy sor
 * egy chipet visel, és a stabil sorrend fontosabb, mint egy „melyik cél a fontosabb" heurisztika,
 * amire nincs adatunk.
 */
export function goalSkillChips(goals: LifeGoalResponse[]): Map<string, GoalChip> {
  const out = new Map<string, GoalChip>()
  for (const g of goals) {
    if (g.status !== 'active') continue
    for (const p of g.pillars) {
      if (p.active === false) continue
      if (!p.skillKey || out.has(p.skillKey)) continue
      out.set(p.skillKey, { title: g.title, dimension: g.dimension })
    }
  }
  return out
}

/** Perk milestones (growth.md §2: "Lv 5, 10, 15…"). */
export const PERK_MILESTONES = [5, 10, 15, 20] as const

const nextOf = (level: number) => PERK_MILESTONES.find((m) => m > level) ?? null

/** The `→ perk Lv n` row hint: only when the skill is exactly ONE level short of a milestone. */
export function perkHint(level: number): number | null {
  const n = nextOf(level)
  return n != null && n - level === 1 ? n : null
}

/** The skill closest to its next milestone (Perkek footer "a következő: {name} Lv {n}"). */
export function nearestMilestone(rows: { name: string; level: number }[]): { name: string; level: number } | null {
  let bestRow: { name: string; level: number } | null = null
  let bestDist = Infinity
  for (const r of rows) {
    const n = nextOf(r.level)
    if (n == null) continue
    const dist = n - r.level
    if (dist < bestDist) { bestDist = dist; bestRow = { name: r.name, level: n } }
  }
  return bestRow
}

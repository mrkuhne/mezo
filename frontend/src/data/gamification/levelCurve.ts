/** Account level curve (spec §5.2): Lv n→n+1 costs 80 + 40·(n−1) XP. */
export function xpToNext(level: number): number {
  return 80 + 40 * (level - 1)
}

export function levelFromTotalXp(totalXp: number): {
  level: number
  xpInLevel: number
  xpForNext: number
} {
  let level = 1
  let rest = totalXp
  while (rest >= xpToNext(level)) {
    rest -= xpToNext(level)
    level += 1
  }
  return { level, xpInLevel: rest, xpForNext: xpToNext(level) }
}

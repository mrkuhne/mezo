// ============================================================
// Mezo · mealClockWindow — a tile és a doboz KÖZÖS ablak-választása (mezo-6g52f).
// Külön fájlban él, hogy a MealClock.tsx és a MealClockBox.tsx (ami re-exportálja a
// MealClock-ot) ne kerüljön körkörös importba egymással.
// ============================================================
import type { WindowTileVM } from '@/features/fuel/logic/fuelSwimlane'
import type { DoneMealRow } from '@/features/fuel/logic/keretHero'

/** Az ablak, amihez mérünk (mezo-6g52f): a szerveren tárolt TERVEZŐ-ablak, ha a szerver azt
 *  pontozta (`windowSource === 'plan'`) — így a rajz és a pontszám nem mondhat mást; különben a
 *  tile saját ablaka. A config-ablak (5–10 stb.) SOSEM kerül az órára. */
export function judgedWindow(tile: WindowTileVM, row: DoneMealRow | null): { from: string; to: string } | null {
  const t = row?.timing
  if (t?.windowSource === 'plan' && t.windowFrom && t.windowTo) return { from: t.windowFrom, to: t.windowTo }
  return tile.windowFrom && tile.windowTo ? { from: tile.windowFrom, to: tile.windowTo } : null
}

import type { HabitCatalog } from '@/data/types'

/**
 * A szokás saját ünneplés-mondata (FOGG `celebration`), a katalógusból kikeresve.
 *
 * A `celebration` szándékosan NINCS rajta a napi lekérésen (`HabitResponse` csak a sor
 * megjelenítéséhez kellő mezőket viszi; a keret-mezők a katalógus-olvasás dolgai), ezért a
 * `/nap/rutin` a már amúgy is mountolt `useHabitCatalog()`-ból olvassa ki (mezo-3zue.5).
 *
 * `null`, ha a szokásnak nincs ünneplése, ha a kulcs ismeretlen, VAGY ha a katalógus még/már
 * üres (hálózati hiba, `realEmpty` ág). Mindhárom ugyanaz a viselkedés: a toast marad a mai —
 * generikus fallback szándékosan nincs.
 */
export function celebrationFor(catalog: HabitCatalog, habitKey: string): string | null {
  for (const chain of catalog.chains) {
    const def = chain.defs.find((d) => d.habitKey === habitKey)
    if (def) return def.celebration?.trim() || null
  }
  return null
}

// ============================================================
// Mezo · chainPrompt (mezo-3zue.6) — a habit stacking kifizetődése: melyik szokás
// promptja szólal meg attól, hogy a horgonyát KIPIPÁLTÁK.
//
// A `chainMilestone.ts` testvére, ugyanazzal a védelemmel: ezt a függvényt a tick-kezelő
// hívja, a pipa ELŐTTI állapotból, tehát a prompt az AKTUS következménye, nem egy mountolt
// állapotfigyelőé. (A törölt `useChainCelebration` pont ezen bukott el: minden mountoláskor
// újra megszólalt.)
//
// A `anchorHabitKey` már ma is a katalógusban van (HabitDefInfo), ezért ehhez nem kell
// szerver-oldali mező: a napi sorok és a katalógus együtt mindent tudnak.
// ============================================================
import type { HabitCatalog, HabitItem } from '@/data/types'
import { habitAction } from '@/features/today/logic/habitAction'

/**
 * @param catalog   a habit-katalógus (a keret-mezők forrása — a napi sor nem viszi őket)
 * @param habits    a mai sorok AHOGY A PIPA ELŐTT álltak (a pipált sor még pending)
 * @param tickedKey az imént kipipált szokás kulcsa
 * @returns a promptolandó sor, vagy null, ha a pillanat csendet érdemel
 */
export function nextInChain(
  catalog: HabitCatalog,
  habits: HabitItem[],
  tickedKey: string,
): HabitItem | null {
  // EGY ugrás, nem tranzitív bejárás. A HabitFrameworkValidator csak az önhorgonyt tiltja,
  // tehát A→B→A tárolható; egy ugrással a ciklus konstrukció szerint nem probléma.
  const anchored = new Set(
    catalog.chains
      .flatMap((c) => c.defs)
      .filter((d) => d.anchorHabitKey === tickedKey && d.habitKey !== tickedKey)
      .map((d) => d.habitKey),
  )
  if (anchored.size === 0) return null

  const candidates = habits
    .filter((h) => anchored.has(h.key))
    // Csak nyitott sor kap promptot, és csak az, amit a felhasználó ITT ÉS MOST kipipálhat.
    // A habitAction az egyetlen CTA-diszpécser: ha az nem 'check' (DERIVED, sheet, nav,
    // szerver-hintelt sor), a „Most jön" ígéretét egy pipa nem teljesítené → csend.
    .filter((h) => h.status === 'pending' && habitAction(h).kind === 'check')

  if (candidates.length === 0) return null
  // Fan-out: egy horgonyra több szokás is köthető (a repository is listát ad vissza).
  // A napi sor position-je dönt — a lánc saját sorrendje.
  return candidates.reduce((best, h) => (h.position < best.position ? h : best))
}

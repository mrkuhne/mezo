// ============================================================
// Mezo · Karakter — deliberationStats (mezo-sp9w)
// A konzílium négy körének számai, EGYETLEN forrásból. A kör-térkép és a beszélgetés-nézet
// ugyanezt hívja, hogy a két felület sose mondjon egymásnak ellentmondó számot.
//
// Őszinteség: egy hiányzó elnöki döntés (`chair: null`) sem elfogadottnak, sem elvetettnek nem
// számít — a kör egyszerűen nem adott választ arra az állításra, és a felület ezt így mutatja.
// ============================================================
import type { ConferenceThread } from '@/data/character/characterApi'

export interface DeliberationStats {
  /** Hány felvetés hangzott el összesen. */
  proposals: number
  /** Hány kereszt-vita hozzászólás született összesen. */
  reactions: number
  /** Hány állítást vizsgált meg a Szkeptikus (a válasz nélküliek nem számítanak bele). */
  skepticVerdicts: number
  /** Hány állítást fogadott el Mezo. */
  accepted: number
  /** Hány állítást vetett el Mezo. */
  rejected: number
}

const ZERO: DeliberationStats = {
  proposals: 0, reactions: 0, skepticVerdicts: 0, accepted: 0, rejected: 0,
}

export function deliberationStats(threads: ConferenceThread[] | null | undefined): DeliberationStats {
  if (threads == null || threads.length === 0) return { ...ZERO }
  const stats: DeliberationStats = { ...ZERO }
  for (const thread of threads) {
    for (const item of thread.items) {
      stats.proposals += 1
      stats.reactions += item.reactions.length
      if (item.skeptic != null) stats.skepticVerdicts += 1
      if (item.chair != null) {
        if (item.chair.accepted) stats.accepted += 1
        else stats.rejected += 1
      }
    }
  }
  return stats
}

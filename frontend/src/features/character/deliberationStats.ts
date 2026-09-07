// ============================================================
// Mezo · Karakter — deliberationStats (mezo-sp9w)
// A konzílium négy körének számai, EGYETLEN forrásból. `partitionDeliberation` adja a négy
// listát (minden állítás; amit megvitattak; amit a Szkeptikus megvizsgált; amiről Mezo döntött),
// `deliberationStats` pedig ezeknek a listáknak a hosszából/összegéből számol — a kör-térkép ÉS
// a beszélgetés-nézet ugyanebből a partícióból dolgozik (I2, mezo-sp9w branch-review), így a két
// felület sose mondhat egymásnak ellentmondó számot: a garancia a közös forrásból, nem ígéretből
// fakad.
//
// Őszinteség: egy hiányzó elnöki döntés (`chair: null`) sem elfogadottnak, sem elvetettnek nem
// számít — a kör egyszerűen nem adott választ arra az állításra, és a felület ezt így mutatja.
// ============================================================
import type { ConferenceItem, ConferenceThread } from '@/data/character/characterApi'

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

/** The four lists every consumer of a konzílium's threads needs — both the round map's counters
 *  and the chronological view's sections come out of exactly these, so they cannot drift apart. */
export interface DeliberationPartition {
  /** Every proposal item across every thread. */
  items: ConferenceItem[]
  /** The items at least one peer reacted to. */
  debated: ConferenceItem[]
  /** The items the Szkeptikus actually answered. */
  audited: ConferenceItem[]
  /** The items Mezo actually ruled on. */
  ruled: ConferenceItem[]
}

const ZERO: DeliberationStats = {
  proposals: 0, reactions: 0, skepticVerdicts: 0, accepted: 0, rejected: 0,
}

export function partitionDeliberation(threads: ConferenceThread[] | null | undefined): DeliberationPartition {
  const items = threads == null ? [] : threads.flatMap((thread) => thread.items)
  return {
    items,
    debated: items.filter((item) => item.reactions.length > 0),
    audited: items.filter((item) => item.skeptic != null),
    ruled: items.filter((item) => item.chair != null),
  }
}

export function deliberationStats(threads: ConferenceThread[] | null | undefined): DeliberationStats {
  if (threads == null || threads.length === 0) return { ...ZERO }
  const { items, debated, audited, ruled } = partitionDeliberation(threads)
  return {
    proposals: items.length,
    reactions: debated.reduce((sum, item) => sum + item.reactions.length, 0),
    skepticVerdicts: audited.length,
    accepted: ruled.filter((item) => item.chair!.accepted).length,
    rejected: ruled.filter((item) => !item.chair!.accepted).length,
  }
}

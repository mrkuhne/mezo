// ============================================================
// Mezo · Karakter — inventory.ts (mezo-1gim.14, Task 5)
// Source: docs/design_2.0/prototypes/src/karakter-body.html `var INVENTORY` (line ~1154) —
// copied VERBATIM: the Bekötve reads, the four MINDENT-be rounds (n/title/items, each item's
// `t` label + optional `det` detector-key list + `sensitive` flag), and the `later` tail.
//
// THIS FILE IS ITSELF THE mezo-1gim.15 ("MINDENT be") WORKING CHECKLIST. It is static FE
// content by design — not a live read off any backend catalog — because the remaining rounds
// describe DATA SOURCES AND DETECTORS THAT DO NOT EXIST YET (most `det` keys below have no
// matching `CharacterDetector` implementation — see docs/features/character.md §9's "detector
// catalog is narrower than spec" ledger). As mezo-1gim.15 lands each round's items for real —
// a new domain read wired into `CharacterSignalReads`, a new `CharacterDetector` — the
// corresponding row here is expected to be DELETED from `rounds` and (if it names a fully-
// wired data source) ADDED to `reads` below, not silently left stale. Round 1 ("Edzés & test")
// landed this way: its six items are gone from `rounds`, its five data sources are now the
// last five `reads` rows above, and its eight detectors are wired into
// `DetektorokPage.tsx`'s catalog. Do not treat this module as authoritative for "what is
// actually wired today" — `DetektorokPage.tsx` (the 13 real, `DetectorRegistry`-discovered
// detectors) and the backend detector catalog are that runtime truth; this file is the plan,
// not the state of the world.
// ============================================================

export interface InventoryRead {
  /** What is read (prototype's `w`). */
  w: string
  /** Cadence/volume chips (prototype's `chips`), e.g. `['14 nap']`. */
  chips: string[]
}

export interface InventoryItem {
  /** The item's label (prototype's `t`). */
  t: string
  /** Detector key(s) this item feeds, if any (prototype's `det`). */
  det?: string[]
  /** ÉRZÉKENY marker — never a red flag, the lavender-dot house convention. */
  sensitive?: boolean
}

export interface InventoryRound {
  /** 1-based round number (prototype's `n`). */
  n: number
  title: string
  items: InventoryItem[]
}

/** Bekötve (prototype's `INVENTORY.reads`) — the cadences already reading real data today. */
export const INVENTORY_READS: InventoryRead[] = [
  { w: 'Éjszakai kör', chips: ['14 nap'] },
  { w: 'Vasárnapi konzílium', chips: ['heti'] },
  { w: 'Havi mélyolvasás', chips: ['havi'] },
  {
    w: 'Bootstrap (egyszeri)',
    chips: ['60 összegző', '60 minta', '40 tény', '60 review', '60 napló', '40 esemény'],
  },
  { w: 'Gym szettek + feedback (RIR, target, ízület)', chips: ['14 nap'] },
  { w: 'Sport-sessionök (váll-skála, RPE)', chips: ['14 nap'] },
  { w: 'Futás-logok (HR-megnyugvás)', chips: ['14 nap', '8 hét'] },
  { w: 'Alvás (minőség, hossz)', chips: ['14 nap'] },
  { w: 'Mezociklus-kontextus (terv-napok, deload)', chips: ['aktív meso'] },
]

/** Tervezett (prototype's `INVENTORY.rounds`) — the remaining three MINDENT-be rounds, verbatim
 *  (round 1, "Edzés & test", landed for real via mezo-1gim.15 — see `INVENTORY_READS` above and
 *  `DetektorokPage.tsx`'s 13-detector catalog). */
export const INVENTORY_ROUNDS: InventoryRound[] = [
  {
    n: 2,
    title: 'Fuel & ciklus',
    items: [
      { t: 'Makró-teljesítés, NOVA', det: ['comfort-eating'] },
      { t: 'Víz' },
      { t: 'Stack-kihagyások' },
      { t: 'Gyógyszerciklus × check-in', det: ['med-cycle-covariance'], sensitive: true },
    ],
  },
  {
    n: 3,
    title: 'Psziché & viselkedés-meta',
    items: [
      { t: 'Check-in jegyzetek', det: ['self-calibration'], sensitive: true },
      { t: 'Kreed/fókusz × Napzárás', det: ['promise-vs-delivery'] },
      { t: 'Döntésnapló kimenetek', det: ['decision-profile'] },
      { t: 'Hála-témák' },
      { t: 'Streak-törés/visszatérés', det: ['resilience', 'all-or-nothing', 'restart-pattern'] },
      { t: 'Logolási latencia', det: ['retro-logging-ratio'] },
      { t: 'Éjszakai app-aktivitás', det: ['night-activity'] },
      { t: 'Check-in reakcióidő', det: ['checkin-latency'] },
    ],
  },
  {
    n: 4,
    title: 'Kapcsolatok & AI-meta',
    items: [
      { t: 'Emberek-említések', det: ['people-mood-link'] },
      { t: 'Hétvége-szakadék', det: ['weekend-gap'] },
      { t: 'Szezonalitás' },
      { t: 'Chat-témák eltolódása', det: ['chat-topic-shift'] },
      { t: 'Tudástár-triázs döntések', det: ['knowledge-rejection-pattern'], sensitive: true },
      { t: 'Életjel-gyűrűk' },
      { t: 'Quest-szövegek' },
      { t: 'Memoár + predikció' },
    ],
  },
]

/** The "később" tail (prototype's `INVENTORY.later`) — areas beyond the four rounds. */
export const INVENTORY_LATER: string[] = [
  'Súly-naplózási rés (WeightGapDetector — még nem létezik).',
  'Ami a négy kör lezárása után még felmerül.',
]

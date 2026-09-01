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
// `DetektorokPage.tsx`'s catalog. Round 2 ("Fuel & ciklus") landed the same way: its four items
// are gone from `rounds`, its six data sources are now the last six `reads` rows above, and its
// seven detectors are wired into `DetektorokPage.tsx`'s catalog, bringing it to 20. Round 3
// ("Psziché & viselkedés-meta") landed the same way too: its eight items are gone from `rounds`
// (plus the `n: 4` round's `Életjel-gyűrűk` row, pulled forward here via
// `needs-domain-imbalance` before its own round landed), its seven data sources are now the
// last seven `reads` rows above, and its twelve detectors are wired into `DetektorokPage.tsx`'s
// catalog, bringing it to 32. Do not treat this module as authoritative for "what is actually
// wired today" — `DetektorokPage.tsx` (the 32 real, `DetectorRegistry`-discovered detectors)
// and the backend detector catalog are that runtime truth; this file is the plan, not the state
// of the world.
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
  { w: 'Étkezés-napok (makrók, NOVA-arány, étkezés-időpont)', chips: ['8 hét'] },
  { w: 'Makró-célok (aktív cél receptje, különben config)', chips: ['napi'] },
  { w: 'Víz-logok (napi mennyiség vs cél)', chips: ['8 hét'] },
  { w: 'Kiegészítő-stack (aktív protokoll + bevitelek)', chips: ['8 hét', 'aktív protokoll'] },
  { w: 'Check-in skálák (energia, stressz, testi, mentális)', chips: ['8 hét'] },
  { w: 'Gyógyszerciklus (ciklusnap, fázis)', chips: ['8 hét', 'aktív gyógyszer'] },
  { w: 'Napi fókusz + napzárás (kreed-hurok)', chips: ['8 hét'] },
  { w: 'Döntésnapló (kimenet-értékelés, visszanézési határidő)', chips: ['teljes előzmény'] },
  { w: 'Hála-bejegyzések (életterület-címke)', chips: ['8 hét'] },
  { w: 'Életjel-napok (hat terület, streak-pillanatkép)', chips: ['8 hét'] },
  { w: 'Check-in sorok (idősáv, első írás ideje, jegyzet)', chips: ['8 hét'] },
  { w: 'Naplózási latencia (a nap vs. mikor íródott)', chips: ['14 nap', '10 forrás'] },
  { w: 'Chat-időbélyegek (saját üzenetek)', chips: ['14 nap'] },
]

/** Tervezett (prototype's `INVENTORY.rounds`) — the remaining MINDENT-be round, verbatim
 *  (round 1, "Edzés & test", round 2, "Fuel & ciklus", and round 3, "Psziché & viselkedés-meta",
 *  all landed for real via mezo-1gim.15 — see `INVENTORY_READS` above and
 *  `DetektorokPage.tsx`'s 32-detector catalog). */
export const INVENTORY_ROUNDS: InventoryRound[] = [
  {
    n: 4,
    title: 'Kapcsolatok & AI-meta',
    items: [
      { t: 'Emberek-említések', det: ['people-mood-link'] },
      { t: 'Hétvége-szakadék', det: ['weekend-gap'] },
      { t: 'Szezonalitás' },
      { t: 'Chat-témák eltolódása', det: ['chat-topic-shift'] },
      { t: 'Tudástár-triázs döntések', det: ['knowledge-rejection-pattern'], sensitive: true },
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

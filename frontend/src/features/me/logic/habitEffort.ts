// ============================================================
// Mezo · habitEffort — BJ Fogg "simplicity factors" → a habit's XP (mezo-9k99,
// behaviormodel.org/ability; prototype rutin-formalodas.html `EFF`/`effXp`). Fogg lists six
// ability factors; money and social deviance don't bind here, so four are asked. The SUM gives
// the XP in a deliberately NARROW band — 6..14 — the Habitica lesson: a wide, hand-set XP
// makes inflating difficulty worth gaming, a narrow derived one doesn't. The "weakest link"
// (the highest-rated factor) deliberately lives in ADVICE, never in the arithmetic — Fogg's
// counsel is to shrink the behaviour, not to pay more for it. Pure.
// ============================================================

export type EffortFactorKey = 'time' | 'body' | 'mind' | 'fit'

/** null = the user has not rated this factor (counts as the lightest grade, 0). */
export type EffortState = Record<EffortFactorKey, 0 | 1 | 2 | null>

export interface EffortFactor {
  key: EffortFactorKey
  label: string
  hint: string
  /** The three grades, lightest first. */
  opts: [string, string, string]
}

export const EFFORT_FACTORS: EffortFactor[] = [
  { key: 'time', label: 'Idő', hint: 'egy alkalom', opts: ['2 percnél kevesebb', '2–15 perc', '15 percnél több'] },
  { key: 'body', label: 'Fizikai', hint: 'mennyit dolgozik a tested', opts: ['alig', 'érezhetően', 'sokat'] },
  { key: 'mind', label: 'Fejmunka', hint: 'figyelem és akaraterő', opts: ['magától megy', 'kell rá figyelem', 'komoly erőfeszítés'] },
  { key: 'fit', label: 'Beleillik', hint: 'a mai napodba', opts: ['már belefér', 'át kell rendezni', 'teljesen új'] },
]

export const EFFORT_ADVICE: Record<EffortFactorKey, string> = {
  time: 'Ez időben sokat kér. Clear kétperces szabálya: kezdd a két perces változatával — a hosszabbítás jön magától.',
  body: 'Fizikailag nehéz. Fogg tanácsa nem az akaraterő, hanem a méret: vidd le olyan szintre, ami a rossz napodon is megy.',
  mind: 'Ez sok figyelmet kér. A fejmunka a leggyakoribb néma blokkoló — döntsd el előre a részleteket, hogy ne kelljen gondolkodni rajta.',
  fit: 'Ez teljesen új a napodban. Az újdonság önmagában nehézség — kösd erős horgonyhoz, hogy legyen helye.',
}

const LEVELS: { max: number; label: string; sub: string }[] = [
  { max: 2, label: 'Könnyű', sub: 'ez rossz napon is menni fog' },
  { max: 4, label: 'Közepes', sub: 'jó eséllyel tartható' },
  { max: 6, label: 'Erős', sub: 'jó napokon megy, rosszakon csúszni fog' },
  { max: 99, label: 'Nehéz', sub: 'ez így sokat kér — érdemes kisebbre venni' },
]

export const EMPTY_EFFORT: EffortState = { time: null, body: null, mind: null, fit: null }

export function effortSum(e: EffortState): number {
  return EFFORT_FACTORS.reduce((acc, f) => acc + (e[f.key] ?? 0), 0)
}

/** 6–14 XP — the band is the point (see the header note). */
export function effortXp(e: EffortState): number {
  return 6 + effortSum(e)
}

/** True once the user actually rated something — an untouched grid must not overwrite a stored XP. */
export function effortRated(e: EffortState): boolean {
  return EFFORT_FACTORS.some((f) => e[f.key] != null)
}

export function effortLevel(e: EffortState): { label: string; sub: string } {
  const n = effortSum(e)
  return LEVELS.find((l) => n <= l.max) ?? LEVELS[LEVELS.length - 1]
}

/** The first factor rated at the heaviest grade — the "make it tiny" advice target, else null. */
export function effortWeakest(e: EffortState): EffortFactorKey | null {
  return EFFORT_FACTORS.find((f) => e[f.key] === 2)?.key ?? null
}

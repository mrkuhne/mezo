/** Hungarian 1-decimal number: comma separator, trailing ",0" stripped (78.6 → "78,6", 73 → "73"). */
export const hu1 = (v: number): string => v.toFixed(1).replace(/\.0$/, '').replace('.', ',')

/** Hungarian thousands grouping with a regular space, no decimals (1300 → "1 300"), the
 *  KeretBelt.tsx/KeretHero.tsx precedent (not `toLocaleString('hu-HU')`, which only groups from
 *  5 digits up). Negative values use the Unicode minus (U+2212), never the ASCII hyphen. */
export const huInt = (v: number): string => {
  const neg = v < 0
  const grouped = Math.round(Math.abs(v)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  return neg ? `−${grouped}` : grouped
}

/** USD literal, 2 decimals — the admin hub's own LLM-cost figures (mezo-d5iy.11/.19). Was
 *  triplicated verbatim across AdminOverviewPage/AdminUserDetailPage/AdminUsersPage; consolidated
 *  here next to `huInt` per the same precedent. Deliberately not localized — the admin hub shows
 *  the raw USD the LLM providers bill in, never converted/formatted for a Hungarian reader. */
export const usd = (v: number): string => `$${v.toFixed(2)}`

/* Hungarian vowel harmony for a number written in digits (Check-in 2.0 follow-up C): the suffix
 * follows the LAST word of how the number is read aloud (32 → „harminckettő" → -ből, 30 →
 * „harminc" → -ból), the article the FIRST (5 → „öt" → az, 50 → „ötven" → az, 1000 → „ezer" → az). */
const ONES_BACK = new Set([0, 3, 6, 8]) // nulla, három, hat, nyolc; egy/kettő/négy/öt/hét/kilenc → front
const TENS_BACK = new Set([2, 3, 6, 8]) // húsz, harminc, hatvan, nyolcvan; tíz/negyven/ötven/hetven/kilencven → front

/** True when the read-aloud number ends in a back-vowel word (-ból), false for front (-ből). */
const endsBack = (n: number): boolean => {
  if (n === 0) return true // nulla
  if (n % 10 !== 0) return ONES_BACK.has(n % 10)
  if (n % 100 !== 0) return TENS_BACK.has((n % 100) / 10)
  if (n % 1000 !== 0) return true // száz
  if (n % 1_000_000 !== 0) return false // ezer
  return true // millió, milliárd
}

/** True when the read-aloud number starts with a vowel (egy, öt, ötven, ötszáz, ezer, egymillió…). */
const startsWithVowel = (n: number): boolean => {
  if (n >= 1_000_000) return startsWithVowel(Math.floor(n / 1_000_000))
  if (n >= 2000) return startsWithVowel(Math.floor(n / 1000))
  if (n >= 1000) return true // ezer…
  if (n >= 100) return Math.floor(n / 100) === 5 // ötszáz; száz/kétszáz… → consonant
  if (n >= 10) return Math.floor(n / 10) === 5 // ötven; tíz/tizen/húsz… → consonant
  return n === 1 || n === 5 // egy, öt
}

/** „32-ből", „30-ból" — the elative (-ból/-ből) of a non-negative integer in digits. */
export const huFrom = (n: number): string => `${n}-${endsBack(Math.abs(Math.round(n))) ? 'ból' : 'ből'}`

/** „a" / „az" before a number in digits: „az 5", „a 32". */
export const huArticle = (n: number): 'a' | 'az' => (startsWithVowel(Math.abs(Math.round(n))) ? 'az' : 'a')

// Small Hungarian text helpers shared by the converted pages (Folyadék F3, mezo-n4wf5.3): one home for the
// article / suffix / casing rules three Edzés areas each wrote for themselves.

const VOWEL_START = /^[aáeéiíoóöőuúüű]/i

/** The definite article before a WORD: „az" before a vowel sound, else „a". `capital` = sentence-initial. */
export function article(word: string, capital = false): string {
  const az = VOWEL_START.test(word.trim())
  return capital ? (az ? 'Az' : 'A') : az ? 'az' : 'a'
}

/** The definite article before a NUMERAL, as it is read aloud: „az 1." (egy), „az 5." (öt), „az 52." (ötvenkettő),
 *  „az 1000" (ezer) — but „a 10." (tíz), „a 100" (száz). */
export function azA(n: number, capital = false): string {
  const s = String(Math.abs(Math.trunc(n)))
  const az = s[0] === '5' || (s[0] === '1' && s.length % 3 === 1)
  return capital ? (az ? 'Az' : 'A') : az ? 'az' : 'a'
}

/** „3-ból" / „2-ből" — the elative suffix after a number, by the vowel harmony of its LAST spoken word
 *  (három → -ból, kettő → -ből, húsz → -ból, negyven → -ből, száz → -ból, ezer → -ből, nulla → -ból). */
export function outOf(n: number): string {
  const v = Math.abs(Math.trunc(n))
  const units = v % 10
  const tens = Math.floor(v / 10) % 10
  const back = units !== 0 ? [3, 6, 8].includes(units)
    : tens !== 0 ? [2, 3, 6, 8].includes(tens)
      : v === 0 ? true
        : v % 1000 !== 0 ? true // …száz
          : v % 1_000_000 === 0 // …millió (-ból) vs …ezer (-ből)
  return `${n}-${back ? 'ból' : 'ből'}`
}

/** Wire labels arrive upper-case („FUTÁS", „MOST"); on white they read as words („Futás", „Most"). Mixed-case input and
 *  the listed acronyms are left alone. */
const KEEP_CAPS = new Set(['TRX'])
export function sentenceCase(s: string): string {
  if (KEEP_CAPS.has(s) || s !== s.toLocaleUpperCase('hu')) return s
  return s.charAt(0) + s.slice(1).toLocaleLowerCase('hu')
}

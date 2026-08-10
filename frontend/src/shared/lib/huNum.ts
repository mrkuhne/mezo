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

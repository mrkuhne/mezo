/** A Tudástár kliens-oldali keresője (S6, mezo-d6ivw.6): ékezet- és kisbetű-független, a
 *  találatot az EREDETI karakterekkel emeli ki. Karakterenként hajtogat, így a hajtogatott és az
 *  eredeti szöveg indexei egyeznek (a prototípus `norm/hl` párja, innerHTML nélkül). */
const foldChar = (ch: string) => ch.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().charAt(0) || ch

export function fold(s: string): string {
  return Array.from(s).map(foldChar).join('')
}

export function matches(text: string, query: string): boolean {
  const q = query.trim()
  return !q || fold(text).includes(fold(q))
}

export function highlight(text: string, query: string): Array<{ text: string; hit: boolean }> {
  const q = query.trim()
  if (!q) return [{ text, hit: false }]
  const chars = Array.from(text)
  const hay = fold(text)
  const needle = fold(q)
  const out: Array<{ text: string; hit: boolean }> = []
  let i = 0
  let j = hay.indexOf(needle, i)
  while (j > -1) {
    if (j > i) out.push({ text: chars.slice(i, j).join(''), hit: false })
    out.push({ text: chars.slice(j, j + needle.length).join(''), hit: true })
    i = j + needle.length
    j = hay.indexOf(needle, i)
  }
  if (i < chars.length) out.push({ text: chars.slice(i).join(''), hit: false })
  return out
}

export const byNameHu = (a: string, b: string) => a.localeCompare(b, 'hu')

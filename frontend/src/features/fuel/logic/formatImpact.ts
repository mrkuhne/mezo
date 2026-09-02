// "Lehetne jobb" gain box (mezo-zeeq): the wire's `impact` is free text; the scorer's own
// "+0.04 score" shape becomes "+4 pont" (×100, rounded, Unicode minus), anything else is
// shown verbatim — never a fabricated number.
const SCORE_RE = /^([+\-−])?\s*(\d+(?:[.,]\d+)?)\s*score$/i

export function formatImpact(impact: string): string {
  const m = SCORE_RE.exec(impact.trim())
  if (!m) return impact
  const sign = m[1] === '-' || m[1] === '−' ? '−' : '+'
  const pts = Math.round(parseFloat(m[2].replace(',', '.')) * 100)
  return `${sign}${pts} pont`
}

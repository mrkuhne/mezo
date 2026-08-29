// ============================================================
// Heti/napi pontszám sávok (mezo-d20.6.10)
// The one place the 80/70 thresholds live. Source: en-body.html's
// `band()` / `bandC()` — three bands and an explicit "no score" state.
// The lowest band is TERRACOTTA, never red (handoff §2 guardrail): a
// weak week is information, not an alarm.
// ============================================================

/** `'non'` is not "bad" — it is "the Mezo did not score this", which the UI
 *  must render as `tanulom` / `nincs adat`, never as a zero. */
export type ScoreBand = 'hi' | 'mid' | 'low' | 'non'

export function scoreBand(score: number | null | undefined): ScoreBand {
  if (score == null) return 'non'
  if (score >= 80) return 'hi'
  if (score >= 70) return 'mid'
  return 'low'
}

/** The `.sc-*` class the CSS gradients hang off (bars, tiles, columns). */
export function scoreBandClass(score: number | null | undefined): string {
  return `sc-${scoreBand(score)}`
}

/** The ring/ink colour token for a band, as a `var()` reference. */
export function scoreBandColor(score: number | null | undefined): string {
  const band = scoreBand(score)
  return band === 'non' ? 'var(--mz-sc-non-ink)' : `var(--mz-sc-${band}-ring)`
}

export function scoreBandInk(score: number | null | undefined): string {
  const band = scoreBand(score)
  return band === 'non' ? 'var(--mz-sc-non-ink)' : `var(--mz-sc-${band}-ink)`
}

/** `+4` / `−3` / `±0` — the hero's delta pill. Returns null when either side is
 *  missing: an unknown delta is not a zero delta. */
export function scoreDelta(score: number | null | undefined, prev: number | null | undefined):
  { text: string; direction: 'up' | 'down' | 'flat' } | null {
  if (score == null || prev == null) return null
  const d = score - prev
  if (d === 0) return { text: '±0', direction: 'flat' }
  // U+2212 MINUS SIGN, matching the prototype (and every other HU numeral in the app).
  return { text: `${d > 0 ? '+' : '−'}${Math.abs(d)}`, direction: d > 0 ? 'up' : 'down' }
}

// ============================================================
// Mezo · Karakter — the shared expert domain-color map (mezo-1gim.13)
// Mirrors the prototype's `var EXPERTS` colors verbatim
// (docs/design_2.0/prototypes/src/karakter-body.html) — the maturity ring's 7
// CORE arcs and the persona orb cluster both key off this ONE map, so the
// ring segment and the expert's own orb always agree on a color.
// ============================================================

export const EXPERT_COLORS: Record<string, string> = {
  doki: '#3E7396',
  edzo: '#A84A26',
  taplalkozo: '#4E6B42',
  szomnologus: '#5D4FA0',
  pszichologus: '#8E3F6F',
  drill: '#A8801F',
  antropologus: '#2E7D6B',
  szkeptikus: '#4A4038',
  mezo: '#FF5B36',
}

/** Falls back to a neutral ink when a key isn't in the catalog (never a crash on drift). */
export function expertColor(expertKey: string | null | undefined): string {
  if (expertKey == null) return '#A2958A'
  return EXPERT_COLORS[expertKey] ?? '#A2958A'
}

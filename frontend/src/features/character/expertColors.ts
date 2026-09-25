// ============================================================
// Mezo · Karakter — the shared expert domain-color map (mezo-1gim.13)
// Mirrors the prototype's `var EXPERTS` colors verbatim
// (docs/design_2.0/prototypes/src/karakter-body.html) — the maturity ring's 7
// CORE arcs and the persona orb cluster both key off this ONE map, so the
// ring segment and the expert's own orb always agree on a color.
// ============================================================

import { personaCharacter } from '@/features/character/personaCharacter'

const ACCENT_VAR: Record<string, string> = {
  lav: 'var(--dv-lav)', sky: 'var(--dv-sky)', sage: 'var(--dv-sage)', rose: 'var(--dv-rose)', gold: 'var(--dv-amber)', slate: '#8E86A3',
}

/**
 * The expert's on-screen colour. Üvegesítés U9 (mezo-me75u.9): the colour of the csapatfal
 * character the persona folds into (Doki → Derű rose, Edző → Mocor sky …), so a name label, a
 * ring arc and the avatar well always agree. Falls back to a neutral ink when the key is missing.
 */
export function expertColor(expertKey: string | null | undefined): string {
  if (expertKey == null) return '#A2958A'
  return ACCENT_VAR[personaCharacter(expertKey).accent]
}

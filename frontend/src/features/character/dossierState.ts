// ============================================================
// Mezo · Karakter — the ONE untouched-dossier predicate (mezo-1gim.13, fix round 1)
// Review finding: the hub page and the Én-hub tile each grew their OWN "is this pre-bootstrap"
// check, and they disagreed — the tile showed a fabricated "0% átlag érettség" for the exact
// data shape the hub itself treats as "not started yet" and renders the bootstrap face for.
// Both call sites now share this one predicate so they can never drift apart again.
// ============================================================
import type { CharacterOverviewResponse } from '@/data/character/characterApi'

/** The pre-bootstrap/untouched-dossier state: every CORE dimension is still at maturity 0,
 *  with no portrait AND no claims yet. A dossier with ANY signal on ANY CORE dimension is no
 *  longer "empty" even if the aggregate reads low. `overview === null` (switch off) is NOT
 *  this state — that's the degraded case, handled separately by both call sites. */
export function isDossierEmpty(overview: CharacterOverviewResponse | null): boolean {
  if (overview == null) return false
  const core = overview.dimensions.filter((d) => d.kind === 'CORE')
  return core.length > 0 && core.every((d) => d.maturity === 0 && d.portrait === '' && d.topClaims.length === 0)
}

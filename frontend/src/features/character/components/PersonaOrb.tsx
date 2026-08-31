// ============================================================
// Mezo · Karakter — PersonaOrb (mezo-1gim.13)
// Daniel's ask (karakter-body.html §"Orb-variáns karakterikonok"): every
// expert + the Szkeptikus gets its OWN tone of the Mezo orb — the same clay
// recipe, domain-colored, one variant per persona (`s-orb-*` sprites landed
// in Task 2). Mezo keeps the original coral orb (`s-orb`).
// ============================================================
import { ClaySpot, type ClaySpotName } from '@/shared/ui/clay'

const ORB_BY_EXPERT: Record<string, ClaySpotName> = {
  doki: 's-orb-doki',
  edzo: 's-orb-edzo',
  taplalkozo: 's-orb-taplalkozo',
  szomnologus: 's-orb-szomnologus',
  pszichologus: 's-orb-pszichologus',
  drill: 's-orb-drill',
  antropologus: 's-orb-antropologus',
  szkeptikus: 's-orb-szkeptikus',
  mezo: 's-orb',
}

/** mezo (and any unrecognized key — never a crash on catalog drift) fall back to the
 *  original coral orb, `s-orb`. */
export function personaOrbName(expertKey: string): ClaySpotName {
  return ORB_BY_EXPERT[expertKey] ?? 's-orb'
}

export function PersonaOrb({ expertKey, size = 24, className }: { expertKey: string; size?: number; className?: string }) {
  return <ClaySpot name={personaOrbName(expertKey)} size={size} className={className} />
}

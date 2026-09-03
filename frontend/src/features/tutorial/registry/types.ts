import type { ClayIconName, ClaySpotName } from '@/shared/ui/clay'

export type KalauzTier = 'T1' | 'T2' | 'T3'
export type OrbState = 's-orb' | 's-orb-figyel' | 's-orb-unnepel' | 's-orb-ejszaka'
export type KalauzArt = ClayIconName | ClaySpotName

interface CardBase { title: string; voice: string; orb?: OrbState }
export type KalauzCard =
  | (CardBase & { kind: 'intro'; spot: KalauzArt })
  | (CardBase & { kind: 'fogalom'; spot: KalauzArt; term: string; def: string })
  | (CardBase & { kind: 'hogyan'; spot: KalauzArt; anchor?: string })
  | (CardBase & { kind: 'mikor'; spot: KalauzArt })
  | (CardBase & { kind: 'kapcsolat'; links: { to: string; label: string; icon: ClayIconName; effect?: string }[] })

export interface KalauzEntry {
  /** Stable id — the seen-store key. Never rename once shipped; bump `version` instead. */
  id: string
  /** react-router pattern, matched with `end: true` against the pathname. */
  route: string
  tier: KalauzTier
  version: number
  /** The `KALAUZ · <label>` tag in the sheet head — HU, verbatim tab/page name. */
  label: string
  cards: KalauzCard[]
}

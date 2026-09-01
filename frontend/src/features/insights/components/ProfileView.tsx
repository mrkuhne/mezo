// ============================================================
// Mezo · ProfileView (mezo-ms9a, task 7) — `?view=profil`: the pragmatic
// profile card (ProfileNodeCard, „Rólad tanultam" + Archivál) plus a short
// explanatory card underneath (spec §3.4). The header above this view reads
// „Így beszélj velem" (VIEW_HERO_NAME in the shell) — the retired word
// „Profil" never appears user-visible anywhere in this view.
//
// The shell only reaches this view once it already knows `node` is
// non-null: a `?view=profil` with no profile-node falls back to the base
// view there, so this component never has to render a missing-node state.
// ============================================================
import type { CSSProperties } from 'react'
import { ProfileNodeCard } from './ProfileNodeCard'
import type { KnowledgeGraphNode } from '@/data/types'

export function ProfileView({ node, onArchive }: {
  node: KnowledgeGraphNode
  onArchive: () => void
}) {
  return (
    <>
      <div className="rise" style={{ '--d': '0ms' } as CSSProperties}>
        <ProfileNodeCard node={node} onArchive={onArchive} />
      </div>
      <div className="card rise" style={{ '--d': '40ms', padding: 14 } as CSSProperties}>
        <span className="text-secondary" style={{ fontSize: 12, lineHeight: 1.55 }}>
          Ez a bekezdés minden beszélgetés elé odakerül, hogy a társ a te ritmusodban szólaljon
          meg. Az Archiválás a „felejtsd el, amit rólam gondolsz" kar: a blokk kiürül, és a
          következő heti futás építi újra.
        </span>
      </div>
    </>
  )
}

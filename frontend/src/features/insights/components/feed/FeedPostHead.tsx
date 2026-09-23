import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { TEAM, type TeamCharacterId } from '@/features/insights/logic/team'
import type { FeedPost, FeedPostKind } from '@/features/insights/logic/teamFeed'
import { Boop } from '@/shared/ui/clay'

/** A poszt fajtája a fejléc meta-sorában — zéró szaknyelv (spec §2.7). */
const KIND_LABEL: Record<FeedPostKind, string> = {
  kerdes: 'kérdés neked',
  megfigyeles: 'megfigyelés',
  sejtes: 'még csak sejtés',
  kiserlet: 'futó kísérlet',
  ertekeles: 'napi értékelés',
  elorejelzes: 'lezárt előrejelzés',
  konzilium: 'konzílium',
  keres: 'kérés',
  bemutatkozas: 'bemutatkozás',
}

/** Óra:perc, ha a rekord időpontot is hordoz — a napot a nap-elválasztó mondja. */
function clock(iso: string): string | null {
  const m = /T(\d{2}):(\d{2})/.exec(iso)
  return m ? `${m[1]}:${m[2]}` : null
}

export function postMeta(post: FeedPost): string {
  return [clock(post.occurredAt), KIND_LABEL[post.kind], post.guest ? `bevonta ${TEAM[post.guest].nameAcc}` : null]
    .filter(Boolean)
    .join(' · ')
}

export function FeedAvatar({ id, size = 34 }: { id: TeamCharacterId; size?: number }) {
  return (
    <span className={`tf-av tf-c-${TEAM[id].accent}`}>
      <Boop domain={TEAM[id].boop} size={size} />
    </span>
  )
}

/** Facebook-sorrend (spec §2.4): arc (→ a karakter szobája) · név · terület-címke · meta · jelző. */
export function FeedPostHead({ post, flag }: { post: FeedPost; flag?: ReactNode }) {
  const who = TEAM[post.author]
  return (
    <div className="tf-ph">
      <Link to={`/mezo/csapat/${who.id}`} aria-label={`${who.name} szobája`}>
        <FeedAvatar id={who.id} />
      </Link>
      <span className="tf-who">
        <span className="tf-name">{who.name}</span>
        <span className="tf-area">{who.area}</span>
        <span className="tf-meta">{postMeta(post)}</span>
      </span>
      {flag}
    </div>
  )
}

import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { TEAM } from '@/features/insights/logic/team'
import type { FeedPost } from '@/features/insights/logic/teamFeed'
import { localDateString } from '@/shared/lib/dates'
import { renderInline } from '@/shared/lib/markdown'
import { Icon3D } from '@/shared/ui/clay'
// Extension deliberately explicit: on a case-insensitive volume, extensionless resolution
// matches the sibling `observationEvidence.ts` (module, tried first) before `.tsx` — dropping
// the extension silently imports the wrong file (EvidenceList comes back undefined).
import { EvidenceList } from '@/shared/ui/evidence/ObservationEvidence.tsx'
import { FeedGuests } from './FeedGuests'
import { FeedPostHead } from './FeedPostHead'
import { FeedTrio, type FeedReplyMode } from './FeedTrio'

/** Az őszinteség-sáv: n / minN nap, a bizonytalanság kimondva (spec §2.7). */
export function HonestyWell({ post }: { post: FeedPost }) {
  if (!post.honesty) return null
  const { n, minN, label } = post.honesty
  const pct = Math.max(4, Math.min(100, Math.round((n / Math.max(minN, 1)) * 100)))
  return (
    <div className="tf-well">
      <div className="tf-honest">
        <span>{n} / {minN} nap</span>
        <span className="uv-bar"><b style={{ '--w': `${pct}%` } as CSSProperties} /></span>
        <span>{label}</span>
      </div>
    </div>
  )
}

/** „Miből látszik?” — minden állítás forrás-linkje a meglévő mélyoldalra (spec §2.7). */
export function SourceLink({ post }: { post: FeedPost }) {
  return (
    <Link className="tf-source" to={post.sourceRoute}>
      <Icon3D name="t-info" size={16} />
      Miből látszik?
    </Link>
  )
}

/**
 * Derű kérése (H5, mezo-a9bo7.16): a `keres` poszt nem állítás, hanem kérés — ezért a „Miből
 * látszik?” és a hármas helyén egyetlen gomb áll, ami a kiadás saját útvonalára (a bejelentkezésre)
 * visz; a jóváhagyott prototípus `kérés` posztja is így néz ki. A csendes panelen üveg-chip, a
 * poszteren (ami maga az üveg) lapos, színezett pirula — üveg az üvegben nincs (restored bible §3.4).
 */
export function RequestCta({ post, onGlass = false }: { post: FeedPost; onGlass?: boolean }) {
  return (
    // a `.glass` a saját `--c`-jét állítja, ezért a szín a gombon is kimondva (mint `tf-intro-cta`)
    <Link className={`${onGlass ? '' : 'glass '}tf-cta tf-c-${TEAM[post.author].accent}`} to={post.sourceRoute}>
      <Icon3D name="t-heart" size={22} />
      Bejelentkezem
    </Link>
  )
}

/** A rekord saját szövege; a `**kiemelés**` a karakter-mondatok hangsúlya (spec §2.7). */
export function PostBody({ post }: { post: FeedPost }) {
  return (
    <>
      {post.title && <p className="tf-ptitle">{renderInline(post.title, { boldOnly: true })}</p>}
      <p className="tf-body">{renderInline(post.body, { boldOnly: true })}</p>
      {post.evidence && post.evidence.length > 0 &&
        <EvidenceList evidence={post.evidence} today={localDateString()} />}
    </>
  )
}

/** Csendes poszt: halvány, lekerekített lapos panel — üveg-tulajdonság nélkül (restored bible §3.4). */
export function FeedPostCard({ post, onReply }: { post: FeedPost; onReply: (post: FeedPost, mode: FeedReplyMode) => void }) {
  return (
    <article className={`tf-post tf-c-${TEAM[post.author].accent}`} data-post-id={post.id} data-waiting={post.waiting || undefined}>
      <FeedPostHead post={post} flag={post.waiting ? <span className="tf-flag">Rád vár</span> : undefined} />
      <PostBody post={post} />
      <HonestyWell post={post} />
      {post.kind === 'keres' ? (
        <RequestCta post={post} />
      ) : (
        <>
          <SourceLink post={post} />
          <FeedGuests guests={post.guests} />
          <FeedTrio post={post} onReply={onReply} />
        </>
      )}
    </article>
  )
}

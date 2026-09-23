import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { TEAM } from '@/features/insights/logic/team'
import type { FeedPost } from '@/features/insights/logic/teamFeed'
import { renderInline } from '@/shared/lib/markdown'
import { Icon3D } from '@/shared/ui/clay'
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

/** A rekord saját szövege; a `**kiemelés**` a karakter-mondatok hangsúlya (spec §2.7). */
export function PostBody({ post }: { post: FeedPost }) {
  return (
    <>
      {post.title && <p className="tf-ptitle">{renderInline(post.title, { boldOnly: true })}</p>}
      <p className="tf-body">{renderInline(post.body, { boldOnly: true })}</p>
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
      <SourceLink post={post} />
      <FeedTrio post={post} onReply={onReply} />
    </article>
  )
}

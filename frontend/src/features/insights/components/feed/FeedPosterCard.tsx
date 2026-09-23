import { TEAM } from '@/features/insights/logic/team'
import type { FeedPost } from '@/features/insights/logic/teamFeed'
import { renderInline } from '@/shared/lib/markdown'
import { Icon3D } from '@/shared/ui/clay'
import { HonestyWell, SourceLink } from './FeedPostCard'
import { FeedPostHead } from './FeedPostHead'
import { FeedTrio, type FeedReplyMode } from './FeedTrio'

/**
 * A nap posztere — a nap EGYETLEN üveg-doboza (spec §2.4, restored bible §3.4). A cím a nagy
 * állítás; média-blokk csak akkor van, ha a rekord hordoz mérhetőt (őszinteség-sáv) — üres
 * helyre soha nem kerül díszlet-grafikon.
 */
export function FeedPosterCard({ post, onReply }: { post: FeedPost; onReply: (post: FeedPost, mode: FeedReplyMode) => void }) {
  return (
    <article
      className={`glass tf-poster tf-c-${TEAM[post.author].accent}`}
      data-post-id={post.id}
      data-waiting={post.waiting || undefined}
    >
      <FeedPostHead post={post} flag={post.waiting ? <span className="tf-flag">Rád vár</span> : undefined} />
      {post.title && <h3 className="tf-claim">{renderInline(post.title, { boldOnly: true })}</h3>}
      <p className="tf-body">{renderInline(post.body, { boldOnly: true })}</p>
      <HonestyWell post={post} />
      <SourceLink post={post} />
      <FeedTrio post={post} onReply={onReply} />
      <button type="button" className="tf-rrow" onClick={() => onReply(post, 'tell')}>
        <span className="tf-me">Te</span>
        Te hogy látod? Válaszolj…
        <Icon3D name="t-send" size={18} />
      </button>
    </article>
  )
}

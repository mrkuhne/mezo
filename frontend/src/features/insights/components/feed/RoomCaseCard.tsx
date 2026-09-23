import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { TEAM } from '@/features/insights/logic/team'
import type { FeedPost, FeedPostKind } from '@/features/insights/logic/teamFeed'
import { caseStatus } from '@/features/insights/logic/teamRooms'
import { huMonthDay } from '@/shared/lib/dates'
import { renderInline } from '@/shared/lib/markdown'
import { Icon3D, type Icon3DName } from '@/shared/ui/clay'

const KIND_ICON: Record<FeedPostKind, Icon3DName> = {
  kerdes: 't-chat',
  megfigyeles: 't-note',
  sejtes: 't-clock',
  kiserlet: 't-flask',
  ertekeles: 't-score',
  elorejelzes: 't-trend',
  konzilium: 't-journal',
  keres: 't-heart',
  bemutatkozas: 't-people',
}

/** Az ügy jobb felső sarka: a gyűlő adat (n / minN) vagy a nap, amikor történt. */
function caseMeta(post: FeedPost, today: string): string {
  if (post.honesty) return `${post.honesty.n} / ${post.honesty.minN} nap`
  const day = post.occurredAt.slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return post.occurredAt
  return day === today ? 'ma' : huMonthDay(day)
}

/**
 * Egy szoba-ügy (prototípus `.case`): a szoba ELSŐ ügye üveg (`glass`), a többi lapos panel —
 * a rangsor a szobában is az üveg a kivétel (restored bible §3.4). A kártya a meglévő
 * mélyoldalra visz (a poszt „Miből látszik?” célja).
 */
export function RoomCaseCard({ post, owner, lead, today }: {
  post: FeedPost
  owner: keyof typeof TEAM
  lead: boolean
  today: string
}) {
  const status = caseStatus(post)
  const pct = post.honesty ? Math.max(4, Math.min(100, Math.round((post.honesty.n / Math.max(post.honesty.minN, 1)) * 100))) : null
  const guestOf = post.author !== owner ? TEAM[post.author] : post.guest ? TEAM[post.guest] : null
  const heading = post.title ?? post.body
  return (
    <Link
      to={post.sourceRoute}
      className={`${lead ? 'glass ' : ''}tf-case${lead ? '' : ' tf-flatc'} tf-c-${TEAM[owner].accent} tf-s-${status.tone}`}
      data-case-id={post.id}
    >
      <span className="tf-crow">
        <span className="tf-st">{status.label}</span>
        <em>{caseMeta(post, today)}</em>
      </span>
      <span className="tf-cmain">
        <Icon3D name={KIND_ICON[post.kind]} size={36} />
        <span className="tf-ctxt">
          <span className="tf-ctitle">{renderInline(heading, { boldOnly: true })}</span>
          {(post.title || guestOf) && (
            <span className="tf-csub">
              {guestOf && `Közös ügy ${guestOf.nameIns}`}
              {guestOf && post.title && ' · '}
              {post.title && renderInline(post.body, { boldOnly: true })}
            </span>
          )}
        </span>
        <span className="tf-chev" aria-hidden="true">›</span>
      </span>
      {pct != null && <span className="uv-bar"><b style={{ '--w': `${pct}%` } as CSSProperties} /></span>}
    </Link>
  )
}

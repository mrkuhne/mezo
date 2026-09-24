import { TEAM } from '@/features/insights/logic/team'
import type { FeedGuest } from '@/features/insights/logic/teamFeed'
import { renderInline } from '@/shared/lib/markdown'
import { FeedAvatar } from './FeedPostHead'

/** Egy poszt alatt legfeljebb ennyi vendég-sor szólal meg (H4 terv, mezo-a9bo7.15). */
const MAX_GUESTS = 2

/**
 * Vendég-sorok: két karakter beszélget a poszt alatt (H4, mezo-a9bo7.15) — a prototípus
 * kommentelőnézete (`uveg-uzenofal.html` `.cmt`): kis avatár, a név, a karakter mondata.
 * Lapos sor, nem üveg (a poszter maga az üveg — üveg az üvegben nincs). A Szkeptikus a pala
 * boop-variánst viseli (`TEAM.szkeptikus`). A UI semmit sem tesz hozzá: se emoji, se szöveg —
 * a mondat a kiadásé (ADR 0049).
 */
export function FeedGuests({ guests }: { guests: FeedGuest[] | undefined }) {
  if (!guests?.length) return null
  return (
    <>
      {guests.slice(0, MAX_GUESTS).map((g, i) => (
        <div className="tf-cmt" key={`${g.author}-${i}`}>
          <FeedAvatar id={g.author} size={18} />
          <p>
            <b className="tf-cmt-name">{TEAM[g.author].name}</b>
            {renderInline(g.body, { boldOnly: true })}
          </p>
        </div>
      ))}
    </>
  )
}

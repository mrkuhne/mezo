import { useNavigate } from 'react-router-dom'
import { useTeamChat } from '@/data/hooks'
import { TEAM } from '@/features/insights/logic/team'
import { TEAM_CHAT_LAST_SEEN_KEY, stripText, unreadCount } from '@/features/insights/logic/teamChat'
import { FeedAvatar } from '@/features/insights/components/feed/FeedPostHead'
import { renderInline } from '@/shared/lib/markdown'

function readLastSeen(): string | null {
  try {
    return localStorage.getItem(TEAM_CHAT_LAST_SEEN_KEY)
  } catch {
    // Privát mód / tiltott tároló: nincs „látott” időpont — a szám legfeljebb nem nullázódik.
    return null
  }
}

/**
 * A fal élő sávja (Csapatfal Act III, mezo-a9bo7.24; prototípus `.lstrip`) — a csapat-chat
 * bejárata a story-sáv alatt: a nap legutóbbi karakter-sora (ki mondta + mit), az olvasatlanok
 * korall száma, koppintásra a `/mezo/elo` szoba. LAPOS panel, nem üveg — a fal egyetlen üvege a
 * nap posztere. Ha ma még nincs sor, de van nyitott ügy, a legrégebbi ügy címkéje + gazdája áll
 * benne; ha egyik sincs, a sáv nem jelenik meg. Semmit nem fogalmaz (ADR 0049).
 */
export function LiveStrip() {
  const { day, loading } = useTeamChat()
  const navigate = useNavigate()
  if (loading) return null

  const latest = stripText(day)
  const waiting = [...day.openThreads].sort((a, b) => Date.parse(a.openedAt) - Date.parse(b.openedAt))[0]
  if (!latest && !waiting) return null

  const speaker = latest?.speaker ?? waiting!.owner
  const unread = latest ? unreadCount(day, readLastSeen()) : 0

  return (
    <button type="button" className={`tf-live tf-c-${TEAM[speaker].accent}`} onClick={() => navigate('/mezo/elo')}>
      <i className="tf-live-dot" aria-hidden="true" />
      <FeedAvatar id={speaker} size={26} />
      <span className="tf-live-text">
        <small>ÉLŐBEN · A CSAPAT BESZÉL</small>
        {latest ? (
          <span>
            <b>{TEAM[latest.speaker].name}:</b> {renderInline(latest.text, { boldOnly: true })}
          </span>
        ) : (
          <span>
            <b>{waiting!.ruleLabel}</b> — {TEAM[waiting!.owner].name} figyeli
          </span>
        )}
      </span>
      {unread > 0 && (
        <b className="tf-live-cnt" aria-label={`${unread} új sor`}>{unread}</b>
      )}
    </button>
  )
}

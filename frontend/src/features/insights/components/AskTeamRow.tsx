import { Link } from 'react-router-dom'
import { FeedAvatar } from '@/features/insights/components/feed/FeedPostHead'
import { ROOM_IDS } from '@/features/insights/logic/teamRooms'
import '@/features/insights/boop-world.css'
import '@/features/insights/kerdezd.css'

export const ASK_TEAM_ROUTE = '/mezo/diagnozis'

/** Router state the Kérdezd a csapatot page reads for its back pill — „oda visz, ahonnan jöttél". */
export interface AskTeamOrigin {
  from: string
  label: string
}

/**
 * Kérdezd a csapatot belépő (mezo-u3712, prototype uveg-diagnozis.html `askteam`): one gold glass
 * row with the five posting characters stacked, on A csapat (above the Gépterem) and at the bottom
 * of the Nap hub. It opens the Diagnózis page and tells it where the user came from.
 */
export function AskTeamRow({ origin, sub }: { origin: AskTeamOrigin; sub: string }) {
  return (
    <Link to={ASK_TEAM_ROUTE} state={origin} className="glass tf-askteam tf-c-gold">
      <span className="tf-askstack" aria-hidden="true">
        {ROOM_IDS.map((id) => <FeedAvatar key={id} id={id} size={23} />)}
      </span>
      <span className="tf-rowtxt">
        <span className="tf-rowname">Kérdezd a csapatot</span>
        <span className="tf-rowsub">{sub}</span>
      </span>
      <em className="tf-rowbadge" aria-hidden="true">›</em>
    </Link>
  )
}

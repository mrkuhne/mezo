import { useCharacterConference } from '@/data/hooks'
import type { CharacterExpertDto, CharacterFeedItem } from '@/data/character/characterApi'
import { PersonaOrb } from '@/features/character/components/PersonaOrb'
import { displayName } from '@/features/character/deliberationLabels'
import { feedDayLabel } from '@/features/character/feedDayLabel'
import { conferencePostItem } from '@/features/character/logic/conferencePostItem'

const excerpt = (text: string, limit: number) => text.length <= limit ? text : `${text.slice(0, limit).trimEnd()}…`

/** The approved morning scene, grounded in the selected post instead of demo dialogue. */
export function CharacterMorningStory({ item, experts, onOpen }: {
  item: CharacterFeedItem
  experts: CharacterExpertDto[]
  onOpen: () => void
}) {
  const { conference } = useCharacterConference(item.sourceType === 'CONFERENCE_CHANGE' || item.sourceType === 'CONFERENCE_ITEM' ? item.sourceId ?? null : null)
  const proposal = item.sourceId && item.sourceType ? conferencePostItem(conference, { sourceType: item.sourceType, sourceId: item.sourceId, sourceIndex: item.sourceIndex ?? 0 }) : undefined
  const reactions = proposal?.reactions ?? []
  const comments = reactions.length + Number(Boolean(proposal?.skeptic)) + Number(Boolean(proposal?.chair))
  const conversation = comments > 0
  const author = proposal?.expertKey ?? item.expertKey ?? 'mezo'
  const cast = [...new Set([author, ...reactions.map(reaction => reaction.expertKey), ...(proposal?.skeptic ? ['szkeptikus'] : []), ...(proposal?.chair ? ['mezo'] : [])])]
  const quote = reactions[0]?.argument ?? proposal?.skeptic?.argument ?? proposal?.chair?.reason ?? ''
  return (
    <section className="kr-morning-story" aria-label="A csapat kiemelt története">
      <div className="kr-story-top">
        <span>A CSAPAT TÖRTÉNETEI</span>
        <time dateTime={item.at}>{feedDayLabel(item.at).toLowerCase()}</time>
      </div>
      <div className="kr-story-scene">
        <div className="kr-story-cast">
          {cast.slice(0, 3).map(key => <PersonaOrb key={key} expertKey={key} size={65} />)}
        </div>
        <div className="kr-story-bubble">
          {conversation ? <>„{excerpt(quote, 78)}”</> : displayName(experts, author)}
        </div>
      </div>
      <h2>{conversation ? 'Rólad beszélgettünk.' : 'Egy új gondolat rólad.'}<br />Most te jössz.</h2>
      <p>{excerpt(item.text, 230)}</p>
      <div className="kr-story-bottom">
        <button type="button" onClick={onOpen}>
          {conversation ? 'Belenézek a beszélgetésbe' : 'Megnézem a bejegyzést'} <span aria-hidden="true">↗</span>
        </button>
        {conversation && <small>{cast.length} karakter · {comments} szakértői hozzászólás</small>}
      </div>
    </section>
  )
}

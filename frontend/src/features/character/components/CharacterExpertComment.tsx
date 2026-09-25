import type { CharacterExpertDto, ConferencePeerReaction } from '@/data/character/characterApi'
import { PersonaOrb } from '@/features/character/components/PersonaOrb'
import { STANCE_LABEL } from '@/features/character/deliberationLabels'
import { personaName } from '@/features/character/personaCharacter'

/** U9 (mezo-me75u.9): the speaker (and the one replied to) is named as the csapatfal character
 *  the persona folds into — `experts` stays on the props for the callers, but no longer names. */
export function CharacterExpertComment({ reaction }: { reaction: ConferencePeerReaction; experts: CharacterExpertDto[] }) {
  return (
    <div className="kr-social-comment">
      <PersonaOrb expertKey={reaction.expertKey} size={28} />
      <div>
        <strong>{personaName(reaction.expertKey)} <small>{STANCE_LABEL[reaction.stance]}</small></strong>
        <p>{reaction.argument}</p>
        {reaction.replyToExpert && <small>{reaction.replyToExpert === 'user' ? 'Válasz neked' : `Válasz: ${personaName(reaction.replyToExpert)}`}{reaction.round ? ` · ${reaction.round}. kör` : ''}</small>}
        {reaction.participationReason && <small className="kr-peer-context">{reaction.participationReason}</small>}
        {!!reaction.toolNames?.length && <small className="kr-peer-context">Forrásokat olvasott · {new Set(reaction.toolNames).size} eszközzel</small>}
      </div>
    </div>
  )
}

import type { CharacterExpertDto, ConferencePeerReaction } from '@/data/character/characterApi'
import { PersonaOrb } from '@/features/character/components/PersonaOrb'
import { STANCE_LABEL, displayName } from '@/features/character/deliberationLabels'

export function CharacterExpertComment({ reaction, experts }: { reaction: ConferencePeerReaction; experts: CharacterExpertDto[] }) {
  return (
    <div className="kr-social-comment">
      <PersonaOrb expertKey={reaction.expertKey} size={28} />
      <div>
        <strong>{displayName(experts, reaction.expertKey)} <small>{STANCE_LABEL[reaction.stance]}</small></strong>
        <p>{reaction.argument}</p>
        {reaction.replyToExpert && <small>{reaction.replyToExpert === 'user' ? 'Válasz neked' : `Válasz: ${displayName(experts, reaction.replyToExpert)}`}{reaction.round ? ` · ${reaction.round}. kör` : ''}</small>}
        {reaction.participationReason && <small className="kr-peer-context">{reaction.participationReason}</small>}
        {!!reaction.toolNames?.length && <small className="kr-peer-context">Forrásokat olvasott · {new Set(reaction.toolNames).size} eszközzel</small>}
      </div>
    </div>
  )
}

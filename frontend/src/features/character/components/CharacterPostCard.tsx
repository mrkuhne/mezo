import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCharacterConference } from '@/data/hooks'
import { PersonaOrb } from '@/features/character/components/PersonaOrb'
import { CharacterReplyThread } from '@/features/character/components/CharacterReplyThread'
import { CharacterEvidenceSheet } from '@/features/character/sheets/CharacterEvidenceSheet'
import { feedDayLabel } from '@/features/character/feedDayLabel'
import { STANCE_LABEL, displayName } from '@/features/character/deliberationLabels'
import type {
  CharacterExpertDto,
  CharacterFeedItem,
  CharacterReplySource,
} from '@/data/character/characterApi'

export function CharacterPostCard({
  item,
  experts,
}: {
  item: CharacterFeedItem
  experts: CharacterExpertDto[]
}) {
  const navigate = useNavigate()
  const [evidence, setEvidence] = useState(false)
  const [openSignal, setOpenSignal] = useState(0)
  const user = item.expertKey === 'user'
  const author = user ? 'Te' : displayName(experts, item.expertKey ?? 'mezo')
  const expert = experts.find((entry) => entry.key === item.expertKey)
  const source: CharacterReplySource | null =
    item.sourceId && item.sourceType
      ? { sourceId: item.sourceId, sourceType: item.sourceType, sourceIndex: item.sourceIndex ?? 0 }
      : null
  function reply() {
    setEvidence(false)
    setOpenSignal((value) => value + 1)
  }
  return (
    <article className={`kr-social-post ${item.kind === 'CONFERENCE_CHANGE' ? 'is-outcome' : ''}`}>
      <header className="kr-post-author">
        {user ? (
          <span className="kr-self-avatar">Te</span>
        ) : (
          <PersonaOrb expertKey={item.expertKey ?? 'mezo'} size={44} />
        )}
        <div>
          <strong>{author}</strong>
          <small>
            {expert?.role ?? (user ? 'Saját közlés' : 'A csapat összegzése')} ·{' '}
            {feedDayLabel(item.at).toLowerCase()}
          </small>
        </div>
        <span className="kr-post-kind">
          {item.kind === 'CONFERENCE_CHANGE' ? 'Összegzés' : 'Megfigyelés'}
        </span>
      </header>
      <p className="kr-post-text">{item.text}</p>
      {source?.sourceType === 'CONFERENCE_CHANGE' && (
        <ConferencePostContext source={source} experts={experts} />
      )}
      <div className="kr-post-actions">
        <button type="button" onClick={() => setEvidence(true)}>
          Miből látszik?
        </button>
        {source && (
          <button type="button" onClick={reply}>
            Válaszolok
          </button>
        )}
        {item.kind === 'CONFERENCE_CHANGE' && (
          <button
            type="button"
            onClick={() => navigate(`/mezo/karakter/konzilium${source ? `?id=${source.sourceId}` : ''}`)}
          >
            Beszélgetés ›
          </button>
        )}
      </div>
      {source && <CharacterReplyThread source={source} openSignal={openSignal} />}
      {evidence && (
        <CharacterEvidenceSheet
          text={item.text}
          expertKey={item.expertKey}
          at={item.at}
          evidence={item.evidence?.map((entry) => ({ sourceKind: entry.kind, snippet: entry.label }))}
          onClose={() => setEvidence(false)}
          onReply={source ? reply : undefined}
        />
      )}
    </article>
  )
}

function ConferencePostContext({
  source,
  experts,
}: {
  source: CharacterReplySource
  experts: CharacterExpertDto[]
}) {
  const { conference } = useCharacterConference(source.sourceId)
  const claimId = conference?.changes[source.sourceIndex]?.claimId
  const proposal = claimId
    ? conference?.deliberation?.flatMap((thread) => thread.items).find((item) => item.claimId === claimId)
    : undefined
  if (!proposal || !proposal.reactions.length || conference?.deliberationSource !== 'STORED') return null
  return (
    <div className="kr-peer-thread">
      <div className="kr-reaction-summary">
        <span className="kr-facepile">
          {proposal.reactions.map((reaction, i) => (
            <PersonaOrb key={`${reaction.expertKey}-${i}`} expertKey={reaction.expertKey} size={24} />
          ))}
        </span>
        <span>{proposal.reactions.length} szakértői hozzászólás</span>
      </div>
      {proposal.reactions.map((reaction, i) => (
        <div className="kr-social-comment" key={i}>
          <PersonaOrb expertKey={reaction.expertKey} size={28} />
          <div>
            <strong>
              {displayName(experts, reaction.expertKey)} <small>{STANCE_LABEL[reaction.stance]}</small>
            </strong>
            <p>{reaction.argument}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

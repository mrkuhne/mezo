import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCharacterConference, useClaimFeedback } from '@/data/hooks'
import { PersonaOrb } from '@/features/character/components/PersonaOrb'
import { CharacterReplyThread } from '@/features/character/components/CharacterReplyThread'
import { CharacterEvidenceSheet } from '@/features/character/sheets/CharacterEvidenceSheet'
import { feedDayLabel } from '@/features/character/feedDayLabel'
import { SKEPTIC_LABEL } from '@/features/character/deliberationLabels'
import { personaCharacter } from '@/features/character/personaCharacter'
import { Icon3D } from '@/shared/ui/clay'
import { CharacterExpertComment } from '@/features/character/components/CharacterExpertComment'
import { conferencePostItem } from '@/features/character/logic/conferencePostItem'
import { CharacterRevisionSheet } from '@/features/character/sheets/CharacterRevisionSheet'
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
  // U9 (mezo-me75u.9): the author is shown as the csapatfal character the persona folds into
  // („Derű”, not „Doki”), wearing that character's accent; the persona key stays the data.
  const who = personaCharacter(item.expertKey ?? 'mezo')
  const author = user ? 'Te' : who.name
  const expert = experts.find((entry) => entry.key === item.expertKey)
  const source: CharacterReplySource | null =
    item.sourceId && item.sourceType
      ? { sourceId: item.sourceId, sourceType: item.sourceType, sourceIndex: item.sourceIndex ?? 0 }
      : null
  function reply() {
    setEvidence(false)
    setOpenSignal((value) => value + 1)
  }
  const outcome = item.kind === 'CONFERENCE_CHANGE'
  return (
    <article className={`tf-post kr9-post tf-c-${user ? 'lav' : who.accent}${outcome ? ' is-outcome' : ''}`}>
      <header className="tf-ph">
        {user ? (
          <span className="tf-av tf-c-lav kr9-self" aria-hidden="true">Te</span>
        ) : (
          <PersonaOrb expertKey={item.expertKey ?? 'mezo'} size={42} />
        )}
        <span className="tf-who">
          <strong className="tf-name">{author}</strong>
          <span className="tf-meta">
            {user ? 'Saját közlés' : expert ? (who.area || expert.role) : 'A csapat összegzése'} ·{' '}
            {feedDayLabel(item.at).toLowerCase()}
          </span>
        </span>
        <span className={`kr9-kind${outcome ? ' tf-c-gold' : ''}`}>
          {outcome ? 'Összegzés' : item.kind === 'CONFERENCE_POST' ? 'Megbeszéljük' : 'Megfigyelés'}
        </span>
      </header>
      <p className="tf-body kr9-ptext">{item.text}</p>
      {(source?.sourceType === 'CONFERENCE_CHANGE' || source?.sourceType === 'CONFERENCE_ITEM') && (
        <ConferencePostContext source={source} experts={experts} onReply={reply} />
      )}
      <div className="tf-acts">
        <button type="button" onClick={() => setEvidence(true)}>
          <Icon3D name="t-lens" size={19} />Miből látszik?
        </button>
        {source && (
          <button type="button" onClick={reply}>
            <Icon3D name="t-chat" size={19} />Válaszolok
          </button>
        )}
        {(item.kind === 'CONFERENCE_CHANGE' || item.kind === 'CONFERENCE_POST') && (
          <button
            type="button"
            onClick={() => navigate(`/mezo/karakter/konzilium${source ? `?id=${source.sourceId}` : ''}`)}
          >
            <Icon3D name="t-council" size={19} />Beszélgetés ›
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
  onReply,
}: {
  source: CharacterReplySource
  experts: CharacterExpertDto[]
  onReply: () => void
}) {
  const { conference, isLoading, isError, refetch } = useCharacterConference(source.sourceId)
  const [history, setHistory] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const proposal = conferencePostItem(conference, source)
  if (isLoading) return <p role="status" className="kr9-ctx">A beszélgetés betöltése…</p>
  if (isError) return <p role="alert" className="kr9-ctx">A beszélgetés nem töltődött be. <button type="button" className="kr9-inline" onClick={refetch}>Újratöltés</button></p>
  if (!proposal) return null
  const comments = proposal.reactions.length + Number(Boolean(proposal.skeptic)) + Number(Boolean(proposal.chair))
  const followups = conference?.followups?.filter(entry => entry.sourceIndex === proposal.index) ?? []
  if (!comments && followups.length === 0) return null
  return (
    <div className="kr9-thread">
      <div className="tf-sum">
        <span className="tf-minis">
          {proposal.reactions.map((reaction, i) => (
            <PersonaOrb key={`${reaction.expertKey}-${i}`} expertKey={reaction.expertKey} size={22} />
          ))}
        </span>
        <span>{comments} szakértői hozzászólás</span>
      </div>
      {proposal.reactions.slice(0, expanded ? undefined : 2).map((reaction, i) => <CharacterExpertComment key={i} reaction={reaction} experts={experts} />)}
      {proposal.reactions.length > 2 && <button type="button" className="kr9-link" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
        {expanded ? 'Kevesebb hozzászólás' : `További ${proposal.reactions.length - 2} szakértői hozzászólás`}
      </button>}
      {proposal.skeptic && <div className="kr-social-comment">
        <PersonaOrb expertKey="szkeptikus" size={28} />
        <div><strong>Szkeptikus <small>{SKEPTIC_LABEL[proposal.skeptic.verdict]}</small></strong><p>{proposal.skeptic.argument}</p></div>
      </div>}
      {proposal.chair && <div className="kr-social-comment is-mezo">
        <PersonaOrb expertKey="mezo" size={28} />
        <div><strong>Mezo <small>{proposal.chair.accepted ? 'Elfogadott javaslat' : 'Ezt a javaslatot nem fogadta el'}</small></strong><p>{proposal.chair.reason}</p>
          {proposal.claimId && <button type="button" className="kr9-link" onClick={() => setHistory(true)}>Mi változott?</button>}
        </div>
      </div>}
      {proposal.claimId && <ClaimPostFeedback claimId={proposal.claimId} />}
      {followups.map(entry => <div className="kr-social-comment is-followup" key={entry.id}>
        <PersonaOrb expertKey={entry.expertKey} size={28} />
        <div>
          <strong>{entry.status === 'CLOSED' ? 'Ezt a kérdést lezártuk' : entry.status === 'REVISITED' ? 'Újra megnéztük' : entry.kind === 'QUESTION' ? 'A válaszodra várunk' : 'Ekkor nézzük újra'}</strong>
          <p>{entry.question}</p>
          <small>{entry.requiredEvidence}</small>
          {entry.status === 'WAITING' && <p><time dateTime={entry.dueOn}>{new Date(`${entry.dueOn}T12:00:00`).toLocaleDateString('hu-HU', { month: 'long', day: 'numeric' })}</time></p>}
          {entry.status === 'WAITING' && entry.kind === 'QUESTION' && <button type="button" className="kr9-link" onClick={onReply}>Válaszolok a kérdésre</button>}
          {entry.resolvedByConferenceId && <a className="kr9-link" href={`/mezo/karakter/konzilium?id=${entry.resolvedByConferenceId}`}>Megnézem, mire jutottunk ›</a>}
        </div>
      </div>)}
      {history && proposal.claimId && <CharacterRevisionSheet claimId={proposal.claimId} onClose={() => setHistory(false)} />}
    </div>
  )
}

function ClaimPostFeedback({ claimId }: { claimId: string }) {
  const { submit, pending } = useClaimFeedback()
  const [result, setResult] = useState<'success' | 'error' | null>(null)
  async function send(feedback: 'TALAL' | 'NEM_IGAZ') {
    setResult(null)
    try {
      await submit(claimId, feedback)
      setResult('success')
    } catch {
      setResult('error')
    }
  }
  return <div>
    <div className="tf-acts kr9-fb" role="group" aria-label="Visszajelzés a következtetésről">
      <button type="button" disabled={pending} onClick={() => void send('TALAL')}><Icon3D name="t-thumb-up" size={19} />Hasznos</button>
      <button type="button" disabled={pending} onClick={() => void send('NEM_IGAZ')}><Icon3D name="t-thumb-down" size={19} />Nem így érzem</button>
    </div>
    {result === 'success' && <p role="status" className="tf-after"><Icon3D name="t-tick" size={15} />Köszönjük a visszajelzést.</p>}
    {result === 'error' && <p role="alert" className="tf-error">A visszajelzés mentését nem tudtuk megerősíteni. Próbáld újra.</p>}
  </div>
}

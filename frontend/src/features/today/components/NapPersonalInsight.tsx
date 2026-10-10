import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useObservations, useObservationReply } from '@/data/hooks'
import type { Observation, ObservationChoice } from '@/data/types'
import { SafeMarkdown } from '@/shared/lib/safeMarkdown'
import { localDateString } from '@/shared/lib/dates'
import { EvidenceList } from '@/shared/ui/evidence/EvidenceList'
import { Acts, Btn, Card, Empty, ErrorRow, Head, Lk, Msg, Note, Section } from '@/shared/ui/folyadek'

const ALL_ROUTE = '/nap/uzenetek?tab=eszrevetelek'
const kindOf = (item: Observation) => item.card === 'confirmed' ? 'megerősített minta' : 'észrevétel'

function InsightContent({ item }: { item: Observation }) {
  const navigate = useNavigate()
  const { reply, pendingPatternId } = useObservationReply()
  const [answered, setAnswered] = useState<ObservationChoice>()
  const [sending, setSending] = useState(false)
  const [failed, setFailed] = useState(false)
  const inFlight = useRef(false)
  const [evidenceOpen, setEvidenceOpen] = useState(false)
  const evidenceId = `nm-evi-${item.id}`
  const evidenceToggle = item.evidence.length > 0 && <Lk aria-expanded={evidenceOpen} aria-controls={evidenceOpen ? evidenceId : undefined} onClick={() => setEvidenceOpen(v => !v)}>{evidenceOpen ? 'Elrejtem' : 'Miből látod?'}</Lk>
  const knownAnswer = answered ?? item.repliedChoice
  const asks = (item.card === 'fresh' || item.card === 'return') && !knownAnswer
  const pending = sending || pendingPatternId === item.patternId
  const openChat = () => navigate('/mezo/chat', { state: { compose: `Beszéljünk erről az észrevételről: ${item.title}\n\n${item.text}` } })
  const answer = async (choice: ObservationChoice) => {
    // The reply endpoint is non-idempotent: block a second event before React renders.
    if (inFlight.current || knownAnswer || pending) return
    inFlight.current = true
    setSending(true)
    setFailed(false)
    try {
      const result = await reply(item.patternId, choice)
      setAnswered(choice)
      if (choice === 'talk') {
        if (result.conversationId) navigate(`/mezo/chat?c=${encodeURIComponent(result.conversationId)}`)
        else openChat()
      }
    } catch {
      setFailed(true)
    } finally {
      inFlight.current = false
      setSending(false)
    }
  }
  return <>
    <Head icon="t-pattern" title={item.title} link="Összes" onLink={() => navigate(ALL_ROUTE)} />
    <Msg member="mezo" meta={kindOf(item)}>
      <p><SafeMarkdown text={item.text} /></p>
      {item.question && <p className="nm-obs-q"><SafeMarkdown text={item.question} /></p>}
    </Msg>
    {evidenceOpen && <div className="nm-evi" id={evidenceId}><EvidenceList evidence={item.evidence} today={localDateString()} /></div>}
    {asks ? <Acts role="group" aria-label="Válaszod az észrevételre">
      <Btn sm disabled={pending} onClick={() => { void answer('watch') }}>Igen, ez igaz rám</Btn>
      <Btn sm ghost disabled={pending} onClick={() => { void answer('reject') }}>Nem, ez nem stimmel</Btn>
      <Btn sm ghost disabled={pending} onClick={() => { void answer('talk') }}>Beszéljük meg</Btn>
      {evidenceToggle}
    </Acts> : <Acts>
      {answered && <span role="status" className="nm-okline">Megjegyeztem a válaszod.</span>}
      <Lk onClick={openChat}>Beszéljünk róla</Lk>
      {evidenceToggle}
    </Acts>}
    {failed && <Note role="alert">Nem sikerült elküldeni a válaszod. Próbáld újra.</Note>}
  </>
}

/** „Észrevétel" on Mai (Folyadék prototype `obsCard()`): the section heading and ONE card — the first
 *  substantive, non-rejected observation as a Mezo message with its evidence and the reply buttons. */
export function NapPersonalInsight({ date }: { date?: string }) {
  const navigate = useNavigate()
  const { observations, isPending, isError, degraded, refetch } = useObservations(date)
  const item = observations.find(observation => observation.text.trim() && observation.repliedChoice !== 'reject')
  const shown = !isPending && !isError && !degraded ? item : undefined
  return <>
    <Section title="Észrevétel" link={shown ? `Mezo · ${kindOf(shown)}` : 'Mezo'} />
    <Card aria-label="Személyes Mezo-észrevétel">
      {isPending ? <Note role="status">Összerakom az észrevételeidet…</Note>
        : isError ? <ErrorRow message="Az észrevételt most nem sikerült betölteni." onRetry={() => { void refetch() }} retryLabel="Újrapróbálom" />
          : !shown ? <Empty icon="t-pattern" actions={<Lk onClick={() => navigate('/mezo/chat')}>Beszéljünk</Lk>}>
            {degraded ? 'Az észrevételek most nem érhetők el.' : 'Még nincs észrevétel. Néhány nap adat kell hozzá.'}
          </Empty>
            : <InsightContent key={shown.id} item={shown} />}
    </Card>
  </>
}

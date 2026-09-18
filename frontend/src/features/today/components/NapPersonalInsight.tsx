import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useObservations, useObservationReply } from '@/data/hooks'
import type { Observation, ObservationChoice } from '@/data/types'
import { SafeMarkdown } from '@/shared/lib/safeMarkdown'
import { ClayIcon } from '@/shared/ui/clay'
import '@/features/today/components/NapPersonalInsight.css'

/** A kártya jele (visszaöltöztetés, mezo-ju4j6.10): agyag kristály — az észrevétel
 *  szimbóluma a ház saját készletéből. A Titán-kori forgó pálya-rajz (három maszkolt
 *  gyűrű + izzó mag) a helyével együtt megmarad, csak az anyaga lett a régi világé. */
function InsightArt() {
  return <div className="nap-personal-art" aria-hidden="true"><ClayIcon name="i-kristaly" size={64} /></div>
}

function InsightContent({ item }: { item: Observation }) {
  const navigate = useNavigate()
  const { reply, pendingPatternId } = useObservationReply()
  const [answered, setAnswered] = useState<ObservationChoice>()
  const [sending, setSending] = useState(false)
  const [failed, setFailed] = useState(false)
  const inFlight = useRef(false)
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
    <div className="nap-personal-heading"><span>Mezo · {item.card === 'confirmed' ? 'Megerősített minta' : 'Észrevétel'}</span><Link to="/nap/uzenetek?tab=eszrevetelek">Összes észrevétel ↗</Link></div>
    <InsightArt />
    <h2>{item.title}</h2>
    <p className="nap-personal-copy"><SafeMarkdown text={item.text} /></p>
    {item.question && <p className="nap-personal-question"><SafeMarkdown text={item.question} /></p>}
    {item.evidence.length > 0 && <details className="nap-personal-evidence"><summary>Miből látom?</summary><ul>{item.evidence.map((evidence, index) => <li key={index}><SafeMarkdown text={evidence} /></li>)}</ul></details>}
    {asks ? <div className="nap-personal-actions" role="group" aria-label="Válaszod az észrevételre">
      <button type="button" disabled={pending} onClick={() => { void answer('watch') }}>{item.card === 'return' ? 'Így van' : 'Igen, figyeld'}</button>
      <button type="button" disabled={pending} onClick={() => { void answer('reject') }}>{item.card === 'return' ? 'Kivétel volt' : 'Nem stimmel'}</button>
      {item.card === 'fresh' && <button type="button" disabled={pending} onClick={() => { void answer('talk') }}>Mesélj erről</button>}
    </div> : <>
      {answered && <p role="status" className="nap-personal-ack">Megjegyeztem a válaszod.</p>}
      <button type="button" className="nap-personal-chat" onClick={openChat}>Beszéljünk róla <span aria-hidden="true">↗</span></button>
    </>}
    {failed && <p role="alert">Nem sikerült elküldeni a válaszod. Próbáld újra.</p>}
  </>
}

export function NapPersonalInsight({ date }: { date?: string }) {
  const { observations, isPending, isError, degraded, refetch } = useObservations(date)
  const item = observations.find(observation => observation.text.trim() && observation.repliedChoice !== 'reject')
  return <section className="nap-personal" aria-label="Személyes Mezo-észrevétel">
    {isPending ? <p role="status">Összerakom az észrevételeidet…</p>
      : isError ? <><p role="alert">Nem sikerült betölteni az észrevételeidet.</p><button type="button" className="nap-personal-chat" onClick={() => { void refetch() }}>Újrapróbálom</button></>
        : degraded || !item ? <><InsightArt /><span className="nap-personal-eyebrow">Mezo · Ismerkedünk</span><h2>{degraded ? 'Az észrevételek most nem érhetők el.' : 'Még nincs személyes észrevétel.'}</h2><p className="nap-personal-copy">A check-injeid és naplóbejegyzéseid adnak kapaszkodót a közös beszélgetésekhez.</p><Link className="nap-personal-chat" to="/mezo/chat">Beszéljünk <span aria-hidden="true">↗</span></Link></>
          : <InsightContent key={item.id} item={item} />}
  </section>
}

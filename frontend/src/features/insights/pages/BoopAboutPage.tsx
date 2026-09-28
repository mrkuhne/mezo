import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Boop, Icon3D, type Icon3DName } from '@/shared/ui/clay'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { useEffectSubjects, useKnowledgeObservations } from '@/data/hooks'
import { usePeople } from '@/data/me/peopleHooks'
import { useRoladInbox } from '@/features/insights/hooks/useRoladInbox'
import { ROLAD_COPY } from '@/features/insights/logic/roladCopy'
import { hubCounts } from '@/features/insights/logic/hubCounts'
import { HubTiles, type HubSectionKey } from '@/features/insights/components/hub/HubTiles'
import { RoladQuote } from '@/features/insights/components/rolad/RoladQuote'
import { RoladInbox } from '@/features/insights/components/rolad/RoladInbox'
import { riseStyle } from '@/features/insights/components/rolad/riseStyle'
import { lastSeenLabel } from '@/features/insights/logic/metricFormat'
import '@/features/insights/boop-world.css'

// S6c „rövid elosztó” (mezo-2dfy2, spec S6c addendum, prototype `uveg-mezo-teljes-s6.js`
// rolad6(), owner OK 2026-09-27): the page's one sentence is "itt döntesz, és innen nyílik
// minden, amit rólad tudunk". Quote → decision inbox (max 2 open cards, the rest folded) →
// the hub's four section tiles (kirakat) → doors — the freshest-facts block left the page
// (the hub's Rólad section owns it), the life-event timeline lives behind its own door, and
// the „A te kezedben” note shrank to a footnote.
const DOORS: { to: string; icon: Icon3DName; accent: string; name: string; sub: string }[] = [
  { to: '/mezo/karakter/dimenziok', icon: 't-person', accent: 'rose', name: 'A csapat képe rólad, dimenziónként', sub: 'témakörönként · mindegyik pontosítható' },
  { to: '/mezo/rolad/eletesemenyek', icon: 't-sun', accent: 'gold', name: 'Életesemények', sub: 'a nagy fordulatok, amikhez a csapat igazodik' },
  { to: '/settings/mezo/communication', icon: 't-chat', accent: 'lav', name: 'Így beszélj velem', sub: 'a saját kommunikációs kéréseid' },
  { to: '/mezo/knowledge?view=kategoriak', icon: 't-graph', accent: 'lav', name: 'Kapcsolatok', sub: 'a tudásod térképe' },
]

const WEEK_START = /^\d{4}-\d{2}-\d{2}$/

export function BoopAboutPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const start = params.get('start')
  const inbox = useRoladInbox()

  // The kirakat mirrors the hub base view: same counts logic, same tiles, same honest
  // loading/error/off dashes (never an invented zero). The facts Loadable reuses the knowledge
  // state already mounted through `useRoladInbox` — no second flag wiring for the same query.
  const peopleQ = usePeople()
  const obsQ = useKnowledgeObservations()
  const effectsQ = useEffectSubjects()
  const counts = hubCounts(
    { items: inbox.facts, degraded: inbox.degraded, isPending: inbox.isPending, isError: inbox.isError, refetch: inbox.refetch },
    { items: peopleQ.people, degraded: false, isPending: peopleQ.isPending, isError: peopleQ.isError, refetch: peopleQ.refetch },
    { items: obsQ.observations, degraded: obsQ.degraded, isPending: obsQ.isPending, isError: obsQ.isError, refetch: obsQ.refetch },
    { items: effectsQ.subjects, degraded: effectsQ.degraded, isPending: effectsQ.isPending, isError: effectsQ.isError, refetch: effectsQ.refetch },
  )
  const openHub = (view: HubSectionKey) => navigate(`/mezo/knowledge?view=${view}`)

  return (
    <div className="kr9-rolad">
      <EntranceGroup className="kr9-rflow">
        <header className="tf-head kr9-rhead rise" style={riseStyle(0)}>
          <div><small>A közös kép · amit a csapat kimondott rólad</small><h1>Rólad</h1></div>
          <Boop domain="me" size={64} alive />
        </header>

        {start && WEEK_START.test(start) && (
          <div className="glass tf-strip tf-c-rose kr9-week rise" style={riseStyle(30)} data-week-banner>
            <Icon3D name="t-calendar" size={24} />
            <span className="tf-strip-text">Heti áttekintés · {lastSeenLabel(start)}. A héten felmerült javaslatok is itt vannak.</span>
            <Link to={`/me/week?start=${start}`} className="kr9-weeklink">Vissza ehhez a héthez →</Link>
          </div>
        )}

        <RoladQuote delay={60} />
        <RoladInbox inbox={inbox} delay={120} />

        <section aria-labelledby="kr9-kirakat-h" data-rolad-kirakat>
          <div className="tf-sec">
            <h2 id="kr9-kirakat-h">{ROLAD_COPY.kirakatTitle}</h2>
            <span className="tf-hint">{ROLAD_COPY.kirakatHint}</span>
          </div>
          <div className="tud9 kr9-kirakat rise" style={riseStyle(280)}>
            <HubTiles {...counts.sections} onOpen={openHub} factsTitle={ROLAD_COPY.factsTile} />
          </div>
        </section>

        <div className="tf-sec"><h2>Tovább</h2></div>
        <nav className="tf-rows kr9-rlinks" aria-label="Tovább">
          {DOORS.map((d, i) => (
            <Link key={d.to} to={d.to} className={`glass tf-rowg tf-c-${d.accent} rise`} style={riseStyle(400 + i * 45)}>
              <Icon3D name={d.icon} size={40} />
              <span className="tf-rowtxt">
                <span className="tf-rowname">{d.name}</span>
                <span className="tf-rowsub">{d.sub}</span>
              </span>
              <span className="tf-rowbadge" aria-hidden="true">›</span>
            </Link>
          ))}
        </nav>

        <p className="kr9-quiet kr9-note rise" style={riseStyle(620)}>{ROLAD_COPY.note}</p>
      </EntranceGroup>
    </div>
  )
}

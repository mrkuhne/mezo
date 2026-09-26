import { Link, useSearchParams } from 'react-router-dom'
import { Boop, Icon3D, type Icon3DName } from '@/shared/ui/clay'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { useKnowledgeGraphNodes } from '@/data/hooks'
import { useRoladInbox } from '@/features/insights/hooks/useRoladInbox'
import { ROLAD_COPY } from '@/features/insights/logic/roladCopy'
import { RoladQuote } from '@/features/insights/components/rolad/RoladQuote'
import { RoladInbox } from '@/features/insights/components/rolad/RoladInbox'
import { RoladFacts } from '@/features/insights/components/rolad/RoladFacts'
import { RoladTimeline } from '@/features/insights/components/rolad/RoladTimeline'
import { riseStyle } from '@/features/insights/components/rolad/riseStyle'
import { lastSeenLabel } from '@/features/insights/logic/metricFormat'
import '@/features/insights/boop-world.css'

// U9b „Rólad — a közös kép” (mezo-zpxv7, owner OK 2026-09-26, prototype `uveg-mezo-teljes-u9.js`
// rolad()): the heading, the one quote the team said, the decision inbox (moved here from the
// Tudástár), the freshest facts, the life-event timeline, the „A te kezedben” note, and the doors.
// The dimension list is no longer embedded — it lives behind the first door.
const DOORS: { to: string; icon: Icon3DName; accent: string; name: string; sub: string }[] = [
  { to: '/mezo/karakter/dimenziok', icon: 't-person', accent: 'rose', name: 'A csapat képe rólad, dimenziónként', sub: 'témakörönként · mindegyik pontosítható' },
  { to: '/settings/mezo/communication', icon: 't-chat', accent: 'lav', name: 'Így beszélj velem', sub: 'a saját kommunikációs kéréseid' },
  { to: '/mezo/knowledge?view=kategoriak', icon: 't-graph', accent: 'lav', name: 'Kapcsolatok', sub: 'a tudásod térképe' },
]

const WEEK_START = /^\d{4}-\d{2}-\d{2}$/

export function BoopAboutPage() {
  const [params] = useSearchParams()
  const start = params.get('start')
  const inbox = useRoladInbox()
  const { nodes } = useKnowledgeGraphNodes()

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
        <RoladFacts facts={inbox.facts} degraded={inbox.degraded} delay={260} />
        <RoladTimeline nodes={nodes} delay={440} />

        <div className="glass tf-pnote tf-c-rose kr9-note rise" style={riseStyle(500)}>
          <Icon3D name="t-shield" size={36} />
          <div><small>A te kezedben</small><p>{ROLAD_COPY.note}</p></div>
        </div>

        <div className="tf-sec"><h2>Tovább</h2></div>
        <nav className="tf-rows kr9-rlinks" aria-label="Tovább">
          {DOORS.map((d, i) => (
            <Link key={d.to} to={d.to} className={`glass tf-rowg tf-c-${d.accent} rise`} style={riseStyle(560 + i * 45)}>
              <Icon3D name={d.icon} size={40} />
              <span className="tf-rowtxt">
                <span className="tf-rowname">{d.name}</span>
                <span className="tf-rowsub">{d.sub}</span>
              </span>
              <span className="tf-rowbadge" aria-hidden="true">›</span>
            </Link>
          ))}
        </nav>
      </EntranceGroup>
    </div>
  )
}

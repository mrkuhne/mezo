import { Link, useNavigate } from 'react-router-dom'
import type { MemoryOverview } from '@/data/types'
import { MemoryLayerCard } from '@/features/insights/components/MemoryLayerCard'
import { humanizeCron } from '@/features/insights/logic/humanizeCron'

const KIND_HU: Record<string, string> = { statistical: 'statisztikai', ai_hypothesis: 'AI-hipotézis' }
const STATUS_HU: Record<string, string> = {
  proposed: 'javasolt', monitoring: 'figyelt', confirmed: 'megerősített', rejected: 'elvetett',
}
const SOURCE_HU: Record<string, string> = { chat: 'chat', pattern: 'minta', manual: 'kézi' }

/** Hungarian labels for `memory_embedding.kind` (mezo-b3pp.22). The backend sends whatever kinds
 *  are populated, and the CHECK list grows — an unknown kind falls back to its raw key rather than
 *  vanishing, so a new writer is visible here the day it ships, before this map learns about it. */
const EMBEDDING_KIND_LABEL: Record<string, string> = {
  daily_summary: 'nap',
  chat_turn: 'chat',
  weekly_summary: 'heti',
  monthly_summary: 'havi',
  journal_entry: 'napló',
  reflection: 'esti',
  gratitude: 'hála',
  decision: 'döntés',
  activity_note: 'tevékenység',
  checkin_note: 'check-in',
}

/** Lüktető szaggatott kötőelem a rétegek között (prototípus .flowc) — a cron EMBERI
 *  időként (humanizeCron; ami nem fordítható, őszintén nyersen marad). */
function FlowConnector({ label, cron }: { label: string; cron: string }) {
  return (
    <div className="mem-flowc">
      <i className="mem-dash" aria-hidden="true" />
      <small>{`${label} · ${humanizeCron(cron)}`}</small>
    </div>
  )
}

export function MemoryLayersPanel({
  overview, onOpenJournal,
}: { overview: MemoryOverview; onOpenJournal: () => void }) {
  const navigate = useNavigate()
  const { l0, l1, l2, l3, jobs } = overview
  const patternTotal = l2.patterns.reduce((n, p) => n + p.count, 0)
  const factTotal = l3.facts.reduce((n, f) => n + f.count, 0)

  return (
    <div className="col" style={{ gap: 0 }}>
      <MemoryLayerCard
        tone="sand" icon="i-eletjel" delayMs={0}
        eyebrow="L0 · Nyers adat"
        big={`${l0.daysWithAnyData}`} unit={`/${l0.windowDays} nap`}
        chips={['mért napok a minta-ablakban']}
      />
      <FlowConnector label="napi összefoglaló" cron={jobs.summaryCron} />
      <MemoryLayerCard
        tone="gold" icon="i-naplo" delayMs={60}
        eyebrow="L1 · Epizodikus napló"
        big={`${l1.summaryCount}`} unit=" nap"
        chips={[
          ...l1.embeddings.map((e) => `${e.count} ${EMBEDDING_KIND_LABEL[e.kind] ?? e.kind}-vektor`),
          l1.firstDate && l1.lastDate ? `${l1.firstDate} – ${l1.lastDate}` : 'még üres',
        ]}
        onOpen={onOpenJournal}
      />
      <FlowConnector label="minta-felismerés" cron={jobs.patternCron} />
      <MemoryLayerCard
        tone="coral" icon="i-minta" delayMs={120}
        eyebrow="L2 · Ítélet-inbox"
        big={`${patternTotal}`} unit=" minta"
        chips={[
          ...l2.patterns.map((p) => `${p.count} ${KIND_HU[p.kind] ?? p.kind} · ${STATUS_HU[p.status] ?? p.status}`),
          `${l2.pendingFactCandidates} függő tényjelölt`,
          ...(jobs.lastDetectedAt ? [`utoljára: ${jobs.lastDetectedAt.slice(0, 10)}`] : []),
        ]}
        onOpen={() => navigate('/mezo')}
      />
      <FlowConnector label="hipotézis + tudás-promóció" cron={jobs.hypothesisCron} />
      <MemoryLayerCard
        tone="lav" icon="i-tudas" delayMs={180}
        eyebrow="L3 · Tartós tudás"
        big={`${factTotal}`} unit=" tény"
        chips={[
          ...l3.facts.map((f) => `${f.count} ${SOURCE_HU[f.source] ?? f.source}`),
          `${l3.totalReinforcements}× megerősítés`,
          `${l3.factsInPrompt} a promptban`,
        ]}
        onOpen={() => navigate('/mezo/knowledge')}
      />
      <Link to="/mezo/motor" style={{ fontSize: 12, color: 'var(--lav-deep)', marginTop: 12 }}>
        Miért nem lát még mintát a motor? →
      </Link>
    </div>
  )
}

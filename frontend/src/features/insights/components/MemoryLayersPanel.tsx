import { Link, useNavigate } from 'react-router-dom'
import type { MemoryOverview } from '@/data/types'
import { MemoryLayerCard } from '@/features/insights/components/MemoryLayerCard'

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

/** A réteg-érés színskála (UI-spec §1) — kizárólag meglévő tokenekből. */
const L0_ACCENT = 'var(--text-tertiary)'
const L0_WASH = 'var(--surface-glass)'
const L1_ACCENT = 'var(--lav-deep)'
const L1_WASH = 'var(--wash-lav)'
const L2_ACCENT = 'var(--warning)'
const L2_WASH = 'color-mix(in srgb, var(--warning) 10%, transparent)'
const L3_ACCENT = 'var(--success)'
const L3_WASH = 'color-mix(in srgb, var(--success) 10%, transparent)'

/** Pulzáló szaggatott vonal a rétegek között — a KÖVETKEZŐ réteg színében (oda folyik az adat), a cron mutatja, MIKOR. */
function FlowConnector({ label, color }: { label: string; color: string }) {
  return (
    <div className="row" style={{ alignItems: 'center', gap: 10, paddingLeft: 22 }}>
      <svg width="2" height="28" viewBox="0 0 2 28" aria-hidden="true">
        <line
          x1="1" y1="0" x2="1" y2="28"
          stroke={color} strokeWidth="2" strokeDasharray="4,4"
          className="memory-flow-line"
        />
      </svg>
      <span className="eyebrow text-tertiary" style={{ fontFamily: 'var(--ff-mono)' }}>{label}</span>
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
    <div className="col" style={{ gap: 4 }}>
      <MemoryLayerCard
        eyebrow="L0 · Nyers adat"
        title="Mért napok a minta-ablakban"
        big={`${l0.daysWithAnyData}/${l0.windowDays} nap`}
        stats={[`${l0.windowDays} napos ablak`]}
        accent={L0_ACCENT}
        wash={L0_WASH}
      />
      <FlowConnector label={`napi összefoglaló · ${jobs.summaryCron}`} color={L1_ACCENT} />
      <MemoryLayerCard
        eyebrow="L1 · Epizodikus napló"
        title="Éjszakai összefoglalók + vektorok"
        big={`${l1.summaryCount} nap`}
        stats={[
          ...l1.embeddings.map((e) => `${e.count} ${EMBEDDING_KIND_LABEL[e.kind] ?? e.kind}-vektor`),
          l1.firstDate && l1.lastDate ? `${l1.firstDate} – ${l1.lastDate}` : 'még üres',
        ]}
        accent={L1_ACCENT}
        wash={L1_WASH}
        last={l1.lastDate}
        onOpen={onOpenJournal}
      />
      <FlowConnector label={`minta-felismerés · ${jobs.patternCron}`} color={L2_ACCENT} />
      <MemoryLayerCard
        eyebrow="L2 · Ítélet-inbox"
        title="Felismert minták + tényjelöltek"
        big={`${patternTotal} minta`}
        stats={[
          ...l2.patterns.map((p) => `${p.count} ${KIND_HU[p.kind] ?? p.kind} · ${STATUS_HU[p.status] ?? p.status}`),
          `${l2.pendingFactCandidates} függő tényjelölt`,
        ]}
        accent={L2_ACCENT}
        wash={L2_WASH}
        last={jobs.lastDetectedAt ? jobs.lastDetectedAt.slice(0, 10) : null}
        onOpen={() => navigate('/mezo')}
      />
      <FlowConnector label={`hipotézis + tudás-promóció · ${jobs.hypothesisCron}`} color={L3_ACCENT} />
      <MemoryLayerCard
        eyebrow="L3 · Tartós tudás"
        title="Megerősített tények"
        big={`${factTotal} tény`}
        stats={[
          ...l3.facts.map((f) => `${f.count} ${SOURCE_HU[f.source] ?? f.source}`),
          `${l3.totalReinforcements}× megerősítés`,
          `${l3.factsInPrompt} a promptban`,
        ]}
        accent={L3_ACCENT}
        wash={L3_WASH}
        onOpen={() => navigate('/mezo/knowledge')}
      />
      <Link to="/mezo/motor" style={{ fontSize: 12, color: 'var(--lav-deep)', marginTop: 12 }}>
        Miért nem lát még mintát a motor? →
      </Link>
    </div>
  )
}

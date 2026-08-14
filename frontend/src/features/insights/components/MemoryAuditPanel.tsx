import { useKnowledge, useLlmUsage } from '@/data/hooks'
import { factCategoryColor } from '@/data/insights/knowledge'
import type { FactSource, KnowledgeFact } from '@/data/types'
import { GhostState } from '@/shared/ui/GhostState'
import { TokenColumns } from '@/features/insights/components/TokenColumns'

/** A csoport-sorrend a bizalmi lánc: beszélgetésből → mintából → kézzel (UI-spec §5). */
const GROUPS: Array<{ source: FactSource; label: string; color: string }> = [
  { source: 'chat', label: 'Chatből tanulta', color: 'var(--lav-deep)' },
  { source: 'pattern', label: 'Mintából promótálva', color: 'var(--success)' },
  { source: 'manual', label: 'Kézzel rögzítve', color: 'var(--text-secondary)' },
]

const fmtCost = (cost: number | null) => (cost == null ? '—' : `$${cost.toFixed(3)}`)
const fmtTokens = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n))

function FactProvenanceRow({ fact }: { fact: KnowledgeFact }) {
  return (
    <div className="card" style={{ padding: '12px 12px 12px 16px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: factCategoryColor(fact.category) }} />
      <p style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--text-primary)', fontWeight: 500 }}>{fact.text}</p>
      <div className="row gap-sm" style={{ flexWrap: 'wrap', alignItems: 'center', marginTop: 7 }}>
        <span className="chip" style={{ fontSize: 9 }}>×{fact.reinforced} megerősítve</span>
        <span className="eyebrow text-tertiary">
          {fact.lastReinforcedAt
            ? `utoljára: ${fact.lastReinforcedAt.slice(0, 10)}`
            : 'még nem erősítette meg újra'}
        </span>
      </div>
      {fact.patternTitle && (
        <span className="chip" style={{ fontSize: 9, marginTop: 7, color: 'var(--success)', display: 'inline-block' }}>
          ⧉ minta: {fact.patternTitle}
        </span>
      )}
    </div>
  )
}

/** Audit (UI-spec §5) — 1. mibe kerül (költség-hero), 2. honnan tud a társ (forrás-csoportos provenancia). */
export function MemoryAuditPanel() {
  const { facts, degraded: factsDegraded } = useKnowledge()
  const { usage, degraded: usageDegraded, isPending } = useLlmUsage()

  return (
    <div className="col gap-md">
      {usageDegraded || (!usage && !isPending) ? (
        <p className="text-tertiary" style={{ fontSize: 12, textAlign: 'center' }}>
          Az LLM-napló most nem elérhető.
        </p>
      ) : !usage ? (
        <GhostState message="Az LLM-napló betöltése…" lines={2} />
      ) : !usage.enabled ? (
        <div className="card" style={{ padding: 16, textAlign: 'center' }}>
          <p className="text-tertiary" style={{ fontSize: 12 }}>
            Az LLM-hívás audit-napló ki van kapcsolva — nincs mit auditálni.
          </p>
        </div>
      ) : (
        <div className="card col gap-sm" style={{ padding: 14, background: 'var(--wash-lav)' }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span className="eyebrow" style={{ color: 'var(--lav-deep)' }}>LLM-használat · 30 nap</span>
            <span style={{ fontFamily: 'var(--ff-display)', fontSize: 24, fontWeight: 600, color: 'var(--lav-deep)' }}>
              {fmtCost(usage.totals.costUsd)}
            </span>
          </div>
          <TokenColumns days={usage.perDay} ariaLabel="Napi LLM token-oszlopok" />
          <span className="eyebrow text-tertiary">
            {usage.totals.calls} hívás · bemenet {fmtTokens(usage.totals.inputTokens)} · kimenet{' '}
            {fmtTokens(usage.totals.outputTokens)}
          </span>
        </div>
      )}

      {factsDegraded ? (
        <p className="text-tertiary" style={{ fontSize: 12, textAlign: 'center' }}>
          A tudástár most nem elérhető.
        </p>
      ) : facts.length === 0 ? (
        <GhostState message="Még nincs megerősített tény — a Tudástár inboxában születnek." lines={2} />
      ) : (
        GROUPS.map(({ source, label, color }) => {
          const group = facts.filter((fact) => fact.source === source)
          if (group.length === 0) return null
          return (
            <div key={source} className="col gap-sm">
              <div className="row" style={{ alignItems: 'center', gap: 8 }}>
                <span className="eyebrow" style={{ color }}>{label}</span>
                <span className="chip" style={{ fontSize: 9, color }}>{group.length} tény</span>
                <span style={{ flex: 1, height: 1, background: 'var(--line)' }} />
              </div>
              {group.map((fact) => (
                <FactProvenanceRow key={fact.id} fact={fact} />
              ))}
            </div>
          )
        })
      )}
    </div>
  )
}

import { useKnowledge, useLlmUsage } from '@/data/hooks'
import { factCategoryColor } from '@/data/insights/knowledge'
import type { FactSource, KnowledgeFact } from '@/data/types'
import { GhostState } from '@/shared/ui/GhostState'
import { MCells, type MCellTone } from '@/shared/ui/mozaik'
import { TokenColumns } from '@/features/insights/components/TokenColumns'

/** A csoport-sorrend a bizalmi lánc: beszélgetésből → mintából → kézzel (UI-spec §5).
 *  A mini-cella tónusok a prototípus audit-cellái: chat lila · minta arany · kézi zsálya. */
const GROUPS: Array<{ source: FactSource; label: string; cell: string; tone: MCellTone; color: string }> = [
  { source: 'chat', label: 'Chatből tanulta', cell: 'chatből', tone: 'lav', color: 'var(--lav-deep)' },
  { source: 'pattern', label: 'Mintából promótálva', cell: 'mintából', tone: 'gold', color: 'var(--success)' },
  { source: 'manual', label: 'Kézzel rögzítve', cell: 'kézzel', tone: 'sage', color: 'var(--text-secondary)' },
]

const fmtCost = (cost: number | null) =>
  cost == null ? '—' : cost > 0 && cost < 0.001 ? '<$0.001' : `$${cost.toFixed(3)}`
const fmtTokens = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n))

function FactProvenanceRow({ fact, delayMs }: { fact: KnowledgeFact; delayMs: number }) {
  return (
    <div className="mem-daycard mem-fact rise" style={{ '--d': `${delayMs}ms` } as React.CSSProperties}>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: factCategoryColor(fact.category) }} />
      <p className="mem-bd" style={{ marginTop: 0, fontWeight: 500 }}>{fact.text}</p>
      <div className="mem-scmath">
        <span>×{fact.reinforced} megerősítve</span>
        <span className="is-mut">
          {fact.lastReinforcedAt
            ? `utoljára: ${fact.lastReinforcedAt.slice(0, 10)}`
            : 'még nem erősítette meg újra'}
        </span>
        {fact.patternTitle && <span className="is-final">⧉ minta: {fact.patternTitle}</span>}
      </div>
    </div>
  )
}

/** Audit (mezo-d20.5.7) — 1. mibe kerül (költség-hero + tokenoszlopok), 2. honnan tud a
 *  társ (tintázott tény-eredet mini-cellák + forrás-csoportos provenancia). */
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
        <div className="mem-card" style={{ textAlign: 'center' }}>
          <p className="text-tertiary" style={{ fontSize: 12 }}>
            Az LLM-hívás audit-napló ki van kapcsolva — nincs mit auditálni.
          </p>
        </div>
      ) : (
        <div className="mem-card rise col gap-sm" style={{ '--d': '0ms' } as React.CSSProperties}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span className="mz-eyebrow">LLM-használat · 30 nap</span>
            <span className="mem-cost">{fmtCost(usage.totals.costUsd)}</span>
          </div>
          <TokenColumns days={usage.perDay} ariaLabel="Napi LLM token-oszlopok" />
          <span className="mem-foot">
            {usage.totals.calls} hívás · bemenet {fmtTokens(usage.totals.inputTokens)} · kimenet{' '}
            {fmtTokens(usage.totals.outputTokens)} token
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
        <>
          <div className="mem-card rise" style={{ '--d': '60ms' } as React.CSSProperties}>
            <span className="mz-eyebrow">Honnan tudom, amit tudok</span>
            <MCells
              className="mem-provcells"
              cells={GROUPS.map(({ source, cell, tone }) => ({
                label: cell, tone, value: facts.filter((f) => f.source === source).length,
              })).filter((c) => c.value > 0)}
            />
          </div>
          {GROUPS.map(({ source, label, color }) => {
            const group = facts.filter((fact) => fact.source === source)
            if (group.length === 0) return null
            return (
              <div key={source} className="col gap-sm">
                <div className="row" style={{ alignItems: 'center', gap: 8 }}>
                  <span className="mz-eyebrow" style={{ color }}>{label}</span>
                  <span style={{ flex: 1, height: 1, background: 'var(--line)' }} />
                </div>
                {group.map((fact, i) => (
                  <FactProvenanceRow key={fact.id} fact={fact} delayMs={120 + Math.min(i, 4) * 60} />
                ))}
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}

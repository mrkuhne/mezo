import { Link } from 'react-router-dom'
import { useLlmUsage } from '@/data/hooks'
import { GhostState } from '@/shared/ui/GhostState'
import { TokenColumns } from '@/features/insights/components/TokenColumns'

const fmtCost = (cost: number | null) =>
  cost == null ? '—' : cost > 0 && cost < 0.001 ? '<$0.001' : `$${cost.toFixed(3)}`
const fmtTokens = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n))

export function MemoryAuditPanel() {
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

      <Link className="mem-card" to="/mezo/knowledge?view=tenyek">
        Tudástár · tények és eredetük →
      </Link>
    </div>
  )
}

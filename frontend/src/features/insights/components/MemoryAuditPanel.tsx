import { Link } from 'react-router-dom'
import { useLlmUsage } from '@/data/hooks'
import { GhostState } from '@/shared/ui/GhostState'
import { Icon3D } from '@/shared/ui/clay'
import { TokenColumns } from '@/features/insights/components/TokenColumns'

const fmtCost = (cost: number | null) =>
  cost == null ? '—' : cost > 0 && cost < 0.001 ? '<$0.001' : `$${cost.toFixed(3)}`
const fmtTokens = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n))

/** Audit (üveg, mezo-me75u.8): EGY égkék üvegkártya — költség nagy világos számmal, a napi
 *  token-oszlopok, lábléc; a ki/elérhetetlen állapot szaggatott, a Tudástár lapos ajtó-sor. */
export function MemoryAuditPanel() {
  const { usage, degraded: usageDegraded, isPending } = useLlmUsage()

  return (
    <div className="mmr-audit-wrap">
      {usageDegraded || (!usage && !isPending) ? (
        <div className="mmr-note uv-empty" style={{ '--c': 'var(--dv-sky)' } as React.CSSProperties}>
          <p>Az LLM-napló most nem elérhető.</p>
        </div>
      ) : !usage ? (
        <div className="mmr-ghost">
          <GhostState message="Az LLM-napló betöltése…" lines={2} />
        </div>
      ) : !usage.enabled ? (
        <div className="mmr-note uv-empty" style={{ '--c': 'var(--dv-sky)' } as React.CSSProperties}>
          <p>Az LLM-hívás audit-napló ki van kapcsolva — nincs mit auditálni.</p>
        </div>
      ) : (
        <div className="mmr-audit glass rise" style={{ '--c': 'var(--dv-sky)', '--d': '0ms' } as React.CSSProperties}>
          <span className="uv-eyebrow mmr-eb">LLM-használat · 30 nap</span>
          <div className="mmr-cost"><b>{fmtCost(usage.totals.costUsd)}</b></div>
          <TokenColumns days={usage.perDay} ariaLabel="Napi LLM token-oszlopok" />
          <div className="mmr-foot">
            <span><b>{usage.totals.calls}</b> hívás</span>
            <span>bemenet <b>{fmtTokens(usage.totals.inputTokens)}</b></span>
            <span>kimenet <b>{fmtTokens(usage.totals.outputTokens)}</b> token</span>
          </div>
        </div>
      )}

      <Link className="mmr-door uv-flat" to="/mezo/knowledge?view=tenyek" style={{ '--c': 'var(--dv-lav)' } as React.CSSProperties}>
        <span className="uv-well mmr-well"><Icon3D name="t-brain" size={28} /></span>
        <span className="mmr-doorgrow">
          <strong>Tudástár</strong>
          <small>tények és eredetük</small>
        </span>
        <span className="mmr-chev" aria-hidden="true">›</span>
      </Link>
    </div>
  )
}

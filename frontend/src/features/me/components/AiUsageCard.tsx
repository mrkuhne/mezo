import { Link } from 'react-router-dom'
import { useLlmUsageSummary } from '@/data/hooks'
import { Skeleton } from '@/shared/ui/Skeleton'
import type { LlmUsageSummaryResponse } from '@/data/me/llmUsageApi'

// AI-használat card on the Profile (mezo-h3gb) — the LLM audit log's day/week/month
// rollups as three tiles (call count + estimated cost), reusing the Napiv `.biocard`
// idiom of its sibling BiometricCard (a `.bhd` header over a `.bio` stat grid, here
// three columns wide). Read-only: `useLlmUsageSummary()` is dual-mode, so mock mode
// seeds synchronously (no loading frame) and real mode ghosts through `Skeleton`s
// while the query is unresolved — never the seed.

const PERIODS = [
  { key: 'day', label: 'Ma' },
  { key: 'week', label: 'Ez a hét' },
  { key: 'month', label: 'Ez a hónap' },
] as const satisfies readonly { key: keyof LlmUsageSummaryResponse; label: string }[]

/**
 * `$X.XX`, or an em dash when the period has no priced call — a null cost means
 * "unknown", not zero (unpriced / no-usage / errored rows are excluded server-side).
 */
export function formatUsageCost(costUsd: number | null | undefined): string {
  return costUsd == null ? '—' : `$${costUsd.toFixed(2)}`
}

export function AiUsageCard() {
  const { data, isPending } = useLlmUsageSummary()

  if (isPending) {
    return (
      <div className="card biocard" style={{ padding: '14px 15px 13px' }} role="status" aria-label="AI-használat betöltése…">
        <div className="bhd">
          <h3>AI-használat</h3>
        </div>
        <div className="biogrid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          {PERIODS.map((p) => (
            <div className="bio" key={p.key}>
              <div className="k">{p.label}</div>
              <Skeleton width="80%" height={15} style={{ marginTop: 4 }} />
              <Skeleton width="55%" style={{ marginTop: 5 }} />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <Link to="/me/ai-usage" className="card biocard" style={{ display: 'block', padding: '14px 15px 13px', color: 'inherit' }}>
      <div className="bhd">
        <h3>AI-használat</h3>
        <span className="text-tertiary" style={{ marginLeft: 'auto', fontSize: 15 }}>›</span>
      </div>

      <div className="biogrid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        {PERIODS.map((p) => {
          const period = data[p.key]
          return (
            <div className="bio" key={p.key}>
              <div className="k">{p.label}</div>
              <div className="v">
                {period.callCount} <small>hívás</small>
              </div>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--sage-deep)', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
                {formatUsageCost(period.costUsd)}
              </div>
            </div>
          )
        })}
      </div>

      <div className="text-tertiary" style={{ fontSize: 11, marginTop: 11 }}>
        ~ becslés — a modellárak tájékoztató jellegűek
      </div>
    </Link>
  )
}

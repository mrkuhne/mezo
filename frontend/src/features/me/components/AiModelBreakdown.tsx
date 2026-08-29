import { formatRollupCost } from '@/features/me/logic/llmCallFormat'
import type { LlmUsageGroup } from '@/data/me/llmUsageApi'

// Served-model rollup (mezo-uakh) — a horizontal strip, because there are three models at most.
// A null key is a call that never reached a model (an ERROR row), shown as "ismeretlen" rather
// than dropped: those calls happened and their absence from the cost is the point.
//
// Token note: `--surface-2` and `--sage-deep` both exist on this surface (see AiFeatureBreakdown's
// note); no substitution needed here.

export function AiModelBreakdown({ groups }: { groups: LlmUsageGroup[] }) {
  if (groups.length === 0) return null
  return (
    <div className="aiu-fcard rise" style={{ paddingBottom: 13 }}>
      <div className="eyebrow" style={{ padding: '0 15px 9px' }}>Modell szerint</div>
      <div className="row" style={{ gap: 7, padding: '0 15px', overflowX: 'auto' }}>
        {groups.map((g) => (
          <div key={g.key ?? 'unknown'} style={{ flexShrink: 0, background: 'var(--surface-2)', borderRadius: 12, padding: '7px 11px', minWidth: 96 }}>
            <div style={{ fontSize: 10, fontWeight: 700 }}>{g.key ?? 'ismeretlen'}</div>
            <div style={{ fontSize: 14, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{g.callCount}</div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--sage-deep)' }}>{formatRollupCost(g.costUsd)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

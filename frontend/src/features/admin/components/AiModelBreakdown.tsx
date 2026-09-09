import { formatRollupCost, formatTokens } from '@/features/me/logic/llmCallFormat'
import type { LlmUsageModelGroup } from '@/data/me/llmUsageApi'

// Served-model rollup (mezo-uakh; restyled mezo-pfdv Task 2 into a table with tokens + a cost
// share bar — the Költés section's "deepest technical layer", monospace model names acceptable).
// A null key is a call that never reached a model (an ERROR row), shown as "ismeretlen" rather
// than dropped: those calls happened and their absence from the cost is the point.
//
// The share bar reads each row's cost against the row with the highest cost (not against the
// grand total) — same "leader's bar is full, everyone else reads as a share of the leader"
// convention as `topNFromEntries` (adminViz.ts), so a page with one dominant model doesn't leave
// every other bar looking like a rounding error against a total none of them individually earned.
export function AiModelBreakdown({ groups }: { groups: LlmUsageModelGroup[] }) {
  if (groups.length === 0) return null
  const maxCost = Math.max(...groups.map((g) => g.costUsd ?? 0), 0)
  return (
    <div className="aiu-fcard rise" style={{ paddingBottom: 8 }}>
      <div className="eyebrow" style={{ padding: '0 15px 9px' }}>Modell szerint</div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr className="text-tertiary" style={{ fontSize: 10, textAlign: 'left' }}>
            <th style={{ padding: '0 15px 6px', fontWeight: 700 }}>Modell</th>
            <th style={{ padding: '0 8px 6px', fontWeight: 700, textAlign: 'right' }}>Hívások</th>
            <th style={{ padding: '0 8px 6px', fontWeight: 700, textAlign: 'right' }}>Tokenek</th>
            <th style={{ padding: '0 8px 6px', fontWeight: 700, textAlign: 'right' }}>Költség</th>
            <th style={{ padding: '0 15px 6px', fontWeight: 700 }}></th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => {
            const key = g.key ?? 'unknown'
            const label = g.key ?? 'ismeretlen'
            const share = maxCost > 0 ? (g.costUsd ?? 0) / maxCost : 0
            return (
              <tr key={key}>
                <td style={{ padding: '5px 15px', fontFamily: g.key ? 'ui-monospace, SFMono-Regular, monospace' : undefined, fontWeight: 700 }}>
                  {label}
                </td>
                <td className="text-tertiary" style={{ padding: '5px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {g.callCount}
                </td>
                <td
                  className="text-tertiary"
                  style={{ padding: '5px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
                  title={`prompt: ${formatTokens(g.promptTokens)} tok`}
                >
                  {formatTokens(g.totalTokens)}
                </td>
                <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 800, color: 'var(--sage-deep)', fontVariantNumeric: 'tabular-nums' }}>
                  {formatRollupCost(g.costUsd)}
                </td>
                <td style={{ padding: '5px 15px', width: 80 }}>
                  <div className="gbar"><div style={{ width: `${share * 100}%` }} /></div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

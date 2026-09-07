import { useState } from 'react'
import { formatRollupCost } from '@/features/me/logic/llmCallFormat'
import type { LlmUsageGroup } from '@/data/me/llmUsageApi'

// Feature rollup as a bar list (mezo-uakh). The bar is proportional to COST, not call count —
// the question this answers is "what burns the money", and a cheap high-volume feature
// (embed_memory) must not out-draw an expensive rare one (companion_hypothesis).
//
// Token note: the brief's `--brand` does not exist on this surface (grepped
// frontend/src/styles/prototype.css). Substituted --coral — the Me surface's actual brand/accent
// token (`.text-brand { color: var(--coral) }`, `.eyebrow.brand { color: var(--coral-deep) }`).
// `--sage-deep` does exist (used by the sibling AiUsageCard for the same purpose) and is kept as-is.

const COLLAPSED = 8

export function AiFeatureBreakdown({ groups, selected, onSelect }: {
  groups: LlmUsageGroup[]
  selected: string | null
  onSelect: (feature: string | null) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const shown = expanded ? groups : groups.slice(0, COLLAPSED)
  // Widths are relative to the biggest bucket; an unpriced (null) bucket has no width to give.
  // If every bucket is unpriced, max stays 0 and the width expression below short-circuits to
  // '0%' instead of dividing by zero.
  const max = Math.max(...groups.map((g) => g.costUsd ?? 0), 0)

  return (
    <div className="aiu-fcard rise">
      <div className="eyebrow" style={{ padding: '0 15px 7px' }}>Feature szerint</div>

      {shown.map((g, i) => {
        // `key` is the stable identity used for React's key prop, the onSelect payload and the
        // selected-comparison — 'unknown' internally, unreachable in practice (feature is NOT NULL
        // at the contract level). `label` is what renders, and must be Hungarian like
        // AiModelBreakdown's 'ismeretlen' — the two are allowed to diverge on purpose.
        const key = g.key ?? 'unknown'
        const label = g.key ?? 'ismeretlen'
        const isSelected = selected === key
        return (
          <button
            key={key}
            type="button"
            onClick={() => onSelect(isSelected ? null : key)}
            aria-pressed={isSelected}
            className="aiu-bar"
            style={{
              width: '100%', textAlign: 'left', border: 0, cursor: 'pointer', minHeight: 44,
              background: isSelected ? 'var(--surface-2)' : 'transparent', flexDirection: 'column', alignItems: 'stretch',
            }}
          >
            <div className="row" style={{ alignItems: 'baseline', gap: 8 }}>
              <span className="nm" style={{ flex: 1, width: 'auto' }}>{label}</span>
              <span className="text-tertiary" style={{ fontSize: 10.5, fontVariantNumeric: 'tabular-nums' }}>
                {g.callCount}
              </span>
              <span className="vl" style={{ width: 'auto', color: 'var(--sage-deep)', fontSize: 12, fontWeight: 800 }}>
                {formatRollupCost(g.costUsd)}
              </span>
            </div>
            <div className="gbar" style={{ marginTop: 5 }}>
              <div style={{ width: max > 0 ? `${((g.costUsd ?? 0) / max) * 100}%` : '0%', '--d': `${350 + i * 60}ms` } as React.CSSProperties} />
            </div>
          </button>
        )
      })}

      {groups.length > COLLAPSED && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          style={{ border: 0, background: 'transparent', cursor: 'pointer', padding: '8px 13px', fontSize: 11, fontWeight: 700, color: 'var(--coral)' }}
        >
          {expanded ? 'Kevesebb' : `Mind (${groups.length})`}
        </button>
      )}
    </div>
  )
}

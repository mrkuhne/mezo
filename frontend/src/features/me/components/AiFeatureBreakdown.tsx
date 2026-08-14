import { useState } from 'react'
import { formatCost } from '@/features/me/logic/llmCallFormat'
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
    <div className="card" style={{ padding: '11px 0 4px' }}>
      <div className="eyebrow" style={{ padding: '0 13px 6px' }}>Feature szerint</div>

      {shown.map((g) => {
        const key = g.key ?? 'unknown'
        const isSelected = selected === key
        return (
          <button
            key={key}
            type="button"
            onClick={() => onSelect(isSelected ? null : key)}
            aria-pressed={isSelected}
            style={{
              display: 'block', width: '100%', textAlign: 'left', border: 0, cursor: 'pointer',
              padding: '8px 13px', background: isSelected ? 'var(--surface-2)' : 'transparent',
            }}
          >
            <div className="row" style={{ alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, flex: 1 }}>{key}</span>
              <span className="text-tertiary" style={{ fontSize: 10.5, fontVariantNumeric: 'tabular-nums' }}>
                {g.callCount}
              </span>
              <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--sage-deep)', fontVariantNumeric: 'tabular-nums' }}>
                {formatCost(g.costUsd)}
              </span>
            </div>
            <div style={{ height: 5, borderRadius: 3, background: 'var(--surface-2)', marginTop: 5 }}>
              <div style={{
                height: '100%', borderRadius: 3, background: 'var(--coral)',
                width: max > 0 ? `${((g.costUsd ?? 0) / max) * 100}%` : '0%',
              }} />
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

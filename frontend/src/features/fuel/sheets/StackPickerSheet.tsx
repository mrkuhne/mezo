// ============================================================
// Mezo · StackPickerSheet (rewired mezo-vx9v Task 8 — add-occurrence, not select/toggle)
// Adds a pantry-stash item to the active protocol as a new occurrence. A search box filters the
// shelf by name + brand; each row is a plain card whose accent colour is derived from
// caffeine/type. Tapping a row calls onAdd(pantryItemId) — the caller places it (rule/llm
// placement when no zone is pinned yet) and the sheet STAYS OPEN so several items can be added in
// one visit; an already-occupied item (any zone) shows a small 'a stackben' chip but stays
// tappable (adding it again in a NEW zone is valid — a duplicate (item, zone) pair surfaces via
// the mutation's 409 toast, same as every other write here).
// Port: prototype/src/fuel-stack.jsx StackPickerSheet (520–600).
//
// Adaptations vs prototype:
//  - Uses the shared <Sheet> (portal + drag-to-close + Escape) instead of
//    the bespoke .sheet-backdrop/.sheet markup; close() comes from its
//    render-prop so the X button dismisses with the same slide-down.
//  - Stash comes from useStack().stash, not window.MezoData.supplementsStash.
//  - Hex-alpha `color + "10"` (0x10 ≈ 6%) → color-mix(in srgb, <color> 6%,
//    transparent) per the project HEX-ALPHA rule.
// ============================================================
import { useState } from 'react'
import type { SupplementStashItem } from '@/data/types'
import { useStack } from '@/data/hooks'
import { Sheet } from '@/shared/ui/Sheet'
import { Icon } from '@/shared/ui/Icon'
import { Eyebrow } from '@/shared/ui/Eyebrow'
import { Display } from '@/shared/ui/Display'

// Accent colour per stash item: caffeine wins, then type, then the coral accent.
function rowColor(s: SupplementStashItem): string {
  if (s.caffeine) return 'var(--warning)'
  if (s.type === 'stimulant') return 'var(--cat-tendency)'
  if (s.type === 'medication') return 'var(--error)'
  return 'var(--coral)'
}

export function StackPickerSheet({
  occupiedIds,
  onAdd,
  onClose,
}: {
  occupiedIds: Set<string>
  onAdd: (pantryItemId: string) => void
  onClose: () => void
}) {
  const { stash } = useStack()
  const [query, setQuery] = useState('')

  const filtered = stash.filter(
    s => !query || (s.name + ' ' + s.brand).toLowerCase().includes(query.toLowerCase()),
  )

  return (
    <Sheet onClose={onClose} labelledBy="stack-pick-title">
      {(close) => (
        <>
          {/* Header */}
          <div
            className="row"
            style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}
          >
            <div className="col">
              <Eyebrow brand>Kamra · stack-pick</Eyebrow>
              <div id="stack-pick-title" style={{ marginTop: 4 }}>
                <Display size="md">Mit szedjünk</Display>
              </div>
            </div>
            <button className="chip" aria-label="Bezárás" onClick={close} style={{ padding: '6px 8px' }}>
              <Icon name="x" size={12} />
            </button>
          </div>

          {/* Search */}
          <div
            className="row gap-sm"
            style={{
              padding: '8px 12px',
              marginBottom: 12,
              background: 'var(--surface-2)',
              border: '1px solid var(--border-subtle)',
              alignItems: 'center',
            }}
          >
            <Icon name="search" size={12} color="var(--text-tertiary)" />
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Keress a polcon…"
              style={{ flex: 1, fontSize: 13, color: 'var(--text-primary)' }}
            />
          </div>

          {/* Shelf list */}
          <div className="col gap-sm" style={{ maxHeight: 460, overflowY: 'auto' }}>
            {filtered.map(s => {
              const occupied = occupiedIds.has(s.id)
              const color = rowColor(s)
              return (
                <button
                  key={s.id}
                  onClick={() => onAdd(s.id)}
                  className="card row"
                  style={{
                    padding: '10px 12px',
                    width: '100%',
                    textAlign: 'left',
                    alignItems: 'center',
                    gap: 10,
                    borderColor: 'var(--border-subtle)',
                    background: 'var(--surface-1)',
                    borderLeft: '2px solid ' + color,
                  }}
                >
                  <div className="col flex-1" style={{ minWidth: 0 }}>
                    <div className="row gap-xs" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{s.name}</span>
                      {s.caffeine && (
                        <span className="label-mono" style={{ fontSize: 8, color: 'var(--warning)' }}>
                          koffein
                        </span>
                      )}
                      {occupied && (
                        <span className="chip" style={{ fontSize: 8, padding: '2px 6px' }}>
                          a stackben
                        </span>
                      )}
                    </div>
                    <span
                      className="text-tertiary"
                      style={{ fontSize: 10 }}
                    >
                      {s.brand} · {s.dose}
                    </span>
                  </div>
                  <Icon name="plus" size={12} color={color} />
                </button>
              )
            })}
          </div>

          <div style={{ height: 24 }} />
        </>
      )}
    </Sheet>
  )
}

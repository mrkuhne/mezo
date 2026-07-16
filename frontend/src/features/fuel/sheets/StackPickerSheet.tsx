// ============================================================
// Mezo · StackPickerSheet
// Add/remove pantry-stash supplements to the active stack. A search box
// filters the shelf by name + brand; each row is a checkbox-card whose
// accent colour is derived from caffeine/type, and tapping it toggles the
// item via onToggle(id). Close via the sheet's animated dismiss.
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

// Accent colour per stash item: caffeine wins, then type, then brand-glow.
function rowColor(s: SupplementStashItem): string {
  if (s.caffeine) return 'var(--warning)'
  if (s.type === 'stimulant') return 'var(--cat-tendency)'
  if (s.type === 'medication') return 'var(--error)'
  return 'var(--coral)'
}

export function StackPickerSheet({
  selectedIds,
  onToggle,
  onClose,
}: {
  selectedIds: string[]
  onToggle: (id: string) => void
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
              const selected = selectedIds.includes(s.id)
              const color = rowColor(s)
              return (
                <button
                  key={s.id}
                  onClick={() => onToggle(s.id)}
                  className="card row"
                  style={{
                    padding: '10px 12px',
                    width: '100%',
                    textAlign: 'left',
                    alignItems: 'center',
                    gap: 10,
                    borderColor: selected ? color : 'var(--border-subtle)',
                    background: selected
                      ? `color-mix(in srgb, ${color} 6%, transparent)`
                      : 'var(--surface-1)',
                    borderLeft: '2px solid ' + color,
                  }}
                >
                  <div
                    style={{
                      width: 18,
                      height: 18,
                      border: '1.5px solid ' + (selected ? color : 'var(--border-strong)'),
                      background: selected ? color : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {selected && <Icon name="check" size={11} color="var(--text-inverse)" />}
                  </div>
                  <div className="col flex-1" style={{ minWidth: 0 }}>
                    <div className="row gap-xs" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{s.name}</span>
                      {s.caffeine && (
                        <span className="label-mono" style={{ fontSize: 8, color: 'var(--warning)' }}>
                          koffein
                        </span>
                      )}
                    </div>
                    <span
                      className="text-tertiary"
                      style={{ fontSize: 10, fontFamily: 'var(--ff-mono)' }}
                    >
                      {s.brand} · {s.dose}
                    </span>
                  </div>
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

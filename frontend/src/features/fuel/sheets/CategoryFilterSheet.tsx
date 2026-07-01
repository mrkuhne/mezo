// ============================================================
// Mezo · CategoryFilterSheet
// The pantry category filter as a bottom-sheet (docs/design/kamra-detail-edit-v1.html
// · phone 4) — NOT 18 inline chips. Lists only the categories PRESENT in the current
// items, each with its count, as multi-select chamfer chips. Clear + Apply close the
// loop. The parent owns the committed selection; this sheet edits a local draft and
// commits it on Apply (or Clear-then-Apply). Wraps the shared <Sheet> shell.
// ============================================================
import { useState } from 'react'
import { pantryCategoryMeta } from '@/data/fuel/pantry'
import { Sheet } from '@/shared/ui/Sheet'
import { Eyebrow } from '@/shared/ui/Eyebrow'

export interface CategoryOption { key: string; label: string; color: string; count: number }

export function CategoryFilterSheet({
  options,
  selected,
  totalIfApplied,
  onApply,
  onClose,
}: {
  options: CategoryOption[]
  selected: string[]
  totalIfApplied: (draft: string[]) => number
  onApply: (next: string[]) => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState<string[]>(selected)

  const toggle = (key: string) =>
    setDraft(d => (d.includes(key) ? d.filter(k => k !== key) : [...d, key]))

  const count = totalIfApplied(draft)

  return (
    <Sheet onClose={onClose} labelledBy="category-filter-title">
      {(close) => (
        <>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div id="category-filter-title"><Eyebrow brand>Kategória szűrő</Eyebrow></div>
            <button
              onClick={() => setDraft([])}
              className="label-mono"
              style={{ fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: draft.length ? 'var(--brand-glow)' : 'var(--text-tertiary)' }}
              disabled={!draft.length}
            >
              {draft.length} kiválasztva · törlés
            </button>
          </div>

          <div className="row flex-wrap" style={{ gap: 7 }}>
            {options.map(opt => {
              const on = draft.includes(opt.key)
              return (
                <button
                  key={opt.key}
                  onClick={() => toggle(opt.key)}
                  aria-pressed={on}
                  className="notch-8 row"
                  style={{
                    alignItems: 'center', gap: 6, padding: '7px 11px',
                    fontFamily: 'var(--ff-mono)', fontSize: 10, letterSpacing: '0.04em', textTransform: 'uppercase',
                    color: on ? 'var(--brand-glow)' : 'var(--text-secondary)',
                    background: on ? 'rgba(20,184,166,0.12)' : 'var(--surface-2)',
                    border: '1px solid ' + (on ? 'rgba(94,234,212,0.3)' : 'var(--border-subtle)'),
                  }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: opt.color, flexShrink: 0 }} />
                  {opt.label}
                  <span style={{ fontSize: 9, color: on ? 'var(--brand-glow)' : 'var(--text-tertiary)' }}>{opt.count}</span>
                </button>
              )
            })}
            {options.length === 0 && (
              <span className="text-tertiary" style={{ fontSize: 12 }}>Nincs szűrhető kategória.</span>
            )}
          </div>

          <button
            className="cta-primary notch-4"
            style={{ marginTop: 16 }}
            onClick={() => { onApply(draft); close() }}
          >
            Szűrés ({count} tétel)
          </button>
          <div style={{ height: 24 }} />
        </>
      )}
    </Sheet>
  )
}

// Helper kept here so callers don't re-derive the meta lookup.
export function categoryOption(key: string, count: number): CategoryOption {
  const meta = pantryCategoryMeta[key]
  return { key, count, label: meta?.label ?? key, color: meta?.color ?? 'var(--text-secondary)' }
}

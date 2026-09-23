// ============================================================
// Mezo · CategoryFilterSheet
// The pantry category filter as a bottom-sheet (docs/design/kamra-detail-edit-v1.html
// · phone 4) — NOT 18 inline chips. Lists only the categories PRESENT in the current
// items, each with its count, as multi-select chamfer chips. Clear + Apply close the
// loop. The parent owns the committed selection; this sheet edits a local draft and
// commits it on Apply (or Clear-then-Apply). Wraps the shared <Sheet> shell.
// Üveg (mezo-me75u.2, uveg-fuel-tobbi.html `SH.catfilter`): one gold glass sheet; the category
// chips are flat cells with their category dot, a selected one filled in its own hue; the
// apply button the gold-lit flat CTA (never glass in glass).
// ============================================================
import { useState } from 'react'
import { pantryCategoryMeta } from '@/data/fuel/pantry'
import { Sheet } from '@/shared/ui/Sheet'
import { KamraSheetHead, KAMRA_SHEET_CLASS } from '@/features/fuel/sheets/KamraSheetHead'

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
    <Sheet onClose={onClose} labelledBy="category-filter-title" className={KAMRA_SHEET_CLASS}>
      {(close) => (
        <>
          <KamraSheetHead eyebrow="Kategória szűrő" title="Mit mutassak?" titleId="category-filter-title"
            action={(
              <button type="button" className="fkk-sh-clear" onClick={() => setDraft([])} disabled={!draft.length}>
                {draft.length} kiválasztva · törlés
              </button>
            )} />

          <div className="fkk-sh-chips is-wrap">
            {options.map(opt => {
              const on = draft.includes(opt.key)
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => toggle(opt.key)}
                  aria-pressed={on}
                  className={on ? 'is-on' : undefined}
                  style={{ '--c': opt.color } as React.CSSProperties}
                >
                  <i className="fkk-sh-dot" aria-hidden="true" />
                  {opt.label}
                  <b>{opt.count}</b>
                </button>
              )
            })}
            {options.length === 0 && (
              <span className="fkk-sh-none">Nincs szűrhető kategória.</span>
            )}
          </div>

          <button
            type="button"
            className="fkk-btn is-go fkk-sh-apply"
            onClick={() => { onApply(draft); close() }}
          >
            Szűrés ({count} tétel)
          </button>
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

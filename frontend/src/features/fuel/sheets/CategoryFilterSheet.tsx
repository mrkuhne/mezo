// ============================================================
// Mezo · CategoryFilterSheet
// The pantry category filter as a bottom-sheet — NOT 18 inline chips. Lists only the categories PRESENT in the
// current items, each with its count, as multi-select pills. The parent owns the committed selection; this sheet
// edits a local draft and commits it on Apply (or Clear-then-Apply). Wraps the shared <Sheet> shell.
// Folyadék (F5, mezo-n4wf5.5; prototype `fuel.js` `sheetsC.catfilter`): the light sheet + `FoSheetHead`, kit pills
// (a chosen one filled with the liquid), and the foot: „Szűrés · N tétel" with the „N kiválasztva · törlés" link.
// ============================================================
import { useState } from 'react'
import { pantryCategoryMeta } from '@/data/fuel/pantry'
import { useM } from '@/shared/i18n'
import { Sheet } from '@/shared/ui/Sheet'
import { Acts, Btn, Lk, Note, Pill, Pills } from '@/shared/ui/folyadek'
import { pantryCategoryLabel } from '@/features/fuel/logic/kamraItems'
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
  const M = useM()
  const F = M.fuelKamra.filter
  const [draft, setDraft] = useState<string[]>(selected)

  const toggle = (key: string) =>
    setDraft(d => (d.includes(key) ? d.filter(k => k !== key) : [...d, key]))

  const count = totalIfApplied(draft)

  return (
    <Sheet onClose={onClose} labelledBy="category-filter-title" className={KAMRA_SHEET_CLASS}>
      {(close) => (
        <>
          <KamraSheetHead icon="t-lens" eyebrow={F.sub} title={F.title} titleId="category-filter-title" />

          <Pills>
            {options.map(opt => (
              <Pill key={opt.key} on={draft.includes(opt.key)} onClick={() => toggle(opt.key)}>
                {/* the label is read at render, so an open sheet follows a language switch */}
                {pantryCategoryLabel(opt.key) ?? opt.label}<b>{opt.count}</b>
              </Pill>
            ))}
          </Pills>
          {options.length === 0 && <Note>{F.none}</Note>}

          <Acts>
            <Btn sm onClick={() => { onApply(draft); close() }}>{F.apply(count)}</Btn>
            <Lk onClick={() => setDraft([])} disabled={!draft.length}>
              {draft.length ? F.clear(draft.length) : F.selected(0)}
            </Lk>
          </Acts>
        </>
      )}
    </Sheet>
  )
}

// Helper kept here so callers don't re-derive the lookup. `label` is the category's name in the language of the CALL
// (build the options at render, never in a module constant or a memo without the language in its key).
export function categoryOption(key: string, count: number): CategoryOption {
  const meta = pantryCategoryMeta[key]
  return { key, count, label: pantryCategoryLabel(key) ?? meta?.label ?? key, color: meta?.color ?? 'var(--fo-sub)' }
}

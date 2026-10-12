// ============================================================
// Mezo · AddPantryItemSheet
// Manual add/edit form for a Kamra item. Real CRUD via usePantryActions:
//   - add mode (no editId): addItem(input) → appends to the ['pantry'] cache
//   - edit mode (editId set): updateItem(editId, input)
// Reuses the shared <Sheet> shell (portal + drag-to-close + Escape). The form edits EVERY value. The kind
// select gates the dose vs macro/nutrition fields; food exposes all numeric nutrition fields.
// Folyadék (F5, mezo-n4wf5.5; prototype `fuel.js` `sheetsC.add`): the light sheet + `FoSheetHead` (the title, under it the
// item's name when editing or „kézi felvétel"); every field is a kit `Lab` + `Input` / `Select`; the four macro and the four
// nutrient fields stand four across (two at ≤360 px); the foot is the small primary button with „Mégse" beside it.
// Behavior (fields, gating, the definition/state split, the definition lock on a shared catalogue entry) unchanged.
// ============================================================
import { useId, useState } from 'react'
import { usePantryActions } from '@/data/hooks'
import { SHOW_PANTRY_STOCK } from '@/data/_client/flags'
import { pantryCategoryMeta } from '@/data/fuel/pantry'
import { pantrySources, type PantrySourceKey } from '@/data/pantrySources'
import type { PantryItemInput, PantryItemKind } from '@/data/types'
import { useM } from '@/shared/i18n'
import { Sheet } from '@/shared/ui/Sheet'
import { Acts, Btn, Input, Lab, Lk, Note, Select, TwoBtn } from '@/shared/ui/folyadek'
import { KAMRA_KINDS, pantryCategoryLabel } from '@/features/fuel/logic/kamraItems'
import { pantrySourceLabel } from '@/features/fuel/logic/pantryProvenance'
import { KamraSheetHead, KAMRA_SHEET_CLASS } from '@/features/fuel/sheets/KamraSheetHead'

const categoryKeys = Object.keys(pantryCategoryMeta)
const sourceKeys = Object.keys(pantrySources) as PantrySourceKey[]

// A single form field: the kit label on top, the control below. `children` gets the id the label points at.
function Field({ label, children }: { label: string; children: (id: string) => React.ReactNode }) {
  const id = useId()
  return (
    <div>
      <Lab htmlFor={id}>{label}</Lab>
      {children(id)}
    </div>
  )
}
const numProps = { inputMode: 'decimal' as const }
const toNum = (s: string): number | undefined => (s.trim() === '' ? undefined : Number(s))

export function AddPantryItemSheet({
  open,
  onClose,
  editId,
  initial,
  definitionLocked,
}: {
  open: boolean
  onClose: () => void
  editId?: string
  initial?: Partial<PantryItemInput>
  /** S4 (mezo-qw37.4): true when this row's shared definition may not be edited by this
   *  user (item.catalogEditable === false) — kind/category/name/source/macro/nutrition
   *  inputs lock; price/stock/dose stay editable (they are the caller's own facts). */
  definitionLocked?: boolean
}) {
  const M = useM()
  const lock = definitionLocked === true
  const { addItem, updateItem } = usePantryActions()
  const [kind, setKind] = useState<PantryItemKind>(initial?.kind ?? 'food')
  // No fabricated default (mezo-xaq5 review, Important-1): a row whose shared
  // definition has category IS NULL must stay category-less in state — defaulting
  // to 'protein' here made an untouched price-only save on an UNLOCKED row send
  // `category: 'protein'` on the wire (put() below only skips a value that equals
  // `initial`, and `initial?.category` is undefined, never 'protein').
  const [category, setCategory] = useState(initial?.category ?? '')
  const [source, setSource] = useState<PantrySourceKey>(initial?.source ?? 'manual')
  const [name, setName] = useState(initial?.name ?? '')
  // The macro BASIS is not an input (mezo-0gjr): create always lands per-100 g / grams — the
  // value the label prints. A legacy non-100 basis (the one intentional per-serving row) is
  // shown read-only in edit mode and never rewritten (edit omits per/unit → PATCH-merge keeps it).
  const legacyPer = editId != null && initial?.per != null && initial.per !== 100 ? initial.per : null
  // macros
  const [kcal, setKcal] = useState(initial?.kcal?.toString() ?? '')
  const [proteinG, setProteinG] = useState(initial?.proteinG?.toString() ?? '')
  const [carbsG, setCarbsG] = useState(initial?.carbsG?.toString() ?? '')
  const [fatG, setFatG] = useState(initial?.fatG?.toString() ?? '')
  // extended nutrition
  const [fiberG, setFiberG] = useState(initial?.fiberG?.toString() ?? '')
  const [sugarG, setSugarG] = useState(initial?.sugarG?.toString() ?? '')
  const [saturatedFatG, setSaturatedFatG] = useState(initial?.saturatedFatG?.toString() ?? '')
  const [saltG, setSaltG] = useState(initial?.saltG?.toString() ?? '')
  // stock · price
  const [stockQty, setStockQty] = useState(initial?.stockQty?.toString() ?? '')
  const [stockUnit, setStockUnit] = useState(initial?.stockUnit ?? '')
  const [price, setPrice] = useState(initial?.price?.toString() ?? '')
  // supplements/stim/med
  const [dose, setDose] = useState(initial?.dose ?? '')

  const isFood = kind === 'food'

  function submit() {
    const isEdit = editId != null
    // STATE half — the caller's OWN shelf row (price/stock/dose/protocol). Always sent, never gated.
    // `kind`/`name` ride along because PantryItemRequest requires them; an UNCHANGED echo of them is
    // not a definition edit (PantryMapper.definitionDiffers compares stripped values, and the
    // backend validates/writes the definition only when it actually differs).
    const input: PantryItemInput = {
      kind,
      name,
      stockQty: toNum(stockQty),
      stockUnit: stockUnit || undefined,
      price: toNum(price),
      priceUnit: initial?.priceUnit,
    }
    if (!isFood) {
      input.dose = dose
      input.protocol = initial?.protocol
    }
    // DEFINITION half — the SHARED catalog row (mezo-qw37.4 final review, I-1). Send a field only
    // when THIS save actually changes it, and never at all while the row is locked. The sheet used
    // to echo the whole definition back on every save; since PantryMapper zero-fills NULL macros on
    // the way out, that echo turned a pure price edit into a definition edit — a 403
    // (PANTRY_CATALOG_NOT_EDITABLE) for a non-author, and for an OWNER, who passes the gate, a
    // silent write of fabricated 0 kcal/protein/carbs/fat onto a definition other users read.
    // Dropping only UNCHANGED values keeps a genuinely typed 0 intact: it differs from the
    // prefill it replaces, so it is still sent.
    const put = <K extends keyof PantryItemInput>(key: K, value: PantryItemInput[K] | undefined) => {
      if (value === undefined) return
      if (isEdit && initial?.[key] === value) return
      input[key] = value as PantryItemInput[K]
    }
    if (!lock) {
      put('source', source)
      // '' means "no category chosen / left as-is on a null-category row" — never send it as
      // a real value (an untouched null-category item must not fabricate `category: ''` or
      // any default onto the wire; see the useState comment above).
      put('category', category || undefined)
      put('pkg', initial?.pkg)
      // Create pins the per-100 g / grams basis explicitly (a null serving_amount would re-open the
      // `per ?? 1` recipe-math trap). Edit never changes the basis — it is not an input (mezo-0gjr) —
      // so it is simply omitted now that a state-only PATCH no longer has to satisfy validatePerKind.
      if (!isEdit) {
        input.per = 100
        input.unit = 'g'
      }
      if (isFood) {
        // `?? 0` only on create, where the backend requires kcal; on edit an empty box means
        // "unchanged", never a fabricated 0 onto a NULL column.
        put('kcal', isEdit ? toNum(kcal) : (toNum(kcal) ?? 0))
        put('proteinG', toNum(proteinG))
        put('carbsG', toNum(carbsG))
        put('fatG', toNum(fatG))
        put('fiberG', toNum(fiberG))
        put('sugarG', toNum(sugarG))
        put('saturatedFatG', toNum(saturatedFatG))
        put('saltG', toNum(saltG))
      } else {
        put('form', initial?.form)
      }
    }
    if (editId) updateItem(editId, input)
    else addItem(input)
    onClose()
  }

  if (!open) return null
  const A = M.fuelKamra.add
  const num = (label: string, value: string, set: (v: string) => void, placeholder: string, locked = lock) => (
    <Field label={label}>
      {id => <Input id={id} disabled={locked} {...numProps} value={value} onChange={e => set(e.target.value)} placeholder={placeholder} />}
    </Field>
  )

  return (
    <Sheet onClose={onClose} labelledBy="add-pantry-item-title" className={KAMRA_SHEET_CLASS}>
      {(close) => (
        <div className="fp-form">
          <KamraSheetHead icon="t-journal" titleId="add-pantry-item-title"
            title={editId ? A.titleEdit : A.titleNew}
            eyebrow={editId ? (initial?.name ?? '') : A.subNew} />

          <TwoBtn className="fp-two">
            <Field label={A.type}>
              {id => (
                <Select id={id} disabled={lock} value={kind} onChange={e => setKind(e.target.value as PantryItemKind)}>
                  {KAMRA_KINDS.map(k => <option key={k} value={k}>{M.fuelKamra.kindOption[k]}</option>)}
                </Select>
              )}
            </Field>
            <Field label={A.category}>
              {id => (
                <Select id={id} disabled={lock} value={category} onChange={e => setCategory(e.target.value)}>
                  {category === '' && <option value="">{A.noCategory}</option>}
                  {categoryKeys.map(c => <option key={c} value={c}>{pantryCategoryLabel(c)}</option>)}
                </Select>
              )}
            </Field>
          </TwoBtn>
          <Field label={A.name}>
            {id => <Input id={id} disabled={lock} value={name} onChange={e => setName(e.target.value)} placeholder={A.namePlaceholder} />}
          </Field>
          <Field label={A.source}>
            {id => (
              <Select id={id} disabled={lock} value={source} onChange={e => setSource(e.target.value as PantrySourceKey)}>
                {sourceKeys.map(k => <option key={k} value={k}>{pantrySourceLabel(k)}</option>)}
              </Select>
            )}
          </Field>
          {legacyPer != null && <Note>{A.legacyBasis(legacyPer, initial?.unit ?? 'g')}</Note>}
          {lock && <Note className="fp-warn">{A.locked}</Note>}

          {isFood ? (
            <>
              {/* Makrók — the label's per-100 g column, verbatim (mezo-0gjr) */}
              <Lab className="fp-grp">{A.macros}</Lab>
              <div className="fp-4">
                {num(A.kcal, kcal, setKcal, '119')}
                {num(M.fuelKozos.macro.protein, proteinG, setProteinG, '6')}
                {num(M.fuelKozos.macro.carbs, carbsG, setCarbsG, '4')}
                {num(M.fuelKozos.macro.fat, fatG, setFatG, '9')}
              </div>
              {/* Tápanyag — same per-100 g basis as the macros */}
              <Lab className="fp-grp">{A.nutrients}</Lab>
              <div className="fp-4">
                {num(M.fuelKozos.factsLong.fiber, fiberG, setFiberG, '0')}
                {num(M.fuelKozos.factsLong.sugar, sugarG, setSugarG, '0')}
                {num(A.satFat, saturatedFatG, setSaturatedFatG, '0')}
                {num(M.fuelKozos.factsLong.salt, saltG, setSaltG, '0')}
              </div>
            </>
          ) : (
            /* Dózis (supplement/stim/med) — the caller's own fact, never locked */
            <Field label={A.dose}>
              {id => <Input id={id} value={dose} onChange={e => setDose(e.target.value)} placeholder={A.dosePlaceholder} />}
            </Field>
          )}

          {/* Készlet — hidden behind its flag (deferred, mezo-6nu); the price stays */}
          {SHOW_PANTRY_STOCK && (
            <TwoBtn className="fp-two">
              {num(A.stock, stockQty, setStockQty, '—', false)}
              <Field label={A.stockUnit}>
                {id => <Input id={id} value={stockUnit} onChange={e => setStockUnit(e.target.value)} placeholder="g" />}
              </Field>
            </TwoBtn>
          )}
          {num(A.price, price, setPrice, '750', false)}

          <Acts>
            <Btn sm disabled={!name.trim()} onClick={submit}>{editId ? A.save : A.toShelf}</Btn>
            <Lk onClick={close}>{M.kit.cancel}</Lk>
          </Acts>
          {!editId && <Note>{A.needsName}</Note>}
        </div>
      )}
    </Sheet>
  )
}

// ============================================================
// Mezo · AddPantryItemSheet
// Manual add/edit form for a Kamra item. Real CRUD via usePantryActions:
//   - add mode (no editId): addItem(input) → appends to the ['pantry'] cache
//   - edit mode (editId set): updateItem(editId, input)
// Reuses the shared <Sheet> shell (portal + drag-to-close + Escape). The form now
// edits EVERY value (docs/design/kamra-detail-edit-v1.html · phone 3), grouped in
// chamfer-chrome sections: Alap / Makrók / Tápanyag / Készlet · ár. The kind toggle
// gates the dose vs macro/nutrition fields where it makes sense; food exposes all
// numeric nutrition fields.
// Üveg (mezo-me75u.2, uveg-fuel-tobbi.html `SH.add`): the sheet is one gold glass surface; the
// fields are flat cells with an eyebrow label, the sections eyebrow rows, Mégse flat and the
// save a gold-lit flat pill (never glass in glass). Behavior (fields, gating, the definition/state split) unchanged.
// ============================================================
import { useState } from 'react'
import { usePantryActions } from '@/data/hooks'
import { SHOW_PANTRY_STOCK } from '@/data/_client/flags'
import { pantryCategoryMeta } from '@/data/fuel/pantry'
import { pantrySources, type PantrySourceKey } from '@/data/pantrySources'
import type { PantryItemInput, PantryItemKind } from '@/data/types'
import { Sheet } from '@/shared/ui/Sheet'
import { Icon } from '@/shared/ui/Icon'
import { KamraSheetHead, KAMRA_SHEET_CLASS } from '@/features/fuel/sheets/KamraSheetHead'

const kinds: { id: PantryItemKind; label: string }[] = [
  { id: 'food', label: 'Étel' },
  { id: 'supplement', label: 'Supplement' },
  { id: 'stim', label: 'Stimuláns' },
  { id: 'med', label: 'Gyógyszer' },
]

const categoryKeys = Object.keys(pantryCategoryMeta)
const sourceKeys = Object.keys(pantrySources) as PantrySourceKey[]

// A single form field (eyebrow label on top, the flat control below — `.fkk-inp`).
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="fkk-field">
      <span className="uv-eyebrow">{label}</span>
      {children}
    </label>
  )
}

function SectionHead({ children }: { children: React.ReactNode }) {
  return <div className="fkk-sh-sec uv-eyebrow">{children}</div>
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

  return (
    <Sheet onClose={onClose} labelledBy="add-pantry-item-title" className={KAMRA_SHEET_CLASS}>
      {(close) => (
        <>
          <KamraSheetHead icon="t-journal" titleId="add-pantry-item-title" onClose={close}
            eyebrow={editId ? 'Tétel · szerkesztés' : 'Új tétel · kézi'}
            title={editId ? 'Tétel szerkesztése' : 'Új kamra-tétel'} />

          {/* Alap */}
          <SectionHead>Alap</SectionHead>
          <div className="fkk-grid2">
            <Field label="Típus">
              <select disabled={lock} value={kind} onChange={e => setKind(e.target.value as PantryItemKind)} className="fkk-inp">
                {kinds.map(k => <option key={k.id} value={k.id}>{k.label}</option>)}
              </select>
            </Field>
            <Field label="Kategória">
              <select disabled={lock} value={category} onChange={e => setCategory(e.target.value)} className="fkk-inp">
                {category === '' && <option value="">— nincs —</option>}
                {categoryKeys.map(c => <option key={c} value={c}>{pantryCategoryMeta[c].label}</option>)}
              </select>
            </Field>
          </div>
          <div className="fkk-grid1">
            <Field label="Név">
              <input disabled={lock} value={name} onChange={e => setName(e.target.value)} placeholder="pl. Görög joghurt 10%" className="fkk-inp" />
            </Field>
          </div>
          <div className="fkk-grid2">
            <Field label="Forrás">
              <select disabled={lock} value={source} onChange={e => setSource(e.target.value as PantrySourceKey)} className="fkk-inp">
                {sourceKeys.map(s => <option key={s} value={s}>{pantrySources[s].label}</option>)}
              </select>
            </Field>
          </div>
          {legacyPer != null && (
            <p className="fkk-sh-note">
              Bázis: /{legacyPer} {initial?.unit ?? 'g'} · örökölt
            </p>
          )}
          {lock && (
            <p className="fkk-sh-note">
              Közös katalógus-tétel: az adatait csak a szerző vagy a tulajdonos szerkesztheti. Az ár, a készlet és a dózis a tiéd.
            </p>
          )}

          {isFood ? (
            <>
              {/* Makrók — the label's per-100 g column, verbatim (mezo-0gjr) */}
              <SectionHead>Makrók · /100 g</SectionHead>
              <div className="fkk-grid2">
                <Field label="kcal"><input disabled={lock} {...numProps} value={kcal} onChange={e => setKcal(e.target.value)} placeholder="119" className="fkk-inp" /></Field>
                <Field label="Fehérje"><input disabled={lock} {...numProps} value={proteinG} onChange={e => setProteinG(e.target.value)} placeholder="6" className="fkk-inp" /></Field>
              </div>
              <div className="fkk-grid2">
                <Field label="Szénhidrát"><input disabled={lock} {...numProps} value={carbsG} onChange={e => setCarbsG(e.target.value)} placeholder="4" className="fkk-inp" /></Field>
                <Field label="Zsír"><input disabled={lock} {...numProps} value={fatG} onChange={e => setFatG(e.target.value)} placeholder="9" className="fkk-inp" /></Field>
              </div>

              {/* Tápanyag — same per-100 g basis as the macros */}
              <SectionHead>Tápanyag · /100 g</SectionHead>
              <div className="fkk-grid2">
                <Field label="Rost"><input disabled={lock} {...numProps} value={fiberG} onChange={e => setFiberG(e.target.value)} placeholder="0" className="fkk-inp" /></Field>
                <Field label="Cukor"><input disabled={lock} {...numProps} value={sugarG} onChange={e => setSugarG(e.target.value)} placeholder="0" className="fkk-inp" /></Field>
              </div>
              <div className="fkk-grid2">
                <Field label="Tel. zsír"><input disabled={lock} {...numProps} value={saturatedFatG} onChange={e => setSaturatedFatG(e.target.value)} placeholder="0" className="fkk-inp" /></Field>
                <Field label="Só"><input disabled={lock} {...numProps} value={saltG} onChange={e => setSaltG(e.target.value)} placeholder="0" className="fkk-inp" /></Field>
              </div>
            </>
          ) : (
            <>
              {/* Dózis (supplement/stim/med) */}
              <SectionHead>Dózis</SectionHead>
              <div className="fkk-grid1">
                <Field label="Dózis">
                  <input value={dose} onChange={e => setDose(e.target.value)} placeholder="pl. 5 g" className="fkk-inp" />
                </Field>
              </div>
            </>
          )}

          {/* Készlet · ár — stock input hidden (deferred, mezo-6nu); price kept */}
          <SectionHead>{SHOW_PANTRY_STOCK ? 'Készlet · ár' : 'Ár'}</SectionHead>
          <div className="fkk-grid2">
            {SHOW_PANTRY_STOCK && (
              <Field label="Készlet">
                <span className="fkk-grid2 is-tight">
                  <input {...numProps} value={stockQty} onChange={e => setStockQty(e.target.value)} placeholder="—" className="fkk-inp" />
                  <input value={stockUnit} onChange={e => setStockUnit(e.target.value)} placeholder="g" className="fkk-inp" />
                </span>
              </Field>
            )}
            <Field label="Ár (Ft)">
              <input {...numProps} value={price} onChange={e => setPrice(e.target.value)} placeholder="750" className="fkk-inp" />
            </Field>
          </div>

          {/* Actions */}
          <div className="fkk-sh-acts">
            <button type="button" className="fkk-btn is-flat" onClick={close}>
              Mégse
            </button>
            <button type="button" className="fkk-btn is-go" disabled={!name.trim()} onClick={submit}>
              <Icon name="check" size={14} /> {editId ? 'Mentés' : 'Polcra'}
            </button>
          </div>
        </>
      )}
    </Sheet>
  )
}

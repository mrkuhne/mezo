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
// ============================================================
import { useState } from 'react'
import { usePantryActions } from '@/data/hooks'
import { SHOW_PANTRY_STOCK } from '@/data/_client/flags'
import { pantryCategoryMeta } from '@/data/fuel/pantry'
import { pantrySources, type PantrySourceKey } from '@/data/pantrySources'
import type { PantryItemInput, PantryItemKind } from '@/data/types'
import { Sheet } from '@/shared/ui/Sheet'
import { Icon } from '@/shared/ui/Icon'
import { Eyebrow } from '@/shared/ui/Eyebrow'
import { Display } from '@/shared/ui/Display'

const kinds: { id: PantryItemKind; label: string }[] = [
  { id: 'food', label: 'Étel' },
  { id: 'supplement', label: 'Supplement' },
  { id: 'stim', label: 'Stimuláns' },
  { id: 'med', label: 'Gyógyszer' },
]

const categoryKeys = Object.keys(pantryCategoryMeta)
const sourceKeys = Object.keys(pantrySources) as PantrySourceKey[]

const fieldLabelStyle = { fontSize: 8, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-tertiary)' } as const
const fieldInputStyle = { fontSize: 14, color: 'var(--text-primary)', marginTop: 3, width: '100%' } as const
const selectStyle = { ...fieldInputStyle, background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', padding: '5px 6px' } as const

// A single chamfered form field card (label on top, control below).
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="card notch-4" style={{ padding: '8px 10px' }}>
      <label className="label-mono col" style={{ ...fieldLabelStyle, gap: 0 }}>
        {label}
        {children}
      </label>
    </div>
  )
}

function SectionHead({ children }: { children: React.ReactNode }) {
  return (
    <div className="row" style={{ alignItems: 'center', gap: 8, margin: '14px 2px 8px' }}>
      <span className="label-mono" style={{ fontSize: 9, letterSpacing: '0.14em', color: 'var(--text-tertiary)' }}>{children}</span>
      <span style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
    </div>
  )
}

const grid2 = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 } as const
const numProps = { inputMode: 'decimal' as const }
const toNum = (s: string): number | undefined => (s.trim() === '' ? undefined : Number(s))

export function AddPantryItemSheet({
  open,
  onClose,
  editId,
  initial,
}: {
  open: boolean
  onClose: () => void
  editId?: string
  initial?: Partial<PantryItemInput>
}) {
  const { addItem, updateItem } = usePantryActions()
  const [kind, setKind] = useState<PantryItemKind>(initial?.kind ?? 'food')
  const [category, setCategory] = useState(initial?.category ?? 'protein')
  const [source, setSource] = useState<PantrySourceKey>(initial?.source ?? 'manual')
  const [name, setName] = useState(initial?.name ?? '')
  const [per, setPer] = useState(initial?.per?.toString() ?? '100')
  const [unit, setUnit] = useState(initial?.unit ?? 'g')
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
    const input: PantryItemInput = {
      kind,
      name,
      source,
      category,
      per: toNum(per),
      unit,
      stockQty: toNum(stockQty),
      stockUnit: stockUnit || undefined,
      price: toNum(price),
      priceUnit: initial?.priceUnit,
      pkg: initial?.pkg,
    }
    if (isFood) {
      input.kcal = toNum(kcal) ?? 0
      input.proteinG = toNum(proteinG)
      input.carbsG = toNum(carbsG)
      input.fatG = toNum(fatG)
      input.fiberG = toNum(fiberG)
      input.sugarG = toNum(sugarG)
      input.saturatedFatG = toNum(saturatedFatG)
      input.saltG = toNum(saltG)
    } else {
      input.dose = dose
      input.form = initial?.form
      input.protocol = initial?.protocol
    }
    if (editId) updateItem(editId, input)
    else addItem(input)
    onClose()
  }

  if (!open) return null

  return (
    <Sheet onClose={onClose} labelledBy="add-pantry-item-title">
      {(close) => (
        <>
          {/* Header */}
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
            <div className="col">
              <Eyebrow brand>{editId ? 'Tétel · szerkesztés' : 'Új tétel · kézi'}</Eyebrow>
              <div id="add-pantry-item-title" style={{ marginTop: 4 }}>
                <Display size="md">{editId ? 'Tétel szerkesztése' : 'Új kamra-tétel'}</Display>
              </div>
            </div>
            <button className="chip notch-8" aria-label="Bezárás" onClick={close} style={{ padding: '6px 8px' }}>
              <Icon name="x" size={12} />
            </button>
          </div>

          {/* Alap */}
          <SectionHead>Alap</SectionHead>
          <div style={grid2}>
            <Field label="Típus">
              <select value={kind} onChange={e => setKind(e.target.value as PantryItemKind)} style={selectStyle}>
                {kinds.map(k => <option key={k.id} value={k.id}>{k.label}</option>)}
              </select>
            </Field>
            <Field label="Kategória">
              <select value={category} onChange={e => setCategory(e.target.value)} style={selectStyle}>
                {categoryKeys.map(c => <option key={c} value={c}>{pantryCategoryMeta[c].label}</option>)}
              </select>
            </Field>
          </div>
          <div style={{ marginBottom: 8 }}>
            <Field label="Név">
              <input value={name} onChange={e => setName(e.target.value)} placeholder="pl. Görög joghurt 10%" style={fieldInputStyle} />
            </Field>
          </div>
          <div style={grid2}>
            <Field label="Forrás">
              <select value={source} onChange={e => setSource(e.target.value as PantrySourceKey)} style={selectStyle}>
                {sourceKeys.map(s => <option key={s} value={s}>{pantrySources[s].label}</option>)}
              </select>
            </Field>
            <Field label="Adag">
              <div className="row gap-xs" style={{ marginTop: 3, alignItems: 'center' }}>
                <input {...numProps} value={per} onChange={e => setPer(e.target.value)} placeholder="100" style={{ fontSize: 14, color: 'var(--text-primary)', width: '50%' }} />
                <input value={unit} onChange={e => setUnit(e.target.value)} placeholder="g" style={{ fontSize: 14, color: 'var(--text-primary)', width: '50%' }} />
              </div>
            </Field>
          </div>

          {isFood ? (
            <>
              {/* Makrók */}
              <SectionHead>Makrók</SectionHead>
              <div style={grid2}>
                <Field label="kcal"><input {...numProps} value={kcal} onChange={e => setKcal(e.target.value)} placeholder="119" style={fieldInputStyle} /></Field>
                <Field label="Fehérje"><input {...numProps} value={proteinG} onChange={e => setProteinG(e.target.value)} placeholder="6" style={fieldInputStyle} /></Field>
              </div>
              <div style={grid2}>
                <Field label="Szénhidrát"><input {...numProps} value={carbsG} onChange={e => setCarbsG(e.target.value)} placeholder="4" style={fieldInputStyle} /></Field>
                <Field label="Zsír"><input {...numProps} value={fatG} onChange={e => setFatG(e.target.value)} placeholder="9" style={fieldInputStyle} /></Field>
              </div>

              {/* Tápanyag */}
              <SectionHead>Tápanyag</SectionHead>
              <div style={grid2}>
                <Field label="Rost"><input {...numProps} value={fiberG} onChange={e => setFiberG(e.target.value)} placeholder="0" style={fieldInputStyle} /></Field>
                <Field label="Cukor"><input {...numProps} value={sugarG} onChange={e => setSugarG(e.target.value)} placeholder="0" style={fieldInputStyle} /></Field>
              </div>
              <div style={grid2}>
                <Field label="Tel. zsír"><input {...numProps} value={saturatedFatG} onChange={e => setSaturatedFatG(e.target.value)} placeholder="0" style={fieldInputStyle} /></Field>
                <Field label="Só"><input {...numProps} value={saltG} onChange={e => setSaltG(e.target.value)} placeholder="0" style={fieldInputStyle} /></Field>
              </div>
            </>
          ) : (
            <>
              {/* Dózis (supplement/stim/med) */}
              <SectionHead>Dózis</SectionHead>
              <div style={{ marginBottom: 8 }}>
                <Field label="Dózis">
                  <input value={dose} onChange={e => setDose(e.target.value)} placeholder="pl. 5 g" style={fieldInputStyle} />
                </Field>
              </div>
            </>
          )}

          {/* Készlet · ár — stock input hidden (deferred, mezo-6nu); price kept */}
          <SectionHead>{SHOW_PANTRY_STOCK ? 'Készlet · ár' : 'Ár'}</SectionHead>
          <div style={grid2}>
            {SHOW_PANTRY_STOCK && (
              <Field label="Készlet">
                <div className="row gap-xs" style={{ marginTop: 3, alignItems: 'center' }}>
                  <input {...numProps} value={stockQty} onChange={e => setStockQty(e.target.value)} placeholder="—" style={{ fontSize: 14, color: 'var(--text-primary)', width: '50%' }} />
                  <input value={stockUnit} onChange={e => setStockUnit(e.target.value)} placeholder="g" style={{ fontSize: 14, color: 'var(--text-primary)', width: '50%' }} />
                </div>
              </Field>
            )}
            <Field label="Ár (Ft)">
              <input {...numProps} value={price} onChange={e => setPrice(e.target.value)} placeholder="750" style={fieldInputStyle} />
            </Field>
          </div>

          {/* Actions */}
          <div className="row gap-sm" style={{ marginTop: 14 }}>
            <button className="cta-ghost notch-4 flex-1" onClick={close}>
              Mégse
            </button>
            <button className="cta-primary notch-4 flex-1" disabled={!name.trim()} onClick={submit}>
              <Icon name="check" size={14} /> {editId ? 'Mentés' : 'Polcra'}
            </button>
          </div>

          <div style={{ height: 24 }} />
        </>
      )}
    </Sheet>
  )
}

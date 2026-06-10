// ============================================================
// Mezo · NewRecipeSheet (create-recipe skeleton flow)
// Compose a recipe from Kamra ingredients: name it, pick a slot, add
// ingredients via the nested IngredientPickerSheet, tune amounts, and watch
// the running macro total tick up. Save is a skeleton — it only calls
// onClose() (no persistence, no global mutation), mirroring the prototype.
// Port: prototype/src/fuel-recipes.jsx NewRecipeSheet + NewRecipeIngredientRow
// (612–775).
//
// Adaptations vs prototype:
//  - Uses the shared <Sheet> (portal + drag-to-close + Escape) instead of the
//    bespoke .sheet-backdrop/.sheet markup; close() comes from its render-prop
//    so the X and Mégse buttons dismiss with the same slide-down.
//  - Running totals reuse the shared <StatCell> (the prototype's local
//    RecipeStat is identical: label/val/sub/color).
//  - The "brand-tinted when picked" total card replaces the prototype's
//    rgba(94, 234, 212, 0.04) with the project HEX-ALPHA-style explicit
//    color-mix on var(--brand-glow) (0.04 ≈ 4%).
//  - Ingredients come from usePantry(); the resolved ingredient is passed to
//    NewRecipeIngredientRow as a prop (vs the prototype attaching it to item).
// ============================================================
import { useState } from 'react'
import type { Ingredient } from '@/data/types'
import { usePantry } from '@/data/hooks'
import { Sheet } from '@/components/ui/Sheet'
import { Icon } from '@/components/ui/Icon'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { Display } from '@/components/ui/Display'
import { StatCell } from '@/components/ui/StatCell'
import { IngredientPickerSheet } from './IngredientPickerSheet'

interface PickedIngredient {
  refId: string
  amount: number
  unit: string
}

const slots: { id: string; label: string }[] = [
  { id: 'breakfast', label: 'Reggeli' },
  { id: 'lunch', label: 'Ebéd' },
  { id: 'dinner', label: 'Vacsora' },
  { id: 'snack', label: 'Snack' },
]

function NewRecipeIngredientRow({
  item,
  ingredient,
  catColor,
  onChange,
  onRemove,
}: {
  item: PickedIngredient
  ingredient: Ingredient
  catColor: string
  onChange: (amount: number) => void
  onRemove: () => void
}) {
  return (
    <div className="card notch-4" style={{ padding: '10px 12px', borderLeft: '2px solid ' + catColor }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <div className="col flex-1" style={{ minWidth: 0 }}>
          <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{ingredient.name}</span>
          <span className="text-tertiary" style={{ fontSize: 10, fontFamily: 'var(--ff-mono)', marginTop: 2 }}>
            {ingredient.brand}
          </span>
        </div>
        <div className="row gap-xs" style={{ alignItems: 'center' }}>
          <input
            type="number"
            value={item.amount}
            onChange={e => onChange(+e.target.value)}
            aria-label={ingredient.name + ' mennyiség'}
            style={{
              width: 56,
              padding: '4px 6px',
              fontFamily: 'var(--ff-mono)',
              fontSize: 13,
              fontWeight: 600,
              color: catColor,
              textAlign: 'right',
              background: 'var(--surface-2)',
              border: '1px solid var(--border-subtle)',
            }}
          />
          <span className="text-tertiary" style={{ fontSize: 11, fontFamily: 'var(--ff-mono)', width: 18 }}>
            {item.unit}
          </span>
          <button onClick={onRemove} aria-label="Eltávolítás" style={{ padding: 6, color: 'var(--text-tertiary)' }}>
            <Icon name="x" size={11} />
          </button>
        </div>
      </div>
    </div>
  )
}

export function NewRecipeSheet({ onClose }: { onClose: () => void }) {
  const { ingredients, categoryMeta } = usePantry()
  const [name, setName] = useState('')
  const [slot, setSlot] = useState('breakfast')
  const [picked, setPicked] = useState<PickedIngredient[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)

  const items = picked.map(p => ({ ...p, ingredient: ingredients.find(i => i.id === p.refId) }))

  // Running macro totals: grams scale by amount/per, other units count as one.
  const totals = items.reduce(
    (acc, it) => {
      const ing = it.ingredient
      if (!ing) return acc
      const r = it.unit === 'g' ? it.amount / ing.per : 1
      return {
        kcal: acc.kcal + ing.macros.kcal * r,
        p: acc.p + ing.macros.p * r,
        c: acc.c + ing.macros.c * r,
        f: acc.f + ing.macros.f * r,
      }
    },
    { kcal: 0, p: 0, c: 0, f: 0 },
  )

  const addPicked = (ing: Ingredient) => {
    setPicked(prev => [...prev, { refId: ing.id, amount: 100, unit: ing.unit || 'g' }])
    setPickerOpen(false)
  }

  return (
    <>
      <Sheet onClose={onClose} labelledBy="new-recipe-title">
        {(close) => (
          <>
            {/* Header */}
            <div
              className="row"
              style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}
            >
              <div className="col">
                <Eyebrow brand>Új recept</Eyebrow>
                <div id="new-recipe-title" style={{ marginTop: 4 }}>
                  <Display size="md">Hozz össze valamit</Display>
                </div>
              </div>
              <button className="chip" aria-label="Bezárás" onClick={close} style={{ padding: '6px 8px' }}>
                <Icon name="x" size={12} />
              </button>
            </div>

            <p className="text-secondary" style={{ fontSize: 12, lineHeight: 1.5, marginBottom: 14 }}>
              Hozzávalók a Kamrából. Makrók automatikusan számolódnak, és a Mezo a logolás után pontoz Reta-fázis és
              napi pacing kontextusban.
            </p>

            {/* Name */}
            <div className="card notch-4" style={{ padding: '10px 12px', marginBottom: 10 }}>
              <span className="label-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>
                NÉV
              </span>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="pl. Tonhalsaláta · postworkout"
                style={{ fontSize: 14, color: 'var(--text-primary)', marginTop: 4, width: '100%' }}
              />
            </div>

            {/* Slot */}
            <div className="card notch-4" style={{ padding: '10px 12px', marginBottom: 14 }}>
              <span className="label-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>
                SLOT
              </span>
              <div className="row gap-xs mt-sm flex-wrap">
                {slots.map(s => (
                  <button
                    key={s.id}
                    onClick={() => setSlot(s.id)}
                    className={'chip' + (slot === s.id ? ' brand' : '')}
                    style={{ fontSize: 9, padding: '6px 10px' }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Running macro total */}
            <div
              className="card notch-4 row"
              style={{
                padding: 12,
                marginBottom: 14,
                justifyContent: 'space-between',
                background: items.length
                  ? 'color-mix(in srgb, var(--brand-glow) 4%, transparent)'
                  : 'var(--surface-1)',
                borderColor: items.length ? 'var(--border-brand)' : 'var(--border-subtle)',
              }}
            >
              <StatCell label="kcal" val={String(Math.round(totals.kcal))} sub="" color="var(--brand-glow)" />
              <StatCell label="P" val={totals.p.toFixed(0) + 'g'} sub="" color="var(--cat-physiology)" />
              <StatCell label="C" val={totals.c.toFixed(0) + 'g'} sub="" color="var(--warning)" />
              <StatCell label="F" val={totals.f.toFixed(0) + 'g'} sub="" color="var(--cat-preference)" />
            </div>

            {/* Picked ingredients */}
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
              <Eyebrow>Hozzávalók · {items.length}</Eyebrow>
              <button
                className="chip brand"
                onClick={() => setPickerOpen(true)}
                style={{ fontSize: 9, padding: '5px 10px' }}
              >
                <Icon name="plus" size={10} /> Kamrából
              </button>
            </div>

            <div className="col gap-sm" style={{ marginBottom: 16 }}>
              {items.length === 0 && (
                <div className="card notch-4" style={{ padding: 14, textAlign: 'center', borderStyle: 'dashed' }}>
                  <span className="text-tertiary" style={{ fontSize: 11 }}>
                    Még nincs hozzávaló. Nyomd a + Kamrából gombot.
                  </span>
                </div>
              )}
              {items.map((it, i) => {
                const ing = it.ingredient
                if (!ing) return null
                const catColor = categoryMeta[ing.category]?.color ?? 'var(--text-secondary)'
                return (
                  <NewRecipeIngredientRow
                    key={i}
                    item={it}
                    ingredient={ing}
                    catColor={catColor}
                    onChange={amount =>
                      setPicked(prev => prev.map((p, idx) => (idx === i ? { ...p, amount } : p)))
                    }
                    onRemove={() => setPicked(prev => prev.filter((_, idx) => idx !== i))}
                  />
                )
              })}
            </div>

            {/* Save */}
            <div className="row gap-sm">
              <button className="cta-ghost notch-4 flex-1" onClick={close}>
                Mégse
              </button>
              <button
                className="cta-primary notch-4 flex-1"
                disabled={!name || items.length === 0}
                onClick={onClose}
              >
                <Icon name="check" size={14} /> Mentés
              </button>
            </div>

            <div style={{ height: 24 }} />
          </>
        )}
      </Sheet>

      {pickerOpen && (
        <IngredientPickerSheet onPick={addPicked} onClose={() => setPickerOpen(false)} />
      )}
    </>
  )
}

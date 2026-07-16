// ============================================================
// Mezo · RecipeEditorPage (Receptek — create = edit PAGE)
// Approved full-page editor (docs/design/recipes-editor.html · left phone),
// replacing the retired NewRecipeSheet. Captures every real field: név, slot
// (segmented), csillag, adag + elő/főzési idő (steppers), címkék (chips),
// hozzávalók (picked rows = MacroCells contribution at the line amount, live via
// a per-row stepper + delete). A live total card carries the /adag↔egész toggle
// (default /adag) with a footer echoing the other basis. Sticky Mentés →
// useRecipeActions.create/update, then navigate back. Picker opens as a modal.
//
// Contribution = round(macro * amount/per) — the SAME amount/per rule as the
// backend mapper and the mock hook (replaces NewRecipeSheet's unit==='g' hack).
//
// Header-only re-skin (Napiv, mezo-8141): back button on its own row, then a
// pghead-np sage header (over "Fuel · Receptek", h1 = the current title content
// — the typed name, or the "—" placeholder). Body/editor flows unchanged.
// ============================================================
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useParams } from 'react-router-dom'
import type { Ingredient, Recipe, RecipeCategory, RecipeInput } from '@/data/types'
import { useRecipes, useRecipeActions } from '@/data/hooks'
import { Icon } from '@/shared/ui/Icon'
import { MacroCells } from '@/features/fuel/components/MacroCells'
import { ServingToggle, type ServingBasis } from '@/features/fuel/components/ServingToggle'
import { IngredientPickerSheet } from '@/features/fuel/sheets/IngredientPickerSheet'
import { usePickableIngredients, kindLabel } from '@/data/fuel/pantryPickables'

interface DraftLine { refId: string; amount: number; unit: string; note?: string }

const SLOTS: { id: RecipeCategory; label: string }[] = [
  { id: 'breakfast', label: 'Reggeli' },
  { id: 'lunch', label: 'Ebéd' },
  { id: 'dinner', label: 'Vacsora' },
  { id: 'snack', label: 'Snack' },
]

const round = (n: number) => Math.round(n)

// contribution of a draft line, given its resolved pantry ingredient
function contributionOf(line: DraftLine, ing: Ingredient | undefined) {
  if (!ing) return { kcal: 0, p: 0, c: 0, f: 0 }
  const factor = line.amount / (ing.per || 1)
  return {
    kcal: round(ing.macros.kcal * factor),
    p: round(ing.macros.p * factor),
    c: round(ing.macros.c * factor),
    f: round(ing.macros.f * factor),
  }
}

function Stepper({ value, unit, onChange, min = 0 }: { value: number; unit: string; onChange: (v: number) => void; min?: number }) {
  return (
    <div className="row" style={{ alignItems: 'center', background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', display: 'inline-flex' }}>
      <button onClick={() => onChange(Math.max(min, value - 1))} style={{ width: 30, height: 30, display: 'grid', placeItems: 'center', color: 'var(--coral)', fontSize: 16 }} aria-label="Csökkentés">−</button>
      <span style={{ minWidth: 36, textAlign: 'center', fontFamily: 'var(--ff-mono)', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{value}</span>
      <button onClick={() => onChange(value + 1)} style={{ width: 30, height: 30, display: 'grid', placeItems: 'center', color: 'var(--coral)', fontSize: 16 }} aria-label="Növelés">+</button>
      <span className="label-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)', padding: '0 8px 0 2px' }}>{unit}</span>
    </div>
  )
}

// Typeable per-ingredient gram amount (mezo-2567). Keeps a local string so decimals
// ("12.5") and mid-typing states hold, coercing to a number on every change. Re-syncs
// when the amount changes from OUTSIDE (the ± buttons) via the render-time prev-prop
// pattern — no useEffect, so no keystroke-reset race.
function AmountField({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) {
  const [text, setText] = useState(() => String(value))
  const [prev, setPrev] = useState(value)
  // What the current text represents numerically ("" and "." both mean 0, matching commit()).
  const parsed = text === '' || text === '.' ? 0 : parseFloat(text)
  if (value !== prev) {
    setPrev(value)
    if (parsed !== value) setText(String(value)) // external change (± buttons) → resync
  }
  const commit = (raw: string) => {
    const cleaned = raw.replace(',', '.')
    if (cleaned !== '' && !/^\d*\.?\d*$/.test(cleaned)) return // ignore non-numeric input
    setText(cleaned)
    const n = cleaned === '' || cleaned === '.' ? 0 : parseFloat(cleaned)
    onChange(Number.isFinite(n) ? n : 0)
  }
  return (
    <input
      inputMode="decimal"
      value={text}
      onChange={e => commit(e.target.value)}
      aria-label={label}
      style={{ width: 42, textAlign: 'center', fontFamily: 'var(--ff-mono)', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', background: 'transparent' }}
    />
  )
}

export function RecipeEditorPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { recipes, categoryMeta } = useRecipes()
  // Resolve picked-line display name + live macro contribution from the SAME
  // unified pickable source the picker draws from (foods + supplement stash) — NOT
  // useRecipes().ingredients, which is the static mock seed and would miss real-mode
  // backend UUIDs (mezo-yew) and every supplement line (mezo-3vu4).
  const pickables = usePickableIngredients()
  const { create, update } = useRecipeActions()

  const editing = recipes.find(r => r.id === id)
  const isEditMode = Boolean(id)

  // seed the draft once from the editing recipe (or empty for create)
  const [name, setName] = useState(() => editing?.name ?? '')
  const [slot, setSlot] = useState<RecipeCategory>(() => editing?.category ?? 'breakfast')
  const [starred, setStarred] = useState(() => editing?.starred ?? false)
  const [servings, setServings] = useState(() => editing?.servings ?? 1)
  const [mins, setMins] = useState(() => (editing ? editing.prepMins + editing.cookMins : 0))
  const [tags, setTags] = useState<string[]>(() => editing?.tags ?? [])
  const [lines, setLines] = useState<DraftLine[]>(() =>
    editing ? editing.ingredients.map(i => ({ refId: i.refId, amount: i.amount, unit: i.unit, note: i.note })) : [],
  )
  const [basis, setBasis] = useState<ServingBasis>('serving')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [tagDraft, setTagDraft] = useState('')

  // Edit-mode deep link with no matching recipe → not-found. The DATA section exposes
  // no raw query status, so we rely on useRecipes().recipes: synchronous in mock (via
  // initialData); in real mode a cold hard-reload may show this briefly until the list resolves.
  if (isEditMode && !editing) {
    return (
      <div style={{ padding: '0 24px' }}>
        <div className="card" style={{ padding: 20, textAlign: 'center' }}>
          <span className="text-tertiary" style={{ fontSize: 12 }}>Nincs ilyen recept.</span>
        </div>
      </div>
    )
  }

  const resolved = lines.map(l => ({ line: l, ing: pickables.find(i => i.id === l.refId) }))
  const wholeTotal = resolved.reduce(
    (acc, { line, ing }) => {
      const c = contributionOf(line, ing)
      return { kcal: acc.kcal + c.kcal, p: acc.p + c.p, c: acc.c + c.c, f: acc.f + c.f }
    },
    { kcal: 0, p: 0, c: 0, f: 0 },
  )
  const perServing = {
    kcal: round(wholeTotal.kcal / Math.max(1, servings)),
    p: round(wholeTotal.p / Math.max(1, servings)),
    c: round(wholeTotal.c / Math.max(1, servings)),
    f: round(wholeTotal.f / Math.max(1, servings)),
  }
  const shownTotal = basis === 'whole' ? wholeTotal : perServing
  const otherTotal = basis === 'whole' ? perServing : wholeTotal
  const otherLabel = basis === 'whole' ? 'egy adag' : 'egész recept'

  // Append the picked pantry item as a new line. The sheet stays open (multi-add) —
  // it's the parent that used to close it; a duplicate refId is ignored (the picker
  // also disables an already-added row) so re-taps never stack the same ingredient.
  const addPicked = (ing: Ingredient) => {
    setLines(prev => (prev.some(l => l.refId === ing.id) ? prev : [...prev, { refId: ing.id, amount: ing.per || 100, unit: ing.unit || 'g' }]))
  }
  const addTag = () => {
    const t = tagDraft.trim()
    if (t && !tags.includes(t)) setTags(prev => [...prev, t])
    setTagDraft('')
  }

  const canSave = name.trim().length > 0 && lines.length > 0
  const save = () => {
    if (!canSave) return
    const input: RecipeInput = {
      name: name.trim(),
      slot: editing?.slot ?? null,
      category: slot,
      servings,
      prepMins: mins,
      cookMins: 0,
      tags,
      starred,
      ingredients: lines.map(l => ({ pantryItemId: l.refId, amount: l.amount, unit: l.unit, note: l.note ?? null })),
    }
    if (isEditMode && editing) {
      update(editing.id, input)
      navigate(`/fuel/recipes/${editing.id}`)
    } else {
      create(input)
      navigate('/fuel/recipes')
    }
  }

  const catColor = (cat: string | undefined): string => (cat && categoryMeta[cat]?.color) || 'var(--success)'

  return (
    <>
      <div style={{ padding: '0 16px 110px' }}>
        {/* Top bar — back button, own row (header-only re-skin, mezo-8141) */}
        <div className="row" style={{ padding: '6px 0 0' }}>
          <button
            onClick={() => navigate(-1)}
            className="rad-16"
            style={{ width: 34, height: 34, flexShrink: 0, display: 'grid', placeItems: 'center', background: 'var(--surface-1)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', fontSize: 18, lineHeight: 1 }}
            aria-label="Vissza"
          >‹</button>
        </div>
        <div className="pghead-np sage" style={{ padding: '8px 0 14px' }}>
          <div>
            <div className="over">Fuel · Receptek</div>
            <h1>{name || (isEditMode ? '—' : 'Új recept')}</h1>
          </div>
        </div>

        {/* Név */}
        <div className="card" style={{ padding: '10px 12px', marginBottom: 9 }}>
          <span className="label-mono" style={{ fontSize: 8.5, letterSpacing: '0.12em', color: 'var(--text-tertiary)' }}>NÉV</span>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="pl. Tonhalsaláta · postworkout"
            aria-label="Recept neve"
            style={{ fontSize: 14, color: 'var(--text-primary)', marginTop: 4, width: '100%' }}
          />
        </div>

        {/* Slot + csillag */}
        <div className="card" style={{ padding: '10px 12px', marginBottom: 9 }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="label-mono" style={{ fontSize: 8.5, letterSpacing: '0.12em', color: 'var(--text-tertiary)' }}>SLOT</span>
            <button onClick={() => setStarred(s => !s)} className="chip" style={{ padding: '4px 8px', color: starred ? 'var(--warning)' : 'var(--text-tertiary)' }} aria-label="Csillag">
              <Icon name="bookmark" size={11} /> {starred ? 'Csillagos' : 'Csillag'}
            </button>
          </div>
          <div className="row gap-xs flex-wrap" style={{ marginTop: 8 }}>
            {SLOTS.map(s => (
              <button key={s.id} onClick={() => setSlot(s.id)} className={'chip' + (slot === s.id ? ' brand' : '')} style={{ fontSize: 9, padding: '6px 10px' }}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Adag & idő */}
        <div className="row gap-sm" style={{ marginBottom: 9 }}>
          <div className="card flex-1" style={{ padding: '10px 12px' }}>
            <span className="label-mono" style={{ fontSize: 8.5, letterSpacing: '0.12em', color: 'var(--text-tertiary)' }}>ADAG</span>
            <div style={{ marginTop: 6 }}><Stepper value={servings} unit="adag" min={1} onChange={setServings} /></div>
          </div>
          <div className="card flex-1" style={{ padding: '10px 12px' }}>
            <span className="label-mono" style={{ fontSize: 8.5, letterSpacing: '0.12em', color: 'var(--text-tertiary)' }}>ELŐ + FŐZÉS</span>
            <div style={{ marginTop: 6 }}><Stepper value={mins} unit="perc" min={0} onChange={setMins} /></div>
          </div>
        </div>

        {/* Live total */}
        <div className="rad-12" style={{ padding: '11px 12px', marginBottom: 12, background: 'color-mix(in srgb, var(--sage) 5%, transparent)', border: '1px solid var(--line)' }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span className="label-mono" style={{ fontSize: 9, letterSpacing: '0.14em', color: 'var(--coral)' }}>MAKRÓ-ÖSSZEG</span>
            <ServingToggle value={basis} servings={servings} onChange={setBasis} />
          </div>
          <MacroCells macros={shownTotal} size="md" />
          <div className="label-mono" style={{ textAlign: 'center', marginTop: 9, paddingTop: 8, borderTop: '1px solid var(--border-subtle)', fontSize: 8.5, color: 'var(--text-tertiary)' }}>
            {otherLabel} = <span style={{ color: 'var(--text-secondary)' }}>{otherTotal.kcal} kcal</span> · P {otherTotal.p} · C {otherTotal.c} · F {otherTotal.f}
          </div>
        </div>

        {/* Hozzávalók */}
        <div className="row" style={{ alignItems: 'center', gap: 9, margin: '4px 2px 10px' }}>
          <span className="label-mono" style={{ fontSize: 9.5, letterSpacing: '0.2em', color: 'var(--text-tertiary)' }}>HOZZÁVALÓK</span>
          <span className="label-mono" style={{ fontSize: 9.5, color: 'var(--coral)' }}>{lines.length}</span>
          <span style={{ flex: 1, height: 1, background: 'linear-gradient(90deg,var(--border-subtle),transparent)' }} />
        </div>

        <div className="col gap-sm" style={{ marginBottom: 3 }}>
          {lines.length === 0 && (
            <div className="card" style={{ padding: 14, textAlign: 'center', borderStyle: 'dashed' }}>
              <span className="text-tertiary" style={{ fontSize: 11 }}>Még nincs hozzávaló. Nyomd a Kamrából hozzáad gombot.</span>
            </div>
          )}
          {resolved.map(({ line, ing }, i) => (
            <div key={i} className="card" style={{ padding: '11px 12px', borderLeft: '2px solid ' + catColor(ing?.category) }}>
              <div className="row" style={{ alignItems: 'center', gap: 10 }}>
                <div className="col flex-1" style={{ minWidth: 0 }}>
                  <div className="row gap-xs" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{ing?.name ?? line.refId}</span>
                    {ing && ing.kind !== 'food' && (
                      <span className="label-mono" style={{ fontSize: 7.5, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '1px 4px', color: 'var(--text-tertiary)', border: '1px solid var(--border-subtle)', background: 'var(--surface-2)' }}>
                        {kindLabel(ing.kind)}
                      </span>
                    )}
                  </div>
                  {ing?.brand && <span className="label-mono" style={{ fontSize: 8, color: 'var(--text-tertiary)', marginTop: 2 }}>{ing.brand}</span>}
                </div>
                <div className="row" style={{ alignItems: 'center', background: 'var(--surface-2)', display: 'inline-flex' }}>
                  <button onClick={() => setLines(prev => prev.map((p, idx) => idx === i ? { ...p, amount: Math.max(0, p.amount - 10) } : p))} style={{ width: 25, height: 28, display: 'grid', placeItems: 'center', color: 'var(--coral)', fontSize: 14 }} aria-label={`${ing?.name ?? 'tétel'} csökkentés`}>−</button>
                  <AmountField value={line.amount} onChange={n => setLines(prev => prev.map((p, idx) => idx === i ? { ...p, amount: n } : p))} label={`${ing?.name ?? 'tétel'} mennyiség`} />
                  <button onClick={() => setLines(prev => prev.map((p, idx) => idx === i ? { ...p, amount: p.amount + 10 } : p))} style={{ width: 25, height: 28, display: 'grid', placeItems: 'center', color: 'var(--coral)', fontSize: 14 }} aria-label={`${ing?.name ?? 'tétel'} növelés`}>+</button>
                  <span className="label-mono" style={{ fontSize: 8, color: 'var(--text-tertiary)', padding: '0 6px 0 1px' }}>{line.unit}</span>
                </div>
                <button onClick={() => setLines(prev => prev.filter((_, idx) => idx !== i))} aria-label="Eltávolítás" style={{ padding: 3, color: 'var(--text-tertiary)', flexShrink: 0 }}>
                  <Icon name="x" size={12} />
                </button>
              </div>
              <div style={{ marginTop: 9 }}>
                <MacroCells macros={contributionOf(line, ing)} perLabel={`${line.amount} ${line.unit}`} />
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={() => setPickerOpen(true)}
          className="rad-12"
          style={{ width: '100%', padding: 11, marginTop: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontSize: 12, fontWeight: 600, color: 'var(--coral)', background: 'color-mix(in srgb, var(--sage) 8%, transparent)', border: '1px dashed var(--line)' }}
        >
          <Icon name="plus" size={14} /> Kamrából hozzáad
        </button>

        {/* Címkék */}
        <div className="row" style={{ alignItems: 'center', gap: 9, margin: '16px 2px 10px' }}>
          <span className="label-mono" style={{ fontSize: 9.5, letterSpacing: '0.2em', color: 'var(--text-tertiary)' }}>CÍMKÉK</span>
          <span style={{ flex: 1, height: 1, background: 'linear-gradient(90deg,var(--border-subtle),transparent)' }} />
        </div>
        <div className="row gap-xs flex-wrap" style={{ alignItems: 'center' }}>
          {tags.map(t => (
            <button key={t} onClick={() => setTags(prev => prev.filter(x => x !== t))} className="chip" style={{ fontSize: 10, padding: '6px 10px' }}>
              {t} <Icon name="x" size={9} />
            </button>
          ))}
          <input
            value={tagDraft}
            onChange={e => setTagDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
            placeholder="＋ címke"
            aria-label="Új címke"
            style={{ fontSize: 10, color: 'var(--text-tertiary)', padding: '6px 10px', border: '1px dashed var(--border-strong)', minWidth: 80 }}
          />
        </div>
      </div>

      {/* Save bar — portaled into the phone screen (like Sheet) so it pins to the
          device viewport just above the tab bar instead of scrolling with / floating
          over the recipe content, which used to clip the last rows (mezo-3vu4). */}
      {createPortal(
        <div className="recipe-save-bar">
          <button className="cta-ghost" onClick={() => navigate(-1)} style={{ flex: 1 }}>Mégse</button>
          <button className="cta-primary" disabled={!canSave} onClick={save} style={{ flex: 1.8 }}>
            <Icon name="check" size={15} /> Mentés
          </button>
        </div>,
        document.querySelector('.phone-screen') ?? document.body,
      )}

      {pickerOpen && (
        <IngredientPickerSheet
          onPick={addPicked}
          onClose={() => setPickerOpen(false)}
          addedRefIds={lines.map(l => l.refId)}
        />
      )}
    </>
  )
}

// Re-export the Recipe type usage to keep this file self-documenting for the
// editing path (no runtime effect).
export type { Recipe }

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
// Üveg U2 (mezo-me75u.2, prototypes/src/uveg-fuel-tobbi-body.html `editor()`): the Fuel sub-head
// (round glass ‹ + FUEL · RECEPTEK eyebrow + the typed name / "Új recept" as the h1), ONE sage
// glass form card (név, slot + csillag, szerep, adag/idő steppers — all flat inside), the live
// total as a lavender glass card (flat basis switch + four tinted stats), each picked line a
// glass card in its category hue, the kamra-add and the empty list dashed, flat tag chips, and
// the portaled save bar with a flat Mégse + a sage glass Mentés. Body/editor flows unchanged.
// ============================================================
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useParams } from 'react-router-dom'
import type { Ingredient, Recipe, RecipeCategory, RecipeInput, RecipeRole } from '@/data/types'
import { useRecipes, useRecipeActions } from '@/data/hooks'
import { Icon } from '@/shared/ui/Icon'
import { ContentIcon } from '@/shared/ui/clay'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { ROLE_OPTIONS } from '@/features/fuel/logic/recipeRole'
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
    kcal: round((ing.macros.kcal ?? 0) * factor),
    p: round((ing.macros.p ?? 0) * factor),
    c: round((ing.macros.c ?? 0) * factor),
    f: round((ing.macros.f ?? 0) * factor),
  }
}

function Stepper({ value, unit, onChange, min = 0 }: { value: number; unit: string; onChange: (v: number) => void; min?: number }) {
  return (
    <div className="fkx-step">
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} aria-label="Csökkentés">−</button>
      <b>{value}</b>
      <small>{unit}</small>
      <button type="button" onClick={() => onChange(value + 1)} aria-label="Növelés">+</button>
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
      className="fkx-amt"
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
  const [role, setRole] = useState<RecipeRole>(() => editing?.role ?? 'standard')
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
      <div className="fmx-page fkx-reditor">
        <div className="fmx-subhead">
          <button type="button" className="glass is-round" onClick={() => navigate(-1)} aria-label="Vissza">‹</button>
          <span><small>Fuel · Receptek</small></span>
        </div>
        <div className="fkx-notfound uv-empty">Nincs ilyen recept.</div>
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
      role,
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

  const catColor = (cat: string | null | undefined): string => (cat && categoryMeta[cat]?.color) || 'var(--success)'

  return (
    <div className="fmx-page fkx-reditor">
      <EntranceGroup>
        <div className="fmx-subhead rise">
          <button type="button" className="glass is-round" onClick={() => navigate(-1)} aria-label="Vissza">‹</button>
          <span>
            <small>Fuel · Receptek</small>
            <h1 className="fkx-title">{name || (isEditMode ? '—' : 'Új recept')}</h1>
          </span>
        </div>

        {/* EGY üveg űrlap-kártya (prototípus `.fcard`): minden mező lapos cella benne. */}
        <div className="fkx-fcard glass rise" style={{ '--c': 'var(--dv-sage)' } as React.CSSProperties}>
          <label className="fkx-field">
            <span>NÉV</span>
            <input
              className="fkx-inp"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="pl. Tonhalsaláta · postworkout"
              aria-label="Recept neve"
            />
          </label>

          <div className="fkx-field">
            <span>SLOT</span>
            <div className="fkx-chips">
              {SLOTS.map(sl => (
                <button key={sl.id} type="button" onClick={() => setSlot(sl.id)}
                  className={'fkx-chip' + (slot === sl.id ? ' is-on' : '')} aria-pressed={slot === sl.id}>
                  {sl.label}
                </button>
              ))}
              <button type="button" onClick={() => setStarred(v => !v)} aria-label="Csillag" aria-pressed={starred}
                className={'fkx-chip is-star' + (starred ? ' is-on' : '')}>
                <ContentIcon name="t-star" size={18} /> {starred ? 'Csillagos' : 'Csillag'}
              </button>
            </div>
          </div>

          {/* Szerep — the scoring rubric the template is judged under (mezo-uavr) */}
          <div className="fkx-field">
            <span>SZEREP</span>
            <div className="fkx-chips">
              {ROLE_OPTIONS.map(o => (
                <button key={o.id} type="button" onClick={() => setRole(o.id)}
                  className={'fkx-chip is-role' + (role === o.id ? ' is-on' : '')} aria-pressed={role === o.id}>
                  {o.label}
                </button>
              ))}
            </div>
            <p className="fkx-hint">
              A szerep dönti el, milyen mérce szerint pontozzuk: edzés körül a gyors szénhidrát üzemanyag, nem hiba.
            </p>
          </div>

          <div className="fkx-two">
            <div className="fkx-field">
              <span>ADAG</span>
              <Stepper value={servings} unit="adag" min={1} onChange={setServings} />
            </div>
            <div className="fkx-field">
              <span>ELŐ + FŐZÉS</span>
              <Stepper value={mins} unit="perc" min={0} onChange={setMins} />
            </div>
          </div>
        </div>

        {/* Élő összeg — levendula üveg, lapos bázis-váltóval és négy tintás számmal. */}
        <div className="fmx-section fmx-section-row fkx-sec"><h2>Makró-összeg</h2></div>
        <div className="fkx-fcard glass rise" style={{ '--c': 'var(--dv-lav)' } as React.CSSProperties}>
          <ServingToggle value={basis} servings={servings} onChange={setBasis} />
          <div className="fkx-stats">
            <div className="fkx-stat" style={{ '--c': 'var(--dv-amber)' } as React.CSSProperties}><b>{shownTotal.kcal}</b><small>kcal</small></div>
            <div className="fkx-stat" style={{ '--c': 'var(--macro-protein)' } as React.CSSProperties}><b>{shownTotal.p}</b><small>fehérje</small></div>
            <div className="fkx-stat" style={{ '--c': 'var(--macro-carbs)' } as React.CSSProperties}><b>{shownTotal.c}</b><small>szénhidrát</small></div>
            <div className="fkx-stat" style={{ '--c': 'var(--macro-fat)' } as React.CSSProperties}><b>{shownTotal.f}</b><small>zsír</small></div>
          </div>
          <p className="fkx-other">
            {otherLabel} = <b>{otherTotal.kcal} kcal</b> · P {otherTotal.p} · C {otherTotal.c} · F {otherTotal.f}
          </p>
        </div>

        {/* Hozzávalók */}
        <div className="fmx-section fmx-section-row fkx-sec"><h2>Hozzávalók</h2><small>{lines.length}</small></div>

        <div className="fkx-lines">
          {lines.length === 0 && (
            <div className="fkx-lines-empty uv-empty">
              Még nincs hozzávaló. Nyomd a Kamrából hozzáad gombot.
            </div>
          )}
          {resolved.map(({ line, ing }, i) => (
            <div key={i} className="fkx-lcard glass" style={{ '--c': catColor(ing?.category) } as React.CSSProperties}>
              <div className="fkx-lcard-top">
                <span className="fkx-lcard-name">
                  <strong>{ing?.name ?? line.refId}</strong>
                  {ing && ing.kind !== 'food' && <span className="fkx-tagf">{kindLabel(ing.kind)}</span>}
                  {ing?.brand && <small>{ing.brand}</small>}
                </span>
                <button type="button" className="fkx-x" onClick={() => setLines(prev => prev.filter((_, idx) => idx !== i))} aria-label="Eltávolítás">
                  <Icon name="x" size={12} />
                </button>
              </div>
              <div className="fkx-step is-amount">
                <button type="button" onClick={() => setLines(prev => prev.map((p, idx) => idx === i ? { ...p, amount: Math.max(0, p.amount - 10) } : p))} aria-label={`${ing?.name ?? 'tétel'} csökkentés`}>−</button>
                <AmountField value={line.amount} onChange={n => setLines(prev => prev.map((p, idx) => idx === i ? { ...p, amount: n } : p))} label={`${ing?.name ?? 'tétel'} mennyiség`} />
                <small>{line.unit}</small>
                <button type="button" onClick={() => setLines(prev => prev.map((p, idx) => idx === i ? { ...p, amount: p.amount + 10 } : p))} aria-label={`${ing?.name ?? 'tétel'} növelés`}>+</button>
              </div>
              <div className="fkx-lcard-macros">
                <MacroCells macros={contributionOf(line, ing)} perLabel={`${line.amount} ${line.unit}`} />
              </div>
            </div>
          ))}

          <button type="button" onClick={() => setPickerOpen(true)} className="fkx-addline uv-empty">
            <ContentIcon name="t-stack" size={24} /> ＋ Kamrából hozzáad
          </button>
        </div>

        {/* Címkék */}
        <div className="fmx-section fmx-section-row fkx-sec"><h2>Címkék</h2></div>
        <div className="fkx-chips fkx-tags">
          {tags.map(t => (
            <button key={t} type="button" onClick={() => setTags(prev => prev.filter(x => x !== t))} className="fkx-chip">
              {t} <Icon name="x" size={9} />
            </button>
          ))}
          <input
            className="fkx-chip is-input"
            value={tagDraft}
            onChange={e => setTagDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
            placeholder="＋ címke"
            aria-label="Új címke"
          />
        </div>
        <div style={{ height: 96 }} />
      </EntranceGroup>

      {/* Save bar — portaled into the phone screen (like Sheet) so it pins to the
          device viewport just above the tab bar instead of scrolling with / floating
          over the recipe content, which used to clip the last rows (mezo-3vu4). */}
      {createPortal(
        <div className="recipe-save-bar fkx-savebar">
          <button type="button" className="fkx-btn is-flat" onClick={() => navigate(-1)}>Mégse</button>
          <button type="button" className="fkx-btn glass" style={{ '--c': 'var(--dv-sage)' } as React.CSSProperties} disabled={!canSave} onClick={save}>
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
    </div>
  )
}

// Re-export the Recipe type usage to keep this file self-documenting for the
// editing path (no runtime effect).
export type { Recipe }

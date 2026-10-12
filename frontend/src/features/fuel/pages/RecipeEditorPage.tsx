// ============================================================
// Mezo · RecipeEditorPage (Receptek — create = edit PAGE)
// The manual editor: név, étkezés (the four meals) + the star as its own toggle, szerep, adag +
// elő/főzési idő (steppers), hozzávalók (picked lines with a typeable amount, ±10 and remove; the
// contribution follows live), címkék. The hero is the live total with the adag ↔ egész switch.
// Mentés → useRecipeActions.create/update, then leave (`useLeaveAfterMutation`); no message after
// saving (the live page never had one). The picker opens as a sheet and stays open (multi-add).
//
// Contribution = round(macro * amount/per) — the SAME amount/per rule as the
// backend mapper and the mock hook.
//
// Folyadék (mezo-n4wf5.5, fuel.js `editor()`): the hero is the pot (its level = one serving's
// share, full on „egész", empty with the dashed line while there is no ingredient) beside the
// kcal and the three macro levels; 1 Alapok, 2 Hozzávalók · n (the Fuel-shared `EditLine`),
// 3 Címkék; the floating foot carries Mégse + Mentés. Words in `fuelRecept.editor`.
// ============================================================
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLeaveAfterMutation } from '@/shared/hooks/useBackNav'
import type { Ingredient, Recipe, RecipeCategory, RecipeInput, RecipeRole } from '@/data/types'
import { useRecipes, useRecipeActions } from '@/data/hooks'
import { useM } from '@/shared/i18n'
import { fmtGrouped } from '@/shared/lib/format'
import {
  Acts, Btn, Bub, Card, Empty, FrameBack, Hero, Input, Lab, Note, Page, Pill, Pills, Section, Stepper, TwoBtn, useFrameTitle,
} from '@/shared/ui/folyadek'
import { EditLine, LineTags, M3, NumG, Pot } from '@/features/fuel/components/folyadek'
import { ROLE_OPTIONS } from '@/features/fuel/logic/recipeRole'
import { recipeSlotFace } from '@/features/fuel/logic/recipeSlotFace'
import { ServingToggle, type ServingBasis } from '@/features/fuel/components/ServingToggle'
import { useAmountText } from '@/features/fuel/components/workshop/WorkshopIngredientRow'
import { ingredientStyle } from '@/features/fuel/components/FuelQualityBlocks'
import { IngredientPickerSheet } from '@/features/fuel/sheets/IngredientPickerSheet'
import { usePickableIngredients } from '@/data/fuel/pantryPickables'

interface DraftLine { refId: string; amount: number; unit: string; note?: string }

const SLOTS: RecipeCategory[] = ['breakfast', 'lunch', 'dinner', 'snack']

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

const STEP = 10

/** One picked line: the Fuel-shared `EditLine`, with the amount's text state held here. */
function LineCard({ line, ing, onAmount, onRemove }: {
  line: DraftLine; ing: Ingredient | undefined; onAmount: (n: number) => void; onRemove: () => void
}) {
  const M = useM()
  const amount = useAmountText(line.amount, onAmount)
  const name = ing?.name ?? line.refId
  const c = contributionOf(line, ing)
  return (
    <EditLine
      icon={ingredientStyle(name).icon}
      name={name}
      tags={<LineTags extra={[ing && ing.kind !== 'food' ? M.fuelRecept.common.kind[ing.kind] : null, ing?.brand]} />}
      onRemove={onRemove}
      amount={amount}
      unit={line.unit}
      onDec={() => onAmount(Math.max(0, line.amount - STEP))}
      onInc={() => onAmount(line.amount + STEP)}
      kcal={c.kcal}
      macros={c}
    />
  )
}

export function RecipeEditorPage() {
  const M = useM()
  const C = M.fuelRecept.common
  const E = M.fuelRecept.editor
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const leave = useLeaveAfterMutation()
  const { recipes } = useRecipes()
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

  useFrameTitle({ title: isEditMode && !editing ? C.noSuchRecipeTitle : name || (isEditMode ? '—' : E.newRecipe), eyebrow: C.fuelRecipes })
  const back = <FrameBack history className="fo-backpill" onBack={() => navigate(-1)}>‹</FrameBack>

  // Edit-mode deep link with no matching recipe → not-found. The DATA section exposes
  // no raw query status, so we rely on useRecipes().recipes: synchronous in mock (via
  // initialData); in real mode a cold hard-reload may show this briefly until the list resolves.
  if (isEditMode && !editing) {
    return (
      <Page className="fc-page">
        {back}
        <Card>
          <Empty icon="t-book" actions={<Btn sm onClick={() => navigate('/fuel/recipes')}>{C.backToRecipes}</Btn>}>
            {E.notFound}
          </Empty>
        </Card>
      </Page>
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
      // the editor is only ever opened from this recipe's page: pop back onto it
      leave.back(`/fuel/recipes/${editing.id}`)
    } else {
      create(input)
      leave.to('/fuel/recipes')
    }
  }

  const has = lines.length > 0
  const whole = basis === 'whole'
  const setLineAmount = (i: number, n: number) => setLines(prev => prev.map((p, idx) => (idx === i ? { ...p, amount: n } : p)))

  return (
    <Page className="fc-page"
      foot={(
        <>
          <Btn ghost onClick={() => navigate(-1)}>{E.cancel}</Btn>
          <Btn grow disabled={!canSave} onClick={save}>{E.save}</Btn>
        </>
      )}>
      {back}
      <Hero className="fc-ghero"
        label={whole ? E.heroWhole : E.heroServing}
        verdict={!has ? E.verdictEmpty : servings === 1 ? E.verdictSingle : whole ? E.verdictWhole(servings) : E.verdictShare(servings)}
        sub={!has ? E.subEmpty : E.subOther(!whole, fmtGrouped(otherTotal.kcal), otherTotal.p, otherTotal.c, otherTotal.f)}
      >
        <NumG graphic={<Pot pct={has ? (whole ? 100 : 100 / Math.max(1, servings)) : 0} size={96} />}
          value={has ? fmtGrouped(shownTotal.kcal) : '0'} unit={whole ? C.kcalWhole : C.kcalPerServing}>
          <M3 p={shownTotal.p} c={shownTotal.c} f={shownTotal.f} />
        </NumG>
        {has && <div className="fc-basis"><ServingToggle value={basis} servings={servings} onChange={setBasis} /></div>}
      </Hero>

      <Section n={1} title={E.basics} />
      <Card>
        <Lab htmlFor="recipe-name">{E.name}</Lab>
        <Input id="recipe-name" value={name} onChange={e => setName(e.target.value)}
          placeholder={E.namePlaceholder} aria-label={E.nameAria} />

        <Lab id="recipe-meal">{E.meal}</Lab>
        <div className="fc-pk2">
          <Pills role="group" aria-labelledby="recipe-meal">
            {SLOTS.map(id => (
              <Pill key={id} on={slot === id} onClick={() => setSlot(id)}>{recipeSlotFace(id).label}</Pill>
            ))}
          </Pills>
          <Pill className="fc-star" on={starred} onClick={() => setStarred(v => !v)} aria-label={E.star}>
            <Bub icon="t-star" size={24} />{starred ? E.starred : E.star}
          </Pill>
        </div>

        {/* Szerep — the scoring rubric the template is judged under (mezo-uavr) */}
        <Lab id="recipe-role">{E.role}</Lab>
        <Pills role="group" aria-labelledby="recipe-role">
          {ROLE_OPTIONS.map(o => (
            <Pill key={o.id} on={role === o.id} onClick={() => setRole(o.id)}>{o.label}</Pill>
          ))}
        </Pills>
        <Note>{E.roleNote}</Note>

        <TwoBtn className="fc-ws">
          <div>
            <Lab>{C.servingsName}</Lab>
            <Stepper className="fc-stp" name={C.servingsName} n={servings} min={1}
              value={<>{servings}<small>{C.servingUnit(servings)}</small></>}
              onDec={() => setServings(Math.max(1, servings - 1))} onInc={() => setServings(servings + 1)} />
          </div>
          <div>
            <Lab>{E.prepCook}</Lab>
            <Stepper className="fc-stp" name={E.time} n={mins} min={0}
              value={<>{mins}<small>{C.minuteUnit}</small></>}
              onDec={() => setMins(Math.max(0, mins - 1))} onInc={() => setMins(mins + 1)} />
          </div>
        </TwoBtn>
      </Card>

      <Section n={2} title={C.ingredientsTitle(lines.length)} />
      <Card className="fc-lns">
        {has ? resolved.map(({ line, ing }, i) => (
          <LineCard key={i} line={line} ing={ing}
            onAmount={n => setLineAmount(i, n)}
            onRemove={() => setLines(prev => prev.filter((_, idx) => idx !== i))} />
        )) : (
          <Empty icon="t-stack">{E.linesEmpty}</Empty>
        )}
        <Acts><Btn sm ghost onClick={() => setPickerOpen(true)}>{E.addFromPantry}</Btn></Acts>
      </Card>

      <Section n={3} title={E.tags} />
      <Card>
        <Pills>
          {tags.map(t => (
            <Pill key={t} className="fc-tagp" onClick={() => setTags(prev => prev.filter(x => x !== t))} aria-label={E.tagRemove(t)}>
              {t} <span aria-hidden="true">×</span>
            </Pill>
          ))}
          <Input
            className="fc-tag"
            value={tagDraft}
            onChange={e => setTagDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
            placeholder={E.tagPlaceholder}
            aria-label={E.tagAria}
          />
        </Pills>
      </Card>

      {pickerOpen && (
        <IngredientPickerSheet
          onPick={addPicked}
          onClose={() => setPickerOpen(false)}
          addedRefIds={lines.map(l => l.refId)}
        />
      )}
    </Page>
  )
}

// Re-export the Recipe type usage to keep this file self-documenting for the
// editing path (no runtime effect).
export type { Recipe }

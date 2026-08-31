// ============================================================
// Mezo · MealComposer — the unified meal-editing surface (mezo-byo1)
// Extracted verbatim from LogFlowPage (mezo-d20.4.2) so ONE composer can serve
// every logging surface: the /fuel/log window blocks mount it IN PLACE (expand-
// in-block, `fixedSlot` = the window's own slotKey per mezo-bnsf), while the
// LogFlowPage overlay wrapper keeps serving the other entry points (Kamra/Recipe
// detail, Életjel, NapRutin) unchanged.
//
// Anatomy: MIKOR slot segments (hidden entirely under `fixedSlot` — the window IS
// the slot), derived-until-touched meal name, three colorful source tiles — 🫙
// Kamra (gold, grams, KamraPickSheet stays open for multi-add) · 🥄 Recept
// (coral, servings, ReceptPickSheet closes on pick) · ✨ AI (lavender inline
// panel, textarea and/or photo) — AI-recognized lines land BECSLÉS-tagged next to
// the manual ones. Every line's amount is a typeable input with ± steppers (the
// AmountField guard), per-line macros + the totals card recompute live, recipe
// lines carry the mezo-ormb ingredient fine-tuning block. CTA "✓ Logolás · +10 XP"
// → useMealActions().logMeal, then `onSaved`.
//
// provenance.origin: reflects whether AI genuinely contributed to THIS save
// (ai-photo when a photo was analyzed this session, else ai-text), regardless of
// how many manual lines ride alongside; a purely manual meal omits provenance —
// the LogFlowPage rule, kept verbatim (see that file's original header note).
// ============================================================
import { useEffect, useRef, useState } from 'react'
import type { Ingredient, MealInput, MealItemInput, MealSlot, Recipe } from '@/data/types'
import { useFuelDay, useMealActions, useRecipes, usePantry } from '@/data/hooks'
import { pct } from '@/shared/lib/pct'
import { nowOffsetIso, offsetIso, localDateString } from '@/shared/lib/dates'
import { resizeImage } from '@/shared/lib/resizeImage'
import { Icon } from '@/shared/ui/Icon'
import { ClayIcon } from '@/shared/ui/clay'
import { MCells } from '@/shared/ui/mozaik'
import { NutrientCells } from '@/features/fuel/components/NutrientCells'
import { KamraPickSheet } from '@/features/fuel/sheets/KamraPickSheet'
import { ReceptPickSheet } from '@/features/fuel/sheets/ReceptPickSheet'
import { deriveMealName } from '@/features/fuel/logic/deriveMealName'
import { defaultMealSlot } from '@/features/fuel/logic/defaultMealSlot'
import { parseAmountInput, stepAmount } from '@/features/fuel/logic/amountGuard'
import {
  computeRecipeNutrients, computeRecipeMacrosWithOverrides, computeRecipeNutrientsWithOverrides,
  rescaleFrozen, lineNutrients, scaleNutrients, sumNutrients, NO_NUTRIENTS, factsOf,
} from '@/data/fuel/recipeMacros'
import { RecipeOverrideRow } from '@/features/fuel/components/RecipeOverrideRow'

export type MealComposerPrefill =
  | { source: 'recipe'; recipeId: string }
  | { source: 'pantry'; pantryItemId: string }
  | null

const SLOTS: { id: MealSlot; label: string }[] = [
  { id: 'breakfast', label: 'Reggeli' },
  { id: 'lunch', label: 'Ebéd' },
  { id: 'dinner', label: 'Vacsora' },
  { id: 'snack', label: 'Snack' },
]

const round = (n: number) => Math.round(n)
const zero = { kcal: 0, p: 0, c: 0, f: 0 }

/** Múltbeli napi mentés idő-komponense, ha az indító nem hoz sajátot (szabad blokk). */
const SLOT_DEFAULT_TIME: Record<MealSlot, string> = {
  breakfast: '08:00', lunch: '13:00', dinner: '19:00', snack: '16:00',
}

interface EstimateSnapshot {
  per: number; basisUnit: string
  kcal: number; proteinG: number; carbsG: number; fatG: number; nova: number | null
}
interface DraftLine {
  key: string
  source: 'recipe' | 'pantry' | 'estimate'
  refId?: string
  name: string
  amount: number
  unit: string
  /** true when this line came out of the AI panel — always shown tagged BECSLÉS regardless of
   *  the underlying matched source (design 2.0 iterations §7's deliberate simplification). */
  fromAi?: boolean
  needsReview?: boolean
  estimate?: EstimateSnapshot
  /** recipe arm only - ingredient array index -> amount, in the recipe's own unit (mezo-ormb). */
  overrides?: Record<number, number>
}

function lineMeta(l: DraftLine, recipes: Recipe[], ingredients: Ingredient[]) {
  const tag = l.fromAi ? 'becslés' : l.source === 'recipe' ? 'recept' : 'kamra'
  if (l.source === 'estimate') {
    const est = l.estimate!
    const per = est.per || 1
    const factor = l.amount / per
    return {
      name: l.name, tag, step: 10, min: 1,
      contribution: {
        kcal: round(est.kcal * factor), p: round(est.proteinG * factor),
        c: round(est.carbsG * factor), f: round(est.fatG * factor),
      },
      nutrients: NO_NUTRIENTS,
    }
  }
  if (l.source === 'recipe') {
    const r = recipes.find(x => x.id === l.refId)
    const s = Math.max(1, r?.servings ?? 1)
    const factor = l.amount
    const touched = !!r && !!l.overrides && Object.keys(l.overrides).length > 0
    // With overrides the whole-recipe rollup is re-rolled from the substituted amounts, then
    // / servings * adag - the SAME order as the backend (round per line, divide unrounded, round
    // once at the end). Without overrides this stays bit-identical to the un-overridden path.
    const whole = touched
      ? computeRecipeMacrosWithOverrides(r!.ingredients, ingredients, l.overrides!)
      : (r?.macros ?? zero)
    const wholeNutrients = touched
      ? computeRecipeNutrientsWithOverrides(r!.ingredients, ingredients, l.overrides!)
      : (r ? computeRecipeNutrients(r.ingredients) : NO_NUTRIENTS)
    return {
      name: l.fromAi ? l.name : (r?.name ?? l.name), tag, step: 1, min: 1,
      contribution: {
        kcal: round(whole.kcal / s * factor), p: round(whole.p / s * factor),
        c: round(whole.c / s * factor), f: round(whole.f / s * factor),
      },
      nutrients: scaleNutrients(wholeNutrients, factor / s),
    }
  }
  const ing = ingredients.find(x => x.id === l.refId)
  const per = ing?.per || 1
  const factor = l.amount / per
  return {
    name: l.fromAi ? l.name : (ing?.name ?? l.name), tag, step: 10, min: 1,
    contribution: {
      kcal: round((ing?.macros.kcal ?? 0) * factor), p: round((ing?.macros.p ?? 0) * factor),
      c: round((ing?.macros.c ?? 0) * factor), f: round((ing?.macros.f ?? 0) * factor),
    },
    nutrients: lineNutrients(l.amount, per, factsOf(ing)),
  }
}

export interface MealComposerProps {
  /** Fixed slot (a window-block launch, mezo-bnsf): the MIKOR segmented control is
   *  HIDDEN and every save uses this slot — the window IS the slot. */
  fixedSlot?: MealSlot
  /** Initial slot for the visible segmented control (overlay/free-block launches). */
  initialSlot?: MealSlot
  prefill?: MealComposerPrefill
  /** Opens the ✨ AI panel expanded on mount (the per-window "AI" action, mezo-53su). */
  aiPanelOpenOnMount?: boolean
  /** Melyik napra könyvelődik a mentés (ISO local date). Absent = ma (nowOffsetIso, byte-azonos). */
  logDate?: string
  /** A loggedAt idő-komponense HH:mm (ablak-indítás: az ablak ideje). Absent = slot-alap idő. */
  logTime?: string
  /** A mentés-CTA felirata (múltbeli nap). Absent = a meglévő felirat. */
  saveLabel?: string
  onSaved: () => void
  onCancel: () => void
}

export function MealComposer({ fixedSlot, initialSlot, prefill, aiPanelOpenOnMount, logDate, logTime, saveLabel, onSaved, onCancel }: MealComposerProps) {
  const { recipes } = useRecipes()
  const { ingredients } = usePantry()
  const { fuel } = useFuelDay(logDate)
  const { logMeal, draftMealFromAi } = useMealActions(logDate)

  const [slot, setSlot] = useState<MealSlot>(() => fixedSlot ?? initialSlot ?? defaultMealSlot())
  // A slot-targeted launch keeps its slot even once an AI draft proposes a different one
  // (mezo-53su); manual taps lock it too.
  const slotLocked = useRef(fixedSlot != null || initialSlot != null)
  const [kamraOpen, setKamraOpen] = useState(false)
  const [receptOpen, setReceptOpen] = useState(false)
  const [aiOpen, setAiOpen] = useState(!!aiPanelOpenOnMount)
  const [aiBusy, setAiBusy] = useState(false)
  const [aiText, setAiText] = useState('')
  const [aiPhoto, setAiPhoto] = useState<File | null>(null)
  const [aiError, setAiError] = useState<string | null>(null)
  // What actually landed in the meal FROM the AI this session — the honest input to
  // provenance.origin (see the file-header note).
  const [aiContribution, setAiContribution] = useState<{ photo: boolean; rawText: string | null } | null>(null)
  /** Which recipe lines have their ingredient fine-tuning block expanded. */
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const [lines, setLines] = useState<DraftLine[]>(() => {
    if (!prefill) return []
    if (prefill.source === 'recipe') {
      return [{ key: 'pf', source: 'recipe', refId: prefill.recipeId, name: '', amount: 1, unit: 'adag' }]
    }
    const ing = ingredients.find(i => i.id === prefill.pantryItemId)
    return [{ key: 'pf', source: 'pantry', refId: prefill.pantryItemId, name: '', amount: ing?.per || 100, unit: ing?.unit || 'g' }]
  })

  // STATE, not a ref (mezo-d20.9.1): the object URL is minted in an effect, so a ref would be
  // filled AFTER the render that attached the photo and the thumbnail would never paint.
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!aiPhoto) { setPhotoUrl(null); return }
    const url = URL.createObjectURL(aiPhoto)
    setPhotoUrl(url)
    return () => { URL.revokeObjectURL(url) }
  }, [aiPhoto])

  const resolved = lines.map(l => ({ l, meta: lineMeta(l, recipes, ingredients) }))
  const total = resolved.reduce((a, { meta }) => ({
    kcal: a.kcal + meta.contribution.kcal, p: a.p + meta.contribution.p,
    c: a.c + meta.contribution.c, f: a.f + meta.contribution.f,
  }), { ...zero })
  const totalNutrients = sumNutrients(resolved.map(({ meta }) => meta.nutrients))

  // No name field any more (mezo-byo1): the meal is always named from its lines —
  // deriveMealName is the same rule buildDayPlan falls back to, so one rule holds everywhere.
  const derivedName = deriveMealName(resolved.map(({ meta }) => meta.name))

  const nowPct = pct(fuel.consumed.kcal, fuel.targets.kcal)
  const addPct = Math.min(100 - nowPct, pct(total.kcal, fuel.targets.kcal))
  const after = fuel.consumed.kcal + total.kcal

  const selectSlot = (s: MealSlot) => { slotLocked.current = true; setSlot(s) }

  const addPantry = (ing: Ingredient) => {
    setLines(prev => [...prev, { key: crypto.randomUUID(), source: 'pantry', refId: ing.id, name: ing.name, amount: ing.per || 100, unit: ing.unit || 'g' }])
  }
  const addRecipe = (r: Recipe) => {
    setLines(prev => [...prev, { key: crypto.randomUUID(), source: 'recipe', refId: r.id, name: r.name, amount: 1, unit: 'adag' }])
    setReceptOpen(false)
  }
  const removeLine = (key: string) => setLines(prev => prev.filter(l => l.key !== key))
  // --- recipe ingredient overrides (mezo-ormb) --------
  // Record only a GENUINE delta: stepping back to the recipe's own amount removes the key, so the
  // "N MODOSITVA" count and Alaphelyzet don't linger on an untouched line.
  const setOverride = (key: string, index: number, amount: number) =>
    setLines(prev => prev.map(p => {
      if (p.key !== key) return p
      const original = recipes.find(r => r.id === p.refId)?.ingredients[index]?.amount
      const next = { ...p.overrides }
      if (original !== undefined && amount === original) delete next[index]
      else next[index] = amount
      return { ...p, overrides: next }
    }))
  const clearOverride = (key: string, index: number) =>
    setLines(prev => prev.map(p => {
      if (p.key !== key) return p
      const next = { ...p.overrides }
      delete next[index]
      return { ...p, overrides: next }
    }))
  const resetOverrides = (key: string) =>
    setLines(prev => prev.map(p => p.key === key ? { ...p, overrides: undefined } : p))
  const bump = (key: string, delta: number, step: number, min: number) =>
    setLines(prev => prev.map(l => l.key === key ? { ...l, amount: stepAmount(l.amount, delta * step, min) } : l))
  const setAmount = (key: string, raw: string) =>
    setLines(prev => prev.map(l => l.key === key ? { ...l, amount: parseAmountInput(raw, l.amount) } : l))

  const canRunAi = aiText.trim().length > 0 || aiPhoto != null
  const runAi = async () => {
    if (!canRunAi) return
    setAiBusy(true)
    setAiError(null)
    try {
      const blob = aiPhoto ? await resizeImage(aiPhoto) : undefined
      const draft = await draftMealFromAi({ date: localDateString(), text: aiText.trim() || undefined, photo: blob })
      const newLines: DraftLine[] = draft.items.map((it): DraftLine => {
        const key = crypto.randomUUID()
        if (it.source === 'estimate') {
          return {
            key, source: 'estimate', name: it.name, amount: it.amount, unit: it.unit,
            fromAi: true, needsReview: it.needsReview,
            estimate: { per: it.per, basisUnit: it.basisUnit, kcal: it.kcal, proteinG: it.proteinG, carbsG: it.carbsG, fatG: it.fatG, nova: it.nova },
          }
        }
        if (it.source === 'pantry') {
          return { key, source: 'pantry', refId: it.pantryItemId ?? undefined, name: it.name, amount: it.amount, unit: it.unit, fromAi: true, needsReview: it.needsReview }
        }
        return { key, source: 'recipe', refId: it.recipeId ?? undefined, name: it.name, amount: it.amount, unit: it.unit, fromAi: true, needsReview: it.needsReview }
      })
      setLines(prev => [...prev, ...newLines])
      if (!slotLocked.current) setSlot(draft.slot)
      setAiContribution({ photo: !!aiPhoto, rawText: aiText.trim() || null })
      setAiText('')
      setAiPhoto(null)
      setAiOpen(false)
    } catch {
      setAiError('Nem sikerült az AI-feldolgozás. Próbáld újra, vagy add hozzá kézzel.')
    } finally {
      setAiBusy(false)
    }
  }

  const canSave = lines.length > 0
  const save = () => {
    if (!canSave) return
    const items: MealItemInput[] = lines.map((l): MealItemInput => {
      if (l.source === 'estimate') {
        const est = l.estimate!
        return { source: 'estimate', name: l.name, amount: l.amount, unit: l.unit, per: est.per, basisUnit: est.basisUnit, kcal: est.kcal, proteinG: est.proteinG, carbsG: est.carbsG, fatG: est.fatG, nova: est.nova }
      }
      const recipe = l.source === 'recipe' ? recipes.find(r => r.id === l.refId) : undefined
      // A concurrent recipe edit (useRecipes refetches on window focus) can shrink `ingredients`
      // while the flow is open, leaving a stale override index with no ingredient behind it -
      // dropping any entry that can't resolve keeps that a no-op instead of a crash on save.
      const entries = Object.entries(l.overrides ?? {}).flatMap(([i, v]) => {
        const original = recipe?.ingredients[Number(i)]
        if (!original || v === original.amount) return []
        return [{ lineOrder: Number(i), pantryItemId: original.refId, amount: v }]
      })
      return {
        source: l.source, refId: l.refId!, amount: l.amount, unit: l.unit,
        // only genuinely-changed lines ride along; an untouched recipe keeps today's exact body
        ...(l.source === 'recipe' && entries.length ? { ingredientOverrides: entries } : {}),
      }
    })
    const input: MealInput = {
      slot: fixedSlot ?? slot,
      loggedAt: logDate != null
        ? offsetIso(logDate, logTime ?? SLOT_DEFAULT_TIME[fixedSlot ?? slot])
        : nowOffsetIso(),
      title: derivedName.trim() || null,
      items,
      ...(aiContribution
        ? { provenance: { origin: aiContribution.photo ? 'ai-photo' : 'ai-text', rawText: aiContribution.rawText } }
        : {}),
    }
    logMeal(input)
    onSaved()
  }

  const addedPantryIds = lines.filter(l => l.source === 'pantry' && l.refId).map(l => l.refId!)

  return (
    <div className="logflow-composer">
      {fixedSlot == null && (
        <>
          <span className="label-mono" style={{ fontSize: 8.5, letterSpacing: '0.12em', color: 'var(--text-tertiary)' }}>MIKOR</span>
          <div className="row gap-xs" style={{ margin: '7px 0 10px', padding: 5, background: 'var(--surface-1)', border: '1px solid var(--border-subtle)' }}>
            {SLOTS.map(s => (
              <button key={s.id} onClick={() => selectSlot(s.id)} aria-label={s.label} aria-pressed={slot === s.id}
                className={'chip flex-1' + (slot === s.id ? ' brand' : '')}
                style={{ justifyContent: 'center', padding: '8px 0', fontSize: 11, textTransform: 'uppercase' }}>
                {s.label}
              </button>
            ))}
          </div>
        </>
      )}

      <span className="label-mono" style={{ fontSize: 8.5, letterSpacing: '0.12em', color: 'var(--text-tertiary)' }}>HONNAN ADOD HOZZÁ?</span>
      <div className="logflow-srctiles">
        <button type="button" className="logflow-srct tone-gold" onClick={() => setKamraOpen(true)} aria-label="Kamra · hozzáadás">
          <ClayIcon name="i-kamra" size={26} />
          <b>Kamra</b><small>polcról, grammra</small>
        </button>
        <button type="button" className="logflow-srct tone-coral" onClick={() => setReceptOpen(true)} aria-label="Recept · hozzáadás">
          <ClayIcon name="i-recept" size={26} />
          <b>Recept</b><small>adagra</small>
        </button>
        <button type="button" className={'logflow-srct tone-lav' + (aiOpen ? ' on' : '')} onClick={() => setAiOpen(o => !o)} aria-label="✨ AI · fotó vagy szöveg" aria-pressed={aiOpen}>
          <Icon name="sparkle" size={22} color="var(--lav-deep)" />
          <b>✨ AI</b><small>fotó vagy szöveg</small>
        </button>
      </div>

      {aiBusy && (
        <div className="logflow-aipanel logflow-aibusy">
          <span className="np-twinkle" aria-hidden="true" />
          Elemzem az étkezést…
        </div>
      )}
      {aiOpen && !aiBusy && (
        <div className="logflow-aipanel">
          <textarea
            value={aiText} onChange={(e) => setAiText(e.target.value)}
            aria-label="Mit ettél?" placeholder="pl. csirkés wrap és egy latte…" rows={2}
          />
          <div className="row gap-xs" style={{ alignItems: 'center', marginTop: 7 }}>
            {aiPhoto ? (
              <span className="row gap-xs" style={{ alignItems: 'center', fontSize: 11, color: 'var(--lav-deep)' }}>
                {photoUrl && <img src={photoUrl} alt="Fotó előnézet" style={{ width: 26, height: 26, objectFit: 'cover', borderRadius: 8 }} />}
                {aiPhoto.name}
                <button type="button" aria-label="Fotó eltávolítása" onClick={() => setAiPhoto(null)} style={{ padding: 2, color: 'var(--text-tertiary)' }}>
                  <Icon name="x" size={11} />
                </button>
              </span>
            ) : (
              <label className="chip" style={{ cursor: 'pointer', fontSize: 11, padding: '6px 12px' }}>
                📷 Fotó
                <input type="file" accept="image/*" capture="environment" aria-label="Étel fotó"
                  onChange={(e) => setAiPhoto(e.target.files?.[0] ?? null)} style={{ display: 'none' }} />
              </label>
            )}
            <button type="button" className="cta-primary" style={{ marginLeft: 'auto', padding: '6px 16px' }}
              disabled={!canRunAi} onClick={() => void runAi()}>
              ✨ Elemzés
            </button>
          </div>
          {aiError && <p style={{ fontSize: 11, color: 'var(--error)', marginTop: 8 }}>{aiError}</p>}
          <p className="text-secondary" style={{ fontSize: 9.5, lineHeight: 1.5, marginTop: 8 }}>
            Szöveg vagy fotó — vagy mindkettő. A felismert sorok a tételek közé kerülnek, ott mindent átírhatsz.
          </p>
        </div>
      )}

      <div className="row" style={{ alignItems: 'center', gap: 9, margin: '14px 2px 9px' }}>
        <span className="label-mono" style={{ fontSize: 9.5, letterSpacing: '0.2em', color: 'var(--text-tertiary)' }}>TÉTELEK</span>
        <span className="label-mono" style={{ fontSize: 9.5, color: 'var(--coral)' }}>{lines.length}</span>
        <span style={{ flex: 1, height: 1, background: 'linear-gradient(90deg,var(--border-subtle),transparent)' }} />
      </div>

      {lines.length === 0 && (
        <div className="card" style={{ padding: 14, textAlign: 'center', borderStyle: 'dashed' }}>
          <span className="text-tertiary" style={{ fontSize: 11 }}>Még nincs tétel — válassz forrást fent, vagy kombináld őket.</span>
        </div>
      )}

      <div className="col gap-sm">
        {resolved.map(({ l, meta }) => (
          <div key={l.key} className="logflow-lncard" data-tag={meta.tag}>
            <div className="row" style={{ alignItems: 'center', gap: 9 }}>
              <div className="row gap-xs flex-1" style={{ minWidth: 0, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{meta.name}</span>
                <span className="logflow-lntag" data-tag={meta.tag}>{meta.tag}</span>
              </div>
              <button onClick={() => removeLine(l.key)} aria-label={`${meta.name} eltávolítása`} style={{ padding: 3, color: 'var(--text-tertiary)', flexShrink: 0 }}>
                <Icon name="x" size={12} />
              </button>
            </div>
            <div className="row" style={{ alignItems: 'center', gap: 6, marginTop: 8 }}>
              <button onClick={() => bump(l.key, -1, meta.step, meta.min)} aria-label={`${meta.name} csökkentés`} className="logflow-stepbtn">−</button>
              <input
                type="text" inputMode="decimal" value={l.amount}
                onChange={(e) => setAmount(l.key, e.target.value)}
                aria-label={`${meta.name} mennyisége`}
                className="logflow-amtinput"
              />
              <button onClick={() => bump(l.key, 1, meta.step, meta.min)} aria-label={`${meta.name} növelés`} className="logflow-stepbtn">+</button>
              <span className="label-mono" style={{ fontSize: 8, color: 'var(--text-tertiary)' }}>{l.unit}</span>
              <span className="logflow-lnkcal"><b>{meta.contribution.kcal}</b><small>kcal</small></span>
            </div>
            <div className="logflow-lnmac">
              <span className="mz-c-coral"><b>{meta.contribution.p} g</b><small>feh.</small></span>
              <span className="mz-c-gold"><b>{meta.contribution.c} g</b><small>szénh.</small></span>
              <span className="mz-c-lav"><b>{meta.contribution.f} g</b><small>zsír</small></span>
            </div>
            {l.source !== 'estimate' && (
              <div style={{ marginTop: 6 }}>
                <NutrientCells nutrients={meta.nutrients} perLabel={`${l.amount} ${l.unit}`} />
              </div>
            )}
            {l.needsReview && (
              <p className="logflow-lnnote">✨ Az AI nem teljesen biztos ebben a sorban — nézd át a mennyiséget.</p>
            )}
            {l.source === 'recipe' && (() => {
              const r = recipes.find(x => x.id === l.refId)
              if (!r || r.ingredients.length === 0) return null
              const open = !!expanded[l.key]
              const touched = Object.keys(l.overrides ?? {}).length
              return (
                <div style={{ marginTop: 9, paddingTop: 8, borderTop: '1px solid var(--border-subtle)' }}>
                  <button
                    onClick={() => setExpanded(p => ({ ...p, [l.key]: !p[l.key] }))}
                    aria-label="Hozzávalók finomhangolása" aria-expanded={open}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span className="label-mono" style={{ fontSize: 8.5, letterSpacing: '0.12em', color: 'var(--text-tertiary)' }}>
                      HOZZÁVALÓK · {r.ingredients.length}{touched ? ` · ${touched} MÓDOSÍTVA` : ''}
                    </span>
                    <span style={{ fontSize: 9.5, fontWeight: 600, color: 'var(--coral)' }}>
                      {open ? 'összecsuk ▴' : 'finomhangolás ▾'}
                    </span>
                  </button>
                  {open && (
                    <>
                      {r.servings > 1 && (
                        <div style={{ marginTop: 5, fontSize: 9.5, color: 'var(--text-tertiary)' }}>
                          a teljes recepthez ({r.servings} adag)
                        </div>
                      )}
                      {r.ingredients.map((ing, i) => {
                        const src = ingredients.find(x => x.id === ing.refId)
                        const amount = l.overrides?.[i] ?? ing.amount
                        return (
                          <RecipeOverrideRow
                            key={`${l.key}-${i}`}
                            name={ing.name ?? src?.name ?? ing.refId}
                            unit={ing.unit}
                            originalAmount={ing.amount}
                            amount={amount}
                            // Mirrors computeRecipeMacrosWithOverrides exactly: an UNTOUCHED row
                            // shows the server-frozen contribution (never re-derived from the live
                            // pantry row, which may have drifted since the recipe was saved); an
                            // OVERRIDDEN row is rescaled from the live source, or - when that
                            // source is gone - from the line's own frozen contribution.
                            kcal={l.overrides?.[i] === undefined
                              ? (ing.contribution?.kcal
                                  ?? (src ? round(src.macros.kcal * (ing.amount / (src.per || 1))) : 0))
                              : (src
                                  ? round(src.macros.kcal * (amount / (src.per || 1)))
                                  : rescaleFrozen(ing.contribution, amount, ing.amount).kcal)}
                            onChange={(v) => setOverride(l.key, i, v)}
                            onReset={() => clearOverride(l.key, i)}
                          />
                        )
                      })}
                      {touched > 0 && (
                        <button onClick={() => resetOverrides(l.key)} aria-label="Alaphelyzet"
                          style={{ marginTop: 7, fontSize: 10, fontWeight: 600, color: 'var(--coral)' }}>
                          Alaphelyzet
                        </button>
                      )}
                    </>
                  )}
                </div>
              )
            })()}
          </div>
        ))}
      </div>

      <div className="rad-12" style={{ padding: '11px 12px', marginTop: 12, background: 'color-mix(in srgb, var(--sage) 5%, transparent)', border: '1px solid var(--line)' }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
          <span className="label-mono" style={{ fontSize: 9, letterSpacing: '0.14em', color: 'var(--coral)' }}>EZ AZ ÉTKEZÉS</span>
          <span className="label-mono" style={{ fontSize: 8.5, color: 'var(--text-tertiary)' }}>{lines.length} tétel</span>
        </div>
        {/* The derived name IS the meal title (no name field, mezo-byo1) — shown where it
            will land, honest to what save() sends. */}
        {derivedName && <div className="logflow-totname">{derivedName}</div>}
        <MCells cells={[
          { label: 'kcal', value: total.kcal, tone: 'sage' },
          { label: 'fehérje', value: `${total.p} g`, tone: 'coral' },
          { label: 'szénh.', value: `${total.c} g`, tone: 'gold' },
          { label: 'zsír', value: `${total.f} g`, tone: 'lav' },
        ]} />
        <div style={{ marginTop: 6 }}><NutrientCells nutrients={totalNutrients} size="md" /></div>
        <div style={{ marginTop: 9, paddingTop: 8, borderTop: '1px solid var(--border-subtle)' }}>
          <div className="row" style={{ justifyContent: 'space-between', fontVariantNumeric: 'tabular-nums', fontSize: 8.5, color: 'var(--text-tertiary)', marginBottom: 5 }}>
            <span>Mai nap eddig <b style={{ color: 'var(--text-secondary)' }}>{fuel.consumed.kcal}</b> <span style={{ color: 'var(--coral)' }}>+{total.kcal}</span> = <b style={{ color: 'var(--text-secondary)' }}>{after}</b></span>
            <span>cél <b style={{ color: 'var(--text-secondary)' }}>{fuel.targets.kcal}</b> kcal</span>
          </div>
          <div style={{ height: 5, background: 'var(--surface-2)', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: nowPct + '%', background: 'var(--text-tertiary)' }} />
            <div style={{ position: 'absolute', left: nowPct + '%', top: 0, bottom: 0, width: addPct + '%', background: 'var(--coral)' }} />
          </div>
        </div>
      </div>

      <div className="row gap-sm" style={{ margin: '14px 0 12px' }}>
        <button className="cta-ghost" onClick={onCancel} style={{ flex: 1 }}>Mégse</button>
        <button className="cta-primary" disabled={!canSave} onClick={save} style={{ flex: 1.8 }}>
          {saveLabel ?? <><Icon name="check" size={15} /> Logolás · +10 XP</>}
        </button>
      </div>

      {kamraOpen && <KamraPickSheet onPick={addPantry} onClose={() => setKamraOpen(false)} addedRefIds={addedPantryIds} />}
      {receptOpen && <ReceptPickSheet onPick={addRecipe} onClose={() => setReceptOpen(false)} />}
    </div>
  )
}

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
// A6 (Fuel Titanium S1c, mezo-33k6): the ✨ AI panel also carries a microphone. It is WIRING
// ONLY — `useVoiceInput` transcribes on the existing endpoint and appends the sentence to the
// same AI text field, so a spoken meal reaches the draft endpoint as text and saves as
// `ai-text`. No audio is ever sent to the draft endpoint, and nothing saves without confirmation.
//
// S1c.2 (mezo-33k6): EGY naplózó, nem kettő. Ahol mód-héj (`FuelLogModes`) ül fölötte, ott a
// héj birtokolja a „hogyan kezdem" kérdést (`shellOwnsEntry`): a composer elhagyja a saját ✨ AI
// forrás-kártyáját, a kézi Kamra/Recept pickerek pedig a felső
// Fotó · Kamra · Recept · Szokásosak sorból nyílnak (ADR 0056).
// A megerősítő rész (MIKOR · TÉTELEK · összegző kártya · mentés-CTA) ilyenkor csak az első sorral
// jelenik meg. Héj NÉLKÜL (a LogFlowPage-overlay: recept, kamra, Életjel, Rutin) minden marad,
// ahogy volt — a két prop alapértelmezése a mai viselkedés.
//
// provenance.origin: reflects whether AI genuinely contributed to THIS save
// (ai-photo when a photo was analyzed this session, else ai-text), regardless of
// how many manual lines ride alongside; a purely manual meal omits provenance —
// the LogFlowPage rule, kept verbatim (see that file's original header note).
// ============================================================
import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react'
import type { FuelMeal, FuelSlot, Ingredient, MealInput, MealItemInput, MealSlot, Recipe } from '@/data/types'
import { useDietSettings, useFuelDay, useMealActions, useRecipes, usePantry } from '@/data/hooks'
import { useMealCeremony } from '@/features/fuel/MealCeremonyProvider'
import { reportDraftOutcome } from '@/data/aidraft/outcomeClient'
import { nowOffsetIso, offsetIso, localDateString } from '@/shared/lib/dates'
import { resizeImage } from '@/shared/lib/resizeImage'
import { plural, useM } from '@/shared/i18n'
import { fmtDate, fmtGrouped } from '@/shared/lib/format'
import { Icon3D, type Icon3DName } from '@/shared/ui/clay'
import { Acts, Btn, Bub, Card, Empty, Hero, Input, Lk, Note, Page, Row, Section, Seg, TextArea, Txt } from '@/shared/ui/folyadek'
import { EditLine, LineTags, MealCells, NumG, PourBowl, PourKey } from '@/features/fuel/components/folyadek'
import { NutrientCells } from '@/features/fuel/components/NutrientCells'
import { KamraPickSheet } from '@/features/fuel/sheets/KamraPickSheet'
import { pantryCategoryIcon } from '@/features/fuel/logic/kamraItems'
import { ReceptPickSheet } from '@/features/fuel/sheets/ReceptPickSheet'
import { deriveMealName } from '@/features/fuel/logic/deriveMealName'
import { defaultMealSlot } from '@/features/fuel/logic/defaultMealSlot'
import { resolveEatingTimePlacement } from '@/features/fuel/logic/eatingTimePlacement'
import { hhmmFromLoggedAt, mealSlotKey } from '@/features/fuel/logic/buildDayPlan'
import { parseAmountInput, stepAmount } from '@/features/fuel/logic/amountGuard'
import {
  computeRecipeNutrients, computeRecipeMacrosWithOverrides, computeRecipeNutrientsWithOverrides,
  rescaleFrozen, lineNutrients, scaleNutrients, sumNutrients, NO_NUTRIENTS, factsOf,
} from '@/data/fuel/recipeMacros'
import { RecipeOverrideRow } from '@/features/fuel/components/RecipeOverrideRow'
import { appendDictation } from '@/shared/lib/voice/useVoiceInput'
import { VoiceField } from '@/shared/ui/voice/VoiceField'

export type MealComposerPrefill =
  | { source: 'recipe'; recipeId: string }
  | { source: 'pantry'; pantryItemId: string }
  | null

/** The MIKOR control's order; the words are `fuelLog.composer.slot`, read at render. */
const SLOT_ORDER: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack']

const round = (n: number) => Math.round(n)
const zero = { kcal: 0, p: 0, c: 0, f: 0 }

/** A sor jele (prototípus `lineCard` `ic`): kamra-sornál a tétel kategóriájának jele, receptnél a könyv,
 *  becsült sornál az energiájának uralkodó makrója — pusztán vizuális. */
function lineGlyph(l: { source: 'recipe' | 'pantry' | 'estimate'; refId?: string }, c: { p: number; c: number; f: number }, ingredients: Ingredient[]): Icon3DName {
  if (l.source === 'recipe') return 't-book'
  if (l.source === 'pantry') return pantryCategoryIcon(ingredients.find(x => x.id === l.refId)?.category)
  const shares: [Icon3DName, number][] = [['t-protein', c.p * 4], ['t-carb', c.c * 4], ['t-avocado', c.f * 9]]
  const top = shares.reduce((a, b) => (b[1] > a[1] ? b : a))
  return top[1] > 0 ? top[0] : 't-plate'
}

/** Múltbeli napi mentés idő-komponense, ha az indító nem hoz sajátot (szabad blokk). */
const SLOT_DEFAULT_TIME: Record<MealSlot, string> = {
  breakfast: '08:00', lunch: '13:00', dinner: '19:00', snack: '16:00',
}

const localHHmm = (date = new Date()) =>
  `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`

interface EstimateSnapshot {
  per: number; basisUnit: string
  kcal: number; proteinG: number; carbsG: number; fatG: number; nova: number | null
  // Nutrition-quality facts the AI estimated for this portion (mezo-1f7b). They must survive the
  // draft → editor → save hop, or the logged meal is blind on fiber/WHO/fat-quality.
  fiberG: number | null; sugarG: number | null; saltG: number | null; saturatedFatG: number | null
}
interface DraftLine {
  key: string
  source: 'recipe' | 'pantry' | 'estimate'
  refId?: string
  name: string
  amount: number
  unit: string
  /** true when this line came out of the AI panel — shown as an AI mark on the source tag, so a
   *  pantry-matched AI line reads "kamra · AI" rather than pretending to be an estimate. */
  fromAi?: boolean
  needsReview?: boolean
  estimate?: EstimateSnapshot
  /** recipe arm only - ingredient array index -> amount, in the recipe's own unit (mezo-ormb). */
  overrides?: Record<number, number>
}

function lineMeta(l: DraftLine, recipes: Recipe[], ingredients: Ingredient[]) {
  // The tag names where the MACROS came from; the AI mark says who put the line there. Keeping
  // the two apart is why an AI line matched to a real Kamra row no longer lies about being an
  // estimate (mezo-qrks). The tag itself is the shared `LineTags` (source + „· AI").
  // 'becslés' only ever comes from the AI panel (there's no manual estimate path), so the tag
  // already says "AI" on its own — an AI mark there would be redundant, not honest-making.
  const aiMark = !!l.fromAi && l.source !== 'estimate'
  if (l.source === 'estimate') {
    const est = l.estimate!
    const per = est.per || 1
    const factor = l.amount / per
    return {
      name: l.name, aiMark, step: 10, min: 1,
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
      name: l.fromAi ? l.name : (r?.name ?? l.name), aiMark, step: 1, min: 1,
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
    name: l.fromAi ? l.name : (ing?.name ?? l.name), aiMark, step: 10, min: 1,
    contribution: {
      kcal: round((ing?.macros.kcal ?? 0) * factor), p: round((ing?.macros.p ?? 0) * factor),
      c: round((ing?.macros.c ?? 0) * factor), f: round((ing?.macros.f ?? 0) * factor),
    },
    nutrients: lineNutrients(l.amount, per, factsOf(ing)),
  }
}

/**
 * A8 (mezo-33k6): a logolt étkezés sorai → szerkeszthető piszkozat-sorok. A becsült sor
 * snapshotja a LOGOLT adagra van fagyasztva (`per = amount`), így a ± léptetés pontosan úgy
 * skálázódik, ahogy az AI-piszkozatnál. `fromAi` SZÁNDÉKOSAN nincs beállítva: ezek nem ennek a
 * munkamenetnek az AI-sorai, tehát nem is jelentünk róluk piszkozat-visszajelzést.
 */
function draftLinesFromMeal(m: FuelMeal): DraftLine[] {
  return m.mealItems.map((l, i): DraftLine => {
    if (l.source === 'estimate') {
      return {
        key: `edit-${i}`, source: 'estimate', name: l.name, amount: l.amount, unit: l.unit,
        estimate: {
          per: l.amount || 1, basisUnit: l.unit,
          kcal: l.contribution.kcal, proteinG: l.contribution.p,
          carbsG: l.contribution.c, fatG: l.contribution.f, nova: l.nova ?? null,
          fiberG: l.nutrients?.fiberG ?? null, sugarG: l.nutrients?.sugarG ?? null,
          saltG: l.nutrients?.saltG ?? null, saturatedFatG: l.nutrients?.saturatedFatG ?? null,
        },
      }
    }
    return { key: `edit-${i}`, source: l.source, refId: l.refId, name: l.name, amount: l.amount, unit: l.unit }
  })
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
  /** The page's selected photo is only attached here. AI analysis starts on Elemzés. */
  incomingPhoto?: File | null
  /** The unified page's top-row pantry/recipe action opens the existing picker sheet. */
  sourceAction?: { source: 'pantry' | 'recipe'; seq: number } | null
  /** A selected usual meal's name lands in the persistent text field. */
  incomingAiText?: { text: string; seq: number } | null
  /** S1c: the PHOTO arm failed — the shell raises its first-class failure state (A4), which
   *  offers the other three routes instead of an error toast. */
  onAiFailed?: () => void
  onAiSucceeded?: () => void
  /** Melyik napra könyvelődik a mentés (ISO local date). Absent = ma (nowOffsetIso, byte-azonos). */
  logDate?: string
  /** A loggedAt idő-komponense HH:mm (ablak-indítás: az ablak ideje). Absent = slot-alap idő. */
  logTime?: string
  /** A mentés-CTA felirata (múltbeli nap). Absent = a meglévő felirat. */
  saveLabel?: string
  /** Folyadék (mezo-n4wf5.5): a composer AZ oldal (`Page` + a lebegő gombsor). Ami a hívóé és a tartalom FÖLÉ kerül
   *  (a chrome-mentes lap címsora, a „másik napra könyvelődik" csík), az itt jön be. */
  head?: ReactNode
  /** A mód-héj (`FuelLogModes`) — a composer teszi a helyére: üres piszkozatnál a „Honnan adod hozzá?" kártyába,
   *  tételekkel az „Adj hozzá még" kártyába, a szövegmező fölé (`compact`). */
  shell?: (compact: boolean) => ReactNode
  /** Az alsó sáv nincs a képernyőn (overlay): a gombsor a képernyő aljára ül. */
  nonav?: boolean
  /** Az üres piszkozat hősének kerete: a címke, és ablakból indítva az ablak neve + kcal-kerete. */
  room?: { label: string; windowName?: string; budgetKcal?: number | null }
  /** S1c.2 (mezo-33k6): egy mód-héj (`FuelLogModes`) ül FÖLÖTTE, és az már birtokolja a „hogyan
   *  kezdem" kérdést. Ilyenkor a composer elhagyja a SAJÁT ✨ AI forrás-kártyáját (az az egyetlen
   *  valódi duplikáció), és a megerősítő részt csak akkor mutatja, ha van mit megerősíteni.
   *  Alapértelmezése `false`: a héj NÉLKÜL futó hívók (a LogFlowPage-overlay — recept, kamra,
   *  Életjel, Rutin) bájtazonosan úgy renderelnek, ahogy eddig. */
  shellOwnsEntry?: boolean
  /** S1c (mezo-33k6, A8 · A9): egy MÁR LOGOLT étkezés szerkesztése. Jelen esetén a composer abból
   *  az étkezésből indul (sorok, cím, ablak, idő), a mentés `updateMeal`-t hív `logMeal` helyett,
   *  és megjelenik a két lépéses törlés. A javításról SOSEM megy AI-piszkozat-visszajelzés: az a
   *  jelzés a piszkozat minőségéről beszél, nem a korrekcióról. */
  editMealId?: string
  /** A blokk ajánlott ablaka (mezo-6g52f) — a szerver ehhez pontozza az időzítést. */
  window?: { from: string; to: string }
  /** The selected day's planned windows for new, page-based meal logging. */
  eatingTimeWindows?: readonly FuelSlot[]
  onSaved: () => void
  onCancel: () => void
}

/** Numbers the page's sections in the order they are actually drawn (a block that is not there takes no number). */
function numbered(...blocks: Array<((num: number) => ReactNode) | null>): ReactNode {
  let i = 0
  return blocks.map((b, k) => (b ? <Fragment key={k}>{b(++i)}</Fragment> : null))
}

export function MealComposer({
  fixedSlot, initialSlot, prefill, aiPanelOpenOnMount,
  incomingPhoto, incomingAiText, sourceAction, onAiFailed, onAiSucceeded,
  shellOwnsEntry = false,
  logDate, logTime, saveLabel, head, shell, nonav, room, editMealId, window, eatingTimeWindows, onSaved, onCancel,
}: MealComposerProps) {
  const M = useM()
  const L = M.fuelLog.composer
  const K = M.fuelKozos
  const { settings: dietSettings } = useDietSettings()
  const { recipes } = useRecipes()
  const { ingredients } = usePantry()
  const { fuel } = useFuelDay(logDate)
  const { logMealAsync, updateMeal, deleteMeal, draftMealFromAi } = useMealActions(logDate)
  // A naplózást LEZÁRÓ ünneplés (mezo-bqwyo): a ceremónia a shellben lakik, mert ez a
  // szerkesztő a mentés pillanatában bezárja magát.
  const { celebrateMeal } = useMealCeremony()

  const [slot, setSlot] = useState<MealSlot>(() => fixedSlot ?? initialSlot ?? defaultMealSlot())
  const [timeOpen, setTimeOpen] = useState(false)
  const [timeOverride, setTimeOverride] = useState<string | null>(null)
  const [nowHHmm, setNowHHmm] = useState(localHHmm)
  const [timeSaveBusy, setTimeSaveBusy] = useState(false)
  const [timeSaveError, setTimeSaveError] = useState<true | null>(null)
  useEffect(() => {
    if (eatingTimeWindows == null || editMealId != null) return
    const tick = () => setNowHHmm(localHHmm())
    const interval = globalThis.setInterval(tick, 15_000)
    return () => globalThis.clearInterval(interval)
  }, [eatingTimeWindows, editMealId])
  // A slot-targeted launch keeps its slot even once an AI draft proposes a different one
  // (mezo-53su); manual taps lock it too.
  const slotLocked = useRef(fixedSlot != null || initialSlot != null)
  const [kamraOpen, setKamraOpen] = useState(false)
  const [receptOpen, setReceptOpen] = useState(false)
  const [aiOpen, setAiOpen] = useState(!!aiPanelOpenOnMount)
  const [aiBusy, setAiBusy] = useState(false)
  const [aiText, setAiText] = useState('')
  const [aiPhoto, setAiPhoto] = useState<File | null>(null)
  const [aiError, setAiError] = useState<true | null>(null)
  // What actually landed in the meal FROM the AI this session — the honest input to
  // provenance.origin (see the file-header note).
  const [aiContribution, setAiContribution] = useState<{ photo: boolean; rawText: string | null } | null>(null)
  /** Which recipe lines have their ingredient fine-tuning block expanded. */
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  // --- draft outcome signals (mezo-76f6): accepted/edited/discarded for the meal_draft feature.
  // `aiDraftId` is the backend-minted id from the most recent successful AI draft; a save with
  // no AI provenance (aiContribution null) never reports anything — there is no draft to react to.
  const [aiDraftId, setAiDraftId] = useState<string | null>(null)
  // Flips true the moment the user touches an AI-landed line (amount/removal/override) — the
  // "edited vs accepted-as-is" signal. Reset whenever a fresh AI draft lands.
  const aiLinesEditedRef = useRef(false)
  // Guards "exactly once per draft": holds the draftId an outcome has already been sent for, so
  // a save (accepted/edited) followed by unmount never ALSO fires a discard for the same draft,
  // and a repeated unmount effect never double-fires either.
  const outcomeReportedForRef = useRef<string | null>(null)
  const aiDraftIdRef = useRef<string | null>(null)
  useEffect(() => { aiDraftIdRef.current = aiDraftId }, [aiDraftId])

  const reportOutcomeOnce = (draftId: string, outcome: 'accepted' | 'edited' | 'discarded') => {
    // A8 (mezo-33k6): egy LOGOLT étkezés javításáról nem megy visszajelzés — az a jelzés az
    // AI-piszkozat minőségéről beszél, nem a korrekcióról. (A `discarded` ág is ide tartozik.)
    if (editMealId) return
    if (outcomeReportedForRef.current === draftId) return
    outcomeReportedForRef.current = draftId
    reportDraftOutcome(draftId, 'meal_draft', outcome)
  }
  // Escape/back share the close path (LogFlowPage → onCancel → onClose, which unmounts this
  // component) — that IS the discard signal (mezo-76f6 ruling). Mount-once effect so the
  // cleanup fires exactly on unmount, not on every aiDraftId change (a mid-session AI re-run
  // just overwrites `aiDraftId` — only the CURRENT draft gets a discard, on eventual unmount).
  useEffect(() => {
    return () => {
      const id = aiDraftIdRef.current
      if (id) reportOutcomeOnce(id, 'discarded')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-once: the cleanup must fire exactly on unmount
  }, [])

  /** Marks the AI-lines-were-edited signal when the touched line actually came from the AI panel. */
  const markAiTouched = (key: string) => {
    if (lines.find(l => l.key === key)?.fromAi) aiLinesEditedRef.current = true
  }

  const [lines, setLines] = useState<DraftLine[]>(() => {
    if (!prefill) return []
    if (prefill.source === 'recipe') {
      return [{ key: 'pf', source: 'recipe', refId: prefill.recipeId, name: '', amount: 1, unit: 'adag' }]
    }
    const ing = ingredients.find(i => i.id === prefill.pantryItemId)
    return [{ key: 'pf', source: 'pantry', refId: prefill.pantryItemId, name: '', amount: ing?.per || 100, unit: ing?.unit || 'g' }]
  })

  // ── A8: egy logolt étkezés szerkesztése (mezo-33k6) ─────────────────────────────────────────
  // A nap már be van töltve (`useFuelDay` fent) — a szerkesztett étkezés onnan jön. A seedelés
  // EFFEKTBEN fut, mert valós módban a nap a composer után érkezik meg; a ref miatt pontosan
  // egyszer, tehát egy közbeni refetch nem írja vissza a user javításait.
  const editMeal = editMealId != null ? fuel.meals.find(m => m.id === editMealId) : undefined
  const [editTime, setEditTime] = useState('')
  const [deleteArmed, setDeleteArmed] = useState(false)
  const seededRef = useRef(false)
  useEffect(() => {
    if (editMealId == null || seededRef.current || !editMeal) return
    seededRef.current = true
    setLines(draftLinesFromMeal(editMeal))
    const k = mealSlotKey(editMeal)
    if (k) { slotLocked.current = true; setSlot(k) }
    setEditTime(hhmmFromLoggedAt(editMeal.loggedAt, SLOT_DEFAULT_TIME[k ?? 'snack']))
  }, [editMealId, editMeal])

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
  // Szerkesztésnél a logolt étkezés SAJÁT címe marad: ebben a felületen nincs név-mező, ezért a
  // derivált név csendben átnevezné a már elnevezett étkezést (pl. „Túrós zabkása · áfonyával").
  const effectiveName = editMeal?.title || derivedName

  const selectSlot = (s: MealSlot) => { slotLocked.current = true; setSlot(s) }

  const addPantry = (ing: Ingredient) => {
    setLines(prev => [...prev, { key: crypto.randomUUID(), source: 'pantry', refId: ing.id, name: ing.name, amount: ing.per || 100, unit: ing.unit || 'g' }])
  }
  const addRecipe = (r: Recipe) => {
    setLines(prev => [...prev, { key: crypto.randomUUID(), source: 'recipe', refId: r.id, name: r.name, amount: 1, unit: 'adag' }])
    setReceptOpen(false)
  }
  const removeLine = (key: string) => { markAiTouched(key); setLines(prev => prev.filter(l => l.key !== key)) }
  // --- recipe ingredient overrides (mezo-ormb) --------
  // Record only a GENUINE delta: stepping back to the recipe's own amount removes the key, so the
  // "N MODOSITVA" count and Alaphelyzet don't linger on an untouched line.
  const setOverride = (key: string, index: number, amount: number) => {
    markAiTouched(key)
    setLines(prev => prev.map(p => {
      if (p.key !== key) return p
      const original = recipes.find(r => r.id === p.refId)?.ingredients[index]?.amount
      const next = { ...p.overrides }
      if (original !== undefined && amount === original) delete next[index]
      else next[index] = amount
      return { ...p, overrides: next }
    }))
  }
  const clearOverride = (key: string, index: number) => {
    markAiTouched(key)
    setLines(prev => prev.map(p => {
      if (p.key !== key) return p
      const next = { ...p.overrides }
      delete next[index]
      return { ...p, overrides: next }
    }))
  }
  const resetOverrides = (key: string) => {
    markAiTouched(key)
    setLines(prev => prev.map(p => p.key === key ? { ...p, overrides: undefined } : p))
  }
  const bump = (key: string, delta: number, step: number, min: number) => {
    markAiTouched(key)
    setLines(prev => prev.map(l => l.key === key ? { ...l, amount: stepAmount(l.amount, delta * step, min) } : l))
  }
  const setAmount = (key: string, raw: string) => {
    markAiTouched(key)
    setLines(prev => prev.map(l => l.key === key ? { ...l, amount: parseAmountInput(raw, l.amount) } : l))
  }

  const canRunAi = aiText.trim().length > 0 || aiPhoto != null
  /** THE one AI call site (S1c, mezo-33k6): the panel's ✨ Elemzés, the shell's camera arm and a
   *  „szokásos" row all enter here, so the photo/text flow and its provenance stay single-sourced. */
  const runAiWith = async (photo: File | null, text: string) => {
    if (!photo && text.trim().length === 0) return
    setAiBusy(true)
    setAiError(null)
    try {
      const blob = photo ? await resizeImage(photo) : undefined
      const draft = await draftMealFromAi({ date: logDate ?? localDateString(), text: text.trim() || undefined, photo: blob })
      const newLines: DraftLine[] = draft.items.map((it): DraftLine => {
        const key = crypto.randomUUID()
        if (it.source === 'estimate') {
          return {
            key, source: 'estimate', name: it.name, amount: it.amount, unit: it.unit,
            fromAi: true, needsReview: it.needsReview,
            estimate: {
              per: it.per, basisUnit: it.basisUnit,
              kcal: it.kcal, proteinG: it.proteinG, carbsG: it.carbsG, fatG: it.fatG, nova: it.nova,
              fiberG: it.fiberG, sugarG: it.sugarG, saltG: it.saltG, saturatedFatG: it.saturatedFatG,
            },
          }
        }
        if (it.source === 'pantry') {
          return { key, source: 'pantry', refId: it.pantryItemId ?? undefined, name: it.name, amount: it.amount, unit: it.unit, fromAi: true, needsReview: it.needsReview }
        }
        return { key, source: 'recipe', refId: it.recipeId ?? undefined, name: it.name, amount: it.amount, unit: it.unit, fromAi: true, needsReview: it.needsReview }
      })
      setLines(prev => [...prev, ...newLines])
      if (!slotLocked.current) setSlot(draft.slot)
      // Honest provenance: what genuinely went INTO this call (a shell-camera photo counts
      // exactly like a panel-picked one) — never the panel's leftover state.
      setAiContribution({ photo: photo != null, rawText: text.trim() || null })
      // A fresh backend-minted draft (mezo-76f6) — reset the "edited" flag so a PRIOR run's
      // manual tweaks (if any) don't leak an "edited" onto a since-regenerated draft.
      setAiDraftId(draft.draftId)
      aiLinesEditedRef.current = false
      setAiText('')
      if (!shellOwnsEntry) {
        setAiPhoto(null)
        setAiOpen(false)
      }
      onAiSucceeded?.()
    } catch {
      setAiError(true)
      // A4: only a PHOTO failure is the shell's „ezt a tányért nem ismertem fel" state — a text
      // failure must not claim a photo was misread.
      if (photo) onAiFailed?.()
    } finally {
      setAiBusy(false)
    }
  }
  const runAi = () => runAiWith(aiPhoto, aiText)

  // ── S1c héj-karok (mezo-33k6) ───────────────────────────────────────────────────────────────
  // The shell hands its photo / transcript DOWN here instead of calling the AI itself, so the
  // single call site, the single ✨ text field and the provenance rules all stay in one place.
  useEffect(() => {
    if (shellOwnsEntry) setAiPhoto(incomingPhoto ?? null)
  }, [incomingPhoto, shellOwnsEntry])

  const sourceSeqRef = useRef(0)
  useEffect(() => {
    if (!sourceAction || sourceAction.seq === sourceSeqRef.current) return
    sourceSeqRef.current = sourceAction.seq
    if (sourceAction.source === 'pantry') setKamraOpen(true)
    else setReceptOpen(true)
  }, [sourceAction])

  const shellTextSeqRef = useRef(0)
  useEffect(() => {
    if (!incomingAiText || incomingAiText.seq === shellTextSeqRef.current) return
    shellTextSeqRef.current = incomingAiText.seq
    const next = aiText ? `${aiText} ${incomingAiText.text}` : incomingAiText.text
    setAiText(next)
    setAiOpen(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fires on a NEW seq only
  }, [incomingAiText])

  const hasEatingTime = eatingTimeWindows != null && editMealId == null
  const previewTime = timeOverride ?? nowHHmm
  const invalidTime = hasEatingTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(previewTime)
  const timePlacement = hasEatingTime && !invalidTime ? resolveEatingTimePlacement(previewTime, eatingTimeWindows!) : null
  const isFutureTime = hasEatingTime && timeOverride != null &&
    `${logDate ?? localDateString()}T${timeOverride}` > `${localDateString()}T${nowHHmm}`
  const canSave = lines.length > 0 && !invalidTime && !isFutureTime && !timeSaveBusy
  const save = () => {
    if (!canSave) return
    const saveTime = timeOverride ?? localHHmm()
    if (hasEatingTime && `${logDate ?? localDateString()}T${saveTime}` > `${localDateString()}T${localHHmm()}`) return
    const savePlacement = hasEatingTime ? resolveEatingTimePlacement(saveTime, eatingTimeWindows!) : null
    const saveWindow = hasEatingTime ? savePlacement?.window : window
    const items: MealItemInput[] = lines.map((l): MealItemInput => {
      if (l.source === 'estimate') {
        const est = l.estimate!
        return {
          source: 'estimate', name: l.name, amount: l.amount, unit: l.unit,
          per: est.per, basisUnit: est.basisUnit,
          kcal: est.kcal, proteinG: est.proteinG, carbsG: est.carbsG, fatG: est.fatG, nova: est.nova,
          fiberG: est.fiberG, sugarG: est.sugarG, saltG: est.saltG, saturatedFatG: est.saturatedFatG,
        }
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
      slot: savePlacement?.slot ?? fixedSlot ?? slot,
      // A8: a javítás az étkezés SAJÁT idejét viszi (a szerkesztő idő-mezőjéből), nem tolja
      // mostra — különben egy reggeli javítása este átköltöztetné a reggelit.
      loggedAt: savePlacement != null
        ? offsetIso(logDate ?? localDateString(), saveTime)
        : editMeal != null
        ? offsetIso(logDate ?? editMeal.mealDate ?? localDateString(), editTime || hhmmFromLoggedAt(editMeal.loggedAt, SLOT_DEFAULT_TIME[fixedSlot ?? slot]))
        : logDate != null
          ? offsetIso(logDate, logTime ?? SLOT_DEFAULT_TIME[fixedSlot ?? slot])
          : nowOffsetIso(),
      title: effectiveName.trim() || null,
      items,
      ...(saveWindow ? { window: saveWindow } : {}),
      ...(aiContribution
        ? { provenance: { origin: aiContribution.photo ? 'ai-photo' : 'ai-text', rawText: aiContribution.rawText } }
        : {}),
    }
    // AI-provenance moment (mezo-76f6): accepted when the AI-landed lines were saved as-is,
    // edited when the user touched any of them first. A save with no AI provenance at all has
    // no draft to react to. Guarding the discard effect BEFORE the mutation settles matters: this
    // composer often unmounts (onSaved → onClose) well before a real-mode POST resolves, and that
    // unmount must not ALSO fire a discard for the very draft this save is reporting.
    // A8: szerkesztésnél a MEGLÉVŐ update-művelet fut (eddig nem volt UI-ja), és visszajelzés
    // nem megy — a javítás nem a piszkozat minőségéről szól.
    if (editMealId != null) {
      updateMeal(editMealId, input)
      onSaved()
      return
    }
    // A mentés VÁLASZÁBÓL ünnepelünk: a pontszám a szerveren, íráskor születik (ADR 0006),
    // tehát a válasz már hordozza. Pontszám nélkül a provider nem nyit ceremóniát.
    const celebrate = (meal?: { id?: string; score?: number | null; title?: string | null; kcal?: number; p?: number; c?: number; f?: number } | null) => {
      if (!meal?.id) return
      const time = localHHmm(new Date(input.loggedAt ?? Date.now()))
      celebrateMeal({
        mealId: meal.id,
        score: meal.score ?? null,
        label: meal.title ?? input.title ?? M.fuelLog.page.meal,
        timeLabel: time,
        kcal: meal.kcal ?? 0,
        proteinG: meal.p ?? 0,
        carbsG: meal.c ?? 0,
        fatG: meal.f ?? 0,
        hasBreakdown: true,
      })
    }
    if (hasEatingTime) {
      setTimeSaveBusy(true)
      setTimeSaveError(null)
      void logMealAsync(input).then(
        (meal) => {
          if (aiContribution && aiDraftId) {
            reportOutcomeOnce(aiDraftId, aiLinesEditedRef.current ? 'edited' : 'accepted')
          }
          celebrate(meal as never)
          onSaved()
        },
        () => {
          setTimeSaveError(true)
          setTimeSaveBusy(false)
        },
      )
      return
    }
    if (aiContribution && aiDraftId) {
      const draftId = aiDraftId
      const outcome = aiLinesEditedRef.current ? 'edited' : 'accepted'
      outcomeReportedForRef.current = draftId
      // E9 (mezo-qt5q): `logMealAsync` — NOT the per-call onSuccess, which TanStack drops when
      // this composer unmounts first. `onSaved()` below navigates away on the page route, so the
      // callback form reported nothing there. A failed save reports nothing either: the draft was
      // never accepted, and the discard guard above already claimed this id.
      void logMealAsync(input).then(
        (meal) => { reportDraftOutcome(draftId, 'meal_draft', outcome); celebrate(meal as never) },
        () => undefined,
      )
    } else {
      void logMealAsync(input).then((meal) => celebrate(meal as never), () => undefined)
    }
    onSaved()
  }

  const addedPantryIds = lines.filter(l => l.source === 'pantry' && l.refId).map(l => l.refId!)

  // ── S1c.2 láthatósági szerződés (mezo-33k6) ─────────────────────────────────────────────────
  // Héj NÉLKÜL mindhárom kapu nyitva van — a LogFlowPage-overlay (recept, kamra, Életjel, Rutin)
  // pontosan úgy renderel, ahogy eddig. Héj alatt: a bejárat a héjé, a megerősítés a miénk.
  const showAiSource = !shellOwnsEntry
  const showManualSources = !shellOwnsEntry
  const showSourceRow = showAiSource || showManualSources
  // „Van mit megerősíteni": legalább egy piszkozat-sor, vagy egy már logolt étkezés javítása.
  const showConfirm = !shellOwnsEntry || lines.length > 0 || editMealId != null

  // ── Folyadék (mezo-n4wf5.5, prototípus fuel.js `log()`) ─────────────────────────────────────
  // A nap tálja: ami már benne van (halvány) és amit ez az étkezés tölt bele (erős) — a keret %-ában,
  // a tál 94%-áig (a prototípus `pour` skálája). Javításnál a nap összege MÁR tartalmazza ezt az
  // étkezést, ezért az „eddig" a logolt étkezés nélkül értendő.
  const dayBefore = Math.max(0, fuel.consumed.kcal - (editMeal?.kcal ?? 0))
  const dayTarget = fuel.targets.kcal
  const bowlPct = (kcal: number) => (dayTarget > 0 ? Math.min(94, (kcal / dayTarget) * 94) : 0)
  const afterDay = dayBefore + total.kcal
  const itemsWord = `${lines.length} ${plural(lines.length, L.total.items)}`
  const totalsDayLabel = logDate != null && logDate !== localDateString()
    ? L.total.daySoFar(fmtDate(logDate, 'long'))
    : L.total.todaySoFar
  const placedText = timePlacement?.label != null && timePlacement.window != null
    ? L.time.placed(timePlacement.label, timePlacement.window.from, timePlacement.window.to)
    : L.time.outside
  const unitWord = (unit: string) => (unit === 'adag' ? K.unit.serving : unit)

  // Az EGYETLEN ✨ szövegmező (a mikrofon a mező saját csempéje). Héj alatt az elemzés közben is
  // látszik, héj nélkül a „dolgozom" sor váltja.
  const aiPanelVisible = aiOpen && (!aiBusy || shellOwnsEntry)
  const aiField = (
    // A6 (mezo-33k6): a hang ugyanabba a szövegmezőbe ír, amiből az AI-piszkozat készül — a
    // leiratozás a meglévő `useTranscribe` végponton fut, a draft-hívás változatlan (`ai-text`).
    <VoiceField domain="fuel" className="fg-cmp" onTranscript={(t) => setAiText((d) => appendDictation(d, t))}>
      <TextArea value={aiText} onChange={(e) => setAiText(e.target.value)}
        aria-label={L.field} placeholder={L.placeholder} rows={2} />
    </VoiceField>
  )
  const aiErr = aiError && <Note tone="bad" role="alert">{L.aiError}</Note>

  const linesBlock = showConfirm ? (num: number) => (
    <>
      <Section n={num} title={L.items(lines.length)} />
      <Card className="fg-lines">
        {lines.length === 0 && <Empty>{L.empty}</Empty>}
        {resolved.map(({ l, meta }) => (
          <EditLine key={l.key}
            icon={lineGlyph(l, meta.contribution, ingredients)}
            name={meta.name}
            tags={<LineTags source={l.source} ai={meta.aiMark} review={!!l.needsReview} />}
            onRemove={() => removeLine(l.key)}
            amount={{ value: l.amount, onChange: (e) => setAmount(l.key, e.target.value) }}
            unit={unitWord(l.unit)}
            onDec={() => bump(l.key, -1, meta.step, meta.min)}
            onInc={() => bump(l.key, 1, meta.step, meta.min)}
            kcal={meta.contribution.kcal}
            macros={meta.contribution}
          >
            {l.source !== 'estimate' && <NutrientCells nutrients={meta.nutrients} />}
            {l.needsReview && <Note tone="warn">{l.source === 'pantry' ? L.reviewPantry : L.reviewOther}</Note>}
            {l.source === 'recipe' && (() => {
              const r = recipes.find(x => x.id === l.refId)
              if (!r || r.ingredients.length === 0) return null
              const open = !!expanded[l.key]
              const touched = Object.keys(l.overrides ?? {}).length
              return (
                <div className="fg-tune">
                  <button type="button" className="fg-tuh"
                    onClick={() => setExpanded(p => ({ ...p, [l.key]: !p[l.key] }))}
                    aria-label={L.tune.aria} aria-expanded={open}>
                    <b>{touched ? L.tune.headChanged(r.ingredients.length, touched) : L.tune.head(r.ingredients.length)}</b>
                    <span>{open ? `${L.tune.close} ▴` : `${L.tune.open} ▾`}</span>
                  </button>
                  {open && (
                    <>
                      {r.servings > 1 && <Note className="fg-tune-note">{L.tune.whole(r.servings)}</Note>}
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
                                  ?? (src ? round((src.macros.kcal ?? 0) * (ing.amount / (src.per || 1))) : 0))
                              : (src
                                  ? round((src.macros.kcal ?? 0) * (amount / (src.per || 1)))
                                  : rescaleFrozen(ing.contribution, amount, ing.amount).kcal)}
                            onChange={(v) => setOverride(l.key, i, v)}
                            onReset={() => clearOverride(l.key, i)}
                          />
                        )
                      })}
                      {touched > 0 && <Acts><Lk onClick={() => resetOverrides(l.key)}>{L.tune.resetAll}</Lk></Acts>}
                    </>
                  )}
                </div>
              )
            })()}
          </EditLine>
        ))}
      </Card>
    </>
  ) : null

  // A három forrás-csempe a héj nélküli felületen (a „Mit ettél?" lap és a javítás): Kamra · Recept · AI,
  // alattuk a nyitott ✨ panel (szöveg + hang + fotó → Elemzés).
  const ownSources = showSourceRow ? (num: number) => (
    <>
      <Section n={num} title={editMealId != null ? L.more : L.from} />
      <Card>
        {/* A kalauz-horgony CSAK a héj nélküli felületen ül itt (a teljes oldalon a héj mód-sora
            viseli ugyanezt a nevet) — így pontosan egy elem hordozza. */}
        <div className="fg-modes three" data-kalauz-anchor="log-forrasok">
          {showManualSources && (
            <>
              <button type="button" onClick={() => setKamraOpen(true)} aria-label={L.src.pantryAria}>
                <Bub icon="t-stack" size={34} /><span>{L.src.pantry}</span><small>{L.src.pantrySub}</small>
              </button>
              <button type="button" onClick={() => setReceptOpen(true)} aria-label={L.src.recipeAria}>
                <Bub icon="t-book" size={34} /><span>{L.src.recipe}</span><small>{L.src.recipeSub}</small>
              </button>
            </>
          )}
          {showAiSource && (
            <button type="button" className={aiOpen ? 'on' : undefined} onClick={() => setAiOpen(o => !o)}
              aria-label={L.src.aiAria} aria-pressed={aiOpen}>
              <Bub icon="t-score" size={34} /><span>{L.src.ai}</span><small>{L.src.aiSub}</small>
            </button>
          )}
        </div>
        {aiBusy && <Note className="fg-busy" role="status">{L.busy}</Note>}
        {aiPanelVisible && (
          <div className="fg-ai">
            {aiField}
            <Acts>
              {aiPhoto ? (
                <span className="fg-aiphoto">
                  {photoUrl && <img src={photoUrl} alt={L.photoAlt} />}
                  <span>{aiPhoto.name}</span>
                  <button type="button" className="fx-x" aria-label={L.removePhoto} onClick={() => setAiPhoto(null)}>×</button>
                </span>
              ) : (
                <label className="fo-btn sm ghost fg-photo">
                  <Icon3D name="t-camera" size={18} />
                  {L.photo}
                  <input type="file" accept="image/*" capture="environment" aria-label={L.photoInput}
                    onChange={(e) => setAiPhoto(e.target.files?.[0] ?? null)} />
                </label>
              )}
              <Btn sm disabled={!canRunAi || aiBusy} onClick={() => void runAi()}>{L.analyse}</Btn>
            </Acts>
            {aiErr}
            <Note>{L.hintOwn}</Note>
          </div>
        )}
      </Card>
    </>
  ) : null

  // MIKOR (a „Mit ettél?" lap és a javítás): napszak-választó, ha nem az ablak vagy a kézi idő dönt.
  const slotSeg = fixedSlot == null && eatingTimeWindows == null && showConfirm && (
    <Seg className="fg-seg" aria-label={L.when} value={slot} onChange={selectSlot}
      items={SLOT_ORDER.map(id => ({ key: id, label: L.slot[id] }))} />
  )

  const totalHero = showConfirm && (
    <Hero className="fg-hero fg-total"
      // A derivált név AZ étkezés címe (nincs név-mező, mezo-byo1) — ott látszik, ahová a mentés teszi.
      label={effectiveName || L.total.label}
      verdict={afterDay > dayTarget
        ? L.total.over(fmtGrouped(afterDay - dayTarget))
        : L.total.left(fmtGrouped(dayTarget - afterDay))}
      sub={L.total.sub(totalsDayLabel, fmtGrouped(dayBefore), fmtGrouped(total.kcal), fmtGrouped(afterDay), fmtGrouped(dayTarget), itemsWord)}
      graphic={<NumG graphic={<PourBowl before={bowlPct(dayBefore)} add={bowlPct(total.kcal)} />} value={fmtGrouped(total.kcal)} unit="kcal">
        <MealCells protein={total.p} carbs={total.c} fat={total.f} fiber={totalNutrients.fiberG == null ? null : Math.round(totalNutrients.fiberG)} fiberTarget={dietSettings.fiberG} />
      </NumG>}
    >
      <PourKey before={L.total.soFar(fmtGrouped(dayBefore))} add={L.total.thisMeal} />
      <NutrientCells nutrients={totalNutrients} size="md" />
    </Hero>
  )

  // Új étkezés, még nincs tétel (héj alatt): a nap tálja azzal, ami még belefér, és az EGY szövegmező.
  const roomKcal = room?.budgetKcal ?? 400
  const emptyHero = !showConfirm && (
    <Hero className="fg-hero"
      label={room?.label ?? M.fuelLog.page.free}
      verdict={aiBusy ? L.busy : L.field}
      sub={L.hintShell}
      actions={aiPanelVisible && !aiBusy
        ? <Btn disabled={!canRunAi} onClick={() => void runAi()}>{L.analyse}</Btn>
        : undefined}
      graphic={<NumG graphic={<PourBowl before={bowlPct(dayBefore)} add={bowlPct(roomKcal)} ghost />}
        value={fmtGrouped(Math.max(0, dayTarget - dayBefore))} unit={L.room.fits}>
        <PourKey before={L.total.soFar(fmtGrouped(dayBefore))}
          add={room?.windowName != null && room.budgetKcal != null ? L.room.windowBudget(room.windowName, fmtGrouped(room.budgetKcal)) : L.room.goesHere} />
      </NumG>}
    >
      {aiPanelVisible && aiField}
      {aiErr}
    </Hero>
  )

  const timeBlock = (hasEatingTime && showConfirm) || editMealId != null ? (num: number) => (
    <>
      <Section n={num} title={L.time.title} />
      <Card className="fg-timec">
        {editMealId != null ? (
          <>
            {slotSeg}
            {/* A8: a szerkesztő idő-mezője — az étkezés SAJÁT ideje, amit a user át is írhat. */}
            <div className="fg-time">
              <Input type="time" value={editTime} aria-label={L.time.title} onChange={(e) => setEditTime(e.target.value)} />
            </div>
          </>
        ) : (
          <>
            <Row className="fg-twt" left={<Bub icon="t-clock" size={40} />}
              title={timeOverride == null ? L.time.now(nowHHmm) : previewTime}
              sub={timeOverride == null ? L.time.tapHint : placedText}
              right={<span className="fg-car" aria-hidden="true">{timeOpen ? '▴' : '▾'}</span>}
              aria-expanded={timeOpen} aria-label={L.time.title}
              onClick={() => { setNowHHmm(localHHmm()); setTimeOpen(open => !open) }} />
            {timeOpen && (
              <>
                <div className="fg-time">
                  <Input type="time" aria-label={L.time.input} value={previewTime}
                    onChange={event => { setTimeOverride(event.target.value); setTimeSaveError(null) }} />
                  <Btn sm ghost onClick={() => { setTimeOverride(null); setNowHHmm(localHHmm()); setTimeSaveError(null) }}>{L.time.nowBtn}</Btn>
                </div>
                <Note>{placedText}</Note>
                {invalidTime && <Note tone="bad" role="alert">{L.time.invalid}</Note>}
                {isFutureTime && <Note tone="bad" role="alert">{L.time.future}</Note>}
              </>
            )}
            {timeSaveError && <Note tone="bad" role="alert">{L.time.saveError}</Note>}
          </>
        )}
      </Card>
    </>
  ) : null

  const whenBlock = editMealId == null && slotSeg ? (num: number) => (
    <>
      <Section n={num} title={L.when} />
      <Card className="fg-segc">{slotSeg}</Card>
    </>
  ) : null

  // Héj alatt, ha már vannak tételek: „Adj hozzá még" — a négy út csempéi, alattuk a szövegmező.
  const shellMore = shellOwnsEntry && showConfirm ? (num: number) => (
    <>
      <Section n={num} title={L.more} />
      <Card>
        {shell?.(true)}
        {aiPanelVisible && aiField}
        {aiBusy && <Note className="fg-busy" role="status">{L.busy}</Note>}
        {aiErr}
        {aiPanelVisible && (
          <Acts><Btn sm ghost disabled={!canRunAi || aiBusy} onClick={() => void runAi()}>{L.analyse}</Btn></Acts>
        )}
      </Card>
    </>
  ) : null

  // A9: a törlés KÉT lépés (prototípus `log.torles`) — élesítés, majd megerősítés. Egy
  // félrekoppintás nem töröl, és a megerősítő szöveg megmondja a következményt.
  const deleteBlock = editMealId != null ? (num: number) => (
    <>
      <Section n={num} title={L.del.title} />
      <Card className="fg-del">
        {deleteArmed ? (
          <>
            <Txt>{L.del.ask}</Txt>
            <Acts>
              <Btn sm bad onClick={() => { deleteMeal(editMealId); onSaved() }}>{L.del.yes}</Btn>
              <Lk onClick={() => setDeleteArmed(false)}>{L.del.keep}</Lk>
            </Acts>
          </>
        ) : (
          <Acts><Lk bad onClick={() => setDeleteArmed(true)}>{L.del.arm}</Lk></Acts>
        )}
      </Card>
    </>
  ) : null

  // A „Mégse" MARAD akkor is, ha még nincs mit megerősíteni: az a kiszállás ajtaja, nem
  // mentés-művelet. A mentés-gomb viszont csak akkor jelenik meg, ha van mit menteni —
  // egy tiltott „Logolás" gomb egy üres piszkozat alatt csak zaj (S1c.2, mezo-33k6).
  const foot = (
    <>
      <Btn ghost onClick={onCancel}>{L.cancel}</Btn>
      {showConfirm && (
        <Btn grow disabled={!canSave} onClick={save}>
          {editMealId != null ? L.saveEdit : saveLabel ?? L.save}
        </Btn>
      )}
    </>
  )

  return (
    <Page className="fg-composer" nonav={nonav} foot={foot}>
      {head}
      {shellOwnsEntry ? (
        // a teljes oldalas naplózó: üresen a „mi fér még bele" hős + a négy út; tételekkel a megerősítés
        showConfirm ? (
          <>{totalHero}{numbered(linesBlock, whenBlock, timeBlock, shellMore)}</>
        ) : (
          <>
            {emptyHero}
            {numbered((num) => (
              <>
                <Section n={num} title={L.from} />
                <Card>{shell?.(false)}</Card>
              </>
            ))}
          </>
        )
      ) : editMealId != null ? (
        // javítás: az étkezés, a sorai, az ideje, a bővítés és a törlés
        <>{totalHero}{numbered(linesBlock, timeBlock, ownSources, deleteBlock)}</>
      ) : (
        // a „Mit ettél?" lap (LogFlowPage): mikor · honnan · tételek
        <>{totalHero}{numbered(whenBlock, ownSources, linesBlock, timeBlock)}</>
      )}

      {kamraOpen && <KamraPickSheet onPick={addPantry} onClose={() => setKamraOpen(false)} addedRefIds={addedPantryIds} />}
      {receptOpen && <ReceptPickSheet onPick={addRecipe} onClose={() => setReceptOpen(false)} />}
    </Page>
  )
}

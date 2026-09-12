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
// forrás-kártyáját, a kézi Kamra/Recept pickereket pedig csak a GÉPELÉS úton kínálja
// (`manualSources`) — nem tűnnek el, csak oda kerülnek, ahol a kézi sor-felvétel értelmes (A3).
// A megerősítő rész (MIKOR · TÉTELEK · összegző kártya · mentés-CTA) ilyenkor csak az első sorral
// jelenik meg. Héj NÉLKÜL (a LogFlowPage-overlay: recept, kamra, Életjel, Rutin) minden marad,
// ahogy volt — a két prop alapértelmezése a mai viselkedés.
//
// provenance.origin: reflects whether AI genuinely contributed to THIS save
// (ai-photo when a photo was analyzed this session, else ai-text), regardless of
// how many manual lines ride alongside; a purely manual meal omits provenance —
// the LogFlowPage rule, kept verbatim (see that file's original header note).
// ============================================================
import { useEffect, useRef, useState } from 'react'
import type { FuelMeal, Ingredient, MealInput, MealItemInput, MealSlot, Recipe } from '@/data/types'
import { useFuelDay, useMealActions, useRecipes, usePantry } from '@/data/hooks'
import { reportDraftOutcome } from '@/data/aidraft/outcomeClient'
import { pct } from '@/shared/lib/pct'
import { nowOffsetIso, offsetIso, localDateString, huMonthDay } from '@/shared/lib/dates'
import { resizeImage } from '@/shared/lib/resizeImage'
import { Icon } from '@/shared/ui/Icon'
import { ClayIcon } from '@/shared/ui/clay'
import { MCells } from '@/shared/ui/mozaik'
import { NutrientCells } from '@/features/fuel/components/NutrientCells'
import { KamraPickSheet } from '@/features/fuel/sheets/KamraPickSheet'
import { ReceptPickSheet } from '@/features/fuel/sheets/ReceptPickSheet'
import { deriveMealName } from '@/features/fuel/logic/deriveMealName'
import { defaultMealSlot } from '@/features/fuel/logic/defaultMealSlot'
import { hhmmFromLoggedAt, mealSlotKey } from '@/features/fuel/logic/buildDayPlan'
import { parseAmountInput, stepAmount } from '@/features/fuel/logic/amountGuard'
import {
  computeRecipeNutrients, computeRecipeMacrosWithOverrides, computeRecipeNutrientsWithOverrides,
  rescaleFrozen, lineNutrients, scaleNutrients, sumNutrients, NO_NUTRIENTS, factsOf,
} from '@/data/fuel/recipeMacros'
import { RecipeOverrideRow } from '@/features/fuel/components/RecipeOverrideRow'
import { useVoiceInput, type VoiceState } from '@/features/insights/logic/useVoiceInput'

/** A mikrofon állapot-feliratai (A6, mezo-33k6). A „nem támogatott" ág NEM hazudik működőt:
 *  a gomb tiltott, és a felirata megmondja, miért. */
const VOICE_LABEL: Record<VoiceState, string> = {
  idle: 'Hang · mondd el, mit ettél',
  recording: 'Hallgatlak — koppints a leállításhoz',
  transcribing: 'Leiratozom a felvételt…',
  unsupported: 'Hang · ez a böngésző nem tud hangot rögzíteni',
}

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
  /** true when this line came out of the AI panel — shown as a ✨-suffixed source tag, so a
   *  pantry-matched AI line reads "kamra ✨" rather than pretending to be an estimate. */
  fromAi?: boolean
  needsReview?: boolean
  estimate?: EstimateSnapshot
  /** recipe arm only - ingredient array index -> amount, in the recipe's own unit (mezo-ormb). */
  overrides?: Record<number, number>
}

function lineMeta(l: DraftLine, recipes: Recipe[], ingredients: Ingredient[]) {
  // The tag names where the MACROS came from; ✨ marks who put the line there. Keeping the two
  // apart is why an AI line matched to a real Kamra row no longer lies about being an estimate
  // (mezo-qrks). `tag` alone feeds data-tag — prototype.css selects on its exact value.
  const tag = l.source === 'estimate' ? 'becslés' : l.source === 'recipe' ? 'recept' : 'kamra'
  // 'becslés' only ever comes from the AI panel (there's no manual estimate path), so the tag
  // already says "AI" on its own — a ✨ there would be redundant, not honest-making.
  const tagLabel = l.fromAi && l.source !== 'estimate' ? `${tag} ✨` : tag
  if (l.source === 'estimate') {
    const est = l.estimate!
    const per = est.per || 1
    const factor = l.amount / per
    return {
      name: l.name, tag, tagLabel, step: 10, min: 1,
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
      name: l.fromAi ? l.name : (r?.name ?? l.name), tag, tagLabel, step: 1, min: 1,
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
    name: l.fromAi ? l.name : (ing?.name ?? l.name), tag, tagLabel, step: 10, min: 1,
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
  /** S1c (mezo-33k6): opens the ✨ panel while true, for the camera-first shell's gépelés/hang
   *  modes. Mount-time opening stays `aiPanelOpenOnMount`'s job — this one reacts to later flips. */
  aiPanelOpen?: boolean
  /** S1c héj-kar (mezo-33k6): a photo chosen OUTSIDE the composer (the camera-first shell). A new
   *  file runs the composer's EXISTING photo arm — resizeImage → draftMealFromAi → the user
   *  confirms. There is exactly ONE AI call site, and it is here. */
  incomingPhoto?: File | null
  /** S1c héj-kar: text arriving from outside — a transcribed sentence or a „szokásos" row's name.
   *  It lands in the SAME ✨ text field the typing arm uses; `run` starts the analysis at once
   *  (the draft still needs the user's confirmation before anything is saved). `seq` makes a
   *  repeated identical sentence a new event. */
  incomingAiText?: { text: string; seq: number; run?: boolean } | null
  /** S1c: the PHOTO arm failed — the shell raises its first-class failure state (A4), which
   *  offers the other three routes instead of an error toast. */
  onAiFailed?: () => void
  /** Melyik napra könyvelődik a mentés (ISO local date). Absent = ma (nowOffsetIso, byte-azonos). */
  logDate?: string
  /** A loggedAt idő-komponense HH:mm (ablak-indítás: az ablak ideje). Absent = slot-alap idő. */
  logTime?: string
  /** A mentés-CTA felirata (múltbeli nap). Absent = a meglévő felirat. */
  saveLabel?: string
  /** S1c.2 (mezo-33k6): egy mód-héj (`FuelLogModes`) ül FÖLÖTTE, és az már birtokolja a „hogyan
   *  kezdem" kérdést. Ilyenkor a composer elhagyja a SAJÁT ✨ AI forrás-kártyáját (az az egyetlen
   *  valódi duplikáció), és a megerősítő részt csak akkor mutatja, ha van mit megerősíteni.
   *  Alapértelmezése `false`: a héj NÉLKÜL futó hívók (a LogFlowPage-overlay — recept, kamra,
   *  Életjel, Rutin) bájtazonosan úgy renderelnek, ahogy eddig. */
  shellOwnsEntry?: boolean
  /** S1c.2 (mezo-33k6): most relevánsak-e a KÉZI források (Kamra · Recept)? A héj alatt ez a
   *  gépelés út szerződése (manifeszt A3: a kézi naplózás nem tűnik el, csak odakerül, ahol a
   *  kézi sor-felvétel értelmes). Alapértelmezése `true` — a héj nélküli hívók változatlanok. */
  manualSources?: boolean
  /** S1c (mezo-33k6, A8 · A9): egy MÁR LOGOLT étkezés szerkesztése. Jelen esetén a composer abból
   *  az étkezésből indul (sorok, cím, ablak, idő), a mentés `updateMeal`-t hív `logMeal` helyett,
   *  és megjelenik a két lépéses törlés. A javításról SOSEM megy AI-piszkozat-visszajelzés: az a
   *  jelzés a piszkozat minőségéről beszél, nem a korrekcióról. */
  editMealId?: string
  onSaved: () => void
  onCancel: () => void
}

export function MealComposer({
  fixedSlot, initialSlot, prefill, aiPanelOpenOnMount, aiPanelOpen,
  incomingPhoto, incomingAiText, onAiFailed,
  shellOwnsEntry = false, manualSources = true,
  logDate, logTime, saveLabel, editMealId, onSaved, onCancel,
}: MealComposerProps) {
  const { recipes } = useRecipes()
  const { ingredients } = usePantry()
  const { fuel } = useFuelDay(logDate)
  const { logMeal, updateMeal, deleteMeal, draftMealFromAi } = useMealActions(logDate)

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
  // A6 (mezo-33k6): a hang ugyanabba a szövegmezőbe ír, amiből az AI-piszkozat készül — a
  // leiratozás a meglévő `useTranscribe` végponton fut, a draft-hívás változatlan (`ai-text`).
  const voice = useVoiceInput(text => setAiText(d => (d ? `${d} ${text}` : text)))
  const voiceRecording = voice.state === 'recording'
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

  // Honest totals-line label (mezo-1j3z, finding 5): "Mai nap eddig" lies when logDate targets a
  // past day — show the day it actually books to instead.
  const totalsDayLabel = logDate != null && logDate !== localDateString()
    ? `${huMonthDay(logDate).toLowerCase()}. eddig`
    : 'Mai nap eddig'

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
      setAiPhoto(null)
      setAiOpen(false)
    } catch {
      setAiError('Nem sikerült az AI-feldolgozás. Próbáld újra, vagy add hozzá kézzel.')
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
  const shellPhotoRef = useRef<File | null>(null)
  useEffect(() => {
    if (!incomingPhoto || shellPhotoRef.current === incomingPhoto) return
    shellPhotoRef.current = incomingPhoto
    setAiPhoto(incomingPhoto)
    void runAiWith(incomingPhoto, aiText)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fires on a NEW file only; the text/run closure is read at that moment
  }, [incomingPhoto])

  const shellTextSeqRef = useRef(0)
  useEffect(() => {
    if (!incomingAiText || incomingAiText.seq === shellTextSeqRef.current) return
    shellTextSeqRef.current = incomingAiText.seq
    const next = aiText ? `${aiText} ${incomingAiText.text}` : incomingAiText.text
    setAiText(next)
    setAiOpen(true)
    if (incomingAiText.run) void runAiWith(null, next)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fires on a NEW seq only
  }, [incomingAiText])

  useEffect(() => { if (aiPanelOpen) setAiOpen(true) }, [aiPanelOpen])

  const canSave = lines.length > 0
  const save = () => {
    if (!canSave) return
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
      slot: fixedSlot ?? slot,
      // A8: a javítás az étkezés SAJÁT idejét viszi (a szerkesztő idő-mezőjéből), nem tolja
      // mostra — különben egy reggeli javítása este átköltöztetné a reggelit.
      loggedAt: editMeal != null
        ? offsetIso(logDate ?? editMeal.mealDate ?? localDateString(), editTime || hhmmFromLoggedAt(editMeal.loggedAt, SLOT_DEFAULT_TIME[fixedSlot ?? slot]))
        : logDate != null
          ? offsetIso(logDate, logTime ?? SLOT_DEFAULT_TIME[fixedSlot ?? slot])
          : nowOffsetIso(),
      title: effectiveName.trim() || null,
      items,
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
    if (aiContribution && aiDraftId) {
      const draftId = aiDraftId
      const outcome = aiLinesEditedRef.current ? 'edited' : 'accepted'
      outcomeReportedForRef.current = draftId
      logMeal(input, { onSuccess: () => reportDraftOutcome(draftId, 'meal_draft', outcome) })
    } else {
      logMeal(input)
    }
    onSaved()
  }

  const addedPantryIds = lines.filter(l => l.source === 'pantry' && l.refId).map(l => l.refId!)

  // ── S1c.2 láthatósági szerződés (mezo-33k6) ─────────────────────────────────────────────────
  // Héj NÉLKÜL mindhárom kapu nyitva van — a LogFlowPage-overlay (recept, kamra, Életjel, Rutin)
  // pontosan úgy renderel, ahogy eddig. Héj alatt: a bejárat a héjé, a megerősítés a miénk.
  const showAiSource = !shellOwnsEntry
  const showManualSources = !shellOwnsEntry || manualSources
  const showSourceRow = showAiSource || showManualSources
  // „Van mit megerősíteni": legalább egy piszkozat-sor, vagy egy már logolt étkezés javítása.
  const showConfirm = !shellOwnsEntry || lines.length > 0 || editMealId != null

  return (
    <div className="logflow-composer">
      {fixedSlot == null && showConfirm && (
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

      {showSourceRow && (
        <>
          <span className="label-mono" style={{ fontSize: 8.5, letterSpacing: '0.12em', color: 'var(--text-tertiary)' }}>HONNAN ADOD HOZZÁ?</span>
          {/* A kalauz-horgony CSAK a héj nélküli felületen ül itt (a teljes oldalon a héj
              mód-sora viseli ugyanezt a nevet) — így pontosan egy elem hordozza, és a
              „Mutasd meg" gomb mindig a valóban aktuális „hogyan adod hozzá" felületre mutat. */}
          <div className="logflow-srctiles" {...(shellOwnsEntry ? {} : { 'data-kalauz-anchor': 'log-forrasok' })}>
            {showManualSources && (
              <>
                <button type="button" className="logflow-srct tone-gold" onClick={() => setKamraOpen(true)} aria-label="Kamra · hozzáadás">
                  <ClayIcon name="i-kamra" size={26} />
                  <b>Kamra</b><small>polcról, grammra</small>
                </button>
                <button type="button" className="logflow-srct tone-coral" onClick={() => setReceptOpen(true)} aria-label="Recept · hozzáadás">
                  <ClayIcon name="i-recept" size={26} />
                  <b>Recept</b><small>adagra</small>
                </button>
              </>
            )}
            {showAiSource && (
              <button type="button" className={'logflow-srct tone-lav' + (aiOpen ? ' on' : '')} onClick={() => setAiOpen(o => !o)} aria-label="✨ AI · fotó vagy szöveg" aria-pressed={aiOpen}>
                <Icon name="sparkle" size={22} color="var(--lav-deep)" />
                <b>✨ AI</b><small>fotó vagy szöveg</small>
              </button>
            )}
          </div>
        </>
      )}

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
            <button type="button" className={'chip' + (voiceRecording ? ' brand' : '')}
              style={{ fontSize: 11, padding: '6px 12px' }}
              onClick={voice.toggle}
              disabled={voice.state === 'unsupported' || voice.state === 'transcribing'}
              aria-label={VOICE_LABEL[voice.state]} aria-pressed={voiceRecording}>
              <Icon name={voiceRecording ? 'voice-wave' : 'mic'} size={12} />
              {voiceRecording ? 'Hallgatlak…' : voice.state === 'transcribing' ? 'Leiratozom…' : 'Hang'}
            </button>
            <button type="button" className="cta-primary" style={{ marginLeft: 'auto', padding: '6px 16px' }}
              disabled={!canRunAi} onClick={() => void runAi()}>
              ✨ Elemzés
            </button>
          </div>
          {aiError && <p style={{ fontSize: 11, color: 'var(--error)', marginTop: 8 }}>{aiError}</p>}
          {voice.error && <p style={{ fontSize: 11, color: 'var(--error)', marginTop: 8 }}>{voice.error}</p>}
          <p className="text-secondary" style={{ fontSize: 9.5, lineHeight: 1.5, marginTop: 8 }}>
            Szöveg, hang vagy fotó — vagy mindhárom. A felismert sorok a tételek közé kerülnek, ott mindent átírhatsz.
          </p>
        </div>
      )}

      {showConfirm && (
        <div className="row" style={{ alignItems: 'center', gap: 9, margin: '14px 2px 9px' }}>
          <span className="label-mono" style={{ fontSize: 9.5, letterSpacing: '0.2em', color: 'var(--text-tertiary)' }}>TÉTELEK</span>
          <span className="label-mono" style={{ fontSize: 9.5, color: 'var(--coral)' }}>{lines.length}</span>
          <span style={{ flex: 1, height: 1, background: 'linear-gradient(90deg,var(--border-subtle),transparent)' }} />
        </div>
      )}

      {showConfirm && lines.length === 0 && (
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
                <span className="logflow-lntag" data-tag={meta.tag}>{meta.tagLabel}</span>
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
              <p className="logflow-lnnote">
                {l.source === 'pantry'
                  ? '✨ Ezt a kamrádból párosítottuk név alapján — ellenőrizd, hogy tényleg ez a tétel, és nézd át a mennyiséget.'
                  : '✨ Az AI nem teljesen biztos ebben a sorban — nézd át a mennyiséget.'}
              </p>
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
                                  ?? (src ? round((src.macros.kcal ?? 0) * (ing.amount / (src.per || 1))) : 0))
                              : (src
                                  ? round((src.macros.kcal ?? 0) * (amount / (src.per || 1)))
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

      {showConfirm && <div className="rad-12" style={{ padding: '11px 12px', marginTop: 12, background: 'color-mix(in srgb, var(--sage) 5%, transparent)', border: '1px solid var(--line)' }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
          <span className="label-mono" style={{ fontSize: 9, letterSpacing: '0.14em', color: 'var(--coral)' }}>EZ AZ ÉTKEZÉS</span>
          <span className="label-mono" style={{ fontSize: 8.5, color: 'var(--text-tertiary)' }}>{lines.length} tétel</span>
        </div>
        {/* The derived name IS the meal title (no name field, mezo-byo1) — shown where it
            will land, honest to what save() sends. */}
        {effectiveName && <div className="logflow-totname">{effectiveName}</div>}
        <MCells cells={[
          { label: 'kcal', value: total.kcal, tone: 'sage' },
          { label: 'fehérje', value: `${total.p} g`, tone: 'coral' },
          { label: 'szénh.', value: `${total.c} g`, tone: 'gold' },
          { label: 'zsír', value: `${total.f} g`, tone: 'lav' },
        ]} />
        <div style={{ marginTop: 6 }}><NutrientCells nutrients={totalNutrients} size="md" /></div>
        <div style={{ marginTop: 9, paddingTop: 8, borderTop: '1px solid var(--border-subtle)' }}>
          <div className="row" style={{ justifyContent: 'space-between', fontVariantNumeric: 'tabular-nums', fontSize: 8.5, color: 'var(--text-tertiary)', marginBottom: 5 }}>
            <span>{totalsDayLabel} <b style={{ color: 'var(--text-secondary)' }}>{fuel.consumed.kcal}</b> <span style={{ color: 'var(--coral)' }}>+{total.kcal}</span> = <b style={{ color: 'var(--text-secondary)' }}>{after}</b></span>
            <span>cél <b style={{ color: 'var(--text-secondary)' }}>{fuel.targets.kcal}</b> kcal</span>
          </div>
          <div style={{ height: 5, background: 'var(--surface-2)', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: nowPct + '%', background: 'var(--text-tertiary)' }} />
            <div style={{ position: 'absolute', left: nowPct + '%', top: 0, bottom: 0, width: addPct + '%', background: 'var(--coral)' }} />
          </div>
        </div>
      </div>}

      {/* A8: a szerkesztő idő-mezője — az étkezés SAJÁT ideje, amit a user át is írhat. */}
      {editMealId != null && (
        <label className="fmx-edit-time">
          <span className="label-mono">MIKOR ETTÉL?</span>
          <input type="time" value={editTime} aria-label="Mikor ettél?"
            onChange={(e) => setEditTime(e.target.value)} />
        </label>
      )}

      {/* A „Mégse" MARAD akkor is, ha még nincs mit megerősíteni: az a kiszállás ajtaja, nem
          mentés-művelet. A mentés-CTA viszont csak akkor jelenik meg, ha van mit menteni —
          egy tiltott „Logolás" gomb egy üres piszkozat alatt csak zaj (S1c.2, mezo-33k6). */}
      <div className="row gap-sm logflow-actions" style={{ margin: '14px 0 12px' }}>
        <button className="cta-ghost" onClick={onCancel} style={{ flex: 1 }}>Mégse</button>
        {showConfirm && (
          <button className="cta-primary" disabled={!canSave} onClick={save} style={{ flex: 1.8 }}>
            {editMealId != null
              ? <><Icon name="check" size={15} /> Mentem a javítást</>
              : saveLabel ?? <><Icon name="check" size={15} /> Logolás · +10 XP</>}
          </button>
        )}
      </div>

      {/* A9: a törlés KÉT lépés (prototípus `deleteBlock`) — élesítés, majd megerősítés. Egy
          félrekoppintás nem töröl, és a megerősítő szöveg megmondja a következményt. */}
      {editMealId != null && (
        <div className="fmx-delete">
          {deleteArmed ? (
            <>
              <p>Biztosan törlöd? A nap összegéből is kikerül.</p>
              <button type="button" className="fmx-delete-yes"
                onClick={() => { deleteMeal(editMealId); onSaved() }}>
                Biztosan törlöm
              </button>
              <button type="button" onClick={() => setDeleteArmed(false)}>Inkább megtartom</button>
            </>
          ) : (
            <button type="button" onClick={() => setDeleteArmed(true)}>Törlöm</button>
          )}
        </div>
      )}

      {kamraOpen && <KamraPickSheet onPick={addPantry} onClose={() => setKamraOpen(false)} addedRefIds={addedPantryIds} />}
      {receptOpen && <ReceptPickSheet onPick={addRecipe} onClose={() => setReceptOpen(false)} />}
    </div>
  )
}

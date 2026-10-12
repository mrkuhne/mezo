// ============================================================
// Mezo · RecipeWorkshopPage (Receptműhely — AI recept-builder, mezo-92pb)
// Approved prototype: docs/design_2.0/prototypes/receptmuhely.html. Vászon-first hibrid —
// az oldal MAGA az élő receptkártya (név + cél-chip, makró-összkép, adag-stepper,
// hozzávaló-sorok, elkészítés), a chat alul dokkol (WorkshopChatDock).
//
// Három szabály tartja együtt:
//  1. MINDEN makrót a vászon számol (`draftTotals`/`lineMacros` a kamra-tényekből) — az LLM
//     csak hozzávalót és mennyiséget javasol, számot soha. Ami nem oldható fel, az „—".
//  2. Patch-szemantika: egy kör a TELJES új vázlatot hozza, de a `diffLineKeys` csak az
//     ÚJ/megváltozott sorokat villantja aranyra (2.6 s), a többi (a kézi szerkesztéseiddel
//     együtt) vizuálisan érintetlen marad.
//  3. Mentés-kapu: `draftToInput` `null`-t ad, amíg bármelyik sor `estimate` — a gomb tiltva,
//     a sor maga kínálja a kiutat (Csere kamra-itemre / Törlés).
//
// Minden állapot LOKÁLIS (nincs perzisztálás): egy műhely-menet a mentésig él. A ?recipeId
// paraméter egy meglévő receptből tölti a vázlatot (`recipeToDraft`) + a base-metát, és
// mentéskor update-et csinál create helyett. A ?fromMeal (+ ?d) paraméter egy LOGOLT étkezésből
// tölti (`mealToDraft`, mezo-n9wgg): az új recept create-tel mentődik, az étkezés érintetlen.
//
// S4 (Fuel Titanium, mezo-hygp) — ÉLŐ ELŐNÉZET: a vászon azokat a blokkokat rajzolja, amiket a
// recept-részletlap (és az étkezés-részletlap) visz — Makrók / Hozzávalók / Minőség /
// Mikrotápanyagok —, UGYANAZOKKAL a komponensekkel (`FuelQualityBlocks`). Owner-döntés: amit
// iterálás közben látsz, az legyen a mentett recept. A Minőség és a Mikrotápanyagok SZÁMAI
// kizárólag valódi kamra-tényből jönnek (`draftQualityLines` / `draftNutrients`): egy becsült
// sor NEM ad tápanyag-számot, mert a modell tápanyag-tényt SOHA nem találhat ki.
// Vizuális referencia: a prototípus `muhelyPage` (:115) vászon-dokk tagolása, `runTurn` (:158)
// és `saveWorkshop` (:171).
//
// Folyadék (mezo-n4wf5.5, fuel.js `muhely()`): the empty canvas is the EMPTY POT with the request
// dock inside the hero; with a draft the hero is the name, the pot (its level = the share of lines
// that come from the pantry), the kcal, the servings stepper + basis switch, the verdict that says
// whether it can be saved, and the save button on the liquid. Then 1 Hozzávalók, the shared blocks
// (Makrók / Minőség / Mikrotápanyagok), Elkészítés, and „Kérj módosítást" — the dock as a card of
// the page (no floating bar). Words in `fuelRecept.workshop`.
// ============================================================
import { SafeMarkdown } from '@/shared/lib/safeMarkdown'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useLeaveAfterMutation } from '@/shared/hooks/useBackNav'
import { useQuery } from '@tanstack/react-query'
import type { Recipe, RecipeRole, WorkshopDraft, WorkshopGoal, WorkshopLine } from '@/data/types'
import { useFuelDay, useRecipes, useRecipeActions, useWorkshop } from '@/data/hooks'
import { isMockMode } from '@/data/_client/mode'
import { recipeApi } from '@/data/fuel/recipeApi'
import { usePickableIngredients, type PickableIngredient } from '@/data/fuel/pantryPickables'
import { NO_NUTRIENTS, roundMacro, scaleNutrients } from '@/data/fuel/recipeMacros'
import {
  draftNutrients, draftQualityLines, draftTotals, draftToInput, diffLineKeys, goalRole, lineKey,
  lineMacros, mealToDraft, recipeToDraft, scaleServings,
} from '@/data/fuel/workshopState'
import { useM } from '@/shared/i18n'
import { fmtGrouped } from '@/shared/lib/format'
import { useToast } from '@/shared/ui/ToastProvider'
import {
  Btn, Card, Empty, FrameBack, Hero, Input, Note, Page, Section, Stepper, TwoBtn, Txt, useFrameTitle,
} from '@/shared/ui/folyadek'
import { NumG, Pot } from '@/features/fuel/components/folyadek'
import { IngredientPickerSheet } from '@/features/fuel/sheets/IngredientPickerSheet'
import { ServingToggle, type ServingBasis } from '@/features/fuel/components/ServingToggle'
import {
  FuelMacroShareSection, FuelMicroNote, FuelMicroSection, FuelQualitySection,
} from '@/features/fuel/components/FuelQualityBlocks'
import { mealMacroShare } from '@/features/fuel/logic/mealShare'
import { WorkshopIngredientRow } from '@/features/fuel/components/workshop/WorkshopIngredientRow'
import { WorkshopChatDock, type WorkshopChatMessage } from '@/features/fuel/components/workshop/WorkshopChatDock'

/** The base fields a workshop draft does NOT model — carried through verbatim from the seed
 *  recipe (or defaults) so a save is never a silent full-replace that drops them. `role` is one
 *  of them: an untouched workshop session must NOT retarget a saved recipe's scoring rubric
 *  (the mezo-uavr wipe class — only an explicit goal preset may change it). */
interface BaseMeta {
  slot?: string | null
  tags: string[]
  starred: boolean
  prepMins?: number | null
  cookMins?: number | null
  role: RecipeRole
}

const DEFAULT_META: BaseMeta = { slot: null, tags: [], starred: false, prepMins: 0, cookMins: 0, role: 'standard' }

const FLASH_MS = 2600

/** `**…**` in a catalog sentence marks its bold part. */
export function RecipeWorkshopPage() {
  const M = useM()
  const C = M.fuelRecept.common
  const W = M.fuelRecept.workshop
  const navigate = useNavigate()
  const leave = useLeaveAfterMutation()
  const [params] = useSearchParams()
  const seedId = params.get('recipeId')
  const fromMealId = seedId ? null : params.get('fromMeal')
  const fromMealDay = params.get('d')
  const { recipes, pending: recipesPending } = useRecipes()
  const { create, update } = useRecipeActions()
  const { workshopTurn } = useWorkshop()
  const pool = usePickableIngredients()
  const { show } = useToast()

  // --- page state (all local — a workshop session lives until it is saved) ---
  const [draft, setDraft] = useState<WorkshopDraft | null>(null)
  const [history, setHistory] = useState<WorkshopChatMessage[]>([])
  const [goal, setGoal] = useState<WorkshopGoal | null>(null)
  const [diffKeys, setDiffKeys] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<{ retryText: string } | null>(null)
  const [baseMeta, setBaseMeta] = useState<BaseMeta>(DEFAULT_META)
  const [sourceRecipeId, setSourceRecipeId] = useState<string | null>(null)
  // --- composer / sheet state ---
  const [text, setText] = useState('')
  const [basis, setBasis] = useState<ServingBasis>('serving')
  const [contextNames, setContextNames] = useState<string[]>([])
  // null = closed, 'context' = kamra entry picker, a number = replace THAT estimate line
  const [picker, setPicker] = useState<'context' | number | null>(null)
  const [seededFrom, setSeededFrom] = useState<string | null>(null)

  // ?recipeId seed — the list cache first (synchronous in mock), the single-recipe GET as the
  // real-mode fallback for a cold deep link. Never fired in mock mode: there is no server there.
  const cached = seedId ? recipes.find(r => r.id === seedId) : undefined
  const { data: fetched } = useQuery({
    queryKey: ['recipe', seedId],
    queryFn: () => recipeApi.get(seedId as string),
    enabled: Boolean(seedId) && !cached && !isMockMode(),
  })
  const seedRecipe: Recipe | undefined = cached ?? fetched

  // Seed during render (no useEffect → no extra paint of the empty canvas). Guarded by the id
  // it was seeded from, so a later cache update never overwrites the user's edits.
  if (seedRecipe && seededFrom !== seedRecipe.id) {
    setSeededFrom(seedRecipe.id)
    setDraft(recipeToDraft(seedRecipe))
    setBaseMeta({
      slot: seedRecipe.slot || null,
      tags: seedRecipe.tags,
      starred: seedRecipe.starred,
      prepMins: seedRecipe.prepMins,
      cookMins: seedRecipe.cookMins,
      role: seedRecipe.role,
    })
    setSourceRecipeId(seedRecipe.id)
  }

  // ?fromMeal seed (mezo-n9wgg) — a logged meal becomes a NEW recipe: the meal resolves exactly
  // as on its detail page (`useFuelDay(?d)` + find), and a recipe line waits for the recipe list
  // so it can expand into ingredients. `sourceRecipeId` stays null → save is a create; the
  // logged meal itself is never touched.
  const { fuel: fromMealFuel } = useFuelDay(fromMealDay ?? undefined)
  const seedMeal = fromMealId ? fromMealFuel.meals.find(m => m.id === fromMealId) : undefined
  const mealSeedKey = seedMeal ? `meal:${seedMeal.id}` : null
  const mealSeedReady = seedMeal != null
    && (!recipesPending || !seedMeal.mealItems.some(l => l.source === 'recipe'))
  if (seedMeal && mealSeedReady && seededFrom !== mealSeedKey) {
    setSeededFrom(mealSeedKey)
    setDraft(mealToDraft(seedMeal, recipes, pool))
  }

  // The gold flash is a one-shot: clear the keys 2.6 s after a turn (the CSS keyframe's length),
  // and never leave a timer behind on unmount.
  // Per-line rescale base for estimate rows (see `setAmount`) — a ref, so a keystroke never
  // re-renders on it and a turn can reset it.
  const estBase = useRef(new Map<string, { amount: number; est: { kcal: number; p: number; c: number; f: number } }>())

  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (flashTimer.current) clearTimeout(flashTimer.current) }, [])
  const flash = useCallback((keys: string[]) => {
    setDiffKeys(keys)
    if (flashTimer.current) clearTimeout(flashTimer.current)
    flashTimer.current = setTimeout(() => setDiffKeys([]), FLASH_MS)
  }, [])

  // --- turn flow -------------------------------------------------------------
  // The user bubble is pushed BEFORE the call and survives a failure (the error bubble's whole
  // promise is „az üzeneted megvan"); `history` on the wire is the conversation BEFORE this
  // message, which is what the backend prompt builder appends `message` to.
  const runTurn = useCallback(async (message: string, forGoal: WorkshopGoal | null, prior?: WorkshopChatMessage[]) => {
    if (busy) return
    // `prior` lets a RETRY pass the history it just trimmed the failed bubble out of: the state
    // update behind that trim is not visible in this closure, so reading `history` here would
    // put the retried message on the wire TWICE (once in history, once as `message`).
    const priorHistory = prior ?? history
    setHistory(h => [...h, { role: 'user', text: message }])
    setError(null)
    setBusy(true)
    try {
      const res = await workshopTurn({ message, goal: forGoal, history: priorHistory, draft })
      flash(diffLineKeys(draft, res.draft))
      // The incoming draft's `est` values are authoritative — the old rescale bases would keep
      // scaling a line off a snapshot the model has just replaced.
      estBase.current.clear()
      setDraft(res.draft)
      setHistory(h => [...h, { role: 'assistant', text: res.reply }])
      setContextNames([])
    } catch {
      setError({ retryText: message })
    } finally {
      setBusy(false)
    }
  }, [busy, draft, flash, history, workshopTurn])

  // Kamra-picked items ride along as context for THIS turn (the prototype's ctx chips).
  const compose = (message: string) =>
    contextNames.length > 0 ? `${message}\n${W.fromPantry(contextNames.join(', '))}` : message

  const send = () => {
    const t = text.trim()
    if (!t || busy) return
    setText('')
    void runTurn(compose(t), goal)
  }

  const tapPreset = (g: WorkshopGoal) => {
    if (busy) return
    setGoal(g)
    void runTurn(compose(W.goalMessage[g]), g)
  }

  const retry = () => {
    if (!error || busy) return
    const failed = error.retryText
    // Replace the failed turn, don't append a second copy of the same user bubble — and send the
    // TRIMMED history, so the retried payload carries the message exactly once.
    const trimmed = history.length > 0 && history[history.length - 1].role === 'user' ? history.slice(0, -1) : history
    setHistory(trimmed)
    setError(null)
    void runTurn(failed, goal, trimmed)
  }

  const editFailed = () => {
    if (!error) return
    setText(error.retryText)
    setHistory(h => (h.length > 0 && h[h.length - 1].role === 'user' ? h.slice(0, -1) : h))
    setError(null)
  }


  // --- canvas edits ----------------------------------------------------------
  // A manual amount edit on an ESTIMATE line rescales its frozen `est` snapshot — there is no
  // pantry row to recompute an estimate from, so the ratio is the only honest rule (the same one
  // `scaleServings` applies). The base is the amount+est pair the line ARRIVED with, held per
  // line key and reset by every turn — NOT the previous keystroke's values:
  //   · chained per-keystroke ratios erode precision (a select-all-retype walks 2 → 20 → 200), and
  //   · an empty field passes through amount 0, which would zero `est` and make recovery a
  //     division by zero — the row would then read 0 kcal forever.
  // While the field is empty/0 the snapshot is therefore left ALONE, not scaled to nothing.
  const setAmount = (l: WorkshopLine, amount: number): WorkshopLine => {
    if (l.source !== 'estimate' || !l.est) return { ...l, amount }
    const key = lineKey(l)
    let base = estBase.current.get(key)
    if (!base) {
      base = { amount: l.amount, est: l.est }
      estBase.current.set(key, base)
    }
    if (amount <= 0 || base.amount <= 0) return { ...l, amount }
    const factor = amount / base.amount
    return {
      ...l,
      amount,
      est: {
        kcal: roundMacro(base.est.kcal * factor),
        p: roundMacro(base.est.p * factor),
        c: roundMacro(base.est.c * factor),
        f: roundMacro(base.est.f * factor),
      },
    }
  }

  const patchLine = (i: number, next: (l: WorkshopLine) => WorkshopLine) =>
    setDraft(d => (d ? { ...d, lines: d.lines.map((l, ix) => (ix === i ? next(l) : l)) } : d))
  const dropLine = (i: number) =>
    setDraft(d => (d ? { ...d, lines: d.lines.filter((_, ix) => ix !== i) } : d))

  const onPick = (ing: PickableIngredient) => {
    if (picker === 'context') {
      setContextNames(prev => (prev.includes(ing.name) ? prev : [...prev, ing.name]))
      return
    }
    if (typeof picker === 'number') {
      // Csere: the estimate row becomes a real pantry line — its `est` snapshot goes away with it,
      // which is exactly what unblocks the save gate.
      patchLine(picker, () => ({
        source: 'pantry',
        refId: ing.id,
        name: ing.name,
        amount: ing.per || 100,
        unit: ing.unit || 'g',
      }))
      setPicker(null)
    }
  }

  // --- save flow -------------------------------------------------------------
  // Only an explicitly picked goal may set the role; otherwise the seed recipe's own role rides
  // through untouched (a fresh session's default is `standard`, which is what a new recipe gets).
  const input = draft ? draftToInput(draft, baseMeta, goal ? goalRole(goal) : baseMeta.role) : null
  const canSave = Boolean(input) && (draft?.lines.length ?? 0) > 0 && (draft?.name.trim().length ?? 0) > 0
  const save = () => {
    if (!input || !canSave) return
    if (sourceRecipeId) {
      update(sourceRecipeId, input)
      show({ kind: 'success', text: W.toastUpdated })
      // `?recipeId=` is only ever opened from that recipe's page: pop back onto it
      leave.back(`/fuel/recipes/${sourceRecipeId}`)
    } else {
      create(input)
      show({ kind: 'success', text: W.toastSaved })
      navigate('/fuel/recipes', { replace: true })
    }
  }

  const totals = draft ? draftTotals(draft, pool) : { kcal: 0, p: 0, c: 0, f: 0 }
  const flashSet = new Set(diffKeys)
  // Az előnézet számai: a bázis-váltó csak OSZT, új makrót nem szül.
  const per = basis === 'whole' ? 1 : Math.max(1, draft?.servings ?? 1)
  const shown = {
    kcal: Math.round(totals.kcal / per),
    p: Math.round(totals.p / per),
    c: Math.round(totals.c / per),
    f: Math.round(totals.f / per),
  }
  const shares = mealMacroShare(shown)
  // Amit a kamra nem tud feloldani, azt MEGNEVEZZÜK — nem pótoljuk becsléssel.
  const unresolved = draft
    ? draft.lines.filter(l => l.source === 'pantry' && lineMacros(l, pool) == null).length
    : 0
  const qualityLines = draft ? draftQualityLines(draft, pool) : []
  const rawNutrients = draft ? draftNutrients(draft, pool) : NO_NUTRIENTS
  const previewNutrients = basis === 'whole' ? rawNutrients : scaleNutrients(rawNutrients, 1 / per)

  useFrameTitle({ title: W.title, eyebrow: C.fuelRecipes })
  const back = <FrameBack className="fo-backpill" history fallback="/fuel/recipes">‹</FrameBack>

  const dock = (
    <WorkshopChatDock
      goal={goal}
      onGoal={tapPreset}
      text={text}
      onText={setText}
      busy={busy}
      history={history}
      error={error ? { message: W.error, retryText: error.retryText } : null}
      onSend={send}
      onRetry={retry}
      onEditFailed={editFailed}
      onOpenPantry={() => setPicker('context')}
      contextNames={contextNames}
      onDropContext={n => setContextNames(prev => prev.filter(x => x !== n))}
    />
  )
  const pickerSheet = picker !== null && (
    <IngredientPickerSheet
      onPick={onPick}
      onClose={() => setPicker(null)}
      mode={picker === 'context' ? 'round' : 'swap'}
      addedRefIds={picker === 'context' ? [] : (draft?.lines.map(l => l.refId ?? '') ?? [])}
    />
  )

  if (!draft) {
    /* A kiinduló vászon: az üres fazék, egy kérdés, és a cél-gombok — nem üres képernyő.
       NB: a „Mit főzzünk ki?" a CHAT nyitó kérdése, NEM a B17 „mit főzzünk az itthon lévőből"
       felület — az owner azt kivette: itt te mondod meg a célt, nem a kamra-készlet generál listát. */
    return (
      <Page className="fc-page">
        {back}
        <Hero className="fc-ghero" label={W.emptyLabel} verdict={busy ? W.emptyVerdictBusy : W.emptyVerdict} sub={W.emptySub}
          graphic={<div className="fc-potc" aria-hidden="true"><Pot pct={0} size={150} /></div>}
        >
          {dock}
        </Hero>
        <Section n={1} title={W.howSection} />
        <Card>
          <Txt>{W.how}</Txt>
          <Note>{W.principle}</Note>
        </Card>
        {pickerSheet}
      </Page>
    )
  }

  const whole = basis === 'whole'
  const lineCount = draft.lines.length
  const nEst = draft.lines.filter(l => l.source === 'estimate').length
  const nOk = lineCount - nEst
  const hasSteps = draft.steps.length > 0
  const saveLabel = sourceRecipeId ? W.update : W.save

  return (
    <Page className="fc-page">
      {back}
      {/* A számok már KÉSZEN jönnek (`draftTotals` a kamra-tényekből) — itt nem születik makró. */}
      <Hero className="fc-ghero"
        label={sourceRecipeId ? W.labelFromRecipe : fromMealId ? W.labelFromMeal : goal ? W.labelDraftGoal(W.goal[goal]) : W.labelDraft}
        verdict={lineCount === 0 ? W.verdictEmpty
          : nEst > 0 ? W.verdictEstimate(nEst)
            : !canSave ? W.verdictNoName
              : sourceRecipeId ? W.verdictUpdate : W.verdictReady}
        sub={nEst > 0 ? W.subEstimate : fromMealId ? W.subFromMeal : undefined}
        actions={<Btn disabled={!canSave} onClick={save}>{saveLabel}</Btn>}
        graphic={<><Input className="fc-name" value={draft.name} aria-label={W.nameAria} placeholder={W.nameAria}
          onChange={e => setDraft(d => (d ? { ...d, name: e.target.value } : d))} />
        <NumG graphic={<Pot pct={lineCount ? Math.max(8, (nOk / lineCount) * 100) : 0} size={104} />}
          value={fmtGrouped(shown.kcal)} unit={whole ? C.kcalWhole : C.kcalPerServing}>
          <p>{lineCount === 0 ? W.potEmpty : nEst > 0 ? <SafeMarkdown text={W.potMixed(lineCount, nOk, nEst)} /> : W.potAll(lineCount)}</p>
        </NumG></>}
      >
        <TwoBtn className="fc-ws">
          <div>
            <Stepper className="fc-stp" name={C.servingsName} n={draft.servings} min={1} max={12}
              value={<>{draft.servings}<small>{C.servingUnit(draft.servings)}</small></>}
              onDec={() => setDraft(d => (d ? scaleServings(d, d.servings - 1) : d))}
              onInc={() => setDraft(d => (d ? scaleServings(d, d.servings + 1) : d))} />
          </div>
          <div><ServingToggle short value={basis} servings={draft.servings} onChange={setBasis} /></div>
        </TwoBtn>
      </Hero>

      <Section n={1} title={C.ingredientsTitle(lineCount)} />
      <Card className="fc-lns">
        {draft.lines.map((line, i) => (
          <WorkshopIngredientRow
            key={`${lineKey(line)}-${i}`}
            line={line}
            macros={lineMacros(line, pool)}
            flash={flashSet.has(lineKey(line))}
            onAmount={n => patchLine(i, l => setAmount(l, n))}
            onRemove={() => dropLine(i)}
            onReplace={() => setPicker(i)}
          />
        ))}
        {lineCount === 0 && <Empty icon="t-stack">{W.linesEmpty}</Empty>}
        {/* Őszinte-null: ha egy sor makrója nem oldható fel, azt MEGMONDJUK, nem pótoljuk. */}
        {unresolved > 0 && <Note tone="warn">{W.unresolved(unresolved)}</Note>}
      </Card>

      {/* UGYANAZOK a blokkok, amiket a recept- és az étkezés-részletlap rajzol. A számaik
          kizárólag valódi kamra-tényből jönnek: egy becsült sor „—"-t hagy. */}
      {lineCount > 0 && (
        <>
          <FuelMacroShareSection n={2} heading={W.macroQualitySection} shares={shares} groupLabel={W.draftMacroGroup} frame={W.draftMacroFrame} />
          <FuelQualitySection heading={false} lines={qualityLines} note={nEst > 0 ? W.estimateNote : undefined} />
          <FuelMicroSection heading={false} nutrients={previewNutrients} note={<FuelMicroNote />}
            frame={whole ? M.fuelRecept.detail.microFrameWhole : M.fuelRecept.detail.microFrameServing} />
        </>
      )}

      {hasSteps && (
        <>
          <Section n={lineCount > 0 ? 3 : 2} title={W.steps(draft.steps.length)} />
          <Card>
            <ol className="fc-steps">
              {draft.steps.map((s, i) => (
                <li key={i}><b>{i + 1}.</b><span>{s}</span></li>
              ))}
            </ol>
          </Card>
        </>
      )}

      <Section n={1 + (lineCount > 0 ? 1 : 0) + (hasSteps ? 1 : 0) + 1} title={W.askSection} />
      <Card>
        {dock}
        <Note>{W.principle}</Note>
      </Card>

      {pickerSheet}
    </Page>
  )
}

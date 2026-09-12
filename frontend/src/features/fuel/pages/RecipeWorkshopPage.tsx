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
// mentéskor update-et csinál create helyett.
//
// S4 (Fuel Titanium, mezo-hygp) — ÉLŐ ELŐNÉZET: a vászon azokat a blokkokat rajzolja, amiket a
// recept-részletlap (és az étkezés-részletlap) visz — Makrók / Hozzávalók / Minőség /
// Mikrotápanyagok —, UGYANAZOKKAL a komponensekkel (`FuelQualityBlocks`). Owner-döntés: amit
// iterálás közben látsz, az legyen a mentett recept. A Minőség és a Mikrotápanyagok SZÁMAI
// kizárólag valódi kamra-tényből jönnek (`draftQualityLines` / `draftNutrients`): egy becsült
// sor NEM ad tápanyag-számot, mert a modell tápanyag-tényt SOHA nem találhat ki.
// Vizuális referencia: a prototípus `muhelyPage` (:115) vászon-dokk tagolása, `runTurn` (:158)
// és `saveWorkshop` (:171).
// ============================================================
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import type { Recipe, RecipeRole, WorkshopDraft, WorkshopGoal, WorkshopLine } from '@/data/types'
import { useRecipes, useRecipeActions, useWorkshop } from '@/data/hooks'
import { isMockMode } from '@/data/_client/mode'
import { recipeApi } from '@/data/fuel/recipeApi'
import { usePickableIngredients, type PickableIngredient } from '@/data/fuel/pantryPickables'
import { NO_NUTRIENTS, roundMacro, scaleNutrients } from '@/data/fuel/recipeMacros'
import {
  draftNutrients, draftQualityLines, draftTotals, draftToInput, diffLineKeys, goalRole, lineKey,
  lineMacros, recipeToDraft, scaleServings,
} from '@/data/fuel/workshopState'
import { Icon } from '@/shared/ui/Icon'
import { ClayIcon } from '@/shared/ui/clay'
import { useToast } from '@/shared/ui/ToastProvider'
import { MozaikPage, PageHead, PageBody, CollapsibleStrip } from '@/shared/ui/mozaik'
import { huInt } from '@/shared/lib/huNum'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
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

const GOAL_LABEL: Record<WorkshopGoal, string> = {
  high_protein: 'High protein',
  pre_workout: 'Pre-workout',
  post_workout: 'Post-workout',
  before_bed: 'Lefekvés előtt',
  breakfast: 'Reggeli',
}

/** What a preset chip actually SAYS to the Műhely — the chip is an instruction, not a filter. */
const GOAL_MESSAGE: Record<WorkshopGoal, string> = {
  high_protein: 'Alakítsd át magas fehérjetartalmúra.',
  pre_workout: 'Alakítsd át edzés előtti étkezésnek.',
  post_workout: 'Alakítsd át edzés utáni étkezésnek.',
  before_bed: 'Alakítsd át lefekvés előtti étkezésnek.',
  breakfast: 'Alakítsd át reggelinek.',
}

const FLASH_MS = 2600

const ERROR_COPY = 'A Műhely most nem elérhető — az üzeneted megvan.'
const GATE_NOTE = '✨ becslés-sorok: cseréld kamra-itemre vagy töröld a mentéshez'

export function RecipeWorkshopPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const seedId = params.get('recipeId')
  const { recipes } = useRecipes()
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
  const [error, setError] = useState<{ message: string; retryText: string } | null>(null)
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
      setError({ message: ERROR_COPY, retryText: message })
    } finally {
      setBusy(false)
    }
  }, [busy, draft, flash, history, workshopTurn])

  // Kamra-picked items ride along as context for THIS turn (the prototype's ctx chips).
  const compose = (message: string) =>
    contextNames.length > 0 ? `${message}\n(Kamrából: ${contextNames.join(', ')})` : message

  const send = () => {
    const t = text.trim()
    if (!t || busy) return
    setText('')
    void runTurn(compose(t), goal)
  }

  const tapPreset = (g: WorkshopGoal) => {
    if (busy) return
    setGoal(g)
    void runTurn(compose(GOAL_MESSAGE[g]), g)
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
      show({ kind: 'success', text: 'Recept frissítve.' })
      navigate(`/fuel/recipes/${sourceRecipeId}`)
    } else {
      create(input)
      show({ kind: 'success', text: 'Recept mentve a Receptkönyvbe.' })
      navigate('/fuel/recipes')
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

  return (
    <MozaikPage tone="sage">
      <PageHead onBack={() => navigate('/fuel/recipes')} label="‹ Receptek" />
      <EntranceGroup>
        <PageBody principle="A Műhely hozzávalót és mennyiséget javasol — a makrókat mindig a kamra-tények adják.">
          <div className="rise" style={{ padding: '2px 2px 12px' }}>
            <span className="mz-eyebrow">Fuel · Receptek</span>
            <div className="row" style={{ alignItems: 'center', gap: 7, marginTop: 4 }}>
              <ClayIcon name="i-muhely" size={22} />
              <h1 style={{ fontFamily: 'var(--ff-display)', fontSize: 22, fontWeight: 600, lineHeight: 1.15, margin: 0, color: 'var(--text-primary)' }}>
                Receptműhely
              </h1>
            </div>
          </div>

          {!draft && (
            /* A kiinduló vászon (prototípus `wsx-empty`): egy kérdés, és a cél-csempék a
               dokkban várnak — nem üres képernyő.
               NB: a „Mit főzzünk ki?" a CHAT nyitó kérdése (prototípus-szöveg), NEM a B17
               „mit főzzünk az itthon lévőből" felület — az owner azt kivette, és nem is épült
               meg: itt te mondod meg a célt, nem a kamra-készlet generál listát. */
            <div className="fkx-ws-empty rise">
              <span className="fkx-ws-glow" aria-hidden="true" />
              <span className="fkx-ws-art" aria-hidden="true"><ClayIcon name="i-muhely" size={96} /></span>
              <strong>Mit főzzünk ki?</strong>
              <p>
                Válassz egy célt alul, vagy írd le a saját szavaiddal. Én hozzávalót és
                mennyiséget javaslok — a számokat mindig a kamrád adja.
              </p>
              <small>Minden kör patch-ként érkezik, a kézi szerkesztéseid megmaradnak.</small>
            </div>
          )}

          {draft && (
            <>
              {/* Név + cél-chip */}
              <div className="mz-qcard rise" style={{ padding: '10px 12px', marginBottom: 9 }}>
                <div className="row" style={{ alignItems: 'center', gap: 7 }}>
                  <input
                    value={draft.name}
                    onChange={e => setDraft(d => (d ? { ...d, name: e.target.value } : d))}
                    aria-label="Recept neve"
                    placeholder="Recept neve"
                    style={{ flex: 1, minWidth: 0, fontFamily: 'var(--ff-display)', fontSize: 16, color: 'var(--text-primary)' }}
                  />
                  {goal && (
                    <span className="logflow-lntag" data-tag="becslés" style={{ flex: 'none' }}>{GOAL_LABEL[goal]}</span>
                  )}
                </div>
              </div>

              {/* Titán hős: bal = tál-ikon és ALATTA a kcal; jobb = adag-stepper és a bázis-váltó.
                  A számok már KÉSZEN jönnek (`draftTotals` a kamra-tényekből) — itt nem
                  születik makró. */}
              <div className="fmx-detail-hero fkx-ws-hero">
                <span className="fmx-detail-glow" aria-hidden="true" />
                <div className="fmx-detail-left">
                  <span className="fmx-detail-art" aria-hidden="true"><ClayIcon name="i-tanyer" size={96} /></span>
                  <div className="fmx-detail-kcal">
                    <strong>{huInt(shown.kcal)}</strong>
                    <small>kcal {basis === 'whole' ? '· egész' : '/ adag'}</small>
                  </div>
                </div>
                <div className="fmx-detail-right">
                  <div className="fkx-stepper">
                    <button type="button" aria-label="Kevesebb adag" disabled={draft.servings <= 1}
                      onClick={() => setDraft(d => (d ? scaleServings(d, d.servings - 1) : d))}>−</button>
                    <span><strong>{draft.servings}</strong><small>adag</small></span>
                    <button type="button" aria-label="Több adag" disabled={draft.servings >= 12}
                      onClick={() => setDraft(d => (d ? scaleServings(d, d.servings + 1) : d))}>＋</button>
                  </div>
                  <div className="fkx-basis">
                    <ServingToggle value={basis} servings={draft.servings} onChange={setBasis} />
                  </div>
                </div>
              </div>

              {/* Őszinte-null: ha egy sor makrója nem oldható fel, azt MEGMONDJUK, nem pótoljuk. */}
              {unresolved > 0 && (
                <p className="fmx-nutri-note">
                  {unresolved} sorhoz nincs tápérték a kamrában — a számokból kimarad, nem találgatjuk.
                </p>
              )}

              <FuelMacroShareSection shares={shares}
                groupLabel="A vázlat energiájának megoszlása" frame="a vázlat energiájának" />

              <section className="fmx-detail-sec">
                <div className="fmx-section"><h2>Hozzávalók</h2></div>
                <div className="col gap-sm">
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
                  {draft.lines.length === 0 && (
                    <p className="fmx-block-empty">
                      Nincs hozzávaló — kérj egyet alul, vagy válassz a kamrából.
                    </p>
                  )}
                </div>
              </section>

              {/* UGYANAZ a két szekció, amit a recept- és az étkezés-részletlap rajzol. A
                  számaik kizárólag valódi kamra-tényből jönnek: egy becsült sor „—"-t hagy. */}
              <FuelQualitySection lines={qualityLines} />
              <FuelMicroSection nutrients={previewNutrients}
                frame={basis === 'whole' ? 'a recept' : 'az adag'} />
              <FuelMicroNote />

              {draft.steps.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <CollapsibleStrip eyebrow="Elkészítés" summary={`${draft.steps.length} lépés`}>
                    <div className="col gap-sm">
                      {draft.steps.map((s, i) => (
                        <div key={i} className="row gap-sm" style={{ alignItems: 'flex-start' }}>
                          <span className="label-mono" style={{ fontSize: 9, color: 'var(--coral)', minWidth: 14 }}>{i + 1}.</span>
                          <span style={{ fontSize: 11.5, lineHeight: 1.45, color: 'var(--text-primary)' }}>{s}</span>
                        </div>
                      ))}
                    </div>
                  </CollapsibleStrip>
                </div>
              )}

            </>
          )}

          {/* Clearance for the portaled save bar + chat dock (the RecipeEditorPage idiom) —
              only under a draft; the empty canvas is short enough to clear the dock already. */}
          {draft && <div style={{ height: 190 }} />}
        </PageBody>
      </EntranceGroup>

      {/* Mentés-sáv + dokkolt chat — portaled into the phone screen (the .recipe-save-bar
          idiom) so both pin to the device viewport above the tab bar instead of scrolling
          away under a canvas that grows with every turn. */}
      {createPortal(
        <div className="wsh-bottom">
          {draft && (
            <div>
              {!input && (
                <p className="label-mono" style={{ fontSize: 9.5, color: 'var(--text-tertiary)', textAlign: 'center', marginBottom: 7, lineHeight: 1.5 }}>
                  {GATE_NOTE}
                </p>
              )}
              <button className="cta-primary" disabled={!canSave} onClick={save} style={{ width: '100%' }}>
                <Icon name="check" size={15} /> {sourceRecipeId ? 'Recept frissítése' : 'Mentés a Receptkönyvbe'}
              </button>
            </div>
          )}
          <WorkshopChatDock
            goal={goal}
            onGoal={tapPreset}
            text={text}
            onText={setText}
            busy={busy}
            history={history}
            error={error}
            onSend={send}
            onRetry={retry}
            onEditFailed={editFailed}
            onOpenPantry={() => setPicker('context')}
            contextNames={contextNames}
            onDropContext={n => setContextNames(prev => prev.filter(x => x !== n))}
          />
        </div>,
        document.querySelector('.phone-screen') ?? document.body,
      )}

      {picker !== null && (
        <IngredientPickerSheet
          onPick={onPick}
          onClose={() => setPicker(null)}
          addedRefIds={picker === 'context' ? [] : (draft?.lines.map(l => l.refId ?? '') ?? [])}
        />
      )}
    </MozaikPage>
  )
}

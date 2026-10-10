// ============================================================
// Mezo · RoutineWizardPage (mezo-3zue.4, one-flow rebuild mezo-9k99; Folyadék F2 mezo-n4wf5.2) —
// /nap/rutin/uj, prototype vilagos/nap.js `rutinUj`. ONE creation flow for every habit; the hero
// is the recipe filling up (its vessels + the sentence), the card under it is the step, and the
// floating foot carries Mégse / Vissza / Tovább:
//
//  - the two frameworks are NOT the same flow any more: the Fogg branch builds an anchored
//    tiny act (keret → horgony → tett → ünneplés), the Clear branch walks the FOUR LAWS —
//    one step longer, with the craving and the optional identity as their own step, because
//    Clear's thesis (a habit is a vote for who you take yourself to be) is a question only
//    that branch asks;
//  - a „Keret nélkül" branch (keret → tett) retires the separate HabitEditSheet, which used
//    to be the only place a frameworkless def — and mode/metric — could be created;
//  - XP is DERIVED, never hand-set: four Fogg ability factors (idő · fizikai · fejmunka ·
//    újdonság) sum into a deliberately narrow 6–14 band (habitEffort.ts), with a „make it
//    tiny" nudge on the heaviest factor — advice, never arithmetic.
//
// The live sentence renders through the pure `routineSentenceParts` (`RecipeSentence`), never a
// local template, so the wizard and the finished habit page can't drift. The page NEVER ticks a
// habit (ADR — ticking lives on /nap/rutin).
// ============================================================
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useHabitCatalog, useHabitCatalogActions } from '@/data/hooks'
import type { HabitDefUpdateInput } from '@/data/habit/habitAdminApi'
import type { HabitFramework, HabitMode, HabitSuggestion } from '@/data/types'
import { EffortGrid } from '@/features/me/components/EffortGrid'
import { FW_ART, FW_NAME, RbBack, RecipeSentence, RecipeVessels, recipeParts } from '@/features/me/components/routineBits'
import { habitAnchorOptions } from '@/features/me/logic/habitAnchors'
import { EMPTY_EFFORT, effortRated, effortXp, type EffortState } from '@/features/me/logic/habitEffort'
import { HABIT_METRIC_PALETTE } from '@/features/me/logic/habitMetricPalette'
import { recipeFromDef, titlePlaceholder, type RoutineRecipe } from '@/features/me/logic/routineSentence'
import { LIFE_SKILLS } from '@/features/progression/logic/levelUpMeta'
import { cn } from '@/shared/lib/cn'
import { ContentIcon } from '@/shared/ui/clay'
import {
  Acts, Btn, Card, Dots, ErrorRow, Hero, Lab, Lk, Mark, Note, Page, Pill, Pills, Row, Section, Seg, Why, useFrameTitle,
} from '@/shared/ui/folyadek'
import { ScreenSkeleton } from '@/shared/ui/ScreenSkeleton'
import { VoiceField } from '@/shared/ui/voice/VoiceField'
import { appendDictation } from '@/shared/lib/voice/useVoiceInput'

/** 'NONE' is a real branch here (the retired sheet's job), only the wire knows it as null. */
type FwChoice = HabitFramework | 'NONE'
type StepId = 'fw' | 'anchor' | 'cue' | 'crave' | 'act' | 'celeb' | 'reward'

// The two frameworks are deliberately DIFFERENT step lists (see the header note).
const STEPS: Record<FwChoice, StepId[]> = {
  FOGG: ['fw', 'anchor', 'act', 'celeb'],
  CLEAR: ['fw', 'cue', 'crave', 'act', 'reward'],
  NONE: ['fw', 'act'],
}
const STEP_TITLES: Record<StepId, string> = {
  fw: 'Milyen keretre építsük?',
  anchor: 'Mihez horgonyzod?',
  cue: 'Mi a jelzés?',
  crave: 'Miért fogod akarni?',
  act: 'Mi a tett?',
  celeb: 'Hogyan ünnepled?',
  reward: 'Mi teszi kielégítővé?',
}
/** The title bar's short form of each step. */
const STEP_BAR: Record<StepId, string> = {
  fw: 'Milyen keretre?',
  anchor: 'Mihez horgonyzod?',
  cue: 'Mi a jelzés?',
  crave: 'Miért akarod?',
  act: 'Mi a tett?',
  celeb: 'Hogyan ünnepled?',
  reward: 'Mi a jutalom?',
}
/** The three doors of the first step: who it is from, and the loop it walks. */
const FW_DOORS: { key: FwChoice; who: string; loop: string[] }[] = [
  { key: 'FOGG', who: 'BJ Fogg · Tiny Habits', loop: ['Horgony', 'Pici tett', 'Ünneplés'] },
  { key: 'CLEAR', who: 'James Clear · Atomic Habits', loop: ['Jelzés', 'Vágy', 'Válasz', 'Jutalom'] },
  { key: 'NONE', who: 'csak a tett', loop: [] },
]
const CELEBRATIONS = ['ökölrázás', '„Igen!”', 'mosoly a tükörbe', 'mély levegő']
const REWARDS = ['a pipa maga', 'egy fejezet papírkönyv', 'kávé csak utána', 'öt perc semmittevés']
const CUES = ['reggel · konyha', 'este · hálószoba', 'edzés előtt · öltöző', 'ebéd után · asztal']
const XP_MIN = 5
const XP_MAX = 15

// An accepted AI suggestion travels here through sessionStorage, not the query string: five
// prose fields (jelzés, vágy, jutalom, ünneplés, cím) would make an unreadable URL, and the
// suggestion is a one-shot hand-off, not a bookmarkable address (ADR 0019 — the suggester only
// PROPOSES; the wizard's own steps and the "Vállalom" tick are the human pass).
const SUGGESTION_KEY = 'mezo.routineWizard.suggestion'

/** Reads the hand-off. **Pure and repeatable on purpose** (review finding): this runs as a lazy
 *  `useState` initializer, and StrictMode (`main.tsx`) double-invokes those in development — an
 *  initializer that also REMOVED the key returned the suggestion on the first call and `null` on
 *  the second, so an accepted proposal could fail to seed in any dev or mock run while production
 *  and the test suite (neither of which mounts StrictMode) hid the bug. Consuming the key is the
 *  mount effect's job instead, which is idempotent however many times it runs. A storage failure
 *  (private mode, quota, a disabled store) yields null rather than breaking the page. */
function readSuggestion(): HabitSuggestion | null {
  try {
    const raw = sessionStorage.getItem(SUGGESTION_KEY)
    return raw ? (JSON.parse(raw) as HabitSuggestion) : null
  } catch {
    return null
  }
}

const clampXp = (xp: number) => Math.min(XP_MAX, Math.max(XP_MIN, xp))

/** Chip row bound to ONE string — picking a chip fills the field under it. */
function ChipField({ options, value, onPick }: { options: string[]; value: string; onPick: (v: string) => void }) {
  return (
    <Pills>
      {options.map((o) => <Pill key={o} on={value === o} onClick={() => onPick(o)}>{o}</Pill>)}
    </Pills>
  )
}

export function RoutineWizardPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const prefillKey = params.get('prefill')
  const { catalog, isPending, isError, refetch } = useHabitCatalog()
  const { createDef, updateDef, pending } = useHabitCatalogActions()

  // The accepted AI suggestion, claimed once on mount. It only ever seeds INITIAL values: where
  // `?prefill` also has something to say, prefill wins (below) — a user who arrived through
  // a conversion entrance is editing one specific habit, not accepting a proposal.
  const [suggestion] = useState(readSuggestion)
  // Consumed on mount, not in the initializer above — so a reload still cannot resurrect a stale
  // proposal, while a double-invoked initializer cannot lose one either.
  useEffect(() => {
    try {
      sessionStorage.removeItem(SUGGESTION_KEY)
    } catch {
      // a disabled/throwing store — nothing to clean up, and nothing worth breaking the page for
    }
  }, [])

  const [stepIdx, setStepIdx] = useState(0)
  const [fwChoice, setFwChoice] = useState<FwChoice | null>(suggestion?.framework ?? null)
  const [anchorLabel, setAnchorLabel] = useState(suggestion?.anchorCopy ?? '')
  const [anchorHabitKey, setAnchorHabitKey] = useState<string | null>(null)
  const [title, setTitle] = useState(suggestion?.title ?? '')
  const [chainKey, setChainKey] = useState(() => params.get('chain') ?? suggestion?.chainKey ?? 'MORNING')
  const [skillKey, setSkillKey] = useState(
    () => (LIFE_SKILLS.some((s) => s.key === suggestion?.skillKey) ? suggestion!.skillKey : 'mindset'),
  )
  // XP is not a field any more (mezo-9k99): the effort grid derives it. A suggestion's or a
  // prefilled def's stored XP survives only while the grid is untouched.
  const [eff, setEff] = useState<EffortState>(EMPTY_EFFORT)
  const [mode, setMode] = useState<HabitMode>('MANUAL')
  const [metric, setMetric] = useState(HABIT_METRIC_PALETTE[0]?.metric ?? '')
  const [cue, setCue] = useState(suggestion?.cue ?? '')
  const [craving, setCraving] = useState(suggestion?.craving ?? '')
  // A suggestion never carries an identity — that clause is the user's own sentence about who
  // they are becoming, and nothing else may put words in it.
  const [identity, setIdentity] = useState('')
  const [celebration, setCelebration] = useState(suggestion?.celebration ?? '')
  const [reward, setReward] = useState(suggestion?.reward ?? 'a pipa maga')
  const [committed, setCommitted] = useState(false)

  // ?prefill=<habitKey> re-opens an existing definition in the wizard (conversion entrance,
  // mezo-3zue.5). The catalog may still be loading on first render, so the seed runs in an
  // effect and exactly once — a re-render must never stomp the user's edits.
  const allDefs = (catalog?.chains ?? []).flatMap((c) => c.defs)
  // An unknown key falls back to CREATE rather than erroring: the catalog may simply not have
  // resolved (or the def was deleted in another tab) and the wizard's own guards still apply.
  const prefillDef = prefillKey == null ? undefined : allDefs.find((d) => d.habitKey === prefillKey)
  const seeded = useRef(false)
  useEffect(() => {
    if (seeded.current || prefillKey == null || catalog == null) return
    const defs = catalog.chains.flatMap((c) => c.defs)
    const def = defs.find((d) => d.habitKey === prefillKey)
    if (def == null) return
    seeded.current = true
    const seed = recipeFromDef(def, (key) => defs.find((d) => d.habitKey === key)?.title)
    setFwChoice(seed.framework)
    setTitle(seed.title)
    setAnchorLabel(seed.anchorLabel)
    setAnchorHabitKey(def.anchorHabitKey)
    setCelebration(seed.celebration)
    setCue(seed.cue)
    setCraving(seed.craving)
    setIdentity(seed.identity)
    if (seed.reward) setReward(seed.reward)
    setChainKey(params.get('chain') ?? def.chainKey)
    setSkillKey(def.skillKey)
    setMode(def.mode)
    if (def.metric !== 'manual') setMetric(def.metric)
  }, [catalog, prefillKey, params])

  // The step list is pure state, so the title bar can name the step before the catalog answers.
  const steps = fwChoice != null ? STEPS[fwChoice] : STEPS.FOGG
  const stepId: StepId = steps[Math.min(stepIdx, steps.length - 1)]
  useFrameTitle({ title: STEP_BAR[stepId], eyebrow: `Új szokás · ${Math.min(stepIdx, steps.length - 1) + 1} / ${steps.length}` })

  if (isPending) return <ScreenSkeleton />
  // A FAILED catalog fetch is not an empty catalog: without this branch the act step offered
  // zero chain chips while `chainKey` still defaulted to 'MORNING', so a save could 400 on a
  // chain the user never saw.
  if (isError && (catalog?.chains ?? []).length === 0) {
    return (
      <Page>
        <RbBack label="Rutinok" fallback="/nap/rutin/epites" />
        <Card><ErrorRow message="Nem sikerült betölteni a rutinokat." onRetry={refetch} /></Card>
      </Page>
    )
  }

  // Sorted by position, like every other chain list; ACTIVE-only is this page's own rule, NOT
  // shared with `HabitPage`/`RutinHubPage`, which sort but keep paused chains visible. The
  // asymmetry is deliberate: an existing habit may sit in a paused chain and must stay editable
  // there, but a brand-new recipe should not be filed into one.
  const chains = [...(catalog?.chains ?? [])].filter((c) => c.isActive).sort((a, b) => a.position - b.position)
  // Excluding the prefilled definition keeps a re-framed habit out of its OWN anchor chips:
  // picking itself sends a self-anchor, which the backend rejects with 400 HABIT_ANCHOR_INVALID
  // (HabitFrameworkValidator.validateAnchorReference) with nothing shown inline.
  const anchors = catalog != null ? habitAnchorOptions(catalog, prefillDef?.id) : []

  const isLast = stepIdx === steps.length - 1 && fwChoice != null
  const framework: HabitFramework | null = fwChoice === 'NONE' ? null : fwChoice
  const recipe: RoutineRecipe = { framework, title, anchorLabel, celebration, cue, craving, reward, identity }

  // The XP that will actually be saved: derived from the effort grid, except a conversion whose
  // grid was never touched keeps the stored value (an unrated grid must not silently reprice).
  const xpToSave = prefillDef != null && !effortRated(eff) ? clampXp(prefillDef.xp) : effortXp(eff)

  // Advisory only (prototype's `tinyWarn`): more than six words, or a number above five, reads
  // as a resolution rather than a tiny habit. It NEVER blocks — see canProceed.
  const tooBig = fwChoice === 'FOGG'
    && (title.trim().split(/\s+/).filter(Boolean).length > 6
        || Number(title.match(/\d+/)?.[0] ?? 0) > 5)

  const metricOk = mode === 'MANUAL' || (metric !== '' && metric !== 'manual')
  const canProceed = (() => {
    switch (stepId) {
      case 'fw': return fwChoice !== null
      case 'anchor': return anchorLabel.trim() !== ''
      case 'cue': return cue.trim() !== ''
      case 'crave': return craving.trim() !== ''
      case 'act': return title.trim() !== '' && metricOk
      case 'celeb': return celebration.trim() !== '' && committed
      case 'reward': return reward.trim() !== '' && committed
    }
  })()

  // The framework's OWN fields, identical on both save paths. A FOGG recipe sends EITHER
  // anchorHabitKey OR anchorCopy (never both — the backend rejects that), plus the celebration;
  // a CLEAR recipe sends cue/craving/reward; a frameworkless one sends none of them. The
  // backend clears the fields the chosen framework does not own, so a conversion needs nothing
  // more than this.
  const frameworkFields = () => {
    if (framework === 'FOGG') {
      return {
        ...(anchorHabitKey != null ? { anchorHabitKey } : { anchorCopy: anchorLabel.trim() }),
        celebration: celebration.trim(),
      }
    }
    if (framework === 'CLEAR') {
      return {
        cue: cue.trim(), craving: craving.trim(), reward: reward.trim(),
        // An untouched identity is left out entirely: on CREATE there is nothing to clear, and
        // the blank-clears convention (mezo-pero) is the PATCH's affair, not the POST's.
        ...(identity.trim() ? { identity: identity.trim() } : {}),
      }
    }
    return {}
  }

  const save = () => {
    if (fwChoice === null) return
    const done = (habitKey: string | undefined) =>
      navigate(habitKey != null ? `/nap/rutin/epites?new=${encodeURIComponent(habitKey)}` : '/nap/rutin/epites', { replace: true })

    // Re-framing CONVERTS the definition it was opened with — it must never mint a second one.
    // `updateDef` accepts no `skillKey`, so it is omitted; mode/metric ride the patch since
    // mezo-pero. `chainKey` goes only when the user actually moved the habit, because the
    // backend reads a bare chainKey as a MOVE and appends the def to the end of that chain.
    if (prefillDef != null && framework != null) {
      const patch: HabitDefUpdateInput = {
        title: title.trim(), xp: xpToSave, framework, ...frameworkFields(),
      }
      if (chainKey !== prefillDef.chainKey) patch.chainKey = chainKey
      if (mode !== prefillDef.mode) patch.mode = mode
      if (mode === 'DERIVED' && (mode !== prefillDef.mode || metric !== prefillDef.metric)) patch.metric = metric
      // UNLINKING a chip anchor needs an explicit empty string, not an omission (review finding).
      // The def HAD an `anchorHabitKey` and the user typed free text over it, so the patch carries
      // only `anchorCopy` — but the PATCH's guard is `!= null`, so an omitted key KEEPS the stale
      // link, and `recipeFromDef` prefers the link over the copy: the typed anchor would vanish
      // without a word. Blank is the contract's unlink sentinel (mezo-pero generalized it).
      if (framework === 'FOGG' && anchorHabitKey == null && prefillDef.anchorHabitKey != null) {
        patch.anchorHabitKey = ''
      }
      updateDef(prefillDef.id, patch).then(() => done(prefillDef.habitKey))
      return
    }

    createDef({
      chainKey,
      title: title.trim(),
      mode,
      ...(mode === 'DERIVED' ? { metric } : {}),
      skillKey,
      xp: xpToSave,
      framework,
      ...frameworkFields(),
    }).then((def) => done(def?.habitKey))
  }

  // Switching the framework on the fw step drops the commitment tick: it is a promise about the
  // recipe you just read, not a setting, and a tick carried over from the Fogg pass would
  // unlock Clear's save on a sentence the user never saw.
  //
  // anchorHabitKey is deliberately NOT reset here. save() reads it only inside the FOGG
  // branch, so it can never leak into a CLEAR payload; clearing it would only bite the
  // FOGG → CLEAR → FOGG path, where anchorLabel survives (the chip still renders selected,
  // since selection matches on the label) while the key would not — silently downgrading a
  // real habit link to anchorCopy free text with nothing on screen to say so.
  const pickFramework = (next: FwChoice) => {
    if (next === fwChoice) return
    setFwChoice(next)
    setCommitted(false)
  }

  const onNext = () => {
    if (!canProceed) return
    if (isLast) save()
    else setStepIdx(stepIdx + 1)
  }

  const cancel = () => navigate('/nap/rutin/epites')
  const stepBack = () => (stepIdx > 0 ? setStepIdx(stepIdx - 1) : cancel())
  // Before a framework is chosen the vessels show the default door's parts (prototype: the Fogg three).
  const parts = recipeParts(fwChoice == null ? { ...recipe, framework: 'FOGG' } : recipe)
  const blank = !parts.some((p) => p.filled)
  const fwKey: FwChoice = fwChoice ?? 'FOGG'

  const commit = (
    <>
      <Acts>
        <Btn sm ghost={!committed} icon="t-tick" aria-pressed={committed} onClick={() => setCommitted(!committed)}>Vállalom</Btn>
      </Acts>
      <Note>A pipa egy ígéret, nem beállítás. Holnap reggel ott lesz a Rutin fülön.</Note>
    </>
  )

  return (
    <Page
      foot={(
        <>
          <Lk onClick={cancel}>Mégse</Lk>
          {stepIdx > 0 && <Btn ghost onClick={() => setStepIdx(stepIdx - 1)}>Vissza</Btn>}
          <Btn grow disabled={!canProceed || (isLast && pending)} onClick={onNext}>{isLast ? 'Mentés' : 'Tovább'}</Btn>
        </>
      )}
    >
      <RbBack label={stepIdx > 0 ? STEP_TITLES[steps[stepIdx - 1]] : 'Rutinok'} onBack={stepBack} />
      <Dots count={steps.length} at={stepIdx} label={`Új szokás-recept: ${stepIdx + 1}. lépés / ${steps.length}`} />

      {stepId === 'fw' ? (
        <Hero
          label={blank ? 'Új szokás-recept · még üres' : `${FW_NAME[fwKey]} · épül, ahogy töltöd`}
          verdict={STEP_TITLES[stepId]}
          sub="A recept edényei lépésről lépésre telnek meg."
        >
          <RecipeVessels parts={parts} />
        </Hero>
      ) : (
        <Hero label={`${FW_NAME[fwKey]} · épül, ahogy töltöd`} verdict={STEP_TITLES[stepId]}>
          <RecipeVessels parts={parts} />
          <RecipeSentence recipe={recipe} testId="recipe-sentence" />
        </Hero>
      )}

      <Section n={1} title={stepId === 'fw' ? 'Válassz keretet' : 'Töltsd ki'} />
      <Card>
        {/* KERET */}
        {stepId === 'fw' && (
          <>
            {/* The Keret nélkül branch is create-only: a conversion cannot LOSE its framework
                over the wire (a PATCH null is "leave unchanged"), so the door hides on ?prefill. */}
            {FW_DOORS.filter((d) => d.key !== 'NONE' || prefillDef == null).map((d) => (
              <Row
                key={d.key}
                icon={FW_ART[d.key]}
                className={cn(fwChoice === d.key && 'on')}
                state={fwChoice === d.key ? 'now' : undefined}
                title={FW_NAME[d.key]}
                sub={d.who}
                more={d.loop.length > 0 ? (
                  <span className="rb-loop">
                    {d.loop.flatMap((x, i) => [i > 0 ? <u key={`a${i}`} aria-hidden="true">→</u> : null, <i key={x}>{x}</i>])}
                  </span>
                ) : undefined}
                right={<Mark state={fwChoice === d.key ? 'done' : 'empty'} />}
                onClick={() => pickFramework(d.key)}
              />
            ))}
            <Why icon="t-bulb">Kezdőknek a szokás-láncolás a legkönnyebb: egy meglévő szokásra ülteted az újat.</Why>
          </>
        )}

        {/* HORGONY (FOGG) */}
        {stepId === 'anchor' && (
          <>
            <Lab>A szokásaidból és a Mezo-pillanatokból</Lab>
            <Pills>
              {anchors.map((o) => (
                <Pill
                  key={`${o.source}-${o.label}`}
                  on={anchorLabel === o.label}
                  onClick={() => { setAnchorLabel(o.label); setAnchorHabitKey(o.habitKey ?? null) }}
                >
                  {o.label}
                  <small aria-hidden="true">· {o.source === 'SZOKÁS' ? 'szokás' : 'Mezo-pillanat'}</small>
                </Pill>
              ))}
            </Pills>
            <Lab htmlFor="rb-wz-anchor">Vagy saját szavakkal</Lab>
            <VoiceField domain="me" size="sm" onTranscript={(t) => { setAnchorLabel(appendDictation(anchorLabel, t)); setAnchorHabitKey(null) }}>
              <input
                id="rb-wz-anchor"
                className="rb-in"
                aria-label="Horgony"
                value={anchorLabel}
                onChange={(e) => { setAnchorLabel(e.target.value); setAnchorHabitKey(null) }}
                placeholder="pl. „kitöltöttem a reggeli kávét”"
              />
            </VoiceField>
            <Why icon="t-anchor">A jó horgony minden nap biztosan megtörténik, és pontosan tudod, mikor ért véget.</Why>
          </>
        )}

        {/* JELZÉS (CLEAR · 1. törvény) */}
        {stepId === 'cue' && (
          <>
            <Lab htmlFor="rb-wz-cue">Mikor és hol? · jelzés</Lab>
            <ChipField options={CUES} value={cue} onPick={setCue} />
            <VoiceField domain="me" size="sm" onTranscript={(t) => setCue(appendDictation(cue, t))}>
              <input
                id="rb-wz-cue"
                className="rb-in"
                aria-label="Jelzés"
                value={cue}
                onChange={(e) => setCue(e.target.value)}
                placeholder="pl. „7:10-kor, a konyhaasztalnál, a jegyzetfüzet a bögre mellett”"
              />
            </VoiceField>
            <Why icon="t-gem">
              <b>1. törvény — tedd nyilvánvalóvá.</b> A jelzés legyen látható a térben: a füzet a párnán, a cipő az ajtóban.
            </Why>
          </>
        )}

        {/* VÁGY + IDENTITÁS (CLEAR · 2. törvény) — a saját lépése, nem egy mellékmező */}
        {stepId === 'crave' && (
          <>
            <Lab htmlFor="rb-wz-crave">Miért akarod? · vágy</Lab>
            <VoiceField domain="me" size="sm" onTranscript={(t) => setCraving(appendDictation(craving, t))}>
              <input
                id="rb-wz-crave"
                className="rb-in"
                aria-label="Vágy"
                value={craving}
                onChange={(e) => setCraving(e.target.value)}
                placeholder="pl. „tisztább fejjel indul a nap”"
              />
            </VoiceField>
            <Lab htmlFor="rb-wz-identity">Ki leszel ettől? · identitás<span className="rb-opt"> · opcionális</span></Lab>
            <VoiceField domain="me" size="sm" onTranscript={(t) => setIdentity(appendDictation(identity, t))}>
              <input
                id="rb-wz-identity"
                className="rb-in"
                aria-label="Identitás"
                value={identity}
                onChange={(e) => setIdentity(e.target.value)}
                placeholder="pl. „figyel a saját gondolataira”"
              />
            </VoiceField>
            <Note>Clear tézise: a szokás szavazat arra, hogy kinek tartod magad. Ez a mező a szokás-láncolásnál nincs.</Note>
            <Why icon="t-gem">
              <b>2. törvény — tedd vonzóvá.</b> Kösd olyasmihez, amit amúgy is szeretsz, vagy csinálj belőle valamit, ami után vágysz.
            </Why>
          </>
        )}

        {/* A TETT — cím, lánc, életterület, nehézség→XP, pipálódás (minden ágon) */}
        {stepId === 'act' && (
          <>
            {/* The Clear branch names the slot "válasz", not the sentence module's shorter
                "tett" — the label teaches the law, the sentence reads. */}
            <Lab htmlFor="rb-wz-title">Én … · {framework === 'CLEAR' ? 'válasz' : titlePlaceholder(framework)}</Lab>
            <input
              id="rb-wz-title"
              className="rb-in"
              aria-label={framework === 'CLEAR' ? 'Válasz' : 'Pici tett'}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="pl. „leírok egy mondatot a füzetbe”"
            />
            {tooBig && (
              <Why icon="t-scissors">
                Ez nagynak hangzik. <b>Mi a legkisebb változat</b>, amit rossz napon is megteszel? Nőni fog magától.
              </Why>
            )}

            <Lab>Melyik láncba?</Lab>
            <Pills>
              {chains.map((c) => (
                <Pill key={c.chainKey} on={chainKey === c.chainKey} onClick={() => setChainKey(c.chainKey)}>{c.title}</Pill>
              ))}
            </Pills>

            <Lab>Életterület</Lab>
            <Pills>
              {LIFE_SKILLS.map((s) => (
                <Pill key={s.key} on={skillKey === s.key} onClick={() => setSkillKey(s.key)}>
                  <ContentIcon name={s.clayIcon} size={18} />{s.name}
                </Pill>
              ))}
            </Pills>

            <Lab>Mennyibe kerül?</Lab>
            <EffortGrid
              value={eff}
              onChange={setEff}
              xpOverride={prefillDef != null && !effortRated(eff) ? clampXp(prefillDef.xp) : undefined}
            />
            <Note>Az XP a nehézségből számolódik (6–14) — nem beállítás, hanem tükör.</Note>

            <Lab>Hogyan pipálódik?</Lab>
            <Seg
              aria-label="Hogyan pipálódik?"
              items={[{ key: 'MANUAL', label: 'Kézzel pipálom' }, { key: 'DERIVED', label: 'Adatból' }]}
              value={mode}
              onChange={(k) => setMode(k as HabitMode)}
            />
            {mode === 'DERIVED' && (
              <>
                <Lab htmlFor="rb-wz-metric">Metrika</Lab>
                <select
                  id="rb-wz-metric"
                  aria-label="Metrika"
                  className="rb-in"
                  value={metric}
                  onChange={(e) => setMetric(e.target.value)}
                >
                  {HABIT_METRIC_PALETTE.map((m) => <option key={m.metric} value={m.metric}>{m.label}</option>)}
                </select>
              </>
            )}
            <Note>Ezt később is módosíthatod a szokás oldalán.</Note>
          </>
        )}

        {/* ÜNNEPLÉS (FOGG) + VÁLLALÁS */}
        {stepId === 'celeb' && (
          <>
            <Lab>Ünneplésül …</Lab>
            <ChipField options={CELEBRATIONS} value={celebration} onPick={setCelebration} />
            <Lab htmlFor="rb-wz-celeb">Vagy saját</Lab>
            <input
              id="rb-wz-celeb"
              className="rb-in"
              aria-label="Ünneplés"
              value={celebration}
              onChange={(e) => setCelebration(e.target.value)}
              placeholder="pl. egy kis tánc"
            />
            <Why icon="t-anchor">Az ünneplés azonnal jöjjön, a tett után — ettől ragad meg az érzés.</Why>
            {commit}
          </>
        )}

        {/* JUTALOM (CLEAR · 4. törvény) + VÁLLALÁS */}
        {stepId === 'reward' && (
          <>
            <Lab>Jutalmam …</Lab>
            <ChipField options={REWARDS} value={reward} onPick={setReward} />
            <Lab htmlFor="rb-wz-reward">Vagy saját</Lab>
            <input
              id="rb-wz-reward"
              className="rb-in"
              aria-label="Jutalom"
              value={reward}
              onChange={(e) => setReward(e.target.value)}
              placeholder="pl. egy csésze tea"
            />
            <Why icon="t-gem">
              <b>4. törvény — tedd kielégítővé.</b> A logolás maga a jutalom: a pipa és az emelkedő szint. Ezért az első az alap.
            </Why>
            {commit}
          </>
        )}
      </Card>
    </Page>
  )
}

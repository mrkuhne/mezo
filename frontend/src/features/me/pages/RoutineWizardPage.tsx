// ============================================================
// Mezo · RoutineWizardPage (mezo-3zue.4, one-flow rebuild mezo-9k99) — /me/rutin/uj,
// prototype rutin-formalodas.html `pg-wiz` ×1.18. ONE creation flow for every habit:
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
// The live sentence card renders through the pure `routineSentenceParts`, never a local
// template, so the wizard and the finished habit page can't drift. The page NEVER ticks a
// habit (ADR — ticking lives on /nap/rutin).
// ============================================================
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useHabitCatalog, useHabitCatalogActions } from '@/data/hooks'
import type { HabitDefUpdateInput } from '@/data/habit/habitAdminApi'
import type { HabitFramework, HabitMode, HabitSuggestion } from '@/data/types'
import { EffortGrid } from '@/features/me/components/EffortGrid'
import { habitAnchorOptions } from '@/features/me/logic/habitAnchors'
import { EMPTY_EFFORT, effortRated, effortXp, type EffortState } from '@/features/me/logic/habitEffort'
import { HABIT_METRIC_PALETTE } from '@/features/me/logic/habitMetricPalette'
import { routineSentenceParts, recipeFromDef, titlePlaceholder, type RoutineRecipe } from '@/features/me/logic/routineSentence'
import { LIFE_SKILLS } from '@/features/progression/logic/levelUpMeta'
import { cn } from '@/shared/lib/cn'
import { ClayIcon } from '@/shared/ui/clay'
import { GhostState } from '@/shared/ui/GhostState'
import { MozaikPage, PageBody, PageHead } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { ScreenSkeleton } from '@/shared/ui/ScreenSkeleton'
import { Stepper } from '@/shared/ui/Stepper'

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
const STEP_SUBS: Record<StepId, string> = {
  fw: 'Mindkét keret ugyanoda visz: egy mondat, amit minden nap el tudsz mondani magadnak.',
  anchor: 'Válassz egy szokást, ami már megy — vagy írd le a pillanatot.',
  cue: '1. törvény — tedd nyilvánvalóvá. Idő és hely, hogy ne kelljen emlékezned rá.',
  crave: '2. törvény — tedd vonzóvá. És Clear tézise: a szokás szavazat arra, kinek tartod magad.',
  act: 'Olyan kicsi, hogy rossz napon is megteszed — a nehézségből számoljuk az XP-t.',
  celeb: 'Az azonnali jó érzés rögzíti a szokást.',
  reward: '4. törvény — ami azonnal jutalmaz, az ismétlődik.',
}
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

const NOTE_DEFAULT = 'Egy futtatás = egy szokás. A lánc a stack; a következő recept horgonya ez a szokás lehet.'
const NOTE_LAST = 'Mentés = egy sor a láncban. A pipa holnaptól a Nap tabon, az erő-csík itt.'

function rise(delayMs: number): CSSProperties {
  return { '--d': `${delayMs}ms` } as CSSProperties
}

function FieldCard({ children, delayMs }: { children: ReactNode; delayMs: number }) {
  return <div className="rt-fcard rise" style={rise(delayMs)}>{children}</div>
}

function Tip({ tone, sign, children }: { tone?: 'lav' | 'warn'; sign: string; children: ReactNode }) {
  return (
    <div className={cn('rt-tip', tone && `is-${tone}`)}>
      <span aria-hidden="true">{sign}</span>
      <span>{children}</span>
    </div>
  )
}

/** Chip row + free-text field bound to ONE string — picking a chip fills the input. */
function ChipField({ options, value, onPick, tone }: {
  options: string[]
  value: string
  onPick: (v: string) => void
  tone?: 'sage' | 'gold'
}) {
  return (
    <div className={cn('rt-chips', tone && `is-${tone}`)}>
      {options.map((o) => (
        <button key={o} type="button" className={cn(value === o && 'on')} onClick={() => onPick(o)}>
          {o}
        </button>
      ))}
    </div>
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

  if (isPending) return <ScreenSkeleton />
  // A FAILED catalog fetch is not an empty catalog: without this branch the act step offered
  // zero chain chips while `chainKey` still defaulted to 'MORNING', so a save could 400 on a
  // chain the user never saw. The retry ghost is the one RutinHubPage/HabitPage already use.
  if (isError && (catalog?.chains ?? []).length === 0) {
    return (
      <MozaikPage tone="gold">
        <PageHead onBack={() => navigate('/me/rutin')} label="‹ Rutin" />
        <PageBody>
          <GhostState message="Nem sikerült betölteni a rutinokat." ctaLabel="Újra" onCta={refetch} />
        </PageBody>
      </MozaikPage>
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

  const steps = fwChoice != null ? STEPS[fwChoice] : STEPS.FOGG
  const stepId: StepId = steps[Math.min(stepIdx, steps.length - 1)]
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
      navigate(habitKey != null ? `/me/rutin?new=${encodeURIComponent(habitKey)}` : '/me/rutin')

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

  const stepTitle = STEP_TITLES[stepId]

  return (
    <MozaikPage tone="gold">
      <PageHead
        onBack={() => (stepIdx > 0 ? setStepIdx(stepIdx - 1) : navigate('/me/rutin'))}
        label={stepIdx > 0 ? `‹ ${STEP_TITLES[steps[stepIdx - 1]]}` : '‹ Rutin'}
      >
        <button type="button" className="pgact" onClick={() => navigate('/me/rutin')}>Mégse</button>
      </PageHead>
      <PageBody>
        <EntranceGroup replayKey={stepId}>
          <Stepper className="rise" title="Új szokás-recept" step={stepIdx + 1} total={steps.length} stepLabel={stepTitle} />

          <div className="rt-wtitle rise" style={rise(30)}>{stepTitle}</div>
          <div className="rt-wsub rise" style={rise(40)}>{STEP_SUBS[stepId]}</div>

          {stepId !== 'fw' && (
            <div
              className={cn('rt-sentence', framework === 'CLEAR' && 'is-clear', isLast && 'is-big')}
              data-testid="recipe-sentence"
            >
              <span className="rt-sentence-lb">
                {framework === 'FOGG' ? '⚓ Szokás-láncolás' : framework === 'CLEAR' ? '◈ Négy törvény' : '· Keret nélkül'}
                <span className="rt-sentence-lb-sub">· épül, ahogy töltöd</span>
              </span>
              <p className="rt-sentence-tx">
                {routineSentenceParts(recipe).map((part, i) => (
                  part.slot === undefined
                    ? <span key={i}>{part.text}</span>
                    : <span key={i} className={cn('rt-blank', part.filled && 'is-filled')}>{part.text}</span>
                ))}
              </p>
            </div>
          )}

          {/* KERET */}
          {stepId === 'fw' && (
            <>
              <button
                type="button"
                className={cn('rt-fwcard is-fogg rise', fwChoice === 'FOGG' && 'on')}
                style={rise(80)}
                onClick={() => pickFramework('FOGG')}
              >
                <span className="rt-fwsgn" aria-hidden="true">⚓</span>
                <span className="rt-fwbody">
                  <b>Szokás-láncolás</b>
                  <small>Egy már meglévő szokásod végpillanatához kötöd az újat. Pici viselkedés, azonnali ünneplés — a szokás nő magától.</small>
                  <span className="rt-fwloop"><span>Horgony</span><i>→</i><span>Pici tett</span><i>→</i><span>Ünneplés</span></span>
                  <span className="rt-fwwho">BJ Fogg · Tiny Habits</span>
                </span>
              </button>
              <button
                type="button"
                className={cn('rt-fwcard is-clear rise', fwChoice === 'CLEAR' && 'on')}
                style={rise(120)}
                onClick={() => pickFramework('CLEAR')}
              >
                <span className="rt-fwsgn" aria-hidden="true">◈</span>
                <span className="rt-fwbody">
                  <b>Négy törvény</b>
                  <small>Tedd nyilvánvalóvá, vonzóvá, könnyűvé és kielégítővé. Akkor válaszd, ha a viselkedésnek valódi akadálya van.</small>
                  <span className="rt-fwloop"><span>Jelzés</span><i>→</i><span>Vágy</span><i>→</i><span>Válasz</span><i>→</i><span>Jutalom</span></span>
                  <span className="rt-fwwho">James Clear · Atomic Habits</span>
                </span>
              </button>
              {/* The Keret nélkül branch is create-only: a conversion cannot LOSE its framework
                  over the wire (a PATCH null is "leave unchanged"), so the card hides on ?prefill. */}
              {prefillDef == null && (
                <button
                  type="button"
                  className={cn('rt-fwcard rise', fwChoice === 'NONE' && 'on')}
                  style={rise(150)}
                  onClick={() => pickFramework('NONE')}
                >
                  <span className="rt-fwsgn" aria-hidden="true">·</span>
                  <span className="rt-fwbody">
                    <b>Keret nélkül</b>
                    <small>Nem kérünk keretet — cím, lánc, és kész. Bármikor felvehetsz rá keretet később a szokás oldalán.</small>
                    <span className="rt-fwwho">csak egy szokás</span>
                  </span>
                </button>
              )}
              <Tip sign="💡">
                Nem tudod eldönteni? <b>Szokás-láncolással</b> kezdj — ha a tett tényleg pici, nincs mit legyőzni.
              </Tip>
            </>
          )}

          {/* HORGONY (FOGG) */}
          {stepId === 'anchor' && (
            <>
              <FieldCard delayMs={80}>
                <span className="rt-flabel">Miután … · horgony</span>
                <div className={cn('rt-chips', 'is-sage')}>
                  {anchors.map((o) => (
                    <button
                      key={`${o.source}-${o.label}`}
                      type="button"
                      className={cn(anchorLabel === o.label && 'on')}
                      onClick={() => { setAnchorLabel(o.label); setAnchorHabitKey(o.habitKey ?? null) }}
                    >
                      {o.label}
                      <span className="rt-chip-src" aria-hidden="true">{o.source}</span>
                    </button>
                  ))}
                </div>
                <input
                  className="rt-fin"
                  aria-label="Horgony"
                  value={anchorLabel}
                  onChange={(e) => { setAnchorLabel(e.target.value); setAnchorHabitKey(null) }}
                  placeholder="…vagy a saját szavaiddal: „kitöltöttem a reggeli kávét”"
                />
              </FieldCard>
              <Tip sign="⚓">
                A horgony <b>végpillanata</b> számít: nem „reggel”, hanem „miután letettem a fogkefét”. Ugyanaz a hely, ugyanaz a gyakoriság.
              </Tip>
            </>
          )}

          {/* JELZÉS (CLEAR · 1. törvény) */}
          {stepId === 'cue' && (
            <>
              <FieldCard delayMs={80}>
                <span className="rt-flabel">Mikor és hol? · jelzés</span>
                <ChipField options={CUES} value={cue} onPick={setCue} />
                <input
                  className="rt-fin"
                  aria-label="Jelzés"
                  value={cue}
                  onChange={(e) => setCue(e.target.value)}
                  placeholder="pl. „7:10-kor, a konyhaasztalnál, a jegyzetfüzet a bögre mellett”"
                />
              </FieldCard>
              <Tip tone="lav" sign="◈">
                <b>1. törvény — tedd nyilvánvalóvá.</b> A jelzés legyen látható a térben: a füzet a párnán, a cipő az ajtóban.
              </Tip>
            </>
          )}

          {/* VÁGY + IDENTITÁS (CLEAR · 2. törvény) — a saját lépése, nem egy mellékmező */}
          {stepId === 'crave' && (
            <>
              <FieldCard delayMs={80}>
                <span className="rt-flabel">Miért akarod? · vágy</span>
                <input
                  className="rt-fin"
                  aria-label="Vágy"
                  value={craving}
                  onChange={(e) => setCraving(e.target.value)}
                  placeholder="pl. „tisztább fejjel indul a nap”"
                />
              </FieldCard>
              <FieldCard delayMs={100}>
                <span className="rt-flabel">Milyen emberré tesz? <span className="rt-opt">identitás · opcionális</span></span>
                <input
                  className="rt-fin"
                  aria-label="Identitás"
                  value={identity}
                  onChange={(e) => setIdentity(e.target.value)}
                  placeholder="pl. „figyel a saját gondolataira”"
                />
                <div className="rt-lockline">
                  <span aria-hidden="true">◈</span>
                  <span>Clear tézise: a szokás <b>szavazat</b> arra, hogy kinek tartod magad. Ez a mező a Fogg-ágon nincs.</span>
                </div>
              </FieldCard>
              <Tip tone="lav" sign="◈">
                <b>Vonzó</b> — a második törvény. Kösd olyasmihez, amit amúgy is szeretsz, vagy csinálj belőle valamit, ami után vágysz.
              </Tip>
            </>
          )}

          {/* A TETT — cím, lánc, életterület, nehézség→XP, pipálódás (minden ágon) */}
          {stepId === 'act' && (
            <>
              <FieldCard delayMs={80}>
                {/* The Clear branch names the slot "válasz", not the sentence module's shorter
                    "tett" — the label teaches the law, the sentence reads. */}
                <span className="rt-flabel">Én … · {framework === 'CLEAR' ? 'válasz' : titlePlaceholder(framework)}</span>
                <input
                  className="rt-fin"
                  aria-label={framework === 'CLEAR' ? 'Válasz' : 'Pici tett'}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="pl. „leírok egy mondatot a füzetbe”"
                />
                {tooBig && (
                  <Tip tone="warn" sign="✂">
                    Ez nagynak hangzik. <b>Mi a legkisebb változat</b>, amit rossz napon is megteszel? Nőni fog magától.
                  </Tip>
                )}
              </FieldCard>

              <FieldCard delayMs={100}>
                <span className="rt-flabel">Melyik láncba?</span>
                <div className="rt-chips is-gold">
                  {chains.map((c) => (
                    <button
                      key={c.chainKey}
                      type="button"
                      className={cn(chainKey === c.chainKey && 'on')}
                      onClick={() => setChainKey(c.chainKey)}
                    >
                      {c.title}
                    </button>
                  ))}
                </div>
              </FieldCard>

              <FieldCard delayMs={120}>
                <span className="rt-flabel">Életterület</span>
                <div className="rt-lifegrid">
                  {LIFE_SKILLS.map((s) => (
                    <button
                      key={s.key}
                      type="button"
                      className={cn(skillKey === s.key && 'on')}
                      onClick={() => setSkillKey(s.key)}
                    >
                      <ClayIcon name={s.clayIcon} size={21} />
                      <small>{s.name}</small>
                    </button>
                  ))}
                </div>
              </FieldCard>

              <FieldCard delayMs={140}>
                <span className="rt-flabel">Mennyibe kerül? <span className="rt-opt">Fogg ability-faktorai</span></span>
                <EffortGrid
                  value={eff}
                  onChange={setEff}
                  xpOverride={prefillDef != null && !effortRated(eff) ? clampXp(prefillDef.xp) : undefined}
                />
                <div className="rt-hint">Az XP a nehézségből számolódik (6–14) — nem beállítás, hanem tükör.</div>
              </FieldCard>

              <FieldCard delayMs={160}>
                <span className="rt-flabel">Hogyan pipálódik?</span>
                <div className="rt-swseg">
                  <button
                    type="button"
                    className={cn(mode === 'MANUAL' && 'on')}
                    onClick={() => setMode('MANUAL')}
                  >
                    <span aria-hidden="true">✓</span>Kézzel pipálom
                  </button>
                  <button
                    type="button"
                    className={cn(mode === 'DERIVED' && 'on')}
                    onClick={() => setMode('DERIVED')}
                  >
                    <span aria-hidden="true">◎</span>Adatból
                  </button>
                </div>
                {mode === 'DERIVED' && (
                  <>
                    <span className="rt-flabel" style={{ marginTop: 10 }}>Metrika</span>
                    <select
                      aria-label="Metrika"
                      className="rt-fin"
                      value={metric}
                      onChange={(e) => setMetric(e.target.value)}
                    >
                      {HABIT_METRIC_PALETTE.map((m) => <option key={m.metric} value={m.metric}>{m.label}</option>)}
                    </select>
                  </>
                )}
                <div className="rt-lockline">
                  <span aria-hidden="true">✓</span>
                  <span>Ezt <b>később is módosíthatod</b> a szokás oldalán.</span>
                </div>
              </FieldCard>
            </>
          )}

          {/* ÜNNEPLÉS (FOGG) / JUTALOM (CLEAR · 4. törvény) + VÁLLALÁS */}
          {(stepId === 'celeb' || stepId === 'reward') && (
            <>
              {stepId === 'celeb' ? (
                <>
                  <FieldCard delayMs={80}>
                    <span className="rt-flabel">Ünneplésül … · shine</span>
                    <ChipField options={CELEBRATIONS} value={celebration} onPick={setCelebration} tone="sage" />
                    <input
                      className="rt-fin"
                      aria-label="Ünneplés"
                      value={celebration}
                      onChange={(e) => setCelebration(e.target.value)}
                      placeholder="…vagy a sajátod"
                    />
                  </FieldCard>
                  <Tip sign="⚓">
                    Az ünneplés <b>másodperceken belül</b> jön, és tényleg jó érzés. Ettől rögzül a szokás — nem a fegyelemtől.
                  </Tip>
                </>
              ) : (
                <>
                  <FieldCard delayMs={80}>
                    <span className="rt-flabel">Jutalmam … · kielégítő</span>
                    <ChipField options={REWARDS} value={reward} onPick={setReward} />
                    <input
                      className="rt-fin"
                      aria-label="Jutalom"
                      value={reward}
                      onChange={(e) => setReward(e.target.value)}
                      placeholder="…vagy a sajátod"
                    />
                  </FieldCard>
                  <Tip tone="lav" sign="◈">
                    <b>4. törvény — tedd kielégítővé.</b> A logolás maga a jutalom: a pipa és az emelkedő erő-csík. Ezért az első chip az alap.
                  </Tip>
                </>
              )}
              <button
                type="button"
                className={cn('rt-commit', committed && 'on')}
                aria-pressed={committed}
                onClick={() => setCommitted(!committed)}
              >
                <span className="rt-commit-box" aria-hidden="true">✓</span>
                <span className="rt-commit-body">
                  <b>Vállalom</b>
                  <small>A pipa egy ígéret, nem beállítás. Holnap reggel ott lesz a Nap tabon.</small>
                </span>
              </button>
            </>
          )}

          {/* Nav */}
          <div className="rt-wnav rise" style={rise(170)}>
            {stepIdx > 0 && (
              <button type="button" className="cta-ghost flex-1" onClick={() => setStepIdx(stepIdx - 1)}>← Vissza</button>
            )}
            <button
              type="button"
              className="cta-primary"
              style={{ flex: stepIdx > 0 ? 2 : 1 }}
              disabled={!canProceed || (isLast && pending)}
              onClick={onNext}
            >
              {isLast ? '✓ Mentés' : 'Tovább →'}
            </button>
          </div>
          <p className="mz-principle">{isLast ? NOTE_LAST : NOTE_DEFAULT}</p>
        </EntranceGroup>
      </PageBody>
    </MozaikPage>
  )
}

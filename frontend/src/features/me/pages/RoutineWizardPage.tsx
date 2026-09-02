// ============================================================
// Mezo · RoutineWizardPage (mezo-3zue.4) — /me/rutin/uj, prototype rutin-epito-body.html
// `pg-wiz` ×1.18. Four steps that build ONE habit recipe on one of two frameworks:
// BJ Fogg's habit stacking (horgony → pici tett → ünneplés) or James Clear's four laws
// (jelzés → vágy → válasz → jutalom). The live sentence card is the thesis of the page —
// it renders through the pure `routineSentenceParts`, never a local template, so the wizard
// and the finished habit page can't drift.
//
// The page NEVER ticks a habit (ADR — ticking lives on /nap/rutin) and never creates a
// DERIVED definition: every recipe is `mode: 'MANUAL'`.
// ============================================================
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useHabitCatalog, useHabitCatalogActions } from '@/data/hooks'
import type { HabitDefUpdateInput } from '@/data/habit/habitAdminApi'
import type { HabitFramework, HabitSuggestion } from '@/data/types'
import { habitAnchorOptions } from '@/features/me/logic/habitAnchors'
import { routineSentenceParts, recipeFromDef, titlePlaceholder, type RoutineRecipe } from '@/features/me/logic/routineSentence'
import { LIFE_SKILLS } from '@/features/progression/logic/levelUpMeta'
import { cn } from '@/shared/lib/cn'
import { ClayIcon } from '@/shared/ui/clay'
import { MozaikPage, PageBody, PageHead } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { ScreenSkeleton } from '@/shared/ui/ScreenSkeleton'
import { Stepper } from '@/shared/ui/Stepper'

const STEP_COUNT = 4
const STEP_TITLES: Record<'FOGG' | 'CLEAR', [string, string, string, string]> = {
  FOGG: ['Milyen keretre építsük?', 'Mihez horgonyzod?', 'Mi a pici tett?', 'Hogyan ünnepled?'],
  CLEAR: ['Milyen keretre építsük?', 'Mi a jelzés?', 'Mi a válasz, és miért vágysz rá?', 'Mi teszi kielégítővé?'],
}
const STEP_SUBS: Record<'FOGG' | 'CLEAR', [string, string, string, string]> = {
  FOGG: ['', 'Válassz egy szokást, ami már megy — vagy írd le a pillanatot.', 'Olyan kicsi, hogy rossz napon is megteszed.', 'Az azonnali jó érzés rögzíti a szokást.'],
  CLEAR: ['', 'Idő és hely — hogy a jelzés nyilvánvaló legyen.', 'A tett és a mögötte lévő vágy.', 'A logolás maga jutalom — de lehet több is.'],
}
const INTRO_SUB = 'Mindkettő ugyanoda visz: egy mondat, amit minden nap el tudsz mondani magadnak.'
const CELEBRATIONS = ['ökölrázás', '„Igen!”', 'mosoly a tükörbe', 'mély levegő']
const REWARDS = ['a pipa maga', 'egy fejezet papírkönyv', 'kávé csak utána', 'öt perc semmittevés']
const CUES = ['reggel · konyha', 'este · hálószoba', 'edzés előtt · öltöző', 'ebéd után · asztal']
const XP_MIN = 5
const XP_MAX = 15
const XP_STEP = 5

// An accepted AI suggestion travels here through sessionStorage, not the query string: five
// prose fields (jelzés, vágy, jutalom, ünneplés, cím) would make an unreadable URL, and the
// suggestion is a one-shot hand-off, not a bookmarkable address (ADR 0019 — the suggester only
// PROPOSES; the wizard's own four steps and the "Vállalom" tick are the human pass).
const SUGGESTION_KEY = 'mezo.routineWizard.suggestion'

/** Reads the hand-off ONCE and removes it in the same breath, so a reload cannot resurrect a
 *  stale proposal; a storage failure (private mode, quota, a disabled store) yields null rather
 *  than breaking the page. */
function takeSuggestion(): HabitSuggestion | null {
  try {
    const raw = sessionStorage.getItem(SUGGESTION_KEY)
    sessionStorage.removeItem(SUGGESTION_KEY)
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
  const { catalog, isPending } = useHabitCatalog()
  const { createDef, updateDef, pending } = useHabitCatalogActions()

  // The accepted AI suggestion, claimed once on mount. It only ever seeds INITIAL values: where
  // `?prefill` also has something to say, prefill wins (below) — a user who arrived through
  // "Keret váltása" is editing one specific habit, not accepting a proposal.
  const [suggestion] = useState(takeSuggestion)

  const [step, setStep] = useState(1)
  const [framework, setFramework] = useState<HabitFramework | null>(suggestion?.framework ?? null)
  const [anchorLabel, setAnchorLabel] = useState(suggestion?.anchorCopy ?? '')
  const [anchorHabitKey, setAnchorHabitKey] = useState<string | null>(null)
  const [title, setTitle] = useState(suggestion?.title ?? '')
  const [chainKey, setChainKey] = useState(() => params.get('chain') ?? suggestion?.chainKey ?? 'MORNING')
  const [skillKey, setSkillKey] = useState(
    () => (LIFE_SKILLS.some((s) => s.key === suggestion?.skillKey) ? suggestion!.skillKey : 'mindset'),
  )
  const [xp, setXp] = useState(() => (suggestion != null ? clampXp(suggestion.xp) : 10))
  const [cue, setCue] = useState(suggestion?.cue ?? '')
  const [craving, setCraving] = useState(suggestion?.craving ?? '')
  // A suggestion never carries an identity — that clause is the user's own sentence about who
  // they are becoming, and nothing else may put words in it.
  const [identity, setIdentity] = useState('')
  const [celebration, setCelebration] = useState(suggestion?.celebration ?? '')
  const [reward, setReward] = useState(suggestion?.reward ?? 'a pipa maga')
  const [committed, setCommitted] = useState(false)

  // ?prefill=<habitKey> re-opens an existing definition in the wizard ("keret váltása" on the
  // habit page, mezo-3zue.5). The catalog may still be loading on first render, so the seed
  // runs in an effect and exactly once — a re-render must never stomp the user's edits.
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
    setFramework(seed.framework)
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
    setXp(def.xp)
  }, [catalog, prefillKey, params])

  if (isPending) return <ScreenSkeleton />

  const chains = catalog?.chains ?? []
  const anchors = catalog != null ? habitAnchorOptions(catalog) : []
  const fwKey: 'FOGG' | 'CLEAR' = framework === 'CLEAR' ? 'CLEAR' : 'FOGG'
  const stepTitle = STEP_TITLES[fwKey][step - 1]
  const stepSub = STEP_SUBS[fwKey][step - 1] || INTRO_SUB
  const isLast = step === STEP_COUNT

  const recipe: RoutineRecipe = { framework, title, anchorLabel, celebration, cue, craving, reward, identity }

  // Advisory only (prototype's `tinyWarn`): more than six words, or a number above five, reads
  // as a resolution rather than a tiny habit. It NEVER blocks — see canProceed.
  const tooBig = framework === 'FOGG'
    && (title.trim().split(/\s+/).filter(Boolean).length > 6
        || Number(title.match(/\d+/)?.[0] ?? 0) > 5)

  const canProceed =
    (step === 1 && framework !== null)
    || (step === 2 && (framework === 'FOGG' ? anchorLabel.trim() !== '' : cue.trim() !== ''))
    || (step === 3 && title.trim() !== '' && (framework === 'FOGG' || craving.trim() !== ''))
    || (step === 4 && (framework === 'FOGG' ? celebration.trim() !== '' : reward.trim() !== '') && committed)

  // The framework's OWN fields, identical on both save paths. A FOGG recipe sends EITHER
  // anchorHabitKey OR anchorCopy (never both — the backend rejects that), plus the celebration;
  // a CLEAR recipe sends cue/craving/reward and no anchor field at all. The backend clears the
  // fields the chosen framework does not own, so a conversion needs nothing more than this.
  const frameworkFields = () => (framework === 'FOGG'
    ? {
        ...(anchorHabitKey != null ? { anchorHabitKey } : { anchorCopy: anchorLabel.trim() }),
        celebration: celebration.trim(),
      }
    : {
        cue: cue.trim(), craving: craving.trim(), reward: reward.trim(),
        // "Omit an emptied optional key" (HabitPage's contract-honest rule): the real PATCH
        // ignores a JSON null and rejects nothing for an absent key, so an untouched identity
        // is left out entirely rather than sent as ''.
        ...(identity.trim() ? { identity: identity.trim() } : {}),
      })

  const save = () => {
    if (framework === null) return
    const done = (habitKey: string | undefined) =>
      navigate(habitKey != null ? `/me/rutin?new=${encodeURIComponent(habitKey)}` : '/me/rutin')

    // Re-framing CONVERTS the definition it was opened with — it must never mint a second one.
    // "Keret váltása" on the habit page promises exactly this, and a create here would silently
    // duplicate the habit. `updateDef` accepts no `mode` and no `skillKey`, so both are omitted;
    // `chainKey` goes only when the user actually moved the habit, because the backend reads a
    // bare chainKey as a MOVE and appends the def to the end of that chain (HabitPage's guard).
    if (prefillDef != null) {
      const patch: HabitDefUpdateInput = {
        title: title.trim(), xp: clampXp(xp), framework, ...frameworkFields(),
      }
      if (chainKey !== prefillDef.chainKey) patch.chainKey = chainKey
      updateDef(prefillDef.id, patch).then(() => done(prefillDef.habitKey))
      return
    }

    createDef({
      chainKey, title: title.trim(), mode: 'MANUAL', skillKey, xp, framework, ...frameworkFields(),
    }).then((def) => done(def?.habitKey))
  }

  // Switching the framework on step 1 drops the commitment tick: it is a promise about the
  // recipe you just read, not a setting, and a tick carried over from the Fogg pass would
  // unlock Clear's save on a sentence the user never saw.
  //
  // anchorHabitKey is deliberately NOT reset here. save() reads it only inside the FOGG
  // branch, so it can never leak into a CLEAR payload; clearing it would only bite the
  // FOGG → CLEAR → FOGG path, where anchorLabel survives (the chip still renders selected,
  // since selection matches on the label) while the key would not — silently downgrading a
  // real habit link to anchorCopy free text with nothing on screen to say so.
  const pickFramework = (next: HabitFramework) => {
    if (next === framework) return
    setFramework(next)
    setCommitted(false)
  }

  const onNext = () => {
    if (!canProceed) return
    if (isLast) save()
    else setStep(step + 1)
  }

  return (
    <MozaikPage tone="gold">
      <PageHead
        onBack={() => (step > 1 ? setStep(step - 1) : navigate('/me/rutin'))}
        label={step > 1 ? `‹ ${STEP_TITLES[fwKey][step - 2]}` : '‹ Rutin'}
      >
        <button type="button" className="pgact" onClick={() => navigate('/me/rutin')}>Mégse</button>
      </PageHead>
      <PageBody>
        <EntranceGroup replayKey={step}>
          <Stepper className="rise" title="Új szokás-recept" step={step} total={STEP_COUNT} stepLabel={stepTitle} />

          <div className="rt-wtitle rise" style={rise(30)}>{stepTitle}</div>
          <div className="rt-wsub rise" style={rise(40)}>{stepSub}</div>

          {step > 1 && (
            <div
              className={cn('rt-sentence', framework === 'CLEAR' && 'is-clear', isLast && 'is-big')}
              data-testid="recipe-sentence"
            >
              <span className="rt-sentence-lb">
                {framework === 'FOGG' ? '⚓ Szokás-láncolás' : '◈ Négy törvény'}
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

          {/* 1 · KERET */}
          {step === 1 && (
            <>
              <button
                type="button"
                className={cn('rt-fwcard is-fogg rise', framework === 'FOGG' && 'on')}
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
                className={cn('rt-fwcard is-clear rise', framework === 'CLEAR' && 'on')}
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
              <Tip sign="💡">
                Nem tudod eldönteni? <b>Szokás-láncolással</b> kezdj — ha a tett tényleg pici, nincs mit legyőzni.
              </Tip>
            </>
          )}

          {/* 2 · HORGONY / JELZÉS */}
          {step === 2 && framework === 'FOGG' && (
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
          {step === 2 && framework === 'CLEAR' && (
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

          {/* 3 · VISELKEDÉS */}
          {step === 3 && (
            <>
              <FieldCard delayMs={80}>
                {/* The prototype's `titleLb`: the Clear branch names the slot "válasz", not the
                    sentence module's shorter "tett" — the label teaches the law, the sentence reads. */}
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

              {framework === 'CLEAR' && (
                <>
                  <FieldCard delayMs={100}>
                    <span className="rt-flabel">Mert … · vágy</span>
                    <input
                      className="rt-fin"
                      aria-label="Vágy"
                      value={craving}
                      onChange={(e) => setCraving(e.target.value)}
                      placeholder="pl. „tisztább fejjel indul a nap”"
                    />
                  </FieldCard>
                  <FieldCard delayMs={115}>
                    <span className="rt-flabel">Hogy olyan ember legyek, aki … <span className="rt-opt">opcionális</span></span>
                    <input
                      className="rt-fin"
                      aria-label="Identitás"
                      value={identity}
                      onChange={(e) => setIdentity(e.target.value)}
                      placeholder="pl. „figyel a saját gondolataira”"
                    />
                  </FieldCard>
                  <Tip tone="lav" sign="◈">
                    <b>2. + 3. törvény.</b> A vágy a tett vonzereje; a könnyűség a kétperces szabály — a tett első két perce legyen a cél.
                  </Tip>
                </>
              )}

              <FieldCard delayMs={130}>
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

              <FieldCard delayMs={150}>
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
                <span className="rt-flabel" style={{ marginTop: 10 }}>XP</span>
                <span className="rt-stepin">
                  <button type="button" aria-label="XP csökkentése" onClick={() => setXp(Math.max(XP_MIN, xp - XP_STEP))}>−</button>
                  <b>{xp} XP</b>
                  <button type="button" aria-label="XP növelése" onClick={() => setXp(Math.min(XP_MAX, xp + XP_STEP))}>＋</button>
                </span>
                <div className="rt-hint">5–15 · a pici tett 5-öt ér, a nehéz 15-öt.</div>
              </FieldCard>
            </>
          )}

          {/* 4 · JUTALOM + VÁLLALÁS */}
          {step === 4 && (
            <>
              {framework === 'FOGG' ? (
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
            {step > 1 && (
              <button type="button" className="cta-ghost flex-1" onClick={() => setStep(step - 1)}>← Vissza</button>
            )}
            <button
              type="button"
              className="cta-primary"
              style={{ flex: step > 1 ? 2 : 1 }}
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

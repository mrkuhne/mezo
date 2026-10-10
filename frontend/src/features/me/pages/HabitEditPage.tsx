// ============================================================
// Mezo · HabitEditPage (mezo-bk26; Folyadék F2 mezo-n4wf5.2) —
// /nap/rutin/szokas/:habitKey/szerkesztes, prototype vilagos/nap.js `szerk`. The recipe editor on
// its OWN page (option B of rutin-szerkeszto-valasztas.html): option A (in place) was built first
// and failed in use — the formation page grew long enough that the in-place editor opened below
// the fold, so the header button read as doing nothing. HabitPage is the details surface; every
// WRITE lives here. The hero is the recipe itself, changing as you type, with „Mentés" on its
// liquid row.
//
// Three things this page fixes over the old in-place form:
//  - the anchor is a PICKER (your habits + mezo-moments + free text + „Leoldom"), never a
//    locked field — the contract's blank-string unlink sentinel is the picker's job, not typing;
//  - a framework switch names the fields it will destroy BEFORE the save (the backend's
//    clearForeignFields nulls them silently);
//  - mode/metric are editable (mezo-pero) and the emptied optional fields really clear
//    (blank string on the wire), instead of the old "omit and quietly keep".
//
// The page NEVER ticks a habit (ADR — ticking lives on /nap/rutin).
// ============================================================
import { useState, type ReactNode } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { useLeaveAfterMutation } from '@/shared/hooks/useBackNav'
import { useHabitCatalog, useHabitCatalogActions, useHabitSummary } from '@/data/hooks'
import type { HabitDefUpdateInput } from '@/data/habit/habitAdminApi'
import type { HabitFramework, HabitMode } from '@/data/types'
import { EffortGrid } from '@/features/me/components/EffortGrid'
import { RbBack, RecipeSentence, RecipeVessels, recipeParts } from '@/features/me/components/routineBits'
import { MEZO_EVENT_ANCHORS } from '@/features/me/logic/habitAnchors'
import { EMPTY_EFFORT, effortRated, effortXp, type EffortState } from '@/features/me/logic/habitEffort'
import { HABIT_METRIC_PALETTE } from '@/features/me/logic/habitMetricPalette'
import { recipeFromDef, titlePlaceholder } from '@/features/me/logic/routineSentence'
import { Sheet } from '@/shared/ui/Sheet'
import {
  Btn, Card, ErrorRow, FoSheetHead, Hero, Lab, Level, Mark, Note, Page, Pill, Pills, Row, Section, Seg, Why,
  useFrameTitle,
} from '@/shared/ui/folyadek'
import { VoiceField } from '@/shared/ui/voice/VoiceField'
import { appendDictation } from '@/shared/lib/voice/useVoiceInput'

const XP_MIN = 5
const XP_MAX = 15

/** One labelled field. A sentence field gets the shared mic tile (mezo-xojq8); names and links do not. */
function Field({ id, label, name, opt, value, onChange, placeholder, hint, voice = false, area = false }: {
  id: string
  /** The visible label. */
  label: string
  /** The accessible name (defaults to the label). */
  name?: string
  opt?: boolean
  value: string
  onChange: (v: string) => void
  placeholder?: string
  hint?: string
  voice?: boolean
  area?: boolean
}) {
  const input = area
    ? <textarea id={id} className="fo-in" rows={2} aria-label={name ?? label} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    : <input id={id} className="fo-in" aria-label={name ?? label} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
  return (
    <>
      <Lab htmlFor={id}>{label}{opt && <span className="rb-opt"> · opcionális</span>}</Lab>
      {voice
        ? <VoiceField domain="me" size="sm" onTranscript={(t) => onChange(appendDictation(value, t))}>{input}</VoiceField>
        : input}
      {hint && <Note>{hint}</Note>}
    </>
  )
}

/** The picker's resolved anchor: linked to a def (key) or free prose (label only). */
interface AnchorState {
  key: string | null
  label: string
}

export function HabitEditPage() {
  const leave = useLeaveAfterMutation()
  const { habitKey = '' } = useParams<{ habitKey: string }>()
  const { catalog, isPending, isError, refetch } = useHabitCatalog()
  const { data: summary } = useHabitSummary()
  const { updateDef, deleteDef, pending } = useHabitCatalogActions()

  const defs = (catalog?.chains ?? []).flatMap((c) => c.defs)
  const def = defs.find((d) => d.habitKey === habitKey)
  const backTo = `/nap/rutin/szokas/${habitKey}`

  const [seedKey, setSeedKey] = useState<string | null>(null)
  const [framework, setFramework] = useState<HabitFramework | null>(null)
  const [title, setTitle] = useState('')
  const [anchor, setAnchor] = useState<AnchorState>({ key: null, label: '' })
  const [anchorPickerOpen, setAnchorPickerOpen] = useState(false)
  const [celebration, setCelebration] = useState('')
  const [cue, setCue] = useState('')
  const [craving, setCraving] = useState('')
  const [reward, setReward] = useState('')
  const [identity, setIdentity] = useState('')
  const [why, setWhy] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [mode, setMode] = useState<HabitMode>('MANUAL')
  const [metric, setMetric] = useState('')
  const [chainKey, setChainKey] = useState('MORNING')
  // XP is not a field (mezo-9k99): the effort grid derives it. An untouched grid keeps the
  // stored value — re-rating is an explicit act, not a side effect of opening the editor.
  const [eff, setEff] = useState<EffortState>(EMPTY_EFFORT)
  const [confirmDelete, setConfirmDelete] = useState(false)
  useFrameTitle({ title: 'Szerkesztés', eyebrow: def != null ? `Szokás · ${def.title}` : undefined })

  // Every controlled field seeds ONCE from the definition (the HabitPage idiom): a background
  // catalog refetch must not stomp an edit in progress.
  if (def != null && seedKey !== def.id) {
    const seed = recipeFromDef(def, (key) => defs.find((d) => d.habitKey === key)?.title)
    setSeedKey(def.id)
    setFramework(def.framework)
    setTitle(seed.title)
    setAnchor({ key: def.anchorHabitKey, label: seed.anchorLabel })
    setCelebration(seed.celebration)
    setCue(seed.cue)
    setCraving(seed.craving)
    setReward(seed.reward)
    setIdentity(seed.identity)
    setWhy(def.why ?? '')
    setLinkUrl(def.linkUrl ?? '')
    setMode(def.mode)
    setMetric(def.metric !== 'manual' ? def.metric : (HABIT_METRIC_PALETTE[0]?.metric ?? ''))
    setChainKey(def.chainKey)
    setEff(EMPTY_EFFORT)
    setConfirmDelete(false)
    return null
  }

  if (def == null) {
    if (isPending) {
      return (
        <Page>
          <RbBack label="Szokás" fallback={backTo} />
          <Card><Note>Szokás betöltése…</Note></Card>
        </Page>
      )
    }
    if (isError) {
      return (
        <Page>
          <RbBack label="Szokás" fallback={backTo} />
          <Card><ErrorRow message="Nem sikerült betölteni a szokást." onRetry={refetch} /></Card>
        </Page>
      )
    }
    return <Navigate to="/nap/rutin/epites" replace />
  }

  const chains = [...(catalog?.chains ?? [])].sort((a, b) => a.position - b.position)
  const recipe = { framework, title, anchorLabel: anchor.label, celebration, cue, craving, reward, identity }

  // What a pending framework switch will destroy — the stored def's OWN values, named while
  // the user can still back out. The backend's clearForeignFields does this silently.
  const lostOnSwitch: string[] = []
  if (framework !== def.framework) {
    if (framework === 'CLEAR') {
      const storedAnchor = def.anchorHabitKey != null
        ? recipeFromDef(def, (key) => defs.find((d) => d.habitKey === key)?.title).anchorLabel
        : def.anchorCopy
      if (storedAnchor) lostOnSwitch.push(`a horgony („${storedAnchor}”)`)
      if (def.celebration) lostOnSwitch.push(`az ünneplés („${def.celebration}”)`)
    }
    if (framework === 'FOGG') {
      if (def.cue) lostOnSwitch.push(`a jelzés („${def.cue}”)`)
      if (def.craving) lostOnSwitch.push(`a vágy („${def.craving}”)`)
      if (def.reward) lostOnSwitch.push(`a jutalom („${def.reward}”)`)
      if (def.identity) lostOnSwitch.push(`az identitás („${def.identity}”)`)
    }
  }

  const canSave = title.trim() !== '' && (
    framework === 'FOGG' ? (anchor.key != null || anchor.label.trim() !== '') && celebration.trim() !== ''
      : framework === 'CLEAR' ? cue.trim() !== '' && craving.trim() !== '' && reward.trim() !== ''
        : true
  ) && (mode === 'DERIVED' ? metric !== '' && metric !== 'manual' : true)

  const save = () => {
    if (!canSave) return
    // Blank string CLEARS an optional field (mezo-pero, the anchorHabitKey sentinel
    // generalized) — the old "omit an emptied key" rule is gone with the contract gap it
    // papered over. `chainKey` still goes only on an actual move (a re-send would re-order).
    // XP: derived from the effort grid once the user re-rated; an untouched grid re-sends the
    // stored value (clamped — an out-of-band legacy value must not survive a save unclamped).
    const xp = effortRated(eff) ? effortXp(eff) : Math.min(XP_MAX, Math.max(XP_MIN, def.xp))
    const patch: HabitDefUpdateInput = { title: title.trim(), xp }
    if (chainKey !== def.chainKey) patch.chainKey = chainKey
    if (framework !== def.framework && framework != null) patch.framework = framework
    if (framework === 'FOGG') {
      if (anchor.key != null) {
        patch.anchorHabitKey = anchor.key
      } else {
        patch.anchorCopy = anchor.label.trim()
        // Unlink sentinel: only a blank string can say "drop the stored link" on this PATCH.
        if (def.anchorHabitKey != null) patch.anchorHabitKey = ''
      }
      patch.celebration = celebration.trim()
    } else if (framework === 'CLEAR') {
      patch.cue = cue.trim()
      patch.craving = craving.trim()
      patch.reward = reward.trim()
      patch.identity = identity.trim()
    } else {
      patch.why = why.trim()
      patch.anchorCopy = anchor.label.trim()
      if (def.anchorHabitKey != null && anchor.key == null) patch.anchorHabitKey = ''
    }
    if (mode !== def.mode) patch.mode = mode
    if (mode === 'DERIVED' && (mode !== def.mode || metric !== def.metric)) patch.metric = metric
    patch.linkUrl = linkUrl.trim()
    updateDef(def.id, patch).then(() => leave.back(backTo))
  }

  const togglePause = () => {
    if (pending) return
    updateDef(def.id, { isActive: !def.isActive }).then(() => leave.back(backTo))
  }

  const remove = () => {
    if (pending) return
    if (!confirmDelete) { setConfirmDelete(true); return }
    // the habit's own page sits right behind this editor: it goes too
    deleteDef(def.id).then(() => leave.pastDetail('/nap/rutin/epites'))
  }

  const pickAnchor = (next: AnchorState) => {
    setAnchor(next)
    setAnchorPickerOpen(false)
  }

  const anchorDef = anchor.key != null ? defs.find((d) => d.habitKey === anchor.key) : undefined
  const strengthOf = (key: string) => summary.habits.find((h) => h.key === key)?.strengthPct ?? null
  const anchorStrength = anchor.key != null ? strengthOf(anchor.key) : null
  const anchorNote: ReactNode = anchor.key != null
    ? <>A <b>{anchorDef?.title ?? anchor.key}</b> szokásodhoz kötve — koppints a cseréhez.</>
    : anchor.label.trim() !== ''
      ? 'Szabad szöveg — nem kötődik szokáshoz, ezért a lánc nem tudja követni.'
      : 'Horgony nélkül a szokás nehezebben formálódik: a kontextus-állandóság esik.'

  const showAnchor = framework !== 'CLEAR'
  const candidates = defs.filter((d) => d.habitKey !== def.habitKey && d.isActive)
  const storedXp = Math.min(XP_MAX, Math.max(XP_MIN, def.xp))

  return (
    <Page>
      <RbBack label="Szokás" fallback={backTo} />
      <Hero
        label="A recept · együtt változik"
        verdict={title.trim() !== '' ? title : def.title}
        actions={<Btn disabled={!canSave || pending} onClick={save}>Mentés</Btn>}
      >
        <RecipeVessels parts={recipeParts(recipe)} />
        <RecipeSentence recipe={recipe} testId="edit-sentence" />
      </Hero>

      <Section n={1} title={showAnchor ? 'Keret és horgony' : 'Keret'} />
      <Card>
        <Lab>Keret</Lab>
        <Seg
          aria-label="Keret"
          items={[{ key: 'FOGG', label: 'Szokás-láncolás' }, { key: 'CLEAR', label: 'Négy törvény' }]}
          value={framework ?? ''}
          onChange={(k) => setFramework(k as HabitFramework)}
        />
        {lostOnSwitch.length > 0 && (
            <Why icon="t-info" data-testid="fw-warn">
              <b>Váltásnál elveszik:</b> {lostOnSwitch.join(', ')}.
              {' '}Az új keret mezői üresen indulnak — a Mentésig semmi nem vész el.
            </Why>
        )}

        {showAnchor && (
          <>
            <Lab>Miután… · horgony</Lab>
              <Row
                data-testid="anchor-pick"
                icon="t-anchor"
                title={anchor.label.trim() !== '' ? anchor.label : '— nincs horgony —'}
                sub={anchor.key == null ? undefined : anchorStrength != null ? `${anchorStrength}% erő · 28 nap` : 'friss szokás'}
                more={anchorStrength != null ? <Level pct={anchorStrength} height={8} /> : undefined}
                onClick={() => setAnchorPickerOpen(true)}
              />
            {anchor.key == null && (
              <>
                <Lab htmlFor="rb-ed-anchor">Saját szavakkal</Lab>
                <VoiceField domain="me" size="sm" onTranscript={(t) => setAnchor({ key: null, label: appendDictation(anchor.label, t) })}>
                  <input
                    id="rb-ed-anchor"
                    className="fo-in"
                    aria-label="Saját horgony"
                    value={anchor.label}
                    placeholder="pl. „letettem a fogkefét”"
                    onChange={(e) => setAnchor({ key: null, label: e.target.value })}
                  />
                </VoiceField>
              </>
            )}
            <Note>{anchorNote}</Note>
          </>
        )}
      </Card>

      <Section n={2} title="A szokás" />
      <Card>
        <Field
          id="rb-ed-title"
          label={framework === null ? 'Cím' : `Cím · ${framework === 'CLEAR' ? 'válasz' : titlePlaceholder(framework)}`}
          value={title}
          onChange={setTitle}
        />
        {framework === 'FOGG' && (
          <Field id="rb-ed-celeb" label="Ünneplésül" voice value={celebration} onChange={setCelebration} />
        )}
        {framework === 'CLEAR' && (
          <>
            <Field id="rb-ed-cue" label="Jelzés" voice value={cue} onChange={setCue} />
            <Field id="rb-ed-crave" label="Vágy" voice value={craving} onChange={setCraving} />
            <Field id="rb-ed-reward" label="Jutalom" voice value={reward} onChange={setReward} />
            <Field id="rb-ed-identity" label="Identitás" opt voice value={identity} onChange={setIdentity} />
          </>
        )}
        {framework === null && (
          <Field id="rb-ed-why" label="Miért" opt voice area value={why} onChange={setWhy} placeholder="…" />
        )}
        <Field
          id="rb-ed-link"
          label="Link"
          opt
          value={linkUrl}
          onChange={setLinkUrl}
          placeholder="https://…"
          hint="A Rutin fülön a szokás címe erre a linkre mutat."
        />
      </Card>

      <Section n={3} title="Pipálás és lánc" />
      <Card>
        <Lab>Hogyan pipálódik?</Lab>
        <Seg
          aria-label="Hogyan pipálódik?"
          items={[{ key: 'MANUAL', label: 'Kézzel pipálom' }, { key: 'DERIVED', label: 'Adatból' }]}
          value={mode}
          onChange={(k) => setMode(k as HabitMode)}
        />
        {mode === 'DERIVED' && (
          <>
            <Lab htmlFor="rb-ed-metric">Metrika</Lab>
            <select
              id="rb-ed-metric"
              aria-label="Metrika"
              className="fo-in"
              value={metric}
              onChange={(e) => setMetric(e.target.value)}
            >
              {HABIT_METRIC_PALETTE.map((m) => <option key={m.metric} value={m.metric}>{m.label}</option>)}
            </select>
            <Note>Adatból pipálódó szokást nem kell kézzel jelölnöd — a forrás-log dönt.</Note>
          </>
        )}
        <Lab>Lánc</Lab>
        <Pills>
          {chains.map((c) => (
            <Pill key={c.chainKey} on={chainKey === c.chainKey} onClick={() => setChainKey(c.chainKey)}>{c.title}</Pill>
          ))}
        </Pills>
      </Card>

      <Section n={4} title="Mennyibe kerül? · újraértékelhető" />
      <Card>
        <EffortGrid value={eff} onChange={setEff} xpOverride={effortRated(eff) ? undefined : storedXp} />
        <Note>
          A nehézség változik, ahogy a szokás automatizálódik — érdemes újraértékelni, ha már könnyebben megy.
          Az XP a nehézségből számolódik (6–14).
        </Note>
      </Card>

      <Section n={5} title="Szünet vagy törlés" />
      <Card>
        <Row
          icon={def.isActive ? 't-hold' : 't-play'}
          title={def.isActive ? 'Szüneteltetés' : 'Folytatás'}
          sub={def.isActive ? 'a haladás megmarad' : 'a haladás megmaradt'}
          onClick={togglePause}
        />
        <Row
          icon="t-trash"
          className={confirmDelete ? 'rb-armed' : undefined}
          title={confirmDelete ? 'Biztosan törlöd? Koppints újra' : 'Szokás törlése'}
          sub={confirmDelete ? undefined : 'két koppintás kell hozzá'}
          aria-label={confirmDelete ? 'Biztosan törlöd? Koppints újra' : 'Szokás törlése'}
          onClick={remove}
        />
      </Card>

      {anchorPickerOpen && (
        <Sheet className="fo-sheet" onClose={() => setAnchorPickerOpen(false)} labelledBy="anchor-picker-title">
          {(close) => (
            <div data-testid="anchor-sheet">
              <FoSheetHead titleId="anchor-picker-title" icon="t-anchor" title="Mihez kötöd?" sub="Horgony" onClose={close} />
              <Lab>A szokásaidból</Lab>
              {candidates.map((d) => {
                const strength = strengthOf(d.habitKey)
                return (
                  <Row
                    key={d.habitKey}
                    left={<Mark state={anchor.key === d.habitKey ? 'done' : 'empty'} />}
                    title={d.title}
                    sub={strength != null ? `${strength}% erő · 28 nap` : 'friss szokás'}
                    more={strength != null ? <Level pct={strength} height={8} /> : undefined}
                    right=""
                    onClick={() => pickAnchor({ key: d.habitKey, label: `kész a ${d.title}` })}
                  />
                )
              })}
              <Lab>Mezo-események</Lab>
              {/* The wizard's own moment list (habitAnchors.MEZO_EVENT_ANCHORS) — still free
                  text on the wire: a moment is not a def, so it cannot be an anchorHabitKey
                  link (event binding tracked as mezo-t45n). */}
              {MEZO_EVENT_ANCHORS.map((m) => (
                <Row
                  key={m.label}
                  left={<Mark state={anchor.key == null && anchor.label === m.label ? 'done' : 'empty'} />}
                  title={m.label}
                  sub="Mezo-esemény · szabad szövegként tárolva"
                  right=""
                  onClick={() => pickAnchor({ key: null, label: m.label })}
                />
              ))}
              <Lab>Egyéb</Lab>
              <Row
                icon="t-note" title="Saját szavakkal…" sub="szabad szöveg, nem kötődik szokáshoz" right=""
                onClick={() => pickAnchor({ key: null, label: anchor.key != null ? '' : anchor.label })}
              />
              <Row
                icon="t-skip" title="Leoldom a horgonyt" sub="a szokás marad, csak nem kötődik semmihez" right=""
                onClick={() => pickAnchor({ key: null, label: '' })}
              />
              <Note>A legerősebb horgony egy szokás, ami már magától megy.</Note>
            </div>
          )}
        </Sheet>
      )}
    </Page>
  )
}

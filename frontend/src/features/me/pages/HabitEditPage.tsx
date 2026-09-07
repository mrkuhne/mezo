// ============================================================
// Mezo · HabitEditPage (mezo-bk26) — /me/rutin/szokas/:habitKey/szerkesztes, prototype
// rutin-formalodas.html `pg-edit` ×1.18. The recipe editor moved to its OWN page (option B of
// rutin-szerkeszto-valasztas.html): option A (in place) was built first and failed in use —
// the formation page grew long enough that the in-place editor opened below the fold, so the
// header button read as doing nothing. HabitPage is the details surface; every WRITE lives here.
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
import { useState, type CSSProperties, type ReactNode } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useHabitCatalog, useHabitCatalogActions, useHabitSummary } from '@/data/hooks'
import type { HabitDefUpdateInput } from '@/data/habit/habitAdminApi'
import type { HabitFramework, HabitMode } from '@/data/types'
import { EffortGrid } from '@/features/me/components/EffortGrid'
import { MEZO_EVENT_ANCHORS } from '@/features/me/logic/habitAnchors'
import { EMPTY_EFFORT, effortRated, effortXp, type EffortState } from '@/features/me/logic/habitEffort'
import { HABIT_METRIC_PALETTE } from '@/features/me/logic/habitMetricPalette'
import { routineSentenceParts, titlePlaceholder } from '@/features/me/logic/routineSentence'
import { recipeFromDef } from '@/features/me/logic/routineSentence'
import { cn } from '@/shared/lib/cn'
import { GhostState } from '@/shared/ui/GhostState'
import { Sheet } from '@/shared/ui/Sheet'
import { MozaikPage, PageBody, PageHead, PageHero } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'

const XP_MIN = 5
const XP_MAX = 15

const PRINCIPLE = 'A recept a tiéd: minden mező a te szavaiddal él. A keretváltás előre megmondja, '
  + 'mi vész el — semmi nem tűnik el némán.'

function rise(delayMs: number): CSSProperties {
  return { '--d': `${delayMs}ms` } as CSSProperties
}

function FieldCard({ children, delayMs }: { children: ReactNode; delayMs: number }) {
  return <div className="rt-fcard rise" style={rise(delayMs)}>{children}</div>
}

function Field({ label, opt, value, onChange, placeholder, hint }: {
  label: string
  opt?: boolean
  value: string
  onChange: (v: string) => void
  placeholder?: string
  hint?: string
}) {
  return (
    <>
      <span className="rt-flabel">
        {label}{opt && <> <span className="rt-opt">opcionális</span></>}
      </span>
      <input
        className="rt-fin"
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {hint && <div className="rt-hint">{hint}</div>}
    </>
  )
}

/** The picker's resolved anchor: linked to a def (key) or free prose (label only). */
interface AnchorState {
  key: string | null
  label: string
}

export function HabitEditPage() {
  const navigate = useNavigate()
  const { habitKey = '' } = useParams<{ habitKey: string }>()
  const { catalog, isPending, isError, refetch } = useHabitCatalog()
  const { data: summary } = useHabitSummary()
  const { updateDef, deleteDef, pending } = useHabitCatalogActions()

  const defs = (catalog?.chains ?? []).flatMap((c) => c.defs)
  const def = defs.find((d) => d.habitKey === habitKey)
  const backTo = `/me/rutin/szokas/${habitKey}`

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
        <MozaikPage tone="gold">
          <PageHead onBack={() => navigate(backTo)} label="‹ Szokás" />
          <PageBody><GhostState message="Szokás betöltése…" lines={3} /></PageBody>
        </MozaikPage>
      )
    }
    if (isError) {
      return (
        <MozaikPage tone="gold">
          <PageHead onBack={() => navigate(backTo)} label="‹ Szokás" />
          <PageBody>
            <GhostState message="Nem sikerült betölteni a szokást." ctaLabel="Újra" onCta={refetch} />
          </PageBody>
        </MozaikPage>
      )
    }
    return <Navigate to="/me/rutin" replace />
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
    updateDef(def.id, patch).then(() => navigate(backTo))
  }

  const togglePause = () => {
    updateDef(def.id, { isActive: !def.isActive }).then(() => navigate(backTo))
  }

  const remove = () => {
    if (!confirmDelete) { setConfirmDelete(true); return }
    deleteDef(def.id).then(() => navigate('/me/rutin'))
  }

  const pickAnchor = (next: AnchorState) => {
    setAnchor(next)
    setAnchorPickerOpen(false)
  }

  const anchorNote = anchor.key != null
    ? { sign: '⚓', text: <>A <b>{defs.find((d) => d.habitKey === anchor.key)?.title ?? anchor.key}</b> szokásodhoz kötve — koppints a cseréhez.</> }
    : anchor.label.trim() !== ''
      ? { sign: '✎', text: <>Szabad szöveg — nem kötődik szokáshoz, ezért a lánc nem tudja követni.</> }
      : { sign: '⚠', text: <>Horgony nélkül a szokás nehezebben formálódik: a kontextus-állandóság esik.</> }

  const showAnchor = framework !== 'CLEAR'
  const candidates = defs.filter((d) => d.habitKey !== def.habitKey && d.isActive)

  return (
    <MozaikPage tone="gold">
      <PageHead onBack={() => navigate(backTo)} label="‹ Szokás">
        <button type="button" className="mz-pgact" disabled={!canSave || pending} onClick={save}>Mentés</button>
      </PageHead>
      <PageHero icon="i-recept" iconSize={40} big="Szerkesztés" name={def.title} />
      <PageBody principle={PRINCIPLE}>
        <EntranceGroup replayKey={def.id}>
          <div
            className={cn('rt-sentence rise', framework === 'CLEAR' && 'is-clear')}
            style={rise(40)}
            data-testid="edit-sentence"
          >
            <span className="rt-sentence-lb">
              {framework === 'CLEAR' ? '◈ Négy törvény' : framework === 'FOGG' ? '⚓ Szokás-láncolás' : '· Keret nélkül'}
              <span className="rt-sentence-lb-sub">· együtt változik</span>
            </span>
            <p className="rt-sentence-tx">
              {routineSentenceParts(recipe).map((part, i) => (
                part.slot === undefined
                  ? <span key={i}>{part.text}</span>
                  : <span key={i} className={cn('rt-blank', part.filled && 'is-filled')}>{part.text}</span>
              ))}
            </p>
          </div>

          <FieldCard delayMs={60}>
            <span className="rt-flabel">Keret</span>
            <div className="rt-swseg">
              <button
                type="button"
                className={cn(framework === 'FOGG' && 'on')}
                onClick={() => setFramework('FOGG')}
              >
                <span aria-hidden="true">⚓</span>Szokás-láncolás
              </button>
              <button
                type="button"
                className={cn(framework === 'CLEAR' && 'on is-clear')}
                onClick={() => setFramework('CLEAR')}
              >
                <span aria-hidden="true">◈</span>Négy törvény
              </button>
            </div>
            {lostOnSwitch.length > 0 && (
              <div className="rt-warn" data-testid="fw-warn">
                <span aria-hidden="true">⚠</span>
                <span>
                  <b>Váltásnál elveszik:</b> {lostOnSwitch.join(', ')}.
                  {' '}Az új keret mezői üresen indulnak — a Mentésig semmi nem vész el.
                </span>
              </div>
            )}
          </FieldCard>

          {showAnchor && (
            <FieldCard delayMs={80}>
              <span className="rt-flabel">
                Miután… <span className="rt-opt">horgony</span>
              </span>
              <button
                type="button"
                className="rt-pickrow"
                data-testid="anchor-pick"
                onClick={() => setAnchorPickerOpen(true)}
              >
                <span className="rt-pickrow-gr">{anchor.label.trim() !== '' ? anchor.label : '— nincs horgony —'}</span>
                <span className="rt-pickrow-cv" aria-hidden="true">▾</span>
              </button>
              {anchor.key == null && (
                <input
                  className="rt-fin"
                  aria-label="Saját horgony"
                  value={anchor.label}
                  placeholder="pl. „letettem a fogkefét”"
                  onChange={(e) => setAnchor({ key: null, label: e.target.value })}
                />
              )}
              <div className="rt-lockline">
                <span aria-hidden="true">{anchorNote.sign}</span>
                <span>{anchorNote.text}</span>
              </div>
            </FieldCard>
          )}

          <FieldCard delayMs={100}>
            <Field
              label={framework === null ? 'Cím' : `Cím · ${framework === 'CLEAR' ? 'válasz' : titlePlaceholder(framework)}`}
              value={title}
              onChange={setTitle}
            />
            {framework === 'FOGG' && (
              <Field label="Ünneplésül … · shine" value={celebration} onChange={setCelebration} />
            )}
            {framework === 'CLEAR' && (
              <>
                <Field label="Jelzés" value={cue} onChange={setCue} />
                <Field label="Vágy" value={craving} onChange={setCraving} />
                <Field label="Jutalom" value={reward} onChange={setReward} />
                <Field label="Identitás" opt value={identity} onChange={setIdentity} />
              </>
            )}
            {framework === null && (
              <Field label="Miért" opt value={why} onChange={setWhy} placeholder="…" />
            )}
            <Field
              label="Link"
              opt
              value={linkUrl}
              onChange={setLinkUrl}
              placeholder="https://…"
              hint="A Nap tabon a szokás címe erre a linkre mutat."
            />
          </FieldCard>

          <FieldCard delayMs={130}>
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
                <div className="rt-hint">Adatból pipálódó szokást nem kell kézzel jelölnöd — a forrás-log dönt.</div>
              </>
            )}
          </FieldCard>

          <FieldCard delayMs={160}>
            <span className="rt-flabel">Lánc</span>
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

          <FieldCard delayMs={175}>
            <span className="rt-flabel">Mennyibe kerül? <span className="rt-opt">újraértékelhető</span></span>
            <EffortGrid
              value={eff}
              onChange={setEff}
              xpOverride={effortRated(eff) ? undefined : Math.min(XP_MAX, Math.max(XP_MIN, def.xp))}
            />
            <div className="rt-lockline">
              <span aria-hidden="true">ⓘ</span>
              <span>A nehézség <b>változik</b>, ahogy a szokás automatizálódik — érdemes újraértékelni, ha már könnyebben megy. Az XP a nehézségből számolódik (6–14).</span>
            </div>
          </FieldCard>

          <button type="button" className="rt-danger rise" style={rise(190)} disabled={pending} onClick={togglePause}>
            {def.isActive ? 'Szüneteltetés — a haladás megmarad' : 'Folytatás — a haladás megmaradt'}
          </button>
          <button
            type="button"
            className={cn('rt-danger is-hard rise', confirmDelete && 'is-armed')}
            style={rise(210)}
            disabled={pending}
            onClick={remove}
          >
            {confirmDelete ? 'Biztosan törlöd? Koppints újra' : 'Szokás törlése'}
          </button>
        </EntranceGroup>
      </PageBody>

      {anchorPickerOpen && (
        <Sheet onClose={() => setAnchorPickerOpen(false)} labelledBy="anchor-picker-title">
          {() => (
            <div className="col" style={{ padding: '4px 4px 8px' }} data-testid="anchor-sheet">
              <h2 id="anchor-picker-title" style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>
                Mihez kötöd?
              </h2>
              <p className="rt-hint" style={{ margin: '2px 0 8px' }}>
                A legerősebb horgony egy szokás, ami már magától megy.
              </p>
              <div className="rt-optgrp">A szokásaidból</div>
              {candidates.map((d) => {
                const row = summary.habits.find((h) => h.key === d.habitKey)
                return (
                  <button
                    key={d.habitKey}
                    type="button"
                    className={cn('rt-optrow', anchor.key === d.habitKey && 'on')}
                    onClick={() => pickAnchor({ key: d.habitKey, label: `kész a ${d.title}` })}
                  >
                    <span className="rt-optrow-nm">
                      {d.title}
                      <small>{row?.strengthPct != null ? `${row.strengthPct}% erő · 28 nap` : 'friss szokás'}</small>
                    </span>
                    <span className="rt-optrow-rad" aria-hidden="true" />
                  </button>
                )
              })}
              <div className="rt-optgrp">Mezo-események</div>
              {/* The wizard's own moment list (habitAnchors.MEZO_EVENT_ANCHORS) — still free
                  text on the wire: a moment is not a def, so it cannot be an anchorHabitKey
                  link (event binding tracked as mezo-t45n). */}
              {MEZO_EVENT_ANCHORS.map((m) => (
                <button
                  key={m.label}
                  type="button"
                  className="rt-optrow"
                  onClick={() => pickAnchor({ key: null, label: m.label })}
                >
                  <span className="rt-optrow-nm">{m.label}<small>mezo-esemény · szabad szövegként tárolva</small></span>
                  <span className="rt-optrow-rad" aria-hidden="true" />
                </button>
              ))}
              <div className="rt-optgrp">Egyéb</div>
              <button
                type="button"
                className="rt-optrow"
                onClick={() => pickAnchor({ key: null, label: anchor.key != null ? '' : anchor.label })}
              >
                <span className="rt-optrow-nm">
                  Saját szavakkal…
                  <small>szabad szöveg, nem kötődik szokáshoz</small>
                </span>
                <span className="rt-optrow-rad" aria-hidden="true" />
              </button>
              <button
                type="button"
                className="rt-optrow is-unlink"
                onClick={() => pickAnchor({ key: null, label: '' })}
              >
                <span className="rt-optrow-nm">
                  Leoldom a horgonyt
                  <small>a szokás marad, csak nem kötődik semmihez</small>
                </span>
              </button>
            </div>
          )}
        </Sheet>
      )}
    </MozaikPage>
  )
}

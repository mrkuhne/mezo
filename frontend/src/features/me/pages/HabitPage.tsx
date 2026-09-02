// ============================================================
// Mezo · HabitPage (mezo-3zue.4) — /me/rutin/szokas/:habitKey, prototype `pg-edit`
// (docs/design_2.0/prototypes/src/rutin-epito-body.html + its `.fwband`/`.hist`/`.danger`
// rules) ×1.18. ONE habit recipe: the framework band, the finished sentence, the 28-day
// history strip, the framework's own fields, and the two ways out of a habit —
// pausing (prominent, promises the progress survives) and deleting (two-tap, quiet).
//
// The sentence renders through `routineSentenceParts`, exactly as the wizard does, so the
// two surfaces can never drift. The page NEVER ticks a habit (ADR — ticking lives on
// /nap/rutin): every control here edits the DEFINITION.
//
// Route resolution is by habitKey (the hub's rows link that way), but every write goes
// through the definition's `id` — `updateDef`/`deleteDef` take the id, not the key.
// ============================================================
import { useState, type CSSProperties, type ReactNode } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useHabitCatalog, useHabitCatalogActions, useHabitSummary } from '@/data/hooks'
import type { HabitDefUpdateInput } from '@/data/habit/habitAdminApi'
import type { HabitDaypart, HabitFramework } from '@/data/types'
import { recipeFromDef, routineSentenceParts, titlePlaceholder } from '@/features/me/logic/routineSentence'
import { cn } from '@/shared/lib/cn'
import { GhostState } from '@/shared/ui/GhostState'
import { MozaikPage, PageBody, PageHead, PageHero } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import type { ClayIconName } from '@/shared/ui/clay'

const HIST_DAYS = 28
// The hero icon follows the OWNING CHAIN's daypart (RutinHubPage's DAYPART_ICON map) — a
// hardcoded dawn spot lied on every evening habit.
const DAYPART_ICON: Record<HabitDaypart, ClayIconName> = { MORNING: 'i-hajnal', DAY: 'i-nap', EVENING: 'i-alvas' }
const XP_MIN = 5
const XP_MAX = 15
const XP_STEP = 5

const FW: Record<'FOGG' | 'CLEAR' | 'NONE', { sign: string; title: string; sub: string; swap: string }> = {
  FOGG: {
    sign: '⚓', title: 'Szokás-láncolás',
    sub: 'BJ Fogg · horgony → pici tett → ünneplés',
    swap: 'Keret váltása',
  },
  CLEAR: {
    sign: '◈', title: 'Négy törvény',
    sub: 'James Clear · jelzés → vágy → válasz → jutalom',
    swap: 'Keret váltása',
  },
  NONE: {
    sign: '–', title: 'Keret nélkül',
    sub: 'régi szokás — a keret választása a varázslót nyitja előtöltve',
    swap: 'Keret választása',
  },
}

const HIST_NOTE = 'zöld = pipa · szürke = kihagyás · üres = még nem volt. A csík a 28 nap '
  + 'arányát mutatja, nem naptár — egy kihagyás halványít, nem nulláz.'
const PRINCIPLE = 'Szüneteltetve a sor tompul és nem jelenik meg a Nap tabon, de az erő-történet '
  + 'nem vész el. A törlés végleges — két koppintás.'

function rise(delayMs: number): CSSProperties {
  return { '--d': `${delayMs}ms` } as CSSProperties
}

function FieldCard({ children, delayMs }: { children: ReactNode; delayMs: number }) {
  return <div className="rt-fcard rise" style={rise(delayMs)}>{children}</div>
}

function Field({ label, opt, value, onChange, placeholder, readOnly, hint }: {
  label: string
  opt?: boolean
  value: string
  onChange: (v: string) => void
  placeholder?: string
  readOnly?: boolean
  hint?: string
}) {
  return (
    <>
      <span className="rt-flabel">
        {label}{opt && <> <span className="rt-opt">opcionális</span></>}
      </span>
      <input
        className={cn('rt-fin', readOnly && 'is-locked')}
        aria-label={label}
        value={value}
        readOnly={readOnly}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {hint && <div className="rt-hint">{hint}</div>}
    </>
  )
}

export function HabitPage() {
  const navigate = useNavigate()
  const { habitKey = '' } = useParams<{ habitKey: string }>()
  const { catalog, isPending } = useHabitCatalog()
  const { data: summary } = useHabitSummary()
  const { updateDef, deleteDef, pending } = useHabitCatalogActions()

  const defs = (catalog?.chains ?? []).flatMap((c) => c.defs)
  const def = defs.find((d) => d.habitKey === habitKey)

  // Every controlled field seeds ONCE from the definition and then belongs to the user: a
  // background catalog refetch must not stomp an edit in progress. `seedKey` re-seeds only
  // when the route actually points at a different definition (or the first resolve of one).
  const [seedKey, setSeedKey] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [anchorLabel, setAnchorLabel] = useState('')
  const [anchorHabitKey, setAnchorHabitKey] = useState<string | null>(null)
  const [celebration, setCelebration] = useState('')
  const [cue, setCue] = useState('')
  const [craving, setCraving] = useState('')
  const [reward, setReward] = useState('')
  const [identity, setIdentity] = useState('')
  const [why, setWhy] = useState('')
  const [chainKey, setChainKey] = useState('MORNING')
  const [xp, setXp] = useState(XP_MIN)
  const [confirmDelete, setConfirmDelete] = useState(false)

  if (def != null && seedKey !== def.id) {
    const seed = recipeFromDef(def, (key) => defs.find((d) => d.habitKey === key)?.title)
    setSeedKey(def.id)
    setTitle(seed.title)
    setAnchorLabel(seed.anchorLabel)
    setAnchorHabitKey(def.anchorHabitKey)
    setCelebration(seed.celebration)
    setCue(seed.cue)
    setCraving(seed.craving)
    setReward(seed.reward)
    setIdentity(seed.identity)
    setWhy(def.why ?? '')
    setChainKey(def.chainKey)
    setXp(def.xp)
    setConfirmDelete(false)
    return null
  }

  // A deep link lands here before the catalog has resolved: bouncing then would eject the
  // user from a perfectly valid habit. Only a RESOLVED catalog that has no such key redirects.
  if (def == null) {
    if (isPending) {
      return (
        <MozaikPage tone="gold">
          <PageHead onBack={() => navigate('/me/rutin')} label="‹ Rutin" />
          <PageBody><GhostState message="Szokás betöltése…" lines={3} /></PageBody>
        </MozaikPage>
      )
    }
    return <Navigate to="/me/rutin" replace />
  }

  const framework: HabitFramework | null = def.framework
  const fwKey: 'FOGG' | 'CLEAR' | 'NONE' = framework ?? 'NONE'
  const fw = FW[fwKey]
  const row = summary.habits.find((h) => h.key === def.habitKey)
  const chains = [...(catalog?.chains ?? [])].sort((a, b) => a.position - b.position)
  const daypart = chains.find((c) => c.chainKey === def.chainKey)?.daypart ?? 'MORNING'

  const recipe = { framework, title, anchorLabel, celebration, cue, craving, reward, identity }

  // The 28 cells visualise the summary's COUNTS (done28 / missed28) — the summary carries no
  // per-day bitset, so this is a proportion strip, not a calendar. The caption says so.
  const done28 = row?.done28 ?? 0
  const missed28 = row?.missed28 ?? 0

  // The backend validates the MERGED post-write state per framework (FOGG: anchor +
  // celebration; CLEAR: cue + craving + reward), so the form refuses to send a patch that
  // would be rejected — the user never meets a 400 they cannot read.
  const canSave = title.trim() !== '' && (
    framework === 'FOGG' ? anchorLabel.trim() !== '' && celebration.trim() !== ''
      : framework === 'CLEAR' ? cue.trim() !== '' && craving.trim() !== '' && reward.trim() !== ''
        : true
  )

  const save = () => {
    if (!canSave) return
    // "Omit an emptied optional key" (HabitEditSheet's contract-honest rule): the real PATCH
    // ignores a JSON null, so sending one after the user cleared a field silently no-ops in
    // real mode while the mock would clear it. Clearing an optional field is not supported
    // in this version — omitting keeps both arms honest.
    //
    // `chainKey` is sent ONLY when the user actually picked a different chain: the backend
    // treats a non-null chainKey as a MOVE and, with no `position`, appends the definition to
    // the end of the target chain (HabitAdminService.updateDef) — so re-sending the current
    // chain on a typo fix would silently re-order the routine (review finding 1).
    // `xp` is clamped here as well as in the stepper: a stored value outside 5–15 (an older
    // def, an AI suggestion) must not be re-sent unclamped just because it was never stepped.
    const patch: HabitDefUpdateInput = { title: title.trim(), xp: Math.min(XP_MAX, Math.max(XP_MIN, xp)) }
    if (chainKey !== def.chainKey) patch.chainKey = chainKey
    if (framework === 'FOGG') {
      // A chip-linked anchor is READ-ONLY on this page (see the field's hint): this page has no
      // unlink, `anchorHabitKey: null` means "keep" server-side, and `recipeFromDef` prefers the
      // link — so an editable-looking field would have silently discarded whatever was typed.
      if (anchorHabitKey != null) patch.anchorHabitKey = anchorHabitKey
      else patch.anchorCopy = anchorLabel.trim()
      patch.celebration = celebration.trim()
    } else if (framework === 'CLEAR') {
      patch.cue = cue.trim()
      patch.craving = craving.trim()
      patch.reward = reward.trim()
      if (identity.trim()) patch.identity = identity.trim()
    } else if (why.trim()) {
      patch.why = why.trim()
    }
    updateDef(def.id, patch).then(() => navigate('/me/rutin'))
  }

  const pause = () => { updateDef(def.id, { isActive: false }).then(() => navigate('/me/rutin')) }

  const remove = () => {
    if (!confirmDelete) { setConfirmDelete(true); return }
    deleteDef(def.id).then(() => navigate('/me/rutin'))
  }

  return (
    <MozaikPage tone="gold">
      <PageHead onBack={() => navigate('/me/rutin')} label="‹ Rutin">
        <button type="button" className="mz-pgact" disabled={!canSave || pending} onClick={save}>Mentés</button>
      </PageHead>
      {/* Honesty rule: a definition with no summary row has no 28-day standing yet — show no
          number and no sub rather than a confident "0%  ·  0 pipa · 0 kihagyás". */}
      <PageHero
        icon={DAYPART_ICON[daypart]}
        iconSize={46}
        big={row?.strengthPct != null ? `${row.strengthPct}%` : undefined}
        name={def.title}
        sub={row != null ? `28 napos erő · ${done28} pipa · ${missed28} kihagyás` : undefined}
      />
      <PageBody principle={PRINCIPLE}>
        <EntranceGroup replayKey={def.id}>
          <div className={cn('rt-fwband', `is-${fwKey.toLowerCase()}`, 'rise')} style={rise(50)}>
            <span className="rt-fwband-sgn" aria-hidden="true">{fw.sign}</span>
            <div>
              <div className="rt-fwband-t">{fw.title}</div>
              <div className="rt-fwband-s">{fw.sub}</div>
            </div>
            <button
              type="button"
              className="rt-fwband-sw"
              onClick={() => navigate(`/me/rutin/uj?prefill=${def.habitKey}`)}
            >
              {fw.swap}
            </button>
          </div>

          <div
            className={cn('rt-sentence is-big rise', framework === 'CLEAR' && 'is-clear')}
            style={rise(80)}
            data-testid="recipe-sentence"
          >
            <span className="rt-sentence-lb">A recepted</span>
            <p className="rt-sentence-tx">
              {routineSentenceParts(recipe).map((part, i) => (
                part.slot === undefined
                  ? <span key={i}>{part.text}</span>
                  : <span key={i} className={cn('rt-blank', part.filled && 'is-filled')}>{part.text}</span>
              ))}
            </p>
          </div>

          <FieldCard delayMs={110}>
            <span className="rt-flabel">Elmúlt 28 nap</span>
            <div className="rt-hist" aria-hidden="true">
              {Array.from({ length: HIST_DAYS }, (_, i) => {
                const state = i < done28 ? 'done' : i < done28 + missed28 ? 'miss' : 'none'
                return <i key={i} data-state={state} className={cn(state !== 'none' && `is-${state}`)} />
              })}
            </div>
            <div className="rt-hint">{HIST_NOTE}</div>
          </FieldCard>

          <FieldCard delayMs={140}>
            {/* The title IS the behaviour slot of both frameworks — the label names it the way
                that framework does. The FORM says Clear's "válasz" (the law's own word) while the
                SENTENCE blank says `titlePlaceholder('CLEAR')` = "tett": two surfaces, two names,
                both deliberate — the wizard's step 3 label makes the same split. */}
            <Field
              label={framework === null ? 'Cím' : `Cím · ${framework === 'CLEAR' ? 'válasz' : titlePlaceholder(framework)}`}
              value={title}
              onChange={setTitle}
            />
            {framework === 'FOGG' && (
              <>
                <Field
                  label="Miután … · horgony"
                  value={anchorLabel}
                  readOnly={anchorHabitKey != null}
                  hint={anchorHabitKey != null
                    ? 'A horgony egy másik szokásodra van kötve, ezért itt nem írható át. Másik horgonyhoz — vagy saját szöveghez — nyisd meg a „Keret váltása” gombbal a varázslót.'
                    : undefined}
                  onChange={(v) => { setAnchorLabel(v); setAnchorHabitKey(null) }}
                />
                <Field label="Ünneplésül … · shine" value={celebration} onChange={setCelebration} />
              </>
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
          </FieldCard>

          <FieldCard delayMs={170}>
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
            <span className="rt-flabel" style={{ marginTop: 10 }}>XP</span>
            <span className="rt-stepin">
              <button type="button" aria-label="XP csökkentése" onClick={() => setXp(Math.max(XP_MIN, xp - XP_STEP))}>−</button>
              <b>{xp} XP</b>
              <button type="button" aria-label="XP növelése" onClick={() => setXp(Math.min(XP_MAX, xp + XP_STEP))}>＋</button>
            </span>
          </FieldCard>

          {/* Pausing is the prominent way out — it promises the progress survives. Deleting
              sits below it, quieter, behind two taps (the old HabitEditSheet's danger idiom
              made explicit: this page is the only DELETE affordance in the app). */}
          <button type="button" className="rt-danger rise" style={rise(200)} disabled={pending} onClick={pause}>
            Szüneteltetés — a haladás megmarad
          </button>
          <button
            type="button"
            className={cn('rt-danger is-hard rise', confirmDelete && 'is-armed')}
            style={rise(220)}
            disabled={pending}
            onClick={remove}
          >
            {confirmDelete ? 'Biztosan törlöd? Koppints újra' : 'Szokás törlése'}
          </button>
        </EntranceGroup>
      </PageBody>
    </MozaikPage>
  )
}

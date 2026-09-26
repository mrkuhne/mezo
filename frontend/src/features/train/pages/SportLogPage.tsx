// ============================================================
// Mezo · SportLogPage — sport logging as its OWN full-screen flow
// (`/train/sport/log`, mezo-88iwa.9 · Train Titanium T8 Task 4).
//
// Ported from the prototype's step machine
// (docs/design_2.0/prototypes/companion-titanium/sport.js:12-115) onto the
// `sp-` house section (styles/prototype.css) and the eleven-sport vocabulary
// (features/train/logic/sports.ts):
//
//   pick  — the eleven tiles. Ten of them open the form; Futás is not a sport
//           session at all (running is its own feature + its own wire), so its
//           tile only ROUTES to `/train/futas`.
//   form  — only the fields THAT sport actually asks (`SPORTS[x].fields`,
//           `onlyMode` siblings gated by the chosen mode), duration prefilled
//           from the sport's target, and the felt-effort slider that becomes
//           the wire's required `rpe`.
//   save  — `useQuickLogSport().logSportSession` → `onSaved(response)`.
//
// HONESTY — why there is no kcal number on this page. The burn is the
// BACKEND's call: a MET table folded with the athlete's own body, which this
// page cannot see and must never re-derive (a second formula would drift from
// the wire's and quietly lie). The prototype previewed a number because its
// whole model lived in the browser; ours does not. So the `.sp-kcal` row is
// purely the OVERRIDE affordance — "Kalória: becslést mentünk" plus the
// athlete's right to overrule it — and the actual figure is whatever the
// response reports (Task 5's ceremony shows it).
//
// TASK 5: `onSaved(response)` below computes the sport's stars from the SAVED
// values (duration/rpe against the sport's own minutes-field default) and
// switches the page's own step state to the ceremony — SportCeremony.tsx,
// mounted full-screen exactly like WorkoutCeremony closes a gym session. A
// response `levelUp` opens the shared LevelUpProvider overlay BEFORE the
// switch, same as every other finish path (ActiveWorkoutPage, RunningPage).
// ============================================================
import { useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuickLogSport } from '@/data/hooks'
import { useBackNav } from '@/shared/hooks/useBackNav'
import { useLevelUp } from '@/features/progression/LevelUpProvider'
import { Icon3D } from '@/shared/ui/clay'
import { GlassBox } from '@/shared/ui/mozaik/GlassBox'
import { SportCeremony } from '@/features/train/components/SportCeremony'
import { sportStars } from '@/features/train/logic/sportScore'
import {
  SPORTS, sportById,
  type RunTile, type Sport, type SportField,
} from '@/features/train/logic/sports'
import type { SportSessionCreateRequest, SportSessionResponse } from '@/data/train/trainApi'

const isRunTile = (s: Sport | RunTile): s is RunTile => s.id === 'run'

/** The wire's own override bounds — `SportSessionCreateRequest.kcalOverride` is
 *  `@Min(1) @Max(5000)`, so anything outside this range is a 400 the athlete would only
 *  ever see as a save that silently did nothing. The dialog refuses it instead. */
const KCAL_MIN = 1
const KCAL_MAX = 5000

/** One captured answer per field key. Text fields hold a string, everything else a number. */
type FormValues = Record<string, number | string>

/** The fields the chosen mode actually shows (prototype `fieldsFor`). */
function visibleFields(sport: Sport, mode: string | null): SportField[] {
  return sport.fields.filter((f) => !f.onlyMode || f.onlyMode === mode)
}

/** Every field's own declared default — the table IS the prefill (duration = the target). */
function defaultValues(sport: Sport): FormValues {
  const out: FormValues = {}
  for (const f of sport.fields) out[f.key] = f.value
  return out
}

/** The first modes field's first option, or null when the sport has no mode switch. */
function defaultMode(sport: Sport): string | null {
  const modes = sport.fields.find((f): f is Extract<SportField, { type: 'modes' }> => f.type === 'modes')
  return modes ? modes.value : null
}

/** The volleyball chips → the wire's numeric 1–10 `shoulderStrain`. */
const SHOULDER_STRAIN: Record<string, number> = { enyhe: 3, 'közepes': 6, 'erős': 9 }

/**
 * Field keys that have a HOME on `SportSessionCreateRequest`:
 *   minutes → duration · intensity → rpe · sets → setsPlayed · rounds → rounds ·
 *   shoulder → shoulderStrain.
 * Everything else the eleven-sport table asks for (bike terrain, swim stroke, hike climb,
 * the distances, tennis/football mode, the Egyéb activity name and effort) has no wire
 * field at all — rather than dropping what the athlete just told us, it folds into `notes`
 * as one short Hungarian line. `NOTE_LABEL` names those folds in everyday words instead of
 * reusing the form's question-shaped labels ("Milyen kemény volt?: közepes").
 */
const WIRE_HOMED = new Set(['minutes', 'intensity', 'sets', 'rounds', 'shoulder'])
const NOTE_LABEL: Record<string, string> = {
  distance: 'Táv', terrain: 'Terep', stroke: 'Úszásnem', climb: 'Szintemelkedés',
  mode: 'Típus', effort: 'Nehézség',
}

/** The folded `notes` string — empty when this sport has nothing homeless to say. */
function foldNotes(sport: Sport, values: FormValues, mode: string | null): string {
  const parts: string[] = []
  for (const f of visibleFields(sport, mode)) {
    if (WIRE_HOMED.has(f.key)) continue
    const raw = f.type === 'modes' ? mode : values[f.key]
    if (raw === null || raw === undefined || raw === '') continue
    // The Egyéb activity name IS the session's title — it needs no label in front of it.
    if (f.key === 'name') { parts.unshift(String(raw)); continue }
    const shown = f.type === 'modes'
      ? (f.options.find((o) => o.id === raw)?.label ?? String(raw))
      : `${raw}${f.type === 'number' && f.unit ? ` ${f.unit}` : ''}`
    parts.push(`${NOTE_LABEL[f.key] ?? f.label}: ${shown}`)
  }
  return parts.join(' · ')
}

/** The captured form → the wire request. Only fields the athlete actually answered. */
export function toCreateRequest(
  sport: Sport,
  values: FormValues,
  mode: string | null,
  kcalOverride: number | null,
): SportSessionCreateRequest {
  const shown = visibleFields(sport, mode)
  const has = (key: string) => shown.some((f) => f.key === key)
  const notes = foldNotes(sport, values, mode)
  return {
    sport: sport.id,
    duration: Number(values.minutes),
    rpe: Number(values.intensity),
    ...(has('sets') ? { setsPlayed: Number(values.sets) } : {}),
    ...(has('rounds') ? { rounds: Number(values.rounds) } : {}),
    ...(has('shoulder') ? { shoulderStrain: SHOULDER_STRAIN[String(values.shoulder)] ?? 6 } : {}),
    ...(notes ? { notes } : {}),
    ...(kcalOverride !== null ? { kcalOverride } : {}),
  }
}

// Üveg re-dress (mezo-me75u.4, prototype uveg-edzes-body.html `sportlog()`): the picker
// is a 3-col grid of glass tiles, each with the sport's OWN 3D icon (`art3d`, rose; Futás
// sky); the form is one rose glass card with flat steppers/chips/range inside, the kcal
// door a sage glass card, and the save a lit rose primary in a sticky blurred foot bar.
// Every rule is scoped to `.uvs-log` (prototype.css `uveg edzes sport`).
const tileAccent = (s: Sport | RunTile) => (s.id === 'run' ? 'var(--dv-sky)' : 'var(--dv-rose)')

// ── step one: which sport ────────────────────────────────────────────────────

function SportPickGrid({ onPick, onLeave }: { onPick: (id: string) => void; onLeave: () => void }) {
  return (
    <div className="sp-page uvs-log">
      <header className="sp-head">
        <button type="button" className="glass is-round" aria-label="Vissza" onClick={onLeave}>‹</button>
        <span>
          <small>NAPLÓZÁS</small>
          <strong>Mi volt ma mozgás?</strong>
        </span>
      </header>
      <p className="sp-lead">
        Válaszd ki, mit csináltál. A következő lapon csak azt kérdezem, ami annál a sportnál tényleg számít.
      </p>
      <div className="sp-grid">
        {SPORTS.map((sport, i) => (
          <button
            key={sport.id}
            type="button"
            className="sp-tile glass"
            style={{ '--sp-color': sport.color, '--c': tileAccent(sport), '--i': i } as CSSProperties}
            onClick={() => onPick(sport.id)}
          >
            <span className="sp-tile-art"><Icon3D name={sport.art3d} size={50} /></span>
            <strong>{sport.name}</strong>
            <small>~{('fields' in sport && sport.fields.find((f) => f.key === 'minutes')?.value) || sport.targetMinutes} perc</small>
          </button>
        ))}
      </div>
    </div>
  )
}

// ── step two: that sport's own numbers ───────────────────────────────────────

function FieldRow({ spec, value, onChange }: {
  spec: SportField
  value: number | string
  onChange: (next: number | string) => void
}) {
  // `data-sp-key` is a STYLE hook only (prototype.css `train sport`): the restored form
  // gives the minutes stepper the §2.2 A wash tile and the §3.2 numeral, and leaves every
  // other number field a shield, so the page has a first read. It carries no behaviour —
  // the field order differs per sport (Kerékpár and Úszás ask distance first), so
  // „the first stepper" is not the minutes one and a positional selector would be wrong.
  const id = `sp-${spec.key}`
  if (spec.type === 'chips') {
    return (
      <div className="sp-field" data-sp-key={spec.key}>
        {/* A chip row is a group of buttons, not a labelable control — the accessible name
            rides the group, not a dangling `for`. */}
        <label>{spec.label}</label>
        <div className="sp-chips" id={id} role="group" aria-label={spec.label}>
          {spec.options.map((option) => (
            <button key={option} type="button" aria-pressed={option === value} onClick={() => onChange(option)}>
              {option}
            </button>
          ))}
        </div>
      </div>
    )
  }
  if (spec.type === 'range') {
    return (
      <div className="sp-field" data-sp-key={spec.key}>
        <label htmlFor={id}>{spec.label}<b>{value} {spec.unit}</b></label>
        <input
          id={id} className="sp-range" type="range" min={spec.min} max={spec.max} step={1}
          value={Number(value)} onChange={(e) => onChange(Number(e.target.value))}
        />
      </div>
    )
  }
  if (spec.type === 'text') {
    return (
      <div className="sp-field" data-sp-key={spec.key}>
        <label htmlFor={id}>{spec.label}</label>
        <input
          id={id} className="sp-text" type="text" maxLength={40} placeholder={spec.placeholder}
          value={String(value ?? '')} onChange={(e) => onChange(e.target.value)}
        />
      </div>
    )
  }
  // The mode switch is its own row ABOVE the form (prototype `.sp-modes`) — it never
  // renders inside the field list.
  if (spec.type === 'modes') return null
  // number — the prototype's ± stepper, clamped to the field's own contract bounds
  const stepBy = (delta: number) =>
    onChange(Math.min(spec.max, Math.max(spec.min, Number(value) + delta)))
  return (
    <div className="sp-field" data-sp-key={spec.key}>
      <label htmlFor={id}>{spec.label}</label>
      <div className="sp-number">
        <button type="button" aria-label={`${spec.label} csökkentése`} onClick={() => stepBy(-spec.step)}>−</button>
        <input
          id={id} type="number" min={spec.min} max={spec.max} step={spec.step}
          value={Number(value)}
          onChange={(e) => onChange(Number(e.target.value))}
          onBlur={(e) => onChange(Math.min(spec.max, Math.max(spec.min, Number(e.target.value))))}
        />
        <span>{spec.unit}</span>
        <button type="button" aria-label={`${spec.label} növelése`} onClick={() => stepBy(spec.step)}>＋</button>
      </div>
    </div>
  )
}

function SportForm({ sport, values, mode, kcalOverride, saving, saveError, onValue, onMode, onAskKcal, onClearKcal, onBack, onSave }: {
  sport: Sport
  values: FormValues
  mode: string | null
  kcalOverride: number | null
  saving: boolean
  saveError: string | null
  onValue: (key: string, next: number | string) => void
  onMode: (next: string) => void
  onAskKcal: () => void
  onClearKcal: () => void
  onBack: () => void
  onSave: () => void
}) {
  const modesField = sport.fields.find((f): f is Extract<SportField, { type: 'modes' }> => f.type === 'modes')
  const title = sport.id === 'other' && values.name ? String(values.name) : sport.name
  return (
    <div className="sp-page uvs-log" style={{ '--sp-color': sport.color, '--c': 'var(--dv-rose)' } as CSSProperties}>
      <header className="sp-head">
        <button type="button" className="glass is-round" aria-label="Vissza a sportválasztóhoz" onClick={onBack}>‹</button>
        <span className="sp-head-art"><Icon3D name={sport.art3d} size={44} /></span>
        <span><small>NAPLÓZÁS · MA</small><strong>{title}</strong></span>
      </header>

      {modesField && (
        <div className="sp-modes" role="group" aria-label={modesField.label}>
          {modesField.options.map((m) => (
            <button key={m.id} type="button" aria-pressed={m.id === mode} onClick={() => onMode(m.id)}>
              {m.label}
            </button>
          ))}
        </div>
      )}

      <div className="sp-form glass" style={{ '--c': 'var(--dv-rose)' } as CSSProperties}>
        {visibleFields(sport, mode)
          .filter((f) => f.type !== 'modes')
          .map((f) => (
            <FieldRow key={f.key} spec={f} value={values[f.key]} onChange={(next) => onValue(f.key, next)} />
          ))}
      </div>

      {/* The estimate is the backend's; the last word is the athlete's. No number here —
          see the honesty note at the top of the file. */}
      <button type="button" className="sp-kcal glass" style={{ '--c': 'var(--dv-sage)' } as CSSProperties} onClick={onAskKcal}>
        <span className="sp-kcal-art"><Icon3D name="t-plate" size={40} /></span>
        <span className="sp-kcal-copy">
          <strong>Kalória: becslést mentünk</strong>
          <small>A pontos értéket mentés után mutatjuk — a te súlyodból és a mozgás fajtájából jön.</small>
        </span>
        <b>Saját érték</b>
      </button>
      {kcalOverride !== null && (
        <>
          <p className="sp-note">Saját értéket adtál meg — ezt mentjük, nem a becslést.</p>
          <button type="button" className="sp-note-clear" onClick={onClearKcal}>Töröld a saját értéket</button>
        </>
      )}

      {/* Surfaced failure (T8 Task 4 final review): a rejected save — the contract's
          `kcalOverride` bounds, an offline real mode — used to vanish silently and leave
          the CTA disabled forever. The line sits directly above the CTA, which `onError`
          re-enables, so a retry is one tap away. */}
      {saveError && (
        <p className="sp-note is-error" role="alert">{saveError}</p>
      )}

      <div className="sp-foot">
        <button type="button" className="wo-close-cta" disabled={saving} onClick={onSave}>
          <span className="wo-close-art"><Icon3D name={sport.art3d} size={26} /></span>
          <span><strong>Naplózom</strong><small>{values.minutes} perc</small></span>
          <u className="chip-sheen" />
        </button>
      </div>
    </div>
  )
}

// ── the page ─────────────────────────────────────────────────────────────────

/** The minutes field's own default — the ceremony's stars judge the session against what
 *  THIS sport actually asked the form to prefill, not the picker tile's rounder headline
 *  number (`targetMinutes`), which can differ (e.g. Úszás asks 40 on the form, shows ~45
 *  on the tile). Falls back to `targetMinutes` for the rare sport with no minutes field. */
function minutesTarget(sport: Sport): number {
  const field = sport.fields.find((f): f is Extract<SportField, { type: 'number' }> => f.key === 'minutes')
  return typeof field?.value === 'number' ? field.value : sport.targetMinutes
}

export function SportLogPage() {
  const navigate = useNavigate()
  const goBack = useBackNav('/train/mai')
  const { logSportSession } = useQuickLogSport()
  const { showLevelUp } = useLevelUp()

  const [chosen, setChosen] = useState<Sport | null>(null)
  const [mode, setMode] = useState<string | null>(null)
  const [values, setValues] = useState<FormValues>({})
  const [kcalOverride, setKcalOverride] = useState<number | null>(null)
  const [kcalOpen, setKcalOpen] = useState(false)
  const [kcalDraft, setKcalDraft] = useState('')
  const [kcalDraftError, setKcalDraftError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  // The save's own failure line (T8 Task 4 final review). Cleared on every new attempt
  // and on a sport switch, so it can never outlive the request it describes.
  const [saveError, setSaveError] = useState<string | null>(null)
  // The ceremony step (Task 5): set only on a successful save, from that save's own
  // captured minutes/rpe/sport (not `values`/`chosen`, which the ceremony no longer needs
  // and which a stray re-render must not be able to change under it).
  const [ceremony, setCeremony] = useState<{
    sport: Sport
    minutes: number
    rpe: number
    kcal: { value: number; isEstimate: boolean } | null
    xpGained: number | null
  } | null>(null)

  function pick(id: string) {
    const sport = sportById(id)
    if (!sport) return
    // Futás is not a sport session — it has its own feature, its own wire and its own
    // page. The tile is a door, not a form.
    if (isRunTile(sport)) { navigate(sport.routesTo); return }
    setChosen(sport)
    setMode(defaultMode(sport))
    setValues(defaultValues(sport))
    setKcalOverride(null)
    setSaveError(null)
  }

  /**
   * The ceremony mounts here, on the SAVED response — its `kcal`/`kcalIsEstimate` are the
   * honest figures the form refuses to guess (see the honesty note at the top of the
   * file). A `levelUp` payload opens the shared overlay first, exactly like every other
   * finish path (ActiveWorkoutPage, RunningPage) — the ceremony reveals once it is
   * dismissed.
   */
  function onSaved(sport: Sport, savedMinutes: number, savedRpe: number, response?: SportSessionResponse) {
    if (response?.levelUp) showLevelUp(response.levelUp)
    setCeremony({
      sport,
      minutes: savedMinutes,
      rpe: savedRpe,
      kcal: response?.kcal != null ? { value: response.kcal, isEstimate: response.kcalIsEstimate ?? true } : null,
      xpGained: response?.levelUp?.totalXp ?? null,
    })
  }

  function save() {
    if (!chosen) return
    setSaving(true)
    setSaveError(null)
    const savedMinutes = Number(values.minutes)
    const savedRpe = Number(values.intensity)
    logSportSession(toCreateRequest(chosen, values, mode, kcalOverride), {
      onSuccess: (r) => onSaved(chosen, savedMinutes, savedRpe, r),
      onError: () => setSaveError('Nem sikerült elmenteni a mozgást. Nézd meg a kapcsolatot, és próbáld újra.'),
      onSettled: () => setSaving(false),
    })
  }

  if (ceremony) {
    return (
      <SportCeremony
        score={sportStars(ceremony.minutes, minutesTarget(ceremony.sport), ceremony.rpe)}
        sportName={ceremony.sport.id === 'other' && values.name ? String(values.name) : ceremony.sport.name}
        art={ceremony.sport.art3d}
        color={ceremony.sport.color}
        minutes={ceremony.minutes}
        rpe={ceremony.rpe}
        kcal={ceremony.kcal}
        xpGained={ceremony.xpGained}
        onClose={() => navigate('/train/mai')}
      />
    )
  }

  return (
    <>
      {chosen === null ? (
        <SportPickGrid onPick={pick} onLeave={goBack} />
      ) : (
        <SportForm
          sport={chosen}
          values={values}
          mode={mode}
          kcalOverride={kcalOverride}
          saving={saving}
          saveError={saveError}
          onValue={(key, next) => setValues((prev) => ({ ...prev, [key]: next }))}
          onMode={setMode}
          onAskKcal={() => { setKcalDraft(kcalOverride !== null ? String(kcalOverride) : ''); setKcalDraftError(null); setKcalOpen(true) }}
          onClearKcal={() => setKcalOverride(null)}
          onBack={() => setChosen(null)}
          onSave={save}
        />
      )}

      <GlassBox open={kcalOpen} onClose={() => { setKcalDraftError(null); setKcalOpen(false) }} label="Aktív kalória (ha az órád mérte)" tint="var(--dv-coral)"
        className="uv-gb-kcal" art={<Icon3D name="t-plate" size={30} />}>
        {/* üveg U10 (mezo-me75u.10): a coral glass (the Edzés area colour, one accent — the pill
            matches it); copy, field, error and the lit pill inside are flat. */}
        <p className="uv-gb-copy">
          Csak a mozgás többletét írd be — az órád »aktív« kalóriáját, ne az összeset.
        </p>
        <label className="uv-gb-field">
          <span>Kalória</span>
          <input
            className="uv-gb-input" type="number" min={KCAL_MIN} max={KCAL_MAX} step={10} aria-label="Kalória"
            value={kcalDraft} onChange={(e) => { setKcalDraft(e.target.value); setKcalDraftError(null) }}
          />
        </label>
        {kcalDraftError && (
          <p className="uv-gb-err" role="alert"><Icon3D name="t-info" size={18} />{kcalDraftError}</p>
        )}
        <button
          type="button" className="abl-pill is-wide"
          onClick={() => {
            // The wire's own bounds (`SportSessionCreateRequest.kcalOverride`, @Min(1)
            // @Max(5000)). Before this, a 0 sailed through to a silent 400 — and in mock,
            // where nothing rejects it, the ceremony cheerfully celebrated "+0 kcal".
            // An empty box means "no override" (the existing clear affordance); anything
            // outside 1..5000 is refused HERE, inline, and never becomes a request.
            if (kcalDraft.trim() === '') { setKcalOverride(null); setKcalDraftError(null); setKcalOpen(false); return }
            const next = Math.round(Number(kcalDraft))
            if (!Number.isFinite(next) || next < KCAL_MIN || next > KCAL_MAX) {
              setKcalDraftError(`Adj meg egy értéket ${KCAL_MIN} és ${KCAL_MAX} kcal között.`)
              return
            }
            setKcalOverride(next)
            setKcalDraftError(null)
            setKcalOpen(false)
          }}
        >
          <Icon3D name="t-tick" size={20} />
          <span>Ezt mentem</span>
        </button>
      </GlassBox>
    </>
  )
}

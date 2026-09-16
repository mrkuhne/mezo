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
import { ClayIcon } from '@/shared/ui/clay'
import { GlassBox } from '@/shared/ui/mozaik/GlassBox'
import { SportCeremony } from '@/features/train/components/SportCeremony'
import { sportStars } from '@/features/train/logic/sportScore'
import {
  SPORTS, sportById,
  type RunTile, type Sport, type SportField,
} from '@/features/train/logic/sports'
import type { SportSessionCreateRequest, SportSessionResponse } from '@/data/train/trainApi'

const isRunTile = (s: Sport | RunTile): s is RunTile => s.id === 'run'

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

// ── step one: which sport ────────────────────────────────────────────────────

function SportPickGrid({ onPick, onLeave }: { onPick: (id: string) => void; onLeave: () => void }) {
  return (
    <div className="sp-page">
      <header className="sp-head">
        <button type="button" aria-label="Vissza" onClick={onLeave}>‹</button>
        <span>
          <small>NAPLÓZÁS</small>
          <strong>Mi volt ma mozgás?</strong>
        </span>
      </header>
      <p className="sp-lead">
        Válaszd ki, mit csináltál. A következő lapon csak azt kérdezem, ami annál a sportnál tényleg számít.
      </p>
      <div className="sp-grid">
        {SPORTS.map((sport) => (
          <button
            key={sport.id}
            type="button"
            className="sp-tile"
            style={{ '--sp-color': sport.color } as CSSProperties}
            onClick={() => onPick(sport.id)}
          >
            <span className="sp-tile-art"><ClayIcon name={sport.art} size={44} /></span>
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
  const id = `sp-${spec.key}`
  if (spec.type === 'chips') {
    return (
      <div className="sp-field">
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
      <div className="sp-field">
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
      <div className="sp-field">
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
    <div className="sp-field">
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

function SportForm({ sport, values, mode, kcalOverride, saving, onValue, onMode, onAskKcal, onClearKcal, onBack, onSave }: {
  sport: Sport
  values: FormValues
  mode: string | null
  kcalOverride: number | null
  saving: boolean
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
    <div className="sp-page" style={{ '--sp-color': sport.color } as CSSProperties}>
      <header className="sp-head">
        <button type="button" aria-label="Vissza a sportválasztóhoz" onClick={onBack}>‹</button>
        <span className="sp-head-art"><ClayIcon name={sport.art} size={34} /></span>
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

      <div className="sp-form">
        {visibleFields(sport, mode)
          .filter((f) => f.type !== 'modes')
          .map((f) => (
            <FieldRow key={f.key} spec={f} value={values[f.key]} onChange={(next) => onValue(f.key, next)} />
          ))}
      </div>

      {/* The estimate is the backend's; the last word is the athlete's. No number here —
          see the honesty note at the top of the file. */}
      <button type="button" className="sp-kcal" onClick={onAskKcal}>
        <span className="sp-kcal-art"><ClayIcon name="i-tanyer" size={42} /></span>
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

      <div className="sp-foot">
        <button type="button" className="wo-close-cta" disabled={saving} onClick={onSave}>
          <span className="wo-close-art"><ClayIcon name="i-sport" size={26} /></span>
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
  const [saving, setSaving] = useState(false)
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
    const savedMinutes = Number(values.minutes)
    const savedRpe = Number(values.intensity)
    logSportSession(toCreateRequest(chosen, values, mode, kcalOverride), {
      onSuccess: (r) => onSaved(chosen, savedMinutes, savedRpe, r),
      onSettled: () => setSaving(false),
    })
  }

  if (ceremony) {
    return (
      <SportCeremony
        score={sportStars(ceremony.minutes, minutesTarget(ceremony.sport), ceremony.rpe)}
        sportName={ceremony.sport.id === 'other' && values.name ? String(values.name) : ceremony.sport.name}
        art={ceremony.sport.art}
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
          onValue={(key, next) => setValues((prev) => ({ ...prev, [key]: next }))}
          onMode={setMode}
          onAskKcal={() => { setKcalDraft(kcalOverride !== null ? String(kcalOverride) : ''); setKcalOpen(true) }}
          onClearKcal={() => setKcalOverride(null)}
          onBack={() => setChosen(null)}
          onSave={save}
        />
      )}

      <GlassBox open={kcalOpen} onClose={() => setKcalOpen(false)} label="Saját kalóriaérték" tint={chosen?.color}>
        <p style={{ fontSize: 12.5, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
          A becslés a te súlyodból, korodból és a mozgás fajtájából jön. Ha tudod, hogy máshogy volt,
          írd felül — akkor ezt mentjük, nem a becslést.
        </p>
        <label className="sp-field" style={{ display: 'block', marginTop: 12 }}>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Kalória</span>
          <input
            className="sp-text" type="number" min={0} max={5000} step={10} aria-label="Kalória"
            value={kcalDraft} onChange={(e) => setKcalDraft(e.target.value)}
          />
        </label>
        <button
          type="button" className="wo-close-cta" style={{ marginTop: 14 }}
          onClick={() => {
            const next = Number(kcalDraft)
            if (kcalDraft.trim() !== '' && Number.isFinite(next) && next >= 0) setKcalOverride(Math.round(next))
            setKcalOpen(false)
          }}
        >
          <span><strong>Ezt mentem</strong></span>
        </button>
      </GlassBox>
    </>
  )
}

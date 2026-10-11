// ============================================================
// Mezo · SportLogPage — sport logging as its OWN full-screen flow
// (`/train/sport/log`, mezo-88iwa.9 · Train Titanium T8 Task 4).
//
// Folyadék (mezo-n4wf5.3, prototype vilagos/edzes.js `sportlog()`, args none · `<i>` ·
// `sajat` · `hiba`; sheet `kcal`). The route is chrome-free, so the page draws its own title
// row (back · context · title) the way the title bar would. The step machine and the
// eleven-sport vocabulary (features/train/logic/sports.ts) are unchanged:
//
//   pick  — a closed hero („Mi volt ma mozgás?") and one card with the eleven tiles
//           (glyph bubble, name, „~N perc"). Ten of them open the form; Futás is not a
//           sport session at all (running is its own feature + its own wire), so its
//           tile only ROUTES to `/train/futas`.
//   form  — the hero („Hogy ment?", the sport's glyph, the mode switch when the sport has
//           one), 1 „Idő és terhelés": only the fields THAT sport actually asks
//           (`SPORTS[x].fields`, `onlyMode` siblings gated by the chosen mode) — a number is
//           a stepper row, the felt effort a liquid range, a choice a row of pills;
//           2 „Kalória": the override row; a failed save as its own card with „Újra"; the
//           floating „Naplózom · N perc".
//   save  — `useQuickLogSport().logSportSession` → `onSaved(response)`.
//
// HONESTY — why there is no kcal number on this page. The burn is the
// BACKEND's call: a MET table folded with the athlete's own body, which this
// page cannot see and must never re-derive (a second formula would drift from
// the wire's and quietly lie). The prototype previewed a number because its
// whole model lived in the browser; ours does not. So the Kalória row is
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
import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuickLogSport } from '@/data/hooks'
import { useBackNav } from '@/shared/hooks/useBackNav'
import { useLevelUp } from '@/features/progression/LevelUpProvider'
import { Sheet } from '@/shared/ui/Sheet'
import {
  Acts, Box, Btn, Bub, Card, FoSheetHead, Hero, Input, Lab, Lk, Note, Page, Pill, Pills, Row, Section, Seg, Slider, Stepper,
} from '@/shared/ui/folyadek'
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

/** The failed save's two lines (the box's title and what to do about it). */
interface SaveError { title: string; body: string }
const SAVE_FAILED: SaveError = { title: 'Nem sikerült elmenteni a mozgást.', body: 'Nézd meg a kapcsolatot, és próbáld újra.' }

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

/** Futás is the Nap-blue door among the Edzés-orange tiles (prototype `c: ic==='t-run' ? '#1877F2' : 'var(--dom)'`). */
const tileColor = (s: Sport | RunTile) => (s.id === 'run' ? '#1877F2' : undefined)

/** The page's own title row — this route has no title bar (AppLayout hides the chrome), so the
 *  page draws the bar's sub-page row itself: round back, the context line, the title. */
function TopRow({ eyebrow, title, backLabel, onBack }: { eyebrow: string; title: ReactNode; backLabel: string; onBack: () => void }) {
  return (
    <div className="es-top">
      <div className="fo-trow">
        <button type="button" className="fo-ib fo-back" aria-label={backLabel} onClick={onBack}><span aria-hidden="true">‹</span></button>
        <div className="fo-title">
          <small><i aria-hidden="true" /><span>{eyebrow}</span></small>
          <div className="fo-h sm"><h1>{title}</h1></div>
        </div>
      </div>
    </div>
  )
}

// ── step one: which sport ────────────────────────────────────────────────────

function SportPickGrid({ onPick, onLeave }: { onPick: (id: string) => void; onLeave: () => void }) {
  return (
    <Page nonav className="es-page es-logflow">
      <TopRow eyebrow="Sport · ma" title="Naplózás" backLabel="Vissza" onBack={onLeave} />
      <Hero
        label="Naplózás"
        verdict="Mi volt ma mozgás?"
        sub="Válaszd ki, mit csináltál. A következő lapon csak azt kérdezem, ami annál a sportnál tényleg számít."
      />
      <Section n={1} title="Válassz sportot" />
      <Card>
        <div className="es-spg">
          {SPORTS.map((sport) => (
            <button key={sport.id} type="button" onClick={() => onPick(sport.id)}>
              <Bub icon={sport.art3d} size={52} color={tileColor(sport)} />
              <span>
                {sport.name}
                <small>~{('fields' in sport && sport.fields.find((f) => f.key === 'minutes')?.value) || sport.targetMinutes} perc</small>
              </span>
            </button>
          ))}
        </div>
      </Card>
    </Page>
  )
}

// ── step two: that sport's own numbers ───────────────────────────────────────

function FieldRow({ spec, value, onChange }: {
  spec: SportField
  value: number | string
  onChange: (next: number | string) => void
}) {
  // `data-sp-key` names the field for the stylesheet and the tests; it carries no behaviour —
  // the field order differs per sport (Kerékpár and Úszás ask distance first).
  const id = `sp-${spec.key}`
  if (spec.type === 'chips') {
    return (
      <div className="es-blk" data-sp-key={spec.key}>
        {/* A pill row is a group of buttons, not a labelable control — the accessible name
            rides the group, not a dangling `for`. */}
        <Lab>{spec.label}</Lab>
        <Pills id={id} role="group" aria-label={spec.label}>
          {spec.options.map((option) => (
            <Pill key={option} on={option === value} onClick={() => onChange(option)}>{option}</Pill>
          ))}
        </Pills>
      </div>
    )
  }
  if (spec.type === 'range') {
    return (
      <div className="es-blk" data-sp-key={spec.key}>
        <Lab htmlFor={id}>{spec.label}</Lab>
        <Slider id={id} aria-label={spec.label} min={spec.min} max={spec.max} step={1} unit={spec.unit}
          value={Number(value)} onChange={(v) => onChange(v)} />
      </div>
    )
  }
  if (spec.type === 'text') {
    return (
      <div className="es-blk" data-sp-key={spec.key}>
        <Lab htmlFor={id}>{spec.label}</Lab>
        <Input id={id} type="text" maxLength={40} placeholder={spec.placeholder}
          value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />
      </div>
    )
  }
  // The mode switch lives in the hero (prototype `hero({body: fh-seg})`) — it never
  // renders inside the field list.
  if (spec.type === 'modes') return null
  // number — the ± stepper row, clamped to the field's own contract bounds; the value is typeable
  const stepBy = (delta: number) =>
    onChange(Math.min(spec.max, Math.max(spec.min, Number(value) + delta)))
  return (
    <div className="es-vl es-fl" data-sp-key={spec.key}>
      <Stepper
        label={`${spec.label} · ${spec.unit}`} name={spec.label}
        onDec={() => stepBy(-spec.step)} onInc={() => stepBy(spec.step)}
        input={{
          id, type: 'number', min: spec.min, max: spec.max, step: spec.step, value: Number(value),
          onChange: (e) => onChange(Number(e.target.value)),
          onBlur: (e) => onChange(Math.min(spec.max, Math.max(spec.min, Number(e.target.value)))),
        }}
      />
    </div>
  )
}

function SportForm({ sport, values, mode, kcalOverride, saving, saveError, onValue, onMode, onAskKcal, onClearKcal, onBack, onSave }: {
  sport: Sport
  values: FormValues
  mode: string | null
  kcalOverride: number | null
  saving: boolean
  saveError: SaveError | null
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
    <Page nonav className="es-page es-logflow"
      foot={<Btn grow disabled={saving} onClick={onSave}>Naplózom · {values.minutes} perc</Btn>}>
      <TopRow eyebrow="Naplózás · ma" title={title} backLabel="Vissza a sportválasztóhoz" onBack={onBack} />
      <Hero
        label="Naplózás · ma"
        verdict="Hogy ment?"
        sub="Csak az, ami ennél a sportnál számít."
        left={<span className="es-sportart"><Bub icon={sport.art3d} size={64} /></span>}
      >
        {modesField && (
          <Seg className="es-modes" aria-label={modesField.label}
            items={modesField.options.map((m) => ({ key: m.id, label: m.label }))}
            value={mode ?? modesField.value} onChange={onMode} />
        )}
      </Hero>

      <Section n={1} title="Idő és terhelés" />
      <Card className="es-form">
        {visibleFields(sport, mode)
          .filter((f) => f.type !== 'modes')
          .map((f) => (
            <FieldRow key={f.key} spec={f} value={values[f.key]} onChange={(next) => onValue(f.key, next)} />
          ))}
      </Card>

      {/* The estimate is the backend's; the last word is the athlete's. No number here —
          see the honesty note at the top of the file. */}
      <Section n={2} title="Kalória" />
      <Card className="es-kcal">
        <Row
          icon="t-plate"
          title="Kalória: becslést mentünk"
          sub="A pontos értéket mentés után mutatjuk — a te súlyodból és a mozgás fajtájából jön."
          right={<Lk onClick={onAskKcal}>Saját érték</Lk>}
        />
        {kcalOverride !== null && (
          <>
            <Note>Saját értéket adtál meg ({kcalOverride} kcal) — ezt mentjük, nem a becslést.</Note>
            <Acts><Lk onClick={onClearKcal}>Töröld a saját értéket</Lk></Acts>
          </>
        )}
      </Card>

      {/* Surfaced failure (T8 Task 4 final review): a rejected save — the contract's
          `kcalOverride` bounds, an offline real mode — used to vanish silently and leave
          the CTA disabled forever. Its own card above the floating CTA, which `onError`
          re-enables, so a retry is one tap away. */}
      {saveError && (
        <Card className="es-saveerr" role="alert">
          <Box icon="t-info" color="var(--fo-bad)" title={saveError.title}><p>{saveError.body}</p></Box>
          <Acts><Btn sm disabled={saving} onClick={onSave}>Újra</Btn></Acts>
        </Card>
      )}
    </Page>
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
  const [saveError, setSaveError] = useState<SaveError | null>(null)
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
      onError: () => setSaveError(SAVE_FAILED),
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

      {kcalOpen && (
        <Sheet onClose={() => { setKcalDraftError(null); setKcalOpen(false) }} labelledBy="sport-kcal-title" className="fo-sheet es-sheet">
          {(close) => (
            <>
              <FoSheetHead titleId="sport-kcal-title" icon="t-plate" eyebrow="Kalória" title="Aktív kalória (ha az órád mérte)"
                sub="Csak a mozgás többletét írd be — az órád »aktív« kalóriáját, ne az összeset." onClose={close} />
              <Lab htmlFor="sport-kcal-input">Kalória</Lab>
              <Input
                id="sport-kcal-input" type="number" inputMode="numeric" min={KCAL_MIN} max={KCAL_MAX} step={10} aria-label="Kalória"
                value={kcalDraft} onChange={(e) => { setKcalDraft(e.target.value); setKcalDraftError(null) }}
              />
              {kcalDraftError && (
                <div role="alert"><Box icon="t-info" color="var(--fo-bad)" title={kcalDraftError} /></div>
              )}
              <Acts>
                <Btn grow
                  onClick={() => {
                    // The wire's own bounds (`SportSessionCreateRequest.kcalOverride`, @Min(1)
                    // @Max(5000)). Before this, a 0 sailed through to a silent 400 — and in mock,
                    // where nothing rejects it, the ceremony cheerfully celebrated "+0 kcal".
                    // An empty box means "no override" (the existing clear affordance); anything
                    // outside 1..5000 is refused HERE, inline, and never becomes a request.
                    if (kcalDraft.trim() === '') { setKcalOverride(null); setKcalDraftError(null); close(); return }
                    const next = Math.round(Number(kcalDraft))
                    if (!Number.isFinite(next) || next < KCAL_MIN || next > KCAL_MAX) {
                      setKcalDraftError(`Adj meg egy értéket ${KCAL_MIN} és ${KCAL_MAX} kcal között.`)
                      return
                    }
                    setKcalOverride(next)
                    setKcalDraftError(null)
                    close()
                  }}
                >
                  Ezt mentem
                </Btn>
              </Acts>
            </>
          )}
        </Sheet>
      )}
    </>
  )
}

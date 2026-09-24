// ============================================================
// Mezo · WorkoutCard (mezo-88iwa.7, T6 Task 3) — ONE exercise of the active
// workout as a Titanium poster card. Every exercise of the session renders one
// of these inside `.wo-list`: the active phase is no longer a one-exercise-at-a-
// time stepper, it is the Hevy-style card list of the prototype
// (docs/design_2.0/prototypes/companion-titanium/session.js:82 `card()`).
//
// Anatomy (prototype 1:1, fed from real data):
//   head  — MuscleChip art · name (+ KIHAGYVA tag) · records button · ⋮ menu
//   note  — the durable per-exercise note as a `.wo-note` pill (tap → editor)
//   cue   — the plan's OWN rationale sentence (never invented copy)
//   band  — the ProgressionBanner when the engine emitted a progression signal.
//           The cue and the banner are NOT mutually exclusive (mezo-i8ahy): the cue
//           belongs to the exercise, the banner to today's target.
//   rows  — `.wo-rows-head` + one `.wo-row` per WORKING slot
//
// Warm-up slots are prescribed but never rendered (mezo-i8ahy, owner ruling): the card
// shows working sets only and every count on screen agrees with the rows. The session
// model keeps its warmup-then-working prescription array untouched — a row index is
// mapped onto it through `slotIndex()`.
//
// Set logging stays STRICTLY in order per exercise (the model's `nextSetIdx`):
//   · rows BEFORE the cursor are logged/done — read-only, tap opens SetEditSheet
//     (gated by the mezo-l3on set-identity rule: a done row with no server id and
//     no known write failure is still in flight, so it is NOT tappable)
//   · the row AT the cursor is the ONLY editable one — kg / reps / RIR inputs all
//     INLINE on the row (prototype `setRow()`, session.js:71), the L/B/R side segment
//     for isolation work, and the ✓ that submits
//   · rows AFTER the cursor show their prescribed targets, quiet and inert
//
// Üvegesítés U4 (mezo-me75u.4): each card is ONE glass with `--c` = the exercise's muscle color
// (a skipped card is the dashed free state instead, never glass). Inside it everything is flat:
// the MuscleChip in a lit well, round flat header buttons (records t-journal, ⋮), flat pills
// (accepted challenge t-quest, note t-note, coaching cue t-info), the progression cells, and
// the set rows — a done row's tick is a lit disc holding the 3D t-tick, its verdict a 3D mark
// (t-tick in range / t-up above / t-down below / t-record for a record). No text glyphs.
// ============================================================
import { Fragment, useEffect, useState } from 'react'
import type { LastWeekSet, LoggedWorkoutExercise } from '@/data/types'
import type { Medal } from '@/data/train/medalTypes'
import { muscleColor } from '@/features/train/logic/muscleColors'
import { RIR_MAX } from '@/features/train/logic/rir'
import { setStatus } from '@/features/train/logic/workoutCardMeta'
import { adjustedRange, adjustedTarget, equivalentReps } from '@/features/train/logic/repEquivalence'
import { MuscleChip } from '@/features/train/components/MuscleChip'
import { MedalChip } from '@/features/train/components/MedalChip'
import { ProgressionBanner } from '@/features/train/components/ProgressionBanner'
import { Icon3D } from '@/shared/ui/clay'
import {
  type Session,
  type SetSide,
  effectiveSetCount,
  nextSetIdx,
  prescribedAt,
  slotIndex,
} from '@/features/train/logic/workoutState'

/** First-ever workout has no last week (and no engine prescription): prefill from
 *  the exercise's rep target (bottom of the range) instead. */
export function prefill(e: LoggedWorkoutExercise): LastWeekSet {
  return e.lastWeek ?? { weight: 0, reps: e.repMin || 10, rir: e.targetRIR }
}

/** The verdict cell is ICON-ONLY (prototype `verdictCell`, session.js:64): one compact
 *  mark, with the sentence carried by title + aria-label. Pouring the words into the cell
 *  itself overflowed it (fix wave I2).
 *
 *  Visszaöltöztetés (mezo-ju4j6.11) put the house clay trend marks here; U4 (mezo-me75u.4) makes
 *  all three states Titanium 3D marks — the in-range `ok` loses its text ✓ too. */
const VERDICT_ICON = { ok: 't-tick', below: 't-down', above: 't-up' } as const
const VERDICT_LABEL = {
  ok: 'A javasolt rep-sávban',
  below: 'Cél alatt — a javasolt rep-sáv alatt',
  above: 'Cél felett — a javasolt rep-sáv felett',
} as const

/** The human label of one set slot — shared by the row, its aria-label and the edit sheet.
 *  Warm-up slots are no longer shown (mezo-i8ahy), so every visible slot is simply the
 *  nth set of the exercise. */
export function setSlotLabel(index: number): string {
  return `${index + 1}. szett`
}

export interface WorkoutCardProps {
  exercise: LoggedWorkoutExercise
  session: Session
  /** A log/edit write is in flight for this exercise (drives `aria-busy`). */
  busy: boolean
  onLogSet(input: { weight: number; reps: number; rir: number | null; side: SetSide | null }): void
  /** Opens the existing SetEditSheet for an already-logged slot. */
  onTapDoneRow(setIdx: number): void
  /** Task 5 glass: history + personal records. */
  onOpenRecords(): void
  /** Task 4 glass: the per-card ⋮ menu. */
  onOpenMenu(): void
  /** The existing NoteEditSheet for the durable per-exercise note. */
  onEditNote(): void
  /** Effective per-exercise note (a just-saved local override wins over `exercise.note`). */
  note?: string
  /** RECORD-tier medal chips per LOGGED set index (mezo-wp6n). */
  medalsBySetIdx?: Record<number, Medal[]>
  /** localIds of this exercise's logged sets whose POST failed (mezo-l3on F1). */
  failedLocalIds?: ReadonlySet<string>
  /** The accepted challenge (mezo-88iwa quest) targeting THIS exercise, if any —
   *  restored per-card after fd58c790c removed the single-exercise metaline chip. */
  challenge?: { label: string; target: string } | null
  /** No instance id to log against (a failed start — mezo-e1ii9 fix round 1): the cursor
   *  row's ✓ is disabled, so a set that the server cannot store is never shown as stored. */
  logBlocked?: boolean
}

export function WorkoutCard({
  exercise, session, busy, onLogSet, onTapDoneRow, onOpenRecords, onOpenMenu, onEditNote,
  note = '', medalsBySetIdx = {}, failedLocalIds, challenge, logBlocked = false,
}: WorkoutCardProps) {
  const id = exercise.id
  const logged = session.logged[id] ?? []
  const cursor = nextSetIdx(session, id)
  const count = effectiveSetCount(session, id)
  const skipped = session.skipped.includes(id)
  const complete = !skipped && cursor >= count
  const family = muscleColor(exercise.muscle)
  const weightless = exercise.type === 'plyo'
  // The card's ONE sentence: the exercise's own rationale, falling back to the engine's
  // wording when the plan carries none. Never both — the banner no longer repeats it.
  // The prototype's cue is a COACHING sentence ("Vidd hátra a könyököd…"). Production has
  // no such field yet — `rationale` carries the plan's PROGRESSION prose, i.e. the banner's
  // own story in words, so rendering it on every card re-stated the banner (owner
  // screenshot, 2026-09-17). The one case the prose says something the numbers cannot is a
  // FIRST-EVER exercise (no lastWeek to compare — the banner's left cell is an em dash):
  // there the rationale explains the starting choice, so it keeps that one slot. The real
  // coaching cue arrives with its own field (mezo-b516k's cue work).
  const cue = exercise.lastWeek == null
    ? (exercise.rationale ?? exercise.progression?.rationale ?? null)
    : null

  // The draft for the ONE editable row (the cursor slot). Reset whenever the cursor
  // moves or the slot count changes — a removeSet splices the prescription, so the
  // target behind the same cursor can change without the cursor itself moving.
  const [weight, setWeight] = useState(0)
  const [reps, setReps] = useState(0)
  const [rir, setRir] = useState(0)
  const [side, setSide] = useState<SetSide | null>(null)
  // The cursor slot's prescription — read by the prefill, the kg field and the swap caption.
  const cursorTarget = prescribedAt(session, id, slotIndex(session, id, cursor))
  useEffect(() => {
    // Every visible slot is a WORKING set now, so the prescription is read through the
    // visible→model mapping and the warmup branch is gone with the warmup rows.
    const t = cursorTarget
    const prev = logged[cursor - 1]
    const p = prefill(exercise)
    // The just-logged set wins over the static engine target; the engine seeds only the
    // first working set. A weight carried over from a swapped set keeps its equivalent
    // reps (mezo-l95v4).
    const w = prev?.weight ?? t?.targetWeightKg ?? p.weight
    setWeight(w)
    setReps(equivalentReps(t, w) ?? t?.targetReps ?? prev?.reps ?? p.reps)
    setRir(t?.targetRIR ?? prev?.rir ?? p.rir)
    setSide(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, cursor, count])

  // Skipped = the dashed free state (bible §3 rank 4), everything else ONE glass card.
  const cardClass = 'wo-card' + (skipped ? ' is-skipped uv-empty' : ' glass' + (complete ? ' is-complete' : ''))
  const hasPills = !!challenge || !!note || (!skipped && !!cue)

  return (
    <section
      className={cardClass}
      aria-label={exercise.name}
      aria-busy={busy || undefined}
      style={{ '--ex-color': family.rail, '--c': family.rail } as React.CSSProperties}
    >
      <header className="wo-card-head">
        <span className="wo-card-art">
          <MuscleChip token={exercise.muscle} size={40} />
        </span>
        <span className="wo-card-copy">
          <strong>{exercise.name}</strong>
          {skipped && <small className="is-skip">KIHAGYVA</small>}
        </span>
        <button
          type="button"
          className="wo-card-log"
          aria-label={`${exercise.name} · előzmények és rekordok`}
          onClick={onOpenRecords}
        >
          <Icon3D name="t-journal" size={22} />
        </button>
        <button
          type="button"
          className="wo-card-menu"
          aria-haspopup="dialog"
          aria-label={`${exercise.name} · további műveletek`}
          onClick={onOpenMenu}
        >
          ⋮
        </button>
      </header>

      {hasPills && (
        <div className="wos-pills">
          {challenge && (
            <div className="wo-note wos-pill-quest" title={challenge.label} aria-label={`Elfogadott kihívás — ${challenge.label}`}>
              <Icon3D name="t-quest" size={18} />
              <span className="ntext">{challenge.target}</span>
            </div>
          )}

          {note && (
            <button type="button" className="wo-note exercise-note-pill" aria-label="Gyakorlat-jegyzet" onClick={onEditNote}>
              <Icon3D name="t-note" size={18} />
              <span className="ntext">{note}</span>
            </button>
          )}

          {/* The cue slot stays wired for the coaching-cue field; see the note at `cue`. */}
          {!skipped && cue && (
            <div className="wo-cue">
              <Icon3D name="t-info" size={18} />
              <p>{cue}</p>
            </div>
          )}
        </div>
      )}

      {!skipped && (
        <>
          {exercise.progression && (
            <ProgressionBanner progression={exercise.progression} lastWeek={exercise.lastWeek} />
          )}

          <div className="wo-rows">
            <div className="wo-rows-head" aria-hidden="true">
              <span>#</span>
              <span>KG</span>
              <span>ISM</span>
              <span>RIR</span>
              <span />
              <span />
            </div>

            {Array.from({ length: count }, (_, i) => {
              // Row `i` is the i-th WORKING slot; the prescription lives behind the warm-up
              // ramp in the model, so the address goes through `slotIndex` (mezo-i8ahy).
              const t = prescribedAt(session, id, slotIndex(session, id, i))
              const actual = logged[i]
              const isDone = i < cursor
              const idxCell = <span className="wo-idx">{i + 1}</span>

              // ---- DONE row: read-only, tap opens the edit sheet ----
              if (isDone && actual) {
                // mezo-l3on: a logged row whose POST is still genuinely in flight has no
                // server row to PUT/DELETE against, so it must not be tappable. A row whose
                // POST is KNOWN to have failed is not in flight — it is tappable again.
                const rowFailed = !!actual.localId && !!failedLocalIds?.has(actual.localId)
                const rowDisabled = !actual.id && !rowFailed
                // A swapped weight is judged against its shifted range (mezo-l95v4).
                const status = setStatus(adjustedRange(exercise, t, actual.weight), { reps: actual.reps, kind: 'working' })
                const medals = (medalsBySetIdx[i] ?? []).filter((m) => m.tier === 'RECORD')
                const ariaLabel = `${setSlotLabel(i)} szerkesztése — ${actual.weight ?? '—'} kg × ${actual.reps ?? '—'} — RIR ${actual.rir ?? '—'}`
                return (
                  <button
                    key={i}
                    type="button"
                    className="wo-row is-done"
                    disabled={rowDisabled}
                    aria-label={ariaLabel}
                    onClick={() => onTapDoneRow(i)}
                  >
                    {idxCell}
                    <span className="wo-field num">{actual.weight.toLocaleString('hu-HU')}</span>
                    <span className="wo-field num">{actual.reps}</span>
                    <span className="wo-field small num">{actual.rir}</span>
                    <span className="wo-check is-checked" aria-hidden="true">
                      <Icon3D name="t-tick" size={22} />
                    </span>
                    {/* Icon-only: the medal wins the cell when there is one, otherwise the
                        rep-range mark. Either way the words live on the title + aria-label. */}
                    <span className={`wo-verdict is-${status}`} title={VERDICT_LABEL[status]}>
                      {medals.length > 0
                        ? medals.map((m, mi) => <MedalChip key={mi} medal={m} />)
                        : (
                          <span className="wo-verdict-mark" role="img" aria-label={VERDICT_LABEL[status]}>
                            <Icon3D name={VERDICT_ICON[status]} size={24} />
                          </span>
                        )}
                    </span>
                  </button>
                )
              }

              // ---- THE editable row: the cursor slot, and only it ----
              if (i === cursor) {
                const adj = weightless ? null : adjustedTarget(cursorTarget, weight)
                return (
                  <Fragment key={i}>
                  <form
                    className="wo-row is-current"
                    onSubmit={(e) => {
                      e.preventDefault()
                      onLogSet({ weight: weightless ? 0 : weight, reps, rir, side })
                    }}
                  >
                    {idxCell}
                    <label className="wo-field">
                      <input
                        type="number" step="0.5" min={0} max={999} inputMode="decimal"
                        aria-label={`${exercise.name}, ${setSlotLabel(i)}, súly`}
                        disabled={weightless}
                        value={weightless ? 0 : weight}
                        onChange={(e) => {
                          const w = Number(e.target.value)
                          setWeight(w)
                          // The reps follow the kg at equivalent effort (mezo-l95v4); typed
                          // reps stand until the kg moves again.
                          const r = equivalentReps(cursorTarget, w)
                          if (r != null) setReps(r)
                        }}
                      />
                    </label>
                    <label className="wo-field">
                      <input
                        type="number" step="1" min={1} max={100} inputMode="numeric"
                        aria-label={`${exercise.name}, ${setSlotLabel(i)}, ismétlés`}
                        value={reps}
                        onChange={(e) => setReps(Number(e.target.value))}
                      />
                    </label>
                    {/* RIR is a FIELD on the row, beside kg and rep (prototype `setRow()`,
                        session.js:78) — not the full-width pill strip that used to sit under
                        the row and broke the card's one column grid (mezo-i8ahy). The 0–RIR_MAX
                        contract is enforced by the input's own min/max. */}
                    <label className="wo-field small">
                      <input
                        type="number" step="1" min={0} max={RIR_MAX} inputMode="numeric"
                        aria-label={`${exercise.name}, ${setSlotLabel(i)}, RIR`}
                        value={rir}
                        onChange={(e) => setRir(Math.min(RIR_MAX, Math.max(0, Number(e.target.value))))}
                      />
                    </label>
                    <button type="submit" className="wo-check is-submit" disabled={logBlocked} aria-pressed={false} aria-label={`${setSlotLabel(i)} mentése`}>
                      <Icon3D name="t-tick" size={24} />
                    </button>
                    <span className="wo-verdict" />

                    {exercise.type === 'isolation' && (
                      <span className="wo-pick">
                        {/* The eyebrow caption the segment lost — says WHAT the L/B/R picks. */}
                        <small className="wo-pick-key">OLDAL</small>
                        {(['L', 'B', 'R'] as const).map((s) => (
                          <button
                            key={s} type="button" className="wo-check"
                            aria-pressed={side === s} aria-label={`Oldal ${s}`}
                            onClick={() => setSide(side === s ? null : s)}
                          >
                            {s}
                          </button>
                        ))}
                      </span>
                    )}
                  </form>
                  {adj && cursorTarget?.targetWeightKg != null && (
                    <p className="wo-adjust">
                      {`${adj.targetWeightKg.toLocaleString('hu-HU')} kg-hoz igazítva · ajánlás ${cursorTarget.targetWeightKg.toLocaleString('hu-HU')} × ${cursorTarget.targetReps}`}
                    </p>
                  )}
                  </Fragment>
                )
              }

              // ---- LATER pending row: the prescribed target, quiet and inert ----
              // …or, after a weight swap, the swapped weight at its equivalent reps (mezo-l95v4).
              const later = weightless ? null : adjustedTarget(t, weight)
              return (
                <div key={i} className="wo-row" aria-label={`${setSlotLabel(i)} · terv`}>
                  {idxCell}
                  <span className="wo-field num">{later ? later.targetWeightKg.toLocaleString('hu-HU') : t?.targetWeightKg != null ? t.targetWeightKg.toLocaleString('hu-HU') : '—'}</span>
                  <span className="wo-field num">{later ? String(later.targetReps) : `${exercise.repMin}–${exercise.repMax}`}</span>
                  <span className="wo-field small num">{t?.targetRIR ?? exercise.targetRIR}</span>
                  <span className="wo-check" aria-hidden="true" />
                  <span className="wo-verdict" />
                </div>
              )
            })}
          </div>
        </>
      )}
    </section>
  )
}

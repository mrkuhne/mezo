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
//   cue   — the plan's OWN rationale sentence (never invented copy), or the
//           ProgressionBanner when the engine emitted a progression signal
//   rows  — `.wo-rows-head` + one `.wo-row` per effective slot
//
// Set logging stays STRICTLY in order per exercise (the model's `nextSetIdx`):
//   · rows BEFORE the cursor are logged/done — read-only, tap opens SetEditSheet
//     (gated by the mezo-l3on set-identity rule: a done row with no server id and
//     no known write failure is still in flight, so it is NOT tappable)
//   · the row AT the cursor is the ONLY editable one — kg/reps inputs, the RIR
//     pill picker (working sets only, mezo-eerq), the L/B/R side segment for
//     isolation work, and the ✓ that submits
//   · rows AFTER the cursor show their prescribed targets, quiet and inert
// ============================================================
import { useEffect, useState } from 'react'
import type { LastWeekSet, LoggedWorkoutExercise } from '@/data/types'
import type { Medal } from '@/data/train/medalTypes'
import { muscleColor } from '@/features/train/logic/muscleColors'
import { RIR_VALUES } from '@/features/train/logic/rir'
import { setStatus } from '@/features/train/logic/workoutCardMeta'
import { MuscleChip } from '@/features/train/components/MuscleChip'
import { MedalChip } from '@/features/train/components/MedalChip'
import { ProgressionBanner } from '@/features/train/components/ProgressionBanner'
import { ClayIcon } from '@/shared/ui/clay'
import {
  type Session,
  type SetSide,
  effectiveSetCount,
  nextSetIdx,
  prescribedAt,
} from '@/features/train/logic/workoutState'

/** First-ever workout has no last week (and no engine prescription): prefill from
 *  the exercise's rep target (bottom of the range) instead. */
export function prefill(e: LoggedWorkoutExercise): LastWeekSet {
  return e.lastWeek ?? { weight: 0, reps: e.repMin || 10, rir: e.targetRIR }
}

/** The human label of one set slot — shared by the row, its aria-label and the edit sheet. */
export function setSlotLabel(index: number, warmup: boolean, warmupCount: number): string {
  return warmup ? `B${index + 1} bemelegítő szett` : `${index - warmupCount + 1}. working szett`
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
}

export function WorkoutCard({
  exercise, session, busy, onLogSet, onTapDoneRow, onOpenRecords, onOpenMenu, onEditNote,
  note = '', medalsBySetIdx = {}, failedLocalIds, challenge,
}: WorkoutCardProps) {
  const id = exercise.id
  const logged = session.logged[id] ?? []
  const cursor = nextSetIdx(session, id)
  const count = effectiveSetCount(session, id)
  const skipped = session.skipped.includes(id)
  const complete = !skipped && cursor >= count
  const warmupCount = (session.prescribed[id] ?? []).filter((p) => p.kind === 'warmup').length
  const family = muscleColor(exercise.muscle)
  const weightless = exercise.type === 'plyo'

  // The draft for the ONE editable row (the cursor slot). Reset whenever the cursor
  // moves or the slot count changes — a removeSet splices the prescription, so the
  // target behind the same cursor can change without the cursor itself moving.
  const [weight, setWeight] = useState(0)
  const [reps, setReps] = useState(0)
  const [rir, setRir] = useState(0)
  const [side, setSide] = useState<SetSide | null>(null)
  useEffect(() => {
    const t = prescribedAt(session, id, cursor)
    const prev = logged[cursor - 1]
    const p = prefill(exercise)
    if (t?.kind === 'warmup') {
      // Warmups follow the engine ramp; a null target inherits the previous warmup's
      // hand-entered weight instead of resetting to 0.
      setWeight(t.targetWeightKg ?? prev?.weight ?? p.weight)
      setReps(t.targetReps)
      setRir(t.targetRIR ?? 0)
    } else {
      // Working sets: the just-logged WORKING set (never a warmup) wins over the static
      // engine target; the engine seeds only the first working set.
      const prevWorking = cursor > warmupCount ? prev : undefined
      setWeight(prevWorking?.weight ?? t?.targetWeightKg ?? prev?.weight ?? p.weight)
      setReps(t?.targetReps ?? prevWorking?.reps ?? p.reps)
      setRir(t?.targetRIR ?? prevWorking?.rir ?? p.rir)
    }
    setSide(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, cursor, count])

  const cardClass = 'wo-card' + (skipped ? ' is-skipped' : complete ? ' is-complete' : '')

  return (
    <section
      className={cardClass}
      aria-label={exercise.name}
      aria-busy={busy || undefined}
      style={{ '--ex-color': family.rail } as React.CSSProperties}
    >
      <header className="wo-card-head">
        <span className="wo-card-art">
          <MuscleChip token={exercise.muscle} size={40} />
        </span>
        <span className="wo-card-copy">
          <strong>{exercise.name}</strong>
          {skipped && <small>KIHAGYVA</small>}
        </span>
        <button
          type="button"
          className="wo-card-log"
          aria-label={`${exercise.name} · előzmények és rekordok`}
          onClick={onOpenRecords}
        >
          <ClayIcon name="i-naplo" size={24} />
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

      {challenge && (
        <div className="wo-note" title={challenge.label} aria-label={`Elfogadott kihívás — ${challenge.label}`}>
          <ClayIcon name="i-kihivas" size={18} />
          <span className="ntext">{challenge.target}</span>
        </div>
      )}

      {note && (
        <button type="button" className="wo-note exercise-note-pill" aria-label="Gyakorlat-jegyzet" onClick={onEditNote}>
          <ClayIcon name="i-checkin" size={18} />
          <span className="ntext">{note}</span>
        </button>
      )}

      {!skipped && (
        <>
          {/* The progression signal is the plan's own words about TODAY's target; the
              rationale sentence is its first-session/anchor-less counterpart. Never both. */}
          {exercise.progression ? (
            <ProgressionBanner progression={exercise.progression} lastWeek={exercise.lastWeek} />
          ) : exercise.rationale ? (
            <div className="wo-cue">
              <ClayIcon name="i-minta" size={20} />
              <p>{exercise.rationale}</p>
            </div>
          ) : null}

          <div className="wo-rows">
            <div className="wo-rows-head" aria-hidden="true">
              <span>#</span>
              <span>KG</span>
              <span>ISM</span>
              <span>RIR</span>
              <span>✓</span>
              <span />
            </div>

            {Array.from({ length: count }, (_, i) => {
              const t = prescribedAt(session, id, i)
              const warm = t?.kind === 'warmup'
              const actual = logged[i]
              const isDone = i < cursor
              const idxLabel = warm ? `B${i + 1}` : String(i - warmupCount + 1)
              const idxCell = (
                <span className="wo-idx" style={warm ? { color: 'var(--amber-deep)' } : undefined}>{idxLabel}</span>
              )

              // ---- DONE row: read-only, tap opens the edit sheet ----
              if (isDone && actual) {
                // mezo-l3on: a logged row whose POST is still genuinely in flight has no
                // server row to PUT/DELETE against, so it must not be tappable. A row whose
                // POST is KNOWN to have failed is not in flight — it is tappable again.
                const rowFailed = !!actual.localId && !!failedLocalIds?.has(actual.localId)
                const rowDisabled = !actual.id && !rowFailed
                const status = setStatus(exercise, { reps: actual.reps, kind: warm ? 'warmup' : 'working' })
                const medals = (medalsBySetIdx[i] ?? []).filter((m) => m.tier === 'RECORD')
                const ariaLabel = `${setSlotLabel(i, warm, warmupCount)} szerkesztése — ${actual.weight ?? '–'} kg × ${actual.reps ?? '–'}${warm ? '' : ` — RIR ${actual.rir ?? '–'}`}`
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
                    <span className="wo-field small num">{warm ? '—' : actual.rir}</span>
                    <span className="wo-check" aria-hidden="true">✓</span>
                    <span className="wo-verdict">
                      {status === 'ok'
                        ? <span className="wkx-stat-ok">✓</span>
                        : <span className="wkx-stat-dev">{status === 'below' ? '▼ cél alatt' : '▲ cél felett'}</span>}
                      {medals.map((m, mi) => <MedalChip key={mi} medal={m} />)}
                    </span>
                  </button>
                )
              }

              // ---- THE editable row: the cursor slot, and only it ----
              if (i === cursor) {
                return (
                  <form
                    key={i}
                    className="wo-row is-current"
                    onSubmit={(e) => {
                      e.preventDefault()
                      onLogSet({ weight: weightless ? 0 : weight, reps, rir: warm ? null : rir, side })
                    }}
                  >
                    {idxCell}
                    <label className="wo-field">
                      <input
                        type="number" step="0.5" min={0} max={999} inputMode="decimal"
                        aria-label={`${exercise.name}, ${setSlotLabel(i, warm, warmupCount)}, súly`}
                        disabled={weightless}
                        value={weightless ? 0 : weight}
                        onChange={(e) => setWeight(Number(e.target.value))}
                      />
                    </label>
                    <label className="wo-field">
                      <input
                        type="number" step="1" min={1} max={100} inputMode="numeric"
                        aria-label={`${exercise.name}, ${setSlotLabel(i, warm, warmupCount)}, ismétlés`}
                        value={reps}
                        onChange={(e) => setReps(Number(e.target.value))}
                      />
                    </label>
                    <span className="wo-field small num">{warm ? '—' : rir}</span>
                    <button type="submit" className="wo-check" aria-pressed={false} aria-label={`${setSlotLabel(i, warm, warmupCount)} mentése`}>
                      ✓
                    </button>
                    <span className="wo-verdict" />

                    {/* No RIR on a warmup set — effort tracking is working-set-only (mezo-eerq). */}
                    {!warm && (
                      <span className="wo-pick" style={{ gridColumn: '1 / -1', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {RIR_VALUES.map((n) => (
                          <button
                            key={n} type="button" className="wo-check"
                            aria-pressed={rir === n} aria-label={`RIR ${n}`}
                            onClick={() => setRir(n)}
                          >
                            {n}
                          </button>
                        ))}
                      </span>
                    )}
                    {exercise.type === 'isolation' && (
                      <span className="wo-pick" style={{ gridColumn: '1 / -1', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
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
                )
              }

              // ---- LATER pending row: the prescribed target, quiet and inert ----
              return (
                <div key={i} className="wo-row" aria-label={`${setSlotLabel(i, warm, warmupCount)} · terv`}>
                  {idxCell}
                  <span className="wo-field num">{t?.targetWeightKg != null ? t.targetWeightKg.toLocaleString('hu-HU') : '—'}</span>
                  <span className="wo-field num">{warm ? (t?.targetReps ?? '—') : `${exercise.repMin}–${exercise.repMax}`}</span>
                  <span className="wo-field small num">{warm ? '—' : (t?.targetRIR ?? exercise.targetRIR)}</span>
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

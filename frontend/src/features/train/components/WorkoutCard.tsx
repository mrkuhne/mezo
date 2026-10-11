// ============================================================
// Mezo · WorkoutCard (mezo-n4wf5.4, Folyadék F4 area B) — ONE exercise of the active workout, in its two faces:
//
//   WorkoutCard — the exercise ON TOP (the hero): muscle chip + name, the round three-dot button in the corner (the
//                 per-exercise menu), the tool row (Rekordok · Technika), a state cell (kihagyva / lecserélve / első
//                 alkalom), its küldetések, the quiet lines (where it came from, its note, a reason) and the set grid.
//   WorkoutRow  — every OTHER exercise: a row with its target, its state pill and one capsule per set; a tap brings
//                 it on top.
//
// Build target: docs/design_2.0/prototypes/vilagos/edzes.js `session()` + `setRow()`. The layout is the approved change
// from the old list of open cards; the logging rules did not move:
//   · warm-up slots are prescribed but never shown (mezo-i8ahy) — a row index goes through `slotIndex()`;
//   · sets are logged strictly in order per exercise (the model's `nextSetIdx`): rows BEFORE the cursor are done
//     (their mark opens the set editor; a row whose POST is still in flight is not tappable — mezo-l3on), the row AT
//     the cursor is the only editable one, rows AFTER it show their target;
//   · the cursor draft: kg is a text field (the HU keypad types a comma — mezo-py1i6), the reps follow the kg at
//     equivalent effort (mezo-l95v4), RIR is clamped 0–5, isolation work has the side picker, plyo has no weight.
// The draft lives here and is seeded from the cursor slot; the grid itself is the shared `SetGrid`.
// ============================================================
import { useEffect, useState } from 'react'
import type { LastWeekSet, LoggedWorkoutExercise } from '@/data/types'
import type { Medal } from '@/data/train/medalTypes'
import { RIR_MAX } from '@/features/train/logic/rir'
import { setStatus } from '@/features/train/logic/workoutCardMeta'
import { adjustedRange, adjustedTarget, equivalentReps } from '@/features/train/logic/repEquivalence'
import { formatDecimal, parseDecimal } from '@/features/train/logic/decimalInput'
import { overflowWhy, progressionChip } from '@/features/train/logic/progressionChip'
import type { RowTag } from '@/features/train/logic/sessionFocus'
import type { ChallengeBadgeState } from '@/features/train/components/WorkoutMenuGlass'
import {
  Cell, Cells, DeltaChip, InfoLine, Mchp, QuestLine, SetGrid, ToolBtn, ToolRow, deepMuscle,
  type SetGridRow, type SetVerdict,
} from '@/features/train/components/folyadek'
import { Caps, DotsBtn, Hero, Row, RowEnd, St } from '@/shared/ui/folyadek'
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

/** The human label of one set slot — shared by the grid's accessible names and the edit sheet.
 *  Warm-up slots are not shown (mezo-i8ahy), so every visible slot is simply the nth set. */
export function setSlotLabel(index: number): string {
  return `${index + 1}. szett`
}

const hu = (n: number) => n.toLocaleString('hu-HU')

/** „72,5 × 10": the first working set's prescription (the engine's target when the plan carries none); a weightless
 *  target reads „8 ism."; null when there is nothing to say. */
export function exerciseGoal(e: LoggedWorkoutExercise): string | null {
  const p = e.prescribedSets?.find((x) => x.kind === 'working')
  const kg = p?.targetWeightKg ?? e.progression?.targetWeightKg ?? null
  const reps = p?.targetReps ?? e.progression?.targetReps ?? null
  if (reps == null) return null
  if (e.type === 'plyo') return `${reps} ism.`
  return kg != null ? `${hu(kg)} × ${reps}` : null
}

const VERDICT: Record<'ok' | 'below' | 'above', SetVerdict> = { ok: 'tick', below: 'down', above: 'up' }

export interface WorkoutCardProps {
  exercise: LoggedWorkoutExercise
  session: Session
  /** A log/edit write is in flight for this exercise (drives `aria-busy`). */
  busy: boolean
  onLogSet(input: { weight: number; reps: number; rir: number | null; side: SetSide | null }): void
  /** Opens the SetEditSheet for an already-logged slot. */
  onTapDoneRow(setIdx: number): void
  /** The Rekordok sheet: history + personal records (+ Múlt hét / Mai cél). */
  onOpenRecords(): void
  /** The per-exercise menu (the round three-dot button in the corner). */
  onOpenMenu(): void
  /** The exercise's video (Technika). The button exists only when the exercise has one. */
  onOpenVideo?(): void
  /** The NoteEditSheet for the durable per-exercise note. */
  onEditNote(): void
  /** Effective per-exercise note (a just-saved local override wins over `exercise.note`). */
  note?: string
  /** RECORD-tier medals per LOGGED set index (mezo-wp6n): such a row's mark is the record mark. */
  medalsBySetIdx?: Record<number, Medal[]>
  /** localIds of this exercise's logged sets whose POST failed (mezo-l3on F1). */
  failedLocalIds?: ReadonlySet<string>
  /** The küldetések on THIS exercise that the owner took on at Indulás (mezo-mgu2r) — accepted,
   *  released mid-workout, or already resolved. Each is a tappable line. */
  challenges?: { id: string; label: string; target: string; state: ChallengeBadgeState }[]
  /** Opens the küldetés sheet (release / take back). */
  onOpenChallenge?: (id: string) => void
  /** No instance id to log against (a failed start — mezo-e1ii9 fix round 1): the cursor
   *  row's ✓ is disabled, so a set that the server cannot store is never shown as stored. */
  logBlocked?: boolean
}

interface Draft { weight: number; reps: string; rir: string }

export function WorkoutCard({
  exercise, session, busy, onLogSet, onTapDoneRow, onOpenRecords, onOpenMenu, onOpenVideo, onEditNote,
  note = '', medalsBySetIdx = {}, failedLocalIds, challenges = [], onOpenChallenge, logBlocked = false,
}: WorkoutCardProps) {
  const id = exercise.id
  const logged = session.logged[id] ?? []
  const cursor = nextSetIdx(session, id)
  const count = effectiveSetCount(session, id)
  const skipped = session.skipped.includes(id)
  const complete = !skipped && cursor >= count
  const weightless = exercise.type === 'plyo'
  const color = deepMuscle(exercise.muscle)
  // The hero's ONE sentence. Production has no coaching-cue field yet: `rationale` carries the plan's PROGRESSION
  // prose, which only says something the numbers cannot for a FIRST-EVER exercise (no last week to compare). A target
  // past the range top (reps before a too-big weight jump, mezo-bk7sn) carries its reason in the same slot.
  const cue = exercise.lastWeek == null
    ? (exercise.rationale ?? exercise.progression?.rationale ?? null)
    : overflowWhy(exercise.repMax, exercise.progression)

  // The cursor slot's prescription — read by the prefill, the kg field and the adjust caption.
  const cursorTarget = prescribedAt(session, id, slotIndex(session, id, cursor))
  // The draft of the ONE editable row. Seeded from the cursor slot: the just-logged set wins over the static engine
  // target (the engine seeds only the first working set), and a weight carried over from a swapped set keeps its
  // equivalent reps (mezo-l95v4).
  const seed = (): Draft => {
    const t = cursorTarget
    const prev = logged[cursor - 1]
    const p = prefill(exercise)
    const w = prev?.weight ?? t?.targetWeightKg ?? p.weight
    return { weight: w, reps: String(equivalentReps(t, w) ?? t?.targetReps ?? prev?.reps ?? p.reps), rir: String(t?.targetRIR ?? prev?.rir ?? p.rir) }
  }
  const [draft, setDraft] = useState<Draft>(seed)
  // The kg field's live text while typing — null mirrors `draft.weight`. A text field, not a native number input: the
  // HU decimal keypad types a comma, which a number input reports as '' mid-entry and wiped the draft (mezo-py1i6).
  const [weightText, setWeightText] = useState<string | null>(null)
  const [side, setSide] = useState<SetSide | null>(null)
  // Re-seed whenever the cursor moves or the slot count changes — a removeSet splices the prescription, so the target
  // behind the same cursor can change without the cursor itself moving.
  useEffect(() => {
    setDraft(seed())
    setWeightText(null)
    setSide(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, cursor, count])

  const { weight } = draft
  const repsNum = Number(draft.reps)
  const submit = () => {
    // The old number field's own bounds (1–100): a set without a rep count is not a set.
    if (!Number.isFinite(repsNum) || repsNum < 1 || repsNum > 100) return
    onLogSet({ weight: weightless ? 0 : weight, reps: repsNum, rir: Number(draft.rir) || 0, side })
  }

  // Mid-workout swap/add (mezo-mobji): a swapped-out exercise stays with only its logged sets and without a menu; a
  // swapped-in / added one says so, and a never-done one says who picks the first weight.
  const swappedOut = !!exercise.replacedByName
  const inPlan = exercise.changeScope === 'MESO'
  const change = !skipped && exercise.changeScope
    ? exercise.replacesName
      ? { icon: inPlan ? 't-peak' as const : 't-swap' as const, text: `${inPlan ? 'A tervben is' : 'Csak ma'} · a ${exercise.replacesName} helyett` }
      : { icon: inPlan ? 't-peak' as const : 't-addex' as const, text: inPlan ? 'Felvéve a tervbe' : 'Ma hozzáadva' }
    : null
  const firstTime = !skipped && !swappedOut && !!exercise.changeScope && exercise.lastWeek == null && !cue

  const rows: SetGridRow[] = Array.from({ length: count }, (_, i): SetGridRow => {
    // Row `i` is the i-th WORKING slot; the prescription lives behind the warm-up ramp in the model (mezo-i8ahy).
    const t = prescribedAt(session, id, slotIndex(session, id, i))
    const actual = logged[i]
    if (i < cursor && actual) {
      // mezo-l3on: a logged row whose POST is still in flight has no server row to PUT/DELETE against, so it is not
      // tappable. A row whose POST is KNOWN to have failed is not in flight — it is tappable again.
      const rowFailed = !!actual.localId && !!failedLocalIds?.has(actual.localId)
      // A swapped weight is judged against its shifted range (mezo-l95v4).
      const status = setStatus(adjustedRange(exercise, t, actual.weight), { reps: actual.reps, kind: 'working' })
      const record = (medalsBySetIdx[i] ?? []).some((m) => m.tier === 'RECORD')
      return {
        kind: 'done', kg: weightless ? '—' : hu(actual.weight), reps: actual.reps, rir: actual.rir,
        verdict: record ? 'record' : VERDICT[status], busy: !actual.id && !rowFailed, onEdit: () => onTapDoneRow(i),
      }
    }
    if (i === cursor) {
      return {
        kind: 'cursor', kg: weightText ?? formatDecimal(weight), reps: draft.reps, rir: draft.rir, weightless, disabled: logBlocked,
        onKg: (v) => {
          setWeightText(v)
          const w = parseDecimal(v)
          if (w == null) return
          // The reps follow the kg at equivalent effort (mezo-l95v4); typed reps stand until the kg moves again.
          const r = equivalentReps(cursorTarget, w)
          setDraft((d) => ({ ...d, weight: w, reps: r != null ? String(r) : d.reps }))
        },
        onKgBlur: () => setWeightText(null),
        onReps: (v) => setDraft((d) => ({ ...d, reps: v.replace(/\D/g, '').slice(0, 3) })),
        // One digit, 0–RIR_MAX: the last key typed wins, so „2" → „4" needs no select-all.
        onRir: (v) => {
          const digits = v.replace(/\D/g, '')
          setDraft((d) => ({ ...d, rir: digits === '' ? '' : String(Math.min(RIR_MAX, Math.max(0, Number(digits.slice(-1))))) }))
        },
        onSubmit: submit,
      }
    }
    // A later pending row: the prescribed target — or, after a weight swap, the swapped weight at its equivalent reps.
    const later = weightless ? null : adjustedTarget(t, weight)
    return {
      kind: 'pending',
      kg: weightless ? '—' : later ? hu(later.targetWeightKg) : t?.targetWeightKg != null ? hu(t.targetWeightKg) : '—',
      reps: later ? String(later.targetReps) : `${exercise.repMin}–${exercise.repMax}`,
      rir: t?.targetRIR ?? exercise.targetRIR,
    }
  })
  const adj = !weightless && !complete ? adjustedTarget(cursorTarget, weight) : null

  return (
    <Hero
      className="ek-hero"
      aria-label={exercise.name}
      aria-busy={busy || undefined}
      data-state={skipped ? 'skipped' : swappedOut ? 'swapped' : complete ? 'done' : 'open'}
      verdict={exercise.name}
      left={<Mchp muscle={exercise.muscle} />}
    >
      <ToolRow>
        <ToolBtn icon="t-journal" aria-label={`${exercise.name} · előzmények és rekordok`} onClick={onOpenRecords}>Rekordok</ToolBtn>
        {onOpenVideo && !swappedOut && <ToolBtn icon="t-play" aria-haspopup="dialog" onClick={onOpenVideo}>Technika</ToolBtn>}
      </ToolRow>
      {!swappedOut && <DotsBtn aria-haspopup="dialog" aria-label={`${exercise.name} · további műveletek`} onClick={onOpenMenu} />}

      {skipped ? (
        <Cells><Cell label="Állapot" value="kihagyva · a már naplózott szettjeid megmaradnak" /></Cells>
      ) : swappedOut ? (
        <Cells><Cell label="Állapot" value={`lecserélve → ${exercise.replacedByName} · ${logged.length} szett kész`} /></Cells>
      ) : firstTime ? (
        <Cells><Cell label="Első alkalom" value="a súlyt te adod meg, innentől jön a javaslat" /></Cells>
      ) : null}

      {challenges.map((c) => (
        <QuestLine
          key={c.id}
          label={c.label}
          target={c.target}
          released={c.state === 'released'}
          aria-label={`${c.label} küldetés · ${c.state === 'released' ? 'elengedve' : c.state === 'accepted' ? 'vállalva' : 'lezárva'}`}
          onClick={() => onOpenChallenge?.(c.id)}
        />
      ))}

      {change && <InfoLine icon={change.icon}>{change.text}</InfoLine>}
      {note && <InfoLine icon="t-note" aria-label="Gyakorlat-jegyzet" onClick={onEditNote}>{note}</InfoLine>}
      {!skipped && cue && <InfoLine icon="t-info">{cue}</InfoLine>}

      {!skipped && (
        <SetGrid
          name={exercise.name}
          color={color}
          rows={rows}
          rirMax={RIR_MAX}
          side={exercise.type === 'isolation' ? { value: side, onChange: setSide } : undefined}
          adjust={adj && cursorTarget?.targetWeightKg != null
            ? `${hu(adj.targetWeightKg)} kg-hoz igazítva · ajánlás ${hu(cursorTarget.targetWeightKg)} × ${cursorTarget.targetReps}`
            : undefined}
        />
      )}
    </Hero>
  )
}

const TAG: Record<Exclude<RowTag, null>, { text: string; tone: 'q' | 'plan' | 'ok' }> = {
  skipped: { text: 'Kihagyva', tone: 'q' },
  now: { text: 'Most', tone: 'plan' },
  done: { text: 'Kész', tone: 'ok' },
}

export interface WorkoutRowProps {
  exercise: LoggedWorkoutExercise
  session: Session
  /** `rowTag(session, id, { swappedOut })`. */
  tag: RowTag
  /** Brings this exercise on top. */
  onFocus(): void
}

/** An exercise that is NOT on top: what it asks for, where it stands (pill + one capsule per set). */
export function WorkoutRow({ exercise, session, tag, onFocus }: WorkoutRowProps) {
  const id = exercise.id
  const done = session.logged[id]?.length ?? 0
  const count = effectiveSetCount(session, id)
  const skipped = session.skipped.includes(id)
  const swappedOut = !!exercise.replacedByName
  const goal = exerciseGoal(exercise)
  const chip = exercise.progression ? progressionChip(exercise.progression) : null
  const sub = skipped
    ? 'kihagyva'
    : swappedOut
      ? `lecserélve → ${exercise.replacedByName} · ${done} szett kész`
      : <>{count} szett{goal ? ` · cél ${goal}` : ''}{chip && <> <DeltaChip tone={chip.tone}>{chip.text}</DeltaChip></>}</>
  return (
    <Row
      className="ek-row"
      data-state={skipped ? 'skipped' : swappedOut ? 'swapped' : tag ?? 'open'}
      state={skipped || swappedOut ? 'dim' : undefined}
      left={<Mchp muscle={exercise.muscle} sm />}
      title={exercise.name}
      sub={sub}
      onClick={onFocus}
      chev
      right={(
        <RowEnd stack>
          {tag && <St tone={TAG[tag].tone}>{TAG[tag].text}</St>}
          <Caps n={count} done={done} cur={skipped || swappedOut ? undefined : done} color={deepMuscle(exercise.muscle)} label={`${done} / ${count} szett kész`} />
        </RowEnd>
      )}
    />
  )
}

// ============================================================
// Mezo · WorkoutRecordsGlass (mezo-88iwa.7, T6 Task 5) — the per-card "előzmények és
// rekordok" glass, GlassBox-hosted. Ports the prototype's `historyGlass` (docs/
// design_2.0/prototypes/companion-titanium/session.js:161-230) onto REAL data only:
//
//   · "A múltkori alkalom" — `exercise.lastWeek`, the wire's top working set of the
//     previous session (NOT the full session — there is no sibling-row list to show,
//     so the label says exactly that). Em dash when null (first-ever workout).
//   · "Megdönthető rekordok" — three `.wo-rec` bars (BECSÜLT 1RM / LEGJOBB SZETT /
//     LEGTÖBB VOLUMEN egy alkalmon) from the matched ExerciseRecordResponse, each with
//     today's progress toward it (Epley e1RM / kg×reps, `logic/recordFor.ts`) and a
//     MA MEGDÖNTVE state when today's number exceeds the record. A field the wire
//     doesn't carry (bodyweight — no weightKg, or simply never logged) renders an em
//     dash — never a fabricated 0.
//   · repRecords as a compact list — reuses the `.wo-last` grid (index/KG/REP/DÁTUM)
//     rather than inventing a new class; Task 2 only shipped `.wo-last`/`.wo-rec*`.
//   · NO trajectory chart (that is T13's Gyakorlatok-rebuild territory) — one closing
//     `.wo-glass-note` sentence says so, no promise language.
//
// The "LEGJOBB SZETT" bar mirrors the prototype's own choice of comparison metric:
// today's side of BOTH the 1RM and the best-set bar is the same best-e1RM-eligible
// set logged today (`todayBest`) — comparing on a common (e1RM) scale is how the
// prototype lets a different weight/rep combo still register as "beating" a record
// set, and there is no other honest way to rank "which set is better" across reps.
// ============================================================
import type { LoggedWorkoutExercise } from '@/data/types'
import type { ExerciseRecordResponse } from '@/data/train/trainApi'
import { MUSCLE_LABELS } from '@/data/train/train'
import { huMonthDay } from '@/shared/lib/dates'
import { barProgress, todayBest, type TodaySetLike } from '@/features/train/logic/recordFor'
import { MuscleChip } from '@/features/train/components/MuscleChip'
import { GlassBox } from '@/shared/ui/mozaik/GlassBox'
import { ClayIcon, type ClayIconName } from '@/shared/ui/clay'

const EM_DASH = '—'

/** 102.5 -> "102,5"; 100 -> "100" — hu-HU decimal comma, 1-decimal precision. */
function fmtKg(n: number): string {
  return (Math.round(n * 10) / 10).toLocaleString('hu-HU')
}

// toLocaleString('hu-HU') groups thousands with a NNBSP/narrow-NBSP — normalize to a
// plain space so the DOM text (and tests) carry a stable, copy-pasteable character.
function fmtWhole(n: number): string {
  return Math.round(n).toLocaleString('hu-HU').replace(/[  ]/g, ' ')
}

/** "Legjobb szett" / repRecords cell: weighted -> "102,5 kg", bodyweight (no weightKg) -> reps only. */
function fmtSet(set: { weightKg?: number; reps: number }): string {
  return set.weightKg != null ? `${fmtKg(set.weightKg)} kg × ${set.reps}` : `${set.reps} rep`
}

interface RecordBarProps {
  icon: ClayIconName
  label: string
  /** The record's own value, formatted — em dash when the record doesn't carry this field. */
  value: string
  /** "<date> óta áll", or '' when there is no record to date. */
  since: string
  now: number
  target: number
  /** What to show on the "ma …" line when something IS logged today and it hasn't beaten
   *  the record yet (e.g. "104 kg" or "312 kg × rep") — '' suppresses the whole line. */
  nowLabel: string
}

function RecordBar({ icon, label, value, since, now, target, nowLabel }: RecordBarProps) {
  const { share, beaten } = barProgress(now, target)
  return (
    <div className={`wo-rec${beaten ? ' is-beaten' : ''}`}>
      <span className="wo-rec-art"><ClayIcon name={icon} size={34} /></span>
      <span className="wo-rec-head"><small>{label}</small><strong>{value}</strong></span>
      <span className="wo-rec-since">{since}</span>
      <span className="wo-rec-track"><i style={{ '--w': `${share}%` } as React.CSSProperties} /></span>
      <span className="wo-rec-now">
        {beaten ? <b>MA MEGDÖNTVE</b> : now > 0 && nowLabel ? `ma ${nowLabel}` : ''}
      </span>
    </div>
  )
}

export interface WorkoutRecordsGlassProps {
  open: boolean
  exercise: LoggedWorkoutExercise
  /** The matched record row (`recordFor(exerciseRecords, exercise)`), or undefined
   *  when this exercise has never been logged before — every bar then shows an
   *  em-dash record with an unbeaten (but beatable-from-zero) target. */
  record: ExerciseRecordResponse | undefined
  /** This exercise's logged sets from TODAY's session (`session.logged[exercise.id]`). */
  todaySets: readonly TodaySetLike[]
  tint: string
  onClose: () => void
}

export function WorkoutRecordsGlass({ open, exercise, record, todaySets, tint, onClose }: WorkoutRecordsGlassProps) {
  const today = todayBest(todaySets)
  const nothingLoggedToday = todaySets.length === 0

  const bestSetE1rm = record?.bestSet?.weightKg != null
    ? (record.bestSet.weightKg * (30 + record.bestSet.reps)) / 30
    : 0

  return (
    <GlassBox open={open} onClose={onClose} label={`${exercise.name} előzményei és rekordjai`} tint={tint}>
      <header className="wo-glass-head">
        <span className="wo-card-art">
          <MuscleChip token={exercise.muscle} size={40} />
        </span>
        <span>
          <small>
            {(MUSCLE_LABELS[exercise.muscle] ?? exercise.muscle).toLocaleUpperCase('hu-HU')}
            {record ? ` · ${record.sessionCount} ALKALOM` : ''}
          </small>
          <strong>{exercise.name}</strong>
        </span>
      </header>

      <h3 className="wo-glass-title">
        A múltkori alkalom
        <span>A múltkori legjobb munkaszetted</span>
      </h3>
      {exercise.lastWeek ? (
        <div className="wo-last">
          <div className="wo-last-head"><span /><span>KG</span><span>REP</span><span>RIR</span></div>
          <div className="wo-last-row">
            <span>1</span>
            <strong>{fmtKg(exercise.lastWeek.weight)}</strong>
            <strong>{exercise.lastWeek.reps}</strong>
            <span>{exercise.lastWeek.rir}</span>
          </div>
        </div>
      ) : (
        <p className="wo-rec-empty">{EM_DASH}</p>
      )}

      <h3 className="wo-glass-title">Megdönthető rekordok</h3>
      {nothingLoggedToday && (
        <p className="wo-rec-empty">Ma még nem logoltál ehhez szettet — a sávok üresen állnak.</p>
      )}
      <div className="wo-recs">
        <RecordBar
          icon="i-cel"
          label="BECSÜLT 1RM"
          value={record?.bestE1rm ? `${fmtKg(record.bestE1rm.value)} kg` : EM_DASH}
          since={record?.bestE1rm ? `${huMonthDay(record.bestE1rm.set.date)} óta áll · Becslés, nem mérés` : 'Becslés, nem mérés'}
          now={today.e1rm ?? 0}
          target={record?.bestE1rm?.value ?? 0}
          nowLabel={today.e1rm != null ? `${fmtKg(today.e1rm)} kg` : ''}
        />
        <RecordBar
          icon="i-suly"
          label="LEGJOBB SZETT"
          value={record?.bestSet ? fmtSet(record.bestSet) : EM_DASH}
          since={record?.bestSet ? `${huMonthDay(record.bestSet.date)} óta áll` : ''}
          now={today.e1rm ?? 0}
          target={bestSetE1rm}
          nowLabel={today.e1rmSet ? fmtSet({ weightKg: today.e1rmSet.weight > 0 ? today.e1rmSet.weight : undefined, reps: today.e1rmSet.reps }) : ''}
        />
        <RecordBar
          icon="i-stack"
          label="LEGTÖBB VOLUMEN egy alkalmon"
          value={record?.bestSessionVolume ? `${fmtWhole(record.bestSessionVolume.volumeKg)} kg × rep` : EM_DASH}
          since={record?.bestSessionVolume ? `${huMonthDay(record.bestSessionVolume.date)} óta áll` : ''}
          now={today.volume}
          target={record?.bestSessionVolume?.volumeKg ?? 0}
          nowLabel={today.volume > 0 ? `${fmtWhole(today.volume)} kg × rep` : ''}
        />
      </div>

      {record && record.repRecords.length > 0 && (
        <>
          <h3 className="wo-glass-title">Rep-rekordok</h3>
          <div className="wo-last">
            <div className="wo-last-head"><span /><span>KG</span><span>REP</span><span>DÁTUM</span></div>
            {record.repRecords.map((rr, i) => (
              <div className="wo-last-row" key={i}>
                <span>{i + 1}</span>
                <strong>{rr.weightKg != null ? fmtKg(rr.weightKg) : EM_DASH}</strong>
                <strong>{rr.reps}</strong>
                <span>{huMonthDay(rr.date)}</span>
              </div>
            ))}
          </div>
        </>
      )}

      <p className="wo-glass-note">A hosszabb távú ív a Gyakorlatok-oldal újraépítésével kerül majd ide.</p>
    </GlassBox>
  )
}

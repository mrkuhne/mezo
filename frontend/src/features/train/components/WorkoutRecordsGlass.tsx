// ============================================================
// Mezo · WorkoutRecordsGlass — the exercise's „Rekordok" sheet of the active workout, on REAL data only.
//
// Folyadék F4 (mezo-n4wf5.4, area C): a light sheet built to the prototype's `recs` sheet
// (docs/design_2.0/prototypes/vilagos/edzes.js). Top to bottom:
//
//   · „Múlt hét / Mai cél" — two cells with the step against last week as a chip (owner, F4 round 2). Shown
//     only when there IS a last week (`exercise.lastWeek`); the goal cell needs `goal` (the first working
//     prescribed set — the caller reads it from the session) and the chip is `progressionChip(exercise.progression)`.
//   · „A múltkori alkalom" — `exercise.lastWeek`, the top working set of the previous session, as three facts
//     (kg · ism · RIR). No last week → one honest sentence, never a fabricated row.
//   · „Megdönthető rekordok" — three rows (Becsült 1RM / Legjobb szett / Legtöbb volumen egy alkalmon) from the
//     matched ExerciseRecordResponse; each carries a LEVEL of today's share toward it (Epley e1RM / kg × ism,
//     `logic/recordFor.ts`), „ma …" under it, and the „ma megdöntve" pill (gold level) once today's number
//     exceeds the record. A field the wire does not carry (bodyweight — no weightKg, or never logged) is an em
//     dash — never a fabricated 0.
//   · „Ismétlés-rekordok" — one row per rep record: a record capsule, the weight, the date, the reps.
//   · NO trajectory chart — one closing sentence says so, no promise language.
//
// Today's side of BOTH the 1RM and the best-set row is the same best-e1RM-eligible set logged today
// (`todayBest`): comparing on a common (e1RM) scale is the only honest way to rank sets across rep counts.
// ============================================================
import type { ReactNode } from 'react'
import type { LoggedWorkoutExercise } from '@/data/types'
import type { ExerciseRecordResponse } from '@/data/train/trainApi'
import { MUSCLE_LABELS } from '@/data/train/train'
import { huMonthDay } from '@/shared/lib/dates'
import { barProgress, todayBest, type TodaySetLike } from '@/features/train/logic/recordFor'
import { progressionChip } from '@/features/train/logic/progressionChip'
import { Cell, Cells, DeltaChip, Mchp, Rcap, deepMuscle } from '@/features/train/components/folyadek'
import type { Icon3DName } from '@/shared/ui/clay'
import { Facts, FoSheetHead, Lab, LevelMarks, Note, Row, St, Txt } from '@/shared/ui/folyadek'
import { Sheet } from '@/shared/ui/Sheet'

const EM_DASH = '—'

/** 102.5 -> "102,5"; 100 -> "100" — hu-HU decimal comma, 1-decimal precision. */
function fmtKg(n: number): string {
  return (Math.round(n * 10) / 10).toLocaleString('hu-HU')
}

// toLocaleString('hu-HU') groups thousands with a NNBSP/narrow-NBSP — normalize to a
// plain space so the DOM text (and tests) carry a stable, copy-pasteable character.
function fmtWhole(n: number): string {
  return Math.round(n).toLocaleString('hu-HU').replace(/[  ]/g, ' ')
}

/** „Legjobb szett": weighted -> "102,5 kg × 8", bodyweight (no weightKg) -> reps only. */
function fmtSet(set: { weightKg?: number; reps: number }): string {
  return set.weightKg != null ? `${fmtKg(set.weightKg)} kg × ${set.reps}` : `${set.reps} ism.`
}

/** „Múlt hét" / „Mai cél" cell value: „10 × 8"; a weightless set reads its reps. */
export function setShort(weightKg: number | null | undefined, reps: number): string {
  return weightKg != null && weightKg > 0 ? `${fmtKg(weightKg)} × ${reps}` : `${reps} ism.`
}

interface RecordRowProps {
  icon: Icon3DName
  label: string
  /** The record's own value, formatted — em dash when the record doesn't carry this field. */
  value: string
  /** "<date> óta áll", or '' when there is no record to date. */
  since: string
  now: number
  target: number
  /** What stands on the „ma …" line when something IS logged today and it hasn't beaten the record yet —
   *  '' suppresses the whole line. */
  nowLabel: string
  /** The exercise's own liquid (an unbeaten level). */
  color: string
}

function RecordRow({ icon, label, value, since, now, target, nowLabel, color }: RecordRowProps) {
  const { share, beaten } = barProgress(now, target)
  const title: ReactNode = beaten ? <>{label} <St tone="ok">ma megdöntve</St></> : label
  return (
    <Row
      icon={icon} title={title} value={value} className={beaten ? 'el-rec is-beaten' : 'el-rec'}
      sub={(
        <>
          {since}
          <span className="fo-rowbar"><LevelMarks pct={share} color={beaten ? 'var(--fo-gold)' : color} height={14} /></span>
          {!beaten && now > 0 && nowLabel && <span className="el-now">ma {nowLabel}</span>}
        </>
      )}
    />
  )
}

export interface WorkoutRecordsGlassProps {
  open: boolean
  exercise: LoggedWorkoutExercise
  /** The matched record row (`recordFor(exerciseRecords, exercise)`), or undefined when this exercise has never
   *  been logged before — every row then shows an em-dash record with an empty level. */
  record: ExerciseRecordResponse | undefined
  /** This exercise's logged sets from TODAY's session (`session.logged[exercise.id]`). */
  todaySets: readonly TodaySetLike[]
  /** Kept for the callers; the light sheet draws the muscle's own colour instead. */
  tint: string
  /** Today's goal as the „Mai cél" cell shows it („12,5 × 8" — `setShort` of the first working prescribed set).
   *  Absent → only the „Múlt hét" cell stands. */
  goal?: string | null
  onClose: () => void
}

export function WorkoutRecordsGlass({ open, exercise, record, todaySets, goal, onClose }: WorkoutRecordsGlassProps) {
  if (!open) return null
  const today = todayBest(todaySets)
  const nothingLoggedToday = todaySets.length === 0
  const color = deepMuscle(exercise.muscle)
  const last = exercise.lastWeek
  const chip = exercise.progression ? progressionChip(exercise.progression) : null

  const bestSetE1rm = record?.bestSet?.weightKg != null
    ? (record.bestSet.weightKg * (30 + record.bestSet.reps)) / 30
    : 0

  return (
    <Sheet onClose={onClose} labelledBy="wo-records-title" className="fo-sheet el-sheet">
      {(close) => (
        <>
          <FoSheetHead
            eyebrow={`${MUSCLE_LABELS[exercise.muscle] ?? exercise.muscle}${record ? ` · ${record.sessionCount} alkalom` : ''}`}
            title={<>{exercise.name}{' '}<span className="sr-only">előzményei és rekordjai</span></>} titleId="wo-records-title"
            left={<Mchp muscle={exercise.muscle} />} onClose={close}
          />

          {last && (
            <Cells className="el-cells">
              <Cell label="Múlt hét" value={`${setShort(last.weight, last.reps)} · RIR ${last.rir}`} />
              {goal && (
                <Cell label="Mai cél" value={goal} target>
                  {chip && <DeltaChip tone={chip.tone}>{chip.text}</DeltaChip>}
                </Cell>
              )}
            </Cells>
          )}

          <Lab>A múltkori alkalom · a legjobb munkaszetted</Lab>
          {last ? (
            <Facts className="el-last" items={[[last.weight > 0 ? fmtKg(last.weight) : EM_DASH, 'kg'], [String(last.reps), 'ism'], [last.rir == null ? EM_DASH : String(last.rir), 'RIR']]} />
          ) : (
            <Txt className="el-none">{EM_DASH} ezt a gyakorlatot még nem csináltad.</Txt>
          )}

          <Lab>Megdönthető rekordok · a szint, hogy ma hol jársz hozzájuk</Lab>
          {nothingLoggedToday && <Note className="el-empty">Ma még nem naplóztál ehhez szettet — a szintek üresen állnak.</Note>}
          <div className="el-ls">
            <RecordRow
              icon="t-ring" label="Becsült 1RM" color={color}
              value={record?.bestE1rm ? `${fmtKg(record.bestE1rm.value)} kg` : EM_DASH}
              since={record?.bestE1rm ? `${huMonthDay(record.bestE1rm.set.date)} óta áll · becslés, nem mérés` : 'becslés, nem mérés'}
              now={today.e1rm ?? 0}
              target={record?.bestE1rm?.value ?? 0}
              nowLabel={today.e1rm != null ? `${fmtKg(today.e1rm)} kg` : ''}
            />
            <RecordRow
              icon="t-weight" label="Legjobb szett" color={color}
              value={record?.bestSet ? fmtSet(record.bestSet) : EM_DASH}
              since={record?.bestSet ? `${huMonthDay(record.bestSet.date)} óta áll` : ''}
              now={today.e1rm ?? 0}
              target={bestSetE1rm}
              nowLabel={today.e1rmSet ? fmtSet({ weightKg: today.e1rmSet.weight > 0 ? today.e1rmSet.weight : undefined, reps: today.e1rmSet.reps }) : ''}
            />
            <RecordRow
              icon="t-protocol" label="Legtöbb volumen egy alkalmon" color={color}
              value={record?.bestSessionVolume ? `${fmtWhole(record.bestSessionVolume.volumeKg)} kg × ism` : EM_DASH}
              since={record?.bestSessionVolume ? `${huMonthDay(record.bestSessionVolume.date)} óta áll` : ''}
              now={today.volume}
              target={record?.bestSessionVolume?.volumeKg ?? 0}
              nowLabel={today.volume > 0 ? `${fmtWhole(today.volume)} kg × ism` : ''}
            />
          </div>

          {record && record.repRecords.length > 0 && (
            <>
              <Lab>Ismétlés-rekordok</Lab>
              <div className="el-ls el-reprecs">
                {record.repRecords.map((rr, i) => (
                  <Row
                    key={i} left={<Rcap color={color} />}
                    title={rr.weightKg != null ? `${fmtKg(rr.weightKg)} kg` : EM_DASH}
                    sub={huMonthDay(rr.date)} value={<>{rr.reps} <small>ism.</small></>}
                  />
                ))}
              </div>
            </>
          )}

          <Note>A hosszabb távú ív a Gyakorlatok-oldal újraépítésével kerül majd ide.</Note>
        </>
      )}
    </Sheet>
  )
}

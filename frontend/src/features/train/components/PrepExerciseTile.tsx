// ============================================================
// Mezo · PrepExerciseTile — Mozaik-recipe exercise card for the session prep's
// Gyakorlatok tile page (mezo-d20.3.8). Source: session-body.html #page-gyak
// `.extile` (Tile pass, Daniel: "élőbb, mozgóbb, csempés a listák helyett").
// Anatomy: muscle-family wash + rail, a clay disc, labeled Cél · Induló súly
// columns, mini set-dots carrying the set count (no duplicate text — the dots
// ARE the count), an optional 1RM medal, and a footer ("múlt héten →
// progresszió" + a challenge flag) that only renders when it has something to
// say. Presentational only, ported 1:1 from PrepExerciseCard's data reads.
// ============================================================
import { ClayIcon } from '@/shared/ui/clay'
import type { LoggedWorkoutExercise } from '@/data/types'
import { MUSCLE_LABELS } from '@/data/train/train'
import { muscleColor } from '@/features/train/logic/muscleColors'
import { startWeightOf } from '@/features/train/logic/prepBriefing'

export function PrepExerciseTile({ exercise, oneRmKg, accentChallenge, delayMs }: {
  exercise: LoggedWorkoutExercise
  oneRmKg: number | null
  accentChallenge: { typeLabel: string; target: string } | null
  delayMs?: number
}) {
  const e = exercise
  const fam = muscleColor(e.muscle)
  const startWeight = startWeightOf(e)
  const totalSets = e.warmupSets + e.workingSets

  const style = {
    '--fr': fam.rail, '--fw': fam.wash, '--fd': fam.deep,
    ...(delayMs !== undefined ? { '--d': `${delayMs}ms` } : {}),
  } as React.CSSProperties

  return (
    <div className="gx-tile rise" style={style}>
      <div className="gx-top">
        <span className="gx-disc"><ClayIcon name="i-edzes" size={18} /></span>
        <div className="gx-grow">
          <span className="mz-eyebrow" style={{ color: fam.deep }}>
            {(MUSCLE_LABELS[e.muscle] ?? e.muscle)} · {e.type}
          </span>
          <div className="gx-name">{e.name}</div>
        </div>
        {oneRmKg != null && (
          <div className="gx-medal">
            <span>🏆 {oneRmKg} kg</span>
            <small>1RM</small>
          </div>
        )}
      </div>

      <div className="gx-cols">
        <div><small>Cél</small><b>{e.repMin}–{e.repMax}{e.type === 'plyo' ? ' mp' : ' rep'} · RIR {e.targetRIR}</b></div>
        {startWeight != null && <div><small>Induló súly</small><b>{startWeight.toLocaleString('hu-HU')} kg</b></div>}
      </div>

      <div className="gx-dots" aria-label={`${totalSets} szett`}>
        {Array.from({ length: totalSets }, (_, i) => i < e.warmupSets
          ? <span key={i} className="gx-dot gx-dot-wu">B{i + 1}</span>
          : <span key={i} className="gx-dot gx-dot-wk">{i - e.warmupSets + 1}</span>)}
      </div>

      {(e.lastWeek || e.progression || accentChallenge) && (
        <div className="gx-foot">
          {e.lastWeek && (
            <span>múlt héten <b>{e.lastWeek.weight.toLocaleString('hu-HU')} × {e.lastWeek.reps} @{e.lastWeek.rir}</b></span>
          )}
          {e.lastWeek && e.progression && <span className="gx-arr">→</span>}
          {e.progression && (e.progression.deltaKg || e.progression.deltaReps) != null && (
            <span className="gx-chip" data-lever={e.progression.lever}>
              {e.progression.deltaKg != null && e.progression.deltaKg !== 0
                ? `${e.progression.deltaKg > 0 ? '+' : '−'}${Math.abs(e.progression.deltaKg).toLocaleString('hu-HU')} kg`
                : `+${e.progression.deltaReps} rep`}
            </span>
          )}
          {accentChallenge && (
            <span className="gx-challenge">
              <ClayIcon name="i-kihivas" size={11} /> kihívás
            </span>
          )}
        </div>
      )}
    </div>
  )
}

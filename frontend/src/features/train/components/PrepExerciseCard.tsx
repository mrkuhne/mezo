// ============================================================
// Mezo · PrepExerciseCard — mission-briefing exercise card (mezo-bxpg):
// muscle-color rail + name/muscle-pill header, an optional top-right 1RM
// record badge, an accepted-challenge line under the name (sparkle idiom,
// ported from ActiveWorkoutPage's exercise list), and a pill row (warmup ·
// working × sets · rep range · RIR · start-weight). Presentational only —
// the card derives nothing beyond `startWeightOf` (a pure prepBriefing
// import); Task 4 passes exercise/oneRmKg/accentChallenge via props.
// ============================================================
import type { LoggedWorkoutExercise } from '@/data/types'
import { MUSCLE_LABELS } from '@/data/train/train'
import { muscleColor } from '@/features/train/logic/muscleColors'
import { startWeightOf } from '@/features/train/logic/prepBriefing'
import { Icon } from '@/shared/ui/Icon'

export function PrepExerciseCard({ exercise, oneRmKg, accentChallenge }: {
  exercise: LoggedWorkoutExercise
  oneRmKg: number | null
  accentChallenge: { typeLabel: string; target: string } | null
}) {
  const e = exercise
  const mc = muscleColor(e.muscle)
  const startWeight = startWeightOf(e)

  return (
    <div className="card" style={{ display: 'flex', overflow: 'hidden' }}>
      <div style={{ width: 4, background: mc.rail, flexShrink: 0 }} aria-hidden="true" />
      <div style={{ flex: 1, padding: '13px 14px 12px' }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
          <div className="col" style={{ gap: 4, minWidth: 0, flex: 1 }}>
            <div className="row" style={{ alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'var(--ff-display)', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                {e.name}
              </span>
              <span
                className="label-mono"
                style={{
                  fontSize: 8.5, padding: '3px 8px', borderRadius: 999,
                  background: mc.wash, color: mc.deep,
                }}
              >
                {MUSCLE_LABELS[e.muscle] ?? e.muscle}
              </span>
            </div>
            {accentChallenge && (
              <div className="row gap-xs" style={{ alignItems: 'center' }}>
                <Icon name="sparkle" size={10} color="var(--coral)" />
                <span className="label-mono" style={{ fontSize: 9, color: 'var(--coral-deep)' }}>
                  {accentChallenge.typeLabel} · {accentChallenge.target}
                </span>
              </div>
            )}
          </div>

          {oneRmKg != null && (
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontFamily: 'var(--ff-display)', fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>
                🏆 {oneRmKg} kg
              </div>
              <div className="label-mono" style={{ fontSize: 7, color: 'var(--amber)', marginTop: 2 }}>1RM REKORD</div>
            </div>
          )}
        </div>

        <div className="row gap-xs flex-wrap" style={{ marginTop: 10 }}>
          {e.warmupSets > 0 && (
            <span className="chip" style={{ fontSize: 9, padding: '3px 8px' }}>🔥 {e.warmupSets} bemelegítő</span>
          )}
          <span className="chip" style={{ fontSize: 9, padding: '3px 8px', borderColor: mc.deep, color: mc.deep }}>
            {e.workingSets} × working
          </span>
          <span className="chip" style={{ fontSize: 9, padding: '3px 8px' }}>{e.repMin}–{e.repMax} rep</span>
          <span className="chip" style={{ fontSize: 9, padding: '3px 8px' }}>RIR {e.targetRIR}</span>
          {startWeight != null && (
            <span className="chip" style={{ fontSize: 9, padding: '3px 8px' }}>↑ {startWeight} kg-ról indul</span>
          )}
        </div>
      </div>
    </div>
  )
}

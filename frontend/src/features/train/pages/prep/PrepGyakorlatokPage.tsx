// ============================================================
// Mezo · PrepGyakorlatokPage — the prep mosaic's Gyakorlatok tile opened
// into its own page (mezo-d20.3.8). Source: session-body.html #page-gyak.
// Compact hero (icon + exercise count, no subtitle) + a stat strip + the
// muscle-family-grouped list of PrepExerciseTile cards (plan order kept —
// same grouping the old mission-briefing card list used).
// ============================================================
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { MozaikPage, PageBody, PageHead, PageHero, StatCell, StatStrip } from '@/shared/ui/mozaik'
import { PrepExerciseTile } from '@/features/train/components/PrepExerciseTile'
import type { LoggedWorkoutExercise } from '@/data/types'
import type { PrepStats } from '@/features/train/logic/prepBriefing'

export interface PrepExerciseGroup { key: string; label: string; exercises: LoggedWorkoutExercise[] }

export function PrepGyakorlatokPage({ groups, stats, progressionCount, oneRmOf, challengeOf, onBack }: {
  groups: PrepExerciseGroup[]
  stats: PrepStats
  progressionCount: number
  oneRmOf: (e: LoggedWorkoutExercise) => number | null
  challengeOf: (e: LoggedWorkoutExercise) => { typeLabel: string; target: string } | null
  onBack: () => void
}) {
  const exerciseCount = groups.reduce((n, g) => n + g.exercises.length, 0)
  let d = 0
  return (
    <MozaikPage tone="coral">
      <PageHead label="‹ Indítás" onBack={onBack} />
      <PageHero icon="i-edzes" big={exerciseCount} name="Gyakorlatok" />
      <PageBody principle="A sorrend a tervezett — élőben az Áthelyezéssel bármikor átrendezhető, a terv nem változik.">
        <StatStrip className="mt-sm">
          <StatCell value={stats.workSets + stats.warmupSets} label="szett" />
          {stats.durationEst > 0 && <StatCell value={`~${stats.durationEst}′`} label="becsült idő" />}
          <StatCell value={stats.muscleCount} label="izomcsoport" />
          {progressionCount > 0 && <StatCell value={progressionCount} label="progresszió" />}
        </StatStrip>
        <EntranceGroup className="col gap-md mt-md">
          {groups.map((g) => (
            <div key={g.key} className="col gap-sm">
              <span className="mz-eyebrow">{g.label} · {g.exercises.length} gyakorlat</span>
              <div className="col gap-sm">
                {g.exercises.map((e) => (
                  <PrepExerciseTile
                    key={e.id}
                    exercise={e}
                    oneRmKg={oneRmOf(e)}
                    accentChallenge={challengeOf(e)}
                    delayMs={(d += 60)}
                  />
                ))}
              </div>
            </div>
          ))}
        </EntranceGroup>
      </PageBody>
    </MozaikPage>
  )
}

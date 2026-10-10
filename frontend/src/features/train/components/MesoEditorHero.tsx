// ============================================================
// Mezo · MesoEditorHero — the hero of the day editor (mezo-7rdg; Folyadék mezo-n4wf5.3,
// prototype vilagos/edzes.js `napszerk()` hero).
// The day poured into one vessel: every exercise is a layer as wide as its working sets, in
// its muscle's colour, with the key under it. The verdict is the day's set and exercise count;
// the support line carries the time estimate and the week totals; a tag says whether any
// muscle breaks the per-session cap this week (`warningCount`). The liquid row adds an exercise.
// `off` = a rest day: an empty vessel and the (inert, as before) „Edzéssé alakít".
// ============================================================
import type { ReactNode } from 'react'
import { deepMuscle } from '@/features/train/components/folyadek'
import { Btn, Bub, EmptyTank, Hero, Legend, Pour } from '@/shared/ui/folyadek'

interface MesoEditorHeroProps {
  /** The eyebrow: „Csütörtök · Pull · a nap szerkesztése". */
  label?: ReactNode
  /** The day's exercises, in order — the layers of the vessel. */
  exercises?: { name: string; muscle: string; workingSets: number }[]
  daySets: number
  dayExerciseCount: number
  dayMinutes: number
  weekSets: number
  trainingDays: number
  warningCount: number
  onAdd?: () => void
  off?: boolean
  offNote?: string
}

export function MesoEditorHero({
  label, exercises = [], daySets, dayExerciseCount, dayMinutes, weekSets, trainingDays, warningCount, onAdd, off, offNote,
}: MesoEditorHeroProps) {
  if (off) {
    return (
      <Hero className="ee-hero" label={label} verdict="Ez pihenőnap." sub="Ezen a napon nincs gyakorlat a tervben."
        actions={<Btn>＋ Edzéssé alakít</Btn>}>
        <EmptyTank icon="t-moon">{offNote || 'Pihenőnap'}</EmptyTank>
      </Hero>
    )
  }
  const hasWarnings = warningCount > 0
  return (
    <Hero className="ee-hero" label={label}
      verdict={`${daySets} szett ma, ${dayExerciseCount} gyakorlat.`}
      sub={`${dayMinutes > 0 ? `~${dayMinutes} perc · ` : ''}Heti terhelés: ${weekSets} szett · ${trainingDays} edzésnap`}
      actions={<Btn onClick={onAdd}>＋ Gyakorlat hozzáadása</Btn>}>
      <Pour aria-label={exercises.length ? `${daySets} szett, ${dayExerciseCount} gyakorlat` : undefined}
        parts={exercises.map((e) => ({ n: e.workingSets, color: deepMuscle(e.muscle) }))}
        empty="üres — ide töltődnek a gyakorlatok" />
      {exercises.length > 0 && (
        <Legend items={exercises.map((e) => ({ color: deepMuscle(e.muscle), label: <>{e.name.split(' ')[0]} <b>{e.workingSets}</b></> }))} />
      )}
      <div className="fo-tags">
        {hasWarnings
          ? <span className="ic"><Bub icon="t-info" size={28} color="var(--fo-warn)" />{warningCount} jelzés</span>
          : <span className="ic"><Bub icon="t-tick" size={28} color="var(--fo-ok)" />kereten belül</span>}
      </div>
    </Hero>
  )
}

// ============================================================
// Mezo · ProgramDayView — egy nap saját oldala a Programból (meso-body.html
// #page-day). Oldal-ÁLLAPOT, nem külön route (session-prep minta): a URL és a
// még nem mentett vázlat végig megmarad, a ‹ Program vissza csak becsukja.
// Anatómia: típus szerinti tónus, hero (naplevél + típus + szett/perc), izom-
// cellák, majd a megszokott MesoEditor EGY napra + a gyakorlat-választó lap.
// A MesoEditor csak EZT a napot szerkeszti (`days={[day]}`), de a HETET a teljes
// programból olvassa (`weekDays={program}`) — heti sávok, lint, csúcshét-illesztés
// és a hero heti számai különben egyetlen napot néznének egész hétnek.
// ============================================================
import type { GymExercise, MesoDay, MusclePriorities } from '@/data/types'
import { MesoEditor } from '@/features/train/components/MesoEditor'
import type { SessionTimingProfile } from '@/features/train/logic/sessionLength'
import { dayTileData } from '@/features/train/wizard/dayTiles'
import { MozaikPage, PageBody, PageHead, PageHero, StatCell, StatStrip } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import type { PageTone } from '@/shared/ui/mozaik'

const TONE: Record<string, PageTone> = { coral: 'coral', sage: 'sage', rose: 'rose', gold: 'gold' }

interface ProgramDayViewProps {
  day: MesoDay
  /** The whole 7-day program — the week the edited day is judged against (mezo-d20.14, I2). */
  program: MesoDay[]
  priorities: MusclePriorities
  volumePerMuscle?: Record<string, { mev: number; mav: number; mrv: number }> | null
  /** Calibrated pacing (Task 12, mezo-dzbm) — fetched by MesocyclePlannerPage and threaded
   *  down to MesoEditor via this page-state view, matching MesoEditor's own props. */
  timingProfile?: SessionTimingProfile | null
  timingProfilePending?: boolean
  onBack: () => void
  onChange: (day: MesoDay) => void
  onAdd: () => void
}

export function ProgramDayView({
  day, program, priorities, volumePerMuscle, timingProfile, timingProfilePending, onBack, onChange, onAdd,
}: ProgramDayViewProps) {
  const tile = dayTileData(day)

  const patch = (exercises: GymExercise[]) => onChange({ ...day, exercises, exerciseCount: exercises.length })

  return (
    <MozaikPage tone={TONE[tile.tone]}>
      <PageHead onBack={onBack} label="‹ Program" />
      <EntranceGroup>
        <PageHero
          icon="i-edzes"
          big={day.day}
          name={`${day.type} nap`}
          sub={`${tile.sets} szett · ~${tile.minutes} perc · 1. hét · a terv`}
        />
        <PageBody>
          {tile.muscles.length > 0 && (
            <div className="rise" style={{ marginBottom: 11 }}>
              <StatStrip>
                {tile.muscles.map((m) => <StatCell key={m.label} value={m.sets} label={m.label} />)}
              </StatStrip>
            </div>
          )}
          <MesoEditor
            days={[day]}
            weekDays={program}
            priorities={priorities}
            volumePerMuscle={volumePerMuscle}
            timingProfile={timingProfile}
            timingProfilePending={timingProfilePending}
            onAddClick={onAdd}
            onRemove={(_dayKey, exId) => patch(day.exercises.filter((e) => e.id !== exId))}
            onChange={(_dayKey, exId, p) => patch(day.exercises.map((e) => (e.id === exId ? { ...e, ...p } : e)))}
            onReorder={(_dayKey, ids) => {
              const byId = new Map(day.exercises.map((e) => [e.id, e]))
              patch(ids.map((i) => byId.get(i)).filter((e): e is GymExercise => Boolean(e)))
            }}
          />
        </PageBody>
      </EntranceGroup>
    </MozaikPage>
  )
}

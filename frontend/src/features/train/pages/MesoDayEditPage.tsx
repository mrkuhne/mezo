// ============================================================
// Mezo · MesoDayEditPage — the running plan's day EDITOR, on its own route
// (/train/mesocycles/:id/days/:day/edit). Folyadék mezo-n4wf5.3, prototype
// vilagos/edzes.js `napszerk()` (states: `.add` · `.pihen` · `.tolt` · `.nincs`).
//
// Train parity P1 Task 4 (mezo-e1ii9): the day page is only the day page; the editing it
// used to carry lives HERE, one tap away, the same way the TEMPLATE's day plan is edited on
// its own route. This page renders `MesoExercises` — the component that owns the
// PUT …/days/{dayId}/exercises save path — so add / remove / reorder / rep-range / RIR / kg
// all behave exactly as before. The page itself is the frame title, the back target and the
// loading / not-found faces; everything under the title bar is `MesoEditor`.
//
// `?add=1` opens the exercise picker on arrival: the day page's „＋ Gyakorlat hozzáadása"
// lands here with it, so that button still adds an exercise.
// ============================================================
import { useParams, useSearchParams } from 'react-router-dom'
import { useTrain, useTimingProfile } from '@/data/hooks'
import { DAY_LABELS } from '@/data/train/train'
import { MesoExercises } from '@/features/train/components/MesoExercises'
import { Card, EmptyTank, FrameBack, Page, Skel, useFrameTitle } from '@/shared/ui/folyadek'

export function MesoDayEditPage() {
  const { id, day: dayParam } = useParams<{ id: string; day: string }>()
  const [params] = useSearchParams()
  const dayPath = `/train/mesocycles/${id}/days/${encodeURIComponent(dayParam ?? '')}`
  const { mesocycles, workoutPending } = useTrain()
  const { data: timingProfile, isPending: timingProfilePending } = useTimingProfile()

  const meso = mesocycles.find((m) => m.id === id)
  const day = meso?.days?.find((d) => d.day === dayParam)

  useFrameTitle({
    title: 'A nap szerkesztése',
    eyebrow: day ? `${DAY_LABELS[day.day] ?? day.day} · ${day.type}` : 'A nap',
  })
  // Back returns to where the user came from; a direct link falls back to the day page.
  const back = <FrameBack history fallback={dayPath} className="fo-backpill">‹</FrameBack>

  // Real mode: the plan list is still in flight — wait, do not accuse the link.
  if (workoutPending) {
    return (
      <Page className="ee-page">
        {back}
        <Skel blocks={[200, 64, 64, 64, 64, 150]} />
      </Page>
    )
  }

  if (!meso || !day) {
    return (
      <Page className="ee-page">
        {back}
        <Card>
          <EmptyTank icon="t-other">{meso ? 'Ez a nap nincs a tervedben.' : 'Ez az edzésterv nem található.'}</EmptyTank>
        </Card>
      </Page>
    )
  }

  return (
    <Page className="ee-page">
      {back}
      <MesoExercises
        meso={meso}
        day={day.day}
        autoAdd={params.get('add') === '1'}
        timingProfile={timingProfile}
        timingProfilePending={timingProfilePending}
      />
    </Page>
  )
}

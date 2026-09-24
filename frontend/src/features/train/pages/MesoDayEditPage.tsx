// ============================================================
// Mezo · MesoDayEditPage — the running block's day-plan EDITOR, on its own route
// (/train/mesocycles/:id/days/:day/edit).
//
// Train parity P1 Task 4 (mezo-e1ii9): the editor used to be welded onto the bottom
// of the Titanium day page — a whole second, pre-Titanium screen (⠿ handles, 🔥, the
// English tier words, `HETI SZETEK`, `CSÚCSHÉT · IDŐBECSLÉS`, `STRUKTÚRA`, a duplicate
// exercise list and a duplicate add-CTA) scrolling below the poster. The day page is
// now only the day page; the editing it used to carry lives HERE, one tap away, the
// same way the TEMPLATE's day plan is edited on its own route (MesoTemplateEditorPage,
// /train/mesocycles/templates/:id). Nothing was deleted: this page renders the very
// same `MesoExercises` — the component that owns the PUT …/days/{dayId}/exercises save
// path — so add/remove/reorder/rep-range/RIR/kg all behave exactly as before.
//
// `?add=1` opens the exercise picker on arrival: the day page's end-of-screen
// „＋ Gyakorlat hozzáadása" (the prototype's `.pl-add`) lands here with it, so the
// button still does what it says rather than dropping the user in a form.
// ============================================================
import { useParams, useSearchParams } from 'react-router-dom'
import { useTrain, useTimingProfile } from '@/data/hooks'
import { useBackNav } from '@/shared/hooks/useBackNav'
import { GhostState } from '@/shared/ui/GhostState'
import { MozaikPage, PageBody, PageHead, type PageTone } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { MesoExercises } from '@/features/train/components/MesoExercises'
import { Skeleton } from '@/shared/ui/Skeleton'
import { dayTileData } from '@/features/train/wizard/dayTiles'

const TONE: Record<string, PageTone> = { coral: 'coral', sage: 'sage', rose: 'rose', gold: 'gold' }

export function MesoDayEditPage() {
  const { id, day: dayParam } = useParams<{ id: string; day: string }>()
  const [params] = useSearchParams()
  const dayPath = `/train/mesocycles/${id}/days/${encodeURIComponent(dayParam ?? '')}`
  const goBack = useBackNav(dayPath)
  const { mesocycles, workoutPending } = useTrain()
  const { data: timingProfile, isPending: timingProfilePending } = useTimingProfile()

  const meso = mesocycles.find((m) => m.id === id)
  const day = meso?.days?.find((d) => d.day === dayParam)

  // Real mode: the block list is still in flight — wait, do not accuse the link.
  if (workoutPending) {
    return (
      <div role="status" aria-label="Betöltés…" className="col gap-sm" style={{ padding: '58px 24px 24px' }}>
        <Skeleton width={180} height={12} />
        <Skeleton height={120} />
        {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} variant="card" height={64} />)}
      </div>
    )
  }

  if (!meso || !day) {
    return (
      <MozaikPage tone="coral">
        <PageHead glass onBack={goBack} label="A nap" />
        <PageBody className="tv-dayedit">
          <GhostState message={meso ? 'Ez a nap nincs a tervedben.' : 'Ez a mesociklus nem található.'} />
        </PageBody>
      </MozaikPage>
    )
  }

  return (
    <MozaikPage tone={TONE[dayTileData(day).tone]}>
      <PageHead glass onBack={goBack} label="A nap" />
      <EntranceGroup>
        <div className="mz-eyebrow rise" style={{ padding: '14px 24px 0' }}>
          {day.day.toUpperCase()} · {day.type} · A NAP SZERKESZTÉSE
        </div>
        <MesoExercises
          meso={meso}
          day={day.day}
          autoAdd={params.get('add') === '1'}
          timingProfile={timingProfile}
          timingProfilePending={timingProfilePending}
        />
      </EntranceGroup>
    </MozaikPage>
  )
}

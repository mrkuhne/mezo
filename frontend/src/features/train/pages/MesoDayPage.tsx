// ============================================================
// Mezo · MesoDayPage — ONE day of the running block, on its own route
// (/train/mesocycles/:id/days/:day — the day token is URL-encoded, e.g. H%C3%A9t).
// Mesocycle pages v2 (mezo-d20.15): the run page is status-first and editing lives
// one level down, so a tap on a day tile lands HERE. Source of truth is the
// prototype's #page-day in its RUN flavour (meso-body.html): tone by day type,
// „‹ A blokkod", hero = day letter + „{típus} nap" + the day's numbers, per-muscle
// stat cells, then the familiar exercise editor for that ONE day.
// The editor itself is `MesoExercises` with its `day` prop — the same component that
// owns the PUT …/days/{dayId}/exercises save path, not a second editor (which would
// drift). Its week-scope derivations still read the whole week (see MesoExercises).
// A real ROUTE, not page state: a day is a place you can link to, come back to and
// hit back out of — the wizard's ProgramDayView is page state because its draft is
// not saved anywhere yet; this one edits a persisted run.
// ============================================================
import { useParams } from 'react-router-dom'
import { useTrain } from '@/data/hooks'
import { useBackNav } from '@/shared/hooks/useBackNav'
import { GhostState } from '@/shared/ui/GhostState'
import { Skeleton } from '@/shared/ui/Skeleton'
import { MozaikPage, PageBody, PageHead, PageHero, StatCell, StatStrip, type PageTone } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { MesoExercises } from '@/features/train/components/MesoExercises'
import { dayTileData } from '@/features/train/wizard/dayTiles'

const TONE: Record<string, PageTone> = { coral: 'coral', sage: 'sage', rose: 'rose', gold: 'gold' }

/** Same shape as the sibling week/muscle pages' skeletons — real mode has no block until the
 *  list query lands, and a ghost („nincs a blokkban") shown in that window would call every
 *  valid deep link a dead one for a beat. */
function DaySkeleton() {
  return (
    <div role="status" aria-label="Betöltés…" style={{ padding: '12px 24px' }}>
      <Skeleton width={90} height={12} />
      <Skeleton width={130} height={40} style={{ marginTop: 10 }} />
      <div className="col gap-sm mt-lg">
        {Array.from({ length: 3 }, (_, i) => <Skeleton key={i} variant="card" height={92} />)}
      </div>
    </div>
  )
}

export function MesoDayPage() {
  const { id, day: dayParam } = useParams<{ id: string; day: string }>()
  const goBack = useBackNav(`/train/mesocycles/${id}`)
  const { mesocycles, workoutPending } = useTrain()

  const meso = mesocycles.find((m) => m.id === id)
  const day = meso?.days?.find((d) => d.day === dayParam)

  // Real mode: the block list is still in flight — wait, do not accuse the link.
  if (workoutPending) return <DaySkeleton />

  // A RESOLVED block without this day is a dead link, and says so instead of rendering an
  // empty editor.
  if (!meso || !day) {
    return (
      <MozaikPage tone="coral">
        <PageHead onBack={goBack} label="‹ A blokkod" />
        <PageBody>
          <GhostState message={meso ? 'Ez a nap nincs a blokkban.' : 'Ez a mesociklus nem található.'} />
        </PageBody>
      </MozaikPage>
    )
  }

  const tile = dayTileData(day)

  return (
    <MozaikPage tone={TONE[tile.tone]}>
      <PageHead onBack={goBack} label="‹ A blokkod" />
      <EntranceGroup>
        <PageHero
          icon="i-edzes"
          big={day.day}
          name={`${day.type} nap`}
          sub={`${tile.sets} szett · ~${tile.minutes} perc · ${meso.currentWeek}. hét · a szerkesztés a következő edzéstől él`}
        />
        <PageBody>
          {tile.muscles.length > 0 && (
            <div className="rise" style={{ marginBottom: 11 }}>
              <StatStrip>
                {tile.muscles.map((m) => (
                  <StatCell key={m.label} value={m.sets} label={m.label} over={m.over} />
                ))}
              </StatStrip>
            </div>
          )}
          <MesoExercises meso={meso} day={day.day} />
        </PageBody>
      </EntranceGroup>
    </MozaikPage>
  )
}

import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { MozaikPage, PageBody, PageHead, PageHero } from '@/shared/ui/mozaik'
import { deriveWeekTitle } from '@/data/fuel/fuelWeekHooks'
import { resolveWeekStart, weekHubPath } from '@/features/me/logic/weekNav'

/** Decisions live in one inbox; the weekly entry retains the week being reviewed. */
export function WeekLessonsPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const start = resolveWeekStart(params.get('start'))
  return <MozaikPage tone="gold">
    <PageHead label="‹ Heti" onBack={() => navigate(weekHubPath(start))} />
    <PageHero icon="i-kristaly" name="A hét tanulságai" sub={deriveWeekTitle(start)} />
    <PageBody><div className="mz-qcard col gap-md">
      <p>A heti felismerésekről a Tudástár közös postaládájában dönthetsz. Ott pontosíthatod, elfogadhatod vagy elvetheted a javaslatokat.</p>
      <Link className="mz-decbtn" to={`/mezo/knowledge?start=${start}`}>Tudástár postaládája →</Link>
      <Link to={weekHubPath(start)}>Vissza a heti értékeléshez →</Link>
    </div></PageBody>
  </MozaikPage>
}

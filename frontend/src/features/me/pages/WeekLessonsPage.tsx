import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { MozaikPage, PageBody, PageHead, PageHero } from '@/shared/ui/mozaik'
import { deriveWeekTitle } from '@/data/fuel/fuelWeekHooks'
import { resolveWeekStart, weekHubPath } from '@/features/me/logic/weekNav'

/** Decisions live in one inbox; the weekly entry retains the week being reviewed.
 *  Üveg (mezo-me75u.6, prototype uveg-en-body.html `tanulsagok()`): the t-gem halo hero and
 *  ONE gold glass card; the inbox link is the lit pill, the way back a flat one. */
export function WeekLessonsPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const start = resolveWeekStart(params.get('start'))
  return <MozaikPage tone="gold" className="wkt-page">
    <PageHead glass label="Heti" onBack={() => navigate(weekHubPath(start))} />
    <PageHero art="t-gem" accent="var(--dv-amber)" name="A hét tanulságai" sub={deriveWeekTitle(start)} />
    <PageBody><div className="mz-qcard wkt-card glass col gap-md">
      <p>A heti felismerésekről a Rólad oldal közös postaládájában dönthetsz. Ott pontosíthatod, elfogadhatod vagy elvetheted a javaslatokat.</p>
      <div className="wkt-links">
        <Link className="mz-decbtn wkt-link is-lit" to={`/mezo/rolad?start=${start}`}>Rólad postaládája →</Link>
        <Link className="wkt-link" to={weekHubPath(start)}>Vissza a heti értékeléshez →</Link>
      </div>
    </div></PageBody>
  </MozaikPage>
}

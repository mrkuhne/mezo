// The loading face of FuelRecipesPage (mezo-f2z; Folyadék mezo-n4wf5.5, fuel.js `receptek.tolt`): the page's own
// hero with three empty levels where the most-eaten recipes will stand, and the sentence that says what is happening.
import { useM } from '@/shared/i18n'
import { Hero, Level, Page } from '@/shared/ui/folyadek'

export default function RecipesSkeleton() {
  const M = useM()
  const L = M.fuelRecept.list
  return (
    <Page className="fc-page" role="status" aria-label={M.kit.loading}>
      <Hero className="fc-ghero" label={L.heroLabel} verdict={L.loadingVerdict} sub={L.loadingSub}>
        <div className="fc-top" aria-hidden="true">
          {[0, 1, 2].map(i => <span key={i} className="fc-sk"><Level pct={0} height={14} /></span>)}
        </div>
      </Hero>
    </Page>
  )
}

// Loading face of ExercisesPage in the shape of the page (Folyadék, mezo-n4wf5.3 — prototype
// vilagos/edzes.js `exercises('tolt')`): the hero, the search card, then list rows.
import { Page, Skel } from '@/shared/ui/folyadek'

export default function ExercisesSkeleton() {
  return <Page className="er-page"><Skel blocks={[210, 110, 64, 64, 64, 64]} /></Page>
}

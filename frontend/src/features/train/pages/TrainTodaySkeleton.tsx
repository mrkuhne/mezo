// Loading face of TrainTodayPage (mezo-f2z). Folyadék (mezo-n4wf5.3, prototype vilagos/edzes.js
// `mai('tolt')` → `skel(T0, [62, 340, 140, 200])`): quiet blocks in the page's own shape — the day
// strip, the hero, the „Mielőtt elkezded" card and one section card — so the swap to real content
// does not jump.
import { Page, Skel } from '@/shared/ui/folyadek'

export default function TrainTodaySkeleton() {
  return (
    <Page className="em-page em-sk">
      <Skel blocks={[62, 340, 140, 200]} />
    </Page>
  )
}

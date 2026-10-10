// Loading face of MesoTervPage (Folyadék F3, mezo-n4wf5.3; prototype vilagos/edzes.js `terv('tolt')`):
// the kit's skeleton in the shape of the page — the hero vessel, the week list, the two cards.
import { Page, Skel } from '@/shared/ui/folyadek'

/** Block heights in px: hero · the week list (two blocks) · the cards. */
export const TERV_SKELETON_BLOCKS = [330, 170, 170, 120]

export default function MesoTervSkeleton() {
  return <Page className="ep-page"><Skel blocks={TERV_SKELETON_BLOCKS} /></Page>
}

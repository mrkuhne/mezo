// Loading face of MesoFutamokPage („Lezárt futamaid"; Folyadék F3, mezo-n4wf5.3 — prototype
// vilagos/edzes.js `futamok('tolt')`): the kit's skeleton in the shape of the page — the hero
// and three closed runs.
import { Page, Skel } from '@/shared/ui/folyadek'

/** Block heights in px: hero · three closed runs. */
export const FUTAMOK_SKELETON_BLOCKS = [260, 130, 130, 130]

export default function MesoFutamokSkeleton() {
  return <Page className="ep-page"><Skel blocks={FUTAMOK_SKELETON_BLOCKS} /></Page>
}

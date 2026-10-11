// Loading face of the plan library (`MesoKonyvtarPage`; Folyadék F3, mezo-n4wf5.3 — prototype
// vilagos/edzes.js `konyvtar('tolt')`): the kit's skeleton in the shape of the page — the hero,
// „Most fut", „Következnek", „A polcod".
import { Page, Skel } from '@/shared/ui/folyadek'

/** Block heights in px: hero · the running plan · the coming ones · the shelf. */
export const KONYVTAR_SKELETON_BLOCKS = [280, 90, 170, 120]

export default function MesocycleSkeleton() {
  return <Page className="ep-page"><Skel blocks={KONYVTAR_SKELETON_BLOCKS} /></Page>
}

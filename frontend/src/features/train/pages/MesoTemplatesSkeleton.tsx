// Loading face of MesoTemplatesPage in the shape of the page (Folyadék, mezo-n4wf5.3 — prototype
// vilagos/edzes.js `sablonok('tolt')`): the hero, then three template blocks.
import { Page, Skel } from '@/shared/ui/folyadek'

export default function MesoTemplatesSkeleton() {
  return <Page className="er-page"><Skel blocks={[230, 170, 170, 170]} /></Page>
}

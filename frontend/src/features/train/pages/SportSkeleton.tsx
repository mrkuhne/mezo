// Loading face of SportPage (mezo-f2z). Folyadék (mezo-n4wf5.3, prototype vilagos/edzes.js
// `sport('tolt')` → `skel(T0, [300, 60, 330])`): the page's own shape as three quiet blocks —
// the hero, the segmented control, the first card — so the swap to real content does not reflow.
import { FrameBack, Page, Skel } from '@/shared/ui/folyadek'

export default function SportSkeleton() {
  return (
    <Page className="es-page">
      <FrameBack history fallback="/train" className="es-back">‹ Edzés</FrameBack>
      <Skel blocks={[300, 60, 330]} />
    </Page>
  )
}

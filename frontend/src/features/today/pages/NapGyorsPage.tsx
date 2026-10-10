// ============================================================
// Mezo · NapGyorsPage — the quick-log grid as its own full page (mezo-mhum)
// The FAB's destination FROM /nap exactly: instead of opening the `QuickInputSheet` modal over
// the hub, the FAB navigates here. Reuses the SAME `QuickLogSurface` the sheet renders
// (`variant="page"`) — the tiles and the phase-swap sub-sheets are all shared, not
// re-implemented.
// Folyadék (mezo-n4wf5.2, prototype `vilagos/nap.js` `gyors()`): the title bar is the shell's
// („Gyors logolás" · „Nap · új bejegyzés"); the page is one vessel and a note. Back is plain
// history, handed to the frame — the page draws its own link only where no title bar is mounted.
// ============================================================
import { useNavigate } from 'react-router-dom'
import { QuickLogSurface } from '@/features/quickinput/QuickLogSurface'
import { FrameBack, Page, useFrameTitle } from '@/shared/ui/folyadek'

export function NapGyorsPage() {
  const navigate = useNavigate()
  useFrameTitle({ title: 'Gyors logolás', eyebrow: 'Nap · új bejegyzés' })
  return (
    <Page>
      <FrameBack history className="fo-lk nqk-back" onBack={() => navigate(-1)}>
        ‹ Ma
      </FrameBack>
      <QuickLogSurface variant="page" onDone={() => navigate(-1)} />
    </Page>
  )
}

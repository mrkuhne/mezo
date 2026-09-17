// ============================================================
// Mezo · NapGyorsPage — the quick-log grid as its own full page (mezo-mhum)
// The FAB's Titanium destination FROM /nap exactly: instead of opening the
// `QuickInputSheet` modal over the hub, the FAB navigates here so the launcher
// gets the full Huawei tile→page treatment (Titanium rebuild). Reuses the SAME
// `QuickLogSurface` the sheet renders (`variant="page"`) — the grid, the
// sublines, the phase-swap sub-sheets are all shared, not re-implemented.
// ============================================================
import { useNavigate } from 'react-router-dom'
import { MozaikPage, PageHead, PageBody } from '@/shared/ui/mozaik'
import { QuickLogSurface } from '@/features/quickinput/QuickLogSurface'

export function NapGyorsPage() {
  const navigate = useNavigate()
  return (
    <MozaikPage tone="coral">
      <PageHead onBack={() => navigate(-1)} label="‹ Ma" />
      <PageBody>
        <QuickLogSurface variant="page" onDone={() => navigate(-1)} />
      </PageBody>
    </MozaikPage>
  )
}

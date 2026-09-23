// ============================================================
// Mezo · NapGyorsPage — the quick-log grid as its own full page (mezo-mhum)
// The FAB's destination FROM /nap exactly: instead of opening the `QuickInputSheet` modal over
// the hub, the FAB navigates here. Reuses the SAME `QuickLogSurface` the sheet renders
// (`variant="page"`) — the grid, the sublines, the phase-swap sub-sheets are all shared, not
// re-implemented.
// Üveg (mezo-me75u.3, prototypes/src/uveg-nap-body.html `gyors()`): the page lets the aurora
// through (`.nap-gyors`), the back pill is a neutral glass pill (the prototype `back()`); it is
// the house `PageHead` markup with the glass class added, same aria-label and label.
// ============================================================
import { useNavigate } from 'react-router-dom'
import { MozaikPage, PageBody } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { QuickLogSurface } from '@/features/quickinput/QuickLogSurface'

export function NapGyorsPage() {
  const navigate = useNavigate()
  return (
    <MozaikPage tone="coral" className="nap-gyors">
      <div className="mz-page-head">
        <button type="button" className="mz-backbtn glass is-still" onClick={() => navigate(-1)} aria-label="Vissza">
          ‹ Ma
        </button>
      </div>
      <PageBody>
        <EntranceGroup>
          <QuickLogSurface variant="page" onDone={() => navigate(-1)} />
        </EntranceGroup>
      </PageBody>
    </MozaikPage>
  )
}

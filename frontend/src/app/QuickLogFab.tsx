import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { QuickInputSheet } from '@/features/quickinput/sheets/QuickInputSheet'

// Design 2.0 decision B (mezo-d20.1.1): the quick log lives on a floating coral FAB
// bottom-right — the thumb zone on every tab. The sheet's flat 3×3 tile grid is
// mezo-7lst. From /nap EXACTLY the FAB instead navigates to the full-page Titanium
// picker (mezo-mhum) — everywhere else (including /nap's own subpages) it still opens
// the modal sheet, since only the Nap hub itself gets the Huawei tile→page treatment.
export function QuickLogFab() {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const onNapHub = location.pathname === '/nap'
  return (
    <>
      <button
        type="button"
        className="quicklog-fab np-press"
        aria-label="Gyors logolás"
        onClick={() => (onNapHub ? navigate('/nap/gyors') : setOpen(true))}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
      {open && <QuickInputSheet onClose={() => setOpen(false)} />}
    </>
  )
}

import { useState } from 'react'
import { QuickInputSheet } from '@/features/quickinput/sheets/QuickInputSheet'

// Design 2.0 decision B (mezo-d20.1.1): the quick log lives on a floating coral FAB
// bottom-right — the thumb zone on every tab. The sheet's flat 3×3 tile grid is
// mezo-7lst.
export function QuickLogFab() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        className="quicklog-fab np-press"
        aria-label="Gyors logolás"
        onClick={() => setOpen(true)}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
      {open && <QuickInputSheet onClose={() => setOpen(false)} />}
    </>
  )
}

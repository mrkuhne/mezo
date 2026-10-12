// ============================================================
// Mezo · LogFlowPage (the unified logging flow — bd mezo-d20.4.2, thinned in mezo-byo1)
// The full-page overlay wrapper around MealComposer: portal into `.phone-screen`
// (the LevelUpScreen technique, z-index between the tab bar and the sheets it
// hosts), Escape-to-close. Folyadék (mezo-n4wf5.5, prototype fuel.js `log.kamra-<id>` /
// `log.recept-<id>`): the overlay draws the title bar's sub-page row itself (`TitleRow`: round
// back, „Logolás · ma · HH:mm", `Mit ettél?`), the composer is the page under it.
//
// Since mezo-byo1 the editor body lives in
// `features/fuel/components/MealComposer.tsx` so the /fuel/log window blocks can
// mount the SAME composer in place (expand-in-block, window slotKey fixed per
// mezo-bnsf). This wrapper keeps serving the other entry points unchanged:
// KamraItemDetailPage, RecipeDetailPage, EletjelPage, NapRutinPage — its public
// props are untouched.
// ============================================================
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { MealSlot } from '@/data/types'
import { useM } from '@/shared/i18n'
import { TitleRow } from '@/shared/ui/folyadek'
import { MealComposer, type MealComposerPrefill } from '@/features/fuel/components/MealComposer'

export type LogFlowPrefill = MealComposerPrefill

/** The clock of the moment the overlay opened — 24-hour in both languages. */
const nowHHmm = () => {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export interface LogFlowPageProps {
  /** The launching window's own slotKey (mezo-bnsf) — omit only for out-of-window launches,
   *  which fall back to the wall-clock default. */
  initialSlot?: MealSlot
  prefill?: LogFlowPrefill
  /** Opens the ✨ AI panel expanded on mount (the per-window "AI" action, mezo-53su). */
  aiPanelOpenOnMount?: boolean
  onClose: () => void
}

export function LogFlowPage({ initialSlot, prefill, aiPanelOpenOnMount, onClose }: LogFlowPageProps) {
  const M = useM()
  const P = M.fuelLog.page
  const [target] = useState<Element>(() => document.querySelector('.phone-screen') ?? document.body)
  const [openedAt] = useState(nowHHmm)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const body = (
    <div className="fg-flow" role="dialog" aria-modal="true" aria-label={P.whatAte}>
      <MealComposer
        nonav
        head={<TitleRow context={P.eyebrowNow(P.log, P.today, openedAt)} title={P.whatAte} backLabel={P.back} onBack={onClose} />}
        initialSlot={initialSlot}
        prefill={prefill}
        aiPanelOpenOnMount={aiPanelOpenOnMount}
        onSaved={onClose}
        onCancel={onClose}
      />
    </div>
  )

  return createPortal(body, target)
}

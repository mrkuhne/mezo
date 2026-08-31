// ============================================================
// Mezo · LogFlowPage (the unified logging flow — bd mezo-d20.4.2, thinned in mezo-byo1)
// The full-page overlay wrapper around MealComposer: portal into `.phone-screen`
// (the LevelUpScreen technique, z-index between the tab bar and the sheets it
// hosts), `‹ Vissza` header + timestamp, `Mit ettél?` title, Escape-to-close.
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
import { MealComposer, type MealComposerPrefill } from '@/features/fuel/components/MealComposer'

export type LogFlowPrefill = MealComposerPrefill

function nowLabel(): string {
  return 'ma · ' + new Date().toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' })
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
  const [target] = useState<Element>(() => document.querySelector('.phone-screen') ?? document.body)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const body = (
    <div className="logflow-page" role="dialog" aria-modal="true" aria-label="Mit ettél?">
      <div className="logflow-head">
        <button type="button" className="chip logflow-back" onClick={onClose} aria-label="Vissza">‹ Vissza</button>
        <span className="logflow-time">{nowLabel()}</span>
      </div>
      <div className="logflow-body">
        <div className="h-display size-md" style={{ marginBottom: 2 }}>Mit ettél?</div>
        <MealComposer
          initialSlot={initialSlot}
          prefill={prefill}
          aiPanelOpenOnMount={aiPanelOpenOnMount}
          onSaved={onClose}
          onCancel={onClose}
        />
      </div>
    </div>
  )

  return createPortal(body, target)
}

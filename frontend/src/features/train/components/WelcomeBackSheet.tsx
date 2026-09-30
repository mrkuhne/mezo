import { Sheet } from '@/shared/ui/Sheet'
import { SheetHead } from '@/shared/ui/SheetHead'
import { Icon3D } from '@/shared/ui/clay'
import type { RecoveryReturn } from '@/data/train/recoveryApi'
import { returnCopy } from '@/features/train/logic/recovery'
import { KIMELO } from '@/features/train/logic/skipCopy'

/**
 * „Üdv újra!" (Kímélő mód S2, mezo-q4xt2.2 — prototype elo/edzes.html `udvSheet()`): after
 * „Jobban vagyok" the server has ended the period and applied its return rule; this says what
 * happens next, from the server's own `return` — the calendar line, how the first session(s) are
 * lightened, the first run's half length. „Rendben" closes; the quiet „Mégsem vagyok jól" reopens
 * the period. The prototype's rule tabs („PRÓBÁLD KI") are a demo only and are not built.
 */
export function WelcomeBackSheet({ ret, week, showRun = true, busy, onClose, onOk, onUndo }: {
  ret: RecoveryReturn
  /** The meso week the user continues with (the active meso's current week after the shift). */
  week?: number | null
  /** The run line — only when a running plan exists. */
  showRun?: boolean
  busy?: boolean
  onClose(): void
  /** „Rendben" — the sheet closes itself afterwards. */
  onOk(): void
  /** „Mégsem vagyok jól" — the caller closes the sheet once the undo succeeds. */
  onUndo(): void
}) {
  const c = returnCopy(ret, { week })
  return (
    <Sheet glass onClose={onClose} labelledBy="udv-title" className="trm-udvsheet">
      {(close) => (
        <div className="uvl-body">
          <SheetHead icon="t-sprout" eyebrow="KÍMÉLŐ MÓD VÉGE" title="Üdv újra!" titleId="udv-title"
            sub="Így folytatjuk — a terv magától igazodik." onClose={close} />
          <div className="trm-udvl">
            <div className="trm-whynote"><Icon3D name="t-calendar" size={22} /><span><b>{c.headline}</b> · {c.program}</span></div>
            <div className="trm-whynote"><Icon3D name="t-dumbbell" size={22} /><span>{c.ramp}</span></div>
            {showRun && <div className="trm-whynote"><Icon3D name="t-run" size={22} /><span>{KIMELO.welcomeRun}</span></div>}
          </div>
          <div className="uvl-foot">
            <button type="button" className="uvl-ghost" disabled={busy} onClick={onUndo}>Mégsem vagyok jól</button>
            <button type="button" className="uvl-cta" disabled={busy} onClick={() => { onOk(); close() }}>
              <Icon3D name="t-tick" size={20} />Rendben
            </button>
          </div>
        </div>
      )}
    </Sheet>
  )
}

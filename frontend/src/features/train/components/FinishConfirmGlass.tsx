// ============================================================
// Mezo · FinishConfirmGlass (mezo-88iwa.7, T6 Task 6) — "closing with unticked sets is
// allowed, but never silently". Ported 1:1 from the prototype's `confirmGlass()` (docs/
// design_2.0/prototypes/companion-titanium/session.js:249-265): a GlassBox surface that
// names exactly which sets are about to become "kihagyott" (skipped) and by how much,
// then asks for one deliberate tap before finishing goes through.
//
// Opened by the finish CTA / the dock's "Lezárás →" whenever pending sets remain; a zero-
// pending finish (the CTA's `full` state) skips this glass entirely and finishes right
// away — see ActiveWorkoutPage. `onConfirm` runs the EXISTING `finishAndCelebrate` path.
// ============================================================
import { GlassBox } from '@/shared/ui/mozaik/GlassBox'
import { Icon } from '@/shared/ui/Icon'
import { MuscleChip } from '@/features/train/components/MuscleChip'

export interface FinishConfirmPendingRow {
  id: string
  name: string
  muscle: string
  /** Unlogged slots left on this exercise. */
  left: number
}

export interface FinishConfirmGlassProps {
  open: boolean
  onClose: () => void
  /** Total sets already logged this session (session-wide, across every exercise). */
  loggedCount: number
  /** One row per non-skipped exercise that still has slots left, in session order. */
  pending: FinishConfirmPendingRow[]
  /** Sum of every row's `left` — the headline's count. */
  pendingTotal: number
  /** The finish POST is in flight — disables the primary CTA (mirrors the dock/finish CTA). */
  finishPending: boolean
  /** "Befejezem így" / "Kihagyom a mai edzést" — fires the EXISTING finishAndCelebrate path. */
  onConfirm: () => void
}

export function FinishConfirmGlass({
  open, onClose, loggedCount, pending, pendingTotal, finishPending, onConfirm,
}: FinishConfirmGlassProps) {
  const zero = loggedCount === 0
  return (
    <GlassBox open={open} onClose={onClose} label="Lezárás megerősítése" tint="#d9c395">
      <span className="wo-confirm-art">
        <Icon name="x" size={54} />
      </span>
      <h2>{zero ? 'Egy szettet sem rögzítettél ma.' : `Van még ${pendingTotal} bepipálatlan szetted.`}</h2>
      <p>
        Ha most befejezed az edzést, {zero ? (
          <>a mai edzés egésze <strong>kihagyott</strong> lesz. Ez is része a ritmusnak — a terv megvár.</>
        ) : (
          <>ezek <strong>kihagyott</strong> státusszal rögzülnek. A már elmentett {loggedCount} szetted természetesen megmarad.</>
        )}
      </p>
      <div className="wo-confirm-list">
        {pending.map((row) => (
          <span key={row.id}>
            <MuscleChip token={row.muscle} size={24} />
            <strong>{row.name}</strong>
            <b>{row.left} szett</b>
          </span>
        ))}
      </div>
      <button type="button" className="wo-close-cta" disabled={finishPending} onClick={onConfirm}>
        <span className="wo-close-art">
          <Icon name="check" size={34} />
        </span>
        <span>
          <strong>{zero ? 'Kihagyom a mai edzést' : 'Befejezem így'}</strong>
          <small>{loggedCount} elvégzett · {pendingTotal} kihagyott</small>
        </span>
        <u className="chip-sheen" />
      </button>
      <button type="button" className="wo-secondary" onClick={onClose}>
        Mégse, visszamegyek
      </button>
    </GlassBox>
  )
}

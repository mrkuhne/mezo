// ============================================================
// Mezo · FinishConfirmGlass — „closing with unticked sets is allowed, but never silently".
//
// Opened by the finish button / the dock's „Lezárás" whenever pending sets remain; a zero-pending finish skips
// it and finishes right away (see ActiveWorkoutPage). It names exactly which sets are about to become
// „kihagyott" and by how much, then asks for one deliberate tap. `onConfirm` runs the EXISTING
// `finishAndCelebrate` path.
//
// Folyadék F4 (mezo-n4wf5.4, area C): a light sheet built to the prototype's `fin` sheet
// (docs/design_2.0/prototypes/vilagos/edzes.js): the headline, the consequence, one row per exercise with its
// sets as capsules (the empty ones are what stays out), a calm note, ONE primary carrying the tally on its
// second line, and „Mégse, visszamegyek" as the link under it.
// ============================================================
import { Mchp, deepMuscle } from '@/features/train/components/folyadek'
import { Acts, Btn, Caps, FoSheetHead, Lk, Note, Row } from '@/shared/ui/folyadek'
import { Sheet } from '@/shared/ui/Sheet'

export interface FinishConfirmPendingRow {
  id: string
  name: string
  muscle: string
  /** Unlogged slots left on this exercise. */
  left: number
  /** Every slot of this exercise today (logged + left) — the row's capsules. Optional: without it the row
   *  draws only the `left` empty ones. */
  total?: number
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
  /** The finish POST is in flight — disables the primary button (mirrors the dock / finish button). */
  finishPending: boolean
  /** „Befejezem így" / „Kihagyom a mai edzést" — fires the EXISTING finishAndCelebrate path. */
  onConfirm: () => void
}

export function FinishConfirmGlass({
  open, onClose, loggedCount, pending, pendingTotal, finishPending, onConfirm,
}: FinishConfirmGlassProps) {
  if (!open) return null
  const zero = loggedCount === 0
  return (
    <Sheet onClose={onClose} labelledBy="el-finish-title" className="fo-sheet el-sheet">
      {(close) => (
        <>
          <FoSheetHead
            eyebrow="Edzés befejezése" titleId="el-finish-title" onClose={close}
            title={zero ? 'Egy szettet sem rögzítettél ma.' : `Van még ${pendingTotal} bepipálatlan szetted.`}
            sub={zero
              ? 'Ha most befejezed az edzést, a mai edzés egésze kihagyott lesz. Ez is része a ritmusnak — a terv megvár.'
              : `Ha most befejezed az edzést, ezek kihagyott státusszal zárulnak. A már elmentett ${loggedCount} szetted megmarad.`}
          />
          <div className="el-ls el-fin-rows">
            {pending.map((row) => {
              const total = Math.max(row.total ?? row.left, row.left)
              return (
                <Row
                  key={row.id} left={<Mchp muscle={row.muscle} />} title={row.name} sub={`${row.left} szett maradna üresen`}
                  right={<Caps n={total} done={total - row.left} color={deepMuscle(row.muscle)} />}
                />
              )
            })}
          </div>
          <Note>Az üres kapszulák kihagyott státusszal zárulnak — az összegzés nem büntet értük.</Note>
          <Acts>
            <Btn grow className="el-fin-go" disabled={finishPending} onClick={onConfirm}>
              <span>
                {zero ? 'Kihagyom a mai edzést' : 'Befejezem így'}
                <small>{loggedCount} elvégzett · {pendingTotal} kihagyott</small>
              </span>
            </Btn>
          </Acts>
          <Acts><Lk onClick={close}>Mégse, visszamegyek</Lk></Acts>
        </>
      )}
    </Sheet>
  )
}

// ============================================================
// Mezo · MesoCloseSheet (mezo-meyc.2) — the confirm surface for closing a run.
// Closing is not just an archive flag any more: the backend freezes an
// end-of-mesocycle REPORT at this moment, so the sheet says so out loud and
// offers the one thing the report cannot derive — the owner's own verdict.
// The note is optional; confirming posts `{ selfEval }` (or no body at all) to
// .../close and lands on the freshly written report.
// Chrome mirrors MesoStartSheet (mezo-meyc.1), the other run-lifecycle sheet.
// Üveg (U10, mezo-me75u.10): a coral glass sheet, the flag 3D head, a flat note field; the
// „Lezárás" stays the coral OUTLINE, not a lit pill — closing ends the block (bible rule 29).
// ============================================================
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTrain } from '@/data/hooks'
import { Sheet } from '@/shared/ui/Sheet'
import { SheetHead } from '@/shared/ui/SheetHead'
import { Icon3D } from '@/shared/ui/clay'

export function MesoCloseSheet({ mesoId, title, onClose }: {
  mesoId: string
  /** The run's name — quoted in the confirm line so the sheet never closes the wrong block. */
  title: string
  onClose: () => void
}) {
  const navigate = useNavigate()
  const { closeMesocycle } = useTrain()
  const [selfEval, setSelfEval] = useState('')
  const [saving, setSaving] = useState(false)

  return (
    <Sheet glass onClose={onClose} labelledBy="meso-close-title" className="uvl-edzes">
      {(close) => {
        const confirm = () => {
          if (saving) return
          setSaving(true)
          closeMesocycle(mesoId, selfEval.trim() || undefined, {
            onSuccess: () => navigate(`/train/mesocycles/${mesoId}/report`),
            // The QueryClient mutation cache toasts every failed mutation (§7a) — release the
            // button so the sheet stays open and retryable instead of faking a close.
            onError: () => setSaving(false),
          })
        }
        return (
          <div className="uvl-body">
            <SheetHead icon="t-flag" eyebrow="Mesociklus · zárás" title="Futam lezárása" titleId="meso-close-title" onClose={close} />

            <p className="uvl-lead">
              {`A(z) ${title} futam lezárul — a riport a zárás pillanatának állapotát rögzíti.`}
            </p>

            {/* Optional self-eval — the one input the report cannot compute for you */}
            <div className="uvl-field">
              <label className="uvl-flabel" htmlFor="meso-close-selfeval">Saját értékelés</label>
              <textarea
                id="meso-close-selfeval"
                rows={4}
                value={selfEval}
                onChange={(e) => setSelfEval(e.target.value)}
                placeholder="Hogy sikerült a blokk? (opcionális)"
              />
            </div>

            {/* Footer — closing ENDS the block: the confirm keeps the coral warning outline (rule 29) */}
            <div className="uvl-foot">
              <button type="button" className="uvl-ghost" onClick={close}>Mégse</button>
              <button type="button" className="uvl-warn" onClick={confirm} disabled={saving}>
                <Icon3D name="t-tick" size={20} />Lezárás
              </button>
            </div>
          </div>
        )
      }}
    </Sheet>
  )
}

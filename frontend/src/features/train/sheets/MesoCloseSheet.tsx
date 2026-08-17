// ============================================================
// Mezo · MesoCloseSheet (mezo-meyc.2) — the confirm surface for closing a run.
// Closing is not just an archive flag any more: the backend freezes an
// end-of-mesocycle REPORT at this moment, so the sheet says so out loud and
// offers the one thing the report cannot derive — the owner's own verdict.
// The note is optional; confirming posts `{ selfEval }` (or no body at all) to
// .../close and lands on the freshly written report.
// Chrome mirrors MesoStartSheet (mezo-meyc.1), the other run-lifecycle sheet.
// ============================================================
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTrain } from '@/data/hooks'
import { Sheet } from '@/shared/ui/Sheet'
import { Icon } from '@/shared/ui/Icon'
import { CtaPrimary, CtaGhost } from '@/shared/ui/Cta'

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
    <Sheet onClose={onClose} labelledBy="meso-close-title">
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
          <>
            {/* Header */}
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <div className="col">
                <span className="eyebrow brand">Mesociklus · zárás</span>
                <h2 id="meso-close-title" style={{ fontSize: 18, marginTop: 4 }}>Futam lezárása</h2>
              </div>
              <button className="chip" onClick={close} aria-label="Bezárás" style={{ padding: '6px 8px' }}>
                <Icon name="x" size={12} />
              </button>
            </div>

            <div className="col gap-md">
              <span className="text-secondary" style={{ fontSize: 14, lineHeight: 1.5 }}>
                {`A(z) ${title} futam lezárul — a riport a zárás pillanatának állapotát rögzíti.`}
              </span>

              {/* Optional self-eval — the one input the report cannot compute for you */}
              <div className="col gap-sm">
                <label className="shlabel" htmlFor="meso-close-selfeval">Saját értékelés</label>
                <textarea
                  id="meso-close-selfeval"
                  className="shta"
                  rows={4}
                  value={selfEval}
                  onChange={(e) => setSelfEval(e.target.value)}
                  placeholder="Hogy sikerült a blokk? (opcionális)"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="row gap-sm mt-lg">
              <CtaGhost className="flex-1" onClick={close}>Mégse</CtaGhost>
              <CtaPrimary className="flex-1" onClick={confirm} disabled={saving}>
                <Icon name="check" size={14} /> Lezárás
              </CtaPrimary>
            </div>
          </>
        )
      }}
    </Sheet>
  )
}

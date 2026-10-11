// ============================================================
// Mezo · MesoCloseSheet (mezo-meyc.2) — the confirm surface for closing a run.
// Folyadék F3 (mezo-n4wf5.3), prototype vilagos/edzes.js sheet `close`.
// Closing is not just an archive flag: the backend freezes an end-of-plan REPORT at this
// moment, so the sheet says so out loud and offers the one thing the report cannot derive —
// the owner's own verdict. The note is optional; confirming posts `{ selfEval }` (or no body
// at all) to .../close and lands on the freshly written report.
// The weeks of the plan stand as capsules (done · this week half · still to come), so it is
// plain how far in the run is being closed. „Lezárás" is the warning-coloured button:
// closing ENDS the plan. Opened from the Terv landing and the plan's own page.
// ============================================================
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTrain } from '@/data/hooks'
import { Sheet } from '@/shared/ui/Sheet'
import { VoiceField } from '@/shared/ui/voice/VoiceField'
import { appendDictation } from '@/shared/lib/voice/useVoiceInput'
import { Acts, Btn, Caps, FoSheetHead, Lab, Lk, TextArea } from '@/shared/ui/folyadek'

export function MesoCloseSheet({ mesoId, title, onClose }: {
  mesoId: string
  /** The run's name — quoted in the confirm line so the sheet never closes the wrong plan. */
  title: string
  onClose: () => void
}) {
  const navigate = useNavigate()
  const { closeMesocycle, mesocycles } = useTrain()
  const [selfEval, setSelfEval] = useState('')
  const [saving, setSaving] = useState(false)
  const meso = mesocycles.find((m) => m.id === mesoId)

  return (
    <Sheet onClose={onClose} labelledBy="meso-close-title" className="fo-sheet ep-sheet">
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
            <FoSheetHead icon="t-coin" eyebrow="Edzésterv · zárás" title="Futam lezárása" titleId="meso-close-title"
              sub={`A(z) ${title} futam lezárul — a riport a zárás pillanatának állapotát rögzíti.`} onClose={close} />
            {meso && meso.weeks > 0 && (
              <div className="ep-shg">
                <Caps size="big" n={meso.weeks} done={meso.currentWeek - 1} cur={meso.currentWeek - 1}
                  label={`${meso.currentWeek}. hét a ${meso.weeks}-ból`} />
                <small>most a {meso.currentWeek}. hétnél tartasz a {meso.weeks}-ból</small>
              </div>
            )}
            {/* Optional self-eval — the one input the report cannot compute for you */}
            <Lab htmlFor="meso-close-selfeval">Saját értékelés</Lab>
            <VoiceField domain="train" onTranscript={(t) => setSelfEval((d) => appendDictation(d, t))}>
              <TextArea id="meso-close-selfeval" rows={4} value={selfEval} onChange={(e) => setSelfEval(e.target.value)}
                placeholder="Hogy sikerült a terv? (opcionális)" />
            </VoiceField>
            {/* closing ENDS the plan: the confirm wears the warning colour */}
            <Acts>
              <Btn grow bad onClick={confirm} disabled={saving}>Lezárás</Btn>
              <Lk onClick={close}>Mégse</Lk>
            </Acts>
          </>
        )
      }}
    </Sheet>
  )
}

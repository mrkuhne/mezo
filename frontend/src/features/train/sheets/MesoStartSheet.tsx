// ============================================================
// Mezo · MesoStartSheet (mezo-meyc.1) — stamps a RUN from a template.
// Folyadék F3 (mezo-n4wf5.3), prototype vilagos/edzes.js sheet `start`.
// The single start surface: a template's own story page „Futam indítása ebből", the report's
// rerun and a closed run's „Újrafuttatás" (which reruns first, then opens this sheet on the
// returned templateId) all land here. Picks a start date (today by default) and
// active | planned, then fires the one shared POST .../start.
// An active start jumps straight into the gym week; a planned start just closes (the new run
// appears in the library's „Következnek").
// ============================================================
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMesoTemplates } from '@/data/hooks'
import { localDateString } from '@/shared/lib/dates'
import { Sheet } from '@/shared/ui/Sheet'
import { FoSheetHead, Input, Lab, Note, Pill, Pills, SheetActs } from '@/shared/ui/folyadek'

const STATUSES = [
  { id: 'active', label: 'Aktív', hint: 'Most kezdem — a heted ettől a tervtől fut.' },
  { id: 'planned', label: 'Tervezett', hint: 'Csak beütemezem — később aktiválom.' },
] as const

export function MesoStartSheet({ templateId, title, onClose }: {
  templateId: string
  /** The template's name — shown as context under the question. */
  title?: string
  onClose: () => void
}) {
  const navigate = useNavigate()
  const { startTemplate } = useMesoTemplates()
  const [startDate, setStartDate] = useState(localDateString())
  const [status, setStatus] = useState<'active' | 'planned'>('active')
  const [saving, setSaving] = useState(false)

  return (
    <Sheet onClose={onClose} labelledBy="meso-start-title" className="fo-sheet ep-sheet">
      {(close) => {
        const start = () => {
          if (!startDate || saving) return
          setSaving(true)
          startTemplate(templateId, { startDate, status })
            // Active → straight into the gym week; planned → close and stay in the library.
            .then(() => (status === 'active' ? navigate('/train/gym') : close()))
            // The QueryClient mutation cache toasts every failed mutation (§7a) — release the
            // button here so the sheet stays open and retryable instead of faking success.
            .catch(() => setSaving(false))
        }
        return (
          <>
            <FoSheetHead icon="t-play" eyebrow="Edzésterv · indítás" title="Mikor kezdjük?" titleId="meso-start-title"
              sub={title ? title : undefined} onClose={close} />
            <Lab htmlFor="meso-start-date">Kezdés</Lab>
            <Input id="meso-start-date" type="date" aria-label="Kezdés dátuma" value={startDate}
              onChange={(e) => setStartDate(e.target.value)} />
            {/* active | planned */}
            <Lab>Állapot</Lab>
            <Pills role="group" aria-label="Futam állapota">
              {STATUSES.map((s) => (
                <Pill key={s.id} on={status === s.id} onClick={() => setStatus(s.id)}>{s.label}</Pill>
              ))}
            </Pills>
            <Note>{STATUSES.find((s) => s.id === status)?.hint}</Note>
            <SheetActs label="Indítás" onSave={start} onCancel={close} disabled={saving} />
          </>
        )
      }}
    </Sheet>
  )
}

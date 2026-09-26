// ============================================================
// Mezo · MesoStartSheet (mezo-meyc.1) — stamps a RUN from a template.
// The single start surface: a template's own story page „Futam indítása ebből" (T10 Task 3,
// mezo-88iwa.11 — the Sablonok list card lost its own „Indítás" chip when the reface routed
// it to the story page instead) and a closed run's „Újrafuttatás" (which reruns first, then
// opens this sheet on the returned templateId) both land here. Picks a start date (today by
// default) and
// active|planned, then fires the one shared POST .../start.
// Active starts jump straight into the gym week; a planned start just closes
// (the new run appears in the library's Tervezett section).
// Üveg (U10, mezo-me75u.10): a coral glass sheet, the play 3D head (the template's name as the
// sub-line), a flat date field, the status as two flat segment chips (the chosen one lit),
// Mégse flat ghost + the lit coral „Indítás" pill.
// ============================================================
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMesoTemplates } from '@/data/hooks'
import { localDateString } from '@/shared/lib/dates'
import { Sheet } from '@/shared/ui/Sheet'
import { SheetHead } from '@/shared/ui/SheetHead'
import { Icon3D } from '@/shared/ui/clay'
import { cn } from '@/shared/lib/cn'

const STATUSES = [
  { id: 'active', label: 'Aktív', hint: 'Most kezdem — a Gym hete ettől fut.' },
  { id: 'planned', label: 'Tervezett', hint: 'Csak beütemezem — később aktiválom.' },
] as const

export function MesoStartSheet({ templateId, title, onClose }: {
  templateId: string
  /** The template's name — shown as context above the date pick. */
  title?: string
  onClose: () => void
}) {
  const navigate = useNavigate()
  const { startTemplate } = useMesoTemplates()
  const [startDate, setStartDate] = useState(localDateString())
  const [status, setStatus] = useState<'active' | 'planned'>('active')
  const [saving, setSaving] = useState(false)

  return (
    <Sheet glass onClose={onClose} labelledBy="meso-start-title" className="uvl-edzes">
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
          <div className="uvl-body">
            <SheetHead icon="t-play" eyebrow="Mesociklus · indítás" title="Mikor kezdjük?" titleId="meso-start-title"
              sub={title ? title : undefined} onClose={close} />

            {/* Start date */}
            <label className="uvl-field">
              <span className="uvl-flabel">Kezdés</span>
              <input
                type="date"
                aria-label="Kezdés dátuma"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </label>

            {/* active | planned */}
            <div className="uvl-field">
              <span className="uvl-flabel">Állapot</span>
              <div className="uvl-seg" role="group" aria-label="Futam állapota">
                {STATUSES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className={cn('uvl-chip', status === s.id && 'on')}
                    aria-pressed={status === s.id}
                    onClick={() => setStatus(s.id)}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <span className="uvl-hint">{STATUSES.find((s) => s.id === status)?.hint}</span>
            </div>

            {/* Footer */}
            <div className="uvl-foot">
              <button type="button" className="uvl-ghost" onClick={close}>Mégse</button>
              <button type="button" className="uvl-cta" onClick={start} disabled={saving}>
                <Icon3D name="t-tick" size={20} />Indítás
              </button>
            </div>
          </div>
        )
      }}
    </Sheet>
  )
}

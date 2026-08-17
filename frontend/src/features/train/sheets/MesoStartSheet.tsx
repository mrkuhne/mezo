// ============================================================
// Mezo · MesoStartSheet (mezo-meyc.1) — stamps a RUN from a template.
// The single start surface: the Sablonok cards' „Indítás" and a closed run's
// „Újrafuttatás" (which reruns first, then opens this sheet on the returned
// templateId) both land here. Picks a start date (today by default) and
// active|planned, then fires the one shared POST .../start.
// Active starts jump straight into the gym week; a planned start just closes
// (the new run appears in the library's Tervezett section).
// ============================================================
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMesoTemplates } from '@/data/hooks'
import { localDateString } from '@/shared/lib/dates'
import { Sheet } from '@/shared/ui/Sheet'
import { Icon } from '@/shared/ui/Icon'
import { CtaPrimary, CtaGhost } from '@/shared/ui/Cta'

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
    <Sheet onClose={onClose} labelledBy="meso-start-title">
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
            {/* Header */}
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <div className="col">
                <span className="eyebrow brand">Mesociklus · indítás</span>
                <h2 id="meso-start-title" style={{ fontSize: 18, marginTop: 4 }}>Mikor kezdjük?</h2>
                {title ? (
                  <span className="text-secondary" style={{ fontSize: 14, marginTop: 4 }}>{title}</span>
                ) : null}
              </div>
              <button className="chip" onClick={close} aria-label="Bezárás" style={{ padding: '6px 8px' }}>
                <Icon name="x" size={12} />
              </button>
            </div>

            <div className="col gap-md">
              {/* Start date */}
              <div className="col gap-sm">
                <span className="label-mono">Kezdés</span>
                <div className="card row" style={{ padding: '6px 12px', alignItems: 'center' }}>
                  <input
                    type="date"
                    aria-label="Kezdés dátuma"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    style={{ width: '100%', fontSize: 16, color: 'var(--text-primary)', colorScheme: 'dark' }}
                  />
                </div>
              </div>

              {/* active | planned */}
              <div className="col gap-sm">
                <span className="label-mono">Állapot</span>
                <div className="row gap-xs" role="group" aria-label="Futam állapota">
                  {STATUSES.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className="segtab flex-1"
                      aria-pressed={status === s.id}
                      onClick={() => setStatus(s.id)}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
                <span className="text-tertiary" style={{ fontSize: 14, lineHeight: 1.4 }}>
                  {STATUSES.find((s) => s.id === status)?.hint}
                </span>
              </div>
            </div>

            {/* Footer */}
            <div className="row gap-sm mt-lg">
              <CtaGhost className="flex-1" onClick={close}>Mégse</CtaGhost>
              <CtaPrimary className="flex-1" onClick={start} disabled={saving}>
                <Icon name="check" size={14} /> Indítás
              </CtaPrimary>
            </div>
          </>
        )
      }}
    </Sheet>
  )
}

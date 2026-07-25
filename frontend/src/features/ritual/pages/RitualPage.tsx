import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrivalStep } from '@/features/ritual/components/ArrivalStep'
import { ReleaseStep } from '@/features/ritual/components/ReleaseStep'
import { localDateString } from '@/shared/lib/dates'
import { useDayRecap, useRitualDay } from '@/data/hooks'

const ACT_COUNT = 5

/**
 * Full-screen Napzárás flow (/ritual, spec §4, mezo-ilsj) — a 5-act state machine over a
 * forced-dark surface (train/session idiom: AppLayout hides the tab bar for this route).
 * Acts 2-4 (day story, open loops, harvest) are placeholder stubs here — Tasks 4-6 replace
 * them with real components; nothing writes anything before act 4 (the harvest close, Task
 * 6) — the ✕ exit is consequence-free at any point.
 */
export function RitualPage() {
  const navigate = useNavigate()
  const date = localDateString()
  const { data } = useRitualDay(date)
  const { closingNote } = useDayRecap(date)
  const [act, setAct] = useState(1)

  return (
    <div className="rz-screen">
      <div className="rz-top">
        <div className="rz-dots" aria-hidden="true">
          {Array.from({ length: ACT_COUNT }, (_, i) => (
            <span key={i} className={i < act ? 'rz-dot on' : 'rz-dot'} />
          ))}
        </div>
        <button className="rz-exit" aria-label="Kilépés" onClick={() => navigate('/today')}>✕</button>
      </div>

      {act === 1 && <ArrivalStep onNext={() => setAct(2)} />}
      {act === 2 && <div className="rz-act" data-testid="act-2">A napod íve — hamarosan.</div>}
      {act === 3 && <div className="rz-act" data-testid="act-3">Nyitott hurkok — hamarosan.</div>}
      {act === 4 && <div className="rz-act" data-testid="act-4">A mai termés — hamarosan.</div>}
      {act === 5 && (
        <ReleaseStep
          prepStartsAt={data.window.prepStartsAt}
          bedTime={data.window.bedTime}
          closingNote={closingNote}
          onFinish={() => navigate('/today')}
        />
      )}
    </div>
  )
}

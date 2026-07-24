import { useEffect, useState } from 'react'
import { BODY_SCAN_STEP_MS, BODY_SCAN_STEPS } from '@/features/me/logic/nightContent'

/** Head-to-toe body scan: slow auto-advance, tap to step, clamps at the last step (spec D6). */
export function NightBodyScan({ onStop }: { onStop: () => void }) {
  const [idx, setIdx] = useState(0)
  const last = BODY_SCAN_STEPS.length - 1
  useEffect(() => {
    if (idx >= last) return
    const id = setInterval(() => setIdx((i) => Math.min(i + 1, last)), BODY_SCAN_STEP_MS)
    return () => clearInterval(id)
  }, [idx, last])
  const step = BODY_SCAN_STEPS[idx]
  return (
    <div className="ns">
      <div className="night-eye">Testpásztázás</div>
      <button className="ns-card" aria-label="Következő lépés"
        onClick={() => setIdx((i) => Math.min(i + 1, last))}>
        <div className="ns-part">{step.part}</div>
        <div className="ns-tx">{step.text}</div>
      </button>
      <div className="ns-dots" aria-hidden="true">
        {BODY_SCAN_STEPS.map((s, i) => (
          <span key={s.part} className={i === idx ? 'ns-dot on' : 'ns-dot'} />
        ))}
      </div>
      <div className="ns-hint">Magától lép tovább (~40 mp) — koppintásra is léphetsz.</div>
      <button className="night-quiet" onClick={onStop}>megállítom ›</button>
    </div>
  )
}

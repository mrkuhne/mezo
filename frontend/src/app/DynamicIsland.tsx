import { useEffect, useState } from 'react'
import { useLiveActivityOptional } from '@/app/providers/LiveActivityProvider'
import { fmtMMSS } from '@/features/train/logic/restTimer'

const RING_R = 15
const RING_C = 2 * Math.PI * RING_R // ≈ 94.2, matches the mockup

export function DynamicIsland() {
  const activity = useLiveActivityOptional()
  const rest = activity?.rest ?? null
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!rest) return
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(id)
  }, [rest])
  const remaining = rest ? Math.max(0, Math.ceil((rest.endsAt - now) / 1000)) : 0
  useEffect(() => {
    if (rest && remaining === 0) activity?.clearRest()
  }, [rest, remaining, activity])
  if (!rest || remaining === 0) return <div className="dynamic-island" />
  const frac = rest.total > 0 ? remaining / rest.total : 0
  return (
    <button type="button" className="dynamic-island live" aria-label="Pihenő átugrása" onClick={activity?.clearRest}>
      <svg className="ring" width="34" height="34" viewBox="0 0 34 34" aria-hidden="true">
        <circle cx="17" cy="17" r={RING_R} fill="none" stroke="rgba(255,255,255,.14)" strokeWidth="3" />
        <circle
          cx="17" cy="17" r={RING_R} fill="none" stroke="var(--coral)" strokeWidth="3" strokeLinecap="round"
          strokeDasharray={`${RING_C}`} strokeDashoffset={`${RING_C * (1 - frac)}`} transform="rotate(-90 17 17)"
        />
      </svg>
      <div>
        <div className="lt1">Pihenő</div>
        <div className="lt2">{fmtMMSS(remaining)}</div>
      </div>
      {rest.next && (
        <div className="lnext">
          <div className="ln1">Következő</div>
          <div className="ln2">{rest.next}</div>
        </div>
      )}
    </button>
  )
}

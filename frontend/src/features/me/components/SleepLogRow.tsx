import type { CSSProperties } from 'react'
import type { SleepEntry } from '@/data/types'

/** One night of the 7-night log. Üveg (mezo-me75u.6): a FLAT row (never glass — the log is
 *  secondary); a short (< 7 h) or poor (Q ≤ 5) night keeps a coral warning edge. */
export function SleepLogRow({ night }: { night: SleepEntry }) {
  const isLow = night.duration < 7 || night.quality <= 5
  return (
    <div data-sleep-log-row className={isLow ? 'slr is-warn' : 'slr'}>
      <span className="slr-date">{night.date.slice(5).replace('-', '/')}</span>
      <span className="slr-dur">
        <b>
          {night.duration.toFixed(1)}
          <small>h</small>
        </b>
        <small className="slr-span">{night.bedtime} → {night.wakeup}</small>
      </span>
      <span className="slr-q">
        <span className="slr-q-row">
          <span className="slr-q-eb">Q</span>
          <span className="uv-bar slr-bar"><b style={{ '--w': (night.quality / 10) * 100 + '%' } as CSSProperties} /></span>
          <b className="slr-q-num">{night.quality}</b>
        </span>
        {night.notes && <span className="slr-note">"{night.notes}"</span>}
      </span>
    </div>
  )
}

import type { CSSProperties, ReactNode } from 'react'
import { clamp } from './util'

export interface PerDayItem { label: string; pct: number; group: 'a' | 'b'; against?: boolean; value?: ReactNode }

/** Every day of a comparison as its own small vessel. Group a = the warm "worse" colour, group b = the domain colour;
 *  `against` dashes a day that argues against the pattern. */
export function PerDay(p: { days: PerDayItem[] }) {
  return (
    <div className={p.days.length > 14 ? 'fo-perday many' : 'fo-perday'} style={{ gridTemplateColumns: `repeat(${p.days.length},minmax(0,1fr))` }}>
      {p.days.map((d, i) => (
        <span key={i} className={d.against ? 'gv x' : 'gv'} style={{ '--c': d.group === 'b' ? 'var(--dom)' : 'var(--fo-warn)' } as CSSProperties}>
          {d.value != null && <em className="gpd-v">{d.value}</em>}
          <span className="t" style={{ height: 54 }}><i style={{ height: `${clamp(d.pct, 4)}%` }} /></span>
          <small>{d.label}</small>
        </span>
      ))}
    </div>
  )
}

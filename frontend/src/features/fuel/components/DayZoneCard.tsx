import type { CSSProperties, ReactNode } from 'react'
import type { DayZone } from '@/features/fuel/logic/dayZones'

// A napszak zone (mezo-rrtj). The header carries the zone's own kcal + burn balance, which is what
// turns "where did my 3010 kcal go" from a mental sum into something readable. Rows are composed by
// the page (children) so this component stays free of the page's five callbacks.
export function DayZoneCard({
  zone,
  index,
  children,
}: {
  zone: DayZone
  index: number
  children: ReactNode
}) {
  const stateCls = zone.state === 'done' ? ' donez' : zone.state === 'open' ? ' openz' : ''
  const kcalSuffix = zone.state === 'done' ? ' ✓' : zone.state === 'open' ? ' nyitva' : ''
  return (
    <div className={`zcard${stateCls}`} style={{ '--i': index } as CSSProperties}>
      <div className="zh">
        <span className="zn">{zone.label}</span>
        {zone.stackPips.length > 0 && (
          <span className="caps" aria-hidden="true">
            {zone.stackPips.map((on, i) => <i key={i} className={on ? 'on' : undefined} />)}
          </span>
        )}
        {(zone.hasMeals || zone.burnKcal > 0) && (
          <span className="zk">
            {zone.hasMeals && `${zone.kcal} kcal${kcalSuffix}`}
            {zone.hasMeals && zone.burnKcal > 0 && ' · '}
            {zone.burnKcal > 0 && <span className="burn">+{zone.burnKcal}</span>}
          </span>
        )}
      </div>
      {children}
    </div>
  )
}

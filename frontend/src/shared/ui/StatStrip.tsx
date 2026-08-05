import { cn } from '@/shared/lib/cn'

/**
 * The DS StatStrip (design-system-mezo.html §StatStrip): a compact horizontal
 * stat row of equal cells — quick-glance support metrics under a hero, visually
 * thinner than a StatCard on purpose. One cell per entry; 20/700 values over
 * 9/700/0.18em uppercase labels, cells divided by 1px of the divider token.
 * Domain-free: presentation props only.
 */
export interface StatStripCell {
  label: string
  value: string
  unit?: string
}

export function StatStrip({ cells, className }: { cells: StatStripCell[]; className?: string }) {
  if (cells.length === 0) return null
  return (
    <div className={cn('statstrip', className)}>
      {cells.map((c) => (
        <div key={c.label} className="statstrip-c">
          <div className="statstrip-v">
            {c.value}
            {c.unit ? <span className="statstrip-u">{c.unit}</span> : null}
          </div>
          <div className="statstrip-l">{c.label}</div>
        </div>
      ))}
    </div>
  )
}

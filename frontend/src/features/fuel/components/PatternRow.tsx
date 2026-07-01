import { Icon } from '@/shared/ui/Icon'
import type { RecurringPattern } from '@/data/types'

// fuel-plan.jsx PatternRow (390–400)
export function PatternRow({ icon, color, title, detail }: RecurringPattern) {
  return (
    <div className="card notch-4" style={{ padding: 12, borderLeft: '2px solid ' + color }}>
      <div className="row gap-sm" style={{ alignItems: 'flex-start' }}>
        <Icon name={icon} size={12} color={color} />
        <div className="col flex-1">
          <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>
            {title}
          </span>
          <p className="text-secondary mt-xs" style={{ fontSize: 11.5, lineHeight: 1.5 }}>
            {detail}
          </p>
        </div>
      </div>
    </div>
  )
}

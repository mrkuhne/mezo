import { Icon } from '@/components/ui/Icon'
import type { AttentionItem } from '@/data/types'

export function AttentionRow({ item }: { item: AttentionItem }) {
  const isWatch = item.kind === 'watch'
  const color = isWatch ? 'var(--warning)' : 'var(--cat-response)'
  const icon = isWatch ? 'warning' : 'sparkle'
  return (
    <div className="card notch-4" style={{ padding: 12, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 2, background: color }} />
      <div className="row gap-sm" style={{ alignItems: 'flex-start', paddingLeft: 6 }}>
        <Icon name={icon} size={12} color={color} />
        <div className="col flex-1">
          <span style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.45 }}>
            <strong style={{ color, fontWeight: 500 }}>{item.person}</strong> · {item.reason}
          </span>
        </div>
        <Icon name="chevron-right" size={12} color="var(--text-tertiary)" />
      </div>
    </div>
  )
}

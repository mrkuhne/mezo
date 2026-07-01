import type { SupplementStashItem } from '@/data/types'
import { Icon } from '@/shared/ui/Icon'

// fuel-stack.jsx SelectedChip (206–224)
export function SelectedChip({ sup, onRemove }: { sup: SupplementStashItem; onRemove: () => void }) {
  const color = sup.caffeine
    ? 'var(--warning)'
    : sup.type === 'stimulant'
      ? 'var(--cat-tendency)'
      : sup.type === 'medication'
        ? 'var(--error)'
        : 'var(--brand-glow)'
  return (
    <div
      className="row gap-xs"
      style={{
        padding: '5px 8px 5px 10px',
        background: 'color-mix(in srgb, ' + color + ' 6%, transparent)',
        border: '1px solid color-mix(in srgb, ' + color + ' 25%, transparent)',
        alignItems: 'center',
        clipPath: 'polygon(3px 0, 100% 0, 100% calc(100% - 3px), calc(100% - 3px) 100%, 0 100%, 0 3px)',
      }}
    >
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: color }} />
      <span style={{ fontSize: 11, color: 'var(--text-primary)' }}>{sup.name}</span>
      <span className="label-mono text-tertiary" style={{ fontSize: 9 }}>
        {sup.dose}
      </span>
      <button onClick={onRemove} style={{ padding: '2px 4px', color: 'var(--text-tertiary)' }}>
        <Icon name="x" size={9} />
      </button>
    </div>
  )
}

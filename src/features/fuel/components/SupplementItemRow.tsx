import type { SlotItem } from '@/data/types'
import { Icon } from '@/components/ui/Icon'
import { useStack } from '@/data/hooks'

export function SupplementItemRow({ item }: { item: SlotItem }) {
  const sup = useStack().stash.find(s => s.id === item.refId)
  const isCaffeine = sup?.caffeine
  const isStimulant = sup?.type === 'stimulant'

  return (
    <div
      className="row gap-sm"
      style={{
        padding: '8px 10px',
        background: item.done ? 'transparent' : 'var(--surface-2)',
        border: '1px solid ' + (item.primary && !item.done ? 'var(--border-brand)' : 'var(--border-subtle)'),
        alignItems: 'center',
      }}
    >
      <div
        style={{
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: item.done ? 'var(--brand-primary)' : 'transparent',
          border: '1.5px solid ' + (item.done ? 'var(--brand-glow)' : 'var(--border-strong)'),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {item.done && <Icon name="check" size={10} color="var(--text-inverse)" />}
      </div>
      <div className="col flex-1" style={{ minWidth: 0 }}>
        <div className="row gap-xs" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
          <span
            style={{
              fontSize: 13,
              color: 'var(--text-primary)',
              textDecoration: item.done ? 'line-through' : 'none',
              textDecorationColor: 'var(--text-tertiary)',
            }}
          >
            {item.label}
          </span>
          {isCaffeine && (
            <span className="chip" style={{ fontSize: 8, padding: '1px 5px', color: 'var(--warning)', borderColor: 'color-mix(in srgb, var(--warning) 25%, transparent)' }}>
              koffein
            </span>
          )}
          {isStimulant && !isCaffeine && (
            <span className="chip" style={{ fontSize: 8, padding: '1px 5px', color: 'var(--cat-tendency)', borderColor: 'color-mix(in srgb, var(--cat-tendency) 25%, transparent)' }}>
              pörgető
            </span>
          )}
        </div>
        {item.note && (
          <span className="text-tertiary" style={{ fontSize: 10, marginTop: 2, fontStyle: 'italic' }}>
            {item.note}
          </span>
        )}
      </div>
    </div>
  )
}

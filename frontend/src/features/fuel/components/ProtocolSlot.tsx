import type { ProtocolSlotData } from '@/data/types'
import { Icon } from '@/shared/ui/Icon'

// fuel-stack.jsx ProtocolSlot (227–280)
// takenIds + onToggleItem are optional: when omitted (the default presentational usage) the item
// rows render exactly as before; when supplied, each row becomes a tap-to-log/undo button with a
// trailing check when the intake is already logged (mezo-09g).
export function ProtocolSlot({
  slot,
  takenIds,
  onToggleItem,
}: {
  slot: ProtocolSlotData
  takenIds?: Set<string>
  onToggleItem?: (refId: string, taken: boolean) => void
}) {
  return (
    <div
      className="card notch-4"
      style={{
        padding: 0,
        borderColor: slot.primary ? 'var(--border-brand)' : 'var(--border-subtle)',
        background: slot.primary ? 'var(--wash-sage)' : 'var(--surface-1)',
      }}
    >
      <div className="row" style={{ alignItems: 'stretch' }}>
        {/* Time gutter */}
        <div
          className="col"
          style={{
            width: 64,
            padding: '12px 0',
            alignItems: 'center',
            justifyContent: 'center',
            borderRight: '1px solid var(--border-subtle)',
            background: slot.primary ? 'var(--wash-sage)' : 'transparent',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--ff-display)',
              fontSize: 15,
              fontWeight: 600,
              color: slot.primary ? 'var(--sage-deep)' : 'var(--text-primary)',
            }}
          >
            {slot.time}
          </span>
          <span className="label-mono text-tertiary mt-xs" style={{ fontSize: 8 }}>
            {slot.window}
          </span>
        </div>

        {/* Content */}
        <div className="col flex-1" style={{ padding: '12px 14px', minWidth: 0 }}>
          <div className="row gap-xs" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <span
              style={{
                padding: '1px 6px',
                fontSize: 8,
                fontWeight: 600,
                fontFamily: 'var(--ff-mono)',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: slot.kindColor,
                border: '1px solid color-mix(in srgb, ' + slot.kindColor + ' 25%, transparent)',
                background: 'color-mix(in srgb, ' + slot.kindColor + ' 6%, transparent)',
              }}
            >
              {slot.kind}
            </span>
            {slot.relatedTo && (
              <span className="label-mono text-tertiary" style={{ fontSize: 8 }}>
                · {slot.relatedTo}
              </span>
            )}
          </div>

          <div className="col gap-xs mt-sm">
            {slot.items.map((it, i) => {
              const taken = takenIds?.has(it.refId) ?? false
              return (
                <button
                  key={i}
                  type="button"
                  aria-label={`${it.name} bevétel`}
                  onClick={() => onToggleItem?.(it.refId, taken)}
                  className="row gap-xs"
                  style={{
                    alignItems: 'center',
                    width: '100%',
                    padding: 0,
                    margin: 0,
                    background: 'transparent',
                    border: 'none',
                    font: 'inherit',
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: it.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: 'var(--text-primary)', flex: 1 }}>{it.name}</span>
                  <span className="label-mono text-tertiary" style={{ fontSize: 10 }}>
                    {it.dose}
                  </span>
                  {taken && <Icon name="check" size={10} color="var(--sage-deep)" />}
                </button>
              )
            })}
          </div>

          <p
            className="text-secondary mt-sm"
            style={{ fontSize: 11, lineHeight: 1.5, paddingTop: 8, borderTop: '1px solid var(--border-subtle)' }}
          >
            <Icon name="sparkle" size={10} color="var(--sage-deep)" /> {slot.reasoning}
          </p>
        </div>
      </div>
    </div>
  )
}

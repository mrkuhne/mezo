// ============================================================
// Mezo · CompactStepper — tight weight/reps stepper for the active
// logging panel. 44px ± buttons, brand display for the primary (kg)
// stepper, integer-clamped reps. Ported from prototype train.jsx.
// ============================================================
import { Icon } from '@/components/ui/Icon'

export function CompactStepper({
  label,
  value,
  step,
  onChange,
  integer = false,
  primary = false,
}: {
  label: string
  value: number
  step: number
  onChange: (next: number) => void
  integer?: boolean
  primary?: boolean
}) {
  const decrement = () =>
    onChange(integer ? Math.max(0, value - step) : Math.max(0, +(value - step).toFixed(1)))
  const increment = () => onChange(integer ? value + step : +(value + step).toFixed(1))

  return (
    <div
      className="flex-1"
      style={{
        background: 'var(--surface-2)',
        padding: '6px 6px',
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        clipPath:
          'polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)',
      }}
    >
      <button
        type="button"
        aria-label={`${label} csökkentése`}
        onClick={decrement}
        style={{
          width: 44,
          height: 44,
          background: 'var(--surface-1)',
          color: 'var(--brand-glow)',
          border: '1px solid var(--border-strong)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon name="minus" size={14} />
      </button>
      <div style={{ flex: 1, textAlign: 'center' }}>
        <div
          style={{
            fontFamily: 'var(--ff-display)',
            fontSize: 22,
            fontWeight: 600,
            color: primary ? 'var(--brand-glow)' : 'var(--text-primary)',
            lineHeight: 1,
          }}
        >
          {value}
          <span
            style={{
              fontFamily: 'var(--ff-mono)',
              fontSize: 10,
              color: 'var(--text-tertiary)',
              marginLeft: 2,
              fontWeight: 500,
            }}
          >
            {label}
          </span>
        </div>
      </div>
      <button
        type="button"
        aria-label={`${label} növelése`}
        onClick={increment}
        style={{
          width: 44,
          height: 44,
          background: 'var(--surface-1)',
          color: 'var(--brand-glow)',
          border: '1px solid var(--border-strong)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon name="plus" size={14} />
      </button>
    </div>
  )
}

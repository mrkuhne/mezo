// ============================================================
// Mezo · CompactStepper — tight weight/reps stepper for the active
// logging panel. 44px ± buttons, brand display for the primary (kg)
// stepper, integer-clamped reps. The center value is tap-to-edit (type
// the number straight in) so reaching e.g. 100 kg needs no tap-spam.
// Ported from prototype train.jsx.
// ============================================================
import { Icon } from '@/shared/ui/Icon'
import { useEditableNumber } from '@/features/train/logic/useEditableNumber'

export function CompactStepper({
  label,
  value,
  step,
  onChange,
  integer = false,
  primary = false,
  min = 0,
  max,
}: {
  label: string
  value: number
  step: number
  onChange: (next: number) => void
  integer?: boolean
  primary?: boolean
  min?: number
  max?: number
}) {
  const clamp = (n: number) => {
    const lo = Math.max(min, n)
    return max != null ? Math.min(max, lo) : lo
  }
  const decrement = () =>
    onChange(clamp(integer ? value - step : +(value - step).toFixed(1)))
  const increment = () => onChange(clamp(integer ? value + step : +(value + step).toFixed(1)))
  const editable = useEditableNumber({ value, onChange, min, max, integer })

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
          color: 'var(--coral)',
          border: '1px solid var(--border-strong)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon name="minus" size={14} />
      </button>
      <div style={{ flex: 1, display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 2 }}>
        <input
          {...editable}
          aria-label={label}
          style={{
            width: 60,
            fontFamily: 'var(--ff-display)',
            fontSize: 22,
            fontWeight: 600,
            color: primary ? 'var(--coral)' : 'var(--text-primary)',
            lineHeight: 1,
            textAlign: 'center',
            background: 'transparent',
            border: 'none',
            padding: 0,
            minWidth: 0,
          }}
        />
        <span
          style={{
            fontSize: 10,
            color: 'var(--text-tertiary)',
            fontWeight: 500,
          }}
        >
          {label}
        </span>
      </div>
      <button
        type="button"
        aria-label={`${label} növelése`}
        onClick={increment}
        style={{
          width: 44,
          height: 44,
          background: 'var(--surface-1)',
          color: 'var(--coral)',
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

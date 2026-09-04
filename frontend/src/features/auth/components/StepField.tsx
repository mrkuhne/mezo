import { Icon } from '@/shared/ui/Icon'
import { hu1 } from '@/shared/lib/huNum'
import { useEditableNumber } from '@/features/train/logic/useEditableNumber'
import { clamp } from '@/features/auth/logic/onboardingSteps'

/**
 * The Train sheets' NumberStep (label + big value + 44px ± buttons on `.stepper`), re-cut for the
 * onboarding wizard: decimal-capable (weight) and ALWAYS clamped to the contract bounds — both the
 * ± buttons and the tap-to-edit display (`useEditableNumber` clamps on blur) — so the payload can
 * never earn a 400. `useEditableNumber` is domain-free and lives in train/logic for historical
 * reasons; importing it beats a third copy.
 */
export function StepField({ label, val, step, min, max, unit, integer = false, onChange }: {
  label: string
  val: number
  step: number
  min: number
  max: number
  unit: string
  integer?: boolean
  onChange: (next: number) => void
}) {
  const editable = useEditableNumber({ value: val, onChange, min, max, integer })
  const shown = integer ? String(val) : hu1(val)
  return (
    <div className="col gap-sm">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="label-mono">{label}</span>
        <span style={{ fontFamily: 'var(--ff-display)', fontSize: 22, fontWeight: 600, lineHeight: 1 }}>
          {shown} <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--text-tertiary)' }}>{unit}</span>
        </span>
      </div>
      <div className="stepper rad-12">
        <button type="button" aria-label={`${label} csökkentése`}
          onClick={() => onChange(clamp(+(val - step).toFixed(1), min, max))}>
          <Icon name="minus" size={14} />
        </button>
        <input
          {...editable}
          aria-label={label}
          className="stepper-display"
          style={{ border: 'none', background: 'transparent', width: '100%', minWidth: 0, padding: 0 }}
        />
        <button type="button" aria-label={`${label} növelése`}
          onClick={() => onChange(clamp(+(val + step).toFixed(1), min, max))}>
          <Icon name="plus" size={14} />
        </button>
      </div>
    </div>
  )
}

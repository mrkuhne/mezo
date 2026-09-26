import { Icon } from '@/shared/ui/Icon'
import { hu1 } from '@/shared/lib/huNum'
import { useEditableNumber } from '@/features/train/logic/useEditableNumber'
import { clamp } from '@/features/auth/logic/onboardingSteps'

/**
 * The Train sheets' NumberStep (label + big value + 44px ± buttons on `.stepper`), re-cut for the
 * onboarding wizard: decimal-capable (weight) and ALWAYS clamped to the contract bounds — both the
 * ± buttons and the tap-to-edit display (`useEditableNumber` clamps on blur) — so the payload can
 * never earn a 400. `useEditableNumber` is domain-free and lives in train/logic for historical
 * reasons; importing it beats a third copy. Üveg look (mezo-me75u.10): flat ± cells around a
 * big light numeral (`.auth-stepper` in the belepes block).
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
    <div className="auth-stepfield">
      <div className="auth-stepfield-head">
        <span className="auth-field-lb">{label}</span>
        <span className="auth-stepfield-val">{shown} <small>{unit}</small></span>
      </div>
      <div className="stepper auth-stepper">
        <button type="button" aria-label={`${label} csökkentése`}
          onClick={() => onChange(clamp(+(val - step).toFixed(1), min, max))}>
          <Icon name="minus" size={16} />
        </button>
        <input
          {...editable}
          aria-label={label}
          className="stepper-display"
        />
        <button type="button" aria-label={`${label} növelése`}
          onClick={() => onChange(clamp(+(val + step).toFixed(1), min, max))}>
          <Icon name="plus" size={16} />
        </button>
      </div>
    </div>
  )
}

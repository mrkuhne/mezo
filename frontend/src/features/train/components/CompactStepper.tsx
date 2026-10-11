// ============================================================
// Mezo · CompactStepper — a stepper row of the running-plan editor (kör / mp pihenő).
// The value in the middle is tap-to-edit (type the number straight in).
// Folyadék (mezo-n4wf5.3, prototype vilagos/edzes.js `stv()`): the kit's stepper row
// (`Stepper` with `input`: the label on the left, − value + on the right, the value typeable).
// ============================================================
import { Stepper } from '@/shared/ui/folyadek'
import { useEditableNumber } from '@/features/train/logic/useEditableNumber'

export function CompactStepper({
  label,
  value,
  step,
  onChange,
  integer = false,
  min = 0,
  max,
}: {
  label: string
  value: number
  step: number
  onChange: (next: number) => void
  integer?: boolean
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

  return <Stepper label={label} input={editable} onDec={decrement} onInc={increment} />
}

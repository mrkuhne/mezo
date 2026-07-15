/**
 * Napív giant stepper (spec §4.5 mockup .stepper) — the active-workout logging pair.
 * Deviates from the mockup's side-flanking ± buttons: the value line sits ABOVE a
 * centered button row, because at real phone widths (two tiles in a ~330px card)
 * a flanking layout cannot fit a "107,5 kg" value without squashing the 40px
 * round buttons into ovals (mezo-eerq overflow fix).
 */
export function SetStepper({ label, value, step, onChange, unit, integer, min = 0, max = 999 }: {
  label: string
  value: number
  step: number
  onChange: (v: number) => void
  unit?: string
  integer?: boolean
  min?: number
  max?: number
}) {
  const clamp = (v: number) => Math.min(max, Math.max(min, v))
  const display = integer ? String(value) : value.toLocaleString('hu-HU')
  return (
    <div className="stepper">
      <div className="k">{label}</div>
      <div className="n">
        {display}
        {unit && <small> {unit}</small>}
      </div>
      <div className="row">
        <button type="button" className="b np-press" aria-label={`${label} csökkentése`} onClick={() => onChange(clamp(value - step))}>−</button>
        <button type="button" className="b np-press" aria-label={`${label} növelése`} onClick={() => onChange(clamp(value + step))}>+</button>
      </div>
    </div>
  )
}

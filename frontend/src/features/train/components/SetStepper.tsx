/** Napív giant stepper (spec §4.5 mockup .stepper) — the active-workout logging pair. */
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
      <div className="row">
        <button type="button" className="b np-press" aria-label={`${label} csökkentése`} onClick={() => onChange(clamp(value - step))}>−</button>
        <div className="n">
          {display}
          {unit && <small> {unit}</small>}
        </div>
        <button type="button" className="b np-press" aria-label={`${label} növelése`} onClick={() => onChange(clamp(value + step))}>+</button>
      </div>
    </div>
  )
}

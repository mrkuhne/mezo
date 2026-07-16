// ============================================================
// Mezo · MiniBar — label + value/max readout above a thin progress
// bar, used inside SportSessionCard for intensity + shoulder strain.
// Ported from prototype sport.jsx MiniBar.
// ============================================================
interface MiniBarProps {
  label: string
  val: number
  max: number
  color: string
}

export function MiniBar({ label, val, max, color }: MiniBarProps) {
  return (
    <div className="col gap-xs flex-1">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="label-mono" style={{ fontSize: 8 }}>
          {label}
        </span>
        <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 9, color }}>
          {val}/{max}
        </span>
      </div>
      <div className="bar">
        <div className="bar-fill" style={{ width: `${(val / max) * 100}%`, background: color }} />
      </div>
    </div>
  )
}

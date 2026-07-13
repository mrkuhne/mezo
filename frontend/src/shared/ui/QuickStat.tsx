// Napiv "Ma eddig" ring stat card: a small SVG progress ring (warm track + colored
// arc) plus a label/value pair. Domain-free — color and pct are supplied by the
// caller so this stays reusable outside the Today biometrics context.
export function QuickStat({ label, value, unit, color, pct }: {
  label: string
  value: string
  unit: string
  color: string
  /** 0-100. Callers pass 100 for stats with no natural target (a full "chip" ring). */
  pct: number
}) {
  const r = 13
  const c = 2 * Math.PI * r
  const filled = (Math.max(0, Math.min(100, pct)) / 100) * c
  return (
    <div className="scard">
      <svg width={34} height={34} viewBox="0 0 34 34" aria-hidden="true">
        <circle cx={17} cy={17} r={r} fill="none" stroke="var(--warm)" strokeWidth={5} />
        <circle
          cx={17} cy={17} r={r} fill="none" stroke={color} strokeWidth={5}
          strokeDasharray={`${filled} ${c}`} strokeLinecap="round"
          transform="rotate(-90 17 17)"
        />
      </svg>
      <div>
        <div className="l">{label}</div>
        <div className="n">{value}{unit}</div>
      </div>
    </div>
  )
}

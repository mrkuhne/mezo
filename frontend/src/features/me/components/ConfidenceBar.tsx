export function ConfidenceBar({ confidence, color }: { confidence: number; color?: string }) {
  const pct = Math.round(confidence * 100)
  return (
    <div className="col gap-xs" style={{ marginTop: 8 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="label-mono">confidence</span>
        <span className="label-mono" style={color ? { color } : undefined}>{pct}%</span>
      </div>
      <div className="bar">
        <div className={color ? 'bar-fill' : 'bar-fill glow'} style={{ width: `${pct}%`, ...(color ? { background: color } : {}) }} />
      </div>
    </div>
  )
}

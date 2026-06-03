export function QuickStat({ label, value, unit, delta }: { label: string; value: string; unit: string; delta: string }) {
  return (
    <div className="flex-1 card notch-4" style={{ padding: 12 }}>
      <div className="label-mono" style={{ fontSize: 9 }}>{label}</div>
      <div style={{ fontFamily: 'var(--ff-display)', fontSize: 22, fontWeight: 600, marginTop: 4 }}>
        {value}<span style={{ fontFamily: 'var(--ff-mono)', fontSize: 10, color: 'var(--text-tertiary)', marginLeft: 2 }}>{unit}</span>
      </div>
      <div className="text-tertiary" style={{ fontFamily: 'var(--ff-mono)', fontSize: 10, marginTop: 2 }}>{delta}</div>
    </div>
  )
}

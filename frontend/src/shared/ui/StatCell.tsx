export function StatCell({ label, val, sub, color = 'var(--text-primary)' }:
  { label: string; val: string; sub?: string; color?: string }) {
  return (
    <div className="col" style={{ minWidth: 60, flex: 1 }}>
      <span className="label-mono" style={{ fontSize: 8, color: 'var(--text-tertiary)' }}>{label}</span>
      <span style={{ fontFamily: 'var(--ff-display)', fontSize: 18, fontWeight: 600, color, lineHeight: 1, marginTop: 4 }}>{val}</span>
      {sub != null && <span className="text-tertiary" style={{ fontSize: 9, fontFamily: 'var(--ff-mono)', marginTop: 2 }}>{sub}</span>}
    </div>
  )
}

export function FieldRow({ label, val }: { label: string; val: string }) {
  return (
    <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--surface-2)' }}>
      <span className="label-mono" style={{ fontSize: 9 }}>{label}</span>
      <span style={{ fontSize: 13, color: 'var(--text-primary)', fontFamily: 'var(--ff-mono)' }}>{val}</span>
    </div>
  )
}

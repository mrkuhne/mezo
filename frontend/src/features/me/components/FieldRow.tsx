export function FieldRow({ label, val }: { label: string; val: string }) {
  return (
    <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--surface-2)' }}>
      <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--faint)' }}>{label}</span>
      <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{val}</span>
    </div>
  )
}

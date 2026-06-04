export function CategoryHeader({ label, color, count }: { label: string; color: string; count: number }) {
  return (
    <div className="row gap-sm" style={{ alignItems: 'center', marginBottom: 6 }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
      <span className="label-mono" style={{ fontSize: 9, color }}>
        {label} · {count}
      </span>
    </div>
  )
}

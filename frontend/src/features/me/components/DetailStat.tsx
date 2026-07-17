export function DetailStat({ label, val, color }: { label: string; val: string | number; color?: string }) {
  return (
    <div className="flex-1 card" style={{ padding: 10 }}>
      <span style={{ fontSize: 8, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--faint)' }}>{label}</span>
      <div style={{ fontFamily: 'var(--ff-display)', fontSize: 14, fontWeight: 600, color: color || 'var(--text-primary)', marginTop: 4, lineHeight: 1.1 }}>
        {val}
      </div>
    </div>
  )
}

export function ProfileStat({ label, val, highlight = false }: { label: string; val: string; highlight?: boolean }) {
  return (
    <div className="col flex-1">
      <span className="label-mono" style={{ fontSize: 9 }}>{label}</span>
      <span
        style={{
          fontFamily: 'var(--ff-display)',
          fontSize: 18,
          marginTop: 4,
          color: highlight ? 'var(--brand-glow)' : 'var(--text-primary)',
        }}
      >
        {val}
      </span>
    </div>
  )
}

import { NOVA_META, type NovaGroup } from '@/data/nova'

export function NovaDot({ nova }: { nova: NovaGroup }) {
  const meta = NOVA_META[nova]
  return (
    <span title={meta.label} style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      fontFamily: 'var(--ff-mono)', fontSize: 8, color: meta.color, letterSpacing: '0.06em',
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: meta.color }} />
      <span>{meta.label}</span>
    </span>
  )
}

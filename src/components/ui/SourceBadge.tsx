import { pantrySources, type PantrySourceKey } from '@/data/pantrySources'

export function SourceBadge({ source, size = 'sm' }: { source: PantrySourceKey; size?: 'sm' | 'lg' }) {
  const meta = pantrySources[source] ?? pantrySources.manual
  const isLg = size === 'lg'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: isLg ? '3px 7px' : '2px 5px',
      fontFamily: 'var(--ff-mono)', fontSize: isLg ? 9 : 8, fontWeight: 600,
      letterSpacing: '0.06em', textTransform: 'lowercase',
      color: meta.color,
      border: '1px solid ' + meta.color + '40',
      background: meta.color + '10',
    }}>
      <span style={{
        width: isLg ? 6 : 5, height: isLg ? 6 : 5, borderRadius: '50%',
        background: meta.color, flexShrink: 0,
      }} />
      {meta.label}
    </span>
  )
}

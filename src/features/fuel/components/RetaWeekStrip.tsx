import { useFuelWeek } from '@/data/hooks'

export function RetaWeekStrip({ currentDay }: { currentDay: number }) {
  const { retaWeek } = useFuelWeek()
  return (
    <div className="row gap-xs" style={{ alignItems: 'stretch' }}>
      {retaWeek.map((p) => {
        const active = p.d === currentDay
        const past = p.d < currentDay
        return (
          <div
            key={p.d}
            data-active={active}
            className="col flex-1"
            style={{
              padding: '8px 6px',
              background: active
                ? `color-mix(in srgb, ${p.color} 13%, transparent)`
                : past
                  ? 'var(--surface-1)'
                  : 'var(--surface-2)',
              border: '1px solid ' + (active ? p.color : 'var(--border-subtle)'),
              alignItems: 'center',
              clipPath:
                'polygon(2px 0, 100% 0, 100% calc(100% - 2px), calc(100% - 2px) 100%, 0 100%, 0 2px)',
            }}
          >
            <span
              style={{
                fontFamily: 'var(--ff-display)',
                fontSize: 14,
                fontWeight: 600,
                color: active ? p.color : past ? 'var(--text-tertiary)' : 'var(--text-secondary)',
              }}
            >
              D{p.d}
            </span>
            <span
              className="label-mono"
              style={{ fontSize: 8, color: active ? p.color : 'var(--text-tertiary)', marginTop: 4 }}
            >
              {p.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}

import type { SleepEntry } from '@/data/types'

export function SleepLogRow({ night }: { night: SleepEntry }) {
  const isLow = night.duration < 7 || night.quality <= 5
  return (
    <div
      data-sleep-log-row
      className="card notch-4"
      style={{
        padding: '10px 14px',
        borderColor: isLow ? 'rgba(245, 158, 11, 0.25)' : 'var(--border-subtle)',
        background: isLow ? 'rgba(245, 158, 11, 0.03)' : 'var(--surface-1)',
      }}
    >
      <div className="row" style={{ alignItems: 'center', gap: 12 }}>
        <span
          className="label-mono"
          style={{ fontSize: 10, color: 'var(--text-tertiary)', width: 44, whiteSpace: 'nowrap' }}
        >
          {night.date.slice(5).replace('-', '/')}
        </span>
        <div className="col" style={{ width: 72 }}>
          <span
            style={{
              fontFamily: 'var(--ff-display)',
              fontSize: 17,
              fontWeight: 600,
              color: isLow ? 'var(--warning)' : 'var(--cat-preference)',
              lineHeight: 1,
            }}
          >
            {night.duration.toFixed(1)}
            <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 9, color: 'var(--text-tertiary)', marginLeft: 2 }}>h</span>
          </span>
          <span className="text-tertiary" style={{ fontSize: 9, fontFamily: 'var(--ff-mono)', marginTop: 2 }}>
            {night.bedtime} → {night.wakeup}
          </span>
        </div>
        <div className="col flex-1">
          <div className="row gap-sm" style={{ alignItems: 'center' }}>
            <span className="label-mono" style={{ fontSize: 8 }}>Q</span>
            <div className="bar" style={{ flex: 1, height: 4 }}>
              <div
                className="bar-fill"
                style={{ width: (night.quality / 10) * 100 + '%', background: isLow ? 'var(--warning)' : 'var(--cat-preference)' }}
              />
            </div>
            <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 10, color: isLow ? 'var(--warning)' : 'var(--text-primary)' }}>
              {night.quality}
            </span>
          </div>
          {night.notes && (
            <span className="text-tertiary" style={{ fontSize: 10, marginTop: 4, lineHeight: 1.4, fontStyle: 'italic' }}>
              "{night.notes}"
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

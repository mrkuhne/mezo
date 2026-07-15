import type { SleepEntry } from '@/data/types'

export function SleepLogRow({ night }: { night: SleepEntry }) {
  const isLow = night.duration < 7 || night.quality <= 5
  return (
    <div
      data-sleep-log-row
      style={{
        borderRadius: 18,
        boxShadow: 'var(--np-shadow-row)',
        padding: '10px 14px',
        background: isLow ? 'color-mix(in srgb, var(--warning) 8%, var(--surface))' : 'var(--surface)',
      }}
    >
      <div className="row" style={{ alignItems: 'center', gap: 12 }}>
        <span
          style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--faint)', width: 44, whiteSpace: 'nowrap' }}
        >
          {night.date.slice(5).replace('-', '/')}
        </span>
        <div className="col" style={{ width: 72 }}>
          <span
            style={{
              fontFamily: 'var(--ff-display)',
              fontSize: 17,
              fontWeight: 600,
              color: isLow ? 'var(--warning)' : 'var(--ink)',
              lineHeight: 1,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {night.duration.toFixed(1)}
            <span style={{ fontSize: 9, color: 'var(--text-tertiary)', marginLeft: 2 }}>h</span>
          </span>
          <span className="text-tertiary" style={{ fontSize: 9, fontWeight: 700, marginTop: 2 }}>
            {night.bedtime} → {night.wakeup}
          </span>
        </div>
        <div className="col flex-1">
          <div className="row gap-sm" style={{ alignItems: 'center' }}>
            <span style={{ fontSize: 8, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--faint)' }}>Q</span>
            <div className="bar" style={{ flex: 1, height: 4 }}>
              <div
                className="bar-fill"
                style={{ width: (night.quality / 10) * 100 + '%', background: isLow ? 'var(--warning)' : 'var(--sage-deep)' }}
              />
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, color: isLow ? 'var(--warning)' : 'var(--sage-deep)', fontVariantNumeric: 'tabular-nums' }}>
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

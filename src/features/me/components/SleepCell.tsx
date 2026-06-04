import type { SleepTrends } from '@/data/types'

type SleepCellStats = SleepTrends['last7d']

export function SleepCell({ label, stats }: { label: string; stats: SleepCellStats }) {
  return (
    <div className="flex-1 card notch-4" style={{ padding: 12 }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span className="label-mono" style={{ fontSize: 9 }}>{label}</span>
        <span className="label-mono" style={{ fontSize: 8, color: stats.onTrack ? 'var(--success)' : 'var(--warning)' }}>
          {stats.onTrack ? 'ON TRACK' : 'OFF'}
        </span>
      </div>
      <div
        style={{
          fontFamily: 'var(--ff-display)',
          fontSize: 22,
          fontWeight: 600,
          color: 'var(--text-primary)',
          marginTop: 4,
          lineHeight: 1,
        }}
      >
        {stats.avgDuration.toFixed(1)}
        <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 10, color: 'var(--text-tertiary)', marginLeft: 3 }}>h</span>
      </div>
      <div className="row mt-sm gap-md" style={{ justifyContent: 'space-between' }}>
        <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 10, color: 'var(--brand-glow)' }}>
          Q {stats.avgQuality.toFixed(1)}
        </span>
        <span
          style={{
            fontFamily: 'var(--ff-mono)',
            fontSize: 10,
            color: stats.nightsUnder7h > 0 ? 'var(--warning)' : 'var(--text-tertiary)',
          }}
        >
          {stats.nightsUnder7h}× &lt;7h
        </span>
      </div>
    </div>
  )
}

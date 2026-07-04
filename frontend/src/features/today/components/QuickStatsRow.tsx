import { useQuickStats } from '@/data/hooks'
import { QuickStat } from '@/shared/ui/QuickStat'

export function QuickStatsRow() {
  const stats = useQuickStats()
  return (
    <div style={{ padding: '8px 24px 24px' }}>
      <div className="eyebrow" style={{ marginBottom: 10 }}>Most</div>
      <div className="row gap-md">
        {stats.map((s) => (
          <QuickStat key={s.label} label={s.label} value={s.value} unit={s.unit} delta={s.delta} />
        ))}
      </div>
    </div>
  )
}

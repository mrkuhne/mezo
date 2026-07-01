import { QuickStat } from '@/shared/ui/QuickStat'

export function QuickStatsRow() {
  return (
    <div style={{ padding: '8px 24px 24px' }}>
      <div className="eyebrow" style={{ marginBottom: 10 }}>Most</div>
      <div className="row gap-md">
        <QuickStat label="Alvás" value="7.2" unit="h" delta="+0.4" />
        <QuickStat label="Súly" value="78.6" unit="kg" delta="-0.2" />
        <QuickStat label="HRV" value="64" unit="ms" delta="+3" />
      </div>
    </div>
  )
}

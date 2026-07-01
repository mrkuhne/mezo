import { useInsights } from '@/data/hooks'
import type { WeeklyTrend } from '@/data/types'

function trendArrow(t: WeeklyTrend): string {
  return t === 'up' ? '↗' : t === 'down' ? '↘' : '→'
}

function trendColor(t: WeeklyTrend): string {
  return t === 'up' ? 'var(--success)' : t === 'down' ? 'var(--error)' : 'var(--text-tertiary)'
}

export function WeeklyPage() {
  const { weekly, weeklySuggestion } = useInsights()

  return (
    <div className="col gap-md">
      <div className="card notch-12" style={{ padding: 18 }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div className="col">
            <span className="eyebrow brand">{weekly.title}</span>
            <div style={{ fontFamily: 'var(--ff-display)', fontSize: 56, fontWeight: 600, lineHeight: 1, marginTop: 8 }}>
              {weekly.score}
              <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 16, color: 'var(--text-tertiary)', marginLeft: 6 }}>/100</span>
            </div>
          </div>
          <div className="col" style={{ alignItems: 'flex-end' }}>
            <span className="label-mono" style={{ color: weekly.delta > 0 ? 'var(--success)' : 'var(--error)' }}>
              {weekly.delta > 0 ? '+' : ''}{weekly.delta}
            </span>
            <span className="text-tertiary" style={{ fontSize: 10, marginTop: 4 }}>vs hét 20</span>
          </div>
        </div>

        <div className="col gap-md mt-lg" style={{ paddingTop: 14, borderTop: '1px solid var(--border-subtle)' }}>
          {weekly.items.map((it, i) => (
            <div key={i} className="row" style={{ justifyContent: 'space-between' }}>
              <span className="text-secondary" style={{ fontSize: 13 }}>{it.label}</span>
              <div className="row gap-sm">
                <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{it.value}</span>
                <span style={{ fontSize: 12, color: trendColor(it.trend) }}>{trendArrow(it.trend)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card notch-4" style={{ padding: 14 }}>
        <span className="eyebrow brand">Mezo · heti tervjavaslat</span>
        <p style={{ fontSize: 13, marginTop: 8, color: 'var(--text-primary)', lineHeight: 1.5 }}>{weeklySuggestion}</p>
        <div className="row gap-sm mt-md">
          <button type="button" className="cta-ghost notch-4" style={{ fontSize: 10 }}>Elfogad</button>
          <button type="button" className="chip" style={{ fontSize: 9 }}>Hangoljuk</button>
        </div>
      </div>
    </div>
  )
}

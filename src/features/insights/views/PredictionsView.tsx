import { Icon } from '@/components/ui/Icon'
import { cn } from '@/lib/cn'
import { useInsights } from '@/data/hooks'

export function PredictionsView() {
  const { predictions } = useInsights()

  return (
    <div className="col gap-md">
      <div className="row gap-sm" style={{ justifyContent: 'space-between' }}>
        <span className="eyebrow">Aktív predikciók</span>
        <span className="eyebrow text-tertiary">2 validated · 60-day acc 68%</span>
      </div>

      {predictions.map((p) => (
        <div key={p.id} className="card notch-12" style={{ padding: 14 }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className={cn('chip', p.status === 'validated' && 'brand')} style={{ fontSize: 9 }}>
              {p.status === 'validated' ? '✓ Validated' : '◐ Pending'}
            </span>
            <span className="label-mono" style={{ fontSize: 9 }}>{p.date}</span>
          </div>

          <div style={{ fontFamily: 'var(--ff-display)', fontSize: 15, marginTop: 8, lineHeight: 1.2, color: 'var(--text-primary)' }}>{p.title}</div>

          <div className="row mt-sm" style={{ justifyContent: 'space-between' }}>
            <div className="bar" style={{ flex: 1, marginRight: 12 }}>
              <div className="bar-fill glow" style={{ width: `${p.confidence * 100}%` }} />
            </div>
            <span className="label-mono" style={{ fontSize: 10, color: 'var(--brand-glow)' }}>{(p.confidence * 100).toFixed(0)}%</span>
          </div>

          {p.basis && <p className="text-secondary mt-sm" style={{ fontSize: 12, lineHeight: 1.5 }}>{p.basis}</p>}

          {p.actual && (
            <div className="row gap-sm mt-md" style={{ paddingTop: 10, borderTop: '1px solid var(--border-subtle)' }}>
              <Icon name="check" size={14} color="var(--success)" />
              <span style={{ fontSize: 12, color: 'var(--success)' }}>{p.actual}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

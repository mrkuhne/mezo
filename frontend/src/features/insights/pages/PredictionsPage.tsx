import { Icon } from '@/shared/ui/Icon'
import { cn } from '@/shared/lib/cn'
import { usePredictions } from '@/data/hooks'
import type { Prediction } from '@/data/types'

/** Right-side header: mock keeps the Phase-1 literal; live derives honestly from CLOSED rows. */
function accuracyHeader(predictions: Prediction[], mock: boolean): string | null {
  if (mock) return '2 validated · 60-day acc 68%'
  const validated = predictions.filter((p) => p.status === 'validated').length
  const closed = validated + predictions.filter((p) => p.status === 'missed').length
  if (closed === 0) return null
  return `${validated} validated · acc ${Math.round((validated / closed) * 100)}%`
}

export function PredictionsPage() {
  const { predictions, mode } = usePredictions()
  const header = accuracyHeader(predictions, mode === 'mock')

  if (predictions.length === 0) {
    return (
      <div className="card notch-12" style={{ padding: 18, textAlign: 'center' }}>
        <span className="eyebrow text-tertiary">tanulom</span>
        <p style={{ fontSize: 13, marginTop: 8, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          Az első predikciók a megerősített mintákból készülnek — a minta-motor még tanul.
        </p>
      </div>
    )
  }

  return (
    <div className="col gap-md">
      <div className="row gap-sm" style={{ justifyContent: 'space-between' }}>
        <span className="eyebrow">Aktív predikciók</span>
        {header && <span className="eyebrow text-tertiary">{header}</span>}
      </div>

      {predictions.map((p) => (
        <div key={p.id} className="card notch-12" style={{ padding: 14 }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className={cn('chip', p.status === 'validated' && 'brand')} style={{ fontSize: 9 }}>
              {p.status === 'validated' ? '✓ Validated' : p.status === 'missed' ? '✗ Missed' : '◐ Pending'}
            </span>
            <span className="label-mono" style={{ fontSize: 9 }}>{p.date}</span>
          </div>

          <div style={{ fontFamily: 'var(--ff-display)', fontSize: 15, marginTop: 8, lineHeight: 1.2, color: 'var(--text-primary)' }}>{p.title}</div>

          <div className="row mt-sm" style={{ justifyContent: 'space-between' }}>
            {p.confidence != null ? (
              <>
                <div className="bar" style={{ flex: 1, marginRight: 12 }}>
                  <div className="bar-fill glow" style={{ width: `${p.confidence * 100}%` }} />
                </div>
                <span className="label-mono" style={{ fontSize: 10, color: 'var(--brand-glow)' }}>{(p.confidence * 100).toFixed(0)}%</span>
              </>
            ) : (
              <span className="label-mono" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>tanulom</span>
            )}
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

import { useMemo } from 'react'
import { Icon } from '@/shared/ui/Icon'
import { useFeedback, usePredictions } from '@/data/hooks'
import { FeedbackChips } from '@/features/insights/components/FeedbackChips'
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
  // ONE feedback read for the whole list (mezo-b3pp.15) — a per-card hook would fire one HTTP
  // request per prediction. Called ABOVE the empty-state early return: an empty id set simply
  // skips the network. The cards stay dumb — they read get(id) and call vote(id, …).
  const predictionIds = useMemo(() => predictions.map((p) => p.id), [predictions])
  const feedback = useFeedback('prediction', predictionIds)

  if (predictions.length === 0) {
    return (
      <div className="card" style={{ padding: 18, textAlign: 'center' }}>
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
        <div key={p.id} className="card" style={{ padding: 14 }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span
              className="chip"
              style={{ fontSize: 9, ...(p.status === 'validated' ? { background: 'var(--wash-lav)', color: 'var(--lav-deep)' } : {}) }}
            >
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
                <span className="label-mono" style={{ fontSize: 10, color: 'var(--lav-deep)' }}>{(p.confidence * 100).toFixed(0)}%</span>
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

          {/* Both modes — a prediction is an AI artifact wherever it comes from. Keyed by the
              prediction id (as the card itself is): FeedbackChips seeds its reason-row state
              once, on mount, so React must never reuse one card's instance for another row. */}
          <div className="mt-md">
            <FeedbackChips
              key={p.id}
              value={feedback.get(p.id)}
              onVote={(verdict, reason) => feedback.vote(p.id, verdict, reason)}
              label="az előrejelzésről"
            />
          </div>
        </div>
      ))}
    </div>
  )
}

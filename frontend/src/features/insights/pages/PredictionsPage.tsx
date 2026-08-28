// ============================================================
// Mezo · Előrejelzések — Mozaik re-face (mezo-d20.5.6).
// Source of truth: mezo-body.html #page-josla (.predtile, ×1.18).
// Status-washed tiles: ◐ Folyamatban = lavender + animated confidence
// bar, ✓ Bevált = sage + "✓ Bejött:" actual line. The Hungarian chips
// are a DESIGNED FIX — the wire's statuses shipped as English chips
// (✓ Validated / ✗ Missed / ◐ Pending); the view localizes them, as it
// does the accuracy header. Behavioral contracts preserved verbatim:
// honest null-states ("tanulom" on null confidence, the still-learning
// empty card, accuracy hidden without closed rows), the ONE feedback
// read for the whole list, FeedbackChips on every card in both modes.
// ============================================================
import { useMemo } from 'react'
import { cn } from '@/shared/lib/cn'
import { ClayIcon } from '@/shared/ui/clay'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { useFeedback, usePredictions } from '@/data/hooks'
import { FeedbackChips } from '@/features/insights/components/FeedbackChips'
import type { Prediction, PredictionStatus } from '@/data/types'

/** Hungarian status chips (prototype .stch) — localizing the shipped English ones.
 *  `missed` has no prototype card; it wears the muted chip, never red (guardrail). */
const STATUS: Record<PredictionStatus, { label: string; chip: string; wash?: string }> = {
  pending: { label: '◐ Folyamatban', chip: 'pend', wash: 'lav' },
  validated: { label: '✓ Bevált', chip: 'ok', wash: 'sage' },
  missed: { label: '◯ Nem jött be', chip: 'mut' },
}

/** Right-side header: mock keeps the Phase-1 literal (localized view-side);
 *  live derives honestly from CLOSED rows — hidden while none exist. */
function accuracyHeader(predictions: Prediction[], mock: boolean): string | null {
  if (mock) return '2 bevált · 60 napos pontosság 68%'
  const validated = predictions.filter((p) => p.status === 'validated').length
  const closed = validated + predictions.filter((p) => p.status === 'missed').length
  if (closed === 0) return null
  return `${validated} bevált · pontosság ${Math.round((validated / closed) * 100)}%`
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
    <EntranceGroup className="col gap-md">
      <div className="row gap-sm" style={{ justifyContent: 'space-between' }}>
        <span className="eyebrow">Aktív predikciók</span>
        {header && <span className="eyebrow text-tertiary">{header}</span>}
      </div>

      {predictions.map((p, i) => {
        const meta = STATUS[p.status]
        return (
          <div key={p.id} className={cn('mzp-pred', meta.wash, 'rise')} style={{ '--d': `${i * 70}ms` } as React.CSSProperties}>
            <div className="mzp-top">
              <span className="mzp-pic"><ClayIcon name="i-kristaly" size={22} /></span>
              <span className={cn('mzp-stch', meta.chip)}>{meta.label}</span>
              <span className="mzp-date">{p.date}</span>
            </div>

            <div className="mzp-title">{p.title}</div>

            {p.status === 'pending' && (
              <div className="mzp-conf">
                {p.confidence != null ? (
                  <>
                    <div className="mzp-gbar">
                      <div style={{ width: `${Math.round(p.confidence * 100)}%`, '--d': `${350 + i * 70}ms` } as React.CSSProperties} />
                    </div>
                    <span className="mzp-pct">{Math.round(p.confidence * 100)}%</span>
                  </>
                ) : (
                  <span className="mzp-learn">tanulom</span>
                )}
              </div>
            )}

            {p.basis && <p className="mzp-basis">{p.basis}</p>}

            {p.actual && <div className="mzp-actual">✓ Bejött: {p.actual}</div>}

            {/* Both modes — a prediction is an AI artifact wherever it comes from. Keyed by the
                prediction id (as the card itself is), so React never reuses one card's
                FeedbackChips instance — and its session-local reason-row state — for another row. */}
            <div className="mt-md">
              <FeedbackChips
                key={p.id}
                value={feedback.get(p.id)}
                onVote={(verdict, reason) => feedback.vote(p.id, verdict, reason)}
                label="az előrejelzésről"
              />
            </div>
          </div>
        )
      })}
    </EntranceGroup>
  )
}

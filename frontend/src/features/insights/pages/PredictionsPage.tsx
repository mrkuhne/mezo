// ============================================================
// Mezo · Előrejelzések — Mozaik re-face (mezo-d20.5.6, scaffold mezo-d20.11).
// Source of truth: mezo-body.html #page-josla (.predtile, ×1.18).
// Scaffold (ADR 0032 / fidelity audit): the page owns its own
// `‹ Mezo` PageHead + the prototype's page-hero (i-kristaly + the
// counted-up accuracy percent) + PageBody — before this it mounted
// neither, so a user who tapped the tile could only leave via the
// tab bar, and the tiles ran edge-to-edge.
// Status-washed tiles: ◐ Folyamatban = lavender + animated confidence
// bar, ✓ Bevált = sage + "✓ Bejött:" actual line. The Hungarian chips
// are a DESIGNED FIX — the wire's statuses shipped as English chips
// (✓ Validated / ✗ Missed / ◐ Pending); the view localizes them, as it
// does the accuracy header. Behavioral contracts preserved verbatim:
// honest null-states ("tanulom" on null confidence, the still-learning
// empty card, accuracy hidden without closed rows), the ONE feedback
// read for the whole list, FeedbackChips on every card in both modes.
// ============================================================
import { useMemo, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/shared/lib/cn'
import { ClayIcon } from '@/shared/ui/clay'
import { MozaikPage, PageHead, PageHero, PageBody } from '@/shared/ui/mozaik'
import { EntranceGroup, useCountUp } from '@/shared/ui/mozaik/motion'
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

/** The hero's honest accuracy pair: mock keeps the Phase-1 literal (localized view-side);
 *  live derives from CLOSED rows only — null while none exist, so the hero shows NO number
 *  rather than a fabricated 0%. */
export function accuracyOf(predictions: Prediction[], mock: boolean): { pct: number; sub: string } | null {
  if (mock) return { pct: 68, sub: '2 bevált · 60 napos pontosság' }
  const validated = predictions.filter((p) => p.status === 'validated').length
  const closed = validated + predictions.filter((p) => p.status === 'missed').length
  if (closed === 0) return null
  return { pct: Math.round((validated / closed) * 100), sub: `${validated} bevált · pontosság` }
}

/** The page frame every branch renders inside — the way back must exist on all of them. */
function PredFrame({ big, sub, children }: { big?: ReactNode; sub?: string; children: ReactNode }) {
  const navigate = useNavigate()
  return (
    <MozaikPage tone="sky">
      <PageHead onBack={() => navigate('/mezo')} label="‹ Mezo" />
      <PageHero icon="i-kristaly" name="Előrejelzések" big={big} sub={sub} />
      <PageBody>{children}</PageBody>
    </MozaikPage>
  )
}

export function PredictionsPage() {
  const { predictions, mode } = usePredictions()
  const accuracy = accuracyOf(predictions, mode === 'mock')
  // The hero number spins up (prototype hero big numbers animate) — useCountUp is itself
  // reduced-motion aware. Hook order stays above every early return.
  const heroPct = useCountUp(accuracy?.pct ?? 0)
  // ONE feedback read for the whole list (mezo-b3pp.15) — a per-card hook would fire one HTTP
  // request per prediction. Called ABOVE the empty-state early return: an empty id set simply
  // skips the network. The cards stay dumb — they read get(id) and call vote(id, …).
  const predictionIds = useMemo(() => predictions.map((p) => p.id), [predictions])
  const feedback = useFeedback('prediction', predictionIds)

  if (predictions.length === 0) {
    return (
      <PredFrame>
        <div className="card" style={{ padding: 18, textAlign: 'center' }}>
          <span className="eyebrow text-tertiary">tanulom</span>
          <p style={{ fontSize: 13, marginTop: 8, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Az első predikciók a megerősített mintákból készülnek — a minta-motor még tanul.
          </p>
        </div>
      </PredFrame>
    )
  }

  return (
    <PredFrame
      big={accuracy != null ? <>{heroPct}<span className="mzp-heropct">%</span></> : undefined}
      sub={accuracy?.sub}
    >
      <EntranceGroup className="col gap-md">
        <span className="mz-eyebrow">Aktív predikciók</span>

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
    </PredFrame>
  )
}

// ============================================================
// Mezo · Előrejelzések in the Üveg world (mezo-me75u.9).
// Source of truth: docs/design_2.0/prototypes/uveg-mezo-teljes.html #elorejelzesek
// (src/uveg-mezo-teljes-u9.js `elorejelzesek`), on the csapatfal `tf-*` kit.
// The accuracy numeral is the page's gradient hero (sky → pale → warm gold),
// hidden without closed rows exactly as before; pending predictions are sky
// glass cases (status pill + confidence bar), closed ones flat cases (Bevált
// sage / Nem jött be neutral — never red). Status glyphs became 3D sprite
// icons + words (bible rule 45). Behavioural contracts preserved verbatim:
// honest null-states („tanulom" on null confidence, the still-learning empty
// card, accuracy hidden without closed rows), ?status= filter, the ONE
// feedback read for the whole list, FeedbackChips on every card in both modes.
// ============================================================
import { useMemo, type CSSProperties, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { cn } from '@/shared/lib/cn'
import { Icon3D } from '@/shared/ui/clay'
import { EntranceGroup, useCountUp } from '@/shared/ui/mozaik/motion'
import { useFeedback, usePredictions } from '@/data/hooks'
import { PREDICTION_STATE } from '@/features/insights/logic/predictionStatus'
import { FeedbackChips } from '@/features/insights/components/FeedbackChips'
import type { Prediction } from '@/data/types'
import { ALL_FEATURES_ROUTE } from '@/features/insights/logic/boopNavigation'
import '@/features/insights/boop-world.css'

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
    <div className="tf-page m9e-root">
      <div className="tf-dhead">
        <button type="button" className="glass tf-back" aria-label="Vissza"
          onClick={() => navigate(ALL_FEATURES_ROUTE)}>‹</button>
        <span className="tf-dtitle"><small>Mezo · összes funkció</small><strong>Előrejelzések</strong></span>
      </div>
      {big !== undefined && (
        <div className="m9e-hero">
          <span className="m9e-acc" data-testid="prediction-accuracy">{big}</span>
          {sub && <small>{sub}</small>}
        </div>
      )}
      {children}
    </div>
  )
}

const STATE_TONE = { lav: 'tf-s-lav', sage: 'tf-s-sage', mute: 'tf-s-slate' } as const

export function PredictionsPage() {
  const { predictions, mode, isPending, isError, refetch } = usePredictions()
  const [search, setSearch] = useSearchParams()
  const filter = search.get('status') ?? 'all'
  const visible = predictions.filter((p) => filter === 'pending' ? p.status === 'pending' : filter === 'closed' ? p.status !== 'pending' : true)
  const accuracy = accuracyOf(predictions, mode === 'mock')
  // The hero number spins up — useCountUp is itself reduced-motion aware. Hook order stays
  // above every early return.
  const heroPct = useCountUp(accuracy?.pct ?? 0)
  // ONE feedback read for the whole list (mezo-b3pp.15) — a per-card hook would fire one HTTP
  // request per prediction. Called ABOVE the empty-state early return: an empty id set simply
  // skips the network. The cards stay dumb — they read get(id) and call vote(id, …).
  const predictionIds = useMemo(() => predictions.map((p) => p.id), [predictions])
  const feedback = useFeedback('prediction', predictionIds)

  if (isPending) return <PredFrame><p className="m9e-note" role="status">Betöltés…</p></PredFrame>
  if (isError) {
    return (
      <PredFrame>
        <div className="tf-dash m9e-state" role="alert">
          <Icon3D name="t-info" size={30} />
          <span>Nem sikerült betölteni az előrejelzéseket.</span>
          <button type="button" className="m9e-retry" onClick={refetch}>Újrapróbálom</button>
        </div>
      </PredFrame>
    )
  }
  if (predictions.length === 0) {
    return (
      <PredFrame>
        <div className="tf-dash m9e-state">
          <Icon3D name="t-orb" size={30} />
          <span className="m9e-statetx">
            <b className="m9e-learn">tanulom</b>
            <span>Az első predikciók a megerősített mintákból készülnek — a minta-motor még tanul.</span>
          </span>
        </div>
      </PredFrame>
    )
  }

  return (
    <PredFrame
      big={accuracy != null ? <>{heroPct}<small>%</small></> : undefined}
      sub={accuracy?.sub}
    >
      <EntranceGroup className="m9e-body">
        <div className="tf-sec"><h2>Aktív predikciók</h2></div>

        <div className="m9e-filt" role="group" aria-label="Előrejelzések szűrése">
          {([['all', 'Mind'], ['pending', 'Folyamatban'], ['closed', 'Lezárt']] as const).map(([value, label]) => <button key={value} type="button" className={cn(filter === value && 'on')} aria-pressed={filter === value} onClick={() => setSearch({ status: value }, { replace: true })}>{label}</button>)}
        </div>
        {visible.length === 0 && <p className="m9e-note">Ebben az állapotban még nincs előrejelzés.</p>}
        <div className="tf-rows">
          {visible.map((p, i) => {
            const state = PREDICTION_STATE[p.status]
            const live = p.status === 'pending'
            return (
              <div key={p.id} data-status={p.status}
                className={cn('tf-case m9e-pred rise', live ? 'glass tf-c-sky is-pending' : 'tf-flatc is-closed', STATE_TONE[state.tone])}
                style={{ '--d': `${i * 70}ms` } as CSSProperties}>
                <span className="tf-crow">
                  <span className="tf-st m9e-st"><Icon3D name={state.art} size={14} />{state.label}</span>
                  <em>{p.date}</em>
                </span>

                <Link className="tf-cmain m9e-title" to={`/mezo/predictions/${encodeURIComponent(p.id)}?${search}`}>
                  <Icon3D name="t-orb" size={36} />
                  <span className="tf-ctxt"><span className="tf-ctitle">{p.title}</span></span>
                  <span className="tf-chev" aria-hidden="true">›</span>
                </Link>

                {live && (
                  <div className="m9e-conf">
                    {p.confidence != null ? (
                      <>
                        <span className="uv-bar" aria-hidden="true">
                          <b style={{ '--w': `${Math.round(p.confidence * 100)}%` } as CSSProperties} />
                        </span>
                        <b className="m9e-pct">{Math.round(p.confidence * 100)}%</b>
                      </>
                    ) : (
                      <span className="m9e-learn">tanulom</span>
                    )}
                  </div>
                )}

                {p.basis && <p className="m9e-basis">{p.basis}</p>}

                {p.actual && (p.status === 'validated'
                  ? <span className="tf-after m9e-actual"><Icon3D name="t-tick" size={15} />Bejött: {p.actual}</span>
                  : <p className="m9e-observed">Megfigyelt eredmény: {p.actual}</p>)}

                {/* Both modes — a prediction is an AI artifact wherever it comes from. Keyed by the
                    prediction id (as the card itself is), so React never reuses one card's
                    FeedbackChips instance — and its session-local reason-row state — for another row. */}
                <div className="m9e-fb">
                  <FeedbackChips
                    key={p.id}
                    glyph3d
                    value={feedback.get(p.id)}
                    onVote={(verdict, reason) => feedback.vote(p.id, verdict, reason)}
                    label="az előrejelzésről"
                  />
                </div>
              </div>
            )
          })}
        </div>
      </EntranceGroup>
    </PredFrame>
  )
}

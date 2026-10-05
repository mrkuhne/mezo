// Mezo · WeekHeroCard — the Én hub's week hero (mezo-lhqw7).
// Prototype: docs/design_2.0/prototypes/elo/en.html `hub()` `.whub.wkhero`. The LAST CLOSED week
// (a running week has no review and half a score): a frameless lavender halo, the score ring,
// the delta to the week before, what went well / what to watch, and the door to the heti hub.
// The section itself is not a control — the CTA is.
// Honest states:
//  · no score → the ring's own „tanulom" (never a 0), and no delta;
//  · the two labelled lines appear only where the review carries them; a review from before
//    those fields falls back to its first two sentences, unlabelled; a closed week WITHOUT a
//    review says so in one sentence;
//  · an unresolved or failed review read shows NO line — it must not read as „nem készült";
//  · the week still loading → the ring skeleton; a failed week → a retry, not an empty week.
import { useNavigate } from 'react-router-dom'
import { useMeWeek, useWeeklyReview } from '@/data/hooks'
import { mondayIso, deriveWeekTitle } from '@/data/fuel/fuelWeekHooks'
import { GhostState } from '@/shared/ui/GhostState'
import { prevMonday } from '@/features/me/logic/weekNav'
import { scoreDelta } from '@/features/me/logic/scoreBand'
import { analysisSnippet, leadSentences } from '@/features/me/logic/weekHub'
import { WeekScoreRing } from '@/features/me/components/week/WeekScoreRing'

export function WeekHeroCard() {
  const navigate = useNavigate()
  const start = prevMonday(mondayIso())
  const { week, isPending, isError, refetch } = useMeWeek(start)
  // `isPending` / `isError` here are "review OR digest" (the hook folds both reads). The hero
  // only needs the review, so a digest hiccup also silences the lines — erring toward silence
  // is intended: no line is better than a wrong „nem készült elemzés".
  const { review, isPending: reviewPending, isError: reviewError } = useWeeklyReview(start)

  const shell = (body: React.ReactNode) => (
    <section className="enh-wkhero uv-halo rise" style={{ '--d': '60ms' } as React.CSSProperties}>
      <span className="enh-wkeb uv-eyebrow">{deriveWeekTitle(start)} · lezárt hét</span>
      {body}
    </section>
  )

  if (isError && week == null) {
    return shell(<GhostState message="Nem sikerült betölteni a hetet." ctaLabel="Újra" onCta={refetch} />)
  }

  const cta = (
    <button type="button" className="enh-wkcta" onClick={() => navigate(`/me/week?start=${start}`)}>
      A heti elemzés ›
    </button>
  )

  if (week == null) {
    // The skeleton shimmers only while something is on its way; a resolved „no week" is the
    // ring's own „tanulom" state, not an endless loader.
    return shell(
      isPending
        ? <div className="wkh-skel ring" data-testid="enh-wk-skeleton" aria-hidden="true" />
        : <><WeekScoreRing score={null} />{cta}</>,
    )
  }

  const score = week.weekly.score ?? null
  const delta = scoreDelta(score, week.weekly.prevWeekScore ?? null)

  let lines: React.ReactNode = null
  if (reviewPending || reviewError) {
    lines = null
  } else if (review == null) {
    lines = <p className="enh-wkline"><span>{analysisSnippet(null, 'closed')}</span></p>
  } else if (review.wentWell != null || review.watchOut != null) {
    lines = (
      <>
        {review.wentWell != null && <p className="enh-wkline is-well"><span><b>Jól ment:</b> {review.wentWell}</span></p>}
        {review.watchOut != null && <p className="enh-wkline is-watch"><span><b>Figyelj rá:</b> {review.watchOut}</span></p>}
      </>
    )
  } else {
    lines = leadSentences(review.summary, 2).map((s, i) => <p key={i} className="enh-wkline"><span>{s}</span></p>)
  }

  return shell(
    <>
      <WeekScoreRing score={score} />
      {delta && (
        <div className="enh-wkdelta">
          <span className={`wk-delta${delta.direction === 'down' ? ' is-down' : delta.direction === 'flat' ? ' is-flat' : ''}`}>
            {delta.text}
          </span>
          az előző héthez
        </div>
      )}
      {lines != null && <div className="enh-wklines">{lines}</div>}
      {cta}
    </>,
  )
}

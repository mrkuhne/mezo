// ============================================================
// Mezo · WeekAnalysisPage — Heti elemzés (mezo-d20.6.10)
// Source of truth: docs/design_2.0/prototypes/src/en-body.html #page-hanaly
// (p-lav tone, orb hero + weekly score, „Napi pontszám" column card, the
// analysis card with its „amire épült" anchor chips, a quiet hand-off strip to
// A hét tanulságai). Handoff §3.1 + the §4 honest-state contracts.
//
// The data layer is the existing one, verbatim: useMeWeek / useWeeklyReview /
// useFeedback / useChatHandoff. What is NEW here is that the review's
// `highlights[]` — on the wire since mezo-p2tr and thrown away by every UI
// since — finally becomes the anchor-chip row, and that the closed-week-with-
// no-review branch stops borrowing the running week's „Hétfő reggel érkezik"
// ghost (handoff §4: that text is a lie on a week that is already over).
// ============================================================
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useMeWeek, useWeeklyReview, useFeedback } from '@/data/hooks'
import { ClayIcon, ClaySpot } from '@/shared/ui/clay'
import { MozaikPage, PageBody, PageHead } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { GhostState } from '@/shared/ui/GhostState'
import { Skeleton } from '@/shared/ui/Skeleton'
import { Spinner } from '@/shared/ui/Spinner'
import { FeedbackChips } from '@/features/insights/components/FeedbackChips'
import { WeekScoreBars } from '@/features/me/components/week/WeekScoreBars'
import { useChatHandoff } from '@/features/me/logic/useChatHandoff'
import { humanGeneratedAt } from '@/features/me/logic/humanGeneratedAt'
import { highlightChips } from '@/features/me/logic/weekHighlight'
import { isCurrentWeek, resolveWeekStart, weekHubPath } from '@/features/me/logic/weekNav'
import { deriveWeekTitle } from '@/data/fuel/fuelWeekHooks'
import { localDateString } from '@/shared/lib/dates'

export function WeekAnalysisPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const start = resolveWeekStart(params.get('start'))
  const todayIso = localDateString()
  const currentWeek = isCurrentWeek(start)

  const { week, isPending, isError, refetch } = useMeWeek(start)
  const { review, digest, regenerate, regenerating } = useWeeklyReview(start)
  const chat = useChatHandoff()
  // Unchanged weekly_review feedback kind — the review row IS the artifact (mezo-p2tr).
  const feedback = useFeedback('weekly_review', review ? [review.id] : [])

  const days = week?.days ?? []
  const score = week?.weekly.score ?? null
  // „N / 7 nap logolva" — the prototype's `logged`: days the Mezo could score.
  const loggedDays = days.filter((d) => d.score != null).length
  const chips = highlightChips(review?.highlights, digest)
  const stamp = humanGeneratedAt(review?.generatedAt)

  const openDay = (dateIso: string) => navigate(`/me/week/napok/${dateIso}`)

  return (
    <MozaikPage tone="lav" className="wk-analysis-page">
      <PageHead label="‹ Heti" onBack={() => navigate(weekHubPath(start))}>
        <span className="mz-eyebrow wka-headwk">{deriveWeekTitle(start)}</span>
      </PageHead>

      <div className="mz-page-hero">
        <div className="mz-hero-nm">Heti elemzés</div>
        <div className="mz-hero-row">
          <ClaySpot name="s-orb" size={59} />
          <span className="mz-bignum">
            {score != null ? (<>{score}<span className="wka-heroU"> / 100</span></>) : 'tanulom'}
          </span>
        </div>
        <div className="mz-hero-sb">
          {score != null
            ? (review ? 'napi pontszámok · a Mezo olvasata' : 'napi pontszámok · elemzés nélkül')
            : 'még gyűjtöm az adatokat a heti értékeléshez'}
        </div>
      </div>

      <PageBody>
        {isError ? (
          <GhostState message="Nem sikerült betölteni a hét adatait." ctaLabel="Újra" onCta={refetch} />
        ) : isPending && week == null ? (
          <div className="wka-skels">
            <Skeleton variant="card" height={126} />
            <Skeleton variant="card" height={178} />
            <Skeleton variant="card" height={62} />
          </div>
        ) : (
          <EntranceGroup replayKey={start}>
            {days.length > 0 && (
              <div className="wka-card rise" style={{ '--d': '0ms' } as React.CSSProperties}>
                <div className="wka-cardhead">
                  <span className="mz-eyebrow">Napi pontszám</span>
                  <span className="wka-hint">koppints egy napra</span>
                </div>
                <WeekScoreBars days={days} todayIso={todayIso} currentWeek={currentWeek} onSelect={openDay} />
              </div>
            )}

            <div className="wka-rev rise" style={{ '--d': '120ms' } as React.CSSProperties}>
              <div className="wka-revhead">
                <ClaySpot name="s-orb" size={31} />
                <span className="mz-eyebrow wka-revlab">Mezo · heti elemzés</span>
                {review && stamp && <span className="wka-stamp">{stamp}</span>}
              </div>

              {review ? (
                <>
                  <p className="wka-prose">{review.summary}</p>
                  {chips.length > 0 && (
                    <>
                      <div className="mz-eyebrow wka-hlab">amire épült</div>
                      <div className="wka-hlrow">
                        {chips.map((c, i) => {
                          const inner = (
                            <>
                              <ClayIcon name={c.icon} size={15} />
                              <span><em>{c.kindLabel}</em>{c.label}</span>
                            </>
                          )
                          return c.to ? (
                            <button
                              key={`${c.kindLabel}-${i}`}
                              type="button"
                              className={`wka-hlch tone-${c.tone}`}
                              onClick={() => navigate(c.to!)}
                            >
                              {inner}
                            </button>
                          ) : (
                            <span key={`${c.kindLabel}-${i}`} className={`wka-hlch tone-${c.tone} is-inert`}>
                              {inner}
                            </span>
                          )
                        })}
                      </div>
                    </>
                  )}
                  <div className="wka-revfoot">
                    {review.stale && (
                      <button type="button" className="wka-chatch" disabled={regenerating} onClick={() => void regenerate()}>
                        {regenerating
                          ? (<><Spinner size="sm" label="" />Frissítés…</>)
                          : '↻ Frissítsd az elemzést'}
                      </button>
                    )}
                    <button type="button" className="wka-chatch" disabled={chat.pending} onClick={() => chat.open({ kind: 'week', date: start })}>
                      {chat.pending ? (<><Spinner size="sm" label="" />Indítás…</>) : '💬 Beszélgess a hétről ›'}
                    </button>
                    <span className="wka-fb">
                      <FeedbackChips
                        key={review.id}
                        value={feedback.get(review.id)}
                        onVote={(verdict, reason) => feedback.vote(review.id, verdict, reason)}
                        label="a heti elemzésről"
                      />
                    </span>
                  </div>
                </>
              ) : currentWeek ? (
                <>
                  <p className="wka-ghost">
                    Hétfő reggel érkezik — a Mezo a lezárt hét adataiból írja meg. Addig a napok adatai
                    gyűlnek: <b>{loggedDays} / 7 nap</b> logolva.
                  </p>
                  <div className="wka-revfoot">
                    <button type="button" className="wka-chatch" disabled={chat.pending} onClick={() => chat.open({ kind: 'week', date: start })}>
                      {chat.pending ? (<><Spinner size="sm" label="" />Indítás…</>) : '💬 Beszélgess a hétről ›'}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="wka-ghost">
                    Ez a hét lezárt, de <b>nem készült elemzés</b> — a hét adatai megvannak, bármikor pótolható.
                  </p>
                  <div className="wka-revfoot">
                    <button type="button" className="wka-chatch" disabled={regenerating} onClick={() => void regenerate()}>
                      {regenerating
                        ? (<><Spinner size="sm" label="" />Elemzés készül…</>)
                        : '✦ Készítsd el most'}
                    </button>
                    <button type="button" className="wka-chatch" disabled={chat.pending} onClick={() => chat.open({ kind: 'week', date: start })}>
                      {chat.pending ? (<><Spinner size="sm" label="" />Indítás…</>) : '💬 Beszélgess a hétről ›'}
                    </button>
                  </div>
                </>
              )}
            </div>

            <button
              type="button"
              className="wka-lessgo rise"
              style={{ '--d': '200ms' } as React.CSSProperties}
              onClick={() => navigate(`/me/week/tanulsagok?start=${start}`)}
            >
              <ClayIcon name="i-kristaly" size={28} />
              <span className="grow">
                <span className="lb">A hét tanulságai</span>
                <span className="sub">még nincs javaslat</span>
              </span>
              <span className="chev" aria-hidden="true">›</span>
            </button>
          </EntranceGroup>
        )}
      </PageBody>
    </MozaikPage>
  )
}

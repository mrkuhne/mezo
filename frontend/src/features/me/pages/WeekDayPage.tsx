// ============================================================
// Mezo · WeekDayPage — `/me/week/napok/:date` (mezo-d20.6.10)
// Source of truth: docs/design_2.0/prototypes/src/en-body.html `#page-hday`
// + `dayPage()` / `dayNav()`, ×1.18 (330 → 390px frame). Handoff §3.5.
//
// ONE day, deep-linkable — the fix for audit gap §8.3/6: the expanded day
// used to live in component state, so nothing (a push notification least of
// all) could point at a single day. The week comes from `?start=`, or is
// DERIVED from `:date` when the query param is absent or belongs to another
// week; a malformed `:date` redirects to the days mosaic rather than
// crashing on a Date NaN.
//
// It also finally renders `kcalTarget`/`proteinTargetG` — fetched by
// `/api/me/week/{start}` today and thrown away by the UI (handoff §6.1).
// ============================================================
import type { CSSProperties } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { MozaikPage, PageBody, PageHead, MCells } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { ClayIcon, ClaySpot } from '@/shared/ui/clay'
import { Spinner } from '@/shared/ui/Spinner'
import { cn } from '@/shared/lib/cn'
import { huMonthDay, localDateString } from '@/shared/lib/dates'
import { deriveWeekTitle } from '@/data/fuel/fuelWeekHooks'
import { useFeedback, useMeWeek, useWeeklyReview } from '@/data/hooks'
import { FeedbackChips } from '@/features/insights/components/FeedbackChips'
import { useChatHandoff } from '@/features/me/logic/useChatHandoff'
import { resolveWeekStart } from '@/features/me/logic/weekNav'
import { scoreBandColor } from '@/features/me/logic/scoreBand'
import {
  DAY_COPY, SUBRING_LABEL, SUBSCORES, dayNoteFor, dayState, dayVerdict, fmtSleep, hu1, huDowFull,
  huInt, isInWeek, isValidIsoDate, mondayOf, ringLearningLabels,
} from '@/features/me/logic/weekDay'
import { WeekScoreRing } from '@/features/me/components/week/WeekScoreRing'
import { DayNavTiles } from '@/features/me/components/week/DayNavTiles'
import { WeekPageSkeleton, WeekPageError } from '@/features/me/components/week/WeekLoadStates'
import type { MeWeekDay } from '@/data/me/meWeek'

/** One of the four sub-score rings under „Miből jött össze". */
function SubRing({ value, label }: { value: number | null | undefined; label: string }) {
  const style = { '--c': scoreBandColor(value), '--v': value ?? 0 } as CSSProperties
  return (
    <div className="wkd-subring">
      <div className={cn('wkd-sring', value == null && 'is-dash')} style={style}>
        <i>{value ?? '—'}</i>
      </div>
      <small>{label}</small>
    </div>
  )
}

/** A goal bar — rendered ONLY when both the value and its target are on the wire. */
function GoalRow({ name, value, target, unit, fill, delayMs }: {
  name: string; value: number; target: number | null | undefined; unit: string; fill: string; delayMs: number
}) {
  if (target == null || target <= 0) return null
  const pct = Math.min(100, Math.round((value / target) * 100))
  return (
    <div className="wkd-tgrow">
      <span className="nm">{name}</span>
      <div className="wkd-gbar">
        <div className={fill} style={{ width: `${pct}%`, '--d': `${delayMs}ms` } as CSSProperties} />
      </div>
      <span className="vl">{huInt(value)} / {huInt(target)}{unit}</span>
    </div>
  )
}

function DayChips({ day }: { day: MeWeekDay }) {
  return (
    <div className="wkd-chips wkd-herochips">
      {day.kcal != null && (
        <span className="wkd-chip"><ClayIcon name="i-fuel" size={12} />{huInt(day.kcal)} kcal</span>
      )}
      {day.sleepMin != null && (
        <span className="wkd-chip">
          <ClayIcon name="i-alvas" size={12} />
          {fmtSleep(day.sleepMin)}{day.sleepQuality != null ? ` · Q${day.sleepQuality}` : ''}
        </span>
      )}
      {day.workoutCount > 0 && (
        <span className="wkd-chip"><ClayIcon name="i-edzes" size={12} />{day.workoutCount}× edzés</span>
      )}
      <span className={cn('wkd-chip', !day.checkinCount && 'is-mut')}>
        <ClayIcon name="i-checkin" size={12} />{day.checkinCount}/4 check-in
      </span>
    </div>
  )
}

export function WeekDayPage() {
  const navigate = useNavigate()
  const { date } = useParams<{ date: string }>()
  const [params] = useSearchParams()

  // The week: `?start=` when it is a Monday that actually CONTAINS the day, otherwise derived
  // from the date itself (a bare deep link carries no query param).
  const valid = isValidIsoDate(date)
  const rawStart = params.get('start')
  const derived = valid ? mondayOf(date) : ''
  const start = valid
    ? (rawStart && resolveWeekStart(rawStart) === rawStart && isInWeek(date, rawStart) ? rawStart : derived)
    : ''

  const { week, isPending, isError, refetch } = useMeWeek(start || derived || localDateString())
  const { review } = useWeeklyReview(start || derived || localDateString())
  const chat = useChatHandoff()
  const feedback = useFeedback('weekly_review', review ? [review.id] : [])
  const today = localDateString()

  // Hooks first, THEN the bail-out: a malformed `:date` must not crash the page.
  if (!valid) return <Navigate to="/me/week/napok" replace />

  const days = week?.days ?? []
  const idx = days.findIndex((d) => d.date === date)
  const day = idx >= 0 ? days[idx] : null
  const state = day ? dayState(day, today) : 'empty'
  const note = dayNoteFor(review, date)
  const ringWords = ringLearningLabels(state)

  const backToDays = () => navigate(`/me/week/napok?start=${start}`)

  return (
    <MozaikPage tone="sage" className="wkd-page">
      <PageHead label="‹ Napok" onBack={backToDays}>
        <span className="mz-eyebrow wkd-headtitle">{deriveWeekTitle(start)}</span>
      </PageHead>

      <div className="mz-page-hero">
        <div className="mz-hero-nm">
          {huDowFull(date)}<span className="wkd-heronm-date"> · {huMonthDay(date).toLowerCase()}</span>
          {date === today && <span className="wkd-ma wkd-heroma">MA</span>}
        </div>
        {day && (
          <>
            <div className="wkd-herorow">
              <WeekScoreRing
                className="is-day"
                score={state === 'scored' ? day.score ?? null : null}
                learningLabel={ringWords.label}
                learningCaption={ringWords.caption}
              />
              <DayChips day={day} />
            </div>
            <div className="mz-hero-sb">{dayVerdict(day, days, today)}</div>
          </>
        )}
      </div>

      <PageBody>
        {isError ? (
          <WeekPageError onRetry={refetch} />
        ) : week == null ? (
          <WeekPageSkeleton pending={isPending} />
        ) : day == null ? (
          <p className="wkd-empty">Ez a nap nem ehhez a héthez tartozik.</p>
        ) : (
          <EntranceGroup replayKey={date}>
            {state === 'future' ? (
              <div className="wkd-ghost rise" style={{ '--d': '0ms' } as CSSProperties}>
                <p>{DAY_COPY.futurePage}</p>
              </div>
            ) : (
              <>
                <section className="wkd-card rise" style={{ '--d': '0ms' } as CSSProperties}>
                  <div className="mz-eyebrow">Miből jött össze</div>
                  <div className="wkd-subrings">
                    {SUBSCORES.map((s) => (
                      <SubRing key={s.key} value={day.subscores[s.key]} label={SUBRING_LABEL[s.key]} />
                    ))}
                  </div>
                  {state !== 'scored' && (
                    <p className="wkd-note wkd-note-block">
                      {state === 'empty' ? DAY_COPY.emptyPage : DAY_COPY.thinPage}
                    </p>
                  )}
                </section>

                {day.kcal != null && (
                  <section className="wkd-card rise" style={{ '--d': '50ms' } as CSSProperties}>
                    <div className="mz-eyebrow">Fuel · a cél ellenében</div>
                    <GoalRow name="kcal" value={day.kcal} target={day.kcalTarget} unit="" fill="is-coral" delayMs={150} />
                    {day.proteinG != null && (
                      <GoalRow name="fehérje" value={day.proteinG} target={day.proteinTargetG} unit=" g" fill="is-sage" delayMs={230} />
                    )}
                    {(day.carbsG != null || day.fatG != null) && (
                      <div className="wkd-tgrow">
                        <span className="nm">c · f</span>
                        <div className="wkd-gbar">
                          <div
                            className="is-gold"
                            style={{
                              width: `${Math.min(100, Math.round(((day.carbsG ?? 0) / 400) * 100))}%`,
                              '--d': '310ms',
                            } as CSSProperties}
                          />
                        </div>
                        <span className="vl">
                          {day.carbsG != null ? `${day.carbsG} g` : '—'} · {day.fatG != null ? `${day.fatG} g` : '—'}
                        </span>
                      </div>
                    )}
                  </section>
                )}

                <MCells
                  className="rise wkd-cells"
                  cells={[
                    {
                      label: `alvás${day.sleepQuality != null ? ` · Q${day.sleepQuality}` : ''}`,
                      tone: 'lav',
                      value: day.sleepMin != null ? fmtSleep(day.sleepMin) : '—',
                    },
                    { label: 'edzés', tone: 'coral', value: `${day.workoutCount}×` },
                    { label: 'súly · kg', tone: 'sky', value: day.weightKg != null ? hu1(day.weightKg) : '—' },
                    { label: 'xp', tone: 'amber', value: day.xp ?? '—' },
                  ]}
                />

                {note != null ? (
                  <section className="wkd-orbcard rise" style={{ '--d': '130ms' } as CSSProperties}>
                    <div className="wkd-orbrow">
                      <ClaySpot name="s-orb" size={28} />
                      <span className="mz-eyebrow wkd-orb-eyebrow">Mezo · erről a napról</span>
                    </div>
                    <p className="wkd-prose">{note}</p>
                    <div className="wkd-orbfoot">
                      <button
                        type="button"
                        className="wkd-chatch"
                        disabled={chat.pending}
                        onClick={() => chat.open({ kind: 'day', date })}
                      >
                        {chat.pending
                          ? <><Spinner size="sm" label="" />Indítás…</>
                          : 'Beszélgess a napról ›'}
                      </button>
                      {review && (
                        <FeedbackChips
                          key={review.id}
                          value={feedback.get(review.id)}
                          onVote={(verdict, reason) => feedback.vote(review.id, verdict, reason)}
                          label="a napról írt jegyzetről"
                        />
                      )}
                    </div>
                  </section>
                ) : (
                  <section className="wkd-ghost rise" style={{ '--d': '130ms' } as CSSProperties}>
                    <p>{review ? DAY_COPY.noNote : DAY_COPY.noReview}</p>
                    <button
                      type="button"
                      className="wkd-chatch"
                      disabled={chat.pending}
                      onClick={() => chat.open({ kind: 'day', date })}
                    >
                      {chat.pending
                        ? <><Spinner size="sm" label="" />Indítás…</>
                        : 'Beszélgess a napról ›'}
                    </button>
                  </section>
                )}
              </>
            )}

            <DayNavTiles
              prev={idx > 0 ? days[idx - 1] : null}
              next={idx >= 0 && idx < days.length - 1 ? days[idx + 1] : null}
              onGo={(d) => navigate(`/me/week/napok/${d}?start=${start}`)}
            />
          </EntranceGroup>
        )}
      </PageBody>
    </MozaikPage>
  )
}

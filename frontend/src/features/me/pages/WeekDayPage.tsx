// ============================================================
// Mezo · WeekDayPage — `/me/week/napok/:date` (mezo-d20.6.10 → mezo-jcpt.4)
// Source of truth: the approved day-evaluation prototype (screens 1 „Lezárt nap"
// and 2 „Ma, napközben"), in the Mozaik 2.0 language.
//
// ONE day, deep-linkable — the fix for audit gap §8.3/6: the expanded day
// used to live in component state, so nothing (a push notification least of
// all) could point at a single day. The week comes from `?start=`, or is
// DERIVED from `:date` when the query param is absent or belongs to another
// week; a malformed `:date` redirects to the days mosaic rather than
// crashing on a Date NaN.
//
// mezo-jcpt.4 — the page's JUDGEMENT now comes from `GET /api/me/day/{date}/
// evaluation` (`useDayEvaluation`): six weighted dimensions, the Mezo's
// cross-context narrative, and the ±5 AI adjustment shown as its own chip and
// its own reasoned row. `useMeWeek` stays the source of the raw day signals it
// alone carries — the hero chips, the kcal/protein goal bars (`kcalTarget` /
// `proteinTargetG`, handoff §6.1) and the mcells — and of the neighbour tiles.
//
// The evaluation's `state` drives everything honest about the page: it is the
// one place that knows the day is still OPEN (`in_progress` — a dashed „este
// zárom" ring, never a part-way number), which `dayState`'s four week-level
// states cannot express. When the evaluation has not resolved (or errored) in
// real mode the page falls back to `dayState` + the week's own score, so a
// failed evaluation degrades to the pre-jcpt page rather than to nothing.
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
import { useMeWeek } from '@/data/hooks'
import { useDayEvaluation } from '@/data/me/dayEvaluationHooks'
import { normalizeDayEvaluation, type NormalizedDayEvaluation } from '@/data/me/dayEvaluation'
import { useChatHandoff } from '@/features/me/logic/useChatHandoff'
import { resolveWeekStart } from '@/features/me/logic/weekNav'
import {
  DAY_COPY, DAY_DIMENSIONS, dayState, dayVerdict, doneDimensionCount, fmtSleep, hu1, huDowFull,
  huInt, isInWeek, isValidIsoDate, mondayOf, ringLearningLabels,
} from '@/features/me/logic/weekDay'
import { WeekScoreRing } from '@/features/me/components/week/WeekScoreRing'
import { DayNavTiles } from '@/features/me/components/week/DayNavTiles'
import { DayDimensionTile, DayDimRing } from '@/features/me/components/week/DayDimensionTile'
import { DayReviewCard } from '@/features/me/components/week/DayReviewCard'
import { WeekPageSkeleton, WeekPageError } from '@/features/me/components/week/WeekLoadStates'
import type { MeWeekDay } from '@/data/me/meWeek'

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

/** The six dimensions in their config-weight order, EXCEPT that what is already final floats
 *  up — the prototype's „ami véglegesedett, felúszik" rule for an open day. On a closed day
 *  every dimension is DONE, so the order is exactly `DAY_DIMENSIONS`'. */
function orderedDimensions(evaluation: NormalizedDayEvaluation) {
  const rank = new Map(DAY_DIMENSIONS.map((d, i) => [d.key, i]))
  return [...evaluation.dimensions].sort((a, b) => {
    const done = Number(b.status === 'DONE') - Number(a.status === 'DONE')
    return done !== 0 ? done : (rank.get(a.id) ?? 99) - (rank.get(b.id) ?? 99)
  })
}

/** The one line under the hero — each state gets its own sentence, never a shared hedge. */
function heroSubtitle(
  state: NormalizedDayEvaluation['state'],
  evaluation: NormalizedDayEvaluation | null,
  day: MeWeekDay | null,
  days: readonly MeWeekDay[],
  today: string,
): string {
  if (state === 'future') return 'még előtted'
  if (state === 'empty') return 'ezen a napon nem logoltál'
  if (state === 'thin') return 'kevés adat a pontszámhoz'
  if (state === 'in_progress' && evaluation) {
    const done = doneDimensionCount(evaluation.dimensions)
    return `${done} dimenzió kész · ${evaluation.dimensions.length - done} még íródik`
  }
  return day ? dayVerdict(day, days, today) : ''
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
  const evalQuery = useDayEvaluation(date ?? '')
  const chat = useChatHandoff()
  const today = localDateString()

  // Hooks first, THEN the bail-out: a malformed `:date` must not crash the page.
  if (!valid) return <Navigate to="/me/week/napok" replace />

  const days = week?.days ?? []
  const idx = days.findIndex((d) => d.date === date)
  const day = idx >= 0 ? days[idx] : null
  const evaluation = evalQuery.data ? normalizeDayEvaluation(evalQuery.data) : null
  // The evaluation owns the state; without it the page degrades to the week-level four.
  const state = evaluation?.state ?? (day ? dayState(day, today) : 'empty')
  const open = state === 'in_progress'
  const scored = state === 'scored'
  const heroScore = evaluation ? evaluation.score : (scored ? day?.score ?? null : null)
  const ringWords = open
    ? { label: 'este zárom', caption: 'folyamatban' }
    : ringLearningLabels(state)

  const backToDays = () => navigate(`/me/week/napok?start=${start}`)

  const chatButton = (
    <button
      type="button"
      className="wkd-chatch"
      disabled={chat.pending}
      onClick={() => chat.open({ kind: 'day', date })}
    >
      {chat.pending ? <><Spinner size="sm" label="" />Indítás…</> : 'Beszélgess a napról ›'}
    </button>
  )

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
                className={cn('is-day', open && 'dev-ringdash')}
                score={heroScore}
                learningLabel={ringWords.label}
                learningCaption={ringWords.caption}
              />
              <DayChips day={day} />
            </div>
            {evaluation?.base != null && (
              <div className="dev-scorechips">
                <span>alap {evaluation.base}</span>
                {evaluation.adjustment && (
                  <span className="is-mezo">
                    Mezo-kontextus {evaluation.adjustment.delta < 0 ? '−' : '+'}
                    {Math.abs(evaluation.adjustment.delta)}
                  </span>
                )}
              </div>
            )}
            <div className="mz-hero-sb">{heroSubtitle(state, evaluation, day, days, today)}</div>
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
                {evaluation && scored && (
                  <DayReviewCard evaluation={evaluation} delayMs={0}>{chatButton}</DayReviewCard>
                )}

                {(state === 'thin' || state === 'empty') && (
                  <div className="wkd-ghost rise" style={{ '--d': '30ms' } as CSSProperties}>
                    <p>{state === 'empty' ? DAY_COPY.emptyPage : DAY_COPY.thinPage}</p>
                    {chatButton}
                  </div>
                )}

                {scored && evaluation && (
                  <section className="wkd-card rise" style={{ '--d': '50ms' } as CSSProperties}>
                    <div className="mz-eyebrow">Miből jött össze</div>
                    <div className="dev-subrings">
                      {orderedDimensions(evaluation).map((d) => (
                        <div key={d.id} className="dev-subring">
                          <DayDimRing score={d.score} />
                          <small>{DAY_DIMENSIONS.find((x) => x.key === d.id)?.label ?? d.label}</small>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {evaluation && state !== 'empty' && orderedDimensions(evaluation).map((d, i) => (
                  <DayDimensionTile key={d.id} dimension={d} delayMs={90 + i * 40} />
                ))}

                {open && (
                  <section className="dev-waiting rise" style={{ '--d': '350ms' } as CSSProperties}>
                    <ClaySpot name="s-orb-figyel" size={26} className="dev-orbb" />
                    <p>A napodról a zárás után írok — addig gyűjtöm, ami történik.</p>
                    {chatButton}
                  </section>
                )}

                {day.kcal != null && (
                  <section className="wkd-card rise" style={{ '--d': '370ms' } as CSSProperties}>
                    <div className="mz-eyebrow">Fuel · a cél ellenében</div>
                    <GoalRow name="kcal" value={day.kcal} target={day.kcalTarget} unit="" fill="is-coral" delayMs={450} />
                    {day.proteinG != null && (
                      <GoalRow name="fehérje" value={day.proteinG} target={day.proteinTargetG} unit=" g" fill="is-sage" delayMs={520} />
                    )}
                  </section>
                )}

                {evaluation && evaluation.context.length > 0 && (
                  <section className="dev-ctx rise" style={{ '--d': '390ms' } as CSSProperties}>
                    <div className="mz-eyebrow dev-ctxeb">Kontextus · nem pontozott</div>
                    <div className="dev-fchips">
                      {evaluation.context.map((c) => (
                        <span key={`${c.label}·${c.value}`} className="dev-fchip">{c.label} · {c.value}</span>
                      ))}
                    </div>
                    <p className="dev-why is-mut">
                      Ezt a Mezo látja az értékeléshez, de pontot nem kap — az érzéseidet és a
                      súlyingadozást nem osztályozzuk.
                    </p>
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

                {!evaluation && scored && chatButton}
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

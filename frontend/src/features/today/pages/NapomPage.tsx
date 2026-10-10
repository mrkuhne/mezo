// ============================================================
// Mezo · NapomPage — `/nap/napom` + `/nap/napom/:date` (mezo-yjzhw.4, spec 2026-09-24)
// Look: Folyadék (mezo-n4wf5.2, slice F2) — build target `napDay` / `ndDayBody` in
// docs/design_2.0/prototypes/vilagos/nap.js. Replaces the retired Heti single-day page
// (`/me/week/napok/:date` now redirects here).
//
// One day, read two ways:
//   · TODAY is live — a tank filled by progress, "N/6 terület kész", a one-line reading and the
//     one next step, both from pure rules (`logic/napom.ts`, no LLM). No overall number during
//     the day.
//   · a CLOSED, scored day leads with the tank at its score, the base + the Mezo's ±5 correction
//     (reason shown, foldable), the Mezo's overnight note, six rows open by default and the
//     day's context (which does not score).
// Thin/empty days say so in a jar hero; a future day is a promise; an unresolved evaluation is
// an honest pending tank with no number (mezo-ahf5b), a failed one a retry.
//
// Morning mode: `/nap/napom` with no date opens YESTERDAY while its overnight review is unseen
// (`isMorningMode`), and marks it seen once it is on screen. The decision is latched per
// navigation, so marking it seen does not flip the page to today under the reader.
// ============================================================
import { useEffect, useState } from 'react'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useCheckinDayRating, useDayEvaluation, useMeWeek, useRitualDay, normalizeDayEvaluation } from '@/data/hooks'
import { usePrefetchDayEvaluations } from '@/data/me/dayEvaluationHooks'
import { deriveWeekTitle } from '@/data/fuel/fuelWeekHooks'
import type { NormalizedDayEvaluation, NormalizedDayDimension } from '@/data/me/dayEvaluation'
import { addDays, huMonthDay, localDateString } from '@/shared/lib/dates'
import { cn } from '@/shared/lib/cn'
import { Btn, Card, Hero, Jar, Msg, Note, Page, Row, Section, Tank, useFrameTitle } from '@/shared/ui/folyadek'
import { DAY_COPY, dayState, dayVerdict, huDowFull, isValidIsoDate, mondayOf } from '@/features/me/logic/weekDay'
import { useChatHandoff } from '@/features/me/logic/useChatHandoff'
import { dayReading, doneCount, isMorningMode, markSeen, nextBestAction, type NextActionKind } from '@/features/today/logic/napom'
import { useChangedKeys } from '@/features/today/logic/useChangedKeys'
import { NapomWeekStrip } from '@/features/today/components/napom/NapomWeekStrip'
import { NAPOM_DIMENSIONS, NapomDimensionRow, factLineOf, type NapomRowMode } from '@/features/today/components/napom/NapomDimensionRow'
import { NapomLeadCard } from '@/features/today/components/napom/NapomLeadCard'
import { NapomDayRatingCard } from '@/features/today/components/napom/NapomDayRatingCard'
import { NapomReviewCard } from '@/features/today/components/napom/NapomReviewCard'

/** `+3` / `−2` — U+2212 for the minus, as every other HU numeral in the app. */
const fmtDelta = (delta: number) => (delta < 0 ? `−${Math.abs(delta)}` : `+${delta}`)
const hhmm = (ms: number) => {
  const d = new Date(ms)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** A dimension the evaluation does not carry (or has not delivered yet) — honest NO_DATA. */
const placeholder = (id: NormalizedDayDimension['id']): NormalizedDayDimension => ({
  id, label: '', weight: 0, score: null, status: 'NO_DATA', facts: [], note: null,
})

/** The six rows in `DAY_DIMENSIONS` order, whatever order the wire sent. */
const rowsOf = (ev: NormalizedDayEvaluation | null) =>
  NAPOM_DIMENSIONS.map((m) => ev?.dimensions.find((d) => d.id === m.key) ?? placeholder(m.key))

/** The pulse snapshot's key for the tank's number (`N/6` done count) — not a dimension id. */
const CENTER = '·center'

/** `id → what the reader sees` for today's open evaluation: each row's score, status and fact
 *  line, and the centre's done count. A change in any of them pulses that row / the centre. */
function pulseSnapshot(ev: NormalizedDayEvaluation): Record<string, string> {
  const snap: Record<string, string> = { [CENTER]: String(doneCount(ev)) }
  for (const d of rowsOf(ev)) snap[d.id] = `${d.score ?? '–'}|${d.status}|${factLineOf(d, 'today')}`
  return snap
}

/** The tank CTA's wording per next step; the target stays the action's own `to`. */
const CTA_LABEL: Record<NextActionKind, string> = {
  napzaras: 'Napzárás indítása',
  workout: 'Edzés megnyitása',
  checkin: 'Check-in',
}

/** `a hét legjobb napja` → `A hét legjobb napja.` */
const asSentence = (s: string) => `${s.charAt(0).toUpperCase()}${s.slice(1)}${/[.!?…]$/.test(s) ? '' : '.'}`

export function NapomPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { date: param } = useParams<{ date: string }>()
  const today = localDateString()
  const yesterday = addDays(today, -1)
  const hasParam = param !== undefined
  const valid = !hasParam || isValidIsoDate(param)

  // Morning mode, latched per navigation (location.key): once decided it holds even after
  // `markSeen` below makes `isMorningMode` false, so the page never flips under the reader.
  const yEval = useDayEvaluation(yesterday)
  const [latch, setLatch] = useState<{ key: string; morning: boolean } | null>(null)
  const ySettled = yEval.data !== undefined || yEval.error != null
  if (!hasParam && ySettled && latch?.key !== location.key) {
    setLatch({ key: location.key, morning: isMorningMode(yEval.data ? normalizeDayEvaluation(yEval.data) : null) })
  }
  const deciding = !hasParam && latch?.key !== location.key
  const morning = !hasParam && !deciding && latch?.morning === true
  const date = hasParam && valid ? param : morning ? yesterday : today

  const evalQuery = useDayEvaluation(date)
  // Today's napzárás state — the lead card only runs for today, so only today's ritual matters.
  const todayRitual = useRitualDay(today)
  const monday = mondayOf(date)
  const { week } = useMeWeek(monday)
  // Check-in 2.0 (mezo-ck2): the evening check-in's own verdict of the viewed day, if given.
  const dayRating = useCheckinDayRating(date)
  usePrefetchDayEvaluations([addDays(date, -1), addDays(date, 1)].filter((d) => d <= today))

  // Yesterday counts as SEEN only once its overnight review is actually on screen — a scored
  // evaluation with a review behind it. Opening yesterday before the close (in_progress, or
  // scored with no prose) must not swallow the morning dot the review will earn later.
  const viewed = evalQuery.data
  const evaluation = viewed ? normalizeDayEvaluation(viewed) : null
  const reviewShown = viewed?.state === 'scored' && viewed.reviewId != null
  useEffect(() => {
    if (!deciding && date === yesterday && reviewShown) markSeen(yesterday)
  }, [deciding, date, yesterday, reviewShown])

  // The live pulse (spec §4, mezo-yjzhw.6): only TODAY's open evaluation is compared, one entry
  // per row (score · status · the fact line the reader sees) plus the N/6 centre. Anything else
  // (loading, a past or closed day) is `null`, which resets the baseline — so the first render,
  // the mock seed, a date change and past days never pulse.
  const chat = useChatHandoff()
  // The correction's reason shows by default (owner 2026-09-26, mezo-7izrx); a tap folds it away.
  const [adjOpen, setAdjOpen] = useState(true)
  // The title bar's eyebrow names the viewed week (the old page head's second line).
  useFrameTitle({ eyebrow: `Nap · ${deriveWeekTitle(monday).toLowerCase()}` })

  const liveEval = !deciding && date === today && evaluation?.state === 'in_progress' ? evaluation : null
  const fresh = useChangedKeys(liveEval ? pulseSnapshot(liveEval) : null, date)

  // Hooks first, THEN the bail-out: a malformed `:date` must not crash the page.
  if (!valid) return <Navigate to="/nap/napom" replace />

  const days = week?.days ?? []
  const day = days.find((d) => d.date === date) ?? null
  const isToday = date === today
  const loading = deciding || (evaluation == null && evalQuery.error == null)
  const failed = !loading && evaluation == null
  const state = evaluation?.state ?? null
  const scored = state === 'scored'
  const open = state === 'in_progress'
  const live = isToday || open
  const rows = rowsOf(loading ? null : evaluation)

  const dayLabel = `${huDowFull(date)} · ${huMonthDay(date).toLowerCase()}`
  const closedLabel = `${dayLabel} · lezárva`
  const toToday = !isToday ? <Btn onClick={() => navigate(`/nap/napom/${today}`)}>Vissza a mai napra</Btn> : undefined

  // No lead until today's ritual state is KNOWN (mezo-yjzhw.7): real mode's pending ritual
  // reads as "not closed", which would flash the evening napzárás offer on a closed day.
  const action = isToday && evaluation && open && !todayRitual.isPending
    ? nextBestAction(evaluation, day, new Date(), todayRitual.data.closed)
    : null
  const rowMode: NapomRowMode = loading ? 'loading' : scored ? 'scored' : open ? 'today' : 'plain'
  const adjustment = scored && evaluation?.base != null ? evaluation.adjustment : null

  const hero = (() => {
    if (loading) {
      return (
        <div className="nn-hero" role="group" aria-label="számolom · egy pillanat">
          <Tank pct={44} height={400} num="…" cap="számolom · egy pillanat" label={dayLabel} verdict="Összeszedem a napodat." />
        </div>
      )
    }
    if (failed) {
      return (
        <div className="nn-jhero" role="alert">
          <Hero
            warn
            label={dayLabel}
            verdict="Nem sikerült betölteni a napot."
            sub="A többi oldal működik. Próbáld újra egy pillanat múlva."
            actions={<Btn onClick={() => evalQuery.refetch()}>Próbáld újra</Btn>}
          >
            <Jar pct={0} size={80} text="?" />
          </Hero>
        </div>
      )
    }
    if (!evaluation) return null
    if (state === 'future') {
      return (
        <div className="nn-jhero">
          <Hero label={dayLabel} verdict="Még előtted." sub={DAY_COPY.futurePage} actions={toToday}>
            <Jar pct={0} size={80} />
          </Hero>
        </div>
      )
    }
    if (state === 'thin' || state === 'empty') {
      return (
        <div className="nn-jhero">
          <Hero
            label={live ? dayLabel : closedLabel}
            verdict="Erre a napra kevés az adat."
            sub={state === 'empty' ? DAY_COPY.emptyPage : DAY_COPY.thinPage}
            actions={toToday}
          >
            <Jar pct={state === 'empty' ? 0 : 7} size={80} text="–" />
          </Hero>
        </div>
      )
    }
    if (open) {
      const done = doneCount(evaluation)
      const updated = evalQuery.dataUpdatedAt > 0 ? ` · ${hhmm(evalQuery.dataUpdatedAt)}` : ''
      return (
        <div className={cn('nn-hero', fresh.has(CENTER) && 'is-fresh')} role="group" aria-label={`${done} / 6 terület kész`}>
          <Tank
            // The vessel keeps room for the three-line reading above the liquid: 0–6 done areas
            // move the level inside the tank's 44–66% band (the prototype's live tank stands at 57).
            pct={44 + (done / 6) * 22}
            height={440}
            num={`${done}/6`}
            cap={`terület kész · élő${updated}`}
            label={dayLabel}
            verdict={isToday ? dayReading(evaluation, day) : undefined}
            cta={action ? CTA_LABEL[action.kind] : undefined}
            onCta={action ? () => navigate(action.to) : undefined}
          />
        </div>
      )
    }
    // Scored. The verdict is the week's own sentence about the day; without the week's data the
    // day's key highlight speaks, and with neither the tank simply carries no sentence.
    const verdict = day && dayState(day, today) === 'scored'
      ? dayVerdict(day, days, today)
      : evaluation.highlights.find((h) => h.kind === 'key')?.label ?? null
    return (
      <div className="nn-hero" role="group" aria-label={`Pontszám: ${evaluation.score} / 100`}>
        <Tank
          // The base line stands 24px above the liquid, under the verdict: the score moves the
          // level inside the 56–66% band (the prototype's 87 stands at 66), the number says the rest.
          pct={56 + (evaluation.score ?? 0) / 10}
          height={430}
          num={evaluation.score}
          cap="a 100-ból · hat területből"
          label={live ? dayLabel : closedLabel}
          verdict={verdict ? asSentence(verdict) : undefined}
          marks={[75, 50, 25]}
          cta={chat.pending ? 'Indítás…' : 'Beszélgess a napról'}
          onCta={() => { if (!chat.pending) chat.open({ kind: 'day', date }) }}
          extra={adjustment && evaluation.base != null ? (
            <button type="button" className="fo-tank-shift" aria-expanded={adjOpen} onClick={() => setAdjOpen((o) => !o)}>
              <span>alap {evaluation.base}</span>
              <span>a Mezo szerint <b>{fmtDelta(adjustment.delta)}</b> <span aria-hidden="true">{adjOpen ? '▴' : '▾'}</span></span>
            </button>
          ) : undefined}
        />
      </div>
    )
  })()

  // Section numbers follow what is actually rendered, top to bottom.
  let count = 0
  const next = () => (count += 1)
  const showRows = loading || (evaluation != null && state !== 'future')
  const rowsTitle = loading
    ? (isToday ? 'Ma eddig · 6 terület' : '6 terület')
    : open
      ? (isToday ? 'Ma eddig · 6 terület' : 'Eddig · 6 terület')
      : scored ? 'Miből jött össze' : 'Amit erről a napról tudunk'

  return (
    <Page className="nn-page">
      <NapomWeekStrip
        date={date}
        today={today}
        days={days}
        liveDone={isToday && open && evaluation ? doneCount(evaluation) : null}
        onPick={(iso) => navigate(`/nap/napom/${iso}`)}
      />

      {hero}

      {isToday && evaluation && !loading && (
        <p className="nn-under">Napközben nincs pontszám. Hajnali 3-kor zárom a napot, és reggelre megírom, milyen volt.</p>
      )}

      {adjustment && adjOpen && (
        <Card className="nn-adj">
          <Msg member="mezo" meta={`miért ${fmtDelta(adjustment.delta)}?`}>{adjustment.reason}</Msg>
          <Note>A szaggatott vonal az alap-pontszám szintje; a folyadék a végső pontszámig ér.</Note>
        </Card>
      )}

      {action && <NapomLeadCard action={action} n={next()} />}

      {scored && evaluation && evaluation.narrative.length > 0 && (
        <NapomReviewCard evaluation={evaluation} n={next()} />
      )}

      {showRows && (
        <>
          <Section n={next()} title={rowsTitle} />
          <Card className="nn-rowscard">
            {rows.map((d) => (
              <NapomDimensionRow
                key={`${date}-${d.id}`}
                dimension={d}
                mode={rowMode}
                goalTick={d.id === 'nutrition' && day?.kcalTarget != null}
                fresh={fresh.has(d.id)}
              />
            ))}
            {scored && <Note>Koppints egy területre a részletekért.</Note>}
          </Card>
        </>
      )}

      {dayRating != null && !deciding && (
        <NapomDayRatingCard rating={dayRating} score={scored && evaluation ? evaluation.score : null} n={next()} />
      )}

      {scored && evaluation && evaluation.context.length > 0 && (
        <>
          <Section n={next()} title="A nap körülményei" />
          <Card>
            <div className="nn-ctx">
              {evaluation.context.map((c) => (
                <div key={`${c.label}·${c.value}`}><small>{c.label}</small><b>{c.value}</b></div>
              ))}
            </div>
            <Note>Ezek nem számítanak a pontba. Ha utólag beírsz még valamit erre a napra, a jegyzetet egyszer újraírom.</Note>
          </Card>
        </>
      )}

      {scored && !(evaluation && evaluation.context.length > 0) && (
        <Note>Ha utólag beírsz még valamit erre a napra, a jegyzetet egyszer újraírom.</Note>
      )}

      {morning && date === yesterday && (
        <>
          <Section n={next()} title="Reggeli összefoglaló · kész" />
          <Card>
            <Row
              icon="t-sun"
              title="Tovább a mai napra"
              sub={`${huDowFull(today).toLowerCase()} · élő nap`}
              onClick={() => navigate(`/nap/napom/${today}`)}
            />
          </Card>
        </>
      )}
    </Page>
  )
}

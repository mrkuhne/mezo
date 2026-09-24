// ============================================================
// Mezo · NapomPage — `/nap/napom` + `/nap/napom/:date` (mezo-yjzhw.4, spec 2026-09-24)
// Source of truth: docs/design_2.0/prototypes/src/uveg-napod-body.html `nap()` / `dayBody()`
// with layout 2 (banded rows), in the Üveg material, owner OK 2026-09-24. Replaces the retired
// Heti single-day page (`/me/week/napok/:date` now redirects here).
//
// One day, read two ways:
//   · TODAY is live — a six-segment ring filled by progress, "N/6 terület kész", a one-line
//     reading and the one next step, both from pure rules (`logic/napom.ts`, no LLM). No
//     overall number during the day.
//   · a CLOSED, scored day leads with the Mezo's overnight note, the gradient score with its
//     base + the Mezo's ±5 correction behind a toggle, six expandable rows and the day's
//     context (which does not score).
// Thin/empty days say so on a dashed card; a future day is a dashed promise; an unresolved
// evaluation is an honest pending ring with no number (mezo-ahf5b), a failed one a retry.
//
// Morning mode: `/nap/napom` with no date opens YESTERDAY while its overnight review is unseen
// (`isMorningMode`), and marks it seen once it is on screen. The decision is latched per
// navigation, so marking it seen does not flip the page to today under the reader.
//
// Owner 2026-09-24: no italic serif on this page — every Mezo sentence is upright Geist.
// ============================================================
import { useEffect, useState, type CSSProperties } from 'react'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useDayEvaluation, useMeWeek, useRitualDay, normalizeDayEvaluation } from '@/data/hooks'
import { usePrefetchDayEvaluations } from '@/data/me/dayEvaluationHooks'
import { deriveWeekTitle } from '@/data/fuel/fuelWeekHooks'
import type { NormalizedDayEvaluation, NormalizedDayDimension } from '@/data/me/dayEvaluation'
import { addDays, huMonthDay, localDateString } from '@/shared/lib/dates'
import { Icon3D } from '@/shared/ui/clay'
import { MozaikPage } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { DAY_COPY, dayState, dayVerdict, huDowFull, isValidIsoDate, mondayOf } from '@/features/me/logic/weekDay'
import { dayReading, doneCount, isMorningMode, markSeen, nextBestAction } from '@/features/today/logic/napom'
import { NapomWeekStrip } from '@/features/today/components/napom/NapomWeekStrip'
import { NapomSegRing } from '@/features/today/components/napom/NapomSegRing'
import { NAPOM_DIMENSIONS, NapomDimensionRow, type NapomRowMode } from '@/features/today/components/napom/NapomDimensionRow'
import { NapomLeadCard } from '@/features/today/components/napom/NapomLeadCard'
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

function SectionTitle({ title, eyebrow, i }: { title: string; eyebrow: string; i: number }) {
  return (
    <div className="napom-sec rise" style={{ '--i': i } as CSSProperties}>
      <h2>{title}</h2>
      <span className="uv-eyebrow">{eyebrow}</span>
    </div>
  )
}

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
  usePrefetchDayEvaluations([addDays(date, -1), addDays(date, 1)].filter((d) => d <= today))

  // Yesterday counts as SEEN only once its overnight review is actually on screen — a scored
  // evaluation with a review behind it. Opening yesterday before the close (in_progress, or
  // scored with no prose) must not swallow the morning dot the review will earn later.
  const viewed = evalQuery.data
  const reviewShown = viewed?.state === 'scored' && viewed.reviewId != null
  useEffect(() => {
    if (!deciding && date === yesterday && reviewShown) markSeen(yesterday)
  }, [deciding, date, yesterday, reviewShown])

  // Hooks first, THEN the bail-out: a malformed `:date` must not crash the page.
  if (!valid) return <Navigate to="/nap/napom" replace />

  const days = week?.days ?? []
  const day = days.find((d) => d.date === date) ?? null
  const evaluation = evalQuery.data ? normalizeDayEvaluation(evalQuery.data) : null
  const isToday = date === today
  const loading = deciding || (evaluation == null && evalQuery.error == null)
  const failed = !loading && evaluation == null
  const state = evaluation?.state ?? null
  const scored = state === 'scored'
  const open = state === 'in_progress'
  const live = isToday || open
  const rows = rowsOf(loading ? null : evaluation)

  const heroTone = scored
    ? { '--c': 'var(--dv-lav)', '--c2': 'var(--dv-amber)' }
    : state === 'thin' || state === 'empty'
      ? { '--c': 'var(--dv-sky)', '--c2': 'var(--dv-lav)' }
      : { '--c': 'var(--dv-coral)', '--c2': 'var(--dv-amber)' }

  const ring = (() => {
    if (loading) {
      return (
        <NapomSegRing segments={NAPOM_DIMENSIONS.map((m) => ({ pct: 0, color: m.color }))} label="számolom · egy pillanat">
          <span><strong className="napom-wait">számolom</strong><em>egy pillanat</em></span>
        </NapomSegRing>
      )
    }
    if (!evaluation || !(scored || open)) return null
    const segments = rows.map((d, k) => ({ pct: d.score ?? 0, color: NAPOM_DIMENSIONS[k].color }))
    if (open) {
      const done = doneCount(evaluation)
      return (
        <NapomSegRing segments={segments} label={`${done} / 6 terület kész`}>
          <span><strong>{done}<small>/6</small></strong><em>TERÜLET KÉSZ</em></span>
        </NapomSegRing>
      )
    }
    const verdict = day && dayState(day, today) === 'scored' ? dayVerdict(day, days, today).toUpperCase() : 'PONT'
    return (
      <NapomSegRing segments={segments} label={`Pontszám: ${evaluation.score} / 100`}>
        <span><strong className="napom-grad">{evaluation.score}</strong><em>{verdict}</em></span>
      </NapomSegRing>
    )
  })()

  const action = isToday && evaluation && open ? nextBestAction(evaluation, day, new Date(), todayRitual.data.closed) : null
  const rowMode: NapomRowMode = loading ? 'loading' : scored ? 'scored' : open ? 'today' : 'plain'

  return (
    <MozaikPage tone="lav" className="napom-page">
      <EntranceGroup replayKey={date}>
        <div className="napom-head rise" style={{ '--i': 0 } as CSSProperties}>
          <span className="uv-eyebrow">A NAPOM</span>
          <span className="uv-eyebrow">{deriveWeekTitle(monday).toUpperCase()}</span>
        </div>
        <NapomWeekStrip date={date} today={today} days={days} onPick={(iso) => navigate(`/nap/napom/${iso}`)} />

        <section className="napom-hero uv-halo rise" style={{ ...heroTone, '--i': 2 } as CSSProperties}>
          <h1>{huDowFull(date)} <span>· {huMonthDay(date).toLowerCase()}</span></h1>
          {live ? (
            <span className="napom-sub uv-eyebrow napom-live">
              <i aria-hidden="true" />
              ÉLŐ{evaluation && evalQuery.dataUpdatedAt > 0 ? ` · FRISSÜLT ${hhmm(evalQuery.dataUpdatedAt)}` : ''}
            </span>
          ) : evaluation && state !== 'future' ? (
            <span className="napom-sub uv-eyebrow">LEZÁRVA</span>
          ) : null}
          {ring}
          {scored && evaluation?.base != null && evaluation.adjustment && (
            <AdjustmentPill base={evaluation.base} adjustment={evaluation.adjustment} />
          )}
          {isToday && evaluation && !loading && (
            <>
              <p className="napom-reading">{dayReading(evaluation, day)}</p>
              <span className="napom-upd">
                Napközben nincs pontszám. Hajnalban zárom a napot, és reggelre megírom, milyen volt.
              </span>
            </>
          )}
        </section>

        {action && <NapomLeadCard action={action} onGo={(to) => navigate(to)} i={3} />}

        {failed && (
          <div className="napom-nodata rise" role="alert" style={{ '--i': 3 } as CSSProperties}>
            <Icon3D name="t-journal" size={56} />
            <strong>Nem sikerült betölteni a napot.</strong>
            <button type="button" className="napom-flat napom-retry" onClick={() => evalQuery.refetch()}>Próbáld újra</button>
          </div>
        )}

        {state === 'future' && (
          <div className="napom-nodata rise" style={{ '--i': 3 } as CSSProperties}>
            <Icon3D name="t-journal" size={56} />
            <p>{DAY_COPY.futurePage}</p>
          </div>
        )}

        {(state === 'thin' || state === 'empty') && (
          <div className="napom-nodata rise" style={{ '--i': 3 } as CSSProperties}>
            <Icon3D name="t-journal" size={56} />
            <strong>Erre a napra kevés az adat</strong>
            <p>{state === 'empty' ? DAY_COPY.emptyPage : DAY_COPY.thinPage}</p>
          </div>
        )}

        {scored && evaluation && evaluation.narrative.length > 0 && (
          <NapomReviewCard evaluation={evaluation} date={date} i={3} />
        )}

        {open && <SectionTitle title={isToday ? 'Ma eddig' : 'Eddig'} eyebrow="6 TERÜLET" i={4} />}
        {scored && <SectionTitle title="Miből jött össze" eyebrow="KOPPINTS A RÉSZLETEKÉRT" i={4} />}

        {(loading || (evaluation && state !== 'future')) && (
          <div className="napom-rows">
            {rows.map((d, k) => (
              <NapomDimensionRow
                key={`${date}-${d.id}`}
                dimension={d}
                mode={rowMode}
                goalTick={d.id === 'nutrition' && day?.kcalTarget != null}
                i={k + 5}
              />
            ))}
          </div>
        )}

        {scored && evaluation && evaluation.context.length > 0 && (
          <>
            <SectionTitle title="A nap körülményei" eyebrow="NEM SZÁMÍT A PONTBA" i={6} />
            <div className="napom-ctx rise" style={{ '--i': 6 } as CSSProperties}>
              {evaluation.context.map((c) => (
                <span key={`${c.label}·${c.value}`} className="napom-flat">{c.label} · <b>{c.value}</b></span>
              ))}
            </div>
          </>
        )}

        {scored && (
          <p className="napom-foot">Ha utólag beírsz még valamit erre a napra, a jegyzetet egyszer újraírom.</p>
        )}

        {morning && date === yesterday && (
          <button
            type="button"
            className="napom-tonext glass rise"
            style={{ '--c': 'var(--dv-coral)', '--i': 7 } as CSSProperties}
            onClick={() => navigate(`/nap/napom/${today}`)}
          >
            <span>
              <span className="uv-eyebrow">REGGELI ÖSSZEFOGLALÓ · KÉSZ</span>
              <strong>Tovább a mai napra</strong>
            </span>
            <b aria-hidden="true">›</b>
          </button>
        )}
      </EntranceGroup>
    </MozaikPage>
  )
}

/** `alap 75 · a Mezo szerint +3 ▾` — the deterministic base and the Mezo's contextual
 *  correction stay two claims; the reason is one tap away, never hidden for good. */
function AdjustmentPill({ base, adjustment }: { base: number; adjustment: { delta: number; reason: string } }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" className="napom-corr" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        alap {base} · a Mezo szerint <b>{fmtDelta(adjustment.delta)}</b> <i aria-hidden="true">{open ? '▴' : '▾'}</i>
      </button>
      {open && <p className="napom-adjwhy">{adjustment.reason}</p>}
    </>
  )
}

// ============================================================
// Mezo · SleepPage — Alvás Mozaik re-face (mezo-d20.6.4), üveg re-dress (mezo-me75u.6):
// halo hero, lavender glass cards (gold education card), flat chips/rows — CSS block
// `── uveg en alvas (` in prototype.css, scoped to `.alv-page`.
// Source of truth: docs/design_2.0/prototypes/src/en-body.html #page-alvas
// (p-lav tone, px ×1.18). Anatomy: MozaikPage/PageHead/PageHero scaffold →
// goal card with the bed-rail (t-sleep bedTime ← duration → t-sun wakeTime) →
// Rendszeresség/Hatékonyság glass ring tiles → the daily education card
// (SleepStatCard, replaced by SleepEscalationCard while triggered — spec
// D3/D4 priority KEPT at this position, not the prototype's later slot,
// since that ordering encodes deliberate walker-education priority) →
// log-dependent last-night hero (phase rail + reference rows, "a sávban" —
// never red), night-arc, phase-average, 7-night trend + quality dots,
// REM-duration, recent log → the Éjszakai mód glass entry row LAST,
// matching the prototype's own order, and ALWAYS visible regardless of
// log state (spec D3 — the Today banner is its timed twin, same face).
// Behavior is the untouched data layer (hooks, mutations, honest states,
// tartás contract) — only the chrome changed.
// ============================================================
import { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { Eyebrow } from '@/shared/ui/Eyebrow'
import { Icon3D } from '@/shared/ui/clay'
import { ScoreRing } from '@/shared/ui/ScoreRing'
import { MozaikPage, PageHead, PageHero, PageBody } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { useSleep, useSleepGoal } from '@/data/hooks'
import {
  regularityScore,
  efficiencyPct,
  bedDeltaMin,
  REGULARITY_WINDOW_DAYS,
  EFFICIENCY_TARGET_PCT,
} from '@/features/me/logic/sleepStats'
import { DEEP_REF, parseHypnogram, phaseBreakdown, phasePct, REM_REF } from '@/features/me/logic/sleepPhases'
import { PhaseRail } from '@/features/me/components/PhaseRail'
import { PhaseReferenceRow } from '@/features/me/components/PhaseReferenceRow'
import { SleepLogRow } from '@/features/me/components/SleepLogRow'
import { SleepChart } from '@/features/me/components/SleepChart'
import { SleepStatCard } from '@/features/me/components/SleepStatCard'
import { SleepEscalationCard } from '@/features/me/components/SleepEscalationCard'
import { NightArcCard } from '@/features/me/components/NightArcCard'
import { PhaseAverageCard } from '@/features/me/components/PhaseAverageCard'
import { RemDurationCard } from '@/features/me/components/RemDurationCard'
import { SleepLogSheet } from '@/features/me/sheets/SleepLogSheet'
import { SleepStatsSheet } from '@/features/me/sheets/SleepStatsSheet'
import { evaluateEscalation, isSnoozed, snooze } from '@/features/me/logic/sleepEscalation'
import { localDateString } from '@/shared/lib/dates'

type Period = '7d' | '14d'
const PERIODS: Period[] = ['7d', '14d']

export function SleepPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { sleepLog, lastNight, logSleep } = useSleep()
  const { goal } = useSleepGoal()
  const [period, setPeriod] = useState<Period>('14d')
  const [logOpen, setLogOpen] = useState(false)
  const [statsOpen, setStatsOpen] = useState(false)
  const [snoozed, setSnoozed] = useState(() => isSnoozed(localDateString()))
  const escalation = evaluateEscalation(sleepLog, localDateString())
  const showEscalation = escalation.triggered && !snoozed

  // The goal card + score rings are the day's anchor and render ALWAYS (goal
  // always exists — mock seed or backend ghost). The log-dependent sections
  // (hero/chart/rows) still guard on a real lastNight below.
  const regularity = regularityScore(sleepLog, goal, REGULARITY_WINDOW_DAYS)
  const lastEfficiency = lastNight ? efficiencyPct(lastNight) : null
  const lastBedDelta = lastNight ? bedDeltaMin(lastNight, goal) : null
  const lastPhases = lastNight ? phaseBreakdown(lastNight) : null
  // NightArcCard itself returns null without a valid hypnogram, but its Eyebrow heading is a
  // sibling — guard the whole block on a valid hypnogram too, or the heading strands alone
  // over nothing.
  const lastArc = lastNight ? parseHypnogram(lastNight) : null

  // Color the (real) quality number good/bad on the same threshold SleepChart
  // uses for "low" nights (quality <= 5) — a presentation heuristic, no mock target.
  const goodQuality = lastNight ? lastNight.quality > 5 : false

  return (
    <MozaikPage tone="lav" className="alv-page">
      <PageHead glass onBack={() => navigate(-1)} label="Én">
        <button type="button" className="pgact alv-log" onClick={() => setLogOpen(true)}>
          <span aria-hidden="true">＋</span> Log
        </button>
      </PageHead>

      <EntranceGroup>
        <PageHero
          art="t-sleep"
          accent="var(--dv-lav)"
          big={lastNight ? (
            <>{lastNight.duration.toFixed(1)}<small>h</small></>
          ) : '–'}
          name="Alvás"
          sub={lastNight ? `tegnap éjjel · ${lastNight.bedtime} → ${lastNight.wakeup} · Q${lastNight.quality}` : undefined}
        />

        <PageBody>
          {/* Sleep-goal card — the bed-rail (spec §5), a lit lavender glass card (üveg U6) */}
          <div className="alv-goal glass rise" style={{ '--d': '0ms' } as React.CSSProperties}>
            <div className="alv-card-head">
              <Icon3D name="t-ring" size={30} />
              <strong className="alv-card-title">Alvás-cél</strong>
              <button type="button" className="alv-chip is-lit" onClick={() => navigate('/settings/me/sleep', { state: { from: location.pathname + location.search } })}>
                {goal.isSet ? 'szerkeszt' : 'beállítom'}
              </button>
            </div>
            {/* The backend never 404s the goal — an unset one arrives as a config-default ghost that
                is otherwise indistinguishable from a chosen goal. Saying so here is the whole point
                of isSet (mezo-k0hp): without it a purged sleep_goal row reads as "8 óra, 06:00". */}
            {!goal.isSet && (
              <p className="alv-unset">
                Alapértelmezett értékek — még nincs saját alvás-célod. Állítsd be, hogy az alvás-kártya
                és a terv-javaslatok a te számaidra szóljanak.
              </p>
            )}
            <div className="alv-bedrail">
              <span className="alv-end" data-end="bed">
                <Icon3D name="t-sleep" size={30} />
                <span className="sr-only">Lefekvés</span>
                <b>{goal.bedTime}</b>
              </span>
              <div className="alv-rail"><span>{(goal.targetMinutes / 60).toFixed(1)} ó cél</span></div>
              <span className="alv-end" data-end="wake">
                <Icon3D name="t-sun" size={30} />
                <span className="sr-only">Ébredés</span>
                <b>{goal.wakeTime}</b>
              </span>
            </div>
            <div className="alv-goal-foot">
              <span className="alv-quote">
                {goal.isSet ? '„a rendszeresség a király"' : 'alapértelmezett'}
              </span>
              <span className="alv-chip" data-tone="sage">±{goal.regularityBandMin}p</span>
            </div>
          </div>

          {/* Two glass ring tiles — regularity (14-night) + last-night efficiency */}
          <div className="alv-rings rise" style={{ '--d': '50ms' } as React.CSSProperties}>
            <div className="alv-ring glass" aria-label="Rendszeresség" style={{ '--c': 'var(--dv-lav)' } as React.CSSProperties}>
              <ScoreRing pct={regularity ?? 0} size={84} stroke={6} color="var(--c)"
                label={regularity != null ? `${Math.round(regularity * 100)}` : '–'} sublabel="%" />
              <strong>Rendszeresség</strong>
              <small>{REGULARITY_WINDOW_DAYS} nap · ±{goal.regularityBandMin}p</small>
            </div>
            <div className="alv-ring glass" aria-label="Hatékonyság"
              style={{ '--c': lastEfficiency != null && lastEfficiency >= EFFICIENCY_TARGET_PCT ? 'var(--dv-sage)' : 'var(--dv-amber)' } as React.CSSProperties}>
              <ScoreRing pct={(lastEfficiency ?? 0) / 100} size={84} stroke={6} color="var(--c)"
                label={lastEfficiency != null ? `${Math.round(lastEfficiency)}` : '–'} sublabel="%" />
              <strong>Hatékonyság</strong>
              <small>cél ≥ {EFFICIENCY_TARGET_PCT}%</small>
            </div>
          </div>

          {/* Walker education — the escalation card takes priority over the daily stat card
              while the trigger holds and isn't snoozed (spec D3/D4). Kept at this position
              (not the prototype's later slot) — the priority ordering is deliberate. */}
          <div className="alv-edu rise" style={{ '--d': '90ms' } as React.CSSProperties}>
            {showEscalation ? (
              <SleepEscalationCard
                reason={escalation.reason}
                onDetails={() => setStatsOpen(true)}
                onSnooze={() => { snooze(localDateString()); setSnoozed(true) }}
              />
            ) : (
              <SleepStatCard onOpen={() => setStatsOpen(true)} />
            )}
          </div>

          {lastNight ? (
            <>
              {/* Last night — big numerals, flat chips, the lit phase rail */}
              <div className="alv-last glass rise" style={{ '--d': '130ms' } as React.CSSProperties}>
                <div className="alv-last-top">
                  <div className="alv-last-dur">
                    <span className="alv-eyebrow">Tegnap éjjel</span>
                    <b className="alv-last-num">
                      {lastNight.duration.toFixed(1)}
                      <small>h</small>
                    </b>
                    <span className="alv-last-span">{lastNight.bedtime} → {lastNight.wakeup}</span>
                  </div>
                  <div className="alv-last-q" data-good={goodQuality ? 'true' : 'false'}>
                    <span className="alv-eyebrow">Quality</span>
                    <b className="alv-last-qnum">
                      {lastNight.quality}
                      <small>/10</small>
                    </b>
                  </div>
                </div>

                {/* Étkezés→alvás is a backend stub (mealToSleep hardcoded 0 until Fuel
                    lands — §5.3), so the strip (mezo-lfw) drops it; awakenings is real
                    (captured by the log sheet). Day-anchor readout — bed-delta vs. goal +
                    night efficiency (spec §5) — as flat chips. */}
                <div className="alv-chips">
                  <span className="alv-chip">Ébredés <b>{lastNight.awakenings}</b> × éjjel</span>
                  {lastBedDelta != null && (
                    <span className="alv-chip" data-tone={Math.abs(lastBedDelta) <= goal.regularityBandMin ? 'sage' : 'coral'}>
                      {lastBedDelta > 0 ? '+' : lastBedDelta < 0 ? '−' : ''}{Math.abs(lastBedDelta)}p vs. cél lefekvés
                    </span>
                  )}
                  {lastEfficiency != null && (
                    <span className="alv-chip">hatékonyság {Math.round(lastEfficiency)}%</span>
                  )}
                </div>

                {lastPhases && (
                  <div className="alv-phases">
                    <div className="alv-phases-head">
                      <span className="alv-eyebrow">Fázisok</span>
                      {lastNight.source === 'screenshot' && (
                        <span className="alv-src">screenshotból</span>
                      )}
                    </div>
                    <PhaseRail breakdown={lastPhases} height={16} />
                    <div className="alv-refs">
                      <PhaseReferenceRow label="Mély" pct={phasePct(lastPhases, 'deep')} range={DEEP_REF} color="var(--ph-deep)" />
                      <PhaseReferenceRow label="REM" pct={phasePct(lastPhases, 'rem')} range={REM_REF} color="var(--ph-rem)" />
                    </div>
                  </div>
                )}

                {lastNight.notes && (
                  <p className="alv-note">"{lastNight.notes}"</p>
                )}
              </div>

              {lastArc && (
                <div className="alv-sec rise" style={{ '--d': '170ms' } as React.CSSProperties}>
                  <div className="alv-sec-head"><Eyebrow>Az éjszaka íve</Eyebrow></div>
                  <NightArcCard entry={lastNight} />
                </div>
              )}

              {/* Fixed window (whole-branch review FIX 4) — the 7d/14d chips that used to drive this
                  live in the Trend block BELOW this card; tapping one retitled or removed a card
                  above it. The card's own heading already discloses its N ("...· N éjszakából"). */}
              <div className="alv-sec rise" style={{ '--d': '190ms' } as React.CSSProperties}>
                <PhaseAverageCard entries={sleepLog} windowDays={14} />
              </div>

              {/* Duration + quality chart — the 7-night stacked phase columns + quality dots */}
              <div className="alv-sec rise" style={{ '--d': '210ms' } as React.CSSProperties}>
                <div className="alv-sec-head alv-trend-head">
                  <Eyebrow>Trend</Eyebrow>
                  <div className="alv-seg" role="group" aria-label="Időszak">
                    {PERIODS.map(p => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPeriod(p)}
                        className={period === p ? 'alv-chip is-on' : 'alv-chip'}
                        aria-pressed={period === p}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
                <SleepChart entries={sleepLog} period={period} />
              </div>

              <div className="alv-sec rise" style={{ '--d': '230ms' } as React.CSSProperties}>
                <RemDurationCard entries={sleepLog} />
              </div>

              {/* Recent log — flat rows; a short or poor night keeps a coral warning edge */}
              <div className="alv-sec rise" style={{ '--d': '250ms' } as React.CSSProperties}>
                <div className="alv-sec-head">
                  <Eyebrow>Napló · utolsó 7 éjszaka</Eyebrow>
                </div>
                <div className="alv-log-list">
                  {sleepLog.slice(-7).reverse().map((n, i) => (
                    <SleepLogRow key={i} night={n} />
                  ))}
                </div>
              </div>
            </>
          ) : (
            // Real mode first paint can have an empty log (no data yet / still loading);
            // the goal card above still renders — only the log-dependent sections wait.
            <div className="alv-empty uv-empty">
              Még nincs alvásadat.
            </div>
          )}

          {/* Night-mode entry — ALWAYS visible (spec D3), LAST (prototype order); a lavender
              glass row with the 3D moon (üveg U6). */}
          <Link to="/me/sleep/night" className="alv-night glass rise" style={{ '--d': '290ms' } as React.CSSProperties}>
            <Icon3D name="t-moon" size={50} className="alv-night-art" />
            <span className="alv-night-tx">
              <span className="alv-night-t1">Éjszakai mód</span>
              <span className="alv-night-t2">Eszközök éjszakai ébredéshez — 20 perces szabály, légzés, 4K-séta.</span>
            </span>
            <span className="alv-night-chev" aria-hidden="true">›</span>
          </Link>
        </PageBody>
      </EntranceGroup>

      {logOpen && <SleepLogSheet onClose={() => setLogOpen(false)} onSave={logSleep} />}
      {statsOpen && (
        <SleepStatsSheet
          escalation={showEscalation ? escalation.reason : null}
          onClose={() => setStatsOpen(false)}
        />
      )}
    </MozaikPage>
  )
}

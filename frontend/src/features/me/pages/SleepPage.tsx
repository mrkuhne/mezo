// ============================================================
// Mezo · SleepPage — Alvás Mozaik re-face (mezo-d20.6.4)
// Source of truth: docs/design_2.0/prototypes/src/en-body.html #page-alvas
// (p-lav tone, px ×1.18). Anatomy: MozaikPage/PageHead/PageHero scaffold →
// goal card with the bed-rail (🛏️ bedTime ← duration → ☀️ wakeTime) →
// Rendszeresség/Hatékonyság washed ring tiles → the daily education card
// (SleepStatCard, replaced by SleepEscalationCard while triggered — spec
// D3/D4 priority KEPT at this position, not the prototype's later slot,
// since that ordering encodes deliberate walker-education priority) →
// log-dependent last-night hero (phase rail + reference rows, "a sávban" —
// never red), night-arc, phase-average, 7-night trend + quality dots,
// REM-duration, recent log → the DARK Éjszakai mód entry tile LAST,
// matching the prototype's own order, and ALWAYS visible regardless of
// log state (spec D3 — the Today banner is its timed twin, same face).
// Behavior is the untouched data layer (hooks, mutations, honest states,
// tartás contract) — only the chrome changed.
// ============================================================
import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Eyebrow } from '@/shared/ui/Eyebrow'
import { Icon } from '@/shared/ui/Icon'
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
import { SleepStat } from '@/features/me/components/SleepStat'
import { SleepLogRow } from '@/features/me/components/SleepLogRow'
import { SleepChart } from '@/features/me/components/SleepChart'
import { SleepStatCard } from '@/features/me/components/SleepStatCard'
import { SleepEscalationCard } from '@/features/me/components/SleepEscalationCard'
import { NightArcCard } from '@/features/me/components/NightArcCard'
import { PhaseAverageCard } from '@/features/me/components/PhaseAverageCard'
import { RemDurationCard } from '@/features/me/components/RemDurationCard'
import { SleepLogSheet } from '@/features/me/sheets/SleepLogSheet'
import { SleepGoalSheet } from '@/features/me/sheets/SleepGoalSheet'
import { SleepStatsSheet } from '@/features/me/sheets/SleepStatsSheet'
import { evaluateEscalation, isSnoozed, snooze } from '@/features/me/logic/sleepEscalation'
import { localDateString } from '@/shared/lib/dates'

type Period = '7d' | '14d'
const PERIODS: Period[] = ['7d', '14d']

export function SleepPage() {
  const navigate = useNavigate()
  const { sleepLog, lastNight, logSleep } = useSleep()
  const { goal } = useSleepGoal()
  const [period, setPeriod] = useState<Period>('14d')
  const [logOpen, setLogOpen] = useState(false)
  const [goalOpen, setGoalOpen] = useState(false)
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
    <MozaikPage tone="lav">
      <PageHead onBack={() => navigate(-1)} label="‹ Én">
        <button type="button" className="pgact" style={{ marginLeft: 'auto' }} onClick={() => setLogOpen(true)}>
          <Icon name="plus" size={12} /> Log
        </button>
      </PageHead>

      <EntranceGroup>
        <PageHero
          icon="i-alvas"
          big={lastNight ? (
            <>{lastNight.duration.toFixed(1)}<span style={{ fontSize: 15, color: 'var(--text-tertiary)' }}> h</span></>
          ) : '–'}
          name="Alvás"
          sub={lastNight ? `tegnap éjjel · ${lastNight.bedtime} → ${lastNight.wakeup} · Q${lastNight.quality}` : undefined}
        />

        <PageBody>
          {/* Sleep-goal card — the bed-rail (spec §5) */}
          <div className="mzalv-goal rise" style={{ '--d': '0ms' } as React.CSSProperties}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span className="mz-eyebrow" style={{ color: 'var(--lav-deep)' }}>Alvás-cél</span>
              <button type="button" className="chip" onClick={() => setGoalOpen(true)} style={{ fontSize: 9, padding: '3px 8px' }}>
                szerkeszt
              </button>
            </div>
            <div className="mzalv-bedrail">
              <span className="mzalv-end">🛏️ {goal.bedTime}</span>
              <div className="mzalv-rail"><span>{(goal.targetMinutes / 60).toFixed(1)} ó cél</span></div>
              <span className="mzalv-end">☀️ {goal.wakeTime}</span>
            </div>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
              <span style={{ fontSize: 10, fontStyle: 'italic', color: 'var(--text-tertiary)' }}>„a rendszeresség a király"</span>
              <span className="chip" style={{ fontSize: 9, padding: '2px 8px', background: 'var(--wash-sage)', color: 'var(--sage-deep)', borderColor: 'transparent' }}>
                ±{goal.regularityBandMin}p
              </span>
            </div>
          </div>

          {/* Two washed ring tiles — regularity (14-night) + last-night efficiency */}
          <div className="mz-mosaic rise" style={{ '--d': '50ms', marginTop: 11, marginBottom: 11 } as React.CSSProperties}>
            <div className="mz-tile mz-w-lav" style={{ alignItems: 'center', textAlign: 'center', gap: 6 }} aria-label="Rendszeresség">
              <ScoreRing pct={regularity ?? 0} size={64} stroke={5} color="var(--lav-deep)"
                label={regularity != null ? `${Math.round(regularity * 100)}` : '–'} sublabel="%" />
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>Rendszeresség</span>
              <span style={{ fontSize: 9, color: 'var(--faint)' }}>{REGULARITY_WINDOW_DAYS} nap · ±{goal.regularityBandMin}p</span>
            </div>
            <div className="mz-tile mz-w-sage" style={{ alignItems: 'center', textAlign: 'center', gap: 6 }} aria-label="Hatékonyság">
              <ScoreRing pct={(lastEfficiency ?? 0) / 100} size={64} stroke={5}
                color={lastEfficiency != null && lastEfficiency >= EFFICIENCY_TARGET_PCT ? 'var(--sage-deep)' : 'var(--warning)'}
                label={lastEfficiency != null ? `${Math.round(lastEfficiency)}` : '–'} sublabel="%" />
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>Hatékonyság</span>
              <span style={{ fontSize: 9, color: 'var(--faint)' }}>cél ≥ {EFFICIENCY_TARGET_PCT}%</span>
            </div>
          </div>

          {/* Walker education — the escalation card takes priority over the daily stat card
              while the trigger holds and isn't snoozed (spec D3/D4). Kept at this position
              (not the prototype's later slot) — the priority ordering is deliberate. */}
          <div className="rise" style={{ '--d': '90ms', marginBottom: 11 } as React.CSSProperties}>
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
              {/* Last night hero */}
              <div
                className="card rise"
                style={{
                  '--d': '130ms',
                  padding: 20,
                  marginBottom: 16,
                  background: 'linear-gradient(180deg, var(--wash-lav) 0%, var(--surface-1) 65%)',
                  position: 'relative',
                  overflow: 'hidden',
                } as React.CSSProperties}
              >
                <div style={{ position: 'relative' }}>
                  <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div className="col">
                      <span className="eyebrow" style={{ color: 'var(--lav-deep)' }}>Tegnap éjjel</span>
                      <div
                        style={{
                          fontFamily: 'var(--ff-display)',
                          fontSize: 48,
                          fontWeight: 600,
                          lineHeight: 1,
                          marginTop: 8,
                          color: 'var(--ink)',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {lastNight.duration.toFixed(1)}
                        <span style={{ fontSize: 14, color: 'var(--text-tertiary)', marginLeft: 4 }}>h</span>
                      </div>
                      <span
                        className="text-secondary"
                        style={{ fontSize: 11, marginTop: 6, fontWeight: 700, display: 'block' }}
                      >
                        {lastNight.bedtime} → {lastNight.wakeup}
                      </span>
                    </div>
                    <div className="col" style={{ alignItems: 'flex-end' }}>
                      <span style={{ fontSize: 8, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--faint)' }}>Quality</span>
                      <div
                        style={{
                          fontFamily: 'var(--ff-display)',
                          fontSize: 32,
                          fontWeight: 600,
                          lineHeight: 1,
                          marginTop: 4,
                          color: goodQuality ? 'var(--sage-deep)' : 'var(--warning)',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {lastNight.quality}
                        <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 2 }}>/10</span>
                      </div>
                    </div>
                  </div>

                  {/* Étkezés→alvás is a backend stub (mealToSleep hardcoded 0 until Fuel
                      lands — §5.3), so the strip (mezo-lfw) drops it; awakenings is real
                      (captured by the log sheet). */}
                  <div className="row gap-md mt-lg" style={{ paddingTop: 14, borderTop: '1px solid var(--border-subtle)' }}>
                    <SleepStat label="Ébredés" val={lastNight.awakenings} unit="× éjjel" />
                  </div>

                  {/* Day-anchor readout — bed-delta vs. goal + night efficiency (spec §5) */}
                  <div className="col" style={{ gap: 3, marginTop: 8 }}>
                    {lastBedDelta != null && (
                      <span style={{ fontSize: 10, color: Math.abs(lastBedDelta) <= goal.regularityBandMin ? 'var(--sage-deep)' : 'var(--warning)', fontVariantNumeric: 'tabular-nums' }}>
                        {lastBedDelta > 0 ? '+' : lastBedDelta < 0 ? '−' : ''}{Math.abs(lastBedDelta)}p vs. cél lefekvés
                      </span>
                    )}
                    {lastEfficiency != null && (
                      <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>
                        hatékonyság {Math.round(lastEfficiency)}%
                      </span>
                    )}
                  </div>

                  {lastPhases && (
                    <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border-subtle)' }}>
                      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ fontSize: 8, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--faint)' }}>
                          Fázisok
                        </span>
                        {lastNight.source === 'screenshot' && (
                          <span style={{ fontSize: 9, fontWeight: 800, color: 'var(--faint)' }}>screenshotból</span>
                        )}
                      </div>
                      <PhaseRail breakdown={lastPhases} height={20} />
                      <div className="col" style={{ gap: 11, marginTop: 13, paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
                        <PhaseReferenceRow label="Mély" pct={phasePct(lastPhases, 'deep')} range={DEEP_REF} color="var(--ph-deep)" />
                        <PhaseReferenceRow label="REM" pct={phasePct(lastPhases, 'rem')} range={REM_REF} color="var(--ph-rem)" />
                      </div>
                    </div>
                  )}

                  {lastNight.notes && (
                    <p
                      className="text-secondary mt-md"
                      style={{ fontSize: 12, fontStyle: 'italic', lineHeight: 1.5, paddingTop: 10, borderTop: '1px solid var(--border-subtle)' }}
                    >
                      "{lastNight.notes}"
                    </p>
                  )}
                </div>
              </div>

              {lastArc && (
                <div className="rise" style={{ '--d': '170ms', marginBottom: 16 } as React.CSSProperties}>
                  <div style={{ marginBottom: 10 }}><Eyebrow>Az éjszaka íve</Eyebrow></div>
                  <NightArcCard entry={lastNight} />
                </div>
              )}

              {/* Fixed window (whole-branch review FIX 4) — the 7d/14d chips that used to drive this
                  live in the Trend block BELOW this card; tapping one retitled or removed a card
                  above it. The card's own heading already discloses its N ("...· N éjszakából"). */}
              <div className="rise" style={{ '--d': '190ms' } as React.CSSProperties}>
                <PhaseAverageCard entries={sleepLog} windowDays={14} />
              </div>

              {/* Duration + quality chart — the 7-night stacked phase columns + quality dots */}
              <div className="rise" style={{ '--d': '210ms', marginBottom: 16 } as React.CSSProperties}>
                <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
                  <Eyebrow>Trend</Eyebrow>
                  <div className="row gap-xs">
                    {PERIODS.map(p => (
                      <button
                        key={p}
                        onClick={() => setPeriod(p)}
                        className="chip"
                        style={period === p
                          ? { fontSize: 9, padding: '3px 8px', background: 'var(--wash-lav)', color: 'var(--lav-deep)', borderColor: 'transparent' }
                          : { fontSize: 9, padding: '3px 8px' }}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
                <SleepChart entries={sleepLog} period={period} />
              </div>

              <div className="rise" style={{ '--d': '230ms' } as React.CSSProperties}>
                <RemDurationCard entries={sleepLog} />
              </div>

              {/* Recent log */}
              <div className="rise" style={{ '--d': '250ms' } as React.CSSProperties}>
                <div style={{ marginBottom: 12 }}>
                  <Eyebrow>Napló · utolsó 7 éjszaka</Eyebrow>
                </div>
                <div className="col gap-sm">
                  {sleepLog.slice(-7).reverse().map((n, i) => (
                    <SleepLogRow key={i} night={n} />
                  ))}
                </div>
              </div>
            </>
          ) : (
            // Real mode first paint can have an empty log (no data yet / still loading);
            // the goal card above still renders — only the log-dependent sections wait.
            <div style={{ padding: '18px 0' }}>
              <span className="text-tertiary" style={{ fontSize: 12 }}>
                Még nincs alvásadat.
              </span>
            </div>
          )}

          {/* Night-mode entry — ALWAYS visible (spec D3), LAST (prototype order); the
              Today banner is the timed twin, same dark literal face. */}
          <Link to="/me/sleep/night" className="wdb-night rise" style={{ '--d': '290ms', margin: '16px 0 0' } as React.CSSProperties}>
            <span className="wdb-night-moon" aria-hidden="true">🌙</span>
            <span className="wdb-night-tx">
              <span className="wdb-night-t1">Éjszakai mód</span>
              <span className="wdb-night-t2">Eszközök éjszakai ébredéshez — 20 perces szabály, légzés, 4K-séta.</span>
            </span>
            <span className="wdb-night-chev" aria-hidden="true">›</span>
          </Link>
        </PageBody>
      </EntranceGroup>

      {logOpen && <SleepLogSheet onClose={() => setLogOpen(false)} onSave={logSleep} />}
      {goalOpen && <SleepGoalSheet onClose={() => setGoalOpen(false)} />}
      {statsOpen && (
        <SleepStatsSheet
          escalation={showEscalation ? escalation.reason : null}
          onClose={() => setStatsOpen(false)}
        />
      )}
    </MozaikPage>
  )
}

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Eyebrow } from '@/shared/ui/Eyebrow'
import { Icon } from '@/shared/ui/Icon'
import { ScoreRing } from '@/shared/ui/ScoreRing'
import { useSleep, useSleepGoal } from '@/data/hooks'
import {
  regularityScore,
  efficiencyPct,
  bedDeltaMin,
  REGULARITY_WINDOW_DAYS,
  EFFICIENCY_TARGET_PCT,
} from '@/features/me/logic/sleepStats'
import { SleepStat } from '@/features/me/components/SleepStat'
import { SleepLogRow } from '@/features/me/components/SleepLogRow'
import { SleepChart } from '@/features/me/components/SleepChart'
import { SleepStatCard } from '@/features/me/components/SleepStatCard'
import { SleepEscalationCard } from '@/features/me/components/SleepEscalationCard'
import { SleepLogSheet } from '@/features/me/sheets/SleepLogSheet'
import { SleepGoalSheet } from '@/features/me/sheets/SleepGoalSheet'
import { SleepStatsSheet } from '@/features/me/sheets/SleepStatsSheet'
import { evaluateEscalation, isSnoozed, snooze } from '@/features/me/logic/sleepEscalation'
import { localDateString } from '@/shared/lib/dates'

type Period = '7d' | '14d'
const PERIODS: Period[] = ['7d', '14d']

export function SleepPage() {
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

  // Color the (real) quality number good/bad on the same threshold SleepChart
  // uses for "low" nights (quality <= 5) — a presentation heuristic, no mock target.
  const goodQuality = lastNight ? lastNight.quality > 5 : false

  return (
    <>
      {/* Header */}
      <div className="pghead-np lav">
        <div>
          <div className="over">Me · Alvás</div>
          <h1>Alvás</h1>
        </div>
        <button
          type="button"
          className="pgact-np np-press"
          onClick={() => setLogOpen(true)}
          style={{ background: 'var(--wash-lav)', color: 'var(--lav-deep)' }}
        >
          <Icon name="plus" size={12} /> Log
        </button>
      </div>

      {/* Sleep-goal card + score rings — the day's anchor (spec §5) */}
      <div style={{ padding: '0 24px 16px' }}>
        <section className="card" aria-label="Alvás-cél" style={{ padding: '14px 16px' }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--faint)' }}>Alvás-cél</span>
            <button type="button" className="chip" onClick={() => setGoalOpen(true)} style={{ fontSize: 9, padding: '3px 8px' }}>
              szerkeszt
            </button>
          </div>
          <div className="row" style={{ alignItems: 'center', gap: 10, marginTop: 10 }}>
            <div className="col" style={{ alignItems: 'center', gap: 2 }}>
              <span aria-hidden="true">🛏️</span>
              <span style={{ fontSize: 15, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: 'var(--lav-deep)' }}>{goal.bedTime}</span>
            </div>
            <div style={{ position: 'relative', flex: 1, height: 4, borderRadius: 2, background: 'linear-gradient(90deg, var(--lav), var(--sky))' }}>
              <span style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', padding: '2px 10px', borderRadius: 999, background: 'var(--wash-lav)', color: 'var(--lav-deep)', fontSize: 10, fontWeight: 800, whiteSpace: 'nowrap' }}>
                {(goal.targetMinutes / 60).toFixed(1)} ó cél
              </span>
            </div>
            <div className="col" style={{ alignItems: 'center', gap: 2 }}>
              <span aria-hidden="true">☀️</span>
              <span style={{ fontSize: 15, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: 'var(--sky)' }}>{goal.wakeTime}</span>
            </div>
          </div>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
            <span style={{ fontSize: 10, fontStyle: 'italic', color: 'var(--text-tertiary)' }}>„a rendszeresség a király"</span>
            <span className="chip" style={{ fontSize: 9, padding: '2px 8px', background: 'var(--wash-sage)', color: 'var(--sage-deep)', borderColor: 'transparent' }}>
              ±{goal.regularityBandMin}p
            </span>
          </div>
        </section>

        {/* Night-mode entry — always visible (spec D3); the Today banner is the timed twin. */}
        <Link to="/me/sleep/night" className="wdb-night" style={{ margin: '8px 0 0' }}>
          <span className="wdb-night-moon" aria-hidden="true">🌙</span>
          <span className="wdb-night-tx">
            <span className="wdb-night-t1">Éjszakai mód</span>
            <span className="wdb-night-t2">Eszközök éjszakai ébredéshez — 20 perces szabály, légzés, 4K-séta.</span>
          </span>
          <span className="wdb-night-chev" aria-hidden="true">›</span>
        </Link>

        {/* Two score rings — regularity (14-night) + last-night efficiency */}
        <div className="row gap-sm" style={{ marginTop: 8 }}>
          <section className="card col" aria-label="Rendszeresség" style={{ flex: 1, alignItems: 'center', gap: 6, padding: '12px 8px' }}>
            <ScoreRing pct={regularity ?? 0} size={64} stroke={5} color="var(--lav-deep)"
              label={regularity != null ? `${Math.round(regularity * 100)}` : '–'} sublabel="%" />
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>Rendszeresség</span>
            <span style={{ fontSize: 9, color: 'var(--faint)' }}>{REGULARITY_WINDOW_DAYS} nap · ±{goal.regularityBandMin}p</span>
          </section>
          <section className="card col" aria-label="Hatékonyság" style={{ flex: 1, alignItems: 'center', gap: 6, padding: '12px 8px' }}>
            <ScoreRing pct={(lastEfficiency ?? 0) / 100} size={64} stroke={5}
              color={lastEfficiency != null && lastEfficiency >= EFFICIENCY_TARGET_PCT ? 'var(--sage-deep)' : 'var(--warning)'}
              label={lastEfficiency != null ? `${Math.round(lastEfficiency)}` : '–'} sublabel="%" />
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>Hatékonyság</span>
            <span style={{ fontSize: 9, color: 'var(--faint)' }}>cél ≥ {EFFICIENCY_TARGET_PCT}%</span>
          </section>
        </div>

        {/* Walker education — the escalation card takes priority over the daily stat card
            while the trigger holds and isn't snoozed (spec D3/D4). */}
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
          <div style={{ padding: '0 24px 16px' }}>
            <div
              className="card"
              style={{
                padding: 20,
                background: 'linear-gradient(180deg, var(--wash-lav) 0%, var(--surface-1) 65%)',
                position: 'relative',
                overflow: 'hidden',
              }}
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

                {/* Components */}
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
          </div>

          {/* Duration + quality chart */}
          <div style={{ padding: '0 24px 16px' }}>
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

          {/* Recent log */}
          <div style={{ padding: '0 24px 24px' }}>
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
        <div style={{ padding: '32px 24px' }}>
          <span className="text-tertiary" style={{ fontSize: 12 }}>
            Még nincs alvásadat.
          </span>
        </div>
      )}

      {logOpen && <SleepLogSheet onClose={() => setLogOpen(false)} onSave={logSleep} />}
      {goalOpen && <SleepGoalSheet onClose={() => setGoalOpen(false)} />}
      {statsOpen && (
        <SleepStatsSheet
          escalation={showEscalation ? escalation.reason : null}
          onClose={() => setStatsOpen(false)}
        />
      )}
    </>
  )
}

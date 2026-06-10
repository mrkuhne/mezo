import { useState } from 'react'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { PageTitle } from '@/components/ui/PageTitle'
import { Icon } from '@/components/ui/Icon'
import { ToolChipRow } from '@/components/ui/ToolChipRow'
import type { Tool } from '@/components/ui/ToolChip'
import { useSleep } from '@/data/hooks'
import { FactorCard } from '../components/FactorCard'
import { InsightCard } from '../components/InsightCard'
import { SleepStat } from '../components/SleepStat'
import { SleepCell } from '../components/SleepCell'
import { SleepLogRow } from '../components/SleepLogRow'
import { SleepChart } from '../components/SleepChart'
import { SleepLogSheet } from '../SleepLogSheet'

type Period = '7d' | '14d'
const PERIODS: Period[] = ['7d', '14d']

const FACTOR_TOOLS: Tool[] = [
  { type: 'read', name: 'get_sleep_log', args: '14d' },
  { type: 'read', name: 'get_meal_history', args: '7d' },
  { type: 'read', name: 'get_supplement_log' },
  { type: 'compute', name: 'computeSleepFactors' },
]

const SLEEP_ACCENT = 'var(--cat-preference)'

export function SleepView() {
  const { sleepLog, sleepTrends, lastNight, logSleep } = useSleep()
  const [period, setPeriod] = useState<Period>('14d')
  const [logOpen, setLogOpen] = useState(false)

  const target = sleepTrends.target
  const durDelta = lastNight.duration - target.duration
  const qualOnTarget = lastNight.quality >= target.quality

  return (
    <>
      {/* Header */}
      <div className="page-header">
        <div>
          <Eyebrow brand>Me · Alvás</Eyebrow>
          <PageTitle className="mt-sm">Sleep</PageTitle>
        </div>
        <button className="chip" style={{ padding: '8px 10px' }} onClick={() => setLogOpen(true)}>
          <Icon name="plus" size={12} /> Log
        </button>
      </div>

      {/* Last night hero */}
      <div style={{ padding: '0 24px 16px' }}>
        <div
          className="card notch-12"
          style={{
            padding: 20,
            background: 'linear-gradient(180deg, rgba(167, 139, 250, 0.06) 0%, var(--surface-1) 100%)',
            borderColor: 'rgba(167, 139, 250, 0.3)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: 'var(--cat-preference)' }} />
          <div
            style={{
              position: 'absolute',
              right: -50,
              top: -50,
              width: 180,
              height: 180,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(167, 139, 250, 0.14), transparent 70%)',
            }}
          />
          <div style={{ position: 'relative' }}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div className="col">
                <span className="eyebrow" style={{ color: 'var(--cat-preference)' }}>Tegnap éjjel</span>
                <div
                  style={{
                    fontFamily: 'var(--ff-display)',
                    fontSize: 48,
                    fontWeight: 600,
                    lineHeight: 1,
                    marginTop: 8,
                    color: 'var(--cat-preference)',
                    textShadow: '0 0 20px rgba(167, 139, 250, 0.35)',
                  }}
                >
                  {lastNight.duration.toFixed(1)}
                  <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 14, color: 'var(--text-tertiary)', marginLeft: 4 }}>h</span>
                </div>
                <span
                  className="text-secondary"
                  style={{ fontSize: 11, marginTop: 6, fontFamily: 'var(--ff-mono)', display: 'block' }}
                >
                  {lastNight.bedtime} → {lastNight.wakeup}
                  {durDelta !== 0 && (
                    <span style={{ color: durDelta >= 0 ? 'var(--brand-glow)' : 'var(--warning)', marginLeft: 8 }}>
                      {durDelta > 0 ? '+' : ''}{durDelta.toFixed(1)}h target
                    </span>
                  )}
                </span>
              </div>
              <div className="col" style={{ alignItems: 'flex-end' }}>
                <span className="label-mono" style={{ fontSize: 8 }}>Quality</span>
                <div
                  style={{
                    fontFamily: 'var(--ff-display)',
                    fontSize: 32,
                    fontWeight: 600,
                    lineHeight: 1,
                    marginTop: 4,
                    color: qualOnTarget ? 'var(--brand-glow)' : 'var(--warning)',
                  }}
                >
                  {lastNight.quality}
                  <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 2 }}>/10</span>
                </div>
              </div>
            </div>

            {/* Components */}
            <div className="row gap-md mt-lg" style={{ paddingTop: 14, borderTop: '1px solid var(--border-subtle)' }}>
              <SleepStat label="Ébredés" val={lastNight.awakenings} unit="× éjjel" />
              <SleepStat label="Étkezés→alvás" val={lastNight.mealToSleep} unit="perc" highlight={lastNight.mealToSleep >= 120} />
              <SleepStat label="Target" val={target.duration} unit="h" />
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
                className={'chip' + (period === p ? ' brand' : '')}
                style={{ fontSize: 9, padding: '3px 8px' }}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
        <SleepChart entries={sleepLog} target={target} period={period} />
      </div>

      {/* Weekly stats */}
      <div style={{ padding: '0 24px 16px' }}>
        <div className="row gap-sm">
          <SleepCell label="7 nap" stats={sleepTrends.last7d} />
          <SleepCell label="14 nap" stats={sleepTrends.last14d} />
        </div>
      </div>

      {/* Mezo insights */}
      <div style={{ padding: '0 24px 16px' }}>
        <div style={{ marginBottom: 12 }}>
          <Eyebrow>Mezo · mit látunk</Eyebrow>
        </div>
        <div className="col gap-sm">
          {sleepTrends.insights.map((ins, i) => (
            <InsightCard key={i} insight={ins} accentColor={SLEEP_ACCENT} />
          ))}
        </div>
      </div>

      {/* Factors */}
      <div style={{ padding: '0 24px 16px' }}>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
          <Eyebrow>Hatások · mi mozgatja az alvást</Eyebrow>
          <Eyebrow brand>{sleepTrends.factors.length}</Eyebrow>
        </div>
        <div className="col gap-sm">
          {sleepTrends.factors.map((f, i) => (
            <FactorCard key={i} factor={f} />
          ))}
        </div>
        <div className="mt-md">
          <ToolChipRow tools={FACTOR_TOOLS} />
        </div>
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

      {logOpen && <SleepLogSheet onClose={() => setLogOpen(false)} onSave={logSleep} />}
    </>
  )
}

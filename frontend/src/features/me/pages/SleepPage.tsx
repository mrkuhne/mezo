import { useState } from 'react'
import { Eyebrow } from '@/shared/ui/Eyebrow'
import { Icon } from '@/shared/ui/Icon'
import { useSleep } from '@/data/hooks'
import { SleepStat } from '@/features/me/components/SleepStat'
import { SleepLogRow } from '@/features/me/components/SleepLogRow'
import { SleepChart } from '@/features/me/components/SleepChart'
import { SleepLogSheet } from '@/features/me/sheets/SleepLogSheet'

type Period = '7d' | '14d'
const PERIODS: Period[] = ['7d', '14d']

export function SleepPage() {
  const { sleepLog, lastNight, logSleep } = useSleep()
  const [period, setPeriod] = useState<Period>('14d')
  const [logOpen, setLogOpen] = useState(false)

  // Real mode first paint can have an empty log (no data yet / still loading);
  // the hero below assumes a lastNight, so guard before destructuring it.
  if (!lastNight) {
    return (
      <div style={{ padding: '32px 24px' }}>
        <span className="text-tertiary" style={{ fontSize: 12 }}>
          Még nincs alvásadat.
        </span>
      </div>
    )
  }

  // Color the (real) quality number good/bad on the same threshold SleepChart
  // uses for "low" nights (quality <= 5) — a presentation heuristic, no mock target.
  const goodQuality = lastNight.quality > 5

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

      {/* Last night hero */}
      <div style={{ padding: '0 24px 16px' }}>
        <div
          className="card notch-12"
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

      {logOpen && <SleepLogSheet onClose={() => setLogOpen(false)} onSave={logSleep} />}
    </>
  )
}

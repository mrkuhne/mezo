import type { CSSProperties } from 'react'
import { cn } from '@/shared/lib/cn'
import { useExperiments, useExperimentActions } from '@/data/hooks'
import type { Experiment } from '@/data/types'

// active → amber "in-progress" chip (kept semantic); proposed / completed carry no class
function statusChipClass(e: Experiment): string {
  return e.status === 'active' ? 'warning' : ''
}

// completed + good outcome → lav-wash "positive" badge (Insights accent; T5 PatternCard precedent)
function statusChipStyle(e: Experiment): CSSProperties {
  const good = e.status !== 'proposed' && e.status !== 'active' && !!e.outcomeGood
  return good ? { background: 'var(--wash-lav)', color: 'var(--lav-deep)' } : {}
}

function statusLabel(e: Experiment): string {
  switch (e.status) {
    case 'proposed':
      return '◇ Javaslat'
    case 'active':
      return '◐ Aktív'
    default:
      // completed: good / not-good / inconclusive (outcomeGood undefined)
      return e.outcomeGood === true ? '✓ Megerősítve' : e.outcomeGood === false ? '◯ Nem igazolódott' : '◌ Nem értékelhető'
  }
}

export function ExperimentsPage() {
  const { experiments, mode } = useExperiments()
  const { decide, propose, pending } = useExperimentActions()
  const live = mode === 'live'

  if (experiments.length === 0) {
    return (
      <div className="card" style={{ padding: 18, textAlign: 'center' }}>
        <span className="eyebrow text-tertiary">tanulom</span>
        <p style={{ fontSize: 13, marginTop: 8, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          Az első N=1 kísérletet a megerősített mintákból javasolja Mezo.
        </p>
      </div>
    )
  }

  return (
    <div className="col gap-md">
      <span className="eyebrow">N=1 kísérletek · {experiments.length}</span>

      {experiments.map((e) => (
        <div key={e.id} className="card" style={{ padding: 16 }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className={cn('chip', statusChipClass(e))} style={{ fontSize: 9, ...statusChipStyle(e) }}>{statusLabel(e)}</span>
            {e.status !== 'proposed' && <span className="label-mono" style={{ fontSize: 9 }}>{e.day}/{e.total} nap</span>}
          </div>

          <div style={{ fontFamily: 'var(--ff-display)', fontSize: 16, marginTop: 8, lineHeight: 1.2 }}>{e.title}</div>
          <p className="text-secondary mt-sm" style={{ fontSize: 12, lineHeight: 1.5 }}>{e.hypothesis}</p>

          {e.status !== 'proposed' && (
            <div className="bar mt-md">
              <div className="bar-fill glow" style={{ width: `${(e.day / e.total) * 100}%` }} />
            </div>
          )}

          {e.outcome && <p className="mt-sm" style={{ fontSize: 12, color: 'var(--success)', lineHeight: 1.4 }}>{e.outcome}</p>}

          {e.status === 'proposed' && live && (
            <div className="row gap-sm mt-md">
              <button type="button" className="chip" disabled={pending} onClick={() => decide(e.id, 'accept')} style={{ fontSize: 11, padding: '6px 12px', background: 'var(--wash-lav)', borderColor: 'var(--lav-deep)', color: 'var(--lav-deep)' }}>
                Elfogadom
              </button>
              <button type="button" className="chip" disabled={pending} onClick={() => decide(e.id, 'dismiss')} style={{ fontSize: 11, padding: '6px 12px' }}>
                Elvetem
              </button>
            </div>
          )}
        </div>
      ))}

      <button
        type="button"
        className="cta-ghost mt-md"
        disabled={live && pending}
        onClick={live ? () => propose() : undefined}
        style={{ textAlign: 'center', padding: 14 }}
      >
        + Új kísérlet javasol Mezo
      </button>
    </div>
  )
}

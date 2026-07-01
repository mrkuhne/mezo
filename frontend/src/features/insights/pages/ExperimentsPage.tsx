import { cn } from '@/shared/lib/cn'
import { useInsights } from '@/data/hooks'
import type { Experiment } from '@/data/types'

function statusChipClass(e: Experiment): string {
  // active → warning; completed+good → brand; completed+not-good → plain
  if (e.status === 'active') return 'warning'
  return e.outcomeGood ? 'brand' : ''
}

function statusLabel(e: Experiment): string {
  if (e.status === 'active') return '◐ Aktív'
  return e.outcomeGood ? '✓ Megerősítve' : '◯ Lezárva'
}

export function ExperimentsPage() {
  const { experiments } = useInsights()

  return (
    <div className="col gap-md">
      <span className="eyebrow">N=1 kísérletek · {experiments.length}</span>

      {experiments.map((e) => (
        <div key={e.id} className="card notch-12" style={{ padding: 16 }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className={cn('chip', statusChipClass(e))} style={{ fontSize: 9 }}>{statusLabel(e)}</span>
            <span className="label-mono" style={{ fontSize: 9 }}>{e.day}/{e.total} nap</span>
          </div>

          <div style={{ fontFamily: 'var(--ff-display)', fontSize: 16, marginTop: 8, lineHeight: 1.2 }}>{e.title}</div>
          <p className="text-secondary mt-sm" style={{ fontSize: 12, lineHeight: 1.5 }}>{e.hypothesis}</p>

          <div className="bar mt-md">
            <div className="bar-fill glow" style={{ width: `${(e.day / e.total) * 100}%` }} />
          </div>

          {e.outcome && <p className="mt-sm" style={{ fontSize: 12, color: 'var(--success)', lineHeight: 1.4 }}>{e.outcome}</p>}
        </div>
      ))}

      <button type="button" className="cta-ghost notch-4 mt-md" style={{ textAlign: 'center', padding: 14 }}>
        + Új kísérlet javasol Mezo
      </button>
    </div>
  )
}

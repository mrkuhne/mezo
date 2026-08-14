import type { PatternMonitor } from '@/data/types'

/**
 * A Motor tab korall hero-kártyája (mezo-18bx): élő-szám + motor-tények egy pillantásra.
 * Pure props — a „Utolsó felismerés" szemantika (max lastDetectedAt, nem job-futás) változatlan.
 */
export function MotorHero({ monitor }: { monitor: PatternMonitor }) {
  const liveCount = monitor.pairs.filter((p) => p.verdict === 'live').length

  return (
    <div
      className="card"
      style={{
        padding: '16px 18px',
        color: 'var(--text-inverse)',
        background: 'linear-gradient(135deg, var(--primary-base) 0%, var(--primary-hover) 55%, var(--primary-deep) 100%)',
        boxShadow: '0 6px 18px color-mix(in srgb, var(--primary-hover) 28%, transparent)',
      }}
    >
      <div className="eyebrow" style={{ opacity: 0.85 }}>Minta-motor</div>
      <div style={{ fontFamily: 'var(--ff-display)', fontSize: 22, fontWeight: 800, marginTop: 2 }}>
        {liveCount} élő összefüggés
      </div>
      <div className="row gap-md" style={{ marginTop: 10, fontSize: 11, flexWrap: 'wrap' }}>
        <span>{monitor.pairs.length} figyelt pár</span>
        <span>{monitor.metrics.length} mért metrika</span>
        <span>
          utolsó felismerés:{' '}
          <span>{monitor.lastRunAt ? monitor.lastRunAt.slice(0, 10) : 'még nem talált mintát'}</span>
        </span>
      </div>
      <div className="row gap-md" style={{ marginTop: 8, fontSize: 10, opacity: 0.8, flexWrap: 'wrap' }}>
        <span>{monitor.windowFrom} – {monitor.windowTo}</span>
        <span>{monitor.lookbackDays} nap</span>
        <span>min. {monitor.minN} illeszkedő nap</span>
        <span style={{ fontFamily: 'var(--ff-mono)' }}>{monitor.cron}</span>
      </div>
    </div>
  )
}

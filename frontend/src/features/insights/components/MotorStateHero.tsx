import { BUCKET_ORDER, type LifecycleBucket } from '@/features/insights/logic/lifecycle'
import { DOMAIN_META, DOMAIN_ORDER } from '@/features/insights/logic/domains'
import type { MetricDomain, PatternMonitor } from '@/data/types'

const TILE_META: Record<LifecycleBucket, { label: string; color: string; bg?: string; border?: string }> = {
  decide: { label: 'döntésre vár', color: 'var(--warning-deep)', bg: 'var(--warning-bg)', border: 'var(--warning-soft)' },
  monitoring: { label: 'megfigyelés alatt', color: 'var(--accent-base)' },
  confirmed: { label: 'megerősítve', color: 'var(--success-deep)', bg: 'var(--success-bg)', border: 'var(--success-soft)' },
  gathering: { label: 'még gyűlik', color: 'var(--text-secondary)' },
  noRelationship: { label: 'nincs kapcsolat', color: 'var(--text-tertiary)' },
  rejected: { label: 'elvetve', color: 'var(--text-tertiary)' },
}

/** „ma HH:mm" — az utolsó motor-futás ideje (a job minden éjjel egyszer fut). */
function lastRunLabel(lastRunAt: string | null): string {
  if (!lastRunAt) return '—'
  const time = new Date(lastRunAt).toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' })
  return `ma ${time}`
}

/**
 * A Minták dashboard hero-kártyája (spec 2026-08-14 · mezo-tk88.4): a motor egy pillantásra —
 * hány kérdést figyel, mennyi vár döntésre, hat életciklus-csempe + domén-szűrő. Pure props;
 * az életciklus-számolás (`bucketize`) a hívó (`PatternsPage`) dolga.
 */
export function MotorStateHero({
  monitor,
  counts,
  activeDomains,
  onToggleDomain,
}: {
  monitor: PatternMonitor | null
  counts: Record<LifecycleBucket, number>
  activeDomains: Set<MetricDomain>
  onToggleDomain: (d: MetricDomain) => void
}) {
  const questionCount = monitor?.pairs.length ?? 0
  const presentDomains = DOMAIN_ORDER.filter((d) => monitor?.pairs.some((p) => p.metricBDomain === d))

  return (
    <div className="card" style={{ padding: '15px 16px' }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="eyebrow">A motor állapota</span>
        <span className="label-mono">{lastRunLabel(monitor?.lastRunAt ?? null)} · {monitor?.lookbackDays ?? 0} nap</span>
      </div>

      <p style={{ fontSize: 13.5, lineHeight: 1.55, marginTop: 9, color: 'var(--text-secondary)' }}>
        <b style={{ color: 'var(--text-primary)' }}>{questionCount} kérdést</b> figyelek a naplóidból.{' '}
        <b style={{ color: 'var(--success-deep)' }}>{counts.confirmed} megerősített</b> összefüggés dolgozik a
        társban, <b style={{ color: 'var(--warning-deep)' }}>{counts.decide} vár a döntésedre</b>.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 12 }}>
        {BUCKET_ORDER.map((bucket) => {
          const meta = TILE_META[bucket]
          return (
            <div
              key={bucket}
              style={{
                borderRadius: 14, padding: '10px 6px 9px', textAlign: 'center',
                background: meta.bg ?? 'var(--surface-glass)',
                border: `1px solid ${meta.border ?? 'var(--border-subtle)'}`,
              }}
            >
              <b style={{ display: 'block', fontFamily: 'var(--ff-display)', fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1, color: meta.color }}>
                {counts[bucket]}
              </b>
              <span style={{ display: 'block', fontSize: 9.5, fontWeight: 600, letterSpacing: '.04em', color: 'var(--text-tertiary)', marginTop: 5, lineHeight: 1.25 }}>
                {meta.label}
              </span>
            </div>
          )
        })}
      </div>

      <div className="row gap-sm" style={{ marginTop: 12, flexWrap: 'wrap' }}>
        <button
          type="button"
          className={activeDomains.size === 0 ? 'chip brand' : 'chip'}
          onClick={() => activeDomains.forEach((d) => onToggleDomain(d))}
        >
          Mind
        </button>
        {presentDomains.map((d) => (
          <button
            key={d}
            type="button"
            className={activeDomains.has(d) ? 'chip brand' : 'chip'}
            onClick={() => onToggleDomain(d)}
          >
            {DOMAIN_META[d].icon} {DOMAIN_META[d].label}
          </button>
        ))}
      </div>
    </div>
  )
}

import type { GrowthBadge } from '@/data/types'

/** 9 computed growth badges — achieved = sage tint + ✓; else lav progress bar (Growth page). */
export function BadgesCard({ badges }: { badges: GrowthBadge[] }) {
  const done = badges.filter((b) => b.achieved).length
  return (
    <div className="card notch-12" style={{ padding: '14px 15px 15px', position: 'relative', overflow: 'hidden' }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="eyebrow" style={{ color: 'var(--lav-deep)' }}>Badge-ek</span>
        <span className="chip notch-4">{done} / {badges.length} megszerezve</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 10 }}>
        {badges.map((b) => (
          <div key={b.key} style={{
            background: b.achieved ? 'var(--wash-sage)' : 'var(--surface-2)',
            border: `1px solid ${b.achieved ? 'var(--sage)' : 'var(--border-subtle)'}`,
            borderRadius: 4, padding: '10px 6px 8px', textAlign: 'center' }}>
            <div style={{ fontSize: 19 }}>{b.icon}</div>
            <div style={{ fontSize: 9.5, fontWeight: 600, marginTop: 4, lineHeight: 1.25 }}>{b.name}</div>
            {b.achieved ? (
              <div style={{ fontSize: 8, fontWeight: 800, color: 'var(--sage-deep)', marginTop: 3 }}>✓</div>
            ) : (
              <>
                <div style={{ height: 3, background: 'var(--surface-3)', borderRadius: 2, marginTop: 5, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.min(100, (b.current / b.target) * 100)}%`, background: 'var(--lav-deep)' }} />
                </div>
                <div style={{ fontSize: 8, fontWeight: 800, color: 'var(--text-tertiary)', marginTop: 3 }}>
                  {b.current.toLocaleString('hu-HU').replace(/[  ]/g, ' ')} / {b.target.toLocaleString('hu-HU').replace(/[  ]/g, ' ')}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

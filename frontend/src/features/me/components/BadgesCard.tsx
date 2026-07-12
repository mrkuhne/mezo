import type { GrowthBadge } from '@/data/types'

/** 9 computed growth badges — achieved = brand tint + ✓; else progress bar (Growth page). */
export function BadgesCard({ badges }: { badges: GrowthBadge[] }) {
  const done = badges.filter((b) => b.achieved).length
  return (
    <div className="card notch-12" style={{ padding: '14px 15px 15px', position: 'relative', overflow: 'hidden' }}>
      <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: 'linear-gradient(var(--brand-core), var(--brand-primary))' }} />
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="eyebrow brand">Badge-ek</span>
        <span className="chip notch-4">{done} / {badges.length} megszerezve</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 10 }}>
        {badges.map((b) => (
          <div key={b.key} style={{
            background: b.achieved ? 'rgba(94,234,212,0.05)' : 'var(--surface-2)',
            border: `1px solid ${b.achieved ? 'var(--border-brand)' : 'var(--border-subtle)'}`,
            borderRadius: 4, padding: '10px 6px 8px', textAlign: 'center' }}>
            <div style={{ fontSize: 19 }}>{b.icon}</div>
            <div style={{ fontSize: 9.5, fontWeight: 600, marginTop: 4, lineHeight: 1.25 }}>{b.name}</div>
            {b.achieved ? (
              <div style={{ fontFamily: 'var(--ff-mono)', fontSize: 8, color: 'var(--brand-glow)', marginTop: 3 }}>✓</div>
            ) : (
              <>
                <div style={{ height: 3, background: 'var(--surface-3)', borderRadius: 2, marginTop: 5, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.min(100, (b.current / b.target) * 100)}%`, background: 'var(--brand-primary)' }} />
                </div>
                <div style={{ fontFamily: 'var(--ff-mono)', fontSize: 8, color: 'var(--text-tertiary)', marginTop: 3 }}>
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

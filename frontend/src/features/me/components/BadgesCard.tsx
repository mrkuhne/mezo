import type { GrowthBadge } from '@/data/types'

/**
 * 9 computed growth badges — achieved = sage tint + ✓; else a gold progress bar
 * (Growth page Kitüntetések tab). Mozaik reface (mezo-d20.6.5): the prototype's
 * `.bdggrid`/`.bdg` 3-col tile grid, the unearned tiles' bar animating in once
 * (mzp-fill, prefers-reduced-motion guarded) like the predictions/experiments family.
 */
export function BadgesCard({ badges }: { badges: GrowthBadge[] }) {
  const done = badges.filter((b) => b.achieved).length
  return (
    <div className="rise" style={{ '--d': '0ms' } as React.CSSProperties}>
      <div className="row" style={{ justifyContent: 'space-between', padding: '0 2px 8px' }}>
        <span className="mz-eyebrow">Badge-ek</span>
        <span className="gr-band-chip">{done} / {badges.length} megszerezve</span>
      </div>
      <div className="gr-bdggrid">
        {badges.map((b, i) => (
          <div key={b.key} className={b.achieved ? 'gr-bdg done' : 'gr-bdg'}>
            <div className="gr-bdg-em" aria-hidden="true">{b.icon}</div>
            <b>{b.name}</b>
            {b.achieved ? (
              <small style={{ color: 'var(--mz-cell-sage-ink)', fontWeight: 800 }}>✓</small>
            ) : (
              /* prototype `.bdg` order: name → count → bar (en-body #page-growth) */
              <>
                <small>{b.current.toLocaleString('hu-HU').replace(/[  ]/g, ' ')} / {b.target.toLocaleString('hu-HU').replace(/[  ]/g, ' ')}</small>
                <div className="gr-bdg-bar">
                  <div style={{ width: `${Math.min(100, (b.current / b.target) * 100)}%`, '--d': `${350 + i * 60}ms` } as React.CSSProperties} />
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

import type { GrowthBadge } from '@/data/types'
import { huInt } from '@/shared/lib/huNum'

/** Badge grid (mezo-rmi0.1): earned = sage wash + full sage ring + "✓ megvan"; unearned keeps a conic
 *  progress ring (--v = current/target %) and a muted icon — reachable badges stay visible. */
export function BadgesCard({ badges }: { badges: GrowthBadge[] }) {
  const done = badges.filter((b) => b.achieved).length
  return (
    <>
      <div className="gr-band-top rise" style={{ '--d': '110ms', padding: '4px 2px 7px' } as React.CSSProperties}>
        <span className="mz-eyebrow" style={{ color: 'var(--mz-cell-sage-ink)' }}>Jelvények</span>
        <span className="gr-band-chip ok">{done} / {badges.length} megszerezve</span>
      </div>
      <div className="gr-bdggrid rise" style={{ '--d': '140ms' } as React.CSSProperties}>
        {badges.map((b) => {
          const v = b.achieved ? 100 : Math.min(100, Math.round((b.current / b.target) * 100))
          return (
            <div key={b.key} className={b.achieved ? 'gr-bdg done' : 'gr-bdg'}>
              <div className="gr-ring" style={{ '--v': v } as React.CSSProperties}><span aria-hidden="true">{b.icon}</span></div>
              <b>{b.name}</b>
              <small>{b.achieved ? '✓ megvan' : `${huInt(b.current)} / ${huInt(b.target)}`}</small>
            </div>
          )
        })}
      </div>
    </>
  )
}

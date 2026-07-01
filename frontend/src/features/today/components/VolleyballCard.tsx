import { Icon } from '@/shared/ui/Icon'
import type { VolleyballSession } from '@/data/types'

export function VolleyballCard({ session }: { session?: VolleyballSession }) {
  if (!session) return null
  return (
    <div style={{ padding: '8px 24px 16px' }}>
      <div className="col gap-sm">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className="eyebrow" style={{ color: 'var(--cat-tendency)' }}>Sport · {session.time}</span>
          <span className="eyebrow text-tertiary">{session.duration} perc</span>
        </div>
        <div className="card notch-12" style={{
          padding: '14px 18px',
          background: 'rgba(244, 114, 182, 0.04)',
          borderColor: 'rgba(244, 114, 182, 0.3)',
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 2, background: 'var(--cat-tendency)' }} />
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="col">
              <div className="h-display size-sm" style={{ lineHeight: 1.15 }}>Röplabda · BVSC</div>
              <span className="text-tertiary" style={{ fontSize: 11, marginTop: 4, fontFamily: 'var(--ff-mono)' }}>{session.court} · {session.role}</span>
            </div>
            <Icon name="chevron-right" size={18} color="var(--cat-tendency)" />
          </div>

          <div className="row gap-sm mt-md" style={{
            paddingTop: 10, borderTop: '1px solid rgba(244, 114, 182, 0.15)',
            alignItems: 'flex-start',
          }}>
            <Icon name="sparkle" size={11} color="var(--brand-glow)" />
            <span style={{ fontSize: 11, color: 'var(--text-primary)', lineHeight: 1.5, flex: 1 }}>
              <strong style={{ color: 'var(--brand-glow)', fontWeight: 500 }}>Stacked day</strong> — Pull Day 17:00, Volleyball 19:30. A T-2h carb-ablakot pre-volleyball-ra hozzuk · vacsorát 21:30 előtt zárjuk.
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

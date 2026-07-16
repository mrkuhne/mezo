import { useState } from 'react'
import { Icon } from '@/shared/ui/Icon'
import { RefTag } from '@/shared/ui/RefTag'
import { cn } from '@/shared/lib/cn'
import { useMemoir } from '@/data/hooks'

type ReactionKey = 'like' | 'love' | 'save' | 'dismiss'

export function MemoirPage() {
  const { memoir, anniversaryNote, mode } = useMemoir()
  const [reactions, setReactions] = useState<Record<ReactionKey, boolean>>({
    like: false,
    love: false,
    save: false,
    dismiss: false,
  })
  const toggle = (k: ReactionKey) => setReactions((r) => ({ ...r, [k]: !r[k] }))

  // Live mode with no generated memoir yet (404/loading/error) → honest placeholder, never
  // the demo fiction. Mock always has the seed, so a null memoir only ever occurs in live mode.
  if (memoir == null) {
    return (
      <div className="col gap-md">
        <div className="card" style={{ padding: 16 }}>
          <span className="eyebrow" style={{ color: 'var(--lav-deep)' }}>Heti memoár</span>
          <p style={{ fontSize: 13, marginTop: 8, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
            Az első memoár a hét zárásakor készül el.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="col gap-md">
      <div className="card memoir-card" style={{ padding: 22, position: 'relative', overflow: 'hidden' }}>
        <div
          style={{ position: 'absolute', right: -40, top: -40, width: 120, height: 120, borderRadius: '50%', background: 'radial-gradient(circle, color-mix(in srgb, var(--lav) 16%, transparent), transparent 70%)' }}
        />
        <div className="row gap-sm">
          <Icon name="bookmark" size={14} color="var(--lav-deep)" />
          <span className="eyebrow" style={{ color: 'var(--lav-deep)' }}>Heti memoár · {memoir.week}</span>
        </div>
        <div style={{ fontFamily: 'var(--ff-display)', fontSize: 22, fontWeight: 600, lineHeight: 1.15, marginTop: 12, color: 'var(--text-primary)' }}>
          {memoir.title}
        </div>
        <p style={{ fontSize: 14, lineHeight: 1.65, marginTop: 14, color: 'var(--text-primary)' }}>{memoir.body}</p>

        <div className="row gap-xs flex-wrap mt-lg" style={{ paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
          <span className="eyebrow text-tertiary" style={{ marginRight: 6 }}>Anchors</span>
          {memoir.anchors.map((a, i) => (
            <RefTag key={i} kind={a.kind} label={a.label} />
          ))}
        </div>

        {mode === 'mock' ? (
          <div className="row gap-sm mt-lg">
            <button type="button" onClick={() => toggle('like')} className={cn('chip', reactions.like && 'brand')} style={{ padding: '8px 12px' }}>
              👍 Like
            </button>
            <button type="button" onClick={() => toggle('love')} className={cn('chip', reactions.love && 'brand')} style={{ padding: '8px 12px' }}>
              <Icon name="heart" size={12} color={reactions.love ? 'var(--coral)' : undefined} /> Love
            </button>
            <button type="button" onClick={() => toggle('save')} className={cn('chip', reactions.save && 'brand')} style={{ padding: '8px 12px' }}>
              <Icon name="bookmark" size={12} color={reactions.save ? 'var(--coral)' : undefined} /> Save
            </button>
            <button type="button" onClick={() => toggle('dismiss')} className="chip" style={{ padding: '8px 12px', opacity: reactions.dismiss ? 0.5 : 1 }}>
              <Icon name="x" size={12} /> Dismiss
            </button>
          </div>
        ) : null}
      </div>

      {mode === 'mock' ? (
        <div className="card" style={{ padding: 16, borderColor: 'color-mix(in srgb, var(--lav) 32%, transparent)', background: 'var(--wash-lav)' }}>
          <div className="row gap-sm">
            <Icon name="sparkle" size={14} color="var(--lav-deep)" />
            <span className="eyebrow" style={{ color: 'var(--lav-deep)' }}>Évforduló · 1 hónap</span>
          </div>
          <p style={{ fontSize: 13, marginTop: 8, color: 'var(--text-primary)', lineHeight: 1.5 }}>{anniversaryNote}</p>
        </div>
      ) : null}

      {mode === 'mock' ? (
        <div className="row gap-sm" style={{ justifyContent: 'center', marginTop: 8 }}>
          <span className="eyebrow text-tertiary">Memoir archive · 17 darab</span>
          <span className="eyebrow" style={{ color: 'var(--lav-deep)' }}>→</span>
        </div>
      ) : null}
    </div>
  )
}

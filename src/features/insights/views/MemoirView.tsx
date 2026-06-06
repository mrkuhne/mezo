import { useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { RefTag } from '@/components/ui/RefTag'
import { cn } from '@/lib/cn'
import { useInsights } from '@/data/hooks'

type ReactionKey = 'like' | 'love' | 'save' | 'dismiss'

export function MemoirView() {
  const { memoir, anniversaryNote } = useInsights()
  const [reactions, setReactions] = useState<Record<ReactionKey, boolean>>({
    like: false,
    love: false,
    save: false,
    dismiss: false,
  })
  const toggle = (k: ReactionKey) => setReactions((r) => ({ ...r, [k]: !r[k] }))

  return (
    <div className="col gap-md">
      <div className="memoir-card notch-12" style={{ padding: 22, position: 'relative', overflow: 'hidden' }}>
        <div
          style={{ position: 'absolute', right: -40, top: -40, width: 120, height: 120, borderRadius: '50%', background: 'radial-gradient(circle, rgba(94, 234, 212, 0.15), transparent 70%)' }}
        />
        <div className="row gap-sm">
          <Icon name="bookmark" size={14} color="var(--brand-glow)" />
          <span className="eyebrow brand">Heti memoir · {memoir.week}</span>
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

        <div className="row gap-sm mt-lg">
          <button type="button" onClick={() => toggle('like')} className={cn('chip', reactions.like && 'brand')} style={{ padding: '8px 12px' }}>
            👍 Like
          </button>
          <button type="button" onClick={() => toggle('love')} className={cn('chip', reactions.love && 'brand')} style={{ padding: '8px 12px' }}>
            <Icon name="heart" size={12} color={reactions.love ? 'var(--brand-glow)' : undefined} /> Love
          </button>
          <button type="button" onClick={() => toggle('save')} className={cn('chip', reactions.save && 'brand')} style={{ padding: '8px 12px' }}>
            <Icon name="bookmark" size={12} color={reactions.save ? 'var(--brand-glow)' : undefined} /> Save
          </button>
          <button type="button" onClick={() => toggle('dismiss')} className="chip" style={{ padding: '8px 12px', opacity: reactions.dismiss ? 0.5 : 1 }}>
            <Icon name="x" size={12} /> Dismiss
          </button>
        </div>
      </div>

      <div className="card notch-12" style={{ padding: 16, borderColor: 'rgba(94, 234, 212, 0.3)', background: 'rgba(94, 234, 212, 0.03)' }}>
        <div className="row gap-sm">
          <Icon name="sparkle" size={14} color="var(--brand-glow)" />
          <span className="eyebrow brand">Évforduló · 1 hónap</span>
        </div>
        <p style={{ fontSize: 13, marginTop: 8, color: 'var(--text-primary)', lineHeight: 1.5 }}>{anniversaryNote}</p>
      </div>

      <div className="row gap-sm" style={{ justifyContent: 'center', marginTop: 8 }}>
        <span className="eyebrow text-tertiary">Memoir archive · 17 darab</span>
        <span className="eyebrow brand">→</span>
      </div>
    </div>
  )
}

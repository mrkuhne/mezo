import { useMemo } from 'react'
import { Icon } from '@/shared/ui/Icon'
import { RefTag } from '@/shared/ui/RefTag'
import { FeedbackChips } from '@/features/insights/components/FeedbackChips'
import { useFeedback, useMemoir } from '@/data/hooks'

export function MemoirPage() {
  const { memoir, anniversaryNote, mode } = useMemoir()
  // Real 👍/👎 on the memoir (mezo-b3pp.15) — this REPLACED a mock-only Like/Love/Save/Dismiss
  // row that wrote nowhere and never rendered in live mode at all (mezo-kr9v).
  const memoirId = memoir?.id
  const feedbackIds = useMemo(() => (memoirId ? [memoirId] : []), [memoirId])
  const feedback = useFeedback('memoir', feedbackIds)

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

        {/* Both modes — the memoir is an AI artifact wherever it comes from. */}
        <div className="mt-lg">
          <FeedbackChips
            value={feedback.get(memoir.id)}
            onVote={(verdict, reason) => feedback.vote(memoir.id, verdict, reason)}
            label="a heti memoárról"
          />
        </div>
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

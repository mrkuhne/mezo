// ============================================================
// Mezo · MemoirPage — the Memoár page re-faced to Mozaik 2.0 (mezo-d20.5.5).
// Source of truth: docs/design_2.0/prototypes/src/mezo-body.html #page-memoar
// (×1.18): page hero (clay i-memoar + "a közös történetünk, hétről hétre"),
// then the Fraunces-titled chapter card with the lavender glow, the
// "Horgonyok" anchor chips and the feedback chips, plus the mock-only
// lav-washed anniversary card. The dead "Memoir archive · 17 darab" row is
// retired (audit §3: decorative, not to promote). Data/behavior unchanged:
// useMemoir + useFeedback verbatim; the honest W2 null-state stays exactly.
// ============================================================
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { MozaikPage, PageHead, PageHero, PageBody } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { RefTag } from '@/shared/ui/RefTag'
import { FeedbackChips } from '@/features/insights/components/FeedbackChips'
import { useFeedback, useMemoir } from '@/data/hooks'

export function MemoirPage() {
  const navigate = useNavigate()
  const { memoir, anniversaryNote, mode } = useMemoir()
  // Real 👍/👎 on the memoir (mezo-b3pp.15) — this REPLACED a mock-only Like/Love/Save/Dismiss
  // row that wrote nowhere and never rendered in live mode at all (mezo-kr9v).
  const memoirId = memoir?.id
  const feedbackIds = useMemo(() => (memoirId ? [memoirId] : []), [memoirId])
  const feedback = useFeedback('memoir', feedbackIds)

  // Scaffold (ADR 0032 / fidelity audit mezo-d20.11): the page owns its own `‹ Mezo` head —
  // before this it mounted none, so the Memoár was a navigation dead end.
  const frame = (children: React.ReactNode) => (
    <MozaikPage tone="lav">
      <PageHead onBack={() => navigate('/mezo')} label="‹ Mezo" />
      <PageHero icon="i-memoar" name="Memoár" sub="a közös történetünk, hétről hétre" />
      <PageBody>{children}</PageBody>
    </MozaikPage>
  )

  // Live mode with no generated memoir yet (404/loading/error) → honest placeholder, never
  // the demo fiction. Mock always has the seed, so a null memoir only ever occurs in live mode.
  if (memoir == null) {
    return frame(
      <div className="card" style={{ padding: 16 }}>
        <span className="eyebrow" style={{ color: 'var(--mz-cell-lav-ink)' }}>Heti memoár</span>
        <p style={{ fontSize: 13, marginTop: 8, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
          Az első memoár a hét zárásakor készül el.
        </p>
      </div>,
    )
  }

  return frame(
    <EntranceGroup className="col gap-md">
      <div className="mz-memoir rise" style={{ '--d': '0ms' } as React.CSSProperties}>
        <span className="mz-eyebrow" style={{ color: 'var(--mz-cell-lav-ink)' }}>
          Heti memoár · {memoir.week}
        </span>
        <div className="mz-memoir-ttl">{memoir.title}</div>
        <p className="mz-memoir-bd">{memoir.body}</p>

        <div className="mz-memoir-foot">
          <span className="mz-eyebrow" style={{ marginRight: 4 }}>Horgonyok</span>
          {memoir.anchors.map((a, i) => (
            <RefTag key={i} kind={a.kind} label={a.label} />
          ))}
        </div>

        {/* Both modes — the memoir is an AI artifact wherever it comes from. Keyed by the memoir
            id like the other four mount sites: advisory since the reason row derives from the
            verdict, but it still guarantees no per-instance state survives a change of artifact. */}
        <div className="mt-lg">
          <FeedbackChips
            key={memoir.id}
            value={feedback.get(memoir.id)}
            onVote={(verdict, reason) => feedback.vote(memoir.id, verdict, reason)}
            label="a heti memoárról"
          />
        </div>
      </div>

      {mode === 'mock' ? (
        <div className="mz-anniv rise" style={{ '--d': '90ms' } as React.CSSProperties}>
          <span className="mz-eyebrow" style={{ color: 'var(--mz-cell-lav-ink)' }}>Évforduló · 1 hónap</span>
          <p>{anniversaryNote}</p>
        </div>
      ) : null}
    </EntranceGroup>,
  )
}

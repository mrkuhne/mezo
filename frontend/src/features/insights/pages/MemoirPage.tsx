// ============================================================
// Mezo · MemoirPage — the Memoár page, in üveg (mezo-me75u.8, block `uveg mezo1 memoar`).
// Source of truth: docs/design_2.0/prototypes/src/uveg-mezo-body.html `memoar()`:
// glass back pill, the lavender halo hero (t-scroll), then THE one lavender glass
// card — eyebrow, the serif-italic title, the upright drop-cap prose (bible rule 23),
// "Horgonyok" as flat chips with 3D kind icons, the feedback row — plus the mock-only
// amber anniversary cell and the flat Archívum door row. Data/behavior unchanged:
// useMemoir + useFeedback verbatim; the honest W2 null-state stays (dashed, rank 4).
// ============================================================
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { MozaikPage, PageHead, PageHero, PageBody } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { Icon3D } from '@/shared/ui/clay'
import { RefTag } from '@/shared/ui/RefTag'
import { FeedbackChips } from '@/features/insights/components/FeedbackChips'
import { useFeedback, useMemoir } from '@/data/hooks'

const LAV = { '--c': 'var(--dv-lav)' } as React.CSSProperties

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
    <MozaikPage tone="lav" className="mmo-page mmo-memoar">
      <PageHead glass onBack={() => navigate('/mezo')} label="Mezo" />
      <PageHero art="t-scroll" accent="var(--dv-lav)" name="Memoár" sub="a közös történetünk, hétről hétre" />
      <PageBody>{children}</PageBody>
    </MozaikPage>
  )

  // Live mode with no generated memoir yet (404/loading/error) → honest placeholder, never
  // the demo fiction. Mock always has the seed, so a null memoir only ever occurs in live mode.
  if (memoir == null) {
    return frame(
      <div className="mmo-empty uv-empty" style={LAV}>
        <span className="uv-eyebrow">Heti memoár</span>
        <p>Az első memoár a hét zárásakor készül el.</p>
      </div>,
    )
  }

  return frame(
    <EntranceGroup className="col">
      <article className="mmo-article glass rise" style={{ ...LAV, '--d': '0ms' } as React.CSSProperties}>
        <span className="uv-eyebrow mmo-eb">Heti memoár · {memoir.week}</span>
        <h2 className="mmo-ttl">{memoir.title}</h2>
        {/* prompt v2 writes \n\n paragraph breaks; the first paragraph carries the drop cap. */}
        <div className="mmo-prose">
          {memoir.body.split('\n\n').map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>

        <div className="mmo-anch">
          <span className="uv-eyebrow">Horgonyok</span>
          <div className="mmo-chips">
            {memoir.anchors.map((a, i) => (
              <RefTag key={i} glass kind={a.kind} label={a.label} />
            ))}
          </div>
        </div>

        {/* Both modes — the memoir is an AI artifact wherever it comes from. Keyed by the memoir
            id like the other four mount sites: advisory since the reason row derives from the
            verdict, but it still guarantees no per-instance state survives a change of artifact. */}
        <div className="mmo-fbk">
          <FeedbackChips
            key={memoir.id}
            value={feedback.get(memoir.id)}
            onVote={(verdict, reason) => feedback.vote(memoir.id, verdict, reason)}
            label="a heti memoárról"
            glyph3d
          />
        </div>
      </article>

      {mode === 'mock' ? (
        <div className="mmo-anniv rise" style={{ '--d': '90ms' } as React.CSSProperties}>
          <Icon3D name="t-calendar" size={34} />
          <div className="grow">
            <span className="uv-eyebrow">Évforduló · 1 hónap</span>
            <p>{anniversaryNote}</p>
          </div>
        </div>
      ) : null}

      {/* F7.5 (mezo-d20.8.5): the archive footer returns — retired at mezo-d20.5.5 as a dead
          affordance, un-retired now that a real shelf lives behind it. */}
      <button
        type="button"
        className="mmo-door rise"
        style={{ ...LAV, '--d': '160ms' } as React.CSSProperties}
        onClick={() => navigate('/mezo/memoir/archivum')}
      >
        <span className="uv-well" aria-hidden="true"><Icon3D name="t-scroll" size={28} /></span>
        <span className="grow">
          <strong>Archívum</strong>{' '}
          <small>a korábbi fejezetek</small>
        </span>
        <span className="chev" aria-hidden="true">›</span>
      </button>
    </EntranceGroup>,
  )
}

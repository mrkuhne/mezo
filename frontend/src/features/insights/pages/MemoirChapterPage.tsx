// ============================================================
// Mezo · MemoirChapterPage — one shelf chapter (F7.5, mezo-d20.8.5).
// Source of truth: the mezo-uajy chapter language merged into
// docs/design_2.0/prototypes/src/mezo-body.html #page-memoar-fej, restaged in
// mezo-memoar.html: hero (Hét N + date), the drop-cap memoir card with
// paragraph rhythm, the "Miből íródott" anchor chips (static — anchor
// target-refs are mezo-uajy's deferred backend flag), FeedbackChips, and the
// előző/következő pager walking the shelf order.
// ============================================================
import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { MozaikPage, PageHead, PageHero, PageBody } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { RefTag } from '@/shared/ui/RefTag'
import { FeedbackChips } from '@/features/insights/components/FeedbackChips'
import { useFeedback, useMemoirArchive } from '@/data/hooks'
import { isoWeekNumber } from '@/data/insights/weeklyHooks'
import { deriveWeekTitle } from '@/data/fuel/fuelWeekHooks'

export function MemoirChapterPage() {
  const navigate = useNavigate()
  const { weekStart } = useParams()
  const { data: entries, isPending } = useMemoirArchive()
  const idx = entries.findIndex((e) => e.weekStart === weekStart)
  const chapter = idx >= 0 ? entries[idx] : null
  // Shelf order is weekStart desc: "előző" (older) sits AFTER, "következő" (newer) BEFORE.
  const older = idx >= 0 ? entries[idx + 1] : undefined
  const newer = idx > 0 ? entries[idx - 1] : undefined

  const feedbackIds = useMemo(() => (chapter ? [chapter.id] : []), [chapter])
  const feedback = useFeedback('memoir', feedbackIds)

  const frame = (children: React.ReactNode, hero?: React.ReactNode) => (
    <MozaikPage tone="lav">
      <PageHead onBack={() => navigate('/mezo/memoir/archivum')} label="‹ Archívum" />
      {hero}
      <PageBody>{children}</PageBody>
    </MozaikPage>
  )

  // Honest missing state — a stale deep link, or a live shelf that no longer has this week.
  if (chapter == null) {
    return frame(
      <div className="mz-qcard" style={{ textAlign: 'center', padding: 24 }}>
        <span className="text-tertiary" style={{ fontSize: 13, lineHeight: 1.5 }}>
          {isPending ? 'A fejezet töltődik…' : 'Ez a fejezet nincs meg az archívumban.'}
        </span>
      </div>,
    )
  }

  return frame(
    <EntranceGroup className="col gap-md">
      <div className="mz-memoir rise" style={{ '--d': '60ms' } as React.CSSProperties}>
        <div className="row" style={{ alignItems: 'center', gap: 8 }}>
          <span className="mz-eyebrow grow" style={{ color: 'var(--mz-cell-lav-ink)' }}>
            Heti memoár · Hét {isoWeekNumber(chapter.weekStart)}
          </span>
          <span className="text-tertiary" style={{ fontSize: 10, fontVariantNumeric: 'tabular-nums' }}>
            {deriveWeekTitle(chapter.weekStart)}
          </span>
        </div>
        <div className="mz-memoir-ttl">{chapter.title}</div>
        {/* prompt v2 (mezo-uajy) writes \n\n paragraph breaks; the first paragraph carries
            the drop cap (mz-march-bd). A legacy single-block body renders as one paragraph. */}
        <div className="mz-march-bd">
          {chapter.body.split('\n\n').map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>

        <div className="mz-memoir-foot">
          <span className="mz-eyebrow" style={{ marginRight: 4 }}>Miből íródott</span>
          {chapter.anchors.map((a, i) => (
            <RefTag key={i} kind={a.kind} label={a.label} />
          ))}
        </div>

        <div className="mt-lg">
          <FeedbackChips
            key={chapter.id}
            value={feedback.get(chapter.id)}
            onVote={(verdict, reason) => feedback.vote(chapter.id, verdict, reason)}
            label="erről a fejezetről"
          />
        </div>
      </div>

      {(older || newer) && (
        <div className="mz-march-pager rise" style={{ '--d': '140ms' } as React.CSSProperties}>
          {older ? (
            <button type="button" className="tile" onClick={() => navigate(`/mezo/memoir/${older.weekStart}`)}>
              <span className="dir">‹ előző</span>
              <span className="wk">Hét {isoWeekNumber(older.weekStart)}</span>
              <span className="ct">{older.title}</span>
            </button>
          ) : <span className="tile ghost" aria-hidden />}
          {newer ? (
            <button type="button" className="tile nx" onClick={() => navigate(`/mezo/memoir/${newer.weekStart}`)}>
              <span className="dir">következő ›</span>
              <span className="wk">Hét {isoWeekNumber(newer.weekStart)}</span>
              <span className="ct">{newer.title}</span>
            </button>
          ) : <span className="tile ghost" aria-hidden />}
        </div>
      )}
    </EntranceGroup>,
    <PageHero
      name={`Hét ${isoWeekNumber(chapter.weekStart)}`}
      sub={`${deriveWeekTitle(chapter.weekStart)} · ${chapter.weekStart.slice(0, 4)}`}
    />,
  )
}

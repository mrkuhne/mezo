// ============================================================
// Mezo · MemoirChapterPage — one shelf chapter (F7.5, mezo-d20.8.5), in üveg
// (mezo-me75u.8, block `uveg mezo1 memoar`). Source of truth:
// docs/design_2.0/prototypes/src/uveg-mezo-body.html `fejezet()`: glass back pill,
// a text-only lavender halo hero (Hét N + date), THE one lavender glass card with
// the upright drop-cap paragraphs (bible rule 23), the "Miből íródott" flat anchor
// chips (static — anchor target-refs are mezo-uajy's deferred backend flag),
// FeedbackChips, and the előző/következő pager as two flat cells walking the shelf
// order (a missing side is a dashed empty cell).
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

const LAV = { '--c': 'var(--dv-lav)' } as React.CSSProperties

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
    <MozaikPage tone="lav" className="mmo-page mmo-fej">
      <PageHead glass onBack={() => navigate('/mezo/memoir/archivum')} label="Archívum" />
      {hero}
      <PageBody>{children}</PageBody>
    </MozaikPage>
  )

  // Honest missing state — a stale deep link, or a live shelf that no longer has this week.
  if (chapter == null) {
    return frame(
      <div className={isPending ? 'mmo-state uv-flat' : 'mmo-empty uv-empty'} style={LAV}>
        <p>{isPending ? 'A fejezet töltődik…' : 'Ez a fejezet nincs meg az archívumban.'}</p>
      </div>,
    )
  }

  return frame(
    <EntranceGroup className="col">
      <article className="mmo-article glass rise" style={{ ...LAV, '--d': '60ms' } as React.CSSProperties}>
        <div className="mmo-ebrow">
          <span className="uv-eyebrow mmo-eb">Heti memoár · Hét {isoWeekNumber(chapter.weekStart)}</span>
          <span className="mmo-date">{deriveWeekTitle(chapter.weekStart)}</span>
        </div>
        <h2 className="mmo-ttl">{chapter.title}</h2>
        {/* prompt v2 (mezo-uajy) writes \n\n paragraph breaks; the first paragraph carries
            the drop cap. A legacy single-block body renders as one paragraph. */}
        <div className="mmo-prose">
          {chapter.body.split('\n\n').map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>

        <div className="mmo-anch">
          <span className="uv-eyebrow">Miből íródott</span>
          <div className="mmo-chips">
            {chapter.anchors.map((a, i) => (
              <RefTag key={i} glass kind={a.kind} label={a.label} />
            ))}
          </div>
        </div>

        <div className="mmo-fbk">
          <FeedbackChips
            key={chapter.id}
            value={feedback.get(chapter.id)}
            onVote={(verdict, reason) => feedback.vote(chapter.id, verdict, reason)}
            label="erről a fejezetről"
            glyph3d
          />
        </div>
      </article>

      {(older || newer) && (
        <div className="mmo-pager rise" style={{ '--d': '140ms' } as React.CSSProperties}>
          {older ? (
            <button type="button" className="mmo-pg" onClick={() => navigate(`/mezo/memoir/${older.weekStart}`)}>
              <small>‹ előző</small>
              <strong>Hét {isoWeekNumber(older.weekStart)}</strong>
              <span>{older.title}</span>
            </button>
          ) : <span className="mmo-pg is-empty uv-empty" style={LAV} aria-hidden />}
          {newer ? (
            <button type="button" className="mmo-pg nx" onClick={() => navigate(`/mezo/memoir/${newer.weekStart}`)}>
              <small>következő ›</small>
              <strong>Hét {isoWeekNumber(newer.weekStart)}</strong>
              <span>{newer.title}</span>
            </button>
          ) : <span className="mmo-pg is-empty uv-empty" style={LAV} aria-hidden />}
        </div>
      )}
    </EntranceGroup>,
    <PageHero
      glass
      accent="var(--dv-lav)"
      eyebrow="Heti memoár"
      name={`Hét ${isoWeekNumber(chapter.weekStart)}`}
      sub={`${deriveWeekTitle(chapter.weekStart)} · ${chapter.weekStart.slice(0, 4)}`}
    />,
  )
}

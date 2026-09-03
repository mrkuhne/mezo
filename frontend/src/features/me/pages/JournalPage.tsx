import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '@/shared/ui/Icon'
import { ClaySpot } from '@/shared/ui/clay'
import { GhostState } from '@/shared/ui/GhostState'
import { Skeleton, SkeletonCard } from '@/shared/ui/Skeleton'
import { MozaikPage, PageHead, PageHero, PageBody } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { isDecisionDue, useDecisionActions, useDecisions, useGratitudeEntries, useJournalNotes } from '@/data/hooks'
import { JournalSheet } from '@/features/me/sheets/JournalSheet'
import { DecisionReviewSheet } from '@/features/me/sheets/DecisionReviewSheet'
import { GratitudeStreakCard } from '@/features/me/components/GratitudeStreakCard'
import { dayLabel } from '@/features/me/logic/growthJournal'
import { gratitudeStreakDays } from '@/features/me/logic/gratitudeStreak'
import { localDateString } from '@/shared/lib/dates'
import type { JournalNote } from '@/data/journal/journalTypes'
import type { DecisionEntry } from '@/data/journal/decisionTypes'

function monthLabel(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString('hu-HU', { year: 'numeric', month: 'long' })
}

/** First day of the month `monthsBack - 1` months before `todayIso`'s month — `monthsBack = 3`
 * means "this month + the two before it". Widening (Task 7's "Korábbi hónapok") just grows
 * `monthsBack`, which pushes `from` further back. Derives from the SAME `today` ISO string the
 * page already computed (not a fresh `new Date()`) so both ends of the window share one source of
 * truth for "now" — pure integer month arithmetic on `todayIso`'s own year/month, no re-entry into
 * `localDateString` (which only ever formats *this instant*, not an arbitrary target date). */
function windowFrom(monthsBack: number, todayIso: string): string {
  const [y, m] = todayIso.split('-').map(Number)
  const totalMonths = y * 12 + (m - 1) - (monthsBack - 1)
  const year = Math.floor(totalMonths / 12)
  const month = ((totalMonths % 12) + 12) % 12 + 1
  return `${year}-${String(month).padStart(2, '0')}-01`
}

// /me/naplo (Journal, mezo-d20.6.6 Mozaik re-face) — the read surface for free-prose journal
// notes: the Hálanapló streak tile, the GOLD decision card (the "tile → own page" pattern's ‹ Én
// back chip, source: en-body.html #page-naplo), and a month-grouped note list over a widening
// date window (mem-daycard idiom, reused verbatim from the Memória Napló segment).
//
// Behavior stays the prior sheet-based page's, verbatim: mock+real dual mode, honest states
// (loading → skeletons, a genuinely failed fetch ≠ an honest empty window, isError && length===0
// is the only tell), the widening "Korábbi hónapok" window, create/edit via JournalSheet.
//
// The rating flow follows the prototype exactly: tapping 1–5 commits immediately and replaces the
// gold card with the sage "✓ Visszanézve" line — no sheet in the primary path.
//
// LOST-FUNCTION REPAIR (mezo-d20.11): the re-face left `DecisionReviewSheet` with no host, so
// `reviewDecision` was permanently called without its third argument and a decision review could
// no longer record outcome PROSE — even though `DecisionReviewRequest.outcome`, its column and
// the embedding path that reads it are all live. Rather than move the whole review back into a
// sheet (which would lose the prototype's one-tap inline review), the sage acknowledgement now
// carries a follow-up affordance that opens the still-live sheet prefilled with the rating just
// given; saving re-runs the SAME idempotent PUT, this time with the prose. The prototype's card
// is untouched — this is purely additive, on a row the prototype leaves empty.
export function JournalPage() {
  const navigate = useNavigate()
  const [monthsBack, setMonthsBack] = useState(3)
  const [addOpen, setAddOpen] = useState(false)
  const [editNote, setEditNote] = useState<JournalNote | null>(null)
  // Local settle-state for the inline decision review — keyed by decision id so the sage
  // acknowledgement renders THIS render pass, before the mutation's cache update (mock: sync
  // setQueryData; real: invalidateQueries) has had a chance to drop the row from `useDecisions`'
  // data. Once that happens the id simply falls out of `decisions` too — harmless, the local
  // entry just stops being read.
  const [decidedRatings, setDecidedRatings] = useState<Record<string, number>>({})
  // The outcome-prose follow-up (see the LOST-FUNCTION REPAIR note above): the decision whose
  // review sheet is open, already carrying the rating the inline row committed.
  const [outcomeFor, setOutcomeFor] = useState<DecisionEntry | null>(null)

  const today = localDateString()
  const from = windowFrom(monthsBack, today)
  const { data: notes, isPending, isError, refetch } = useJournalNotes(from, today)
  const {
    data: decisions,
    isError: decisionsError,
    refetch: refetchDecisions,
  } = useDecisions()
  const { reviewDecision } = useDecisionActions()
  // The hero's own streak number (paintNaplo's `#page-naplo .page-hero .bignum` precedent) —
  // GratitudeStreakCard derives the SAME number for the tile below from its own hook call; the
  // shared react-query cache key means this costs no extra network round trip.
  const { data: gratitude, isPending: gratitudePending } = useGratitudeEntries(from, today)
  const streak = gratitudeStreakDays(gratitude.map((e) => e.occurredOn), today)

  const openDecisions = decisions.filter((d) => d.reviewedAt === null || decidedRatings[d.id] !== undefined)
  const widen = () => setMonthsBack((m) => m + 3)

  const onDecide = (decision: DecisionEntry, rating: number) => {
    setDecidedRatings((m) => ({ ...m, [decision.id]: rating }))
    // Fire-and-forget from the tile's point of view — the inline flow already committed to the
    // sage acknowledgement above; a failed request is reconciled by the next `useDecisions`
    // refetch, not by rolling this row back into the rating buttons.
    void reviewDecision(decision.id, rating).catch(() => {})
  }

  let lastMonth = ''

  return (
    <MozaikPage tone="sage" className="mzj-page">
      <PageHead onBack={() => navigate(-1)} label="‹ Én">
        <button
          type="button"
          className="pgact"
          onClick={() => setAddOpen(true)}
          style={{ background: 'var(--wash-sage)', color: 'var(--sage-deep)' }}
        >
          <Icon name="plus" size={12} /> Új bejegyzés
        </button>
      </PageHead>

      <PageHero
        icon="i-naplo"
        name="Napló"
        big={gratitudePending ? undefined : streak}
        sub={gratitudePending ? undefined : `napos hála-sorozat · ${gratitude.length} bejegyzés`}
      />

      <PageBody>
        <EntranceGroup className="col gap-md">
          <GratitudeStreakCard from={from} to={today} todayIso={today} />

          {decisionsError && openDecisions.length === 0 ? (
            // Same honesty rule as the notes list below (isError && ...length === 0): a failed
            // decisions fetch must not read as "no open decisions" — an overdue one would silently
            // vanish with no signal. Kept to a single skeleton line + retry — the decisions block is
            // a small section, not the page's main content.
            <GhostState message="Nem sikerült betölteni a döntéseket." ctaLabel="Újra" onCta={refetchDecisions} lines={1} />
          ) : openDecisions.length > 0 && (
            <div className="col gap-sm">
              <span className="mz-eyebrow">Döntések</span>
              {openDecisions.map((decision, i) => {
                const rating = decidedRatings[decision.id]
                if (rating !== undefined) {
                  return (
                    <div key={decision.id} className="mzh-decdone rise" style={{ '--d': `${i * 50}ms` } as React.CSSProperties}>
                      <ClaySpot name="s-orb-unnepel" size={26} />
                      <span>✓ Visszanézve · {rating}/5</span>
                      {/* The outcome-prose door (mezo-d20.11). The PUT behind it is re-runnable,
                          so this simply re-saves the same rating with the text attached. */}
                      <button
                        type="button"
                        className="mzj-decprose"
                        onClick={() => setOutcomeFor({ ...decision, outcomeRating: rating })}
                      >
                        Mi lett belőle?
                      </button>
                    </div>
                  )
                }
                const due = isDecisionDue(decision, today)
                return (
                  <div key={decision.id} className="mzh-deccard rise" style={{ '--d': `${i * 50}ms` } as React.CSSProperties}>
                    <div className="mzh-dechead">
                      <span className="mz-eyebrow mzh-eb-gold">Döntés · {dayLabel(decision.decidedOn, today)}</span>
                      <span className={`mzp-stch ${due ? 'prop' : 'mut'}`} style={{ marginLeft: 'auto' }}>
                        {due ? 'Nézd vissza' : `Visszanézés: ${dayLabel(decision.reviewDue, today)}`}
                      </span>
                    </div>
                    <p className="mzj-decq">{decision.decisionText}</p>
                    <div className="mzh-decrow" role="group" aria-label="Mennyire vált be? (1–5)">
                      {[1, 2, 3, 4, 5].map((r) => (
                        <button
                          key={r}
                          type="button"
                          className={r === 5 ? 'mzh-cta' : 'mzh-ghost'}
                          onClick={() => onDecide(decision, r)}
                        >
                          {r === 5 ? '5 · bevált' : r}
                        </button>
                      ))}
                    </div>
                    {/* The prototype prints the question under the row (.foot9) — it was only an
                        aria-label here, so a sighted user saw five bare digits with no prompt. */}
                    <p className="mzj-decfoot">Mennyire vált be? (1–5)</p>
                  </div>
                )
              })}
            </div>
          )}

          {isPending ? (
            <div className="col gap-sm" role="status" aria-label="Betöltés…">
              {Array.from({ length: 3 }, (_, i) => (
                <SkeletonCard key={i}>
                  <Skeleton width="30%" height={9} />
                  <Skeleton width="90%" height={11} style={{ marginTop: 8 }} />
                  <Skeleton width="70%" height={11} style={{ marginTop: 6 }} />
                </SkeletonCard>
              ))}
            </div>
          ) : isError && notes.length === 0 ? (
            // A genuinely failed fetch and an honest "not resolved yet" both read as an empty
            // `notes` array — without `isError` this rendered the same inviting "+ kezdd" empty
            // state a real empty window gets, hiding the failure (RoutineEditorPage.tsx idiom).
            // Stale-but-present notes (a refetch failing after a successful first load) fall
            // through to the normal list below instead.
            <GhostState message="Nem sikerült betölteni a naplót." ctaLabel="Újra" onCta={refetch} />
          ) : notes.length === 0 ? (
            // The empty window and "no entries at all" look identical here — the widen CTA covers
            // both: a user whose newest entry is older than the current window can reach it without
            // the ghost state stranding them (the header's + button still covers "write a new one").
            <GhostState
              message="Még nincs bejegyzés — kezdd a + gombbal."
              ctaLabel="Korábbi hónapok"
              onCta={widen}
            />
          ) : (
            <>
              {notes.map((note, i) => {
                const month = monthLabel(note.occurredOn)
                const showSeparator = month !== lastMonth
                lastMonth = month
                return (
                  <div key={note.id}>
                    {showSeparator && <span className="mz-eyebrow mem-month">{month}</span>}
                    <button
                      type="button"
                      className="mem-daycard rise"
                      onClick={() => setEditNote(note)}
                      style={{ display: 'block', width: '100%', textAlign: 'left', '--d': `${40 + i * 30}ms` } as React.CSSProperties}
                    >
                      <span className="mem-dl">{dayLabel(note.occurredOn, today)}</span>
                      <p className="mem-bd">{note.text}</p>
                    </button>
                  </div>
                )
              })}
              <button type="button" className="mzp-new" onClick={widen}>
                Korábbi hónapok
              </button>
            </>
          )}
        </EntranceGroup>
      </PageBody>

      {outcomeFor && (
        <DecisionReviewSheet decision={outcomeFor} today={today} onClose={() => setOutcomeFor(null)} />
      )}
      {addOpen && <JournalSheet onClose={() => setAddOpen(false)} />}
      {editNote && <JournalSheet entry={editNote} onClose={() => setEditNote(null)} />}
    </MozaikPage>
  )
}

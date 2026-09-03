// ============================================================
// Mezo · A hét tanulságai — /me/week/tanulsagok (mezo-d20.6.10)
// Source of truth: en-body.html #page-hless + lessPage(), ×1.18 (330→390px).
//
// The page the whole weekly loop points at: the review PROPOSES, the reader
// DECIDES, and only then does anything reach the Tudástár and the prompt. The
// write path is the shipped candidate-decision endpoint, reached through
// `useKnowledgeActions().decide` — this page invents nothing (handoff §6.2/9).
//
// F6.5 has not shipped, so real mode is honestly empty here (§4 "Fokozatos
// bevezetés"): `—` in the hero instead of a fabricated `0`, and the running /
// closed week each get their own sentence. Mock mode demos the full end state.
// ============================================================
import { useCallback, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ClayIcon } from '@/shared/ui/clay'
import { MozaikPage, PageBody, PageHead } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { deriveWeekTitle } from '@/data/fuel/fuelWeekHooks'
import { useKnowledgeActions, useWeekLessons } from '@/data/hooks'
import { isCurrentWeek } from '@/features/me/logic/weekNav'
import { resolveWeekStart, weekHubPath } from '@/features/me/logic/weekNav'
import { WeekLessonCard } from '@/features/me/components/week/WeekLessonCard'
import type { FactDecision } from '@/data/types'

/** The footnote. Sentence 1 is the prototype's, verbatim; sentence 2 is the
 *  two-button decision this slice made (handoff §6.2/8) said out loud. */
const FOOTNOTE = 'A Mezo nem ír a tudásba magától: a heti elemzés jelöltet állít, a döntés a tiéd. '
  + 'Itt két válasz van — ha pontosítanád a szöveget, azt a Tudástárban teheted meg.'

export function WeekLessonsPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const start = resolveWeekStart(params.get('start'))
  const running = isCurrentWeek(start)

  const { lessons, isPending, isError, refetch } = useWeekLessons(start)
  const { decide, pending } = useKnowledgeActions()

  // A decided candidate leaves the shared ['knowledge'] candidate list (that is what
  // `decide` does), but THIS page must keep showing the decision it just made — the
  // design's whole point is that a closed week shows what you accepted and rejected.
  // Local overlay, merged over the wire's own `decision` (KnowledgeListPage's
  // `acceptedEvents` precedent, mezo-0ap9).
  const [local, setLocal] = useState<Record<string, FactDecision>>({})
  const onDecide = useCallback((id: string, decision: FactDecision) => {
    setLocal((m) => ({ ...m, [id]: decision }))
    decide(id, decision)
  }, [decide])

  const rows = lessons.map((l) => (local[l.id] ? { ...l, decision: local[l.id] } : l))
  const open = rows.filter((l) => l.decision == null).length
  const accepted = rows.filter((l) => l.decision === 'accept' || l.decision === 'refine').length

  const head = (
    <PageHead label="‹ Heti" onBack={() => navigate(weekHubPath(start))}>
      <span className="mz-eyebrow wkl-wk">{deriveWeekTitle(start)}</span>
    </PageHead>
  )

  // Real-mode cold-load window: `[]` here would read as "nothing was proposed",
  // which is a different (and unearned) statement than "still loading" (§4).
  if (isPending) {
    return (
      <MozaikPage tone="gold">
        {head}
        <PageBody>
          <div className="sk wk-skel" style={{ height: 62 }} aria-label="A tanulságok betöltése…" />
          <div className="sk wk-skel" style={{ height: 118 }} />
          <div className="sk wk-skel" style={{ height: 118 }} />
        </PageBody>
      </MozaikPage>
    )
  }

  if (isError) {
    return (
      <MozaikPage tone="gold">
        {head}
        <PageBody>
          <div className="wkl-ghost">
            <div className="wkl-ghost-tx">Nem sikerült betölteni a hét tanulságait.</div>
            <button type="button" className="wkl-btn primary wkl-retry" onClick={refetch}>Újra</button>
          </div>
        </PageBody>
      </MozaikPage>
    )
  }

  const empty = rows.length === 0
  // A running week has not been analysed yet, so "nincs javaslat ehhez a héthez" would be a
  // verdict on a week that is still happening — and it contradicted the body copy right below
  // it, which correctly says the lessons arrive with Monday's analysis (mezo-d20.6.10 review).
  const sub = empty
    ? (running ? 'a hét közben még gyűlik' : 'nincs javaslat ehhez a héthez')
    : open > 0
      ? `${open} javaslat · te döntesz róluk`
      : `${accepted} megtanult · ${rows.length - accepted} elvetve`

  return (
    <MozaikPage tone="gold">
      {head}
      {/* Hero hand-rolled from the shared .mz-page-hero classes (the NapKuldetesekPage
          precedent) so the clay icon keeps the prototype's 50px ×1.18 = 59px. */}
      <div className="mz-page-hero">
        <div className="mz-hero-nm">A hét tanulságai</div>
        <div className="mz-hero-row">
          <ClayIcon name="i-kristaly" size={59} />
          {/* Never a fabricated 0 (§4): nothing measured reads `—`. */}
          <span className="mz-bignum">{empty ? '—' : rows.length}</span>
        </div>
        <div className="mz-hero-sb">{sub}</div>
      </div>
      <PageBody>
        <EntranceGroup replayKey={start}>
          {empty ? (
            <div className="wkl-ghost rise" style={{ '--d': '0ms' } as React.CSSProperties}>
              <div className="wkl-ghost-tx">
                {running
                  ? 'A hét közben még gyűlik — a tanulságok a hétfői elemzéssel érkeznek.'
                  : 'Nincs javaslat ehhez a héthez. Ha elkészül az elemzés, a Mezo ide teszi, amit megtanult.'}
              </div>
            </div>
          ) : (
            <>
              <div className="wkl-head rise" style={{ '--d': '0ms' } as React.CSSProperties}>
                Ezeket a hét <b>napokon átnyúló</b> összefüggéseiből szedte össze. Amit elfogadsz,
                bekerül a <b>Tudástárba</b> és a promptba — amit elvetsz, nem kérdezi újra.
              </div>
              {rows.map((l, i) => (
                <WeekLessonCard
                  key={l.id}
                  lesson={l}
                  delayMs={40 + i * 40}
                  busy={pending}
                  onAccept={() => onDecide(l.id, 'accept')}
                  onReject={() => onDecide(l.id, 'reject')}
                />
              ))}
              <div className="wkl-foot rise" style={{ '--d': `${60 + rows.length * 40}ms` } as React.CSSProperties}>
                {FOOTNOTE}
              </div>
            </>
          )}
        </EntranceGroup>
      </PageBody>
    </MozaikPage>
  )
}

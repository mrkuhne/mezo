// ============================================================
// Mezo · NapMezoPage — "Mezo üzenetei" as its own full page (mezo-d20.2.2)
// Source of truth: docs/design_2.0/prototypes/src/nap-body.html #page-mezo
// (p-coral tone, breathing-orb hero, the day's companion messages as a
// thread, chat CTA). Absorbs the hub's MezoMessagesSheet surface: the
// thread logic is the sheet's verbatim — buildMezoMessages over
// useCompanionFeed with the labelled demo-briefing fallback, feedback
// chips only on persisted feed rows (mezo-kr9v). The sheet component
// stays in-tree for its remaining callers; only the hub tile now
// navigates here instead of opening it.
// ============================================================
import { useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClaySpot, type ClaySpotName } from '@/shared/ui/clay'
import { MozaikPage, PageHead, PageBody } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { RefTag } from '@/shared/ui/RefTag'
import { SafeMarkdown } from '@/shared/lib/safeMarkdown'
import { localDateString } from '@/shared/lib/dates'
import { FeedbackChips } from '@/features/insights/components/FeedbackChips'
import { useCompanionFeed, useFeedback, useTodayScenario, resolveBriefing, useSleepGoal } from '@/data/hooks'
import { buildMezoMessages, type MezoMessageItem } from '@/features/today/logic/mezoMessages'
import { deriveNudges, toNudgeMessage } from '@/features/today/logic/needsNudges'
import { markNudgeShown, shownNudges } from '@/features/today/logic/nudgeSeen'
import { markMessagesSeen } from '@/shared/lib/seenMessages'
import { useMinuteTick } from '@/features/today/logic/useMinuteTick'
import { useNeeds } from '@/features/today/logic/useNeeds'

/** Prototype: each message head carries a daypart clay spot (s-reggel / s-este /
 *  s-energia). Our messages carry a KIND, not a spot — this is the visual mapping. */
function messageSpot(m: MezoMessageItem): ClaySpotName {
  if (m.kind === 'sleep' || m.kind === 'evening') return 's-este'
  if (m.kind === 'morning' || m.id === 'briefing-demo') return 's-reggel'
  return 's-energia'
}

export function NapMezoPage() {
  const navigate = useNavigate()
  const scenario = useTodayScenario()

  // The sheet's wiring, verbatim from the hub (mezo-e26w / mezo-b3pp.15).
  const feed = useCompanionFeed()
  const feedIds = useMemo(() => feed.map((m) => m.id), [feed])
  const feedback = useFeedback('feed_message', feedIds)
  // Életjel küszöb-nudge-ok (mezo-dhzk Task 5) — a `needsNudges.ts` termelője a Design 2.0
  // takarításban gazdátlanul maradt (`mezoMessages`'s `nudges` paraméterének nem volt hívója,
  // mezo-d20.11 audit): a szál gazdája ez az oldal, tehát a kézbesítés is ide tartozik. A
  // FRISS nudge-okat egyszer elmentjük, hogy egy ring naponta legfeljebb egyszer szóljon.
  const date = localDateString()
  const tick = useMinuteTick()
  const needs = useNeeds(tick)
  const { goal: sleepGoal } = useSleepGoal()
  const nudgeEntries = useMemo(
    () => (needs.isPending
      ? []
      : deriveNudges(needs.states, tick, sleepGoal.wakeTime, sleepGoal.bedTime, shownNudges(date))),
    [needs.isPending, needs.states, tick, sleepGoal.wakeTime, sleepGoal.bedTime, date],
  )
  useEffect(() => {
    for (const n of nudgeEntries) if (n.fresh) markNudgeShown(date, n.key, n.at)
  }, [nudgeEntries, date])

  const messages = useMemo(
    () => buildMezoMessages({
      feed,
      demoBriefing: resolveBriefing(scenario.dayState),
      nudges: nudgeEntries.map(toNudgeMessage),
    }),
    [feed, scenario.dayState, nudgeEntries],
  )

  // Prototype: „a Mezo-csempe olvasatlan-jelzése megnyitáskor törlődik" — the thread's last
  // id is the read watermark the hub tile's unread counter reads back (shared/lib/seenMessages).
  const lastId = messages.length > 0 ? messages[messages.length - 1].id : null
  useEffect(() => { if (lastId) markMessagesSeen(date, lastId) }, [date, lastId])

  return (
    <MozaikPage tone="coral">
      <PageHead onBack={() => navigate(-1)} label="‹ Ma" />
      {/* Prototype hero order is orb → name → sub (no bignum), so the orb hero is
          composed from the mz-page-hero classes rather than PageHero's nm/row/sb recipe. */}
      <div className="mz-page-hero orb">
        <ClaySpot name="s-orb" size={83} />
        <div className="mz-hero-nm">Mezo · ma</div>
        <div className="mz-hero-sb">{messages.length} üzenet · a napod fonala</div>
      </div>
      <PageBody>
        <EntranceGroup>
          {messages.map((m, i) => (
            <div key={m.id} className="nap-mzmsg rise" style={{ '--d': `${40 + i * 60}ms` } as React.CSSProperties}>
              <div className="nap-mzmsg-h">
                <ClaySpot name={messageSpot(m)} size={35} />
                <div className="t">{m.time ? `${m.time} · ${m.eyebrow}` : m.eyebrow}</div>
              </div>
              {m.paragraphs.map((p, j) => (
                <p key={j} className="txt"><SafeMarkdown text={p} /></p>
              ))}
              {m.refs.length > 0 && (
                <div className="nap-mzmsg-refs">
                  {m.refs.map((r, j) => <RefTag key={j} kind={r.kind} label={r.label} />)}
                </div>
              )}
              {m.meta && <div className="nap-mzmsg-meta">{m.meta}</div>}
              {/* Chips CSAK perzisztált AI-artifactre (mezo-kr9v); a „Segített?" felirat a
                  W5.2 intervention-változat (mezo-b3pp.19) — a sheet szerződése változatlanul. */}
              {m.artifactId != null && (
                <div className="mt-sm">
                  {m.kind === 'intervention' && <div className="nap-mzmsg-meta">Segített?</div>}
                  <FeedbackChips
                    key={m.artifactId}
                    value={feedback.get(m.artifactId)}
                    onVote={(verdict, reason) => feedback.vote(m.artifactId!, verdict, reason)}
                    label={m.kind === 'intervention' ? 'a közbelépésről' : 'az üzenetről'}
                  />
                </div>
              )}
            </div>
          ))}
          <button type="button" className="nap-mz-cta rise" style={{ '--d': `${40 + messages.length * 60}ms` } as React.CSSProperties}
            onClick={() => navigate('/mezo/chat')}>
            Beszélgess Mezóval ›
          </button>
        </EntranceGroup>
      </PageBody>
    </MozaikPage>
  )
}

// ============================================================
// Mezo · FuelMezoPage — "Mezo · Fuel" as its own full page (Design 2.0 F3.1, mezo-d20.4.1)
// Source of truth: docs/design_2.0/prototypes/src/fuel-body.html #page-mezofuel
// (p-coral tone, orb hero, the day's fuel-context companion messages as a thread with
// time + context eyebrows) + iterations §2: "the hub shows only the counter, never
// repeats the voice".
//
// The thread is the Nap tab's own (NapMezoPage / MezoMessagesSheet) wiring, verbatim —
// buildMezoMessages over useCompanionFeed — narrowed by `fuelMezoMessages` to the
// messages actually anchored to a fuel reference. Honest consequence: a day with no
// fuel-context message shows an empty thread and says so, rather than padding itself
// with the general briefing.
// ============================================================
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClaySpot } from '@/shared/ui/clay'
import { MozaikPage, PageHead, PageBody } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { RefTag } from '@/shared/ui/RefTag'
import { SafeMarkdown } from '@/shared/lib/safeMarkdown'
import { FeedbackChips } from '@/features/insights/components/FeedbackChips'
import { useCompanionFeed, useFeedback, useTodayScenario, resolveBriefing } from '@/data/hooks'
import { buildMezoMessages } from '@/features/today/logic/mezoMessages'
import { fuelMezoMessages } from '@/features/fuel/logic/fuelMezoMessages'

export function FuelMezoPage() {
  const navigate = useNavigate()
  const scenario = useTodayScenario()

  const feed = useCompanionFeed()
  const feedIds = useMemo(() => feed.map((m) => m.id), [feed])
  const feedback = useFeedback('feed_message', feedIds)
  const messages = useMemo(
    () => fuelMezoMessages(buildMezoMessages({ feed, demoBriefing: resolveBriefing(scenario.dayState) })),
    [feed, scenario.dayState],
  )

  return (
    <MozaikPage tone="coral">
      <PageHead onBack={() => navigate(-1)} label="‹ Fuel" />
      <div className="mz-page-hero orb">
        <ClaySpot name="s-orb" size={83} />
        <div className="mz-hero-nm">Mezo · Fuel</div>
        <div className="mz-hero-sb">
          {messages.length > 0
            ? `${messages.length} üzenet · a mai evésed fonala`
            : 'ma még nincs Fuel-üzenet'}
        </div>
      </div>
      <PageBody principle="Ide a Fuel-kontextusú Mezo-üzenetek gyűlnek — a hub csak a számlálót mutatja, a hangot nem ismétli.">
        <EntranceGroup>
          {messages.map((m, i) => (
            <div key={m.id} className="fh-mzmsg rise" style={{ '--d': `${40 + i * 60}ms` } as React.CSSProperties}>
              <div className="mz-eyebrow fh-mzmsg-eb">{m.time ? `${m.time} · ${m.eyebrow}` : m.eyebrow}</div>
              {m.paragraphs.map((p, j) => (
                <p key={j} className="fh-mzmsg-tx"><SafeMarkdown text={p} /></p>
              ))}
              {m.refs.length > 0 && (
                <div className="fh-mzmsg-refs">
                  {m.refs.map((r, j) => <RefTag key={j} kind={r.kind} label={r.label} />)}
                </div>
              )}
              {m.meta && <div className="fh-mzmsg-meta">{m.meta}</div>}
              {/* Chips only on a persisted AI artifact (mezo-kr9v) — nothing to vote on
                  for a demo/nudge card. */}
              {m.artifactId != null && (
                <div className="mt-sm">
                  <FeedbackChips
                    key={m.artifactId}
                    value={feedback.get(m.artifactId)}
                    onVote={(verdict, reason) => feedback.vote(m.artifactId!, verdict, reason)}
                    label="az üzenetről"
                  />
                </div>
              )}
            </div>
          ))}
        </EntranceGroup>
      </PageBody>
    </MozaikPage>
  )
}

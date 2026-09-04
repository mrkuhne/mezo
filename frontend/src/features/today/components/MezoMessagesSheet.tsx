// ============================================================
// Mezo · MezoMessagesSheet — a nap MINDEN generált mezo-üzenete egy szálban
// (mezo-e26w). Ez az az EGY hely, ahova minden jövőbeli üzenet befut; a szálat
// a `logic/mezoMessages.ts` állítja össze a lapon MÁR meglévő hookokból, tehát
// itt nincs se hook, se adatforrás — a komponens prezentációs.
// Sehol nincs csonkolás: a `bővebben` kapcsoló a sávval együtt nyugdíjba ment,
// mert itt nincs mit elrejteni. A szál görgethető (`.td-thread`).
// ============================================================
import { Sheet } from '@/shared/ui/Sheet'
import { RefTag } from '@/shared/ui/RefTag'
import { SafeMarkdown } from '@/shared/lib/safeMarkdown'
import { FeedbackChips } from '@/features/insights/components/FeedbackChips'
import type { MezoMessageItem } from '@/features/today/logic/mezoMessages'
import type { FeedbackHandle } from '@/data/feedback/feedbackTypes'

export function MezoMessagesSheet({ messages, onClose, feedback }: {
  messages: MezoMessageItem[]
  onClose: () => void
  /** A lap `useFeedback('feed_message', …)` handle-je (mezo-b3pp.15) — a komponens
   *  prezentációs marad, a hookot a TodayPage birtokolja. Elhagyva nincs chip sehol. */
  feedback?: FeedbackHandle
}) {
  return (
    <Sheet onClose={onClose} labelledBy="mezo-msgs-title">
      {(close) => (
        <>
          <div className="td-sheet-h">
            <h2 id="mezo-msgs-title">Mezo üzenetei</h2>
            <button type="button" onClick={close}>Kész</button>
          </div>
          <div className="td-thread">
            <div className="td-daysep">Ma</div>
            {messages.map((m) => (
              <div key={m.id} className="td-msg">
                <div className="td-av" aria-hidden="true">✦</div>
                <div className="td-bub">
                  <div className="td-bub-h">
                    <span className="td-bub-n">{m.eyebrow}</span>
                    {m.time && <span className="td-bub-t">{m.time}</span>}
                  </div>
                  {m.paragraphs.map((p, i) => (
                    <p key={i} className="td-bub-x"><SafeMarkdown text={p} /></p>
                  ))}
                  {m.refs.length > 0 && (
                    <div className="td-bub-refs">
                      {m.refs.map((r, i) => <RefTag key={i} kind={r.kind} label={r.label} />)}
                    </div>
                  )}
                  {m.meta && <div className="td-bub-meta">{m.meta}</div>}
                  {/* Chip CSAK perzisztált AI-artifactre: a cimkézett demo-briefing kártyának és
                      a küszöb-nudge-nak nincs sor-azonosítója, egy rájuk ültetett chip hamis
                      affordancia lenne (mezo-kr9v). Kulcs az artifactId: a FeedbackChips egyszer,
                      mountkor magolja be az indok-sor nyitottságát, ezért minden üzenetnek SAJÁT
                      példány jár — React sosem használhatja újra az egyikét a másikra. */}
                  {/* A „Segített?" felirat a W5.2 hurok — ugyanaz a feed_message verdict, a
                      backend a kártya interventionKey-e alapján görgeti fel kulcsonként
                      (mezo-b3pp.19). */}
                  {feedback && m.artifactId != null && (
                    <div className="mt-sm">
                      {(m.kind === 'intervention' || m.kind === 'advice') && <div className="td-bub-meta">Segített?</div>}
                      <FeedbackChips
                        key={m.artifactId}
                        value={feedback.get(m.artifactId)}
                        onVote={(verdict, reason) => feedback.vote(m.artifactId!, verdict, reason)}
                        label={m.kind === 'intervention' || m.kind === 'advice' ? 'a közbelépésről' : 'az üzenetről'}
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </Sheet>
  )
}

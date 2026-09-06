// ============================================================
// Mezo · A napi kártya — a győztes, és amit legyőzött (mezo-6269.3,
// spec 2026-09-05 §6.4). A kártya anatómiája a NapMezoPage-en bevált
// recept (tények + javaslatok + akciók), a „Miért ez nyert" sáv pedig az
// egyetlen hely az appban, ahol a legyőzött jelöltek is látszanak.
// Az akciók a MEGLÉVŐ úton futnak (useAdviceActions + ACTION_INVALIDATES),
// szerver-vezérelt applied állapottal — soha nem tiltott gomb hamisítja.
// ============================================================
import { useNavigate } from 'react-router-dom'
import { Icon } from '@/shared/ui/Icon'
import { ClayIcon } from '@/shared/ui/clay'
import { MozaikPage, PageBody, PageHead, PageHero } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { SafeMarkdown } from '@/shared/lib/safeMarkdown'
import { useAdviceActions, useCoachingCard, useCoachingTrace } from '@/data/hooks'
import { losersOf, visualOf, winnerRuleOf } from '@/features/insights/logic/coachingCopy'
import { localDateString } from '@/shared/lib/dates'

export function CoachingCardPage() {
  const navigate = useNavigate()
  const date = localDateString()
  const { card, isPending, isError } = useCoachingCard(date)
  const { day } = useCoachingTrace(date)
  const advice = useAdviceActions()
  const winner = winnerRuleOf(day)
  const losers = losersOf(day)

  return (
    <MozaikPage tone="gold">
      <PageHead onBack={() => navigate('/mezo/coaching')} label="‹ Coaching" />
      <PageHero name="A napi kártya" sub={winner?.label} />
      <PageBody principle="Egy kártya naponta — itt az is látszik, mi ellen nyert.">
        <EntranceGroup className="col gap-md">
          {isPending && <div className="card" style={{ padding: 18 }} aria-busy="true" />}
          {isError && (
            <div className="card" style={{ padding: 18, textAlign: 'center' }}>
              <p style={{ fontSize: 13, color: 'var(--mz-ink-soft)' }}>
                A mai kártyát most nem tudom betölteni — próbáld újra kicsit később.
              </p>
            </div>
          )}
          {!isPending && !isError && card == null && (
            <div className="card" style={{ padding: 18, textAlign: 'center' }}>
              <p style={{ fontSize: 13, color: 'var(--mz-ink-soft)', lineHeight: 1.5 }}>
                Ma nem érkezett kártya.
              </p>
            </div>
          )}

          {card != null && (
            <div className="mzp-pred propcard rise" style={{ '--d': '0ms' } as React.CSSProperties}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ClayIcon name={visualOf(winner?.domain ?? 'general').icon} size={26} />
                <span style={{ fontSize: 13, fontWeight: 700 }}>{card.eyebrow}</span>
              </div>
              {card.body.map((p, i) => (
                <p key={i} style={{ fontSize: 12, fontWeight: 300, lineHeight: 1.6, marginTop: 7 }}>
                  <SafeMarkdown text={p.text} />
                </p>
              ))}
              {card.facts != null && card.facts.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  {card.facts.map((f, i) => (
                    <div key={i} className="mzp-evrow"><span className="vl">{f}</span></div>
                  ))}
                </div>
              )}
              {card.suggestions != null && card.suggestions.length > 0 && (
                <ul style={{ marginTop: 8, paddingLeft: 16, fontSize: 11.5, fontWeight: 300, lineHeight: 1.55 }}>
                  {card.suggestions.map((s, i) => <li key={i}><SafeMarkdown text={s} /></li>)}
                </ul>
              )}
              {/* Server-driven applied state — the NapMezoPage contract, reused verbatim. */}
              {card.actions != null && card.actions.length > 0 && (
                card.applied != null ? (
                  <div className="nap-mzmsg-applied">
                    <Icon name="check" size={12} />
                    {card.actions.find((a) => a.key === card.applied!.actionKey)?.label ?? card.applied.actionKey}
                  </div>
                ) : (
                  <div className="mzp-decrow" role="group" aria-label="Javasolt lépés">
                    {card.actions.map((a) => (
                      <button key={a.key} type="button" className="mzp-cta" disabled={advice.pending}
                        onClick={() => advice.apply(card.id, a.key)}>
                        {a.label}
                      </button>
                    ))}
                    {advice.failedId === card.id && (
                      <span className="nap-mzmsg-actionerr" role="alert">Nem sikerült — próbáld újra.</span>
                    )}
                  </div>
                )
              )}
            </div>
          )}

          {/* card and day come from two independent queries about (allegedly) one decision;
              if their ids disagree they describe different decisions, so the strip stays quiet. */}
          {losers.length > 0 && day.winner?.cardId === card?.id && (
            <div className="mzp-pred lav rise" style={{ '--d': '70ms' } as React.CSSProperties}>
              <span className="mz-eyebrow" style={{ color: 'var(--mz-ink-soft)' }}>Miért ez nyert</span>
              <div style={{ marginTop: 6 }}>
                {losers.map((r) => (
                  <div key={r.flagKey} className="mzo-loser">
                    <span className="nm">{r.label}</span>
                    <span>alacsonyabb súlyosság</span>
                    <span className="rk">{`rang ${r.rank}`}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </EntranceGroup>
      </PageBody>
    </MozaikPage>
  )
}

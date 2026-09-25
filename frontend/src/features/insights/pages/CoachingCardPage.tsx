// ============================================================
// Mezo · A napi kártya — a győztes, és amit legyőzött (mezo-6269.3,
// spec 2026-09-05 §6.4). A kártya anatómiája a NapMezoPage-en bevált
// recept (tények + javaslatok + akciók), a „Miért ez nyert" sáv pedig az
// egyetlen hely az appban, ahol a legyőzött jelöltek is látszanak.
// Az akciók a MEGLÉVŐ úton futnak (useAdviceActions + ACTION_INVALIDATES),
// szerver-vezérelt applied állapottal — soha nem tiltott gomb hamisítja.
// Üveg (mezo-me75u.8): halo hős, a kártya az EGYETLEN üveg (borostyán), a
// „Miért ez nyert" lapos sorok.
// ============================================================
import type { CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon3D } from '@/shared/ui/clay'
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
  // card and day come from two independent queries about (allegedly) one decision; if their ids
  // disagree — or there is no card at all — they describe different decisions (or nothing), so
  // every trace-winner-derived bit of copy (hero subtitle, card icon, losers strip) stays quiet
  // rather than naming a rule the visible card does not actually confirm.
  const coherent = card != null && day.winner?.cardId === card.id

  return (
    <MozaikPage tone="gold" className="coach-page coach-card">
      <PageHead glass onBack={() => navigate('/mezo/coaching')} label="Coaching" />
      <PageHero art="t-card" accent="var(--dv-amber)" eyebrow="Coaching" name="A napi kártya"
        sub={coherent ? winner?.label : undefined} />
      <PageBody principle="Egy kártya naponta — itt az is látszik, mi ellen nyert.">
        <EntranceGroup className="col gap-md">
          {isPending && <div className="coach-state uv-empty" aria-busy="true" />}
          {isError && (
            <div className="coach-state uv-empty">
              <p>A mai kártyát most nem tudom betölteni — próbáld újra kicsit később.</p>
            </div>
          )}
          {!isPending && !isError && card == null && (
            <div className="coach-state uv-empty">
              <p>Ma nem érkezett kártya.</p>
            </div>
          )}

          {card != null && (
            <div className="coach-dcard propcard glass rise" style={{ '--d': '0ms', '--i': 1 } as CSSProperties}>
              <div className="coach-dcard-top">
                <span className="uv-well coach-well">
                  <Icon3D name={visualOf(coherent ? winner?.domain ?? 'general' : 'general').icon} size={34} />
                </span>
                <span className="coach-dcard-eb">{card.eyebrow}</span>
              </div>
              {card.body.map((p, i) => (
                <p key={i} className="coach-dcard-body">
                  <SafeMarkdown text={p.text} />
                </p>
              ))}
              {card.facts != null && card.facts.length > 0 && (
                <div className="coach-dcard-facts">
                  {card.facts.map((f, i) => (
                    <div key={i} className="coach-fact"><span className="vl">{f}</span></div>
                  ))}
                </div>
              )}
              {card.suggestions != null && card.suggestions.length > 0 && (
                <ul className="coach-dcard-sugg">
                  {card.suggestions.map((s, i) => (
                    <li key={i}><Icon3D name="t-bulb" size={20} /><span><SafeMarkdown text={s} /></span></li>
                  ))}
                </ul>
              )}
              {/* Server-driven applied state — the NapMezoPage contract, reused verbatim. */}
              {card.actions != null && card.actions.length > 0 && (
                card.applied != null ? (
                  <div className="coach-applied">
                    <Icon3D name="t-tick" size={24} />
                    {card.actions.find((a) => a.key === card.applied!.actionKey)?.label ?? card.applied.actionKey}
                  </div>
                ) : (
                  <div className="coach-actions" role="group" aria-label="Javasolt lépés">
                    {card.actions.map((a) => (
                      <button key={a.key} type="button" className="coach-cta" disabled={advice.pending}
                        onClick={() => advice.apply(card.id, a.key)}>
                        {a.label}
                      </button>
                    ))}
                    {advice.failedId === card.id && (
                      <span className="coach-err" role="alert">Nem sikerült — próbáld újra.</span>
                    )}
                  </div>
                )
              )}
            </div>
          )}

          {losers.length > 0 && coherent && (
            <>
              <span className="coach-h3 uv-eyebrow">Miért ez nyert</span>
              <div className="coach-losers rise" style={{ '--d': '70ms' } as CSSProperties}>
                {losers.map((r) => (
                  <div key={r.flagKey} className="mzo-loser">
                    <Icon3D name={visualOf(r.domain).icon} size={26} />
                    <span className="coach-grow">
                      <span className="nm">{r.label}</span>
                      <span className="why">alacsonyabb súlyosság</span>
                    </span>
                    <span className="rk">{`rang ${r.rank}`}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </EntranceGroup>
      </PageBody>
    </MozaikPage>
  )
}

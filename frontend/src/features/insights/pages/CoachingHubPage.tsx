// ============================================================
// Mezo · Proaktív coaching — a hub (mezo-6269.3, spec 2026-09-05 §6.2).
// A döntés maga a felület: a nyertes posztere ranggal, a nap 14 verdiktjének
// megoszlása gyűrűként és cellákként, alatta a két ajtó (Megfigyelő · A napi
// kártya). Semmit nem számol újra — a szerver mondatait rendezi képpé.
// Őszinte állapotok: betöltés / hiba / még sosem futott kiértékelés.
// Üveg (mezo-me75u.8, prototypes/uveg-mezo.html#coaching): halo hős a
// szegmentált, izzó verdikt-gyűrűvel; a nyertes az EGYETLEN üveg (borostyán);
// a számok lapos cellák, az ajtók lapos sorok világító kúttal.
// ============================================================
import type { CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon3D } from '@/shared/ui/clay'
import { MozaikPage, PageBody, PageHead, PageHero, StatCell, StatStrip } from '@/shared/ui/mozaik'
import { EntranceGroup, useCountUp } from '@/shared/ui/mozaik/motion'
import { useCoachingTrace } from '@/data/hooks'
import { VerdictArc, STATE_GLOW } from '@/features/insights/components/VerdictArc'
import { CoachingChip } from '@/features/insights/components/CoachingRuleTile'
import { STATE_LABEL, splitOf, stateOf, visualOf, winnerRuleOf } from '@/features/insights/logic/coachingCopy'
import type { CoachingState } from '@/features/insights/logic/coachingCopy'
import { ALL_FEATURES_ROUTE } from '@/features/insights/logic/boopNavigation'

const LEGEND: Array<[CoachingState, string]> = [
  ['raised', 'jelzett'], ['suppressed', 'pihenőn'], ['clear', 'rendben'], ['unavailable', 'nem mérhető'],
]

export function CoachingHubPage() {
  const navigate = useNavigate()
  const { day, isPending, isError } = useCoachingTrace()
  const split = splitOf(day)
  const winner = winnerRuleOf(day)
  const flagged = useCountUp(split.raised + split.suppressed)
  const empty = !isPending && !isError && split.total === 0

  return (
    <MozaikPage tone="gold" className="coach-page coach-hub">
      <PageHead glass onBack={() => navigate(ALL_FEATURES_ROUTE)} label="Összes funkció" />
      {split.total === 0 ? (
        <PageHero art="t-whistle" accent="var(--dv-amber)" eyebrow="Mezo · ma" name="Proaktív coaching"
          sub="a motor döntése, ahogy megszületett" />
      ) : (
        <PageHero glass accent="var(--dv-amber)" eyebrow="Mezo · ma" name="Proaktív coaching">
          <div className="coach-gauge">
            <VerdictArc split={split} size={156} glow />
            <div className="coach-gauge-ctr">
              <Icon3D name="t-whistle" size={46} />
              <b>{flagged}</b>
              <small>jelzés</small>
            </div>
          </div>
          <div className="mz-hero-sb">{`${split.total} szabály · ma ennyi jelzett`}</div>
          <div className="coach-legend" aria-hidden="true">
            {LEGEND.filter(([key]) => split[key] > 0).map(([key, word]) => (
              <span key={key} style={{ '--c': STATE_GLOW[key] } as CSSProperties}>
                <i />{`${split[key]} ${word}`}
              </span>
            ))}
          </div>
        </PageHero>
      )}
      <PageBody principle="Ez a felület nem dönt — azt mutatja meg, mit döntött a motor, és mi alapján.">
        <EntranceGroup className="col gap-md">
          {isPending && <div className="coach-state uv-empty" aria-busy="true" />}
          {isError && (
            <div className="coach-state uv-empty">
              <p>Most nem tudom megmutatni a mai döntést — próbáld újra kicsit később.</p>
            </div>
          )}
          {empty && (
            <div className="coach-state uv-empty">
              <p>Még nem futott kiértékelés — az első után itt látod a döntést.</p>
            </div>
          )}

          {/* A nap kártyája — a nyertes a day.winner-ből, sosem a cardOutcome-ból (mezo-y43v):
              egy szabály megnyerheti a napot és estére „Rendben"-re válthat — ezért az
              állapotcsip a szabály MOSTANI állapotát mondja. */}
          {winner != null && day.winner != null && (
            <>
              <span className="coach-h3 uv-eyebrow">A nap nyertese</span>
              <div className="coach-win propcard glass rise" style={{ '--d': '0ms', '--i': 1 } as CSSProperties}>
                <div className="coach-win-top">
                  <span className="uv-well coach-well">
                    <Icon3D name={visualOf(winner.domain).icon} size={32} />
                  </span>
                  <div className="coach-grow">
                    <strong>{winner.label}</strong>
                    <div className="coach-chips">
                      <CoachingChip state="winner" />
                      <CoachingChip state={stateOf(winner)} />
                    </div>
                  </div>
                  <span className="coach-rank is-lg">{`${day.winner.rank}/${split.total}`}</span>
                </div>
                <p className="coach-win-why">{winner.reasonText}</p>
              </div>
            </>
          )}

          {split.total > 0 && (
            <StatStrip className="coach-split">
              <StatCell value={split.raised} label={STATE_LABEL.raised} />
              <StatCell value={split.suppressed} label={STATE_LABEL.suppressed} />
              <StatCell value={split.clear} label={STATE_LABEL.clear} />
              <StatCell value={split.unavailable} label={STATE_LABEL.unavailable} />
            </StatStrip>
          )}

          <div className="coach-doors">
            <button type="button" className="coach-door rise" style={{ '--d': '160ms', '--c': 'var(--dv-lav)' } as CSSProperties}
              aria-label="Megfigyelő" onClick={() => navigate('/mezo/coaching/megfigyelo')}>
              <span className="uv-well coach-well"><Icon3D name="t-eye" size={28} /></span>
              <span className="coach-grow">
                <strong>Megfigyelő</strong>
                {split.total > 0 && <small>{`mind a ${split.total} szabály, súlyossági sorrendben`}</small>}
              </span>
              <span className="coach-chev" aria-hidden="true">›</span>
            </button>
            <button type="button" className="coach-door rise" style={{ '--d': '200ms', '--c': 'var(--dv-amber)' } as CSSProperties}
              aria-label="A napi kártya" onClick={() => navigate('/mezo/coaching/kartya')}>
              <span className="uv-well coach-well"><Icon3D name="t-card" size={28} /></span>
              <span className="coach-grow">
                <strong>A napi kártya</strong>
                {/* The winner card above names the rule; the door line phrases it as a sentence
                    (which rule decided the day) rather than repeating the bare label. */}
                {winner != null && <small>{`${winner.label} nyerte a napot`}</small>}
              </span>
              <span className="coach-chev" aria-hidden="true">›</span>
            </button>
          </div>
        </EntranceGroup>
      </PageBody>
    </MozaikPage>
  )
}

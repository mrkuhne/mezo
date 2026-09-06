// ============================================================
// Mezo · Proaktív coaching — a hub (mezo-6269.3, spec 2026-09-05 §6.2).
// A döntés maga a felület: a nyertes posztere ranggal, a nap 14 verdiktjének
// megoszlása gyűrűként és cellákként, alatta a két ajtó (Megfigyelő · A napi
// kártya). Semmit nem számol újra — a szerver mondatait rendezi képpé.
// Őszinte állapotok: betöltés / hiba / még sosem futott kiértékelés.
// ============================================================
import type { CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mosaic, MozaikPage, PageBody, PageHead, PageHero, StatCell, StatStrip, Tile } from '@/shared/ui/mozaik'
import { EntranceGroup, useCountUp } from '@/shared/ui/mozaik/motion'
import { useCoachingTrace } from '@/data/hooks'
import { VerdictArc } from '@/features/insights/components/VerdictArc'
import { STATE_LABEL, WINNER_LABEL, splitOf, winnerRuleOf } from '@/features/insights/logic/coachingCopy'

export function CoachingHubPage() {
  const navigate = useNavigate()
  const { day, isPending, isError } = useCoachingTrace()
  const split = splitOf(day)
  const winner = winnerRuleOf(day)
  const flagged = useCountUp(split.raised + split.suppressed)
  const empty = !isPending && !isError && split.total === 0

  return (
    <MozaikPage tone="gold">
      <PageHead onBack={() => navigate('/mezo')} label="‹ Mezo" />
      <PageHero spot="s-orb-figyel" iconSize={54} name="Proaktív coaching"
        big={split.total === 0 ? undefined : flagged}
        sub={split.total === 0 ? 'a motor döntése, ahogy megszületett' : `${split.total} szabály · ma ennyi jelzett`}>
        <VerdictArc split={split} />
      </PageHero>
      <PageBody principle="Ez a felület nem dönt — azt mutatja meg, mit döntött a motor, és mi alapján.">
        <EntranceGroup className="col gap-md">
          {isPending && <div className="card" style={{ padding: 18 }} aria-busy="true" />}
          {isError && (
            <div className="card" style={{ padding: 18, textAlign: 'center' }}>
              <p style={{ fontSize: 13, color: 'var(--mz-ink-soft)' }}>
                Most nem tudom megmutatni a mai döntést — próbáld újra kicsit később.
              </p>
            </div>
          )}
          {empty && (
            <div className="card" style={{ padding: 18, textAlign: 'center' }}>
              <p style={{ fontSize: 13, color: 'var(--mz-ink-soft)', lineHeight: 1.5 }}>
                Még nem futott kiértékelés — az első után itt látod a döntést.
              </p>
            </div>
          )}

          {/* A nap kártyája — a nyertes a day.winner-ből, sosem a cardOutcome-ból (mezo-y43v):
              egy szabály megnyerheti a napot és estére „Rendben"-re válthat. */}
          {winner != null && day.winner != null && (
            <div className="mzp-pred propcard rise" style={{ '--d': '0ms' } as CSSProperties}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="mzp-rankb">{`${day.winner.rank}/${split.total}`}</span>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{winner.label}</span>
                <span className="mzp-stch prop" style={{ marginLeft: 'auto' }}>Nyertes</span>
              </div>
              <p style={{ fontSize: 11, fontWeight: 300, lineHeight: 1.55, marginTop: 7 }}>
                {winner.reasonText}
              </p>
            </div>
          )}

          {split.total > 0 && (
            <StatStrip>
              <StatCell value={split.raised} label={STATE_LABEL.raised} />
              <StatCell value={split.suppressed} label={STATE_LABEL.suppressed} />
              <StatCell value={split.clear} label={STATE_LABEL.clear} />
              <StatCell value={split.unavailable} label={STATE_LABEL.unavailable} />
            </StatStrip>
          )}

          <Mosaic>
            <Tile wash="lav" icon="i-eletjel" eyebrow="Megfigyelő" delayMs={160} wide
              aria-label="Megfigyelő"
              line={split.total === 0 ? undefined : `mind a ${split.total} szabály, súlyossági sorrendben`}
              onClick={() => navigate('/mezo/coaching/megfigyelo')} />
            <Tile wash="gold" icon="i-level" eyebrow="A napi kártya" delayMs={200} wide
              aria-label="A napi kártya"
              // The propcard above already spells out the winner's name in full — repeating
              // that exact string here would just be noise (and an ambiguous a11y match), so
              // the tile previews the OUTCOME instead of restating the label.
              line={winner != null ? WINNER_LABEL : undefined}
              onClick={() => navigate('/mezo/coaching/kartya')} />
          </Mosaic>
        </EntranceGroup>
      </PageBody>
    </MozaikPage>
  )
}

// ============================================================
// Mezo · RutinHubPage (mezo-3zue.3, hub 2.0 mezo-mgpr) — /me/rutin, prototype
// rutin-formalodas.html `pg-hub` ×1.18. ONE screen, no scrolling: hero + statstrip, a single
// „Következik" row, the active-chain tile, and two mosaic tiles (Szokásaid → its own page,
// Építs → the one creation flow). The chain cards with their inline editor chrome moved out:
// per-chain editing lives on the chain page (mezo-vxd8), the habit list on /me/rutin/szokasok.
//
// The daily logging home stays /nap/rutin (ADR + Daniel's S2 answer): the „Következik" row
// and the chain tile NAVIGATE, they never tick — the hub must not become a second logging
// surface. The PAST-day branch (mezo-x9c2's arbitrary-past-day browsing) survives unchanged
// under the DayNavigator; hub 2.0 redesigned only the today branch.
// ============================================================
import type { CSSProperties } from 'react'
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useHabitCatalog, useHabitDay, useHabitFormations, useHabitSummary } from '@/data/hooks'
import type { HabitChainInfo, HabitDaypart, HabitItem } from '@/data/types'
import { AiSuggestSheet } from '@/features/me/sheets/AiSuggestSheet'
import { ChainEditSheet } from '@/features/me/sheets/ChainEditSheet'
import { localDateString } from '@/shared/lib/dates'
import { Icon3D, type Icon3DName } from '@/shared/ui/clay'
import { DayNavigator } from '@/shared/ui/DayNavigator'
import { GhostState } from '@/shared/ui/GhostState'
import { Mosaic, MozaikPage, PageBody, PageHead, PageHero, StatCell, StatStrip, Tile } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { cn } from '@/shared/lib/cn'

// Üveg (mezo-me75u.7): the daypart wears the Titanium set. Mapped HERE, not through CLAY_TO_3D —
// there `i-alvas` is sleep (t-sleep), but on a rutin chain it means „este" (t-moon).
const DAYPART_ART: Record<HabitDaypart, Icon3DName> = { MORNING: 't-dawn', DAY: 't-sun', EVENING: 't-moon' }
const DAYPART_FACE: Record<HabitDaypart, string> = { MORNING: 'reggel', DAY: 'napkozben', EVENING: 'este' }
const STATUS_SR: Record<HabitItem['status'], string> = { done: 'kész', missed: 'kimaradt', pending: 'nyitott' }

const PRINCIPLE = 'A napi pipálás otthona a Nap oldal — itt csak a soron következő egy sor '
  + 'van kint, hogy a hub ne váljon második logoló felületté.'

export function RutinHubPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  // The wizard's ?new= hand-back highlights nothing here any more (the rows left for
  // /me/rutin/szokasok), but arriving with it is still a valid address — ignore it quietly.
  void params
  const today = localDateString()
  const [date, setDate] = useState(today)
  const isToday = date === today
  const { habits } = useHabitDay(date)
  const { data: summary } = useHabitSummary()
  const { catalog, isPending, isError, refetch } = useHabitCatalog()
  const [chainSheet, setChainSheet] = useState(false)
  const [suggestSheet, setSuggestSheet] = useState(false)

  const chains = [...catalog.chains].sort((a, b) => a.position - b.position)
  const pastChains = chains.filter((c) => c.isActive)
  const doneOf = (l: HabitItem[]) => l.filter((h) => h.status === 'done').length
  const morning = habits.filter((h) => h.chain === 'MORNING'), evening = habits.filter((h) => h.chain === 'EVENING')
  const earnedXp = habits.filter((h) => h.status === 'done').reduce((s, h) => s + h.xp, 0)
  const missed = pastChains.filter((c) => { const items = habits.filter((h) => h.chain === c.chainKey); return items.length > 0 && doneOf(items) === 0 })

  const doneToday = doneOf(habits)
  const totalToday = habits.length
  // A paused CHAIN does not run, so its still-active defs are not active habits either — the
  // cell's label ("aktív szokás") would otherwise overstate the number (mezo-4kbl).
  const activeChains = chains.filter((c) => c.isActive)
  const activeDefs = activeChains.flatMap((c) => c.defs).filter((d) => d.isActive)

  // Settled ("beérett") count for the hero sub + the Szokásaid tile line: past the threshold
  // on the formation curve. Page-triggered aggregate (mezo-08zl's rule) — the hub is a page,
  // not the chat hot path; the per-key cache is shared with the habit pages.
  const formations = useHabitFormations(activeDefs.map((d) => d.habitKey))
  const settled = activeDefs.filter((d) => {
    const f = formations.get(d.habitKey)
    return f != null && f.thresholdPct > 0 && f.automaticityPct != null && f.automaticityPct >= f.thresholdPct
  }).length

  // The next pending habit in the day view's own order (chain position order) — the ONE row
  // the hub surfaces. Both it and the chain tile navigate to the logging home.
  const next = habits.find((h) => h.status === 'pending')
  const chainOfKey = (chainKey: string) => chains.find((c) => c.chainKey === chainKey)
  const activeChain: HabitChainInfo | undefined = next != null
    ? chainOfKey(next.chain)
    : [...pastChains].reverse().find((c) => habits.some((h) => h.chain === c.chainKey))
  const chainItems = activeChain != null ? habits.filter((h) => h.chain === activeChain.chainKey) : []
  const toNap = (daypart: HabitDaypart | undefined) =>
    navigate(`/nap/rutin${daypart != null ? `?dp=${DAYPART_FACE[daypart]}` : ''}`)

  // Past-day row: status-only, exactly as GrowthRutinPage rendered it.
  const pastRow = (h: HabitItem) => (
    <div key={h.key} className={cn('gr-chainrow', h.status === 'done' && 'done', h.status !== 'done' && 'skip')}>
      {h.status === 'done'
        ? <Icon3D name="t-tick" size={24} className="gr-ck" />
        : <span className="gr-ck rt-dotgone" aria-hidden="true"><i /></span>}
      <span className="sr-only">{STATUS_SR[h.status]}</span>
      <span className="tx">{h.title}</span>
    </div>
  )

  // Past-day card — the day view's rows, unchanged (history, not the live catalog).
  const pastCard = (chain: HabitChainInfo, delayMs: number) => {
    const items = habits.filter((h) => h.chain === chain.chainKey)
    if (items.length === 0) return null
    return (
      <div key={chain.id} className="gr-chain glass rise" style={{ '--d': `${delayMs}ms` } as CSSProperties}>
        <div className="gr-band-top">
          <Icon3D name={DAYPART_ART[chain.daypart]} size={30} />
          <span className="mz-eyebrow">{chain.title}</span>
          <span className="gr-band-chip">
            {doneOf(items)} / {items.length}
          </span>
        </div>
        {items.map((h) => pastRow(h))}
      </div>
    )
  }

  return (
    <MozaikPage tone="gold" className="rt-uv rt-hub">
      <PageHead glass onBack={() => navigate('/me')} label="Én">
        <button type="button" className="mz-pgact rt-act is-lav" onClick={() => setSuggestSheet(true)}>
          <Icon3D name="t-spark" size={18} />AI javaslat
        </button>
      </PageHead>
      {/* Honesty rule (the Én tile's): while the day view is unresolved `doneToday/totalToday`
          reads a confident "0 / 0" that is not a real standing — show no number at all then. */}
      <PageHero
        art="t-dawn" accent="var(--dv-amber)" big={totalToday > 0 ? `${doneToday} / ${totalToday}` : undefined} name="Rutin"
        sub={isToday && settled > 0 ? `ma · ${settled} szokás már magától megy` : isToday ? 'ma' : undefined}
      />
      <PageBody principle={PRINCIPLE}>
        <EntranceGroup replayKey={date}>
          {/* A 30 napos aggregátum a kiválasztott naptól független, ezért a múltnapi ágon is
              itt marad — a lap identitása nem ugrik napváltáskor. */}
          <StatStrip className="rt-strip rise">
            <StatCell value={summary.perfectMorningDays30} label="tökéletes reggel · 30 n" />
            <StatCell value={summary.perfectEveningDays30} label="tökéletes este · 30 n" />
            <StatCell value={activeDefs.length} label="aktív szokás" />
          </StatStrip>
          <div className="gr-daynav rise" style={{ '--d': '60ms' } as CSSProperties}>
            <DayNavigator date={date} maxDate={today} onChange={setDate} />
          </div>
          {isToday ? (
            isPending && chains.length === 0 ? (
              <GhostState message="Rutinok betöltése…" />
            ) : isError && chains.length === 0 ? (
              <GhostState message="Nem sikerült betölteni a rutinokat." ctaLabel="Újra" onCta={refetch} />
            ) : (
              <>
                {/* KÖVETKEZIK — the one surfaced row. It NAVIGATES to /nap/rutin (the ADR's
                    logging home); the tick-looking button is a door, not a tick. */}
                <div className="rt-nextcard glass rise" style={{ '--d': '90ms' } as CSSProperties} data-testid="next-card">
                  <div className="rt-nextcard-tx">
                    <div className="rt-nextcard-eb">{next != null ? 'Következik' : 'Mind megvan'}</div>
                    <div className="rt-nextcard-nm">{next != null ? next.title : 'A mai rutin kész'}</div>
                    <div className="rt-nextcard-cue">
                      {next != null
                        ? [next.anchorCopy, `${chainOfKey(next.chain)?.title ?? next.chain} lánc`].filter(Boolean).join(' · ')
                        : 'holnap folytatódik'}
                    </div>
                  </div>
                  <button
                    type="button"
                    className={cn('rt-bigtick', next == null && 'is-allon')}
                    aria-label={next != null ? 'Pipálás a Nap oldalon' : 'A Nap oldal megnyitása'}
                    onClick={() => toNap(chainOfKey(next?.chain ?? '')?.daypart ?? activeChain?.daypart)}
                  >
                    <Icon3D name={next != null ? 't-tick' : 't-star'} size={40} />
                  </button>
                </div>

                {/* AKTÍV LÁNC — the chain holding the next row; opens the chain page. */}
                {activeChain != null && (
                  <button
                    type="button"
                    className="rt-chaintile glass rise"
                    style={{ '--d': '130ms' } as CSSProperties}
                    data-testid="chain-tile"
                    onClick={() => navigate(`/me/rutin/lanc/${encodeURIComponent(activeChain.chainKey)}`)}
                  >
                    <Icon3D name={DAYPART_ART[activeChain.daypart]} size={38} />
                    <span className="rt-chaintile-bd">
                      <span className="rt-chaintile-eb">Aktív lánc · {activeChain.title}</span>
                      <span className="rt-chdots" aria-hidden="true">
                        {chainItems.map((h) => (
                          <i key={h.key} className={cn(h.status === 'done' && 'is-d', next?.key === h.key && 'is-now')} />
                        ))}
                      </span>
                    </span>
                    <span className="rt-chaintile-dg">
                      {doneOf(chainItems)} / {chainItems.length}<small>kész</small>
                    </span>
                    <span className="rt-chaintile-cv" aria-hidden="true">›</span>
                  </button>
                )}

                {/* SZOKÁSAID + ÉPÍTS */}
                <Mosaic className="rt-doors">
                  <Tile
                    wash="lav" art="t-harvest" iconSize={44} eyebrow="Szokásaid" delayMs={170}
                    className="glass rt-door is-lav"
                    line={`${activeDefs.length} aktív${settled > 0 ? ` · ${settled} beérett` : ''}`}
                    onClick={() => navigate('/me/rutin/szokasok')} aria-label="Szokásaid"
                  />
                  <Tile
                    wash="sage" art="t-book" iconSize={44} eyebrow="Építs" delayMs={200}
                    className="glass rt-door is-sage"
                    line="＋ Új szokás / lánc"
                    onClick={() => navigate('/me/rutin/uj')} aria-label="Építs"
                  />
                </Mosaic>
                <button
                  type="button"
                  className="cta-ghost rt-flatbtn rise"
                  style={{ '--d': '240ms' } as CSSProperties}
                  onClick={() => setChainSheet(true)}
                >
                  ＋ Új lánc
                </button>
              </>
            )
          ) : habits.length === 0 ? <GhostState lines={2} message="Nincs rutinadat erre a napra" />
            : (
              <>
                <div className="rt-pastsum rise" style={{ '--d': '0ms' } as CSSProperties}>
                  <div className="gr-daysum">Reggel <b>{doneOf(morning)}/{morning.length}</b> · Este <b>{doneOf(evening)}/{evening.length}</b> · <b className="rt-xp">+{earnedXp} XP</b></div>
                  {missed.map((c) => <div key={c.id} className="gr-softnote">{c.title} kimaradt — a lánc másnap folytatódott. A 30 napos erő ettől nem nullázódik.</div>)}
                </div>
                {pastChains.map((c, i) => pastCard(c, 60 + i * 70))}
              </>
            )}
        </EntranceGroup>
      </PageBody>
      {chainSheet && <ChainEditSheet onClose={() => setChainSheet(false)} />}
      {suggestSheet && <AiSuggestSheet onClose={() => setSuggestSheet(false)} />}
    </MozaikPage>
  )
}

// ============================================================
// Mezo · RutinHubPage (mezo-3zue.3, hub 2.0 mezo-mgpr; Folyadék F2 mezo-n4wf5.2) —
// /nap/rutin/epites, prototype vilagos/nap.js `rutinEpites`. The hero says what comes next and
// shows every running chain as a row of drops; under it two cards: „Amid most van" (the chains,
// the habit list) and „Építs újat" (new habit, new chain, AI suggestion).
//
// The daily logging home stays /nap/rutin (ADR + Daniel's S2 answer): the hero's button and the
// chain rows NAVIGATE, they never tick — the hub must not become a second logging surface. The
// PAST-day branch (mezo-x9c2's arbitrary-past-day browsing) is the same hero read-only, with the
// day's rows under it.
// ============================================================
import { Fragment, useState, type CSSProperties } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useHabitCatalog, useHabitDay, useHabitFormations, useHabitSummary } from '@/data/hooks'
import type { HabitChainInfo, HabitDaypart, HabitItem } from '@/data/types'
import { RbBack } from '@/features/me/components/routineBits'
import { AiSuggestSheet } from '@/features/me/sheets/AiSuggestSheet'
import { ChainEditSheet } from '@/features/me/sheets/ChainEditSheet'
import { addDays, huMonthDayDow, huWeekdayFullIso, localDateString } from '@/shared/lib/dates'
import type { Icon3DName } from '@/shared/ui/clay'
import {
  Btn, Card, DropChain, Empty, ErrorRow, Facts, Hero, Lk, Mark, Note, Page, Row, Section, useFrameTitle,
  type DropChainItem,
} from '@/shared/ui/folyadek'

// The daypart's glyph, mapped HERE, not through CLAY_TO_3D — there `i-alvas` is sleep (t-sleep),
// but on a rutin chain it means „este" (t-moon).
const DAYPART_ART: Record<HabitDaypart, Icon3DName> = { MORNING: 't-dawn', DAY: 't-sun', EVENING: 't-moon' }
const DAYPART_FACE: Record<HabitDaypart, string> = { MORNING: 'reggel', DAY: 'napkozben', EVENING: 'este' }
const STATUS_SR: Record<HabitItem['status'], string> = { done: 'kész', missed: 'kimaradt', pending: 'nyitott' }

export function RutinHubPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  // The wizard's ?new= hand-back highlights nothing here any more (the rows left for
  // /nap/rutin/szokasok), but arriving with it is still a valid address — ignore it quietly.
  void params
  const today = localDateString()
  const [date, setDate] = useState(today)
  const isToday = date === today
  const { habits } = useHabitDay(date)
  const { data: summary } = useHabitSummary()
  const { catalog, isPending, isError, refetch } = useHabitCatalog()
  const [chainSheet, setChainSheet] = useState(false)
  const [suggestSheet, setSuggestSheet] = useState(false)
  useFrameTitle({ title: 'Rutinok' })

  const chains = [...catalog.chains].sort((a, b) => a.position - b.position)
  const doneOf = (l: HabitItem[]) => l.filter((h) => h.status === 'done').length
  const itemsOf = (c: HabitChainInfo) => habits.filter((h) => h.chain === c.chainKey)
  const morning = habits.filter((h) => h.chain === 'MORNING'), evening = habits.filter((h) => h.chain === 'EVENING')
  const earnedXp = habits.filter((h) => h.status === 'done').reduce((s, h) => s + h.xp, 0)

  const doneToday = doneOf(habits)
  const totalToday = habits.length
  // A paused CHAIN does not run, so its still-active defs are not active habits either — the
  // fact's label ("aktív szokás") would otherwise overstate the number (mezo-4kbl).
  const activeChains = chains.filter((c) => c.isActive)
  const activeDefs = activeChains.flatMap((c) => c.defs).filter((d) => d.isActive)
  const missed = activeChains.filter((c) => { const items = itemsOf(c); return items.length > 0 && doneOf(items) === 0 })

  // Settled ("beérett") count for the hero sub + the Szokásaid row: past the threshold on the
  // formation curve. Page-triggered aggregate (mezo-08zl's rule) — the hub is a page, not the
  // chat hot path; the per-key cache is shared with the habit pages.
  const formations = useHabitFormations(activeDefs.map((d) => d.habitKey))
  const settled = activeDefs.filter((d) => {
    const f = formations.get(d.habitKey)
    return f != null && f.thresholdPct > 0 && f.automaticityPct != null && f.automaticityPct >= f.thresholdPct
  }).length

  // The next pending habit in the day view's own order (chain position order) — the ONE habit
  // the hero names. Its button navigates to the logging home.
  const next = habits.find((h) => h.status === 'pending')
  const chainOfKey = (chainKey: string) => chains.find((c) => c.chainKey === chainKey)
  const activeChain: HabitChainInfo | undefined = next != null
    ? chainOfKey(next.chain)
    : [...activeChains].reverse().find((c) => habits.some((h) => h.chain === c.chainKey))
  const toNap = (daypart: HabitDaypart | undefined) =>
    navigate(`/nap/rutin${daypart != null ? `?dp=${DAYPART_FACE[daypart]}` : ''}`)

  // One drop row per running chain that has rows on this day. On a past day a row that did not
  // happen is a dashed drop; today the next one wears the ring.
  const dayChains = activeChains.map((c) => ({ chain: c, items: itemsOf(c) })).filter((x) => x.items.length > 0)
  const longest = Math.max(1, ...dayChains.map((x) => x.items.length))
  const dropOf = (h: HabitItem): DropChainItem => ({
    state: h.status === 'done' ? 'done' : !isToday || h.status === 'missed' ? 'missed' : next?.key === h.key ? 'now' : 'empty',
    ariaLabel: `${h.title} · ${STATUS_SR[h.status]}`,
  })
  const chainDrops = dayChains.length > 0 && (
    <div className="rb-ch2">
      {dayChains.map(({ chain, items }) => (
        <div key={chain.id} style={{ '--w': `${(items.length / longest) * 100}%` } as CSSProperties}>
          <small>{chain.title} · {doneOf(items)} / {items.length}</small>
          <DropChain items={items.map(dropOf)} />
        </div>
      ))}
    </div>
  )

  const prevDay = <Lk onClick={() => setDate(addDays(date, -1))}>‹ Előző nap</Lk>
  const yesterday = addDays(today, -1)
  const dayName = date === yesterday ? `Tegnap · ${huWeekdayFullIso(date).toLowerCase()}` : huMonthDayDow(date)

  const todayBody = isPending && chains.length === 0 ? (
    <Card><Note>Rutinok betöltése…</Note></Card>
  ) : isError && chains.length === 0 ? (
    <Card><ErrorRow message="Nem sikerült betölteni a rutinokat." onRetry={refetch} /></Card>
  ) : (
    <>
      {/* The hero NAVIGATES to /nap/rutin (the ADR's logging home); its button is a door, not a tick.
          Honesty rule: while the day view is unresolved there is no standing — no „0 / 0". */}
        <Hero
          data-testid="next-card"
          label={next != null ? `Következik${totalToday > 0 ? ` · ${doneToday} / ${totalToday} ma` : ''}` : 'Mind megvan'}
          verdict={next != null ? `${next.title}.` : 'A mai rutin kész.'}
          // The anchor copy is the user's own clause („kávé után", „megvolt a napfény") — it stands on
          // its own in the sub, never bent into the verdict's grammar.
          sub={next != null
            ? [next.anchorCopy, `${chainOfKey(next.chain)?.title ?? next.chain} lánc`,
              settled > 0 ? `${settled} szokás már magától megy` : null].filter(Boolean).join(' · ')
            : 'Holnap folytatódik.'}
          actions={(
            <>
              <Btn onClick={() => toNap(chainOfKey(next?.chain ?? '')?.daypart ?? activeChain?.daypart)}>Pipálom a Rutin fülön</Btn>
              {prevDay}
            </>
          )}
        >
          {chainDrops}
          {/* The 30-day counters do not depend on the day shown. */}
          <Facts items={[
            [summary.perfectMorningDays30, 'tökéletes reggel · 30 nap'],
            [summary.perfectEveningDays30, 'tökéletes este · 30 nap'],
            [activeDefs.length, 'aktív szokás'],
          ]} />
        </Hero>

      <Section n={1} title="Amid most van" />
      <Card>
        {activeChains.map((c) => {
          const items = itemsOf(c)
          const count = c.defs.filter((d) => d.isActive).length
          return (
              <Row
                key={c.id} data-testid={c.id === activeChain?.id ? 'chain-tile' : `chain-row-${c.chainKey}`}
                icon={DAYPART_ART[c.daypart]}
                title={`Aktív lánc · ${c.title}`}
                sub={count === 0 ? 'még nincs benne szokás'
                  : `${items.length > 0 ? `${doneOf(items)} / ${items.length} kész · ` : ''}${count} szokás, horgonyokkal összekötve`}
                onClick={() => navigate(`/nap/rutin/lanc/${encodeURIComponent(c.chainKey)}`)}
              />
          )
        })}
        <Row
          icon="t-harvest" title="Szokásaid"
          sub={`${activeDefs.length} aktív${settled > 0 ? ` · ${settled} beérett` : ''}`}
          onClick={() => navigate('/nap/rutin/szokasok')}
        />
      </Card>

      <Section n={2} title="Építs újat" />
      <Card>
        <Row icon="t-book" title="Új szokás" sub="lépésről lépésre, egy meglévő szokásra ültetve" onClick={() => navigate('/nap/rutin/uj')} />
        <Row icon="t-chain" title="Új lánc" sub="egy új napszakra vagy helyzetre" onClick={() => setChainSheet(true)} />
        <Row icon="t-spark" title="AI javaslat" sub="mondd el, mit szeretnél, Mezo ajánl szokást" onClick={() => setSuggestSheet(true)} />
        <Note>Itt építed és szerkeszted a rutint — pipálni a Rutin fülön lehet.</Note>
      </Card>
    </>
  )

  const pastNav = (
    <>
      <Btn onClick={() => setDate(today)}>Vissza a mai napra</Btn>
      {prevDay}
      {date < yesterday && <Lk onClick={() => setDate(addDays(date, 1))}>Következő nap ›</Lk>}
    </>
  )
  const pastBody = habits.length === 0 ? (
    <Card><Empty icon="t-calendar" actions={pastNav}>Nincs rutinadat erre a napra</Empty></Card>
  ) : (
    <>
        <Hero
          data-testid="past-day"
          label={`${dayName} · +${earnedXp} XP`}
          verdict={`Reggel ${doneOf(morning)}/${morning.length} · Este ${doneOf(evening)}/${evening.length}`}
          sub={missed.length > 0
            ? missed.map((c) => `${c.title} kimaradt — a lánc másnap folytatódott. A 30 napos erő ettől nem nullázódik.`).join(' ')
            : undefined}
          actions={pastNav}
        >
          {chainDrops}
        </Hero>
      {/* The day's rows, read-only (history, not the live catalog). */}
      {dayChains.map(({ chain, items }, k) => (
        <Fragment key={chain.id}>
          <Section n={k + 1} title={`${chain.title} · ${doneOf(items)} / ${items.length}`} />
          <Card>
            {items.map((h) => (
              <Row
                key={h.key}
                left={<Mark state={h.status === 'done' ? 'done' : 'empty'} label={h.status === 'done' ? STATUS_SR.done : undefined} />}
                title={h.title}
                sub={h.status === 'done' ? undefined : STATUS_SR[h.status]}
                state={h.status === 'done' ? undefined : 'dim'}
              />
            ))}
          </Card>
        </Fragment>
      ))}
    </>
  )

  return (
    <Page>
      <RbBack label="Rutin" fallback="/nap/rutin" />
      {isToday ? todayBody : pastBody}
      {chainSheet && <ChainEditSheet onClose={() => setChainSheet(false)} />}
      {suggestSheet && <AiSuggestSheet onClose={() => setSuggestSheet(false)} />}
    </Page>
  )
}

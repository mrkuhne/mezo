// ============================================================
// Mezo · RutinHubPage (mezo-3zue.3) — /me/rutin, prototype rutin-epito-head.html ×1.18.
// Absorbs GrowthRutinPage's read-only overview (mezo-rmi0.1: two 30-cell counter tiles, the
// DayNavigator, catalog-driven chain cards) AND RoutineEditorPage's editing chrome
// (mezo-n5e9.2: active Toggle, ✎ ChainEditSheet, SortableList, ＋ Új habit/rutin, ✨ AI
// javaslat) into ONE page under Én — the routine surface leaves Growth for good.
//
// TODAY renders from the CATALOG (every chain, every def, in position order) and overlays the
// day view's status where a row exists — the day view returns ACTIVE defs only and nothing at
// all for a chain with no habits today, so deriving from it hid inactive defs/chains, stranded
// brand-new chains and sent a PARTIAL id list to reorder (400 HABIT_REORDER_MISMATCH).
// The PAST-day branch still derives from the day view exactly as GrowthRutinPage did — it is
// history, not the live catalog. Habit rows stay non-tickable everywhere; the per-def Toggle
// PAUSES a definition, it never completes it — ticking lives on /nap/rutin (ADR — hard rule).
// ============================================================
import type { CSSProperties } from 'react'
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useHabitCatalog, useHabitCatalogActions, useHabitDay, useHabitSummary } from '@/data/hooks'
import type { HabitChainInfo, HabitDaypart, HabitDefInfo, HabitFramework, HabitItem } from '@/data/types'
import { AiSuggestSheet } from '@/features/me/sheets/AiSuggestSheet'
import { ChainEditSheet } from '@/features/me/sheets/ChainEditSheet'
import { HabitEditSheet } from '@/features/me/sheets/HabitEditSheet'
import { localDateString } from '@/shared/lib/dates'
import { ClayIcon, type ClayIconName } from '@/shared/ui/clay'
import { DayNavigator } from '@/shared/ui/DayNavigator'
import { GhostState } from '@/shared/ui/GhostState'
import { Icon } from '@/shared/ui/Icon'
import { MozaikPage, PageBody, PageHead, PageHero, StatCell, StatStrip } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { SortableList } from '@/shared/ui/SortableList'
import { Toggle } from '@/shared/ui/Toggle'
import { cn } from '@/shared/lib/cn'

const DAYPART_ICON: Record<HabitDaypart, ClayIconName> = { MORNING: 'i-hajnal', DAY: 'i-nap', EVENING: 'i-alvas' }
const DAYPART_WASH: Record<HabitDaypart, 'amber' | '' | 'lav'> = { MORNING: 'amber', DAY: '', EVENING: 'lav' }
const STATUS_SR: Record<HabitItem['status'], string> = { done: 'kész', missed: 'kimaradt', pending: 'nyitott' }
const FRAMEWORK_LABEL = { FOGG: 'szokás-láncolás', CLEAR: 'négy törvény', NONE: 'keret nélkül' } as const
const FRAMEWORK_BADGE: Record<'FOGG' | 'CLEAR' | 'NONE', string> = { FOGG: '⚓ FOGG', CLEAR: '◈ CLEAR', NONE: '– RÉGI' }

// RoutineEditorPage's "+ Új habit" row, verbatim — a dashed, sage-washed full-width affordance.
const ADD_HABIT_STYLE: CSSProperties = {
  width: '100%', padding: 10, marginTop: 10,
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  fontSize: 11, fontWeight: 700, color: 'var(--coral)',
  background: 'color-mix(in srgb, var(--sage) 8%, transparent)', border: '1px dashed var(--line)',
}

function frameworkKey(f: HabitFramework | null | undefined): 'FOGG' | 'CLEAR' | 'NONE' {
  return f ?? 'NONE'
}

export function RutinHubPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const newHabitKey = params.get('new')
  const today = localDateString()
  const [date, setDate] = useState(today)
  const isToday = date === today
  const { habits } = useHabitDay(date)
  const { data: summary } = useHabitSummary()
  const { catalog, isPending, isError, refetch } = useHabitCatalog()
  const { updateChain, reorderChain, pending } = useHabitCatalogActions()
  const [chainSheet, setChainSheet] = useState<{ chain?: HabitChainInfo } | null>(null)
  // CREATE only — a habit ROW navigates to /me/rutin/szokas/{habitKey}, which is where a
  // definition is edited and deleted. `HabitEditSheet` no longer has an edit branch at all.
  const [habitSheet, setHabitSheet] = useState<{ chainKey: string } | null>(null)
  const [suggestSheet, setSuggestSheet] = useState(false)

  const strength = (key: string) => summary.habits.find((h) => h.key === key)?.strengthPct ?? null
  // TODAY renders EVERY chain (inactive ones dimmed, never hidden — the toggle that pauses a
  // chain lives here, so hiding it would strand the chain). The past-day branch keeps the old
  // active-only projection: history shows the chains that were live.
  const chains = [...catalog.chains].sort((a, b) => a.position - b.position)
  const pastChains = chains.filter((c) => c.isActive)
  const doneOf = (l: HabitItem[]) => l.filter((h) => h.status === 'done').length
  const morning = habits.filter((h) => h.chain === 'MORNING'), evening = habits.filter((h) => h.chain === 'EVENING')
  const earnedXp = habits.filter((h) => h.status === 'done').reduce((s, h) => s + h.xp, 0)
  const missed = pastChains.filter((c) => { const items = habits.filter((h) => h.chain === c.chainKey); return items.length > 0 && doneOf(items) === 0 })

  const doneToday = doneOf(habits)
  const totalToday = habits.length
  const strengthPcts = summary.habits.map((h) => h.strengthPct).filter((p): p is number => p != null)
  const meanStrength = strengthPcts.length ? Math.round(strengthPcts.reduce((s, p) => s + p, 0) / strengthPcts.length) : null
  const activeDefs = catalog.chains.flatMap((c) => c.defs).filter((d) => d.isActive).length

  // Past-day row: status-only, exactly as GrowthRutinPage rendered it.
  const pastRow = (h: HabitItem) => (
    <div key={h.key} className={cn('gr-chainrow', h.status === 'done' && 'done', h.status !== 'done' && 'skip')}>
      <span className="gr-ck" aria-hidden="true">✓</span>
      <span className="sr-only">{STATUS_SR[h.status]}</span>
      <span className="tx">{h.title}</span>
    </div>
  )

  // Today's row: the CATALOG definition is the row; the day view only tints it. `item` is
  // absent for an inactive def (the day view filters those out) — the row then carries no
  // status at all rather than a fabricated "nyitott".
  const defRow = (def: HabitDefInfo, item: HabitItem | undefined) => {
    const fw = frameworkKey(def.framework)
    const pct = strength(def.habitKey)
    const done = item?.status === 'done'
    return (
      // A prototípus .hrow kétsoros rácsa: "n f" / "b b". A grip a SortableList fogantyúja,
      // a soron kívül. A per-def Toggle ELTŰNT — szüneteltetni a HabitPage-en lehet, ezért a
      // szünetelő sor halványul, de tapphatóan odanavigál (mezo-3zue.4 hibahulláma).
      <div className={cn('row', !def.isActive && 'is-inert', done && 'rt-done')} style={{ alignItems: 'center', gap: 8 }}>
        <button
          type="button"
          className={cn('rt-hrow', newHabitKey === def.habitKey && 'rt-row-new')}
          style={{ flex: 1, minWidth: 0 }}
          onClick={() => navigate(`/me/rutin/szokas/${def.habitKey}`)}
          aria-label={`${def.title} · ${FRAMEWORK_LABEL[fw]}${pct != null ? ` · 28 napos erő ${pct}%` : ''}`}
        >
          <span className="rt-nm">{def.title}</span>
          <span className={cn('rt-fw', `rt-fw-${fw.toLowerCase()}`)}>{FRAMEWORK_BADGE[fw]}</span>
          <span className="rt-bar">
            {/* READ-ONLY jelző, nem kontroll: a pipálás a /nap/rutin-on él (ADR). */}
            <span className="rt-tick" aria-hidden="true">✓</span>
            {item && <span className="sr-only">{STATUS_SR[item.status]}</span>}
            {pct != null && (
              <>
                <span className="rt-strength" aria-hidden="true">
                  <div style={{ width: `${pct}%` }} />
                </span>
                <span className="rt-strength-n">{pct}%</span>
              </>
            )}
          </span>
        </button>
      </div>
    )
  }

  // Today's card — always rendered, even for a chain with no habits today (a chain just born
  // through ＋ Új lánc must show its ＋ Új habit row or it can never gain habits).
  const todayCard = (chain: HabitChainInfo, delayMs: number) => {
    const items = habits.filter((h) => h.chain === chain.chainKey)
    const pcts = items.map((h) => strength(h.key)).filter((p): p is number => p != null)
    const avg = pcts.length ? Math.round(pcts.reduce((s, p) => s + p, 0) / pcts.length) : null
    const defs = [...chain.defs].sort((a, b) => a.position - b.position).map((d) => ({ ...d, label: d.title }))
    return (
      <div key={chain.id} className={cn('gr-chain', DAYPART_WASH[chain.daypart], 'rise', !chain.isActive && 'is-inert')} style={{ '--d': `${delayMs}ms` } as CSSProperties}>
        <div className="gr-band-top">
          <ClayIcon name={DAYPART_ICON[chain.daypart]} size={17} />
          <span className="mz-eyebrow">{chain.title}</span>
          <span className={cn('gr-band-chip', chain.daypart === 'EVENING' ? 'lav' : 'warn')}>
            {doneOf(items)} / {items.length}{avg != null ? ` · erő ${avg}%` : ''}
          </span>
          <Toggle on={chain.isActive} onToggle={() => updateChain(chain.id, { isActive: !chain.isActive })}
            ariaLabel={`${chain.title} aktív`} disabled={pending} />
          <button type="button" className="chip" aria-label={`${chain.title} szerkesztése`} onClick={() => setChainSheet({ chain })}>
            <span aria-hidden="true">✎</span>
          </button>
        </div>
        {/* The id list SortableList hands back is built from the chain's whole catalog def set,
            so reorder always sends an exact permutation — a day-filtered subset is rejected
            with 400 HABIT_REORDER_MISMATCH (and the mock arm mirrors that throw). */}
        <SortableList
          items={defs}
          onReorder={(ids) => reorderChain(chain.id, ids)}
          renderItem={(def) => defRow(def, items.find((it) => it.key === def.habitKey))}
          disabled={pending}
          chevrons="focus"
        />
        <button
          type="button"
          className="rad-12"
          style={ADD_HABIT_STYLE}
          onClick={() => setHabitSheet({ chainKey: chain.chainKey })}
        >
          <Icon name="plus" size={12} /> Új habit
        </button>
      </div>
    )
  }

  // Past-day card — the day view's rows, unchanged (history, not the live catalog).
  const pastCard = (chain: HabitChainInfo, delayMs: number) => {
    const items = habits.filter((h) => h.chain === chain.chainKey)
    if (items.length === 0) return null
    return (
      <div key={chain.id} className={cn('gr-chain', DAYPART_WASH[chain.daypart], 'rise')} style={{ '--d': `${delayMs}ms` } as CSSProperties}>
        <div className="gr-band-top">
          <ClayIcon name={DAYPART_ICON[chain.daypart]} size={17} />
          <span className="mz-eyebrow">{chain.title}</span>
          <span className={cn('gr-band-chip', chain.daypart === 'EVENING' ? 'lav' : 'warn')}>
            {doneOf(items)} / {items.length}
          </span>
        </div>
        {items.map((h) => pastRow(h))}
      </div>
    )
  }

  return (
    <MozaikPage tone="gold">
      <PageHead onBack={() => navigate('/me')} label="‹ Én">
        <button type="button" className="mz-pgact" onClick={() => setSuggestSheet(true)}><span aria-hidden="true">✨</span> AI javaslat</button>
      </PageHead>
      {/* Honesty rule (the Én tile's): while the day view is unresolved `doneToday/totalToday`
          reads a confident "0 / 0" that is not a real standing — show no number at all then. */}
      <PageHero
        icon="i-hajnal" iconSize={52} big={totalToday > 0 ? `${doneToday} / ${totalToday}` : undefined} name="Rutin"
        sub={isToday ? (meanStrength != null ? `ma · 28 napos átlagerő ${meanStrength}%` : 'ma') : undefined}
      />
      <PageBody principle="Kimaradt nap nem törli a láncot — holnap folytatódik. A százalék a lánc 30 napos ereje, nem ítélet.">
        <EntranceGroup replayKey={date}>
          {/* A 30 napos aggregátum a kiválasztott naptól független, ezért a múltnapi ágon is
              itt marad — a lap identitása nem ugrik napváltáskor. */}
          <StatStrip className="rise">
            <StatCell value={summary.perfectMorningDays30} label="tökéletes reggel · 30 n" />
            <StatCell value={summary.perfectEveningDays30} label="tökéletes este · 30 n" />
            <StatCell value={activeDefs} label="aktív szokás" />
          </StatStrip>
          <div className="gr-daynav rise" style={{ '--d': '60ms' } as CSSProperties}>
            <DayNavigator date={date} maxDate={today} onChange={setDate} />
          </div>
          {isToday ? (
            // A genuinely failed catalog fetch and an honest "not resolved yet" both read as an
            // empty catalog off `catalog.chains` alone — without isPending/isError this page
            // showed the inviting create view for a failure (mezo-n5e9.2 fix wave, restored).
            isPending && chains.length === 0 ? (
              <GhostState message="Rutinok betöltése…" />
            ) : isError && chains.length === 0 ? (
              <GhostState message="Nem sikerült betölteni a rutinokat." ctaLabel="Újra" onCta={refetch} />
            ) : (
              <>
                {chains.map((c, i) => todayCard(c, 100 + i * 70))}
                <div className="row gap-sm rise" style={{ '--d': `${chains.length * 70 + 140}ms` } as CSSProperties}>
                  <button type="button" className="cta-primary" style={{ flex: 1.8 }} onClick={() => navigate('/me/rutin/uj')}>
                    <Icon name="plus" size={14} /> Új szokás-recept
                  </button>
                  <button type="button" className="cta-ghost" style={{ flex: 1 }} onClick={() => setChainSheet({})}>
                    <Icon name="plus" size={12} /> Új lánc
                  </button>
                </div>
              </>
            )
          ) : habits.length === 0 ? <GhostState lines={2} message="Nincs rutinadat erre a napra" />
            : (
              <>
                <div className="gr-chain rise" style={{ '--d': '0ms' } as CSSProperties}>
                  <div className="gr-daysum">Reggel <b>{doneOf(morning)}/{morning.length}</b> · Este <b>{doneOf(evening)}/{evening.length}</b> · <b style={{ color: 'var(--mz-cell-sage-ink)' }}>+{earnedXp} XP</b></div>
                  {missed.map((c) => <div key={c.id} className="gr-softnote">{c.title} kimaradt — a lánc másnap folytatódott. A 30 napos erő ettől nem nullázódik.</div>)}
                </div>
                {pastChains.map((c, i) => pastCard(c, 60 + i * 70))}
              </>
            )}
        </EntranceGroup>
      </PageBody>
      {chainSheet && <ChainEditSheet chain={chainSheet.chain} onClose={() => setChainSheet(null)} />}
      {habitSheet && <HabitEditSheet chainKey={habitSheet.chainKey} onClose={() => setHabitSheet(null)} />}
      {suggestSheet && <AiSuggestSheet onClose={() => setSuggestSheet(false)} />}
    </MozaikPage>
  )
}

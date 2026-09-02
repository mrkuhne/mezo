// ============================================================
// Mezo · RutinHubPage (mezo-3zue.3) — /me/rutin, prototype rutin-epito-head.html ×1.18.
// Absorbs GrowthRutinPage's read-only overview (mezo-rmi0.1: two 30-cell counter tiles, the
// DayNavigator, catalog-driven chain cards) AND RoutineEditorPage's editing chrome
// (mezo-n5e9.2: active Toggle, ✎ ChainEditSheet, SortableList, ＋ Új habit/rutin, ✨ AI
// javaslat) into ONE page under Én — the routine surface leaves Growth for good. The past-day
// branch stays exactly as GrowthRutinPage rendered it (history, not a live catalog); every
// editing affordance below lives on the TODAY branch only. Habit rows stay non-tickable
// everywhere — ticking lives on /nap/rutin (ADR — hard product rule).
// ============================================================
import type { CSSProperties } from 'react'
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useHabitCatalog, useHabitCatalogActions, useHabitDay, useHabitSummary } from '@/data/hooks'
import type { HabitChainInfo, HabitDaypart, HabitFramework, HabitItem } from '@/data/types'
import { AiSuggestSheet } from '@/features/me/sheets/AiSuggestSheet'
import { ChainEditSheet } from '@/features/me/sheets/ChainEditSheet'
import { localDateString } from '@/shared/lib/dates'
import { ClayIcon, ClaySpot, type ClaySpotName, type ClayIconName } from '@/shared/ui/clay'
import { DayNavigator } from '@/shared/ui/DayNavigator'
import { GhostState } from '@/shared/ui/GhostState'
import { Icon } from '@/shared/ui/Icon'
import { MozaikPage, PageBody, PageHead, PageHero } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { SortableList } from '@/shared/ui/SortableList'
import { Toggle } from '@/shared/ui/Toggle'
import { cn } from '@/shared/lib/cn'

const DAYS = 30
const DAYPART_ICON: Record<HabitDaypart, ClayIconName> = { MORNING: 'i-hajnal', DAY: 'i-nap', EVENING: 'i-alvas' }
const DAYPART_WASH: Record<HabitDaypart, 'amber' | '' | 'lav'> = { MORNING: 'amber', DAY: '', EVENING: 'lav' }
const STATUS_SR: Record<HabitItem['status'], string> = { done: 'kész', missed: 'kimaradt', pending: 'nyitott' }
const FRAMEWORK_LABEL = { FOGG: 'szokás-láncolás', CLEAR: 'négy törvény', NONE: 'keret nélkül' } as const
const FRAMEWORK_BADGE: Record<'FOGG' | 'CLEAR' | 'NONE', string> = { FOGG: '⚓ FOGG', CLEAR: '◈ CLEAR', NONE: '– RÉGI' }

function frameworkKey(f: HabitFramework | null | undefined): 'FOGG' | 'CLEAR' | 'NONE' {
  return f ?? 'NONE'
}

function Cells({ id, count, evening, delayMs }: { id: string; count: number; evening?: boolean; delayMs: number }) {
  return (
    <div className="gr-cells" id={id} aria-hidden="true">
      {Array.from({ length: DAYS }, (_, i) => (
        <i key={i} className={cn(evening && 'ev', i < count && 'on')} style={{ '--d': `${delayMs}ms`, '--i': i } as CSSProperties} />
      ))}
    </div>
  )
}

function CounterTile({ id, spot, label, count, evening, delayMs }: { id: string; spot: ClaySpotName; label: string; count: number; evening?: boolean; delayMs: number }) {
  return (
    <div className="gr-covtile">
      <div className="gr-cov-hd"><ClaySpot name={spot} size={19} /><b>{label}</b><span className="gr-cov-n">{count}<small> / {DAYS}</small></span></div>
      <Cells id={id} count={count} evening={evening} delayMs={delayMs} />
    </div>
  )
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
  const { catalog } = useHabitCatalog()
  const { updateChain, reorderChain, pending } = useHabitCatalogActions()
  const [chainSheet, setChainSheet] = useState<{ chain?: HabitChainInfo } | null>(null)
  const [suggestSheet, setSuggestSheet] = useState(false)

  const strength = (key: string) => summary.habits.find((h) => h.key === key)?.strengthPct ?? null
  const defOf = (habitKey: string) => catalog.chains.flatMap((c) => c.defs).find((d) => d.habitKey === habitKey)
  const chains = [...catalog.chains].filter((c) => c.isActive).sort((a, b) => a.position - b.position)
  const doneOf = (l: HabitItem[]) => l.filter((h) => h.status === 'done').length
  const morning = habits.filter((h) => h.chain === 'MORNING'), evening = habits.filter((h) => h.chain === 'EVENING')
  const earnedXp = habits.filter((h) => h.status === 'done').reduce((s, h) => s + h.xp, 0)
  const missed = chains.filter((c) => { const items = habits.filter((h) => h.chain === c.chainKey); return items.length > 0 && doneOf(items) === 0 })

  const doneToday = doneOf(habits)
  const totalToday = habits.length
  const strengthPcts = summary.habits.map((h) => h.strengthPct).filter((p): p is number => p != null)
  const meanStrength = strengthPcts.length ? Math.round(strengthPcts.reduce((s, p) => s + p, 0) / strengthPcts.length) : null

  const habitRow = (h: HabitItem, showStrength: boolean) => {
    const def = defOf(h.key)
    const pct = showStrength ? strength(h.key) : null
    if (!isToday || !def) {
      return (
        <div key={h.key} className={cn('gr-chainrow', h.status === 'done' && 'done', h.status !== 'done' && !isToday && 'skip')}>
          <span className="gr-ck" aria-hidden="true">✓</span>
          <span className="sr-only">{STATUS_SR[h.status]}</span>
          <span className="tx">{h.title}</span>
          {showStrength && pct != null && <span className="gr-chain-pct">{pct}%</span>}
        </div>
      )
    }
    const fw = frameworkKey(def.framework)
    return (
      <button
        key={h.key}
        type="button"
        className={cn('gr-chainrow', 'rt-hrow', h.status === 'done' && 'done', newHabitKey === def.habitKey && 'rt-row-new')}
        onClick={() => navigate(`/me/rutin/szokas/${def.habitKey}`)}
        aria-label={`${def.title} · ${FRAMEWORK_LABEL[fw]}`}
      >
        <span className="gr-ck" aria-hidden="true">✓</span>
        <span className="sr-only">{STATUS_SR[h.status]}</span>
        <span className="tx">{h.title}</span>
        <span className={cn('rt-fw', `rt-fw-${fw.toLowerCase()}`)}>{FRAMEWORK_BADGE[fw]}</span>
        {pct != null && (
          <span className="rt-strength">
            <div style={{ width: `${pct}%` }} />
          </span>
        )}
      </button>
    )
  }

  const chainCard = (chain: HabitChainInfo, showStrength: boolean, delayMs: number) => {
    const items = habits.filter((h) => h.chain === chain.chainKey)
    if (items.length === 0) return null
    const pcts = items.map((h) => strength(h.key)).filter((p): p is number => p != null)
    const avg = pcts.length ? Math.round(pcts.reduce((s, p) => s + p, 0) / pcts.length) : null
    const defs = chain.defs.filter((d) => items.some((h) => h.key === d.habitKey))
      .sort((a, b) => a.position - b.position).map((d) => ({ ...d, label: d.title }))

    return (
      <div key={chain.id} className={cn('gr-chain', DAYPART_WASH[chain.daypart], 'rise')} style={{ '--d': `${delayMs}ms` } as CSSProperties}>
        <div className="gr-band-top">
          <ClayIcon name={DAYPART_ICON[chain.daypart]} size={17} />
          <span className="mz-eyebrow">{chain.title}</span>
          <span className={cn('gr-band-chip', chain.daypart === 'EVENING' ? 'lav' : 'warn')}>
            {doneOf(items)} / {items.length}{showStrength && avg != null ? ` · erő ${avg}%` : ''}
          </span>
          {isToday && (
            <>
              <Toggle on={chain.isActive} onToggle={() => updateChain(chain.id, { isActive: !chain.isActive })}
                ariaLabel={`${chain.title} aktív`} disabled={pending} />
              <button type="button" className="chip" aria-label={`${chain.title} szerkesztése`} onClick={() => setChainSheet({ chain })}>
                <span aria-hidden="true">✎</span>
              </button>
            </>
          )}
        </div>
        {isToday ? (
          <SortableList
            items={defs}
            onReorder={(ids) => reorderChain(chain.id, ids)}
            renderItem={(def) => {
              const h = items.find((it) => it.key === def.habitKey)
              return h ? habitRow(h, showStrength) : null
            }}
            disabled={pending}
          />
        ) : items.map((h) => habitRow(h, showStrength))}
      </div>
    )
  }

  return (
    <MozaikPage tone="gold">
      <PageHead onBack={() => navigate('/me')} label="‹ Én">
        <button type="button" className="mz-pgact" onClick={() => setSuggestSheet(true)}><span aria-hidden="true">✨</span> AI javaslat</button>
      </PageHead>
      <PageHero
        icon="i-hajnal" iconSize={52} big={`${doneToday} / ${totalToday}`} name="Rutin"
        sub={isToday ? (meanStrength != null ? `ma · 28 napos átlagerő ${meanStrength}%` : 'ma') : undefined}
      />
      <PageBody principle="Kimaradt nap nem törli a láncot — holnap folytatódik. A százalék a lánc 30 napos ereje, nem ítélet.">
        <EntranceGroup replayKey={date}>
          {isToday && (
            <div className="gr-covgrid rise" style={{ '--d': '0ms' } as CSSProperties}>
              <CounterTile id="gr-cells-m" spot="s-reggel" label="Reggel" count={summary.perfectMorningDays30} delayMs={120} />
              <CounterTile id="gr-cells-e" spot="s-este" label="Este" count={summary.perfectEveningDays30} evening delayMs={200} />
            </div>
          )}
          <div className="gr-daynav rise" style={{ '--d': '60ms' } as CSSProperties}>
            <DayNavigator date={date} maxDate={today} onChange={setDate} />
          </div>
          {isToday ? chains.map((c, i) => chainCard(c, true, 100 + i * 70))
            : habits.length === 0 ? <GhostState lines={2} message="Nincs rutinadat erre a napra" />
            : (
              <>
                <div className="gr-chain rise" style={{ '--d': '0ms' } as CSSProperties}>
                  <div className="gr-daysum">Reggel <b>{doneOf(morning)}/{morning.length}</b> · Este <b>{doneOf(evening)}/{evening.length}</b> · <b style={{ color: 'var(--mz-cell-sage-ink)' }}>+{earnedXp} XP</b></div>
                  {missed.map((c) => <div key={c.id} className="gr-softnote">{c.title} kimaradt — a lánc másnap folytatódott. A 30 napos erő ettől nem nullázódik.</div>)}
                </div>
                {chains.map((c, i) => chainCard(c, false, 60 + i * 70))}
              </>
            )}
          {isToday && (
            <div className="row gap-sm rise" style={{ '--d': `${chains.length * 70 + 140}ms` } as CSSProperties}>
              <button type="button" className="cta-primary" style={{ flex: 1.8 }} onClick={() => navigate('/me/rutin/uj')}>
                <Icon name="plus" size={14} /> Új szokás-recept
              </button>
              <button type="button" className="cta-ghost" style={{ flex: 1 }} onClick={() => setChainSheet({})}>
                <Icon name="plus" size={12} /> Új lánc
              </button>
            </div>
          )}
        </EntranceGroup>
      </PageBody>
      {chainSheet && <ChainEditSheet chain={chainSheet.chain} onClose={() => setChainSheet(null)} />}
      {suggestSheet && <AiSuggestSheet onClose={() => setSuggestSheet(false)} />}
    </MozaikPage>
  )
}

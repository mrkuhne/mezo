// ============================================================
// Mezo · GrowthRutinPage (mezo-rmi0.1) — /me/growth/rutin, prototype growth-tab.html
// #page-rutin ×1.18 (spec §4). Habit-domain (habit.md): RoutinesTab's hooks + rules moved
// here verbatim. Two counter tiles — 30 cells visualise the COUNTER (the summary has no daily
// bits, so no calendar mapping, no milestone pill — follow-up mezo-11nm) —, then the day
// navigator (max today) and the catalog-driven chain cards: today = ◦/✓ rows + 30-day strength
// %, past day = summary card + status-only rows; a zero chain reads "kimaradt — a lánc másnap
// folytatódott", never "megszakadt", never terracotta (ADR 0010).
// ============================================================
import type { CSSProperties } from 'react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useHabitCatalog, useHabitDay, useHabitSummary } from '@/data/hooks'
import type { HabitChainInfo, HabitDaypart, HabitItem } from '@/data/types'
import { localDateString } from '@/shared/lib/dates'
import { ClayIcon, ClaySpot, type ClaySpotName, type ClayIconName } from '@/shared/ui/clay'
import { DayNavigator } from '@/shared/ui/DayNavigator'
import { GhostState } from '@/shared/ui/GhostState'
import { MozaikPage, PageBody, PageHead, PageHero } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { cn } from '@/shared/lib/cn'

const DAYS = 30
const DAYPART_ICON: Record<HabitDaypart, ClayIconName> = { MORNING: 'i-hajnal', DAY: 'i-nap', EVENING: 'i-alvas' }
const DAYPART_WASH: Record<HabitDaypart, 'amber' | '' | 'lav'> = { MORNING: 'amber', DAY: '', EVENING: 'lav' }

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

export function GrowthRutinPage() {
  const navigate = useNavigate()
  const today = localDateString()
  const [date, setDate] = useState(today)
  const isToday = date === today
  const { habits } = useHabitDay(date)
  const { data: summary } = useHabitSummary()
  const { catalog } = useHabitCatalog()
  const strength = (key: string) => summary.habits.find((h) => h.key === key)?.strengthPct ?? null
  const chains = [...catalog.chains].filter((c) => c.isActive).sort((a, b) => a.position - b.position)
  const doneOf = (l: HabitItem[]) => l.filter((h) => h.status === 'done').length
  const morning = habits.filter((h) => h.chain === 'MORNING'), evening = habits.filter((h) => h.chain === 'EVENING')
  const earnedXp = habits.filter((h) => h.status === 'done').reduce((s, h) => s + h.xp, 0)
  const missed = chains.filter((c) => { const items = habits.filter((h) => h.chain === c.chainKey); return items.length > 0 && doneOf(items) === 0 })

  const chainCard = (chain: HabitChainInfo, showStrength: boolean, delayMs: number) => {
    const items = habits.filter((h) => h.chain === chain.chainKey)
    if (items.length === 0) return null
    const pcts = items.map((h) => strength(h.key)).filter((p): p is number => p != null)
    const avg = pcts.length ? Math.round(pcts.reduce((s, p) => s + p, 0) / pcts.length) : null
    return (
      <div key={chain.id} className={cn('gr-chain', DAYPART_WASH[chain.daypart], 'rise')} style={{ '--d': `${delayMs}ms` } as CSSProperties}>
        <div className="gr-band-top">
          <ClayIcon name={DAYPART_ICON[chain.daypart]} size={17} />
          <span className="mz-eyebrow">{chain.title}</span>
          <span className={cn('gr-band-chip', chain.daypart === 'EVENING' ? 'lav' : 'warn')}>
            {doneOf(items)} / {items.length}{showStrength && avg != null ? ` · erő ${avg}%` : ''}
          </span>
        </div>
        {items.map((h) => {
          const pct = showStrength ? strength(h.key) : null
          return (
            <div key={h.key} className={cn('gr-chainrow', h.status === 'done' && 'done', h.status !== 'done' && !isToday && 'skip')}>
              <span className="gr-ck" aria-hidden="true">✓</span>
              <span className="sr-only">{h.status === 'done' ? 'kész' : 'nyitott'}</span>
              <span className="tx">{h.title}</span>
              {showStrength && pct != null && <span className="gr-chain-pct">{pct}%</span>}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <MozaikPage tone="gold">
      <PageHead onBack={() => navigate('/me/growth')} label="‹ Growth">
        {isToday && <button type="button" className="mz-pgact" onClick={() => navigate('/me/routines/edit')}><span aria-hidden="true">✏️</span> Szerkesztés</button>}
      </PageHead>
      <PageHero icon="i-hajnal" iconSize={52} big={summary.perfectMorningDays30} name="tökéletes reggel" />
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
        </EntranceGroup>
      </PageBody>
    </MozaikPage>
  )
}

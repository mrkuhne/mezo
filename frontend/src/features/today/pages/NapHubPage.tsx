// ============================================================
// Mezo · NapHubPage — the Nap spine's Mozaik face (mezo-d20.2.1)
// Source of truth: docs/design_2.0/prototypes/nap-gerinc.html. Header recipe
// (date eyebrow · daypart switch with menu · clay bell + dropdown · orb
// avatar), then ONE hero per daypart panel + the 2-column tile mosaic.
// The day model underneath is untouched — this page reuses the Today
// feature's logic layer (dayFace, needs, quests, habits, mezoMessages) and
// opens the existing sheets; the tile → own-page deep builds are F1.2–F1.6.
// ============================================================
import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ClayIcon, ClaySpot } from '@/shared/ui/clay'
import { EntranceGroup, useCountUp } from '@/shared/ui/mozaik/motion'
import { Mosaic, Tile } from '@/shared/ui/mozaik'
import { cn } from '@/shared/lib/cn'
import { localDateString } from '@/shared/lib/dates'
import {
  useToday, useTodayScenario, resolveBriefing, useCheckins, useSleepGoal, useDailyQuests, useQuestActions,
  useHabitDay, useHabitCatalog, useFuelPreview, useFuelDay,
  useWaterActions, useSleep, useWeight, useIntentionDay, useIntentionActions,
  useCompanionFeed, useFeedback, useStackDay,
} from '@/data/hooks'
import { useNotificationFeed } from '@/data/notification/feedHooks'
import { DAY_FACES, dayFace, type DayFace } from '@/features/today/logic/dayFace'
import { useMinuteTick } from '@/features/today/logic/useMinuteTick'
import { useNeeds } from '@/features/today/logic/useNeeds'
import { NEED_META } from '@/features/today/logic/needs'
import { minsToBed } from '@/features/today/logic/windDown'
import { buildMezoMessages } from '@/features/today/logic/mezoMessages'
import { questAction } from '@/features/today/logic/questAction'
import { isFillableSlot } from '@/features/today/logic/todayItems'
import { MezoMessagesSheet } from '@/features/today/components/MezoMessagesSheet'
import { DailyQuestsSheet } from '@/features/today/components/DailyQuestsSheet'
import { CheckInSheet } from '@/features/today/sheets/CheckInSheet'
import { IntentionSheet } from '@/features/today/sheets/IntentionSheet'
import type { DailyQuest } from '@/data/types'
import type { NeedKey } from '@/features/today/logic/needs'

const isFace = (v: string | null): v is DayFace => v !== null && (DAY_FACES as readonly string[]).includes(v)

const FACE_ICON: Record<DayFace, 'i-hajnal' | 'i-nap' | 'i-alvas'> = {
  reggel: 'i-hajnal', nap: 'i-nap', este: 'i-alvas',
}
const FACE_LABEL: Record<DayFace, string> = { reggel: 'Reggel', nap: 'Nap', este: 'Este' }

function fmtHm(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = Math.round(mins % 60)
  return `${h}:${String(m).padStart(2, '0')}`
}

/** SleepEntry.duration is HOURS (7.5 → "7:30"). */
function fmtHours(hours: number): string {
  return fmtHm(Math.round(hours * 60))
}

/** The Életjel tile's segmented ring: six equal arcs, each filled to its need's level. */
function needRingGradient(states: { key: NeedKey; pct: number }[]): string {
  const stops: string[] = []
  const seg = 100 / 6
  states.forEach((s, i) => {
    const from = i * seg
    const fillTo = from + (seg * Math.max(0, Math.min(100, s.pct))) / 100
    const to = (i + 1) * seg
    stops.push(`${NEED_META[s.key].color} ${from}% ${fillTo}%`)
    if (fillTo < to) stops.push(`rgba(43,33,24,0.08) ${fillTo}% ${to}%`)
  })
  return `conic-gradient(${stops.join(', ')})`
}

export function NapHubPage() {
  const date = localDateString()
  const navigate = useNavigate()
  const [params, setSearchParams] = useSearchParams()

  const { today } = useToday()
  const scenario = useTodayScenario()
  const { goal: sleepGoal } = useSleepGoal()
  const tick = useMinuteTick()
  const nowFace = dayFace(tick, sleepGoal)
  const dpParam = params.get('dp')
  const face: DayFace = isFace(dpParam) ? dpParam : nowFace
  const setFace = (f: DayFace) => {
    const next = new URLSearchParams(params)
    if (f === nowFace) next.delete('dp')
    else next.set('dp', f)
    setSearchParams(next, { replace: true })
  }

  // ── data for heroes + tiles ─────────────────────────────────────────
  const { fuel } = useFuelDay(date)
  const { plan } = useFuelPreview()
  const { logWater } = useWaterActions(date)
  const { lastNight } = useSleep()
  const { weightLog } = useWeight()
  const latestWeight = weightLog.length > 0 ? weightLog[weightLog.length - 1] : null
  const { checkins, saveCheckIn } = useCheckins()
  const { quests, rerollsLeft } = useDailyQuests(date)
  const { reroll: rerollQuest, pending: questPending } = useQuestActions(date)
  const { habits } = useHabitDay(date)
  const { catalog: habitCatalog } = useHabitCatalog()
  const { data: intentionData } = useIntentionDay(date)
  const { addFocus } = useIntentionActions(date)
  const needs = useNeeds(tick)
  const { slots: stackSlots } = useStackDay(date)
  const { items: notifications } = useNotificationFeed()

  const feed = useCompanionFeed()
  const feedIds = useMemo(() => feed.map((m) => m.id), [feed])
  const feedback = useFeedback('feed_message', feedIds)
  const messages = useMemo(() => buildMezoMessages({ feed, demoBriefing: resolveBriefing(scenario.dayState) }), [feed, scenario.dayState])
  const intention = intentionData ?? { date, creed: null, foci: [], reflection: null }

  // ── sheet state ─────────────────────────────────────────────────────
  const [dpOpen, setDpOpen] = useState(false)
  const [ntfOpen, setNtfOpen] = useState(false)
  const [msgsOpen, setMsgsOpen] = useState(false)
  const [questsOpen, setQuestsOpen] = useState(false)
  const [focusOpen, setFocusOpen] = useState(false)
  const [checkInIdx, setCheckInIdx] = useState<number | null>(null)

  const nextCheckInIdx = checkins.findIndex(isFillableSlot)
  const openCheckIn = () => { if (nextCheckInIdx >= 0) setCheckInIdx(nextCheckInIdx) }

  const actQuest = (quest: DailyQuest) => {
    const qa = questAction(quest)
    if (!qa) return
    if (qa.kind === 'water') return logWater(qa.amountMl)
    if (qa.kind === 'checkin') { setQuestsOpen(false); return openCheckIn() }
    if (qa.kind === 'activity') return // the activity log lives behind the quick-log FAB
    return navigate(qa.to)
  }
  const questActionLabel = (quest: DailyQuest) => {
    const qa = questAction(quest)
    if (!qa || qa.kind === 'activity') return null
    if (qa.kind === 'checkin' && nextCheckInIdx < 0) return null
    return qa.label
  }

  // ── derived tile facts ──────────────────────────────────────────────
  const questsDone = quests.filter((q) => q.status === 'completed').length
  const questXpLeft = quests.filter((q) => q.status !== 'completed').reduce((s, q) => s + q.xp, 0)
  const habitsFor = (f: DayFace) => {
    const keys = new Set(
      habitCatalog.chains
        .filter((c) => (f === 'reggel' ? c.daypart === 'MORNING' : c.daypart === 'EVENING'))
        .map((c) => c.chainKey),
    )
    return habits.filter((h) => keys.has(h.chain))
  }
  const kcalLeft = Math.round(fuel.targets.kcal - fuel.consumed.kcal)
  const kcalCount = useCountUp(kcalLeft)
  const mealSlots = plan.slots.filter((s) => s.slotKey !== undefined)
  const nowWindow = mealSlots.find((s) => s.state === 'now')
  const stackTaken = stackSlots.filter((sl) => sl.entries.filter((e) => !e.skippedToday).every((e) => e.taken)).length
  const bedIn = minsToBed(tick, sleepGoal.bedTime)
  const unreadNtf = notifications.filter((n) => n.readAt === null).length

  // ── shared tiles (Mezo / Küldetések / Check-in appear on every panel) ──
  const mezoTile = (delay: number) => (
    <Tile key="mezo" wash="coral" icon="i-level" eyebrow="Mezo" delayMs={delay} dot={messages.length > 0}
      line={<span className="tile-more">Üzenetek ›</span>} onClick={() => setMsgsOpen(true)} aria-label="Mezo üzenetei" />
  )
  const questTile = (delay: number) => (
    <Tile key="quest" wash="gold" icon="i-lang" eyebrow="Küldetések" delayMs={delay}
      line={`${questsDone}/${quests.length}${questXpLeft > 0 ? ` · +${questXpLeft} XP` : ' · kész ✓'}`}
      onClick={() => setQuestsOpen(true)} aria-label="Napi küldetések" />
  )
  const checkTile = (delay: number) => (
    <Tile key="check" wash="rose" icon="i-checkin" eyebrow="Check-in" delayMs={delay}
      line={
        <span className="nap-ckdots" aria-hidden="true">
          {checkins.map((c, i) => <span key={i} className={cn('hd', c.state === 'done' && 'f')} />)}
        </span>
      }
      onClick={openCheckIn} aria-label="Check-in" />
  )
  const habitTile = (f: DayFace, delay: number) => {
    const items = habitsFor(f)
    if (items.length === 0) return null
    const done = items.filter((h) => h.status === 'done').length
    const next = items.find((h) => h.status === 'pending')
    return (
      <Tile key="habit" wash={f === 'este' ? 'lav' : 'gold'} icon="i-rend" eyebrow="Rutin" delayMs={delay}
        line={next ? `${next.title} · ${done}/${items.length}` : `kész ✓ · ${done}/${items.length}`}
        onClick={() => navigate(`/nap/rutin?dp=${f}`)}
        aria-label={f === 'este' ? 'Esti rutin' : 'Reggeli rutin'} />
    )
  }

  return (
    <div className="nap-hub">
      <div className="nap-head">
        <div className="nap-head-grow">
          <span className="mz-eyebrow">{today.dayLabel} · {today.dateLabel}</span>
        </div>
        <div className="nap-dpwrap">
          <button type="button" className="nap-roundbtn" aria-label="Napszak váltása" aria-expanded={dpOpen}
            onClick={() => setDpOpen((o) => !o)}>
            <ClayIcon name={FACE_ICON[face]} size={22} />
            {face !== nowFace && <span className="nap-offnow" aria-hidden="true" />}
          </button>
          {dpOpen && (
            <div className="nap-dpmenu" role="menu">
              {DAY_FACES.map((f) => (
                <button key={f} type="button" role="menuitem" aria-label={FACE_LABEL[f]}
                  className={cn(f === face && 'on')}
                  onClick={() => { setFace(f); setDpOpen(false) }}>
                  <ClayIcon name={FACE_ICON[f]} size={22} />
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="nap-dpwrap">
          <button type="button" className="nap-roundbtn" aria-expanded={ntfOpen}
            aria-label={unreadNtf > 0 ? `Értesítések, ${unreadNtf} olvasatlan` : 'Értesítések'}
            onClick={() => setNtfOpen((o) => !o)}>
            <ClayIcon name="i-ertesites" size={21} />
            {unreadNtf > 0 && <span className="nap-badge">{unreadNtf}</span>}
          </button>
          {ntfOpen && (
            <div className="nap-ntfmenu" role="menu">
              <span className="mz-eyebrow">Értesítések · ma</span>
              {notifications.slice(0, 3).map((n) => (
                <button key={n.id} type="button" role="menuitem" className="nap-ntfrow"
                  onClick={() => { setNtfOpen(false); if (n.deeplink) navigate(n.deeplink) }}>
                  <span className="nap-ntf-t">{n.title}</span>
                  <span className="nap-ntf-x">{n.body}</span>
                </button>
              ))}
              <button type="button" role="menuitem" className="nap-ntffoot"
                onClick={() => { setNtfOpen(false); navigate('/me/ertesitesek') }}>
                Összes értesítés ›
              </button>
            </div>
          )}
        </div>
        <button type="button" className="nap-avatar" aria-label="Profil" onClick={() => navigate('/me')}>
          <ClayIcon name="i-mezo" size={19} />
        </button>
      </div>

      <EntranceGroup replayKey={face}>
        {face === 'reggel' && (
          <>
            <div className="mz-tile mz-w-lav nap-hero rise" style={{ '--d': '0ms' } as React.CSSProperties}>
              <div className="nap-hero-row">
                <ClaySpot name="s-este" size={52} />
                <div>
                  <span className="mz-eyebrow nap-lav">Éjszakád</span>
                  <div className="nap-hero-line">
                    <span className="nap-big">{lastNight ? fmtHours(lastNight.duration) : '—'}</span>
                    {lastNight && <span className="nap-mut">minőség {lastNight.quality}/10</span>}
                  </div>
                </div>
              </div>
              <div className="nap-hero-sub">
                {latestWeight && <span className="nap-mut">Súly <b>{latestWeight.value.toLocaleString('hu-HU')} kg</b></span>}
                {intention.foci.length > 0 && <span className="nap-mut">Fókusz <b className="nap-coral">{intention.foci[0].text}</b></span>}
              </div>
            </div>
            <Mosaic>
              {mezoTile(70)}
              {habitTile('reggel', 110)}
              {questTile(150)}
              {checkTile(190)}
              <Tile wash="white" icon="i-naplo" eyebrow="Kreed" delayMs={230}
                line={intention.creed ?? 'Mi a mai szándék?'}
                onClick={() => setFocusOpen(true)} aria-label="Kreed" />
            </Mosaic>
          </>
        )}

        {face === 'nap' && (
          <>
            <div className="mz-tile mz-w-sage nap-hero rise" style={{ '--d': '0ms' } as React.CSSProperties}>
              <span className="mz-eyebrow nap-sage">Keret · ma</span>
              <div className="nap-hero-line">
                <span className="nap-big">{kcalCount}</span>
                <span className="nap-mut">kcal maradt · fehérje {Math.round(fuel.consumed.p)}/{Math.round(fuel.targets.p)} g</span>
              </div>
              <div className="daybar">
                {mealSlots.map((s, i) => (
                  <i key={i} className={cn(s.state === 'done' && 'f', s.state === 'now' && 'now')}
                    style={{ '--d': `${250 + i * 80}ms`, transform: 'scaleX(1)' } as React.CSSProperties} />
                ))}
              </div>
            </div>
            <Mosaic>
              {nowWindow && (
                <Tile wash="most" icon="i-fuel" eyebrow={`${nowWindow.label} · most`} delayMs={70}
                  line={<span className="tile-more nap-coral">Logold ›</span>}
                  onClick={() => navigate('/fuel')} aria-label={`Logold — ${nowWindow.label}`} />
              )}
              {today.workoutType && (
                <Tile wash="coral" icon="i-edzes" eyebrow="Edzés" delayMs={110}
                  line={today.workoutType} onClick={() => navigate('/train')} aria-label="Edzés" />
              )}
              <div className="mz-tile mz-w-white rise" style={{ '--d': '150ms' } as React.CSSProperties}>
                <span className="mz-eyebrow">Életjel</span>
                <div className="mz-spotwrap">
                  <div className="nap-bigring" style={{ background: needRingGradient(needs.states) }}>
                    <span className="nap-ringhole"><ClayIcon name="i-eletjel" size={18} /></span>
                  </div>
                </div>
              </div>
              <Tile wash="sky" icon="i-viz" eyebrow="Víz" delayMs={190}
                line={`${(fuel.consumed.water / 1000).toLocaleString('hu-HU', { maximumFractionDigits: 2 })} / ${(fuel.targets.water / 1000).toLocaleString('hu-HU', { maximumFractionDigits: 1 })} L · +2,5 dl`}
                onClick={() => logWater(250)} aria-label="Víz +2,5 dl" />
              <Tile wash="sage" icon="i-stack" eyebrow="Stack" delayMs={230}
                line={`${stackTaken}/${stackSlots.length}`}
                onClick={() => navigate('/fuel/stack')} aria-label="Stack" />
              {mezoTile(270)}
              {questTile(310)}
              {checkTile(350)}
            </Mosaic>
          </>
        )}

        {face === 'este' && (
          <>
            <div className="mz-tile nap-hero nap-dusk rise" style={{ '--d': '0ms' } as React.CSSProperties}>
              <div className="nap-hero-row">
                <ClaySpot name="s-napzaras" size={58} />
                <div>
                  <span className="mz-eyebrow nap-lav">Villanyoltásig</span>
                  <div className="nap-hero-line">
                    <span className="nap-big">{fmtHm(bedIn)}</span>
                    <span className="nap-mut">{sleepGoal.bedTime} lefekvés</span>
                  </div>
                </div>
              </div>
              <button type="button" className="cta nap-cta-lav" onClick={() => navigate('/ritual')}>
                Zárjuk le a napot
              </button>
            </div>
            <Mosaic>
              {habitTile('este', 70)}
              {questTile(110)}
              {checkTile(150)}
              {mezoTile(190)}
            </Mosaic>
          </>
        )}
      </EntranceGroup>

      {msgsOpen && <MezoMessagesSheet messages={messages} onClose={() => setMsgsOpen(false)} feedback={feedback} />}
      {questsOpen && (
        <DailyQuestsSheet quests={quests} rerollsLeft={rerollsLeft} pending={questPending}
          actionLabel={questActionLabel} onQuestAction={actQuest} onReroll={rerollQuest}
          onClose={() => setQuestsOpen(false)} />
      )}
      {focusOpen && <IntentionSheet creed={intention.creed} onSave={addFocus} onClose={() => setFocusOpen(false)} />}
      {checkInIdx !== null && (
        <CheckInSheet slot={checkins[checkInIdx]} slotIdx={checkInIdx}
          onClose={() => setCheckInIdx(null)} onSave={(d) => saveCheckIn(checkInIdx, d)} />
      )}
    </div>
  )
}

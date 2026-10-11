// ============================================================
// Mezo · SportPage (Sport) — Folyadék (mezo-n4wf5.3, prototype vilagos/edzes.js `sport()`,
// args `terv` · `naplo` · `cross` · `nincs` · `naplo-ures` · `cross-ures` · `tolt`).
//
// Hero: the week as seven tubes — a scheduled day holds its minutes (poured once a session
// of that day is logged, a dry ghost tube with the waterline until then), a free day is
// hatched — under the verdict „N session megvolt a M-ból ezen a héten.", three facts
// (hours, average RPE, shoulder load) and the one button „＋ Log" (the full-screen flow).
// Then the three views behind the segmented control:
//   Heti terv  — 1 the weekly rhythm (one row per slot, a free day dimmed) + the
//                independence box, 2 the one-off events with their add link;
//   Napló      — the logged sessions (SportSessionCard) in one card;
//   Cross-load — one card: Mezo's sentence, four plain tags, one row per affected area.
//
// Data, hooks, mutations and the two sheets are unchanged. A null statistic renders „—",
// never a fabricated 0; the prototype's `+XP e héten` has no wire source and is not shown.
// ============================================================
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStickyTab } from '@/shared/hooks/useStickyTab'
import { useTrain } from '@/data/hooks'
import { useLevelUp } from '@/features/progression/LevelUpProvider'
import type { SportSchedule, SportSession, CrossLoadRow as CrossLoadRowData } from '@/data/types'
import {
  Acts, Box, Btn, Card, EmptyTank, Facts, FrameBack, Hero, Lk, Msg, Note, Page, Row, Section, Seg, St, Tags, Tubes,
  type SegItem, type VialItem,
} from '@/shared/ui/folyadek'
import { DayNum } from '@/features/train/components/folyadek'
import { huMonthDayDow, localDateString } from '@/shared/lib/dates'
import { outOf } from '@/shared/lib/huText'
import { DAY_LABELS, DAY_ORDER } from '@/data/train/train'
import { dateForDayOfWeek } from '@/data/train/runningAgenda'
import type { SportEventResponse } from '@/data/train/trainApi'
import { SportSessionCard } from '@/features/train/components/SportSessionCard'
import { CrossLoadRow } from '@/features/train/components/CrossLoadRow'
import { DAY_SHORT } from '@/features/train/components/WeekdayGrid'
import { SportLogSheet } from '@/features/train/sheets/SportLogSheet'
import { SportEventSheet } from '@/features/train/sheets/SportEventSheet'
import SportSkeleton from '@/features/train/pages/SportSkeleton'
import { sportOf, SPORT_LABELS, type SportKind } from '@/features/train/logic/sportKinds'
import { sportById } from '@/features/train/logic/sports'

type SportSubView = 'week' | 'log' | 'crossload'

const SUB_VIEWS: SegItem<SportSubView>[] = [
  { key: 'week', label: 'Heti terv' },
  { key: 'log', label: 'Napló' },
  { key: 'crossload', label: 'Cross-load' },
]

/** One decimal, Hungarian comma — the prototype's `d1()`. */
const d1 = (n: number) => (Math.round(n * 10) / 10).toString().replace('.', ',')

/** A full tube stops just under the rim; the tallest session of the scale is two hours (prototype `s[3]/120*94`). */
const FULL = 94
const SCALE_MIN = 120

/** The hero's week tubes: one per weekday, from the weekly rhythm and this week's logged sessions. */
function weekTubes(schedule: SportSchedule['volleyball'], sessions: SportSession[]): VialItem[] {
  const top = Math.max(SCALE_MIN, ...DAY_ORDER.map((d) => schedule.sessions.filter((s) => s.day === d).reduce((sum, s) => sum + s.duration, 0)))
  return DAY_ORDER.map((d, i) => {
    const slots = schedule.sessions.filter((s) => s.day === d)
    if (slots.length === 0) return { label: DAY_SHORT[i], value: '–', pct: 0, hatch: true }
    const minutes = slots.reduce((sum, s) => sum + s.duration, 0)
    const iso = dateForDayOfWeek(i)
    const done = sessions.some((s) => s.isoDate === iso)
    const level = (minutes / top) * FULL
    return {
      label: DAY_SHORT[i], value: `${minutes}′`, mark: slots[0].time,
      pct: done ? level : 0, wl: done ? undefined : level, ghost: !done,
      now: slots.some((s) => s.today), icon: sportById(sportOf(slots[0]))?.art3d ?? 't-volley',
    }
  })
}

export function SportPage() {
  const navigate = useNavigate()
  const { sport, sportEvents, logSportSession, addSportEvent, deleteSportEvent, sportPending } =
    useTrain()
  const { showLevelUp } = useLevelUp()
  // Sticky so returning here restores the segment the user left from — see useStickyTab.
  const [view, setView] = useStickyTab<SportSubView>('train.sport.view', 'week')
  const [logOpen, setLogOpen] = useState(false)
  const [logInitialSport, setLogInitialSport] = useState<SportKind | undefined>(undefined)
  const [eventOpen, setEventOpen] = useState(false)
  const openLog = (initial?: SportKind) => {
    setLogInitialSport(initial)
    setLogOpen(true)
  }

  // Loading skeleton (real mode): while the sport-sessions query (sportPending) is
  // unresolved, render the layout-matched skeleton before the first render. Placed
  // after all hook calls so the hook order is render-stable.
  if (sportPending) return <SportSkeleton />

  // T3: schedule comes from the DB slots and week derives from the logged
  // sessions; only crossLoad stays null (Phase 3) — ghost-guard each facet.
  const volleyball = sport.schedule?.volleyball ?? null
  const week = sport.week

  // Verdict = logged this week out of the scheduled slots. With no schedule there is
  // nothing to be "out of" — the hero says so instead of inventing a denominator.
  const slotCount = volleyball?.sessions.length ?? 0
  const loggedThisWeek = week != null && week.sessions > 0

  return (
    <Page className="es-page es-sport">
      <FrameBack history fallback="/train" className="fo-backpill">‹ Edzés</FrameBack>
      <Hero
        label="Sport · ezen a héten"
        verdict={volleyball ? `${week?.sessions ?? 0} session megvolt a ${outOf(slotCount)} ezen a héten.` : 'Még nincs heti sport-rended.'}
        // The hero's one button opens the full-screen sport flow (mezo-88iwa.9, T8 Task 4) —
        // pick the sport, then only the fields that sport actually asks. The inline
        // "Logold ›" on a SCHEDULED slot still opens the sheet below: it carries the slot's
        // own preselected sport, which the new flow does not take yet.
        actions={<Btn onClick={() => navigate('/train/sport/log')}>＋ Log</Btn>}
      >
        {volleyball && (
          <div className="fo-hero-g">
            <Tubes items={weekTubes(volleyball, sport.sessions)} height={92} size="wk" gap={6} aria-label="A hét sportnapjai" />
          </div>
        )}
        {/* Three honest facts. A null statistic renders `—`, never a fabricated 0. */}
        <Facts items={[
          [week ? `${d1(week.hoursPlayed)} ó` : '—', 'pályán e héten'],
          [loggedThisWeek ? d1(week.avgRPE) : '—', 'RPE átlag · 1–10'],
          [loggedThisWeek ? d1(week.avgShoulderStrain) : '—', 'váll-terhelés'],
        ]} />
      </Hero>

      <Seg items={SUB_VIEWS} value={view} onChange={setView} data-kalauz-anchor="sport-tabs" />

      {view === 'week' && (
        <>
          {volleyball ? (
            <SportWeekView
              schedule={volleyball}
              loggedTodayKinds={sport.sessions
                .filter((s) => s.isoDate === localDateString())
                .map((s) => s.sport)}
              onLogSlot={openLog}
            />
          ) : (
            <>
              <Section n={1} title="Heti ritmus" />
              <Card>
                <EmptyTank icon="t-calendar"
                  actions={<Btn sm onClick={() => navigate('/settings/train/sport')}>+ Állítsd be a heti rended</Btn>}>
                  A heti rended itt jelenik majd meg.
                </EmptyTank>
              </Card>
            </>
          )}
          <SportEventsSection
            events={sportEvents}
            onAdd={() => setEventOpen(true)}
            onDelete={deleteSportEvent}
          />
        </>
      )}
      {view === 'log' && <SportLogView sessions={sport.sessions} />}
      {view === 'crossload' &&
        (sport.crossLoad ? (
          <SportCrossloadView crossLoad={sport.crossLoad} />
        ) : (
          <>
            <Section n={1} title="Keresztrendszer hatások" />
            <Card><EmptyTank icon="t-chain">A cross-load elemzés itt jelenik majd meg.</EmptyTank></Card>
          </>
        ))}

      {logOpen && (
        <SportLogSheet
          initialSport={logInitialSport}
          onClose={() => setLogOpen(false)}
          onSave={(body, done) => logSportSession(body, { onSuccess: (r) => showLevelUp(r?.levelUp), onSettled: done })}
        />
      )}
      {eventOpen && (
        <SportEventSheet
          onClose={() => setEventOpen(false)}
          onSave={(req, done) => addSportEvent(req, { onSettled: done })}
        />
      )}
    </Page>
  )
}

// === Week view: the 7-day rhythm — one row per slot, a free day a dimmed row ===
function SportWeekView({ schedule, loggedTodayKinds = [], onLogSlot }: {
  schedule: SportSchedule['volleyball']
  /** Sports already logged TODAY (mezo-i6q2b) — today's slot of such a sport swaps its
   *  „Logold ›" for a done pill. Matched by day AND sport, like the Mai hero. */
  loggedTodayKinds?: string[]
  /** Inline "Logold ›" on today's slot — preselects that slot's sport in the log sheet. */
  onLogSlot?: (initial: SportKind) => void
}) {
  return (
    <>
      <Section n={1} title={`Heti ritmus · ${d1(schedule.weeklyHours)} ó`} />
      <Card className="es-week">
        {/* Every day of the week renders — a day with no slot is the dimmed
            „nincs session" row, not an omission. */}
        {DAY_ORDER.map((d, di) => {
          const daySlots = schedule.sessions.filter((s) => s.day === d)
          const badge = <DayNum><abbr title={DAY_LABELS[d]}>{DAY_SHORT[di]}</abbr></DayNum>
          if (daySlots.length === 0) {
            return <Row key={d} className="es-day" state="dim" left={badge} title="nincs session" />
          }
          return daySlots.map((session, i) => {
            const kind = sportOf(session)
            const meta = [session.court, session.role, session.intensity].filter(Boolean)
            const logged = session.today && loggedTodayKinds.includes(kind)
            return (
              <Row
                key={`${d}-${session.time}-${i}`}
                className={session.today ? 'es-day has today' : 'es-day has'}
                left={badge}
                // The sport pill rides EVERY slot, Röpi included — it is how a row says which sport it is.
                title={(
                  <>
                    {session.time} · {session.duration}p <St>{SPORT_LABELS[kind]}</St>
                    {session.today && <> <St tone="plan">Ma</St></>}
                    {session.oneOff && <> <St>Egyszeri</St></>}
                  </>
                )}
                sub={meta.length > 0 ? meta.join(' · ') : undefined}
                right={logged
                  // mezo-i6q2b: today's slot once logged — a done pill, no CTA.
                  ? <St tone="ok">Kész</St>
                  : session.today && onLogSlot
                    ? <Lk onClick={() => onLogSlot(kind)}>Logold ›</Lk>
                    : undefined}
              />
            )
          })
        })}
        {/* The independence note — secondary copy, a quiet box under the rows. */}
        <Box icon="t-repeat" title="Heti ritmus · független">
          <p>
            A röplabda a saját heti rendjén megy, a mesociklustól függetlenül. Új mesociklus indításakor a sport
            terhelését beleszámoljuk a heti szettszámokba.
          </p>
        </Box>
      </Card>
    </>
  )
}

// === One-off events (mezo-e1sp): upcoming list + the single add entry point ===
// A saved event lands on its day in `Heti terv`/`Mai` via the trainHooks schedule
// merge; this section manages the standing list (today + future, with delete) and
// works in mock mode too (cache-emulated writes).
function SportEventsSection({ events, onAdd, onDelete }: {
  events: SportEventResponse[]
  onAdd: () => void
  onDelete: (id: string) => void
}) {
  const today = localDateString()
  const upcoming = events.filter((e) => e.date >= today)
  return (
    <>
      <Section n={2} title="Egyszeri események" />
      <Card className="es-events">
        {upcoming.map((e) => {
          // The event's sport is CHECK-constrained server-side; sportOf normalizes it
          // through the same guard every other surface uses.
          const kind = sportOf({ sport: e.sport as SportKind })
          return (
            <Row
              key={e.id}
              icon="t-calendar"
              title={<>{huMonthDayDow(e.date)} · {e.time} <St>{SPORT_LABELS[kind]}</St></>}
              sub={[`${e.durationMin}p`, e.kind === 'match' ? 'meccs' : 'edzés', e.location].filter(Boolean).join(' · ')}
              right={<Lk aria-label={`${huMonthDayDow(e.date)} esemény törlése`} onClick={() => onDelete(e.id)}>törlés</Lk>}
            />
          )
        })}
        <Acts><Lk onClick={onAdd}>＋ Egyszeri esemény</Lk></Acts>
      </Card>
    </>
  )
}

// === Session log ===
function SportLogView({ sessions }: { sessions: SportSession[] }) {
  if (sessions.length === 0) {
    return (
      <>
        <Section n={1} title="Napló" />
        <Card><EmptyTank icon="t-journal">Még nincs logolt session.</EmptyTank></Card>
      </>
    )
  }
  // Jump counts are not captured by the T3 log sheet — average only the sessions
  // that carry one, and leave the number out entirely when none do.
  const withJumps = sessions.filter((s) => s.jumpCount != null)
  const avgJumps = withJumps.length
    ? Math.round(withJumps.reduce((acc, s) => acc + (s.jumpCount ?? 0), 0) / withJumps.length)
    : null
  return (
    <>
      <Section n={1} title={`Utolsó ${sessions.length} session${avgJumps != null ? ` · átlag ${avgJumps} ugrás` : ''}`} />
      <Card className="es-logs">
        {sessions.map((s) => <SportSessionCard key={s.id} session={s} />)}
      </Card>
    </>
  )
}

// === Cross-load view: ONE card — Mezo's sentence, what it is computed from, the affected areas ===
const CROSSLOAD_INTRO =
  'A röplabda terhelését minden területen beszámítjuk: az edzés szettszámaiban, az étkezés időzítésében, ' +
  'az alvásban, a testsúly ingadozásában és a mintázatoknál.'

/** What the numbers are computed from, in plain words (the prototype's four tags). */
const CROSSLOAD_TAGS = ['28 nap sportterhelése', 'izomterhelés-átvitel', 'sport-szabály', 'célok frissítése']

function SportCrossloadView({ crossLoad }: { crossLoad: CrossLoadRowData[] }) {
  return (
    <>
      <Section n={1} title="Keresztrendszer hatások" />
      <Card className="es-cross">
        <Msg member="mezo" meta="keresztrendszer hatások">{CROSSLOAD_INTRO}</Msg>
        <Tags items={CROSSLOAD_TAGS} />
        <div className="es-vl">
          {crossLoad.map((c, i) => (
            <CrossLoadRow key={`${c.system}-${i}`} item={c} />
          ))}
        </div>
        <Note>A cross-load sosem büntet — plafont igazít és időzítést ajánl, döntést nem vesz el.</Note>
      </Card>
    </>
  )
}

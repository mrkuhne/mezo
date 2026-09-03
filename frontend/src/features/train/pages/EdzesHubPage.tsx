// ============================================================
// Mezo · EdzesHubPage — the Edzés tab's hub Mozaik face (mezo-d20.3.1)
// Source of truth: docs/design_2.0/prototypes/src/edzes-body.html hub section
// (values ×1.18). The Train shell (AppHero + SubNavDropdown) dissolves: the NINE
// sub-tabs collapse into ONE hero + SIX tiles, and the former sub-tabs are
// full-page siblings on their stable routes (they keep their current faces until
// their own F2 slices land) — the idiom the Mezo (d20.5.1) and Én (d20.6.1) hubs
// took. Sablonok folds into the Mesociklus page and the Gym muscle-zone view into
// Heti (both routes stay reachable); session/planner/builder stay full-screen.
// Anatomy: the shell fejléc (app/AppHeader.tsx, mezo-atry) → today's-session hero (clay spot +
// eyebrow + title + the companion coach line + ONE primary CTA) → the six-tile
// mosaic with live bottom lines from each page's OWN hook.
// The hero is TrainTodayPage's today logic, verbatim in its honest states:
//  · gym: completed wins (Kész · n szett → the review), else an open instance
//    (Folytassuk → · n szett kész), else the fresh Indítsuk → start;
//  · sport/run: logged renders the logged summary, unlogged offers the SAME log
//    sheets Mai owns (nothing self-completes — ADR 0010);
//  · a rest day says so and offers the Saját edzés escape hatch;
//  · with no active meso the whole hero ghosts with the wizard CTA — Mai's copy
//    verbatim; no fabricated session is ever drawn.
// The full day view (DayStrip, per-day retro logging, morning-training card)
// keeps living at /train/mai; `?day=` deep links redirect there (router).
// ============================================================
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClayIcon, ClaySpot } from '@/shared/ui/clay'
import { Mosaic, Tile } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { useMedals, useRunning, useTodayScenario, useTrain, useWeekWorkouts } from '@/data/hooks'
import { useLevelUp } from '@/features/progression/LevelUpProvider'
import { buildWeekAgenda } from '@/features/train/logic/weekAgenda'
import { daySessions } from '@/features/train/logic/agenda'
import { runSessionsForDay, todayIdx } from '@/data/train/runningAgenda'
import { SPORT_TITLES, sportOf, type SportKind } from '@/features/train/logic/sportKinds'
import { SportLogSheet } from '@/features/train/sheets/SportLogSheet'
import { RunLogSheet } from '@/features/train/sheets/RunLogSheet'
import { CustomWorkoutSheet } from '@/features/train/sheets/CustomWorkoutSheet'
import { huMonthDayDow, localDateString } from '@/shared/lib/dates'

/** The week strip's day initials (prototype: H K Sz Cs P Szo V) — DAY_ORDER's order. */
const WEEK_DOT_LABELS = ['H', 'K', 'Sz', 'Cs', 'P', 'Szo', 'V']

type RunLogCtx ={ blockId: string; weekNumber: number; sessionKey: string; label: string; isSprint: boolean; defaultRounds?: number }

export function EdzesHubPage() {
  const navigate = useNavigate()
  const scenario = useTodayScenario()
  const { showLevelUp } = useLevelUp()
  const [sportLogSport, setSportLogSport] = useState<SportKind | null>(null)
  const [runLogCtx, setRunLogCtx] = useState<RunLogCtx | null>(null)
  const [customOpen, setCustomOpen] = useState(false)

  const {
    workout, gymSchedule, sport, activeMeso, gymDoneDates, workoutPending, todaySession,
    completedTodayWorkout, logSportSession, exerciseLibrary, exerciseRecords, exercisesPending,
  } = useTrain()
  const { activeRunningBlock, runSessions, runningPending, logRunSession } = useRunning()
  const { workouts: weekWorkouts } = useWeekWorkouts()
  const { data: medals, isPending: medalsPending } = useMedals()

  const agenda = buildWeekAgenda({
    gymTimes: gymSchedule?.weeklyTimes ?? [],
    sportSlots: sport.schedule?.volleyball.sessions ?? [],
    runningBlock: activeRunningBlock,
    weekWorkouts,
  })
  // "Today" is the flagged agenda row's own date (mock pins the flag to a fixture day),
  // falling back to the wall clock when no row carries it — TrainTodayPage's rule verbatim.
  const clockIso = localDateString()
  const todayRow = agenda.find((a) => a.isToday) ?? agenda.find((a) => a.date === clockIso)
  const todayIso = todayRow?.date ?? clockIso

  const loggedSportOn = (iso: string, k: SportKind) =>
    sport.sessions.find((s) => s.sport === k && s.date === huMonthDayDow(iso)) ?? null
  const runLoggedFor = (key: string) =>
    runSessions.find(
      (r) => r.blockId === activeRunningBlock?.id && r.weekNumber === activeRunningBlock?.currentWeek && r.sessionKey === key,
    ) ?? null

  // Today's sessions in time-of-day order; runs come from the date-based lookup so a
  // run-only today still has a hero (the agenda flag only ever rides gym/sport slots).
  const ordered = daySessions({
    day: todayRow?.day ?? '',
    gym: todayRow?.gym ?? null,
    sport: todayRow?.sport ?? [],
    running: runSessionsForDay(activeRunningBlock, todayIdx()),
    custom: todayRow?.custom ?? [],
    isToday: true,
  })
  // The hero shows ONE session — the first of the day. A gym slot without the /today
  // plan cannot be drawn honestly (no title, no set count), so it steps aside.
  const heroItem = ordered.find((it) => it.kind !== 'gym' || workout != null) ?? null

  // The companion's coach line — the day plan's niggle warning, the one pre-session
  // sentence the contract actually carries (TodayPage's gate verbatim: mock-seeded AI
  // extra, absent in real mode ⇒ the line simply vanishes, never a placeholder).
  const coachLine = scenario.niggle && workout?.niggleWarning
    ? `${workout.niggleWarning.muscleLabel} · ${workout.niggleWarning.detail}`
    : null

  const openSession = () => navigate('/train/session')
  const loggedSets = todaySession?.openWorkout?.sets.filter((s) => !s.skipped).length ?? 0

  // ── hero ────────────────────────────────────────────────────────────
  let hero: React.ReactNode = null
  if (!activeMeso && !workoutPending) {
    // T0/T2 — Mai's ghost copy verbatim: nothing is invented, the wizard is the door.
    hero = (
      <div className="eh-hero eh-hero-ghost rise" data-kalauz-anchor="train-hero" style={{ '--d': '0ms' } as React.CSSProperties}>
        <div className="eh-hero-row">
          <ClaySpot name="s-piheno" size={59} />
          <div className="eh-hero-grow">
            <span className="mz-eyebrow">Edzés</span>
            <div className="eh-hero-t">Még nincs terved</div>
          </div>
        </div>
        <p className="eh-hero-ln">Itt fog élni a mai edzésed — előbb tervezz egy mesociklust.</p>
        <button type="button" className="eh-cta" onClick={() => navigate('/train/mesocycles/new')}>
          + Tervezz mesociklust
        </button>
        <button type="button" className="eh-ghostcta" onClick={() => setCustomOpen(true)}>
          ＋ Saját edzés
        </button>
      </div>
    )
  } else if (heroItem?.kind === 'gym' && workout) {
    const gym = heroItem.gym
    hero = (
      <div className="eh-hero rise" data-kalauz-anchor="train-hero" style={{ '--d': '0ms' } as React.CSSProperties}>
        <div className="eh-hero-row">
          <ClayIcon name="i-edzes" size={59} />
          <div className="eh-hero-grow">
            <span className="mz-eyebrow eh-eb-coral">
              MA{gym.time ? ` · ${gym.time}` : ''}
              {activeMeso ? ` · Meso W${activeMeso.currentWeek}/${activeMeso.weeks}` : ''}
            </span>
            <div className="eh-hero-t">{workout.title}</div>
          </div>
        </div>
        {coachLine && (
          <div className="eh-coach"><span className="dot" aria-hidden="true" /><span>{coachLine}</span></div>
        )}
        {completedTodayWorkout ? (
          <button type="button" className="eh-donebar" aria-label="Befejezett edzés áttekintése"
            onClick={() => navigate(`/train/review/${completedTodayWorkout.id}`)}>
            <b>Kész · {completedTodayWorkout.sets.filter((s) => !s.skipped).length} szett</b>
            <span>Megnézem az összegzést ›</span>
          </button>
        ) : todaySession?.openWorkout ? (
          <button type="button" className="eh-cta" onClick={openSession}>
            Folytassuk → · {loggedSets} szett kész
          </button>
        ) : (
          <button type="button" className="eh-cta" onClick={openSession}>Indítsuk →</button>
        )}
      </div>
    )
  } else if (heroItem?.kind === 'sport') {
    const vb = heroItem.sport
    const k = sportOf(vb)
    const logged = loggedSportOn(todayIso, k)
    hero = (
      <div className="eh-hero eh-hero-rose rise" data-kalauz-anchor="train-hero" style={{ '--d': '0ms' } as React.CSSProperties}>
        <div className="eh-hero-row">
          <ClayIcon name="i-sport" size={59} />
          <div className="eh-hero-grow">
            <span className="mz-eyebrow eh-eb-rose">MA{vb.time ? ` · ${vb.time}` : ''} · Sport</span>
            <div className="eh-hero-t">{SPORT_TITLES[k]}</div>
          </div>
        </div>
        {logged ? (
          <div className="eh-donebar is-static">
            <b>Kész · RPE {logged.rpe}</b>
            <span>{logged.duration} perc{logged.time ? ` · ${logged.time}-kor logolva` : ''}</span>
          </div>
        ) : (
          <button type="button" className="eh-cta" onClick={() => setSportLogSport(k)}>Logold a session-t</button>
        )}
      </div>
    )
  } else if (heroItem?.kind === 'running') {
    const s = heroItem.running
    const rl = runLoggedFor(s.key)
    hero = (
      <div className="eh-hero eh-hero-sky rise" data-kalauz-anchor="train-hero" style={{ '--d': '0ms' } as React.CSSProperties}>
        <div className="eh-hero-row">
          <ClayIcon name="i-futas" size={59} />
          <div className="eh-hero-grow">
            <span className="mz-eyebrow eh-eb-sky">MA{s.timeOfDay ? ` · ${s.timeOfDay}` : ''} · Futás</span>
            <div className="eh-hero-t">{s.label}</div>
          </div>
        </div>
        {rl ? (
          <div className="eh-donebar is-static">
            <b>Kész{rl.rpeActual != null ? ` · RPE ${rl.rpeActual}` : ''}</b>
            {rl.completedRounds != null && <span>{rl.completedRounds} kör</span>}
          </div>
        ) : (
          <button type="button" className="eh-cta" onClick={() => setRunLogCtx({
            blockId: activeRunningBlock!.id,
            weekNumber: activeRunningBlock!.currentWeek,
            sessionKey: s.key,
            label: s.label,
            isSprint: s.kind === 'sprint',
            defaultRounds: s.rounds ?? undefined,
          })}>
            Naplózd a futást
          </button>
        )}
      </div>
    )
  } else if (heroItem?.kind === 'custom') {
    const c = heroItem.custom
    hero = (
      <div className="eh-hero rise" data-kalauz-anchor="train-hero" style={{ '--d': '0ms' } as React.CSSProperties}>
        <div className="eh-hero-row">
          <ClayIcon name="i-edzes" size={59} />
          <div className="eh-hero-grow">
            <span className="mz-eyebrow eh-eb-coral">MA · Saját</span>
            <div className="eh-hero-t">{c.title}</div>
          </div>
        </div>
        <button type="button" className="eh-donebar" aria-label="Befejezett edzés áttekintése"
          onClick={() => navigate(`/train/review/${c.id}`)}>
          <b>Kész</b>
          <span>Megnézem az összegzést ›</span>
        </button>
      </div>
    )
  } else if (!workoutPending && !runningPending) {
    // An open saját instance on a slot-less day still deserves its resume affordance
    // (mezo-ws2x, Finding 4) — otherwise today is genuinely a rest day.
    const openOnRestDay = todaySession?.openWorkout && workout
    hero = (
      <div className="eh-hero rise" data-kalauz-anchor="train-hero" style={{ '--d': '0ms' } as React.CSSProperties}>
        <div className="eh-hero-row">
          <ClaySpot name={openOnRestDay ? 's-edzes' : 's-piheno'} size={59} />
          <div className="eh-hero-grow">
            <span className="mz-eyebrow">{openOnRestDay ? '● Folyamatban' : 'MA'}</span>
            <div className="eh-hero-t">{openOnRestDay ? workout.title : 'Pihenőnap'}</div>
          </div>
        </div>
        {openOnRestDay ? (
          <button type="button" className="eh-cta" onClick={openSession}>
            Folytassuk → · {loggedSets} szett kész
          </button>
        ) : (
          <>
            <p className="eh-hero-ln">Nincs tervezett edzés mára — a heti rended a Heti csempén találod.</p>
            <button type="button" className="eh-ghostcta" onClick={() => setCustomOpen(true)}>＋ Saját edzés</button>
          </>
        )}
      </div>
    )
  }

  // ── tile bottom lines — each from its page's own hook ────────────────
  // Heti: this week's planned sessions and how many are already logged (gym by date,
  // sport by date+kind, runs by session key) — the Heti page's own done-rules.
  let planned = 0
  let done = 0
  // …and the prototype's 7-dot week strip: a day is filled once every session it
  // planned is logged; today wears the amber `now` ring whether or not it is done.
  const weekDots = agenda.map((a) => {
    let dayPlanned = 0
    let dayDone = 0
    if (a.gym) { dayPlanned++; if (a.date && gymDoneDates.includes(a.date)) dayDone++ }
    for (const s of a.sport) { dayPlanned++; if (a.date && loggedSportOn(a.date, sportOf(s))) dayDone++ }
    for (const r of a.running) { dayPlanned++; if (runLoggedFor(r.key)) dayDone++ }
    planned += dayPlanned
    done += dayDone
    return { day: a.day, done: dayPlanned > 0 && dayDone === dayPlanned, now: a.date === todayIso }
  })
  const hetiLine = planned > 0 ? `${done} kész · ${planned} tervből` : undefined

  // Mesociklus: the prototype's big `W3/5` — the run's own position, nothing invented
  // when there is no active run (the tile stays a door to the library).
  const mesoLine = activeMeso ? `W${activeMeso.currentWeek}/${activeMeso.weeks}` : undefined

  const todaySportSlot = todayRow?.sport[0] ?? null
  const weekSportSlots = sport.schedule?.volleyball.sessions.length ?? 0
  const sportLine = todaySportSlot != null
    ? `Ma · ${SPORT_TITLES[sportOf(todaySportSlot)]}${todaySportSlot.time ? ` ${todaySportSlot.time}` : ''}`
    : weekSportSlots > 0
      ? `${weekSportSlots} / hét`
      : undefined

  const todayRun = runSessionsForDay(activeRunningBlock, todayIdx())[0] ?? null
  const futasLine = todayRun != null
    ? `Ma · ${todayRun.label}`
    : activeRunningBlock != null
      ? `Hét ${activeRunningBlock.currentWeek}/${activeRunningBlock.weeks}`
      : undefined

  const gyakLine = exercisesPending || exerciseLibrary.length === 0
    ? undefined
    : `${exerciseLibrary.length}${exerciseRecords.length > 0 ? ` · ${exerciseRecords.length} rekord` : ''}`

  return (
    <div className="eh-hub">
      <EntranceGroup className="mz-panel-stack">
        {hero}

        <Mosaic>
          {/* Heti wears the prototype's 7-dot week strip in place of a clay spot — the
              weekday scaffolding is a calendar fact; only the fill states carry data. */}
          <button type="button" className="mz-tile mz-w-white rise"
            style={{ '--d': '70ms' } as React.CSSProperties}
            aria-label="Heti terv" onClick={() => navigate('/train/week')}>
            <div className="mz-tile-top"><span className="mz-eyebrow">Heti</span></div>
            <div className="mz-spotwrap">
              <div className="eh-wk">
                {weekDots.map((d, i) => (
                  <span key={d.day} className="d">
                    {WEEK_DOT_LABELS[i]}
                    <i className={d.now ? 'now' : d.done ? 'f' : undefined} />
                  </span>
                ))}
              </div>
            </div>
            {hetiLine != null && <div className="mz-tile-line">{hetiLine}</div>}
          </button>
          <Tile wash="coral" icon="i-meso" eyebrow="Mesociklus" delayMs={110} className="eh-eb-coral"
            onClick={() => navigate('/train/mesocycles')} aria-label="Mesociklus">
            {mesoLine != null && <div className="eh-tbig">{mesoLine}</div>}
          </Tile>
          <Tile wash="rose" icon="i-sport" eyebrow="Sport" delayMs={150} className="eh-eb-rose"
            line={sportLine} onClick={() => navigate('/train/sport')} aria-label="Sport" />
          <Tile wash="sky" icon="i-futas" eyebrow="Futás" delayMs={190} className="eh-eb-sky"
            line={futasLine} onClick={() => navigate('/train/futas')} aria-label="Futás" />
          <Tile wash="gold" icon="i-polc" eyebrow="Gyakorlatok" delayMs={230} className="eh-eb-coral"
            line={gyakLine} onClick={() => navigate('/train/exercises')} aria-label="Gyakorlatok" />
          {/* The medal cabinet wears the spot graphic the prototype gives it (s-medal),
              so it is composed by hand instead of through Tile's clay-icon slot. */}
          <button type="button" className="mz-tile mz-w-gold rise eh-eb-gold"
            style={{ '--d': '270ms' } as React.CSSProperties}
            aria-label="Medálok" onClick={() => navigate('/train/medals')}>
            <div className="mz-tile-top"><span className="mz-eyebrow">Medálok</span></div>
            <div className="mz-spotwrap"><ClaySpot name="s-medal" size={50} /></div>
            {!medalsPending && medals.length > 0 && <div className="eh-tbig">{medals.length}</div>}
          </button>
        </Mosaic>
      </EntranceGroup>

      {customOpen && <CustomWorkoutSheet onClose={() => setCustomOpen(false)} />}
      {sportLogSport && (
        <SportLogSheet
          initialSport={sportLogSport}
          onClose={() => setSportLogSport(null)}
          onSave={(body, done2) => logSportSession(body, { onSuccess: (r) => showLevelUp(r?.levelUp), onSettled: done2 })}
        />
      )}
      {runLogCtx && (
        <RunLogSheet
          ctx={runLogCtx}
          date={todayIso}
          onClose={() => setRunLogCtx(null)}
          onSave={(body, done2) => logRunSession(body, { onSuccess: (r) => showLevelUp(r?.levelUp), onSettled: done2 })}
        />
      )}
    </div>
  )
}

// ============================================================
// Mezo · TrainWeekPage („Terhelés") — Folyadék face (mezo-n4wf5.3, slice F3).
// Prototype: docs/design_2.0/prototypes/vilagos/edzes.js `terheles()` (route
// `#w-edzes-terheles`, args `elotte` / `megvan` / `ures` / `tolt`), sheets `grp` and `info`.
// `/train/gym` renders this same page (GymPage).
//
// The page tells ONE story, top to bottom: how deep into the week you are (the tank: done
// sets of the planned ones, with the one honest sentence), where that work landed on your
// body (the map doorway), which group got how much (one row per group, each opening its
// sheet), what the sport added beside the sets, and where the rest lives (every movement,
// the mesocycle overview, the week's medals, a custom workout).
//
// Two row sets, deliberately (NOT a duplicated read):
//   · `doneRows` — the week as LOGGED. The tank, the group numbers and the group WORDS read
//     this, so nothing ever credits a session that has not happened yet.
//   · `heatRows` — the same week PLUS today's plan. Only the body needs it: without
//     `todayPlan` the 'entering' status ("today's session crosses the floor") is unreachable.
//     mapWeekHeat (loadWeek.ts) folds the two back together honestly: 'over' is kept ONLY
//     when `doneRows` alone already crosses the budget.
//
// What moved with the Folyadék face (nothing was dropped):
//   · the drawn percent → the tank's caption („szett a 75-ből · 60%"), the numeral is the
//     done sets;
//   · the hero's ⓘ „Miből áll össze a szám?" → the text link under the map doorway;
//   · the W3/6 chip → the „Mezociklus áttekintő" row; the medal chip → the medal row;
//   · the group GlassBox → the light sheet (`GroupSheetBody`), same sources: the group's own
//     heads with their planned week, the sport/run stimulus (drops, an estimate said out
//     loud) and the XP forecast.
// ============================================================
import { useId, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  useTrain, useRunning, useWeekMuscleLog, useMedals, useProgressionProfile,
} from '@/data/hooks'
import { MUSCLE_LABELS } from '@/data/train/train'
import { Sheet } from '@/shared/ui/Sheet'
import {
  Acts, Big, Card, Chev, DropsMeter, FoSheetHead, Level, LevelMarks, Lk, Note, Page, Row, Section, Tank, Txt,
  useFrameTitle,
} from '@/shared/ui/folyadek'
import { DuoBody, Mchp, deepMuscle } from '@/features/train/components/folyadek'
import { InfoButton } from '@/features/train/components/InfoButton'
import { CustomWorkoutSheet } from '@/features/train/sheets/CustomWorkoutSheet'
import { weekDateIso } from '@/features/train/logic/weekAgenda'
import { weekZoneRows } from '@/features/train/logic/weekZone'
import {
  loadGroups, loadWeekTotals, mapWeekHeat, runMinutesForWeek, sportReach, untouchedMuscles,
  type LoadGroupRow, type LoadWeek,
} from '@/features/train/logic/loadWeek'
import { heatEntries, reachRows, sharePct } from '@/features/train/logic/loadLiquid'
import { budgetGroup } from '@/features/train/logic/setBudget'
import { muscleWeekFromMeso } from '@/features/train/logic/muscleWeek'
import { sportLoadForWeek } from '@/features/train/logic/sportMuscleLoad'
import { growthForecast } from '@/features/train/logic/growthForecast'
import type { RunPrescribedSession } from '@/data/train/runningApi'
import type { MesoDay, VolleyballSession } from '@/data/types'
import TrainWeekSkeleton, { TerhelesNoPlan } from '@/features/train/pages/TrainWeekSkeleton'

/** The ONE sentence the hero says — the strongest fact that is actually true right now. */
function heroSay(totals: LoadWeek, untouchedCount: number): string {
  if (totals.plannedSets === 0) return 'Ezen a héten még nincs betervezett szett — azt a mesociklus adja meg.'
  if (totals.doneSets === 0) return 'A hét még előtted van: eddig egyetlen szett sem ment le.'
  if (totals.percent >= 100) return 'A hét munkáját letudtad — innen már a pihenés dolgozik.'
  if (untouchedCount === 0) return 'Minden izomcsoport kapott már munkát ezen a héten.'
  return `${untouchedCount} izomcsoport még munkára vár ezen a héten.`
}

/**
 * The „Miből áll össze a szám?" link under the map doorway (prototype `info` sheet, arg
 * `szam`): the explain layer's `InfoButton`, whose sheet also DRAWS the number it explains —
 * the done sets in the week's vessel.
 */
function SzamInfo({ totals }: { totals: LoadWeek }) {
  const doneLine = `${totals.doneSets} szett megvan`
  return (
    <InfoButton
      eyebrow="Terhelés"
      title="Miből áll össze a szám?"
      copy="A futó terved e heti szettjeit számoljuk: amit már elvégeztél, osztva azzal, amit a hét kér. A sport perceit külön mutatjuk — az a pihenésed része, nem a szetteké."
    >
      {/* The caption rides on the liquid only once there is enough of it to carry white text
          (bible §8.8); under that it stands below the vessel. */}
      <div className="fo-rowbar et-bar-info">
        <Level pct={totals.percent} height={22} label={totals.percent >= 45 ? doneLine : undefined} value={String(totals.plannedSets)} />
      </div>
      {totals.percent < 45 && <Note className="et-bar-cap">{doneLine}</Note>}
    </InfoButton>
  )
}

/**
 * The sheet behind a group row (prototype sheet `grp`), for THIS group only: the group's own
 * heads with their planned week, the sport/run stimulus as drops (an estimate, said out
 * loud) and the XP forecast. Owns `useProgressionProfile` itself, so the page's own mount
 * stays cheap: the query fires when the sheet opens.
 */
function GroupSheetBody({ group, days, sportSlots, runSessions, labelId, onClose }: {
  group: LoadGroupRow
  days: MesoDay[]
  sportSlots: VolleyballSession[]
  runSessions: RunPrescribedSession[]
  labelId: string
  onClose: () => void
}) {
  const { data: profile } = useProgressionProfile()
  const rows = muscleWeekFromMeso(days).filter((r) => budgetGroup(r.muscle) === group.group)
  const load = sportLoadForWeek(sportSlots, runSessions)
  const forecast = growthForecast({ days, slots: sportSlots, runSessions, athletic: profile?.athletic ?? [] })
  const groupXp = rows.reduce((total, r) => total + (forecast.muscleXp[r.muscle] ?? 0), 0)
  const anySport = rows.some((r) => (load.perMuscle[r.muscle] ?? []).length > 0)

  return (
    <>
      <FoSheetHead
        eyebrow={<span id={labelId}>{group.label} · ezen a héten</span>}
        left={<Mchp muscle={group.colorMuscle} />}
        title={`${group.doneSets} / ${group.plannedSets} szett`}
        sub={group.word}
        onClose={onClose}
      />
      <div className="fo-rowbar">
        <LevelMarks pct={sharePct(group)} color={deepMuscle(group.colorMuscle)} height={20} />
      </div>
      {rows.length === 0 ? (
        <Txt className="et-grp-none">Ezen a héten nincs rá külön gyakorlat a tervben.</Txt>
      ) : (
        <div className="et-grp-rows">
          {rows.map((r) => {
            const sources = load.perMuscle[r.muscle] ?? []
            const xp = forecast.muscleXp[r.muscle]
            return (
              <Row
                key={r.muscle}
                left={<Mchp muscle={r.muscle} sm />}
                title={MUSCLE_LABELS[r.muscle] ?? r.muscle}
                sub={`${r.workingSets} szett · ${r.repMinTotal}–${r.repMaxTotal} ismétlés · ${r.gymFrequency}×/hét — a heti tervből`}
                more={sources.length > 0 && (
                  <span className="fo-evc">
                    {sources.map((s) => (
                      <em key={s.kind}>
                        <DropsMeter n={s.load} color={deepMuscle(r.muscle)} label={`${s.load} / 3 terhelés`} />
                        {s.label.charAt(0).toUpperCase() + s.label.slice(1)}{s.count > 1 ? ` ×${s.count}` : ''}
                      </em>
                    ))}
                  </span>
                )}
                value={xp ? <>+~{xp} <small>XP</small></> : undefined}
              />
            )
          })}
        </div>
      )}
      {/* The XP forecast line always speaks — an honest "no estimate yet" beats a silent gap.
          growthForecast only earns volume XP from exercises that carry a weight anchor, so a
          plan without anchors has nothing to forecast, and says exactly that. */}
      <Note>
        {groupXp > 0
          ? `A tervezett hét ~${groupXp} XP-t hoz ennek a csoportnak — becslés; a valós XP a logolt munkából számolódik.`
          : 'XP-előrejelzés ehhez a csoporthoz még nincs — ahhoz súly-alap kell a tervben.'}
      </Note>
      {anySport && (
        <Note>A cseppek a sport és a futás plusz-terhelését jelzik — becslés, a szettszámokba nem számít bele.</Note>
      )}
    </>
  )
}

export function TrainWeekPage() {
  const {
    sport, activeMeso, workoutPending,
    workout, completedTodayWorkout,
  } = useTrain()
  const { activeRunningBlock, runningPending } = useRunning()
  const weekLog = useWeekMuscleLog()
  const { data: medals } = useMedals()
  const navigate = useNavigate()
  const [customOpen, setCustomOpen] = useState(false)
  const [openGroup, setOpenGroup] = useState<string | null>(null)
  const groupLabelId = `et-grp-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const mesoLine = activeMeso
    ? `${activeMeso.shortTitle || activeMeso.title} · ${activeMeso.currentWeek}. hét / ${activeMeso.weeks}`
    : undefined
  useFrameTitle({ title: 'Terhelés', eyebrow: mesoLine })

  // weekLog.pending must gate too (ActiveWorkoutPage.tsx :778 precedent) — without it, real
  // mode draws an empty tank and speaks "a hét még előtted van" while the (up to 7) per-day
  // detail fetches are still in flight, then jumps once they land. A loading week is not an
  // empty week.
  if (workoutPending || runningPending || weekLog.pending) return <TrainWeekSkeleton />

  if (!activeMeso) {
    return <TerhelesNoPlan label="Terhelés" verdict="A heti terhelésed itt jelenik majd meg." />
  }

  const days = activeMeso.days ?? []
  const sportSlots = sport.schedule?.volleyball.sessions ?? []
  const runSessions: RunPrescribedSession[] = activeRunningBlock
    ? (activeRunningBlock.structure.weeks[activeRunningBlock.currentWeek - 1]?.sessions ?? [])
    : []

  // See the header note: `doneRows` is the week as logged (the numbers and the words),
  // `heatRows` adds today's plan so the map can say 'entering'.
  const doneRows = weekZoneRows({ plannedDays: days, completed: weekLog.details })
  const todayPlan = !completedTodayWorkout && workout
    ? workout.exercises.map((e) => ({
      muscle: e.muscle, type: e.type, workingSets: e.workingSets, targetRIR: e.targetRIR,
    }))
    : null
  const heatRows = weekZoneRows({ plannedDays: days, completed: weekLog.details, todayPlan })

  // „sok" = the week's PLAN asks for more than the fatigue budget (`row.planBudget > 1`), a
  // property of the plan, not of the live status. LoadGroupRow deliberately does not carry
  // planBudget (it is a display row), so the set is built from the rows themselves.
  const planOverGroups = new Set(doneRows.filter((r) => r.planBudget > 1).map((r) => r.group))
  const totals = loadWeekTotals(doneRows)
  const groups = loadGroups(doneRows)
  const waiting = untouchedMuscles(doneRows)
  const heat = mapWeekHeat(doneRows, heatRows)
  const sportLoad = sportLoadForWeek(sportSlots, runSessions)
  const reach = sportReach(sportLoad)
  const reachDrops = reachRows(sportLoad)
  // Sport AND run minutes, together — a runner-only user (no volleyball/cross/TRX slots)
  // still has a whole running plan in the week; counting sportSlots alone would say
  // "0 perc sport" while reach still lists the muscles running touches.
  const sportMinutes = sportSlots.reduce((total, s) => total + (s.duration ?? 0), 0) + runMinutesForWeek(runSessions)

  // Medals earned within this Mon–Sun week (weekDateIso is ISO, so lexical comparison
  // sorts correctly) — a real, always-defined count (0 is honest).
  const weekMedalCount = medals.filter((m) => m.date >= weekDateIso(0) && m.date <= weekDateIso(6)).length
  const phase = activeMeso.phaseCurve[activeMeso.currentWeek - 1]
  const sheetGroup = groups.find((g) => g.group === openGroup) ?? null
  const hasSport = sportMinutes > 0 || reach.length > 0
  const waitingLine = waiting.length > 0
    ? `${waiting.length} izomcsoport még munkára vár ezen a héten.`
    : 'Minden izomcsoportod sorra került ezen a héten.'

  return (
    <Page className="et-page">
      <Tank
        data-kalauz-anchor="heti-terheles"
        className="et-tank"
        height={356}
        pct={totals.percent}
        num={totals.doneSets}
        cap={`szett a ${totals.plannedSets}-ből · ${totals.percent}%`}
        label={`Terhelés · ${activeMeso.currentWeek}. hét${phase ? ` · ${phase}` : ''}`}
        verdict={heroSay(totals, waiting.length)}
        marks={totals.plannedSets > 0 ? [1, 0.75, 0.5, 0.25].map((x) => Math.round(totals.plannedSets * x)) : undefined}
        cta="A tested térképe"
        onCta={() => navigate('/train/week/terkep')}
      />

      <Section n={1} title="A tested térképe" />
      <Card>
        <button type="button" className="et-mapc" onClick={() => navigate('/train/week/terkep')}>
          <span className="et-map" data-heat={heat.map((h) => `${h.token}:${h.level}`).join(' ')}>
            <DuoBody entries={heatEntries(heat, 'done')} size="sm" />
          </span>
          <span className="g">
            <strong>Elöl és hátul, ami már dolgozott</strong>
            <small>{waitingLine}</small>
          </span>
          <Chev />
        </button>
        <Acts><SzamInfo totals={totals} /></Acts>
      </Card>

      <Section n={2} title="Izomcsoportok ezen a héten" />
      <Card className="et-groups">
        {groups.map((g) => {
          const much = planOverGroups.has(g.group)
          return (
            <Row
              key={g.group}
              className="et-grp"
              chev={false}
              data-plan={much ? 'over' : undefined}
              left={<Mchp muscle={g.colorMuscle} sm />}
              // The week's plan asks for a lot here — a flag in the warn colour, never an alarm.
              title={<>{g.label}{much && <b className="et-much" title="A heti terv sok ide"> · sok</b>}</>}
              sub={g.word}
              more={<LevelMarks pct={sharePct(g)} color={deepMuscle(g.colorMuscle)} height={16} />}
              value={<>{g.doneSets} / {g.plannedSets} <small>szett</small></>}
              onClick={() => setOpenGroup(g.group)}
              aria-label={`${g.label} — ezen a héten`}
            />
          )
        })}
        <Note>Az edény széle a heti terv, a folyadék az elvégzett szett. Koppints egy csoportra a részletekért.</Note>
        <Acts>
          <InfoButton
            eyebrow="Izomcsoportok"
            title="Mit mutat a sáv?"
            copy="A színes rész az elvégzett szett, a halvány a hét teljes kérése. Egy csoportra koppintva látod, melyik része mennyit kapott."
          />
        </Acts>
      </Card>

      {hasSport && (
        <>
          <Section n={3} title="Sport a héten" />
          <Card className="et-sport">
            <Big className="et-big" value={sportMinutes} unit="perc sport és futás a heti rendben" />
            <Txt>
              {reach.length > 0
                ? `Ezeket is dolgoztatja: ${reach.join(', ')}.`
                : 'A heti rendben van sport, izomcsoportra vetítve még nincs mit mutatni.'}
            </Txt>
            {reachDrops.length > 0 && (
              <div className="et-reach">
                {reachDrops.map((r) => (
                  <Row
                    key={r.region}
                    left={<Mchp muscle={r.muscle} sm />}
                    title={r.label}
                    right={<DropsMeter n={r.load} color={deepMuscle(r.muscle)} label={`${r.label}: ${r.load} / 3 terhelés`} />}
                  />
                ))}
              </div>
            )}
            <Note>Becslés — a szettszámokba nem számít bele.</Note>
            <Acts>
              <InfoButton
                eyebrow="Sport a héten"
                title="A sport és a szettek"
                copy="A sportod a heti mozgásod és a pihenésed része — a szettszámokba nem számít bele, mert ott a terved emelkedését követjük. A regenerációnál viszont figyelembe vesszük."
              />
            </Acts>
          </Card>
        </>
      )}

      <Section n={hasSport ? 4 : 3} title="Mozgás és terv" />
      <Card>
        <Row
          icon="t-bolt"
          title="Minden mozgásod a héten"
          sub="Gym és sport együtt, eddig a héten — percek és a belőlük becsült kalória."
          onClick={() => navigate('/train/week/mozgas')}
        />
        <Row
          icon="t-layers"
          title={mesoLine}
          sub="Mezociklus áttekintő"
          onClick={() => navigate(`/train/mesocycles/${activeMeso.id}/overview`)}
        />
        <Row icon="t-record" title={`${weekMedalCount} medál e héten`} />
        <Acts><Lk onClick={() => setCustomOpen(true)}>+ Saját edzés</Lk></Acts>
        <Note>
          A terem a mesociklus szerint megy, a sport a saját heti rendjén. A kettő együtt alakítja a nap ütemét,
          az elalvást és a vacsora idejét.
        </Note>
      </Card>

      {customOpen && <CustomWorkoutSheet onClose={() => setCustomOpen(false)} />}
      {sheetGroup && (
        <Sheet className="fo-sheet et-grp-sheet" labelledBy={groupLabelId} onClose={() => setOpenGroup(null)}>
          {(close) => (
            <GroupSheetBody
              group={sheetGroup}
              days={days}
              sportSlots={sportSlots}
              runSessions={runSessions}
              labelId={groupLabelId}
              onClose={close}
            />
          )}
        </Sheet>
      )}
    </Page>
  )
}

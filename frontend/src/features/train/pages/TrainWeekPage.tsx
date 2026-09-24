// ============================================================
// Mezo · TrainWeekPage („Terhelés") — Titanium face (mezo-88iwa.13, T12 Task 3).
// Source of truth: docs/design_2.0/prototypes/companion-titanium/load-pages.js
// (`loadHero`, `mapCard`, `groupCards`, `groupGlass`, `sportCard`, `movementCard`)
// + load.css, ported onto tokens as the `.ld-` section in styles/prototype.css.
//
// The page tells ONE story, top to bottom: how deep into the week you are (the
// full-bleed hero with the DRAWN percent), where that work landed on your body
// (the map doorway), which group got how much (the group cards, each opening a
// GlassBox with its own detail), what the sport added beside the sets, and where
// every movement of the week lives (the Mozgás doorway).
//
// ---- THE DAY-STRIP FUNCTION INVENTORY (T12 spec, owner-approved) -------------
// The WeeklyDayRow strip LEFT this page. Every function it carried has a named,
// still-tested home — nothing was dropped, only moved:
//   · drill-to-day (`toMai`, `/train?day=N`)  → Mai's own DayStrip
//     (TrainTodayPage.test.tsx '?day= initialises the selection'); the `/train`
//     redirect contract stays covered by app/router.trainIndexRedirect.test.tsx.
//   · Időpontok / GymScheduleSheet            → KEPT HERE, as a hero-row chip.
//   · non-today gym → session routing         → Mai's poster CTA
//     (TrainTodayPage.test.tsx 'a non-today gym day renders … direct-start CTA').
//   · done-day → review routing               → Mai's past days
//     (TrainTodayPage.test.tsx 'a completed today instance renders the Kész hero').
//   · the `heti-terheles` kalauz anchor       → re-anchored to the hero (was
//     `heti-napok` on the day list; registry copy + anchors test moved with it).
//   · medál / StatStrip facts                 → the hero (medál chip via useMedals,
//     the one honest sentence) and the group glass (per-muscle detail + XP).
// The old LoadTiles / ZoneMiniGrid / MuscleWeekSheet surfaces retire with this
// face — their data is what the hero, the groups and the glass now draw.
//
// Two row sets, deliberately (NOT a duplicated read):
//   · `doneRows` — the week as LOGGED. The hero totals, the group numbers and the
//     group WORDS read this, so nothing ever credits a session that has not
//     happened yet (the prototype's own reading: done vs. the week's ask).
//   · `heatRows` — the same week PLUS today's plan. Only the body map needs it:
//     without `todayPlan` the 'entering' status ("today's session crosses the
//     floor") is unreachable, and the map would have no way to say it. mapWeekHeat
//     (loadWeek.ts) folds the two back together honestly: 'over' is kept ONLY when
//     `doneRows` alone already crosses the budget — the map's own caption ("ami már
//     dolgozott") must never be inflated by tonight's still-unlogged plan.
//
// ---- PAGE TONE (mezo-ju4j6.12) ----------------------------------------------
// `tone="coral"`, not the Titanium-era `tone="gold"`: every accent ON this page is
// the Train domain's coral (the hero halo, the percent bar, the group tiles), so a
// gold page ground made the screen carry two hues. Style bible A.2 rule 1 — the
// domain accent wins over the Titanium one. Behaviour unchanged; `PageTone` already
// ships `coral` and `.mz-p-coral` (prototype.css).
//
// ---- ÜVEG (mezo-me75u.4, U4 · prototype uveg-edzes.html#gym) --------------------
// The page root carries `.tw-load`; every üveg rule lives in the `uveg edzes terheles`
// block of prototype.css, scoped to it (the `ld-` family is shared with the week
// sub-pages, which slice U5 re-dresses). Ranking (bible §3.4): the hero is a FRAMELESS
// coral→lavender halo; the map doorway (lavender), each group tile (its muscle hue,
// published as `--c` on the tile itself), the sport card (rose) and the movement doorway
// (amber) are glass; chips, rows and tags inside them are flat; „+ Saját edzés" is the
// dashed free state. Icons are the Titanium 3D set (t-info, t-record, t-volley, t-bolt,
// t-coin) — `i-erme` here means the week's MEDALS, hence t-record, not the coin.
// ============================================================
import { useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  useTrain, useRunning, useWeekMuscleLog, useMedals, useProgressionProfile,
} from '@/data/hooks'
import { MUSCLE_LABELS } from '@/data/train/train'
import { GhostState } from '@/shared/ui/GhostState'
import { MozaikPage, PageBody } from '@/shared/ui/mozaik'
import { GlassBox } from '@/shared/ui/mozaik/GlassBox'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { Icon3D } from '@/shared/ui/clay'
import { BodyMap } from '@/features/train/components/BodyMap'
import { MuscleChip } from '@/features/train/components/MuscleChip'
import { InfoButton } from '@/features/train/components/InfoButton'
import { CustomWorkoutSheet } from '@/features/train/sheets/CustomWorkoutSheet'
import { weekDateIso } from '@/features/train/logic/weekAgenda'
import { weekZoneRows } from '@/features/train/logic/weekZone'
import {
  loadGroups, loadWeekTotals, mapWeekHeat, runMinutesForWeek, sportReach, untouchedMuscles,
  type LoadGroupRow, type LoadWeek,
} from '@/features/train/logic/loadWeek'
import { budgetGroup } from '@/features/train/logic/setBudget'
import { muscleColor } from '@/features/train/logic/muscleColors'
import { muscleWeekFromMeso } from '@/features/train/logic/muscleWeek'
import { sportLoadForWeek } from '@/features/train/logic/sportMuscleLoad'
import { growthForecast } from '@/features/train/logic/growthForecast'
import type { RunPrescribedSession } from '@/data/train/runningApi'
import type { MesoDay, VolleyballSession } from '@/data/types'
import TrainWeekSkeleton from '@/features/train/pages/TrainWeekSkeleton'

/** The ONE sentence the hero says — the strongest fact that is actually true right now. */
function heroSay(totals: LoadWeek, untouchedCount: number): string {
  if (totals.plannedSets === 0) return 'Ezen a héten még nincs betervezett szett — azt a mesociklus adja meg.'
  if (totals.doneSets === 0) return 'A hét még előtted van: eddig egyetlen szett sem ment le.'
  if (totals.percent >= 100) return 'A hét munkáját letudtad — innen már a pihenés dolgozik.'
  if (untouchedCount === 0) return 'Minden izomcsoport kapott már munkát ezen a héten.'
  return `${untouchedCount} izomcsoport még munkára vár ezen a héten.`
}

/** done / planned as a bar width — never fabricated: no plan and no work is a 0% bar. */
function shareOf(row: { doneSets: number; plannedSets: number }): number {
  if (row.plannedSets > 0) return Math.round(Math.min(1, row.doneSets / row.plannedSets) * 100)
  return row.doneSets > 0 ? 100 : 0
}

/**
 * The glass behind a group card — the migrated MuscleWeekSheet content, for THIS group only:
 * the group's own heads with their planned week, the sport/run stimulus chips (an estimate,
 * said out loud) and the XP forecast. Owns `useProgressionProfile` itself, exactly as the
 * retired sheet did, so the page's own mount stays cheap: the query fires when the glass opens.
 */
function GroupGlassBody({ group, days, sportSlots, runSessions }: {
  group: LoadGroupRow
  days: MesoDay[]
  sportSlots: VolleyballSession[]
  runSessions: RunPrescribedSession[]
}) {
  const { data: profile } = useProgressionProfile()
  const rows = muscleWeekFromMeso(days).filter((r) => budgetGroup(r.muscle) === group.group)
  const load = sportLoadForWeek(sportSlots, runSessions)
  const forecast = growthForecast({ days, slots: sportSlots, runSessions, athletic: profile?.athletic ?? [] })
  const groupXp = rows.reduce((total, r) => total + (forecast.muscleXp[r.muscle] ?? 0), 0)
  const anySport = rows.some((r) => (load.perMuscle[r.muscle] ?? []).length > 0)

  return (
    <div
      className="ld-glass tw-glass"
      style={{ '--mus-color': muscleColor(group.colorMuscle).rail, '--c': muscleColor(group.colorMuscle).rail } as CSSProperties}
    >
      <div className="ld-glass-hero">
        <strong>{group.doneSets}</strong>
        <small>/ {group.plannedSets} szett</small>
      </div>
      <p className="ld-glass-word">{group.word}</p>
      {rows.length === 0 ? (
        <p className="ld-glass-empty">Ezen a héten nincs rá külön gyakorlat a tervben.</p>
      ) : (
        <div className="ld-glass-rows">
          {rows.map((r) => {
            const sources = load.perMuscle[r.muscle] ?? []
            const xp = forecast.muscleXp[r.muscle]
            return (
              <div key={r.muscle} className="ld-glass-row">
                <span className="tw-well"><MuscleChip token={r.muscle} size={26} /></span>
                <span className="ld-glass-name">
                  <strong>{MUSCLE_LABELS[r.muscle] ?? r.muscle}</strong>
                  <small>
                    {r.workingSets} szett · {r.repMinTotal}–{r.repMaxTotal} ismétlés · {r.gymFrequency}×/hét — a heti tervből
                  </small>
                  {sources.length > 0 && (
                    <span className="ld-glass-chips">
                      {sources.map((s) => (
                        <span key={s.kind}>
                          {'▲'.repeat(s.load)} {s.label}{s.count > 1 ? ` ×${s.count}` : ''}
                        </span>
                      ))}
                    </span>
                  )}
                </span>
                {xp ? <b className="ld-glass-xp"><Icon3D name="t-coin" size={20} />+~{xp} XP</b> : null}
              </div>
            )
          })}
        </div>
      )}
      {/* The XP forecast line always speaks — an honest "no estimate yet" beats a silent gap.
          growthForecast only earns volume XP from exercises that carry a weight anchor, so a
          plan without anchors has nothing to forecast, and says exactly that. */}
      <p className="ld-glass-foot">
        {groupXp > 0
          ? `A tervezett hét ~${groupXp} XP-t hoz ennek a csoportnak — becslés; a valós XP a logolt munkából számolódik.`
          : 'XP-előrejelzés ehhez a csoporthoz még nincs — ahhoz súly-alap kell a tervben.'}
      </p>
      {anySport && (
        <p className="ld-glass-foot">
          ▲ = sport/futás plusz-stimulus — becslés, a szettszámokba nem számít bele.
        </p>
      )}
    </div>
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

  // weekLog.pending must gate too (ActiveWorkoutPage.tsx :778 precedent) — without it, real
  // mode draws a 0% hero and speaks "a hét még előtted van" while the (up to 7) per-day
  // detail fetches are still in flight, then jumps once they land. A loading week is not an
  // empty week.
  if (workoutPending || runningPending || weekLog.pending) return <TrainWeekSkeleton />

  if (!activeMeso) {
    return (
      <MozaikPage tone="coral">
        <PageBody>
          <GhostState lines={3} message="A heti terhelésed itt jelenik majd meg — előbb tervezz egy mesociklust."
            ctaLabel="+ Tervezz mesociklust" onCta={() => navigate('/train/mesocycles/new')} />
        </PageBody>
      </MozaikPage>
    )
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

  // „sok" = the week's PLAN asks for more than the fatigue budget — verbatim the meaning the
  // retired ZoneMiniGrid's ⚠ carried (`row.planBudget > 1`, ZoneMiniGrid.tsx), which is a
  // property of the plan, not of the live status. LoadGroupRow deliberately does not carry
  // planBudget (it is a display row), so the set is built from the rows themselves.
  const planOverGroups = new Set(doneRows.filter((r) => r.planBudget > 1).map((r) => r.group))
  const totals = loadWeekTotals(doneRows)
  const groups = loadGroups(doneRows)
  const waiting = untouchedMuscles(doneRows)
  const heat = mapWeekHeat(doneRows, heatRows)
  const reach = sportReach(sportLoadForWeek(sportSlots, runSessions))
  // Sport AND run minutes, together — a runner-only user (no volleyball/cross/TRX slots)
  // still has a whole running plan in the week; counting sportSlots alone would say
  // "0 perc sport" while reach still lists the muscles running touches.
  const sportMinutes = sportSlots.reduce((total, s) => total + (s.duration ?? 0), 0) + runMinutesForWeek(runSessions)

  // Medals earned within this Mon–Sun week (weekDateIso is ISO, so lexical comparison
  // sorts correctly) — a real, always-defined count (0 is honest).
  const weekMedalCount = medals.filter((m) => m.date >= weekDateIso(0) && m.date <= weekDateIso(6)).length
  const phase = activeMeso.phaseCurve[activeMeso.currentWeek - 1]
  const glassGroup = groups.find((g) => g.group === openGroup) ?? null

  return (
    <MozaikPage tone="coral" className="tw-load">
      <EntranceGroup>
        {/* The hero is a DIRECT child of .mz-page, which already pulls itself out of the
            scroller's --screen-gutter — that is the whole full-bleed recipe, no new
            negative-margin invention (prototype.css :4558). */}
        <header className="ld-hero rise" data-kalauz-anchor="heti-terheles" style={{ '--d': '40ms' } as CSSProperties}>
          <span className="ld-hero-art">
            <BodyMap heat={heat} views="auto" className="ld-hero-body" ariaLabel="A heti terhelésed a testeden" />
          </span>
          <div className="tw-hero-main">
            <span className="ld-eyebrow">
              Terhelés · {activeMeso.currentWeek}. hét{phase ? ` · ${phase}` : ''}
            </span>
            {/* The percent is DRAWN, not spelled out: a big numeral plus a bar that grows on
                reveal. A bare text percentage would be the one thing the prototype forbids. */}
            <div className="ld-hero-pct"><b>{totals.percent}</b><em>%</em></div>
            <p className="ld-hero-sub">
              a heti munkádból megvan — <b>{totals.doneSets}</b> szett a {totals.plannedSets}-ből
            </p>
            <div className="ld-hero-bar">
              <i style={{ '--w': `${totals.percent}%` } as CSSProperties} />
            </div>
            <p className="ld-hero-say">
              <span>{heroSay(totals, waiting.length)}</span>
              <InfoButton
                icon="t-info"
                title="Miből áll össze a szám?"
                copy="A futó terved e heti szettjeit számoljuk: amit már elvégeztél, osztva azzal, amit a hét kér. A sport perceit külön mutatjuk — az a pihenésed része, nem a szetteké."
              />
            </p>
            <div className="ld-hero-chips">
              <button
                type="button"
                className="mz-pgact tw-chip"
                onClick={() => navigate(`/train/mesocycles/${activeMeso.id}/overview`)}
                aria-label={`Mezociklus áttekintő · W${activeMeso.currentWeek}/${activeMeso.weeks}`}
              >
                W{activeMeso.currentWeek}/{activeMeso.weeks} ›
              </button>
              <span className="ld-hero-medal tw-chip">
                <Icon3D name="t-record" size={18} />
                {weekMedalCount} medál e héten
              </span>
            </div>
          </div>
        </header>

        <PageBody>
          <button
            type="button"
            className="ld-map-card glass rise"
            style={{ '--d': '110ms' } as CSSProperties}
            onClick={() => navigate('/train/week/terkep')}
          >
            <BodyMap heat={heat} views="both" className="ld-map-mini" ariaLabel="Elöl és hátul: a hét terhelése" />
            <span className="ld-map-copy">
              <span className="uv-eyebrow tw-eb">A tested térképe</span>
              <strong>Elöl és hátul, ami már dolgozott</strong>
              <small>
                {waiting.length > 0
                  ? `${waiting.length} izomcsoport még munkára vár ezen a héten.`
                  : 'Minden izomcsoportod sorra került ezen a héten.'}
              </small>
            </span>
            <b aria-hidden="true">›</b>
          </button>

          <h3 className="ld-h3">
            Izomcsoportok ezen a héten
            <InfoButton
              icon="t-info"
              title="Mit mutat a sáv?"
              copy="A színes rész az elvégzett szett, a halvány a hét teljes kérése. Egy csoportra koppintva látod, melyik része mennyit kapott, és melyik napokon."
            />
          </h3>
          <div className="ld-groups">
            {groups.map((g, i) => (
              <button
                key={g.group}
                type="button"
                className="ld-group glass rise"
                data-plan={planOverGroups.has(g.group) ? 'over' : undefined}
                style={{
                  '--mus-color': muscleColor(g.colorMuscle).rail,
                  // the glass's one accent, published on the element that wears it (bible rule 4)
                  '--c': muscleColor(g.colorMuscle).rail,
                  '--i': i,
                  '--d': `${160 + i * 40}ms`,
                } as CSSProperties}
                onClick={() => setOpenGroup(g.group)}
                aria-label={`${g.label} — ezen a héten`}
              >
                <span className="ld-group-head">
                  <span className="tw-well"><MuscleChip token={g.colorMuscle} size={26} /></span>
                  <strong>{g.label}</strong>
                  {/* The week's plan asks for a lot here — a flag in the house amber, never a
                      red alarm (the retired ZoneMiniGrid's ⚠ said the same thing in a glyph). */}
                  {planOverGroups.has(g.group) && (
                    <span className="ld-group-much" title="A heti terv sok ide">sok</span>
                  )}
                </span>
                <b className="tw-group-num">{g.doneSets} / {g.plannedSets} <small>szett</small></b>
                <span className="ld-group-bar">
                  <i style={{ '--w': `${shareOf(g)}%` } as CSSProperties} />
                </span>
                <small className="ld-group-note">{g.word}</small>
              </button>
            ))}
          </div>

          {(sportMinutes > 0 || reach.length > 0) && (
            <>
              <section className="ld-sport glass rise" style={{ '--d': '380ms', '--i': groups.length } as CSSProperties}>
                <span className="ld-sport-art"><Icon3D name="t-volley" size={40} /></span>
                <span className="ld-sport-copy">
                  <span className="uv-eyebrow tw-eb">Sport a héten</span>
                  <strong>{sportMinutes} perc sport és futás a heti rendben</strong>
                  <small>
                    {reach.length > 0
                      ? `Ezeket is dolgoztatja: ${reach.join(', ')}.`
                      : 'A heti rendben van sport, izomcsoportra vetítve még nincs mit mutatni.'}
                  </small>
                  <em>Becslés — a szettszámokba nem számít bele.</em>
                </span>
                {/* The ⓘ sits INSIDE the sport card, as the prototype's sportCard()
                    inlines it (load-pages.js:95). Its art override there is `volley` —
                    in üveg it is the Titanium t-volley itself, the card's own glyph. */}
                <InfoButton
                  icon="t-volley"
                  title="A sport és a szettek"
                  copy="A sportod a heti mozgásod és a pihenésed része — a szettszámokba nem számít bele, mert ott a terved emelkedését követjük. A regenerációnál viszont figyelembe vesszük."
                />
              </section>
            </>
          )}

          <button
            type="button"
            className="ld-move-card glass rise"
            style={{ '--d': '410ms', '--i': groups.length + 1 } as CSSProperties}
            onClick={() => navigate('/train/week/mozgas')}
          >
            <span className="ld-sport-art"><Icon3D name="t-bolt" size={40} /></span>
            <span className="ld-map-copy">
              <span className="uv-eyebrow tw-eb">Mozgás</span>
              <strong>Minden mozgásod a héten</strong>
              <small>Gym és sport együtt, eddig a héten — percek és a belőlük becsült kalória.</small>
            </span>
            <b aria-hidden="true">›</b>
          </button>

          <button
            type="button"
            onClick={() => setCustomOpen(true)}
            className="uv-empty tw-custom rise"
            style={{ '--d': '440ms' } as CSSProperties}
          >
            + Saját edzés
          </button>

          <div className="ld-note rise" style={{ '--d': '470ms' } as CSSProperties}>
            <p>
              A gym a mesociklus szerint, a sport (röpi/cross/TRX) recurring · független. A két ütemterv
              együtt-mozgatja a pacing-et, alvás-onsetet és a vacsora-időt.
            </p>
          </div>
        </PageBody>
      </EntranceGroup>

      {customOpen && <CustomWorkoutSheet onClose={() => setCustomOpen(false)} />}
      <GlassBox
        open={glassGroup !== null}
        onClose={() => setOpenGroup(null)}
        label={glassGroup ? `${glassGroup.label} · ezen a héten` : ''}
        tint={glassGroup ? muscleColor(glassGroup.colorMuscle).rail : undefined}
      >
        {glassGroup && (
          <GroupGlassBody group={glassGroup} days={days} sportSlots={sportSlots} runSessions={runSessions} />
        )}
      </GlassBox>
    </MozaikPage>
  )
}

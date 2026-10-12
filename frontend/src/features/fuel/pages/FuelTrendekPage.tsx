// ============================================================
// Mezo · Fuel Trendek (S0 váz: mezo-o6uv · tartalom: Fuel Titanium S3, mezo-83g0).
// A jóváhagyott negyedik Fuel-cél: „Jól ment a hetem?"
//
// Folyadék (mezo-n4wf5.5, prototype vilagos/fuel.js `trendek()` + `weekVM` / `weekVes` / `seriesG`, lap `day`):
//   a hét-váltó (a hős vezérlője: a hősnek NINCS gombja) →
//   a HŐS: „N / 7 naplózott nap", a hét hét edénye (a szint az evés, a szaggatott vonal a nap kerete, a szám a nap
//     étkezés-pontja; a hétvége két edénye más alapot kap), a jelmagyarázat, alatta a SEMLEGES heti olvasat →
//   1 · A hét számai — három sima csempe (napi átlag · minőség · heti súlyátlag), szint nélkül; a változás csak a
//     nyitott héten áll alattuk: irány és mennyiség, se jó, se rossz szín →
//   2 · Hétköznap és hétvége — két közlekedőedény a kerethez mért átlaggal, a vonal a keret →
//   3 · Hosszabb táv — a heti súlyátlag (napi mérésekkel, a súlycél vízvonalával) és a heti átlag kalória (FuelHorizon) →
//   4 · Mintázatok — HIVATKOZÁSOK a kanonikus Mezo-elemre; felismerés nélkül a szakasz nincs.
//
// SZÉGYENMENTES — ez a ház legkockázatosabb felülete: a keret FELETT járó nap más SZÍNT kap, de
// soha nem hibaállapotot, és egyetlen szó sem osztályozza a felhasználót. A gyéren naplózott hét
// őszintén van leírva, nem „bukásként" pontozva. A hang: „így alakult".
// ŐSZINTE-NULL: a nem naplózott nap nem nulla — kimarad minden átlagból, és üres edényként
// rajzolódik; ha a heti átlagok nullok, a csempék „—"-t írnak. A kímélő nap nincs a kerethez mérve.
//
// ADATFORRÁS, új backend nélkül:
//   • a hét keretei/fogyása: `useFuelWeek()` 7 napos rollupja (+ a C2 két átlaga),
//   • a NAP AI PONTJA: a MEGLÉVŐ hat dimenziós napi értékelés (`MeWeekDay.subscores`), a `useMeWeek` heti
//     rollupon keresztül — ez a lap NEM számol új pontszámot,
//   • az edzésnap (C6): ugyanonnan, `MeWeekDay.workoutCount > 0`,
//   • a napi súlymérések: `useWeight().weightLog`; a súlycél: `useGoal()` (cél nélkül nincs vízvonal).
// C5: a coach-történet cache-only — ez a lap csak OLVAS, étkezés-coach generálást nem indít.
// ============================================================
import { SafeMarkdown } from '@/shared/lib/safeMarkdown'
import { useId, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useFuelWeek, useFuelWeekRollup, mondayIso } from '@/data/fuel/fuelWeekHooks'
import { useMeWeek } from '@/data/me/meWeekHooks'
import { useFuelHorizon } from '@/data/fuel/fuelHorizonHooks'
import { useFuelDay } from '@/data/fuel/fuelHooks'
import { useWeight } from '@/data/me/weightHooks'
import { useGoal } from '@/data/me/goalHooks'
import { usePatterns } from '@/data/insights/patternsHooks'
import type { FuelWeekDay } from '@/data/fuel/mealApi'
import { addDays } from '@/shared/lib/dates'
import { fmtGrouped } from '@/shared/lib/format'
import { useM } from '@/shared/i18n'
import { Icon3D } from '@/shared/ui/clay'
import { Card, Hero, Lab, Note, Page, Row, Section, Stat, StatGrid, Txt, useFrameTitle } from '@/shared/ui/folyadek'
import { Lgd, MACRO_COLOR, type LgdKind } from '@/features/fuel/components/folyadek'
import { FuelHorizon, horizonNeedsMoreWeeks } from '@/features/fuel/components/FuelHorizon'
import { FuelWeekDayGlass } from '@/features/fuel/components/FuelWeekDayGlass'
import { fuelPatternRefs } from '@/features/fuel/logic/fuelPatternRefs'
import { mealDisplayName } from '@/features/fuel/logic/mealDisplayName'
import { hhmmFromLoggedAt } from '@/features/fuel/logic/buildDayPlan'
import {
  buildWeekView, dayTitle, fixed1, loggedKcalAvg, mealDayScore, weekDeltas, weekRangeTitle, type WeekDayVM, type WeekDelta,
} from '@/features/fuel/logic/fuelWeekView'

/** A hét hét edénye (prototípus `weekVes`): a szint az evés, a szaggatott vonal a nap kerete, a szám a nap étkezés-pontja.
 *  A magasság a hét legnagyobb értékéhez van skálázva. A keret FELETTI rész más színű sáv a vonal fölött — állapot, nem hiba.
 *  Kímélő napon nincs keret-vonal és nincs pont (a jele áll ott); a még hátralévő és a nem naplózott nap üres edény. */
function WeekVessels({ days, max, disabled, onOpen }: { days: WeekDayVM[]; max: number; disabled?: boolean; onOpen: (date: string) => void }) {
  const M = useM()
  const W = M.fuelTrendek.week
  const h = (v: number) => `${((v / max) * 100).toFixed(1)}%`
  return (
    // A18/E11 (mezo-qt5q): a Kalauz „Mutasd meg a képernyőn" gombja erre a sávra mutat — a heti kép feltétel
    // nélkül renderel, tehát a horgony sosem tűnik el.
    <div className="fr-wk" role="group" aria-label={W.aria} data-kalauz-anchor="trendek-heti">
      {days.map((day) => {
        const name = dayTitle(day.date)
        const score = day.dayScore == null ? null : fixed1(day.dayScore)
        const aria = day.recovery
          ? W.dayRecovery(name)
          : day.logged
            ? (day.targetKcal == null
              ? W.dayLoggedNoTarget(name, fmtGrouped(day.kcal!), score)
              : W.dayLogged(name, fmtGrouped(day.kcal!), fmtGrouped(day.targetKcal), score))
            : day.future ? W.dayFuture(name) : W.dayEmpty(name)
        const level = day.logged ? (day.recovery || day.targetKcal == null ? day.kcal! : Math.min(day.kcal!, day.targetKcal)) : null
        const cls = ['fr-wd', !day.logged && !day.recovery && 'gap', day.weekend && 'we', day.recovery && 'rec', day.today && 'on',
          day.over && 'over', day.future && !day.logged && 'fut'].filter(Boolean).join(' ')
        return (
          <button key={day.date} type="button" className={cls} aria-label={aria} disabled={disabled} onClick={() => onOpen(day.date)}>
            <em aria-hidden="true">{day.recovery ? <Icon3D name="t-kimelo" size={16} /> : score ?? '·'}</em>
            <span className="fr-tb" aria-hidden="true">
              {level != null && <i style={{ height: h(level) }} />}
              {day.over && day.targetKcal != null && (
                <s style={{ bottom: h(day.targetKcal), height: h(day.kcal! - day.targetKcal) }} />
              )}
              {!day.recovery && day.targetKcal != null && <u style={{ bottom: h(day.targetKcal) }} />}
            </span>
            <b aria-hidden="true">{day.label}</b>
            <small className={day.training ? 'tr' : undefined} aria-hidden="true" />
          </button>
        )
      })}
    </div>
  )
}

/** A hős jelmagyarázata (prototípus `lgd`): a közös `Lgd`, a hét saját jeleivel (`we` / `rec` / `trd`). */
function WeekLegend({ days }: { days: WeekDayVM[] }) {
  const L = useM().fuelTrendek.legend
  const any = (f: (d: WeekDayVM) => boolean) => days.some(f)
  const items: Array<[LgdKind, string]> = [
    ['liq', L.eaten],
    ['line', L.budget],
    ...(any((d) => d.over) ? [['over', L.over] as [LgdKind, string]] : []),
    ...(any((d) => !d.logged && !d.recovery) ? [['gap', L.noData] as [LgdKind, string]] : []),
    ...(any((d) => d.recovery) ? [['rec', L.recovery] as [LgdKind, string]] : []),
    ['we', L.weekend],
    ...(any((d) => d.training) ? [['trd', L.training] as [LgdKind, string]] : []),
  ]
  return <Lgd center className="fr-lg" items={items} />
}

/** Két közlekedőedény (prototípus `linked` + a keret vonala): a naplózott, nem kímélő napok kerethez mért átlaga
 *  hétköznap és hétvégén, 130%-os léptékben; a szaggatott vonal a keret (100%). Adat nélkül az edény ÜRES, nem nulla
 *  szintű. Helyi darab: a kit `Linked`-je nem ismer vonalat és üres edényt. */
function WeekSplit({ weekdayPct, weekendPct }: { weekdayPct: number | null; weekendPct: number | null }) {
  const id = 'frlk' + useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const S = useM().fuelTrendek.split
  const text = (v: number | null) => (v == null ? '—' : `${Math.round(v)}%`)
  const y = (v: number) => 96 - Math.max(0, Math.min(100, v / 1.3)) * 0.74
  const yBudget = (96 - (100 / 1.3) * 0.74).toFixed(1)
  const liq = (x: number, top: number) => <path fill={`url(#${id})`} d={`M${x} ${top} q7.75 -4.5 15.5 0 t15.5 0 t15.5 0 t15.5 0 V112 H${x}Z`} />
  const glass = (x: number) => (
    <>
      <rect x={x} y="12" width="62" height="86" rx="28" fill="none" stroke="rgba(10,42,60,.12)" strokeWidth="2" />
      <path d={`M${x + 11} 34 q2 -11 12 -13`} fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity=".9" />
    </>
  )
  return (
    <div className="fr-lk">
      <svg className="fr-linked" viewBox="0 0 220 124" role="img" aria-label={S.aria(text(weekdayPct), text(weekendPct))}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--liq1)" /><stop offset="1" stopColor="var(--liq2)" /></linearGradient>
          <clipPath id={`${id}a`}><rect x="16" y="12" width="62" height="86" rx="28" /></clipPath>
          <clipPath id={`${id}b`}><rect x="142" y="12" width="62" height="86" rx="28" /></clipPath>
        </defs>
        <rect x="64" y="80" width="92" height="9" rx="4.5" fill="var(--liq2)" opacity=".35" />
        <rect x="16" y="12" width="62" height="86" rx="28" fill="#fff" />
        <rect x="142" y="12" width="62" height="86" rx="28" fill="#fff" />
        {weekdayPct != null && <g className="is-weekday" clipPath={`url(#${id}a)`}>{liq(16, y(weekdayPct))}</g>}
        {weekendPct != null && <g className="is-weekend" clipPath={`url(#${id}b)`}>{liq(142, y(weekendPct))}</g>}
        {glass(16)}{glass(142)}
        <text x="47" y="116" textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--fo-ink)">{`${S.weekdays} · ${text(weekdayPct)}`}</text>
        <text x="173" y="116" textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--fo-ink)">{`${S.weekend} · ${text(weekendPct)}`}</text>
        <path d={`M8 ${yBudget}H212`} stroke="var(--fo-ink)" strokeWidth="1" strokeDasharray="3 4" opacity=".5" />
        <text x="110" y={(Number(yBudget) - 4).toFixed(1)} textAnchor="middle" fontSize="9" fill="var(--fo-sub)">{S.budget}</text>
      </svg>
    </div>
  )
}

/**
 * A hét-váltó URL-értéke. FIGYELEM — ez a lap SAJÁT `?w=` paramétere: a MEGJELENÍTETT HETET
 * választja ki (`?w=elozo` = a múlt hét), hogy a nézet linkelhető legyen és újratöltés után is
 * megmaradjon. NEM azonos a logoló lapok `?w=` paraméterével, ami egy napon BELÜLI étkezés-ablak
 * kulcsa (`fuelSwimlane.tileKey`). A két jelentés véletlenül ugyanazt a betűt kapta: ne vonjuk
 * össze őket, és ne hívjuk itt a `tileKey`-t.
 */
const WEEK_PARAM = 'w'
const PREV_WEEK_VALUE = 'elozo'

/**
 * C5 (mezo-83g0): a nap étkezései a nyitott lapon — a MEGLÉVŐ napi olvasásból (`useFuelDay`).
 *
 * FETCH-FEGYELEM: ez a komponens KIZÁRÓLAG a nyitott doboz belsejében van beillesztve, tehát a
 * napi kérés a doboz megnyitásakor indul — nem hét nappal előre, és naplózatlan napon soha (a
 * doboz naplózatlan ágai a gyerekeket el sem renderelik).
 *
 * C5 MÁSODIK fele: a coach-TÖRTÉNET cache-only. Ez a lista a napot OLVASSA; étkezés-coach
 * verdiktet nem kér és nem generál. Az étkezés pontja csak akkor látszik, ha a napi válasz MÁR
 * hordozza — különben egyszerűen nem áll ott semmi, nem nulla és nem „folyamatban".
 */
function DayMealList({ date, onOpenMeal }: { date: string; onOpenMeal: (mealId: string) => void }) {
  const { fuel, isPending } = useFuelDay(date)
  const D = useM().fuelTrendek.day
  return (
    <>
      <Lab>{D.meals}</Lab>
      {isPending ? (
        <Txt className="fr-meals-note">{D.mealsLoading}</Txt>
      ) : fuel.meals.length === 0 ? (
        // A rollup szerint volt fogyás ezen a napon, a napi olvasás mégsem ad étkezést: ezt
        // kimondjuk, nem üres listát rajzolunk.
        <Txt className="fr-meals-note">{D.mealsNone}</Txt>
      ) : (
        <div className="fr-meals">
          {fuel.meals.map((meal) => (
            <Row
              key={meal.id}
              icon="t-plate"
              // a név a felhasználóé (tárolt szöveg): nem fordítjuk
              title={mealDisplayName(meal) ?? D.mealFallback}
              sub={D.mealSub(hhmmFromLoggedAt(meal.loggedAt, '—'), fmtGrouped(meal.kcal))}
              value={meal.score == null ? undefined : fixed1(meal.score * 10)}
              chev
              onClick={() => onOpenMeal(meal.id)}
            />
          ))}
        </div>
      )}
    </>
  )
}

/** Betöltés közben hét üres edény áll a hét helyén — a napok dátuma ismert, a tartalmuk még nem. */
function placeholderDays(start: string): FuelWeekDay[] {
  const zero = { kcal: 0, p: 0, c: 0, f: 0, water: 0 }
  return Array.from({ length: 7 }, (_, i) => ({ date: addDays(start, i), targets: zero, consumed: zero }) as FuelWeekDay)
}

export function FuelTrendekPage() {
  const navigate = useNavigate()
  const M = useM()
  const T = M.fuelTrendek
  const [searchParams, setSearchParams] = useSearchParams()
  const showingPrevious = searchParams.get(WEEK_PARAM) === PREV_WEEK_VALUE
  const thisMonday = mondayIso()
  const prevMonday = addDays(thisMonday, -7)
  const shownMonday = showingPrevious ? prevMonday : thisMonday

  const { start, weekDays, mealScoreAvg, weightAvgKg } = useFuelWeek(shownMonday)
  // A nyitott hét betöltés-jelzője: UGYANAZ a query-kulcs, amit a `useFuelWeek` olvas — nincs második letöltés.
  const loading = useFuelWeekRollup(shownMonday).isPending
  // C2: a MÚLT hét ugyanabból a heti végpontból, a `useFuelWeek` pontos query-kulcsával — a múlt
  // heti nézetben ez UGYANAZ a kulcs, amit a lap már olvas, tehát nincs második letöltés.
  const previous = useFuelWeekRollup(prevMonday)
  const previousHasData = previous.weekDays.some((d) => d.consumed.kcal > 0)
  // Amíg a valós olvasás nem oldódott fel, NEM állítjuk, hogy nincs korábbi hét.
  const previousKnownEmpty = !previous.isPending && !previousHasData
  const { week: meWeek } = useMeWeek(start)
  const { weeks: horizonWeeks, pending: horizonPending } = useFuelHorizon(start)
  // A napi mérések és a súlycél a MEGLÉVŐ hookokból (a prototípus „SZÁMOLHATÓ" jegyzetei): cél nélkül nincs vízvonal.
  const { weightLog } = useWeight()
  const { goalResponse } = useGoal()
  const { patterns } = usePatterns()
  const [openDate, setOpenDate] = useState<string | null>(null)

  useFrameTitle({ eyebrow: showingPrevious ? T.frame.previous : T.frame.current })

  // A nap AI pontja és az edzésnap-jelölés a MEGLÉVŐ napi értékelésből (új formula nélkül).
  const dayScores: Record<string, number | null> = {}
  const trainingDays: string[] = []
  const subscoresByDate: Record<string, { nutrition: number | null; quality: number | null }> = {}
  for (const d of meWeek?.days ?? []) {
    // A napok száma az ÉTKEZÉS-pont (0–10), nem a teljes napi értékelés (0–100): utóbbi az
    // alvást és az edzést is beleszámolja, tehát nem arról szól, amit ez a lap kérdez.
    dayScores[d.date] = mealDayScore(d.subscores.nutrition ?? null, d.subscores.quality ?? null)
    if (d.workoutCount > 0) trainingDays.push(d.date)
    subscoresByDate[d.date] = {
      nutrition: d.subscores.nutrition ?? null,
      quality: d.subscores.quality ?? null,
    }
  }

  const vm = buildWeekView(
    { start, days: loading && weekDays.length === 0 ? placeholderDays(shownMonday) : weekDays, mealScoreAvg, weightAvgKg },
    dayScores,
    trainingDays,
  )
  const avgKcal = loggedKcalAvg(vm.days)

  // C2: a változás mindig a NYITOTT hét és az ELŐTTE álló hét különbsége — a múlt heti nézetben nincs mihez mérni,
  // ezért ott egyetlen delta sem áll. Amíg a korábbi hét nem oldódott fel (vagy nincs egyetlen
  // naplózott napja sem), `null` — tehát nincs delta, nem nulla delta.
  // A korábbi hét VM-jéhez nem kell napi pont és edzésnap: a delták csak a három átlagot olvassák.
  const previousVm = showingPrevious || !previousHasData
    ? null
    : buildWeekView(
        {
          start: prevMonday,
          days: previous.weekDays,
          mealScoreAvg: previous.mealScoreAvg,
          weightAvgKg: previous.weightAvgKg,
        },
        {},
        [],
      )
  const deltas = weekDeltas(vm, previousVm)
  // Az edények közös léptéke: a hét legnagyobb kerete/fogyása, legalább 2400 — így egy gyéren
  // naplózott hét egyetlen napja sem nyúlik a tetőig.
  const max = Math.max(2400, ...vm.days.map(d => Math.max(d.kcal ?? 0, d.targetKcal ?? 0)))

  // SEMLEGES heti olvasat. Egy alig naplózott hét le van ÍRVA, nem leosztályozva. A különbség a NYERS értékek
  // különbségének kerekítése, nem két kerekített szám különbsége.
  const delta = vm.weekdayAvgPct != null && vm.weekendAvgPct != null
    ? vm.weekendAvgPct - vm.weekdayAvgPct
    : null
  const gap = delta == null ? null : Math.round(Math.abs(delta))
  const [verdict, sub]: [string, string] = loading
    ? [T.hero.loading, '']
    : vm.loggedCount === 0
      ? [T.hero.none, T.hero.noneSub]
      : delta == null
        ? [T.hero.some(vm.loggedCount), T.hero.someSub]
        : Math.abs(delta) < 5
          ? [T.hero.level, '']
          : delta > 0
            ? [T.hero.weekend(gap!), T.hero.soItWent]
            : [T.hero.weekday(gap!), T.hero.soItWent]

  // C4: HIVATKOZÁSOK, nem másolatok. Felismerés nélkül a réteg csendben elmarad.
  const patternRefs = fuelPatternRefs(patterns)

  const openDay = openDate ? vm.days.find(d => d.date === openDate) ?? null : null
  const openRollup = openDate ? weekDays.find(d => d.date === openDate) ?? null : null

  // A csempék alsó sora: IRÁNY és mennyiség, semmi más — se jó, se rossz szín, se minősítő szó.
  const deltaText = (d: WeekDelta | undefined, text: (amount: string, up: boolean) => string, dec: 0 | 1) =>
    d ? text(dec === 1 ? fixed1(d.amount) : fmtGrouped(d.amount), d.direction === 'up') : undefined
  const anyDelta = deltas.avg != null || deltas.quality != null || deltas.weight != null
  // A heti étkezés-pont 0..1-ben érkezik; a 0–10-es skála a ház olvasata.
  const quality = vm.mealScoreAvg == null ? null : vm.mealScoreAvg * 10
  const wait = !horizonPending && horizonNeedsMoreWeeks(horizonWeeks)
  const goalKg = goalResponse?.targetWeightKg ?? null

  return (
    <Page className="fr-page">
      {/* A hét-váltó: a nyitott hét és a múlt hét között lép. */}
      <div className="fr-wn">
        <button
          type="button"
          aria-pressed={showingPrevious}
          disabled={showingPrevious || previousKnownEmpty}
          onClick={() => setSearchParams({ [WEEK_PARAM]: PREV_WEEK_VALUE })}
        >
          ‹ {T.nav.prev}
        </button>
        <b className="fr-week">{weekRangeTitle(start === '' ? thisMonday : start)}</b>
        <button
          type="button"
          aria-pressed={!showingPrevious}
          disabled={!showingPrevious}
          onClick={() => setSearchParams({})}
        >
          {T.nav.current} ›
        </button>
      </div>
      {/* Őszintén: új felhasználónál nincs korábbi hét — ez NORMÁL állapot, nem hiba. */}
      {!showingPrevious && previousKnownEmpty && <p className="fr-wnn">{T.nav.first}</p>}

      <Hero
        className="fr-hero"
        label={loading ? T.hero.labelLoading : T.hero.label(vm.loggedCount)}
        verdict={<span className="fr-read"><SafeMarkdown text={verdict} /></span>}
        sub={sub ? `${sub} ${T.hero.hint}` : T.hero.hint}
        graphic={<div className="fr-hg">
          <WeekVessels days={vm.days} max={max} disabled={loading} onOpen={setOpenDate} />
          <WeekLegend days={vm.days} />
        </div>}
      >
      </Hero>

      <Section n={1} title={T.numbers.title} />
      <Card>
        <StatGrid three className="fr-t3">
          <Stat className="is-avg" label={T.numbers.avg} icon="t-plate"
            value={avgKcal == null ? '—' : fmtGrouped(avgKcal)} unit={avgKcal == null ? undefined : 'kcal'}
            note={deltaText(deltas.avg, T.numbers.avgDelta, 0)} />
          <Stat className="is-score" label={T.numbers.quality} icon="t-score"
            value={quality == null ? '—' : fixed1(quality)} unit={quality == null ? undefined : T.numbers.outOfTen}
            note={deltaText(deltas.quality, T.numbers.qualityDelta, 1)} />
          <Stat className="is-weight" label={T.numbers.weight} icon="t-weight" color={MACRO_COLOR.water}
            value={vm.weightAvgKg == null ? '—' : fixed1(vm.weightAvgKg)} unit={vm.weightAvgKg == null ? undefined : 'kg'}
            note={deltaText(deltas.weight, T.numbers.weightDelta, 1)} />
        </StatGrid>
        {anyDelta && <Note>{T.numbers.deltaNote}</Note>}
      </Card>

      <Section n={2} title={T.split.title} />
      <Card>
        <WeekSplit weekdayPct={vm.weekdayAvgPct} weekendPct={vm.weekendAvgPct} />
        <Note className="fr-split-note">
          {delta == null
            ? T.split.needBoth
            : <SafeMarkdown text={(delta > 0 ? T.split.gapWeekend : T.split.gapWeekdays)(gap!)} />}
        </Note>
      </Card>

      <Section n={3} title={wait ? T.horizon.title : T.horizon.titleWeeks(horizonWeeks.length)} />
      <FuelHorizon weeks={horizonWeeks} weightLog={weightLog} goalKg={goalKg} pending={horizonPending} />

      {patternRefs.length > 0 && (
        <>
          <Section n={4} title={T.patterns.title(patternRefs.length)} />
          <Card className="fr-patterns">
            {patternRefs.map((ref) => (
              // a cím a minta TÁROLT címe: nem fordítjuk; az állapot egy szó
              <Row key={ref.pairKey} className="fr-pattern" icon="t-pattern" title={ref.title} sub={ref.stateLabel} to={ref.route} />
            ))}
            <Note>{T.patterns.note}</Note>
          </Card>
        </>
      )}

      {openDay && openRollup && (
        <FuelWeekDayGlass
          day={openDay}
          rollup={openRollup}
          subscores={subscoresByDate[openDay.date] ?? { nutrition: null, quality: null }}
          onClose={() => setOpenDate(null)}
        >
          <DayMealList
            date={openDay.date}
            onOpenMeal={(mealId) => { setOpenDate(null); navigate(`/fuel/etkezes/${mealId}?d=${openDay.date}`) }}
          />
        </FuelWeekDayGlass>
      )}
    </Page>
  )
}

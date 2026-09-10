// ============================================================
// Mezo · NapHubPage — a Nap gerinc TITÁN arca (mezo-mhum)
// Source of truth: the frozen coverage manifest
// `docs/design_2.0/2026-09-10-nap-mai-coverage.md` (owner-approved 2026-09-10) +
// `.superpowers/sdd/2026-09-10-nap-mai-titanium/task-5-brief.md` §Page composition.
//
// The page is ONE composition on every daypart — no more three separate hero/mosaic
// panels (the pre-Titanium shape, mezo-d20.2.1). Top to bottom:
//   1. companion block — TitanCompanion (its aura IS the Életjel gauge, C4) + greeting
//      + creed line (C3) + the morning context chips (A3/A4) + the Mezo CTA (D6);
//   2. ONE computed next step (`nextStep`, the ladder) — the only "what now?" the page
//      ever states, so the tiles never compete for that job (A6 = its evening rung);
//   3. the SIX stable tiles, in a FIXED order that never varies by daypart
//      (víz · alvás · étkezés · edzés · rutin · napló) — a mosaic whose shape changes
//      by the hour is a mosaic the thumb cannot learn;
//   4. evening-only extras: the timed night door (C7) and the day's stat strip (A7).
// The daypart changes the greeting and the next step. Nothing else moves.
//
// What LEFT the page (manifest C): the quest tile (C1 DEFER — `/nap/kuldetesek` still
// resolves), the check-in tile (C2 → quick picker + the ladder's own "Hogy vagy most?"
// rung; the day's check-in slots are still READ here, they feed `checkinStale`), the
// Kreed tile (C3 → companion), the Életjel tile (C4 → the companion's aura), the Stack
// tile (C5 → quick picker), `LifeGoalTodayTile` (C6 → the ladder's goal rung) and the
// separate meal-window tile (B4 → merged into the étkezés tile). The quick-log button
// is the shell's FAB (D3) — on `/nap` it opens the full-page `/nap/gyors` picker, so
// this page renders no quick button of its own.
// ============================================================
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClayIcon } from '@/shared/ui/clay'
import { EntranceGroup, useCountUp } from '@/shared/ui/mozaik/motion'
import { Mosaic, StatCell, StatStrip, Tile } from '@/shared/ui/mozaik'
import { cn } from '@/shared/lib/cn'
import { localDateString } from '@/shared/lib/dates'
import { emitToast } from '@/shared/lib/toastBus'
import {
  useToday, useTodayScenario, useCheckins, useSleepGoal,
  useHabitDay, useHabitCatalog, useHabitActions, useFuelPreview, useFuelDay,
  useWaterActions, useSleep, useWeight, useIntentionDay, useIntentionActions,
  useGamificationDay, useJournalNotes, useLifeGoalToday, useRitualDay,
} from '@/data/hooks'
import { tileKey } from '@/features/fuel/logic/fuelSwimlane'
import { buildHabitRewardToast } from '@/features/progression/logic/rewardToast'
import { type DayFace } from '@/features/today/logic/dayFace'
import { useDayFace } from '@/features/today/logic/useDayFace'
import { useMinuteTick } from '@/features/today/logic/useMinuteTick'
import { useNeeds } from '@/features/today/logic/useNeeds'
import { minsToBed } from '@/features/today/logic/windDown'
import { nextStep } from '@/features/today/logic/nextStep'
import { habitAction } from '@/features/today/logic/habitAction'
import { celebrationFor } from '@/features/today/logic/habitCelebration'
import { daypartMilestone } from '@/features/today/logic/chainMilestone'
import { nextInChain } from '@/features/today/logic/chainPrompt'
import { habitClayIcon, DAYPART_CLAY } from '@/features/today/logic/habitClayIcon'
import { IntentionSheet } from '@/features/today/sheets/IntentionSheet'
import { TitanCompanion } from '@/features/today/components/TitanCompanion'
import type { HabitItem } from '@/data/types'

function fmtHm(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = Math.round(mins % 60)
  return `${h}:${String(m).padStart(2, '0')}`
}

/** The companion's opening line per daypart — the ONE thing besides the next step that
 *  the hour is allowed to change (manifest A1). */
const GREETING: Record<DayFace, string> = {
  reggel: 'Jó reggelt.',
  nap: 'Jó itt folytatni.',
  este: 'Megérkeztél.',
}

/** The prototype's three horgony rows (`?day=rough`), verbatim copy. */
const ANCHORS: { title: string; sub: string; icon: 'i-viz' | 'i-reggeli' | 'i-futas' }[] = [
  { title: 'Egy pohár víz', sub: 'Most. Egyszerű kezdet.', icon: 'i-viz' },
  { title: 'Egy fehérje-étkezés', sub: 'Bármi. 30 g fehérje elég.', icon: 'i-reggeli' },
  { title: '10 perc séta', sub: 'Friss levegő. Nem futás.', icon: 'i-futas' },
]

export function NapHubPage() {
  const date = localDateString()
  const navigate = useNavigate()

  const { today, workoutDone, workoutDoneSets } = useToday()
  const scenario = useTodayScenario()
  const { goal: sleepGoal } = useSleepGoal()
  const tick = useMinuteTick()
  // A `?dp=`-vagy-óra feloldás a shell fejlécével KÖZÖS (mezo-atry): egy hook, egy óra —
  // két másolat egy napszak-határon két különböző napszakot vezetett volna le.
  const { face } = useDayFace()

  // ── data for the companion + the six tiles ──────────────────────────
  const { fuel } = useFuelDay(date)
  const { plan } = useFuelPreview()
  const { logWater, undoLastWater, canUndo } = useWaterActions(date)
  const { lastNight } = useSleep()
  const { weightLog } = useWeight()
  const latestWeight = weightLog.length > 0 ? weightLog[weightLog.length - 1] : null
  const previousWeight = weightLog.length > 1 ? weightLog[weightLog.length - 2] : null
  // C2: the check-in TILE is gone, the check-in DATA is not — it is what tells the ladder
  // whether the day's "Hogy vagy most?" rung is due.
  const { checkins } = useCheckins()
  const { habits } = useHabitDay(date)
  const { catalog: habitCatalog } = useHabitCatalog()
  const { check, pending: habitPending } = useHabitActions(date)
  const { data: intentionData } = useIntentionDay(date)
  const { addFocus } = useIntentionActions(date)
  const needs = useNeeds(tick)
  const { data: gamDay, isPending: gamPending } = useGamificationDay(date)
  const { data: journalNotes, isPending: journalPending } = useJournalNotes(date, date)
  const { today: lifeGoalToday, isPending: lifeGoalPending, isError: lifeGoalError } = useLifeGoalToday()
  const { data: ritualDay } = useRitualDay(date)

  const intention = intentionData ?? { date, creed: null, foci: [], reflection: null }

  // ── the one sheet the hub still owns (Kreed / fókusz) ────────────────
  const [focusOpen, setFocusOpen] = useState(false)
  const [anchorsDone, setAnchorsDone] = useState<Set<number>>(() => new Set())
  // mezo-3zue.6: a hubon nincs lista, amit ki lehetne emelni — a csempe „következő" választása
  // lesz lánc-tudatos. Ugyanaz a pipa-következmény, mint a rutin-oldalon, oldal-lokálisan.
  const [promptKey, setPromptKey] = useState<string | null>(null)

  // ── derived facts ───────────────────────────────────────────────────
  const habitsFor = (f: DayFace) => {
    const keys = new Set(
      habitCatalog.chains
        .filter((c) => (f === 'reggel' ? c.daypart === 'MORNING' : c.daypart === 'EVENING'))
        .map((c) => c.chainKey),
    )
    return habits.filter((h) => keys.has(h.chain))
  }
  const morningHabits = habitsFor('reggel')
  const eveningHabits = habitsFor('este')
  const morningHabitPending = morningHabits.some((h) => h.status === 'pending')
  // A rutin-csempe LÁNCA: reggel a reggeli, este az esti. Napközben az, amelyikben van még
  // nyitott szem (a reggeli előbb) — a csempe így napközben sem üresen áll, hanem azt mutatja,
  // ami tényleg vár. Minden szem kész → a reggeli lánc kerete viszi a „Tökéletes nap" állapotot.
  const habitFace: DayFace = face === 'reggel' || face === 'este'
    ? face
    : morningHabitPending ? 'reggel' : eveningHabits.some((h) => h.status === 'pending') ? 'este' : 'reggel'

  const kcalLeft = Math.round(fuel.targets.kcal - fuel.consumed.kcal)
  const kcalCount = useCountUp(kcalLeft)
  const kcalEaten = Math.round(fuel.consumed.kcal)
  const kcalEatenCount = useCountUp(kcalEaten)
  const xpCount = useCountUp(gamDay.xpTotal)
  const bedIn = minsToBed(tick, sleepGoal.bedTime)

  // Ugyanaz az ablak-szabály, mint a gyors-naplózó felületén (QuickLogSurface): a
  // FELHASZNÁLÓ étkezési ablaka (`slotKey` van), aminek az állapota épp `now`.
  const nowWindow = plan.slots.find((s) => s.slotKey !== undefined && s.state === 'now')
  const waterPct = fuel.targets.water > 0
    ? Math.min(1, fuel.consumed.water / fuel.targets.water)
    : 0

  // ── the ladder's inputs (mezo-mhum, `logic/nextStep`) ────────────────
  // checkinStale: a NAPPALI sávok közül egyik sincs kitöltve. „Nappali" = 10:00 ≤ idő < 20:00,
  // vagyis az ébredési sáv (06:30) és az esti sáv (20:00) közötti minden sáv. Az ébredési sáv
  // magától kész szokott lenni, az esti pedig a napzárás dolga, így egyik sem mondana igazat
  // arról, hogy „rég néztél magadra".
  const daySlots = checkins.filter((c) => c.time >= '10:00' && c.time < '20:00')
  const checkinStale = !daySlots.some((c) => c.state === 'done')
  // C6: a cél napi lépése a létrába költözött. A `today` üres listája a lekérés alatt UGYANÚGY
  // néz ki, mint a „nincs célod" (a `realEmpty` idiómája), ezért a pending/error kör kimarad —
  // egy még fel nem oldott ablakból nem találunk ki lépést.
  const goalStep = !lifeGoalPending && !lifeGoalError && lifeGoalToday.goals.length > 0
    ? lifeGoalToday.goals[0].title
    : null
  const step = nextStep({
    face,
    ritualClosed: ritualDay.closed,
    // A szándék akkor „megvan", ha van kreed VAGY legalább egy fókusz — a létra reggeli
    // első foka pontosan ezt a hiányt tölti be (a sheet fókuszt ír).
    intentionSet: intention.creed !== null || intention.foci.length > 0,
    morningHabitPending,
    checkinStale,
    waterMl: fuel.consumed.water,
    waterTargetMl: fuel.targets.water,
    workoutPlanned: Boolean(today.workoutType),
    workoutDone,
    goalStep,
  })

  /** The prototype's in-place tick: only a habit whose own action IS a check can honestly
   *  complete from here (ADR 0010 — a DERIVED row never self-completes). Anything else has
   *  no tick, and the tile itself opens the Rutin page where that row's real surface lives. */
  const tileTick = (h: HabitItem): (() => void) | null => {
    if (h.status !== 'pending' || habitAction(h).kind !== 'check') return null
    const chainSteps = habits.filter((x) => x.chain === h.chain)
    const celebration = celebrationFor(habitCatalog, h.key)
    // a napszak mérföldköve a pipa ELŐTTI állapotból dől el (mezo-sqe3) — ugyanaz a szabály,
    // mint a rutin-oldalon, hogy a csempéről és a listáról pipálva ugyanaz a pillanat járjon
    const chainLabel = daypartMilestone(habitCatalog, habits, h.chain)
    // ugyanabból a pipa előtti állapotból (mezo-3zue.6)
    const chained = nextInChain(habitCatalog, habits, h.key)
    return () => {
      check(h.key)
        .then((lu) => {
          emitToast(buildHabitRewardToast({
            title: h.title,
            chainDone: chainSteps.filter((x) => x.status === 'done').length,
            chainTotal: chainSteps.length,
            xp: h.xp,
            levelUp: lu?.[0],
            celebration,
            chainLabel,
          }))
          setPromptKey(chained?.key ?? null)
        })
        .catch(() => {})
    }
  }

  /** B2 — the routine tile, moved over from the pre-Titanium mosaic with its chain-aware pick,
   *  its in-place tick and its reward toast unchanged. The ONE change: it renders on every
   *  daypart (an empty chain shows the sage all-done face) instead of disappearing, because
   *  the six tiles are now a fixed, learnable set. */
  const habitTile = (f: DayFace, delay: number) => {
    const items = f === 'reggel' ? morningHabits : eveningHabits
    const done = items.filter((h) => h.status === 'done').length
    // A lánc előzi a sorrendet: ha az imént pipált horgonyra kötött sor itt van és még
    // nyitott, a csempe AZT mutatja — így a stacking a hubról pipálva is kifizetődik.
    const chained = promptKey ? items.find((h) => h.key === promptKey && h.status === 'pending') : undefined
    const next = chained ?? items.find((h) => h.status === 'pending') ?? null
    const chainOf = (h: HabitItem) => habitCatalog.chains.find((c) => c.chainKey === h.chain)
    const chain = next ? chainOf(next) : undefined
    const icon = next
      ? (chain ? habitClayIcon(next.key, chain) : DAYPART_CLAY[f === 'este' ? 'EVENING' : 'MORNING'])
      : 'i-lang'
    const name = next ? next.title : 'Tökéletes nap'
    const tick = next ? tileTick(next) : null
    const label = f === 'este' ? 'Esti rutin' : 'Reggeli rutin'
    // A tile that contains its own tick button cannot itself be a <button> (nested
    // interactive content) — the prototype's own `role="button"` tile, verbatim.
    const open = () => navigate(`/nap/rutin?dp=${f}`)
    return (
      <div key="habit" role="button" tabIndex={0} aria-label={label}
        className={cn('mz-tile nap-t-rutin rise', next ? (f === 'este' ? 'mz-w-lav' : 'mz-w-gold') : 'mz-w-sage')}
        style={{ '--d': `${delay}ms` } as React.CSSProperties}
        onClick={open}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open() } }}>
        <span className={cn('mz-eyebrow', f === 'este' ? 'nap-lav' : 'nap-gold')}>
          {chained ? 'Most jön' : 'Rutin'}
        </span>
        <div className="mz-spotwrap"><ClayIcon name={icon} size={47} /></div>
        <div className="nap-habname">{name}</div>
        <div className="nap-habfoot">
          <span className="nap-habcount">{done}/{items.length}</span>
          {tick ? (
            <button type="button" className="nap-htickbtn" aria-label={`Kipipálás — ${name}`}
              disabled={habitPending}
              onClick={(e) => { e.stopPropagation(); tick() }}>
              <span className="nap-htick" />
            </button>
          ) : (
            <span className="nap-htickbtn" aria-hidden="true">
              <span className={cn('nap-htick', !next && 'f')}>{!next ? '✓' : ''}</span>
            </span>
          )}
        </div>
      </div>
    )
  }

  // ── „nehéz nap" horgony-olvadás (`?day=rough`, D1) ───────────────────
  // Titánra öltöztetve (mezo-mhum): a társ ITT IS ott van, csak csendben — halványabb aura,
  // NINCS következő lépés, nincs mozaik. A három horgony és a kilépés tartalma változatlan.
  if (scenario.anchorMode) {
    return (
      <div className="nap-hub nap-titan">
        <EntranceGroup className="mz-panel-stack">
          <div className="nap-titan-hero nap-titan-quiet rise" data-kalauz-anchor="nap-hero"
            style={{ '--d': '0ms' } as React.CSSProperties}>
            <TitanCompanion states={needs.states} onOpenSignals={() => navigate('/nap/eletjel')} />
            <span className="mz-eyebrow nap-coral">Horgony mód · csendben</span>
            <h2 className="nap-titan-greet">Nehéz nap — ma elég a minimum.</h2>
            <p className="nap-titan-say">Itt vagyok. {ANCHORS.length} apró horgony, semmi más.</p>
          </div>
          <Mosaic>
            {ANCHORS.map((a, i) => {
              const done = anchorsDone.has(i)
              return (
                <div key={a.title} className="mz-tile mz-w-white rise"
                  style={{ '--d': `${70 + i * 40}ms` } as React.CSSProperties}>
                  <span className="mz-eyebrow">{a.sub}</span>
                  <div className="mz-spotwrap"><ClayIcon name={a.icon} size={47} /></div>
                  <div className="nap-habname">{a.title}</div>
                  <div className="nap-habfoot">
                    <span className="nap-habcount" />
                    <button type="button" className="nap-htickbtn" aria-label={`Megvolt — ${a.title}`}
                      onClick={() => setAnchorsDone((s) => {
                        const n = new Set(s)
                        if (n.has(i)) n.delete(i); else n.add(i)
                        return n
                      })}>
                      <span className={cn('nap-htick', done && 'f')}>{done ? '✓' : ''}</span>
                    </button>
                  </div>
                </div>
              )
            })}
          </Mosaic>
          <button type="button" className="nap-anch-exit rise"
            style={{ '--d': '230ms' } as React.CSSProperties}
            onClick={() => navigate('/nap', { replace: true })}>
            Kilépés a horgony módból
          </button>
        </EntranceGroup>
      </div>
    )
  }

  const openWater = () => navigate('/fuel')

  return (
    <div className="nap-hub nap-titan">
      <EntranceGroup replayKey={face} className="mz-panel-stack">
        {/* ── 1. companion block ─────────────────────────────────────── */}
        <div className="nap-titan-hero rise" data-kalauz-anchor="nap-hero"
          style={{ '--d': '0ms' } as React.CSSProperties}>
          {/* C4: az Életjel-csempe helyett MAGA a társ a mérőóra — az aurát az első három
              szükséglet színe/sávja festi, a koppintás pedig a részletes felületet nyitja. */}
          <TitanCompanion states={needs.states} onOpenSignals={() => navigate('/nap/eletjel')} />
          <h2 className="nap-titan-greet">{GREETING[face]}</h2>
          {/* C3: a kreed a társ mondata lett, nem külön csempe. Egy koppintás a fókusz-sheetet
              nyitja (ugyanaz a sheet, amit a Kreed-csempe vitt). */}
          {intention.creed && (
            <button type="button" className="nap-titan-creed" aria-label="Kreed és fókuszok"
              onClick={() => setFocusOpen(true)}>
              <span className="nap-titan-creedtext">{intention.creed}</span>
              {intention.foci.length > 0 && (
                <span className="nap-titan-focibadge">{intention.foci.length} fókusz</span>
              )}
            </button>
          )}
          {/* A3/A4: a reggeli hero két adata — súly (őszinte nyíllal) és az első fókusz. Csak
              reggel: délután a súly már nem hír, és a helyet a következő lépés kapja meg. */}
          {face === 'reggel' && (latestWeight || intention.foci.length > 0) && (
            <div className="nap-titan-ctx">
              {latestWeight && (
                <button type="button" className="nap-titan-chip" aria-label="Súly · részletek"
                  onClick={() => navigate('/me/weight')}>
                  Súly <b>
                    {latestWeight.value.toLocaleString('hu-HU')} kg
                    {/* A trend-nyílhoz KELL egy korábbi mérés — egyetlen bejegyzésnél inkább
                        semmi, mint egy kitalált ↘. */}
                    {previousWeight && previousWeight.value !== latestWeight.value
                      ? (latestWeight.value < previousWeight.value ? ' ↘' : ' ↗')
                      : ''}
                  </b>
                </button>
              )}
              {intention.foci.length > 0 && (
                <span className="nap-titan-chip">Fókusz <b className="nap-coral">{intention.foci[0].text}</b></span>
              )}
            </div>
          )}
          {/* D6: a társ beszélgetés-ajtaja. A feed maga a szálon él (`/nap/uzenetek`). */}
          <button type="button" className="nap-titan-talk" onClick={() => navigate('/nap/uzenetek')}>
            Beszéljük át a napod <span aria-hidden="true">↗</span>
          </button>
        </div>

        {/* ── 2. the ONE next step (the ladder) ──────────────────────── */}
        <button type="button" className="nap-nextstep rise"
          style={{ '--d': '40ms' } as React.CSSProperties}
          onClick={() => { if (step.kind === 'intention') setFocusOpen(true); else navigate(step.to) }}>
          <span className="mz-eyebrow nap-coral">Most egy kis lépés</span>
          <span className="nap-nextstep-row">
            <span className="nap-nextstep-art"><ClayIcon name={step.icon} size={44} /></span>
            <span className="nap-nextstep-copy">
              <strong className="nap-nextstep-title">{step.title}</strong>
              <small className="nap-nextstep-sub">{step.sub}</small>
            </span>
            <span className="nap-nextstep-go" aria-hidden="true">↗</span>
          </span>
        </button>

        {/* ── 3. the six stable tiles — this ORDER never varies ────────
            Mindegyik visel egy `nap-t-<kulcs>` osztályt: ez a csempe IDENTITÁSA (nem stílus),
            amivel a sorrend-őr teszt napszaktól függetlenül tud rá hivatkozni — az
            aria-label napszakonként változhat („Reggeli rutin" / „Esti rutin"), a hely nem. */}
        <Mosaic>
          {/* B1 · Víz — a csempe egésze a részletekbe visz, a benne ülő `+` logol egy pohárral,
              a visszavonás pedig CSAK akkor jelenik meg, ha van mit visszavonni. Ezért nem
              lehet maga a csempe egy <button> (egymásba ágyazott interaktív tartalom). */}
          <div key="water" role="button" tabIndex={0} aria-label="Hidratáció · részletek"
            className="mz-tile mz-w-sky nap-t-viz rise" style={{ '--d': '70ms' } as React.CSSProperties}
            onClick={openWater}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openWater() } }}>
            <span className="mz-eyebrow nap-sky">Víz</span>
            <div className="nap-watertop">
              <ClayIcon name="i-viz" size={26} />
              <span className="nap-waterval">
                <span className="nap-waterbig">
                  {(fuel.consumed.water / 1000).toLocaleString('hu-HU', { maximumFractionDigits: 2 })}
                </span>
                <span className="nap-watermut">
                  / {(fuel.targets.water / 1000).toLocaleString('hu-HU', { maximumFractionDigits: 1 })} L
                </span>
              </span>
            </div>
            <div className="nap-waterfill">
              <div style={{ '--w': waterPct } as React.CSSProperties} />
            </div>
            <div className="nap-waterbtns">
              <button type="button" className="nap-water-quick" aria-label="Víz +2,5 dl"
                onClick={(e) => { e.stopPropagation(); logWater(250) }}>+</button>
              {canUndo && (
                <button type="button" className="nap-water-undo" aria-label="Utolsó pohár visszavonása"
                  onClick={(e) => { e.stopPropagation(); undoLastWater() }}>↺</button>
              )}
            </div>
          </div>

          {/* A2/B6 · Alvás — `duration` a dróton ÓRA, ezért percre váltjuk, mielőtt formázzuk
              (percekkel etetett formázó 0:07-et írna). Adat nélkül nagy „—", sosem 0:00. */}
          <Tile key="sleep" wash="lav" icon="i-alvas" eyebrow="Alvás" delayMs={110}
            className="nap-t-alvas"
            line={lastNight ? (
              <span className="nap-tileline">
                <span className="nap-big">{fmtHm(Math.round(lastNight.duration * 60))}</span>
                <span className="nap-mut">minőség {lastNight.quality}/10</span>
              </span>
            ) : (
              <span className="nap-tileline">
                <span className="nap-big">—</span>
                <span className="nap-mut">Még nincs naplózva</span>
              </span>
            )}
            onClick={() => navigate('/me/sleep')} aria-label="Alvás" />

          {/* A5/B4 · Étkezés — a keret NAGY száma + a fehérje. Nyitott étkezési ablakban a
              csempe „most"-ot jelez és EGYENESEN a logolóba visz (a külön ablak-csempe B4
              szerint ide olvadt); ablakon kívül a Fuel hubja a cél. */}
          <Tile key="meal" wash={nowWindow ? 'most' : 'sage'} icon="i-fuel" delayMs={150}
            className="nap-t-etkezes"
            eyebrow={nowWindow ? `${nowWindow.label} · most` : 'Keret · ma'}
            line={
              <span className="nap-tileline">
                <span className="nap-big">{kcalCount}</span>
                <span className="nap-mut">kcal · fehérje {Math.round(fuel.consumed.p)}/{Math.round(fuel.targets.p)} g</span>
              </span>
            }
            onClick={() => navigate(nowWindow ? `/fuel/log/uj?w=${encodeURIComponent(tileKey(nowWindow))}` : '/fuel')}
            aria-label="Étkezés" />

          {/* B3 · Edzés — terv nélkül is ott marad (hat stabil csempe), csak őszintén üresen. */}
          <Tile key="workout" wash="coral" icon="i-edzes" eyebrow="Edzés" delayMs={190}
            className="nap-t-edzes"
            line={
              <span className="nap-tileline">
                <span className="nap-habname">
                  {today.workoutType ? `${today.workoutType}${workoutDone ? ' ✓' : ''}` : 'Pihenő'}
                </span>
                <span className="nap-mut">
                  {today.workoutType
                    ? (workoutDoneSets != null ? `${workoutDoneSets} szett` : 'a mai edzés')
                    : 'Ma nincs betervezve'}
                </span>
              </span>
            }
            onClick={() => navigate('/train')} aria-label="Edzés" />

          {/* B2 · Rutin */}
          {habitTile(habitFace, 230)}

          {/* B5 · Napló — egy adat: hány bejegyzés született ma. A nulla itt őszinte szám —
              DE csak feloldott lekérés után: futó lekérés üres listája ugyanúgy néz ki, mint a
              „ma még semmi", ezért addig `—` áll ott, nem egy kitalált 0. */}
          <Tile key="journal" wash="white" icon="i-naplo" eyebrow="Napló" delayMs={270}
            className="nap-t-naplo"
            line={<span className="nap-tileline"><span className="nap-big">{journalPending ? '—' : journalNotes.length}</span><span className="nap-mut">bejegyzés ma</span></span>}
            onClick={() => navigate('/me/naplo')} aria-label="Napló" />
        </Mosaic>

        {/* ── 4. evening extras ──────────────────────────────────────── */}
        {face === 'este' && (
          <>
            {/* C7: az Éjszakai mód Nap-oldali ajtaja — IDŐZÍTVE, ahogy mindig is volt
                (villanyoltás − 90 perc), hogy ne üljön egész este a felületen. */}
            {bedIn <= 90 && bedIn > 0 && (
              <Tile key="night" wash="lav" icon="i-alvas" eyebrow="Éjszakai mód" delayMs={310}
                line={`indul ${sleepGoal.bedTime} előtt`}
                onClick={() => navigate('/me/sleep/night')} aria-label="Éjszakai mód" />
            )}
            {/* A7: az este a nap statisztika-sorával zár (kcal · edzés · XP). Forrás nélküli
                statisztika `—`, sosem kitalált nulla. */}
            <div className="rise" style={{ '--d': '350ms' } as React.CSSProperties}>
              <StatStrip>
                <StatCell value={kcalEatenCount}
                  label={kcalEaten <= Math.round(fuel.targets.kcal) ? 'kcal · kereten belül ✓' : 'kcal · kereten túl'} />
                <StatCell value={today.workoutType ? `${today.workoutType}${workoutDone ? ' ✓' : ''}` : '—'}
                  label={workoutDoneSets != null ? `${workoutDoneSets} szett` : 'a mai edzés'} />
                {/* A gamifikációs nap `realEmpty`-je xpTotal:0 — futó lekérés alatt a `+0`
                    kitalált nulla lenne, ezért ott „—" áll (ugyanaz az idióma, mint a naplónál). */}
                <StatCell value={gamPending ? '—' : `+${xpCount}`} label="a mai termés" />
              </StatStrip>
            </div>
          </>
        )}
      </EntranceGroup>

      {focusOpen && <IntentionSheet creed={intention.creed} onSave={addFocus} onClose={() => setFocusOpen(false)} />}
    </div>
  )
}

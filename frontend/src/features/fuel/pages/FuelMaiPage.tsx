// ============================================================
// Mezo · FuelMaiPage — the Fuel tab's hub Mozaik face (Design 2.0 F3.1, mezo-d20.4.1)
// Source of truth: docs/design_2.0/prototypes/src/fuel-body.html hub section (values
// ×1.18) + docs/design_2.0/2026-08-27-fuel-design-iterations.md §§1-2, whose v3
// declutter overrides the first-ship prototype where they differ.
//
// The Fuel shell (AppHero + SubNavDropdown + its ⚙️ Fuel-beállítások action) dissolves:
// this page IS the /fuel index, the former sub-tabs are full-page siblings on their
// stable routes — the idiom the Mezo (mezo-d20.5.1) and Én (mezo-d20.6.1) tabs took.
// The settings entry the dropdown owned moves onto this hub's Fuel-beállítások band.
//
// Fuel Titanium S1a (mezo-33k6, frozen manifest docs/design_2.0/2026-09-11-fuel-coverage.md
// rows A1 hero · A2 macro rings · A15 energy provenance): the page's top is the Titanium
// energy instrument. `FuelEnergyHero` replaced `KeretHero` here — the hero's ONE message is
// now the REMAINING kcal inside a bowl-in-arc gauge, with the owner-approved macro ring row
// (hús/gabona/avokádó/növény/víz) under it, because the consumed-kcal numeral + day-bar +
// three-chip row told the frame three times over and never told the user what still fits.
// The chip does NOT open the hero's own glass box on this page: it opens the shared
// `EnergyBreakdownSheet` (the same surface the Én hub uses), which stays the CANONICAL energy
// provenance — one explanation of the day's keret, never a second copy that can drift from it.
// KeretHero itself lives on, unchanged, as the /fuel/log page's hero.
//
// Fuel Titanium S1b (mezo-33k6, manifest rows A10 day meal list · A11 per-meal AI evaluation ·
// A14 the eating window folds INTO the meal block): the Mai is now the CANONICAL home of the
// day's meals. The day's planned blocks live here — each with its budget ring, its eating-window
// bar and its logged meal rows (`FuelMealBlocks`) — and you log INTO a block; the generic
// „anything, anytime" log action sits BELOW them (owner). A logged meal row opens the meal's own
// Titanium detail page (/fuel/etkezes/:id), whose AI chip opens the score page.
//
// WHAT LEFT with S1b: the `FuelLogHeroTile` (.fh-logtile). It was the hub's ONE door to
// /fuel/log back when the hub carried no meal list at all (mezo-byo1) — its window dots, its
// „x/y ablak kész" line and its log CTA now all say what the blocks say, in less space and with
// a worse tap target. Its one unique job, the „tegnap pótolható" bait, survives as its own chip
// under the generic log action, so the /fuel/log?d= door stays open (that page's own retirement
// is S5, not this slice).
//
// Fuel Titanium S1d (mezo-33k6, manifest row A13 past-day backfill folded into shared date
// paging): the Mai is PAGEABLE. The selected day lives in `?d=`, clamped by the SAME 7-day
// backfill window the logger enforces (logic/backfillWindow.ts — one rule, so the pager can
// never reach a day the logger would refuse), and every navigation the page emits carries the
// day. A past day is normalised (`asPastDayHero`/`asPastDayLane`: no „most", no future), and a
// past day with no data at all drops the energy instrument for an honest „nincs adat" line
// rather than reading „még belefér <a teljes keret>" on a finished day.
//
// Anatomy top→bottom:
//   the shell fejléc (app/AppHeader.tsx, mezo-atry)
//   the day pager (DayNavigator, A13)
//   Titán energia-hero — the remaining-kcal gauge, the tap chip, 5 macro rings (víz = a button)
//   the day's meal BLOCKS — log into a block, open a logged meal (A10/A14)
//   the generic log action (+ the „tegnap pótolható" chip), at the BOTTOM of the meal area
//   the water module — quick-add + undo (A12)
//   6-tile mosaic: Terv · Stack · Receptek · Kamra · Gyógyszer · Napló
//   the QUIET settings corner (A16 → /fuel/settings → /fuel/slots)
//
// The data layer is untouched: the same composed day (useFuelDay/useFuelTimeline),
// the same mutations, the same sheets. Honest states are the contract — a tile line
// vanishes rather than fabricating a number, an unscored meal reads "✨ folyamatban",
// a missed window says "Pótold", never shame.
//
// Retired and DELETED in F8 (mezo-d20.9.1): DoneWindowsCapsule,
// WindowIsland + the `?w=` selection URL state, EmptyDayIsland, the `.mai-logrow`
// standing row (absorbed by the lane's trailing out-of-window tile), the sky shell.
// ============================================================
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { EnergySection } from '@/features/fuel/sheets/EnergyBreakdownSheet'
import {
  useDietSettings, useFuelDay, useFuelTimeline, useFuelWeek, useMedication, usePantry, useRecipes,
  useStackDay, useWaterActions,
} from '@/data/hooks'
import { toMin } from '@/data/fuel/fuelConfig'
import { buildKeretHero, aiAverage, asPastDayHero, doneMealRows } from '@/features/fuel/logic/keretHero'
import { buildWindowLane, asPastDayLane, tileKey } from '@/features/fuel/logic/fuelSwimlane'
import { buildKamraItems } from '@/features/fuel/logic/kamraItems'
import { backfillDate, earliestBackfillDate } from '@/features/fuel/logic/backfillWindow'
import { addDays, localDateString, huMonthDay } from '@/shared/lib/dates'
import { ClayIcon } from '@/shared/ui/clay'
import { DayNavigator } from '@/shared/ui/DayNavigator'
import { Mosaic, Tile } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { FuelEnergyHero } from '@/features/fuel/components/FuelEnergyHero'
import { DietSuggestionBanner } from '@/features/fuel/components/DietSuggestionBanner'
import { FuelMealBlocks } from '@/features/fuel/components/FuelMealBlocks'
import { FuelWaterModule } from '@/features/fuel/components/FuelWaterModule'
import { WaterLogSheet } from '@/features/fuel/sheets/WaterLogSheet'
import { EnergyBreakdownSheet } from '@/features/fuel/sheets/EnergyBreakdownSheet'

export function FuelMaiPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  // A13 (mezo-33k6): a MEGTEKINTETT nap az URL-ben él (`?d=`), és a naplózóval KÖZÖS 7 napos
  // pótlási ablakba clampelődik (backfillWindow.ts) — a lapozó így sosem érhet el olyan napot,
  // ahova a naplózó nem engedne be. A mai napot egyszer rögzítjük (a /fuel/log/uj szabálya,
  // mezo-1j3z 4. finding): újraszámolva egy éjfél utáni re-render elmozdítaná a nézett napot.
  const [today] = useState(() => localDateString())
  const date = backfillDate(searchParams.get('d'), today)
  const past = date !== today
  /** Minden navigáció, amit a lap kiad, viszi a napot — ma paraméter nélkül. */
  const dayParam = past ? `d=${date}` : ''
  const goDay = (next: string) => navigate(next === today ? '/fuel' : `/fuel?d=${next}`)

  const { fuel } = useFuelDay(date)
  const { plan, budget, nowHHmm, energyBreakdown } = useFuelTimeline(date)
  // Diet Plan slice 1 (mezo-xwgb): the fiber ring's target now comes from the user's own diet
  // settings instead of the static FIBER_TARGET_G default.
  const { settings: dietSettings } = useDietSettings()
  const { logWater } = useWaterActions(date)

  const [waterOpen, setWaterOpen] = useState(false)
  const [energyOpen, setEnergyOpen] = useState<EnergySection | null>(null)

  // ── keret-hero VM (unchanged data spine, Titanium face — mezo-33k6) ───
  // Static-fallback energy (real mode, no BMR): base equals the FULL segment kcal and
  // activity/balance are 0, so the breakdown chips would be meaningless — the whole chip
  // row vanishes (the retired DayBudgetCard's `staticEnergy` rule, kept verbatim).
  const staticEnergy = plan.energy.activity === 0 && plan.energy.balance === 0
  const keretHeroVmRaw = buildKeretHero({
    budget, staticEnergy, consumed: fuel.consumed, meals: fuel.meals,
    water: { currentMl: fuel.consumed.water, targetMl: fuel.targets.water },
    slots: plan.slots, nowHHmm, fiberTargetG: dietSettings.fiberG,
  })
  // Egy LEZÁRT napon nincs „most" és nincs mai energia-chip (asPastDayHero, mezo-zeeq).
  const keretHeroVm = past ? asPastDayHero(keretHeroVmRaw) : keretHeroVmRaw

  // ── the day's window lane — the blocks' VM (the /fuel/log page reads the same one) ─
  // Múltban nincs MOST és nincs jövő: minden be nem logolt ablak „még pótolható".
  const laneRaw = buildWindowLane({ slots: plan.slots, budget, meals: fuel.meals })
  const lane = past ? asPastDayLane(laneRaw) : laneRaw
  const doneRows = doneMealRows(fuel.meals, plan.slots)

  // Őszinte üresség (A13): egy régi nap, amiről semmit sem tudunk, NEM nullákat mutat — a
  // keret-műszer „még belefér <teljes keret>" olvasata egy lezárt napon valótlan lenne. A
  // blokkok maradnak: a pótlás útja nyitva, szégyenmentes hangon.
  const hasDayData = fuel.meals.length > 0 || fuel.consumed.kcal > 0 || fuel.consumed.water > 0
  const emptyPast = past && !hasDayData

  // ── hub-csali chip: tegnap pótolható ablakok (mezo-1j3z) — past-normalized lane,
  // ONE live door into `/fuel/log?d=<tegnap>`; hides itself when nothing is missed.
  const yesterday = addDays(today, -1)
  const { fuel: fuelY, isPending: yPending } = useFuelDay(yesterday)
  const { plan: planY, budget: budgetY } = useFuelTimeline(yesterday)
  const laneY = asPastDayLane(buildWindowLane({ slots: planY.slots, budget: budgetY, meals: fuelY.meals }))
  const yMissed = laneY.tiles.filter(t => t.state === 'missed').length

  // ── tile lines — each from its own page's hook, honest while unresolved ──
  const { weeklyStats } = useFuelWeek()
  const tervLine = `Protein ${weeklyStats.proteinHitDays}/7 nap`

  const { slots: stackSlots } = useStackDay()
  const stackEntries = stackSlots.flatMap(s => s.entries.filter(e => !e.skippedToday))
  const stackTaken = stackEntries.filter(e => e.taken).length
  // "köv." is the next zone still AHEAD on the clock — a still-untaken morning zone is a
  // gap to catch up, not the next thing coming; fall back to the earliest untaken one when
  // the day has no upcoming zone left.
  const untakenZones = stackSlots.filter(s => s.entries.some(e => !e.skippedToday && !e.taken))
  const nextZone = untakenZones.find(s => toMin(s.time) >= toMin(nowHHmm)) ?? untakenZones[0]
  const stackLine = stackEntries.length === 0
    ? undefined
    : `${stackTaken}/${stackEntries.length} ma${nextZone ? ` · köv. ${nextZone.time}` : ''}`

  const { recipes } = useRecipes()
  const starred = recipes.filter(r => r.starred).length
  const recipeLine = recipes.length === 0
    ? undefined
    : `${recipes.length}${starred > 0 ? ` · ${starred} csillagos` : ''}`

  // The Kamra page's own item composition (ingredients + stash), so the tile counts
  // exactly what the page lists — not a second, drifting definition of "tétel".
  const { ingredients, stash } = usePantry()
  const pantryCount = buildKamraItems(ingredients, stash).length
  const kamraLine = pantryCount === 0 ? undefined : `${pantryCount} tétel`

  const { cycle } = useMedication()
  const medLine = cycle.cycleDay > 0 ? `D${cycle.cycleDay} · ${cycle.phaseLabel}` : undefined

  // Trendek line: today's own AI average off the logged meals — no fabricated 0 when nothing
  // is scored yet (`aiAverage` returns null, and the weekly protein line takes over).
  // S5 (mezo-qt5q): ez a szám a visszavont Napló-csempe egyetlen saját jele volt; a lap a
  // Trendekbe olvadt (C5), tehát a jel is a Trendek-csempére költözött — nem vész el.
  const todayAvg = aiAverage(fuel.meals.map(m => (m.score != null ? Math.round(m.score * 100) : null)))
  const trendekLine = todayAvg == null ? tervLine : `AI-átlag ${todayAvg}`

  return (
    <div className="fh-hub">
      <EntranceGroup className="mz-panel-stack">
        {/* Diet-phase suggestion signal (slice 4) — a slim deep-link to the Cél page's
            decision surface; renders nothing while there is no open suggestion. */}
        {!past && <DietSuggestionBanner />}

        {/* A13: a nap-lapozó a lap TETEJÉN — a megosztott `DayNavigator` primitív, a naplózóval
            közös 7 napos alsó kapuval és jövő nélkül. */}
        <div className="fmx-daynav rise" style={{ '--d': '0ms' } as React.CSSProperties}>
          <DayNavigator date={date} onChange={goDay} maxDate={today}
            minDate={earliestBackfillDate(today)} eyebrow />
        </div>

        {emptyPast ? (
          <p className="fmx-nodata rise" style={{ '--d': '40ms' } as React.CSSProperties}>
            Erre a napra nincs adat — amit most logolsz, erre a napra könyvelődik.
          </p>
        ) : (
          <div className="fh-hero rise" style={{ '--d': '40ms' } as React.CSSProperties}>
            <FuelEnergyHero
              vm={keretHeroVm}
              past={past}
              // A15: the shared sheet, opened at its first section — not the hero's local box.
              onOpenEnergy={() => setEnergyOpen('base')}
              onWater={() => setWaterOpen(true)}
            />
          </div>
        )}

        {/* A10/A14: a nap blokkjai — ide logolsz, és innen nyílik egy logolt étkezés.
            `onLogInto` a MEGLÉVŐ logoló oldalra visz az ablak-kulccsal (`?w=`, mezo-bq2t):
            a kamera-első logoló S1c, tehát a lap minden commitnál végig működik. */}
        {/* A prototípus `food-list-heading`-je: a blokkok fölött megmondjuk, MI következik,
            és hogy hány étkezés van már a napban. */}
        <div className="fmx-blocks-head rise" style={{ '--d': '60ms' } as React.CSSProperties}>
          <h2>{past ? 'Ezen a napon' : 'A mai blokkjaid'}</h2>
          <span>{doneRows.length} ÉTKEZÉS</span>
        </div>
        <div className="rise" style={{ '--d': '70ms' } as React.CSSProperties} data-kalauz-anchor="fuel-log">
          <FuelMealBlocks
            lane={lane}
            meals={doneRows}
            dayKcal={budget.kcal}
            onLogInto={(tile) => {
              const slot = plan.slots.find(s => s.slotKey != null && tileKey(s) === tile.key)
              // A13: a logolás a MEGTEKINTETT naphoz kapcsolódik — a nap megy a `?d=`-ben.
              const q = [slot ? `w=${encodeURIComponent(tileKey(slot))}` : '', dayParam]
                .filter(Boolean).join('&')
              navigate(`/fuel/log/uj${q ? `?${q}` : ''}`)
            }}
            onOpenMeal={(mealId) => navigate(`/fuel/etkezes/${mealId}`)}
          />
        </div>

        {/* Az ÁLTALÁNOS naplózás a blokkok ALATT áll (owner): a fő útvonal a blokkba logolás. */}
        <button type="button" className="fmx-loggeneric rise" style={{ '--d': '110ms' } as React.CSSProperties}
          aria-label="Logolás ablakon kívül"
          onClick={() => navigate(`/fuel/log/uj${dayParam ? `?${dayParam}` : ''}`)}>
          <ClayIcon name="i-fuel" size={30} />
          <span className="txt"><b>Logolj bármit</b> · ablakon kívül is</span>
          <span className="chev" aria-hidden="true">›</span>
        </button>

        {/* A tegnapi pótolható ablakok csalija — a visszavont Logolás-csempe EGYETLEN saját
            feladata, megtartva. S5 (mezo-qt5q): a `/fuel/log` lap kivezetve, a pótlás ajtaja
            MAGA a Mai lapozója (`/fuel?d=`) — ugyanaz a nap, egy redirect nélkül. */}
        {/* Csak a mai nézetben csali: egy visszalapozott napon a lapozó MAGA a pótlás útja. */}
        {!past && !yPending && yMissed > 0 && (
          <button type="button" className="fmx-pastchip rise" style={{ '--d': '130ms' } as React.CSSProperties}
            aria-label={`Pótlás · ${huMonthDay(yesterday).toLowerCase()}. · ${yMissed} ablak pótolható`}
            onClick={() => navigate(`/fuel?d=${yesterday}`)}>
            ↺ {huMonthDay(yesterday).toLowerCase()}. · {yMissed} ablak pótolható
          </button>
        )}

        {/* A12: a víz a Mai-on marad (owner) — a blokkok ALATT, gyorsgombokkal és a
            session-alapú visszavonással. A hero víz-gyűrűje továbbra is a sheet ajtaja. */}
        <div className="rise" style={{ '--d': '150ms' } as React.CSSProperties}>
          <FuelWaterModule date={date} currentMl={fuel.consumed.water} targetMl={fuel.targets.water} />
        </div>

        {/* S5 (mezo-qt5q): a csempe-sáv MINDEN ajtaja élő lapra nyílik. A `Terv` (`/fuel/plan`,
            C1) és a `Napló` (`/fuel/naplo`, C5) csempe EGY Trendek-csempévé olvadt, mert mind a
            két lap a Trendekbe költözött — két csempe ugyanarra a lapra félrevezető lenne. A
            Trendek/Konyha/Kiegészítők hármas egyébként a fül-sávból (navModel) is elérhető; ezek
            a csempék a lapon belüli rövidítések, a saját élő adat-soraikkal. */}
        <Mosaic>
          <Tile wash="white" icon="i-trend" eyebrow="Trendek" delayMs={160}
            line={trendekLine} onClick={() => navigate('/fuel/trendek')} aria-label="Trendek" />
          <Tile wash="sage" icon="i-stack" eyebrow="Stack" delayMs={200} className="fh-eb-sage"
            line={stackLine} onClick={() => navigate('/fuel/stack')} aria-label="Stack" />
          <Tile wash="coral" icon="i-recept" eyebrow="Receptek" delayMs={240} className="fh-eb-coral"
            line={recipeLine} onClick={() => navigate('/fuel/recipes')} aria-label="Receptek" />
          <Tile wash="gold" icon="i-kamra" eyebrow="Kamra" delayMs={280} className="fh-eb-gold"
            line={kamraLine} onClick={() => navigate('/fuel/kamra')} aria-label="Kamra" />
          <Tile wash="lav" icon="i-injekcio" eyebrow="Gyógyszer" delayMs={320} className="fh-eb-lav"
            line={medLine} onClick={() => navigate('/fuel/gyogyszer')} aria-label="Gyógyszer" />
        </Mosaic>

        {/* A16 (mezo-33k6): a beállítás CSENDES SAROK a lap alján (owner, spec 7) — nem csempe
            és nem mosott sáv (a korábbi `.fh-band`), mert a napi használatban a beállítás a
            legritkább út. A viselkedés változatlan: a standalone beállítás-oldalra visz, és
            onnan nyílik tovább az étkezési ablakok szerkesztője (A17). */}
        <div className="fmx-corner rise" style={{ '--d': '400ms' } as React.CSSProperties}>
          <button type="button" className="fmx-corner-link"
            aria-label="Fuel-beállítások" onClick={() => navigate('/fuel/settings')}>
            <ClayIcon name="i-beallitas" size={18} />
            <span>Beállítások</span>
            <span aria-hidden="true">›</span>
          </button>
        </div>
      </EntranceGroup>

      {waterOpen && (
        <WaterLogSheet
          currentMl={fuel.consumed.water}
          targetMl={fuel.targets.water}
          onLog={(ml) => logWater(ml)}
          onClose={() => setWaterOpen(false)}
        />
      )}
      {energyOpen && energyBreakdown && (
        <EnergyBreakdownSheet breakdown={energyBreakdown} initial={energyOpen} onClose={() => setEnergyOpen(null)} />
      )}
    </div>
  )
}

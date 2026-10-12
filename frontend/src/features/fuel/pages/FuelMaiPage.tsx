// ============================================================
// Mezo · FuelMaiPage — the Fuel tab's hub: today (Folyadék F5, mezo-n4wf5.5; prototype
// docs/design_2.0/prototypes/vilagos/fuel.js `mai()` and every `#w-fuel-mai.<arg>` face).
//
// Anatomy top→bottom (title bar and the top tabs come from the frame):
//   the diet-suggestion strip (only today, only with an open suggestion)
//   the day pager (DayNavigator) — `?d=`, clamped by the SAME 7-day backfill window the logger enforces
//   the gentle-mode strip (MAINTENANCE / ESTIMATE)
//   the HERO — the day's bowl with its verdict sentence and the one primary button (FuelEnergyHero);
//     on an illness / stomach-bug day the guidance face (FuelGuidanceCard); on a closed day without data,
//     while loading and on a load error the empty bowl with one sentence
//   1 · the macros (five vials; the water vial is the only door to the water sheet)
//   2 · the day's meal blocks — log into a block, open a logged meal (FuelMealBlocks; kalauz `fuel-log`)
//   3 · „Ablakon kívül" — the generic log row and the „yesterday can still be added" row
//   4 · the day's mark in the learning (DayLearningMark; nothing while unlogged / pending)
//
// The data layer is the Titanium page's, untouched (Fuel Titanium S1a–S1d, mezo-33k6): the same composed
// day (useFuelDay / useFuelTimeline), the same mutations, the same sheets, the same navigations — every
// one of them carries the viewed day. A past day is normalised (`asPastDayHero` / `asPastDayLane`: no
// „now", no future). Honest states are the contract: an unknown number is „—", a closed window says „még
// pótolható", never shame.
// ============================================================
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { EnergySection } from '@/features/fuel/sheets/EnergyBreakdownSheet'
import {
  useDietSettings, useFuelDay, useFuelTimeline, useWaterActions,
} from '@/data/hooks'
import { useExpenditureWeeklyCard } from '@/data/fuel/expenditureHooks'
import { buildKeretHero, asPastDayHero, deficitDropped, doneMealRows } from '@/features/fuel/logic/keretHero'
import { buildWindowLane, asPastDayLane, tileKey } from '@/features/fuel/logic/fuelSwimlane'
import { trainingSpan } from '@/features/fuel/logic/mealWindow'
import { backfillDate, earliestBackfillDate } from '@/features/fuel/logic/backfillWindow'
import { addDays, localDateString } from '@/shared/lib/dates'
import { fmtDate } from '@/shared/lib/format'
import { useM } from '@/shared/i18n'
import { Btn, Card, Hero, Page, Row, Section } from '@/shared/ui/folyadek'
import { BowlGauge } from '@/features/fuel/components/folyadek'
import { useToast } from '@/shared/ui/ToastProvider'
import { usePlannedSkips } from '@/data/train/skipHooks'
import { useOpenRecovery, useRecovery } from '@/data/train/recoveryHooks'
import { MealSkipSheet } from '@/features/fuel/sheets/MealSkipSheet'
import type { WindowTileVM } from '@/features/fuel/logic/fuelSwimlane'
import { DayNavigator } from '@/shared/ui/DayNavigator'
import { FuelEnergyHero } from '@/features/fuel/components/FuelEnergyHero'
import { FuelGuidanceCard } from '@/features/fuel/components/FuelGuidanceCard'
import { FuelRecoveryNote, FuelRecoveryStrip } from '@/features/fuel/components/FuelRecoveryNote'
import { DietSuggestionBanner } from '@/features/fuel/components/DietSuggestionBanner'
import { FuelMealBlocks } from '@/features/fuel/components/FuelMealBlocks'
import { DayLearningMark } from '@/features/fuel/components/DayLearningMark'
import { WaterLogSheet } from '@/features/fuel/sheets/WaterLogSheet'
import { EnergyBreakdownSheet } from '@/features/fuel/sheets/EnergyBreakdownSheet'

export function FuelMaiPage() {
  const M = useM()
  const P = M.fuelMai.page
  const H = M.fuelMai.hero
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

  const { fuel, isPending, isError, refetch } = useFuelDay(date)
  const { plan, budget, staticEnergy, nowHHmm, energyBreakdown, trajectory, wake, bed, blocks } = useFuelTimeline(date)
  // Diet Plan slice 1 (mezo-xwgb): the fiber ring's target now comes from the user's own diet
  // settings instead of the static FIBER_TARGET_G default.
  const { settings: dietSettings } = useDietSettings()
  const { logWater, undoLastWater, canUndo } = useWaterActions(date)
  // mezo-3n2so: the weekly learning summary — `null` unless there is something worth saying.
  const { card: weeklyCard } = useExpenditureWeeklyCard()

  const [waterOpen, setWaterOpen] = useState(false)
  // Kihagyás S3 (mezo-q4xt2.3): the meal skip — one tap, an optional reason in a sheet.
  const toast = useToast()
  const { skips, skip, setReason, undo, saving } = usePlannedSkips()
  // „Mégis ettem": a skip is withdrawn once per tap-burst — a double tap must not fire two undos.
  const ateBusy = useRef(false)
  useEffect(() => { if (!saving) ateBusy.current = false }, [saving])
  const { recovery } = useRecovery()
  const openRecovery = useOpenRecovery()
  const [whyId, setWhyId] = useState<string | null>(null)
  const [energyOpen, setEnergyOpen] = useState<EnergySection | null>(null)

  // ── keret-hero VM (unchanged data spine, Titanium face — mezo-33k6) ───
  // Static energy (no served breakdown — no goal / no biometric snapshot, mezo-32m82): the
  // breakdown chips would be meaningless, so the whole chip row vanishes (the retired
  // DayBudgetCard's `staticEnergy` rule).
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
  // Kihagyás S3: a GUIDANCE nap (napló nélkül is) saját arcot kap; a többi mód üres múltja őszintén „nincs adat".
  const mode = fuel.fuelMode
  const emptyPast = past && !hasDayData && mode !== 'GUIDANCE'

  // ── hub-csali chip: tegnap pótolható ablakok (mezo-1j3z) — past-normalized lane,
  // ONE live door into `/fuel/log?d=<tegnap>`; hides itself when nothing is missed.
  const yesterday = addDays(today, -1)
  const { fuel: fuelY, isPending: yPending } = useFuelDay(yesterday)
  const { plan: planY, budget: budgetY } = useFuelTimeline(yesterday)
  const laneY = asPastDayLane(buildWindowLane({ slots: planY.slots, budget: budgetY, meals: fuelY.meals }))
  const yMissed = laneY.tiles.filter(t => t.state === 'missed').length

  const mealTarget = (sessionKey: string | null | undefined) => ({ kind: 'MEAL' as const, date, sessionKey })
  const whySkip = whyId ? skips.find(x => x.id === whyId) : undefined
  const whyTile = whySkip ? lane.tiles.find(t => t.skipKey === whySkip.sessionKey) : undefined
  const skippedCount = lane.tiles.filter(t => t.state === 'skipped').length
  const logInto = (tile: WindowTileVM) => {
    const slot = plan.slots.find(s => s.slotKey != null && tileKey(s) === tile.key)
    // A13: a logolás a MEGTEKINTETT naphoz kapcsolódik — a nap megy a `?d=`-ben.
    const q = [slot ? `w=${encodeURIComponent(tileKey(slot))}` : '', dayParam]
      .filter(Boolean).join('&')
    navigate(`/fuel/log/uj${q ? `?${q}` : ''}`)
  }

  // mezo-jb84: a Receptek / Kamra / Gyógyszer / Trendek csempék adat-sorai a csempékkel együtt
  // elmentek. A lekérdezéseiket is elhagyjuk — egy lap ne olvasson adatot, amit nem mutat.

  const logGeneric = () => navigate(`/fuel/log/uj${dayParam ? `?${dayParam}` : ''}`)
  const pager = (
    <DayNavigator date={date} onChange={goDay} maxDate={today} minDate={earliestBackfillDate(today)} eyebrow />
  )

  // Loading and error (new, drawn in the prototype: `mai.tolt`, `mai.hiba`): the pager and the empty bowl with
  // one sentence — never a day of zeros.
  if (isPending || isError) {
    return (
      <Page className="fa-page">
        {pager}
        <Hero className="fa-hero" role={isError ? 'alert' : 'status'} label={H.loadingLabel}
          verdict={isError ? H.error : H.loading} sub={isError ? H.errorSub : H.loadingSub}
          actions={isError ? <Btn onClick={() => refetch()}>{H.retry}</Btn> : undefined}
          graphic={<BowlGauge plain />}
        >
        </Hero>
      </Page>
    )
  }

  // the first window of an empty closed day — the hero's one button backfills it
  const firstOpen = lane.tiles.find(t => t.mealId == null && t.state !== 'skipped')
  // the page counts its sections: the hero faces own section 1 (macros / „Most ez segít"), an empty closed day has none
  let n = emptyPast ? 0 : 1

  return (
    <Page className="fa-page">
      {/* Diet-phase suggestion signal (slice 4) — a slim deep-link to the Cél page's decision surface;
          renders nothing while there is no open suggestion. */}
      {!past && <DietSuggestionBanner />}

      {/* A13: the day pager on TOP — the 7-day floor is the logger's, and there is no future. */}
      {pager}

      {/* Kihagyás S3: MAINTENANCE / ESTIMATE — the strip above the hero; the mode is closed on the Nap page. */}
      {(mode === 'MAINTENANCE' || mode === 'ESTIMATE') && (
        <FuelRecoveryStrip category={fuel.recoveryCategory} day={fuel.recoveryDay}
          onTap={() => toast.show({ kind: 'info', text: P.gentleToast })} />
      )}

      {emptyPast ? (
        <Hero className="fa-hero fa-nodata" label={H.labelPast} verdict={H.noData} sub={H.pastSub}
          actions={firstOpen ? <Btn onClick={() => logInto(firstOpen)}>{P.backfillFirst(firstOpen.label)}</Btn> : undefined}
          graphic={<BowlGauge plain />}
        >
        </Hero>
      ) : mode === 'GUIDANCE' ? (
        // GUIDANCE: no calorie target — the guidance face replaces the bowl, „Miből jön össze?" and the macros.
        <FuelGuidanceCard
          category={fuel.recoveryCategory === 'STOMACH' ? 'STOMACH' : 'ILLNESS'}
          day={fuel.recoveryDay}
          waterMl={fuel.consumed.water}
          waterTargetMl={fuel.targets.water}
          eatenKcal={fuel.consumed.kcal}
          onWater={() => setWaterOpen(true)}
        />
      ) : (
        <FuelEnergyHero
          vm={keretHeroVm}
          past={past}
          trajectory={trajectory}
          mode={mode}
          note={mode === 'MAINTENANCE' || mode === 'ESTIMATE' ? <FuelRecoveryNote mode={mode} deficitDropped={deficitDropped(keretHeroVm, trajectory, mode)} /> : null}
          // A15: the shared sheet, opened at its first section — offered inside the equation sheet.
          onOpenEnergy={() => setEnergyOpen('base')}
          onWater={() => setWaterOpen(true)}
          weeklyCard={past ? null : weeklyCard}
          onLog={logGeneric}
        />
      )}

      {/* A10/A14: the day's blocks — you log INTO a block, and a logged meal opens from here. `onLogInto`
          goes to the logger with the window key (`?w=`, mezo-bq2t) and the viewed day. */}
      <Section n={++n} title={past ? M.fuelMai.blocks.sectionPast(doneRows.length, skippedCount) : M.fuelMai.blocks.sectionToday(doneRows.length, skippedCount)} />
      <div data-kalauz-anchor="fuel-log">
        <FuelMealBlocks
          lane={lane}
          meals={doneRows}
          day={{ wake, bed, nowHHmm: past ? null : nowHHmm, training: trainingSpan(blocks) }}
          fiberTargetG={dietSettings.fiberG}
          fuelMode={mode}
          skipping={{
            date, today, fuelMode: fuel.fuelMode,
            onSkip: (tile) => skip(mealTarget(tile.skipKey), (row) => setWhyId(row.id), tile.budgetKcal ?? tile.kcal),
            onReason: (tile) => tile.skip && setWhyId(tile.skip.id),
            onUndo: (tile) => tile.skip && undo(tile.skip.id, () =>
              toast.show({ kind: 'success', text: P.undoToast })),
            onAte: (tile) => {
              if (!tile.skip || ateBusy.current) return
              ateBusy.current = true
              undo(tile.skip.id, () => logInto(tile))
            },
          }}
          onLogInto={logInto}
          onOpenMeal={(mealId) => navigate(`/fuel/etkezes/${mealId}`)}
          // the score chip goes to Mezo's rating — the rest of the row to the details
          onOpenScore={(mealId) => navigate(`/fuel/etkezes/${mealId}/ertekeles`)}
        />
      </div>

      {/* The GENERIC log stands UNDER the blocks (owner): the main road is logging into a block. With it, only on
          today's view, the „yesterday can still be added" row — on a paged-back day the pager IS that road. */}
      <Section n={++n} title={P.outside} />
      <Card className="fa-outside">
        <Row className="fa-loggeneric" icon="t-bowl" title={P.logAnything} sub={P.logAnythingSub} aria-label={P.logAnythingAria} onClick={logGeneric} />
        {!past && !yPending && yMissed > 0 && fuelY.fuelMode == null && (
          <Row className="fa-bait" icon="t-history" title={P.bait(fmtDate(yesterday, 'long'), yMissed)} sub={P.baitSub}
            aria-label={P.baitAria(fmtDate(yesterday, 'long'), yMissed)} onClick={() => navigate(`/fuel?d=${yesterday}`)} />
        )}
      </Card>

      {/* Task 11 (mezo-3n2so): the day's mark closes the page. Nothing — no section head either — while the day
          is unlogged or the read is pending. */}
      <DayLearningMark date={date} today={!past} n={++n} />

      <MealSkipSheet
        open={Boolean(whySkip)}
        skip={whySkip}
        slotLabel={whyTile?.label ?? ''}
        onClose={() => setWhyId(null)}
        onReason={(reason, text) => whySkip && setReason(mealTarget(whySkip.sessionKey), reason, text)}
        onDone={(text) => {
          // The sheet already toasts „Megjegyeztem · …"; only an Egyéb text still needs saving.
          if (whySkip?.reasonCategory === 'OTHER' && (text ?? null) !== (whySkip.reasonText ?? null)) {
            setReason(mealTarget(whySkip.sessionKey), 'OTHER', text)
          }
        }}
        canOpenRecovery={!recovery.period}
        openRecovery={(req) => openRecovery.mutateAsync(req)}
      />
      {waterOpen && (
        <WaterLogSheet
          currentMl={fuel.consumed.water}
          targetMl={fuel.targets.water}
          onLog={(ml) => logWater(ml)}
          // „Visszavonom az utolsót" (approved 2026-10-12): the link needs THIS page's hook instance
          onUndo={undoLastWater}
          canUndo={canUndo}
          onClose={() => setWaterOpen(false)}
        />
      )}
      {energyOpen && energyBreakdown && (
        <EnergyBreakdownSheet breakdown={energyBreakdown} initial={energyOpen} onClose={() => setEnergyOpen(null)} />
      )}
    </Page>
  )
}

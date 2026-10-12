// ============================================================
// Mezo · FuelMealBlocks — the day's meal blocks on the Fuel Mai (Folyadék F5, mezo-n4wf5.5; prototype
// vilagos/fuel.js `blockCard`, `extraCard`, `mealRow`). Name and props are the Titanium blocks'
// (Fuel Titanium S1b, mezo-33k6; manifest A10 day meal list · A11 per-meal rating · A14 the eating
// window folds INTO the block).
//
// Owner decisions the markup carries:
//   • the blocks ARE the list, and you log INTO a block (the generic log sits under them, FuelMaiPage);
//     „Logolás ide" is the filled button only on the window that is open NOW, outlined everywhere else,
//   • a logged meal's row carries its NAME full width, under it the four small capsules (protein / carbs /
//     fat = the meal's own energy shares, fibre = the share of the day's amount) and the two chips
//     (blood sugar band · Mezo's rating) — no kcal in the row: the block's cup says it once,
//   • the head keeps a REAL clock (`Dial`, the one allowed circle) that opens the clock box, and the
//     window's cup: the logged kcal against the window's OWN budget,
//   • a window-less extra log is its own block at its logged time, titled „Ablakon kívül · HH:mm"
//     (logic/buildDayPlan, step 3b), with a plain kcal number instead of a cup.
//
// Honest-null + shame-free: an unknown kcal is „—", a closed window reads „még pótolható" in a neutral
// voice, a skip is never a miss.
// ============================================================
import { useState } from 'react'
import { toMin } from '@/data/fuel/fuelConfig'
import { useM } from '@/shared/i18n'
import { fmtGrouped, fmtNum } from '@/shared/lib/format'
import { Acts, Btn, Bub, Card, Empty, Lk, Mini, St } from '@/shared/ui/folyadek'
import type { Icon3DName } from '@/shared/ui/clay'
import { Dial, GlyChip, MACRO_COLOR, MealCells, PlainCup, ScoreChip, SlotCup, Tip } from '@/features/fuel/components/folyadek'
import { glycemicBand } from '@/features/fuel/logic/glycemicBand'
import { GlycemicGlassFor } from '@/features/fuel/components/GlycemicGlass'
import { durHu } from '@/features/fuel/logic/mealWindow'
import { MealClockBox, type ClockDay } from '@/features/fuel/components/MealClockBox'
import type { MealSlot } from '@/data/types'
import type { WindowLaneVM, WindowTileVM } from '@/features/fuel/logic/fuelSwimlane'
import type { DoneMealRow } from '@/features/fuel/logic/keretHero'
import { MEAL_REASONS, canSkipMealOn, mealSkipLabel } from '@/features/fuel/logic/mealSkips'
import type { FuelMode } from '@/features/fuel/logic/fuelMode'

/** Kihagyás S3 (mezo-q4xt2.3): the one-tap meal skip. Omit it and the blocks show no skip UI at
 *  all (the page owns the writes — this component stays presentational). */
export interface MealSkipActions {
  /** The viewed day and today (ISO) — a skip may target today and the last 7 days. */
  date: string
  today: string
  /** `GUIDANCE` days are not budgeted — there is nothing to skip, so the button is hidden. */
  fuelMode: FuelMode | null
  /** „Kihagyom" — the page upserts the skip (NONE) and opens the reason sheet. */
  onSkip: (tile: WindowTileVM) => void
  /** „Másik ok" / „Okot adok" — open the reason sheet for the skipped window. */
  onReason: (tile: WindowTileVM) => void
  /** „Visszavonom" — undo the skip. */
  onUndo: (tile: WindowTileVM) => void
  /** „Mégis ettem" — undo the skip, then log into the window. */
  onAte: (tile: WindowTileVM) => void
}

/** The block's glyph by meal kind (prototype `SLOTS[i].ic`). */
const SLOT_ICON: Record<MealSlot, Icon3DName> = { breakfast: 't-sun', lunch: 't-bowl', snack: 't-snack', dinner: 't-moon' }

/** @deprecated The old score chip's name, kept ONLY until the meal page (area C) and the recipe page (area H)
 *  switch to the shared `ScoreChip` (plan § „The cuts"); the controller deletes this export then. */
export function FuelScoreChip({ scorePct, onOpen, size }: {
  scorePct: number | null; onOpen?: () => void; size?: 'big'; unboxed?: boolean; index?: number
}) {
  return <ScoreChip score={scorePct == null ? null : scorePct / 10} onOpen={onOpen} big={size === 'big'} />
}

/** The row's band from the stored facts — the SAME derivation the meal page's box gets. */
function bandOf(row: DoneMealRow) {
  return glycemicBand({ c: row.carbsG, sugarG: row.sugarG, fiberG: row.fiberG, p: row.proteinG, f: row.fatG })
}

/** A meal's four capsules. All three macros known → the shared `MealCells`; a missing gram is an honest „—"
 *  and then NO capsule shows a share (a truncated composition has no energy split). */
function Cells({ row, fiberTargetG }: { row: DoneMealRow; fiberTargetG: number }) {
  const M = useM()
  const { proteinG: p, carbsG: c, fatG: f, fiberG } = row
  if (p != null && c != null && f != null) {
    return <MealCells protein={p} carbs={c} fat={f} fiber={fiberG} fiberTarget={fiberTargetG} />
  }
  const K = M.fuelKozos
  const B = M.fuelMai.blocks
  const cells: Array<['protein' | 'carbs' | 'fat' | 'fiber', number | null]> = [['protein', p], ['carbs', c], ['fat', f], ['fiber', fiberG]]
  const label = cells.map(([key, g]) => (g == null ? B.cellNone(K.macroLower[key]) : B.cellKnown(K.macroLower[key], fmtNum(g)))).join('; ')
  return (
    <span className="fx-cells" role="img" aria-label={label}>
      {cells.map(([key, g]) => <Mini key={key} pct={0} color={MACRO_COLOR[key]} value={g == null ? '—' : `${fmtNum(g)} g`} label={K.macroShort[key]} />)}
    </span>
  )
}

/** The skipped window's body (Kihagyás S3; prototype `blockCard` skip branch): the reason as an unboxed hint and
 *  three quiet actions. A skip is neutral: the budget stays, nothing is redistributed. */
function SkippedMeal({ tile, skipping, guidance }: { tile: WindowTileVM; skipping: MealSkipActions; guidance: boolean }) {
  const M = useM()
  const B = M.fuelMai.blocks
  const skip = tile.skip!
  const reason = MEAL_REASONS.find(r => r.value === skip.reasonCategory)
  const hasReason = skip.reasonCategory !== 'NONE'
  const kcal = tile.budgetKcal ?? tile.kcal
  return (
    <div className="fa-meal fa-skipped">
      <Tip icon={(reason?.icon ?? 't-skip') as Icon3DName} title={B.skippedTitle(mealSkipLabel(skip))} color="var(--fo-faint)">
        {/* GUIDANCE: the day has no budget, so nothing „kiesik" — just care, never a miss. */}
        {guidance ? B.skippedGuidance : kcal != null ? B.skippedBody(fmtGrouped(kcal)) : B.skippedBodyPlain}
      </Tip>
      <Acts className="fa-ska">
        <Btn sm ghost onClick={() => skipping.onReason(tile)}>{hasReason ? B.changeReason : B.addReason}</Btn>
        <Lk onClick={() => skipping.onUndo(tile)}>{B.undo}</Lk>
        <Lk onClick={() => skipping.onAte(tile)}>{B.ate}</Lk>
      </Acts>
    </div>
  )
}

function BlockCard({ tile, rows, nowHHmm, fiberTargetG, skipping, mode, onLogInto, onOpenMeal, onOpenScore, onOpenClock, onOpenGlycemic }: {
  tile: WindowTileVM
  rows: DoneMealRow[]
  /** The present time — for the „Ajánlott" line's state word and the clock's live mark. Null on a
   *  past day (mezo-6g52f R4) — no „now" anywhere. */
  nowHHmm: string | null
  /** The fibre capsule's denominator (mezo-l2gp0) — `dietSettings.fiberG`. */
  fiberTargetG: number
  skipping?: MealSkipActions
  /** Kímélő mód (Kihagyás S3): GUIDANCE drops every budget cue; MAINTENANCE/ESTIMATE only drop
   *  the „még pótolható" nudge. null outside a recovery period. */
  mode: FuelMode | null
  onLogInto: (tile: WindowTileVM) => void
  onOpenMeal: (mealId: string) => void
  /** The score chip's OWN target: Mezo's rating, not the meal's details (mezo-jb84). */
  onOpenScore: (mealId: string) => void
  /** The clock's target (mezo-6g52f): the clock box for this block. */
  onOpenClock: (tileKey: string) => void
  /** The blood sugar chip's target (mezo-ya2wp): the glycemic sheet for the same meal. */
  onOpenGlycemic: (mealId: string) => void
}) {
  const M = useM()
  const B = M.fuelMai.blocks
  const logged = rows.length > 0
  const loggedKcal = logged
    ? rows.reduce<number | null>((sum, r) => (sum == null || r.kcal == null ? null : sum + r.kcal), 0)
    : null
  const windowed = tile.windowFrom != null && tile.windowTo != null
  const lo = windowed ? toMin(tile.windowFrom!) : 0
  const hi = windowed ? toMin(tile.windowTo!) : 0
  const now = nowHHmm == null ? null : toMin(nowHHmm)

  const skipped = tile.state === 'skipped' && tile.skip != null && !logged
  // „Kihagytam": the window is closed (a past day, or the clock is past its end) — past tense.
  const closed = now == null || (tile.windowTo != null && now > hi)
  // this window is open right now (its OWN window, not the day's first unlogged one — mezo-6g52f R1)
  const nowIn = windowed && now != null && now >= lo && now <= hi
  const guidance = mode === 'GUIDANCE'
  const canSkip = Boolean(skipping) && !skipped && !logged && tile.skipKey != null
    && !guidance && canSkipMealOn(skipping!.date, skipping!.today)

  /** The state word of the „Ajánlott …" line — shame-free: a closed window is no error. */
  const whenWord = now == null ? B.when.canAdd
    : now < lo ? (lo - now <= 90 ? B.when.opensIn(durHu(lo - now)) : B.when.opensAt(tile.windowFrom!))
      : now <= hi ? B.when.openNow(durHu(hi - now)) : B.when.canAdd
  const windowClosed = now == null || now > hi
  /** The second line of „Logolás ide": a neutral sentence tied to THIS window. */
  const logSub = !windowed
    ? (mode != null && (guidance || tile.state === 'missed') ? B.logSub.ifAte
      : tile.state === 'missed' ? B.logSub.canAdd : tile.state === 'now' ? B.logSub.openNow : B.logSub.around(tile.time))
    : mode != null && (guidance || tile.state === 'missed' || windowClosed) ? B.logSub.ifAte
      : tile.state === 'missed' || windowClosed ? B.logSub.canAdd
        : now! < lo ? B.logSub.noRush : B.logSub.now

  const first = rows[0] ?? null
  const clockAria = first ? B.clockLogged(tile.label, first.time)
    : windowed ? B.clockWindow(tile.label, tile.windowFrom!, tile.windowTo!) : tile.label

  return (
    <Card className={`fa-blk is-${tile.state}${logged ? ' is-logged' : ' open'}`} aria-label={skipped ? B.skippedAria(tile.label) : tile.label}>
      <div className="fa-bhd">
        <Bub icon={SLOT_ICON[tile.slotKey]} size={44} />
        <span className="g"><strong>{tile.label}</strong></span>
        <button type="button" className={`fa-clock${nowIn && !logged ? ' live' : ''}`} onClick={() => onOpenClock(tile.key)} aria-label={clockAria}>
          <Dial from={tile.windowFrom} to={tile.windowTo} at={first ? first.time : nowIn ? nowHHmm : null} />
        </button>
        {/* A window-less block (an extra log) has no budget: the plain kcal number stands where the cup would. */}
        {skipped ? <St tone="q">{B.skippedPill}</St>
          : guidance || !windowed || tile.budgetKcal == null
            // GUIDANCE: no cup — a logged block shows its kcal plain, an empty one nothing.
            ? (logged ? (!guidance || loggedKcal != null) && <PlainCup kcal={loggedKcal} /> : !guidance && <PlainCup kcal={tile.kcal} />)
            : logged && loggedKcal == null ? <PlainCup kcal={null} />
              : <SlotCup kcal={logged ? loggedKcal! : 0} budget={tile.budgetKcal} neutral={mode != null} />}
      </div>
      {rows.map(r => {
        const band = bandOf(r)
        return (
          <div key={r.mealId} className="fa-meal">
            <button type="button" className="fa-mn" onClick={() => onOpenMeal(r.mealId)}>
              <strong>{r.name || B.mealFallback}</strong>
            </button>
            <div className="fa-mb">
              <Cells row={r} fiberTargetG={fiberTargetG} />
              {/* the two chips are one group, so at 320 px they wrap TOGETHER under the capsules. A row without
                  carbohydrate data has no band and no chip — nothing is guessed. */}
              <span className="fa-chips">
                {band && <GlyChip level={band.level} onOpen={() => onOpenGlycemic(r.mealId)} />}
                <ScoreChip score={r.scorePct == null ? null : r.scorePct / 10} onOpen={() => onOpenScore(r.mealId)} />
              </span>
            </div>
          </div>
        )
      })}
      {skipped && skipping && <SkippedMeal tile={tile} skipping={skipping} guidance={guidance} />}
      {!logged && !skipped && (
        <>
          {guidance
            ? <p className="fa-when">{B.guidanceWhen}</p>
            : windowed && (
              <p className="fa-when">
                {B.suggested} <b>{tile.windowFrom}–{tile.windowTo}</b>
                {/* In gentle mode nothing is „pótolandó": the closed window's state word is left out. */}
                {!(mode != null && windowClosed) && <> · <span className={nowIn ? 'now' : undefined}>{whenWord}</span></>}
              </p>
            )}
          <Acts className="fa-la">
            <Btn sm ghost={!nowIn} className="fa-log" onClick={() => onLogInto(tile)} aria-label={B.logHereAria(tile.label)}>
              <span>{B.logHere}</span>
              <small>{logSub}</small>
            </Btn>
            {canSkip && (
              <Lk className="fa-skip" aria-label={B.skipAria(tile.label)} onClick={() => skipping!.onSkip(tile)}>
                {closed ? B.skipDone : B.skip}
              </Lk>
            )}
          </Acts>
        </>
      )}
    </Card>
  )
}

export function FuelMealBlocks({ lane, meals, day, fiberTargetG, skipping, fuelMode, onLogInto, onOpenMeal, onOpenScore }: {
  lane: WindowLaneVM
  meals: DoneMealRow[]
  /** The clock box's day frame (mezo-6g52f) — the windows and the meal count come from the lane.
   *  `nowHHmm` is null on a past day (R4) — no „now" anywhere. */
  day: { wake: string; bed: string; nowHHmm: string | null; training: { start: string; end: string; label: string } | null }
  /** The fibre capsule's denominator (mezo-l2gp0) — `dietSettings.fiberG`. */
  fiberTargetG: number
  /** Kihagyás S3: the meal-skip actions; omitted ⇒ no skip UI. */
  skipping?: MealSkipActions
  /** The day's kímélő-mód Fuel behaviour (Kihagyás S3) — falls back to `skipping.fuelMode`. */
  fuelMode?: FuelMode | null
  onLogInto: (tile: WindowTileVM) => void
  onOpenMeal: (mealId: string) => void
  onOpenScore: (mealId: string) => void
}) {
  const M = useM()
  const mode = fuelMode ?? skipping?.fuelMode ?? null
  const [clockFor, setClockFor] = useState<string | null>(null)
  const [glucoseFor, setGlucoseFor] = useState<string | null>(null)
  const glucoseRow = meals.find(m => m.mealId === glucoseFor) ?? null
  const glucoseBand = glucoseRow ? bandOf(glucoseRow) : null
  const clockTile = lane.tiles.find(t => t.key === clockFor) ?? null
  // mealCount counts only the REAL windowed tiles (the same set as `windows` below) — a surplus extra log
  // must not distort the „n-th meal of M" number (mezo-6g52f minor a).
  const windowedTiles = lane.tiles.filter(t => t.windowFrom && t.windowTo)
  const clockDay: ClockDay = {
    ...day,
    windows: windowedTiles.map(t => ({ key: t.key, from: t.windowFrom!, to: t.windowTo! })),
    mealCount: windowedTiles.length,
  }
  if (lane.tiles.length === 0) {
    return (
      <div className="fa-blocks">
        <Card><Empty icon="t-plate">{M.fuelMai.blocks.empty}</Empty></Card>
      </div>
    )
  }
  return (
    <div className="fa-blocks">
      {lane.tiles.map((tile) => (
        <BlockCard key={tile.key} tile={tile} nowHHmm={day.nowHHmm} fiberTargetG={fiberTargetG} skipping={skipping} mode={mode}
          rows={meals.filter(m => m.mealId === tile.mealId)}
          onLogInto={onLogInto} onOpenMeal={onOpenMeal} onOpenScore={onOpenScore} onOpenClock={setClockFor}
          onOpenGlycemic={setGlucoseFor} />
      ))}
      {clockTile && (
        <MealClockBox tile={clockTile} row={meals.find(m => m.mealId === clockTile.mealId) ?? null}
          day={clockDay} next={lane.tiles[lane.tiles.indexOf(clockTile) + 1] ?? null}
          blockColor="var(--dom)" onClose={() => setClockFor(null)} />
      )}
      {/* the same sheet the meal page's fourth card opens — one component, one derivation, two doors */}
      {glucoseBand && glucoseRow && (
        <GlycemicGlassFor mealId={glucoseRow.mealId} band={glucoseBand} onClose={() => setGlucoseFor(null)} />
      )}
    </div>
  )
}

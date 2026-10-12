// ============================================================
// Mezo · FuelEnergyHero — the Fuel Mai hero: the day's BOWL (Folyadék F5, mezo-n4wf5.5; prototype
// vilagos/fuel.js `mai()` → `bowlHero` + the `eq` sheet). Name and props are the Titanium energy
// instrument's (Fuel Titanium S1a, mezo-33k6; manifest rows A1 hero + A2 macros + A15 energy provenance);
// the gauge ring is gone — a number is a level (bible §1.4).
//
// Anatomy top→bottom:
//   the hero card — label · eaten | the bowl filled to the budget (the skipped windows a faint dashed band
//     above the liquid) | what still fits · the VERDICT sentence (the remaining kcal and the missing protein
//     in one line; gentle-mode and past-day faces have their own) · the skipped-windows line · on the liquid:
//     the one primary button („Étkezés logolása") and the „Miből jön össze?" link
//   the recovery note (`note`, a card of its own)
//   section 1 — the five macro vials (FuelMacroRings)
//
// A15 — one provenance surface, not two: „Miből jön össze?" (and a tap on the bowl) opens the equation
// SHEET, which renders `heroEquationLines(vm)`; its „Részletesen…" button hands over to the parent's shared
// EnergyBreakdownSheet (`onOpenEnergy`).
//
// Adherence-neutral by contract: an overshoot day says „a keret felett" — never a word that grades the user;
// ESTIMATE (a travel day) says „körül", never „felett". Honest-null: a missing equation component is „—".
//
// Weekly learning (mezo-3n2so): on TODAY, with a weekly card worth showing, a dot sits on the link; inside
// the sheet the Alap row becomes ONE button that swaps the sheet for „Heti tanulás".
// ============================================================
import { SafeMarkdown } from '@/shared/lib/safeMarkdown'
import { useId, useState, type ReactNode } from 'react'
import { pct } from '@/shared/lib/pct'
import { fmtGrouped } from '@/shared/lib/format'
import { useM } from '@/shared/i18n'
import { Sheet } from '@/shared/ui/Sheet'
import { Acts, Btn, Bub, Card, FoSheetHead, Hero, Level, Lk, Note, Row, Section } from '@/shared/ui/folyadek'
import type { Icon3DName } from '@/shared/ui/clay'
import { BowlGauge, Tot } from '@/features/fuel/components/folyadek'
import { deficitDropped, heroEquationLines, type EquationLine, type KeretHeroVM } from '@/features/fuel/logic/keretHero'
import { FuelMacroRings } from '@/features/fuel/components/FuelMacroRings'
import { WeeklyLearningDot } from '@/features/fuel/components/WeeklyLearningDot'
import { WeeklyLearningSheet } from '@/features/fuel/sheets/WeeklyLearningSheet'
import { signed } from '@/features/fuel/sheets/learnedBaseFormat'
import type { ExpenditureWeeklyCard } from '@/data/fuel/expenditureApi'
import type { FuelMode } from '@/features/fuel/logic/fuelMode'

type Trajectory = 'cut' | 'bulk' | 'maintain' | null

/** One glyph per equation row (prototype `eq`). */
const ROW_ICON: Record<Exclude<EquationLine['key'], 'remaining'>, Icon3DName> = {
  base: 't-flame', activity: 't-dumbbell', goal: 't-ring', eaten: 't-bowl',
}

/** Sign + value, honest-null aware: a missing component is „—", and the sign stays so the row
 *  still reads as part of the equation. */
function rowValue(line: EquationLine): string {
  if (line.sign === '±') {
    // Célod carries its OWN sign: − (U+2212) for a deficit, + for a surplus.
    if (line.value == null) return '—'
    if (line.value === 0) return fmtGrouped(0)
    return `${line.value < 0 ? '−' : '+'} ${fmtGrouped(Math.abs(line.value))}`
  }
  if (line.value == null) return line.sign == null || line.sign === '=' ? '—' : `${line.sign} —`
  if (line.sign == null || line.sign === '=') return fmtGrouped(line.value)
  return `${line.sign} ${fmtGrouped(Math.abs(line.value))}`
}

function EquationSheet({ vm, past, trajectory, mode, onClose, onFull, weekly, onWeekly }: {
  vm: KeretHeroVM; past: boolean; trajectory: Trajectory; mode: FuelMode | null; onClose: () => void
  /** A15: the parent's shared energy explanation — the sheet's quiet door. */
  onFull?: () => void
  /** mezo-3n2so: the weekly card when the Alap row should open it (today only). */
  weekly?: ExpenditureWeeklyCard | null
  onWeekly?: () => void
}) {
  const M = useM()
  const E = M.fuelMai.eq
  const titleId = useId()
  // Kihagyás S3: only when the cut's deficit was really dropped does the Célod row say „szünetel".
  const goalPaused = deficitDropped(vm, trajectory, mode)
  const lines = heroEquationLines(vm, trajectory, goalPaused)
  const over = vm.remainingKcal < 0
  const abs = fmtGrouped(Math.abs(vm.remainingKcal))
  // ESTIMATE never says „felett": the budget is only informative on a travel day.
  const big = over ? (mode === 'ESTIMATE' ? E.big.overEstimate(abs) : E.big.over(abs)) : past ? E.big.leftPast(abs) : E.big.left(abs)
  const skipped = vm.skippedKcal
  const remaining = lines.find(l => l.key === 'remaining')!

  const sub = (line: EquationLine): ReactNode => {
    switch (line.key) {
      case 'base': return vm.baseSource === 'learned' ? E.baseLearned : E.baseFormula
      case 'activity': {
        const base = past ? E.activityPast : E.activity
        const pending = !past ? vm.chips?.pending ?? 0 : 0
        return (
          <>
            {vm.chips?.extra ? E.activityExtra(base) : base}
            {pending > 0 && <i className="fa-pend">{E.pending(fmtGrouped(pending))}</i>}
          </>
        )
      }
      case 'goal':
        if (goalPaused) return E.goalPaused
        // „tartás" only for a truly zero balance; a maintain goal's non-zero residual (the BMR floor)
        // gets no sub rather than a word that contradicts its signed number.
        if (trajectory === 'maintain') return line.value === 0 ? E.goal.maintain : undefined
        return trajectory ? E.goal[trajectory] : undefined
      case 'eaten': return past ? E.foodPast : E.food
      default: return undefined
    }
  }
  const weeklyWord = (card: ExpenditureWeeklyCard): string => {
    if (card.status === 'holding') return E.weeklyWord.holding
    if (card.stepKcal !== 0) return E.weeklyWord.step(signed(card.stepKcal))
    const n = card.excludedDays.length
    return n ? E.weeklyWord.excluded(n) : E.weeklyWord.same
  }

  return (
    <Sheet onClose={onClose} labelledBy={titleId} className="fo-sheet fa-eq">
      {(close) => (
        <>
          <FoSheetHead icon="t-bowl" title={big} titleId={titleId} sub={past ? M.fuelMai.hero.whyPast : M.fuelMai.hero.why} />
          <div className="fa-eqb" role="img" aria-label={E.barAria(fmtGrouped(vm.consumedKcal))}>
            <Level pct={pct(vm.consumedKcal, vm.targetKcal)} height={22} />
            {/* ESTIMATE never says „felett": on a travel day the right caption is left out once the bar is full */}
            <p className="fa-eqc"><span>{E.eaten}</span>{!(over && mode === 'ESTIMATE') && <span>{over ? E.overBy(abs) : E.free}</span>}</p>
          </div>
          <div className="fa-eqrows">
            {lines.filter(l => l.key !== 'remaining').map((line) => {
              const key = line.key as Exclude<EquationLine['key'], 'remaining'>
              if (key === 'base' && weekly && onWeekly) {
                const hold = weekly.status === 'holding'
                return (
                  <Row key={key} className="fa-eqrow is-weekly" icon={ROW_ICON.base}
                    title={<>{line.label}<WeeklyLearningDot hold={hold} /></>}
                    sub={E.weeklyTail(String(sub(line)))} value={rowValue(line)}
                    aria-label={E.weeklyAria(rowValue(line), weeklyWord(weekly))}
                    onClick={() => { onClose(); onWeekly() }} />
                )
              }
              return <Row key={key} className="fa-eqrow" data-row={key} icon={ROW_ICON[key]} title={line.label} sub={sub(line)} value={rowValue(line)} />
            })}
            {skipped > 0 && (
              <Row className="fa-eqrow is-skipped" data-row="skipped" icon="t-skip" title={E.skipped} sub={E.skippedSub} value={`− ${fmtGrouped(skipped)}`} />
            )}
          </div>
          <Tot data-row="remaining" label={remaining.label} sub={past ? E.leftSubPast : E.leftSub} value={rowValue(remaining)} unit="kcal" />
          <Note>{past ? E.notePast : vm.chips == null ? E.noteStatic(fmtGrouped(vm.targetKcal)) : E.note}</Note>
          <Acts>
            {/* A15: the detailed, Én-shared energy explanation keeps a quiet door of its own. It swaps the sheets at once
                (no slide-out), like the Alap row's weekly door: two sheets never stand on each other. */}
            {onFull && <Btn sm onClick={() => { onClose(); onFull() }}>{E.full}</Btn>}
            <Lk onClick={close}>{E.close}</Lk>
          </Acts>
        </>
      )}
    </Sheet>
  )
}

export function FuelEnergyHero({ vm, past = false, trajectory = null, onOpenEnergy, onWater, weeklyCard = null, mode = null, note = null, onLog }: {
  vm: KeretHeroVM
  /** A13: a PAST day is viewed — the word „ma" would be a lie then. */
  past?: boolean
  /** The active goal's direction — picks the Célod row's copy (mezo-32m82); no goal → null. */
  trajectory?: Trajectory
  /** A15: the door to the parent's shared energy explanation, offered inside the equation sheet. */
  onOpenEnergy?: () => void
  /** Keeps the water vial a live water-logging door (see FuelMacroRings). */
  onWater?: () => void
  /** mezo-3n2so: the weekly learning summary worth showing (null = nothing to say). Only today's
   *  hero signals it — a past day never shows the dot or the highlighted Alap row. */
  weeklyCard?: ExpenditureWeeklyCard | null
  /** Kímélő mód (Kihagyás S3): MAINTENANCE marks the protein vial as the focus and pauses the goal row;
   *  ESTIMATE mutes the numerals and speaks of a budget „körül", never „felett". GUIDANCE never
   *  reaches the hero (the page shows the guidance card instead). */
  mode?: FuelMode | null
  /** The recovery note, placed between the hero and the macro vials. */
  note?: ReactNode
  /** The hero's one primary button („Étkezés logolása" / „Pótlás erre a napra"); omitted ⇒ no button. */
  onLog?: () => void
}) {
  const M = useM()
  const H = M.fuelMai.hero
  const [boxOpen, setBoxOpen] = useState(false)
  // The card is snapshot when the sheet opens: a dismiss (or a mark's refetch) may null the live
  // card while the sheet is still sliding out.
  const [weeklyShown, setWeeklyShown] = useState<ExpenditureWeeklyCard | null>(null)
  const weekly = past ? null : weeklyCard
  const over = vm.remainingKcal < 0
  const estimate = mode === 'ESTIMATE'
  const abs = fmtGrouped(Math.abs(vm.remainingKcal))

  // the verdict: the remaining kcal and the missing protein, two real numbers in one sentence
  const protein = vm.rings.find(r => r.key === 'p')
  const pValue = protein?.amount ?? null
  const pTarget = protein?.goal ?? null
  const proteinLeft = pValue != null && pTarget != null ? Math.max(0, Math.round(pTarget - pValue)) : 0
  const verdict = over
    ? (estimate ? H.overEstimate : past ? H.overPast(abs) : H.over(abs))
    : past ? H.past(abs)
      : estimate ? H.estimate(abs)
        : proteinLeft > 0 ? H.left(abs, fmtGrouped(proteinLeft)) : H.leftProteinDone(abs)
  const remLabel = over ? (estimate ? H.rem.overEstimate : H.rem.over) : past ? H.rem.leftPast : estimate ? H.rem.leftEstimate : H.rem.left
  const open = () => setBoxOpen(true)

  return (
    <>
      <Hero className={estimate ? 'fa-hero est' : 'fa-hero'} label={past ? H.labelPast : H.labelToday} verdict={verdict} sub={past ? H.pastSub : undefined}
        actions={(
          <>
            {onLog && <Btn onClick={onLog}>{past ? H.logPast : H.log}</Btn>}
            <Lk className="fa-eql" onClick={open}>
              {past ? H.whyPast : H.why}
              {weekly && <WeeklyLearningDot hold={weekly.status === 'holding'} />}
            </Lk>
          </>
        )}
        graphic={<BowlGauge eaten={vm.consumedKcal} target={vm.targetKcal} rem={vm.remainingKcal} remLabel={remLabel}
          skipped={vm.skippedKcal} over={over && !estimate} onClick={open} />}
      >
        {vm.skippedKcal > 0 && (
          <button type="button" className="fa-skl" onClick={open}>
            <Bub icon="t-skip" size={26} color="var(--fo-faint)" />
            <span><SafeMarkdown text={H.skipped(vm.skippedLabels.join(', '), fmtGrouped(vm.skippedKcal))} /></span>
          </button>
        )}
      </Hero>
      {note}
      <Section n={1} title={past ? M.fuelMai.macros.titlePast : M.fuelMai.macros.titleToday} />
      <Card className="fa-maccard">
        <FuelMacroRings rings={vm.rings} onWater={onWater} leadKey={mode === 'MAINTENANCE' ? 'p' : undefined} />
        {!past && onWater && <Note>{M.fuelMai.macros.waterNote}</Note>}
      </Card>
      {boxOpen && (
        <EquationSheet vm={vm} past={past} trajectory={trajectory} mode={mode} onClose={() => setBoxOpen(false)}
          onFull={onOpenEnergy && vm.chips != null && !past ? onOpenEnergy : undefined}
          weekly={weekly} onWeekly={() => setWeeklyShown(weekly)} />
      )}
      {weeklyShown && <WeeklyLearningSheet card={weeklyShown} onClose={() => setWeeklyShown(null)} />}
    </>
  )
}

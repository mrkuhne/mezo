// ============================================================
// Mezo · FuelEnergyHero — the Fuel Mai Titanium energy instrument (Fuel Titanium S1a,
// mezo-33k6; frozen manifest rows A1 hero + A2 rings + A15 energy provenance).
//
// Ported from the approved prototype docs/design_2.0/prototypes/companion-titanium/
// fuel-dashboard.js — `heroSection` (:56, the h2 variant the owner picked: ONE dominant
// number), `gauge` (:53), `tapChip` (:55) and `energyDetailHtml` (:67). Anatomy top→bottom:
//   the gauge — the bowl clay icon inside a progress arc whose sweep is the day's eaten
//     fraction (the bowl is the already-approved, 10%-larger calibration)
//   the DOMINANT remaining-kcal numeral with its `kcal ma` unit
//   the tap chip — the only door to the math
//   the five macro rings (FuelMacroRings)
//
// A15 — one provenance surface, not two: with `onOpenEnergy` the chip hands the tap to the
// parent (FuelMaiPage opens the shared EnergyBreakdownSheet, the same surface the Én hub
// uses). Standalone (no prop) the hero opens its own glass box, which renders
// `heroEquationLines(vm)` as the prototype's equation flow. The box is a native <GlassBox onClose={onClose}>:
// Escape and the backdrop are the platform's job, not ours. jsdom ships no HTMLDialogElement,
// so `showModal`/`close` are feature-detected and fall back to the `open` attribute.
//
// Adherence-neutral by contract: an overshoot day flips the numeral's sign (Unicode minus)
// and the label reads „A keret felett" — never a word that grades the user. Honest-null: a
// missing equation component renders „—", never a fabricated 0.
//
// Weekly learning (mezo-3n2so, spec §5.1, elo/fuel.html `eqDot`/`openEq`): on TODAY, with a
// weekly-summary card worth showing, a glowing dot sits on the chip; inside the box the Alap row
// is highlighted (tinted fill + accent ring + dot + „· heti tanulás ›”) and becomes ONE full-width
// button that swaps the box for the „Heti tanulás” sheet. Without a card nothing changes.
// ============================================================
import { Fragment, useId, useState } from 'react'
import { pct } from '@/shared/lib/pct'
import { huInt } from '@/shared/lib/huNum'
import { ContentIcon, Icon3D, type ClayIconName, type Icon3DName } from '@/shared/ui/clay'
import { deficitDropped, heroEquationLines, type EquationLine, type KeretHeroVM } from '@/features/fuel/logic/keretHero'
import { FuelMacroRings, useFuelCountUp } from '@/features/fuel/components/FuelMacroRings'
import { GlassBox } from '@/features/fuel/components/GlassBox'
import { WeeklyLearningDot } from '@/features/fuel/components/WeeklyLearningDot'
import { WeeklyLearningSheet } from '@/features/fuel/sheets/WeeklyLearningSheet'
import { signed } from '@/features/fuel/sheets/learnedBaseFormat'
import type { ExpenditureWeeklyCard } from '@/data/fuel/expenditureApi'
import type { FuelMode } from '@/features/fuel/logic/fuelMode'

type Trajectory = 'cut' | 'bulk' | 'maintain' | null

// One hue + one Titanium symbol per equation row — the prototype's `glass-node` palette, expressed
// in house tokens. Alap wears the flame (the BMR tile's own sprite on the shared energy sheet);
// the target ring (`i-cel` → t-ring) moved to Célod (mezo-32m82). No violet exists in the Üveg
// palette, so Célod takes the rose accent.
// Alap sub copy: the learned-base path (mezo-zz91i) reads differently from the formula one.
const BASE_SUB = {
  formula: 'az alapanyagcseréd és az életmódod',
  learned: 'a súlytrendedből és az evésedből tanulva',
} as const

const NODE: Record<EquationLine['key'], { color: string; icon: ClayIconName | Icon3DName; sub: string }> = {
  base: { color: 'var(--amber)', icon: 't-flame', sub: BASE_SUB.formula },
  activity: { color: 'var(--sage)', icon: 'i-edzes', sub: 'ma logolt mozgásod' },
  goal: { color: 'var(--rose)', icon: 'i-cel', sub: '' },
  eaten: { color: 'var(--coral)', icon: 'i-fuel', sub: 'amit ma eddig logoltál' },
  remaining: { color: 'var(--sky)', icon: 'i-lang', sub: 'a mai kereted maradéka' },
}

const GOAL_SUB: Record<'cut' | 'bulk' | 'maintain', string> = {
  cut: 'a fogyási célod napi része',
  bulk: 'a tömegelési célod napi része',
  maintain: 'tartás',
}

/** The row's sub copy — Mozgás names an unplanned credit, Célod names the goal's direction. */
function nodeSub(line: EquationLine, vm: KeretHeroVM, trajectory: Trajectory): string {
  if (line.key === 'activity' && vm.chips?.extra) return `${NODE.activity.sub} + terven kívüli`
  // „tartás" only for a truly zero balance; a maintain goal's non-zero residual (the BMR floor)
  // gets no sub rather than a word that contradicts its signed number.
  if (line.key === 'goal') return trajectory === 'maintain' ? (line.value === 0 ? GOAL_SUB.maintain : '') : trajectory ? GOAL_SUB[trajectory] : ''
  if (line.key === 'base') return vm.baseSource === 'learned' ? BASE_SUB.learned : BASE_SUB.formula
  return NODE[line.key].sub
}

/** Sign + value, honest-null aware: a missing component is „—", and the sign stays so the row
 *  still reads as part of the equation (the prototype prints `− 1 240` the same way). */
function nodeValue(line: EquationLine): string {
  if (line.sign === '±') {
    // Célod carries its OWN sign: − (U+2212) for a deficit, + for a surplus.
    if (line.value == null) return '—'
    if (line.value === 0) return huInt(0)
    return `${line.value < 0 ? '−' : '+'} ${huInt(Math.abs(line.value))}`
  }
  if (line.value == null) return line.sign == null || line.sign === '=' ? '—' : `${line.sign} —`
  // The `=` row carries its OWN sign (an overshoot day is honestly negative); the +/− rows
  // have the operator in front, so their magnitude is what follows it.
  if (line.sign == null || line.sign === '=') return huInt(line.value)
  return `${line.sign} ${huInt(Math.abs(line.value))}`
}

/** The weekly card in a few words — the Alap row's accessible name (elo/fuel.html `weeklyWord`). */
function weeklyWord(card: ExpenditureWeeklyCard): string {
  if (card.status === 'holding') return 'ezen a héten vártam'
  if (card.stepKcal !== 0) return `${signed(card.stepKcal)} kcal`
  const n = card.excludedDays.length
  return n ? `${n} nap kimaradt` : 'a keret nem változott'
}

function EquationBox({ vm, past, trajectory, mode, onClose, onFull, weekly, onWeekly }: {
  vm: KeretHeroVM; past: boolean; trajectory: Trajectory; mode: FuelMode | null; onClose: () => void
  /** A15: a MEGLÉVŐ, Énnel közös energia-magyarázat — a doboz csendes ajtaja. */
  onFull?: () => void
  /** mezo-3n2so: the weekly card when the Alap row should open it (today only). */
  weekly?: ExpenditureWeeklyCard | null
  onWeekly?: () => void
}) {
  const titleId = useId()
  // Kihagyás S3: only when the cut's deficit was really dropped does the Célod row say „szünetel";
  // otherwise it shows the served balance like any other day.
  const goalPaused = deficitDropped(vm, trajectory, mode)
  const lines = heroEquationLines(vm, trajectory, goalPaused)
  const over = vm.remainingKcal < 0
  // ESTIMATE never says „felett": the keret is only informative on a travel day.
  const overWord = mode === 'ESTIMATE' ? 'a keret körül' : 'a keret felett'
  // Kihagyás S3: the skipped windows' share — a neutral „Kihagyva" row before „Marad".
  const skipped = vm.skippedKcal

  return (
    <GlassBox onClose={onClose}
      
      labelledBy={titleId}
    >
      <div className="fmx-glass-hero">
        <ContentIcon name="i-fuel" size={56} />
        <div>
          <strong>{huInt(Math.abs(vm.remainingKcal))}</strong>
          <small id={titleId}>kcal {over ? overWord : past ? 'fért még bele' : 'fér még bele ma'}</small>
        </div>
      </div>
      <div className="fmx-glass-bar" role="img"
        aria-label={`A napi keretedből ${huInt(vm.consumedKcal)} kcal fogyott el`}>
        <i style={{ '--w': `${pct(vm.consumedKcal, vm.targetKcal)}%` } as React.CSSProperties} />
        {skipped > 0 && (
          <em className="fmx-gb-skip" aria-hidden="true"
            style={{ '--l': `${pct(vm.consumedKcal, vm.targetKcal)}%`, '--w': `${Math.min(100 - pct(vm.consumedKcal, vm.targetKcal), pct(skipped, vm.targetKcal))}%` } as React.CSSProperties} />
        )}
        <span className="fmx-gb-left">ettél</span>
        <span className="fmx-gb-right">még szabad</span>
      </div>
      <div className="fmx-flow">
        {lines.map(line => {
          if (line.key === 'base' && weekly && onWeekly) {
            const hold = weekly.status === 'holding'
            return (
              <button key={line.key} type="button" className={`fmx-node is-weekly${hold ? ' is-hold' : ''}`}
                aria-label={`Alap ${nodeValue(line)} kcal — heti tanulás: ${weeklyWord(weekly)}, megnyitás`}
                onClick={onWeekly}>
                <span className="fmx-node-art"><ContentIcon name={NODE.base.icon} size={24} /></span>
                <span className="fmx-node-copy">
                  <strong>{line.label}<WeeklyLearningDot hold={hold} /></strong>
                  <small>{nodeSub(line, vm, trajectory)} · heti tanulás ›</small>
                </span>
                <b>{nodeValue(line)}</b>
              </button>
            )
          }
          const node = (
            <div key={line.key} className={`fmx-node${line.key === 'remaining' ? ' is-total' : ''}`}
              style={{ '--node-color': NODE[line.key].color } as React.CSSProperties}>
              <span className="fmx-node-art"><ContentIcon name={NODE[line.key].icon} size={24} /></span>
              <span className="fmx-node-copy">
                <strong>{line.label}</strong>
                <small>{line.key === 'goal' && goalPaused ? 'szünetel, amíg a sérülés tart' : nodeSub(line, vm, trajectory)}</small>
                {line.key === 'activity' && !past && (vm.chips?.pending ?? 0) > 0 && (
                  <small className="fmx-node-pend">még jön +{huInt(vm.chips!.pending)}, ha megcsinálod</small>
                )}
              </span>
              <b>{nodeValue(line)}{line.key === 'remaining' && <i>kcal</i>}</b>
            </div>
          )
          if (line.key !== 'remaining' || skipped <= 0) return node
          return (
            <Fragment key="skipped-and-remaining">
              <div className="fmx-node is-skipped" style={{ '--node-color': 'var(--dv-lav)' } as React.CSSProperties}>
                <span className="fmx-node-art"><Icon3D name="t-skip" size={24} /></span>
                <span className="fmx-node-copy">
                  <strong>Kihagyva</strong>
                  <small>kihagyott étkezés · nem kerül át máshová</small>
                </span>
                <b>− {huInt(skipped)}</b>
              </div>
              {node}
            </Fragment>
          )
        })}
      </div>
      <p className="fmx-glass-note">
        A keretet az alapigényed, a súlycélod és a mai mozgásod együtt adja — a keret akkor nő, amikor
        logolod az edzést.
      </p>
      {/* A15: a részletes, Énnel KÖZÖS energia-magyarázat nem veszik el — csendes ajtót kap,
          hogy a doboz maradhasson az, aminek a prototípus szánta: az egyenlet. */}
      {onFull && (
        <button type="button" className="fmx-glass-more" onClick={onFull}>
          Részletesen, honnan jön a keret <b aria-hidden="true">›</b>
        </button>
      )}
      <button type="button" className="fmx-glass-close" onClick={onClose}>Bezárom</button>
    </GlassBox>
  )
}

export function FuelEnergyHero({ vm, past = false, trajectory = null, onOpenEnergy, onWater, weeklyCard = null, mode = null, note = null }: {
  vm: KeretHeroVM
  /** A13: egy MÚLTBELI napot nézünk — a „ma” szó ilyenkor hazugság lenne. */
  past?: boolean
  /** Az aktív cél iránya — a Célod sor szövegét választja (mezo-32m82); nincs cél → null. */
  trajectory?: Trajectory
  /** A15: a doboz csendes ajtaja a szülő MEGLÉVŐ, Énnel közös energia-magyarázatához.
   *  A chip maga MINDIG a jóváhagyott üvegdobozt nyitja (mezo-jb84: élesben a régi lap jött). */
  onOpenEnergy?: () => void
  /** Keeps the víz ring a live water-logging door (see FuelMacroRings). */
  onWater?: () => void
  /** mezo-3n2so: the weekly learning summary worth showing (null = nothing to say). Only today's
   *  hero signals it — a past day never shows the dot or the highlighted Alap row. */
  weeklyCard?: ExpenditureWeeklyCard | null
  /** Kímélő mód (Kihagyás S3): MAINTENANCE leads with the protein ring and pauses the goal row;
   *  ESTIMATE mutes the numerals and speaks of a keret „körül", never „felett". GUIDANCE never
   *  reaches the hero (the page shows the guidance card instead). */
  mode?: FuelMode | null
  /** The recovery note, placed between the „Miből jön össze?" chip and the macro rings. */
  note?: React.ReactNode
}) {
  const [boxOpen, setBoxOpen] = useState(false)
  // The card is snapshot when the sheet opens: a dismiss (or a mark's refetch) may null the live
  // card while the sheet is still sliding out.
  const [weeklyShown, setWeeklyShown] = useState<ExpenditureWeeklyCard | null>(null)
  const weekly = past ? null : weeklyCard
  const remaining = useFuelCountUp(vm.remainingKcal)
  const eaten = useFuelCountUp(vm.consumedKcal)
  const over = vm.remainingKcal < 0
  const estimate = mode === 'ESTIMATE'
  const overWord = estimate ? 'a keret körül' : 'a keret felett'
  // Kihagyás S3: the skipped windows keep their share of the keret — drawn as a neutral segment
  // after the eaten arc (1.5-unit gap, butt cap), never redistributed and never a miss.
  const skipped = vm.skippedKcal
  const eatenPct = pct(vm.consumedKcal, vm.targetKcal)
  const skipPct = Math.max(0, Math.min(100 - eatenPct, pct(skipped, vm.targetKcal)))
  const SKIP_GAP = 1.5

  return (
    <div className={`fmx-hero${estimate ? ' is-estimate' : ''}`}>
      {/* A jóváhagyott h1 elrendezés (fuel-dashboard.js `hero-pair`): HÁROM egyenrangú rész
          EGY sorban — balra amit megettél, középen a tál az ívben, jobbra ami még belefér.
          A két szám AZONOS méretű (38px); a jobb oldali csak világosabb és glow-t kap, mert
          az a lap fő üzenete. Az owner kifejezetten ezt kérte: „egy sorban egymással, és ne
          legyen az egyik kisebb, mint a másik". */}
      <div className="fmx-hero-pair">
        <div className="fmx-hero-side">
          <strong aria-label={`${huInt(vm.consumedKcal)} kcal·t ettél ${past ? 'aznap' : 'ma'}`}>
            <span aria-hidden="true">{huInt(eaten)}</span>
          </strong>
          <small aria-hidden="true">KCAL·T ETTÉL</small>
        </div>
        <div className="fmx-gauge" role="img"
          aria-label={`${huInt(vm.consumedKcal)} / ${huInt(vm.targetKcal)} kcal${skipped > 0 ? `, ebből ${huInt(skipped)} kcal kihagyva` : ''}`}
          style={{ '--fuel-progress': String(pct(vm.consumedKcal, vm.targetKcal)) } as React.CSSProperties}>
          <svg className="fmx-gauge-rings" viewBox="0 0 160 160" aria-hidden="true">
            <circle className="fmx-gauge-base" cx="80" cy="80" r="69" pathLength={100} />
            <circle className="fmx-gauge-progress" cx="80" cy="80" r="69" pathLength={100} />
            {skipped > 0 && skipPct > SKIP_GAP && (
              <circle className="ring-skip" cx="80" cy="80" r="69" pathLength={100}
                style={{ strokeDasharray: `${(skipPct - SKIP_GAP).toFixed(1)} 100`, strokeDashoffset: -(eatenPct + SKIP_GAP) }} />
            )}
          </svg>
          <span className="fmx-gauge-art"><ContentIcon name="i-fuel" size={71} /></span>
        </div>
        <div className="fmx-hero-side is-lead">
          {/* ONE sentence for the screen reader; the count-up digits are its decoration. */}
          <strong className="fmx-hero-remaining"
            aria-label={`${huInt(Math.abs(vm.remainingKcal))} kcal ${over ? overWord : past ? 'fért még bele' : 'fér még bele ma'}`}>
            <span aria-hidden="true">{huInt(Math.abs(remaining))}</span>
          </strong>
          <small aria-hidden="true">{over ? (estimate ? 'A KERET KÖRÜL' : 'A KERET FELETT') : estimate ? 'KB. ENNYI FÉR MÉG' : 'MÉG BELEFÉR'}</small>
        </div>
      </div>
      {skipped > 0 && (
        <button type="button" className="fmx-skline" onClick={() => setBoxOpen(true)}>
          <Icon3D name="t-skip" size={20} />
          <span><b>{vm.skippedLabels.join(', ')} kihagyva</b> · {huInt(skipped)} kcal kiesett a napból</span>
        </button>
      )}
      {/* Üveg (mezo-me75u.1): a glass pill in the water accent, outside any card. */}
      <button type="button" className="fmx-tapchip glass"
        style={{ '--c': 'var(--dv-sky)' } as React.CSSProperties}
        onClick={() => setBoxOpen(true)}>
        <span>Miből jön össze?</span>
        {weekly && <WeeklyLearningDot hold={weekly.status === 'holding'} />}
        <b aria-hidden="true">›</b>
        <u className="fmx-chip-sheen" aria-hidden="true" />
      </button>
      {note}
      <FuelMacroRings rings={vm.rings} onWater={onWater} leadKey={mode === 'MAINTENANCE' ? 'p' : undefined} />
      {boxOpen && (
        <EquationBox vm={vm} past={past} trajectory={trajectory} mode={mode} onClose={() => setBoxOpen(false)}
          onFull={onOpenEnergy ? () => { setBoxOpen(false); onOpenEnergy() } : undefined}
          weekly={weekly} onWeekly={() => { setBoxOpen(false); setWeeklyShown(weekly) }} />
      )}
      {weeklyShown && <WeeklyLearningSheet card={weeklyShown} onClose={() => setWeeklyShown(null)} />}
    </div>
  )
}

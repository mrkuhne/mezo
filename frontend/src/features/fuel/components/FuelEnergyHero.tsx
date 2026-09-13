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
// ============================================================
import { useId, useState } from 'react'
import { pct } from '@/shared/lib/pct'
import { huInt } from '@/shared/lib/huNum'
import { ClayIcon, type ClayIconName } from '@/shared/ui/clay'
import { heroEquationLines, type EquationLine, type KeretHeroVM } from '@/features/fuel/logic/keretHero'
import { FuelMacroRings, useFuelCountUp } from '@/features/fuel/components/FuelMacroRings'
import { GlassBox } from '@/features/fuel/components/GlassBox'

// One hue + one clay symbol per equation row — the prototype's `glass-node` palette, expressed
// in house tokens so the box reads in both themes.
const NODE: Record<EquationLine['key'], { color: string; icon: ClayIconName; sub: string }> = {
  base: { color: 'var(--amber)', icon: 'i-cel', sub: 'az alapanyagcseréd és az életmódod' },
  activity: { color: 'var(--sage)', icon: 'i-edzes', sub: 'a mai betáblázott mozgásodból' },
  eaten: { color: 'var(--coral)', icon: 'i-fuel', sub: 'amit ma eddig logoltál' },
  remaining: { color: 'var(--sky)', icon: 'i-lang', sub: 'a mai kereted maradéka' },
}

/** Sign + value, honest-null aware: a missing component is „—", and the sign stays so the row
 *  still reads as part of the equation (the prototype prints `− 1 240` the same way). */
function nodeValue(line: EquationLine): string {
  if (line.value == null) return line.sign == null || line.sign === '=' ? '—' : `${line.sign} —`
  // The `=` row carries its OWN sign (an overshoot day is honestly negative); the +/− rows
  // have the operator in front, so their magnitude is what follows it.
  if (line.sign == null || line.sign === '=') return huInt(line.value)
  return `${line.sign} ${huInt(Math.abs(line.value))}`
}

function EquationBox({ vm, past, onClose }: { vm: KeretHeroVM; past: boolean; onClose: () => void }) {
  const titleId = useId()
  const lines = heroEquationLines(vm)
  const over = vm.remainingKcal < 0


  return (
    <GlassBox onClose={onClose}
      
      labelledBy={titleId}
    >
      <div className="fmx-glass-hero">
        <ClayIcon name="i-fuel" size={56} />
        <div>
          <strong>{huInt(Math.abs(vm.remainingKcal))}</strong>
          <small id={titleId}>kcal {over ? 'a keret felett' : past ? 'fért még bele' : 'fér még bele ma'}</small>
        </div>
      </div>
      <div className="fmx-glass-bar" role="img"
        aria-label={`A napi keretedből ${huInt(vm.consumedKcal)} kcal fogyott el`}>
        <i style={{ '--w': `${pct(vm.consumedKcal, vm.targetKcal)}%` } as React.CSSProperties} />
        <span className="fmx-gb-left">ettél</span>
        <span className="fmx-gb-right">még szabad</span>
      </div>
      <div className="fmx-flow">
        {lines.map(line => (
          <div key={line.key} className={`fmx-node${line.key === 'remaining' ? ' is-total' : ''}`}
            style={{ '--node-color': NODE[line.key].color } as React.CSSProperties}>
            <span className="fmx-node-art"><ClayIcon name={NODE[line.key].icon} size={24} /></span>
            <span className="fmx-node-copy">
              <strong>{line.label}</strong>
              <small>{NODE[line.key].sub}</small>
            </span>
            <b>{nodeValue(line)}{line.key === 'remaining' && <i>kcal</i>}</b>
          </div>
        ))}
      </div>
      <p className="fmx-glass-note">
        A keretet az alapigényed, a súlycélod és a mozgásod együtt adja — a számítás minden nap
        újraszületik.
      </p>
      <button type="button" className="fmx-glass-close" onClick={onClose}>Bezárom</button>
    </GlassBox>
  )
}

export function FuelEnergyHero({ vm, past = false, onOpenEnergy, onWater }: {
  vm: KeretHeroVM
  /** A13: egy MÚLTBELI napot nézünk — a „ma” szó ilyenkor hazugság lenne. */
  past?: boolean
  /** A15: hands the tap to the parent's shared EnergyBreakdownSheet instead of the local box. */
  onOpenEnergy?: () => void
  /** Keeps the víz ring a live water-logging door (see FuelMacroRings). */
  onWater?: () => void
}) {
  const [boxOpen, setBoxOpen] = useState(false)
  const remaining = useFuelCountUp(vm.remainingKcal)
  const eaten = useFuelCountUp(vm.consumedKcal)
  const over = vm.remainingKcal < 0

  return (
    <div className="fmx-hero">
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
        <div className="fmx-gauge"
          style={{ '--fuel-progress': String(pct(vm.consumedKcal, vm.targetKcal)) } as React.CSSProperties}>
          <svg className="fmx-gauge-rings" viewBox="0 0 160 160" aria-hidden="true">
            <circle className="fmx-gauge-base" cx="80" cy="80" r="69" pathLength={100} />
            <circle className="fmx-gauge-progress" cx="80" cy="80" r="69" pathLength={100} />
          </svg>
          <span className="fmx-gauge-art"><ClayIcon name="i-fuel" size={71} /></span>
        </div>
        <div className="fmx-hero-side is-lead">
          {/* ONE sentence for the screen reader; the count-up digits are its decoration. */}
          <strong className="fmx-hero-remaining"
            aria-label={`${huInt(Math.abs(vm.remainingKcal))} kcal ${over ? 'a keret felett' : past ? 'fért még bele' : 'fér még bele ma'}`}>
            <span aria-hidden="true">{huInt(Math.abs(remaining))}</span>
          </strong>
          <small aria-hidden="true">{over ? 'A KERET FELETT' : 'MÉG BELEFÉR'}</small>
        </div>
      </div>
      <button type="button" className="fmx-tapchip"
        onClick={() => (onOpenEnergy ? onOpenEnergy() : setBoxOpen(true))}>
        <span>Miből jön össze?</span>
        <b aria-hidden="true">›</b>
        <u className="fmx-chip-sheen" aria-hidden="true" />
      </button>
      <FuelMacroRings rings={vm.rings} onWater={onWater} />
      {boxOpen && <EquationBox vm={vm} past={past} onClose={() => setBoxOpen(false)} />}
    </div>
  )
}

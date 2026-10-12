// ============================================================
// Mezo · FuelMacroRings — the Fuel Mai's five macro VIALS (Folyadék F5, mezo-n4wf5.5; prototype
// vilagos/fuel.js `mai()` → `macros`: `vials(V.rings…, {h:118})` in a card, class `.fu-mac`).
// The name and the props are the Titanium ring row's (Fuel Titanium S1a, mezo-33k6, manifest row A2) —
// the rings themselves are gone: a number is a level (bible §1.4), so each macro stands in a test tube
// filled to its share of the day's target.
//
// Identity, fixed by the owner: protein = meat · carbs = grain · fat = avocado · water · fibre = leaf,
// each in its own stable colour (`MACRO_COLOR`).
//
// Honest-null: a vial whose TARGET is unknown stays dry and shows the VM's own „—", never a fabricated 0.
//
// The WATER vial is the page's only door to the water sheet (`onWater`); without the prop the row is
// fully passive. In maintenance (injury) the protein vial carries the „fő cél" mark (`leadKey`).
// ============================================================
import { useM } from '@/shared/i18n'
import { fmtFixed, fmtInt, fmtNum } from '@/shared/lib/format'
import { Vials, type VialItem } from '@/shared/ui/folyadek'
import type { Icon3DName } from '@/shared/ui/clay'
import { MACRO_COLOR } from '@/features/fuel/components/folyadek'
import type { RingVM } from '@/features/fuel/logic/keretHero'

const VIAL: Record<RingVM['key'], { icon: Icon3DName; color: string }> = {
  p: { icon: 't-meat', color: MACRO_COLOR.protein },
  c: { icon: 't-carb', color: MACRO_COLOR.carbs },
  f: { icon: 't-avocado', color: MACRO_COLOR.fat },
  water: { icon: 't-water', color: MACRO_COLOR.water },
  fiber: { icon: 't-fiber', color: MACRO_COLOR.fiber },
}

/** A ring's amount as the vial's numeral: litres with one fixed decimal („1,9"), grams whole; unknown = „—". */
const numeral = (v: number | null, unit: RingVM['unit']): string => (v == null ? '—' : unit === 'l' ? fmtFixed(v, 1) : fmtInt(v))
/** A ring's goal with its unit: „155 g", „2,5 l" (a whole litre drops its zero: „4 l"); unknown = „—". */
const goalText = (v: number | null, unit: RingVM['unit']): string => (v == null ? '—' : `${unit === 'l' ? fmtNum(v, 1) : fmtInt(v)} ${unit}`)

export function FuelMacroRings({ rings, onWater, leadKey }: {
  rings: RingVM[]; onWater?: () => void
  /** Kímélő mód / sérülés (Kihagyás S3): the vial that is the day's main goal — it is ringed in its colour
   *  and wears the „fő cél" mark (the protein, which rebuilds the tissue). */
  leadKey?: RingVM['key']
}) {
  const M = useM()
  const K = M.fuelMai.macros
  const items: VialItem[] = rings.map((r) => {
    const empty = r.goal == null || r.amount == null
    const lead = r.key === leadKey
    return {
      label: r.key === 'c'
        ? <><span className="fa-w">{r.label}</span><span className="fa-s">{K.carbsShort}</span></>
        : r.label,
      icon: VIAL[r.key].icon,
      color: VIAL[r.key].color,
      pct: empty ? 0 : Math.max(5, r.pct),
      value: numeral(r.amount, r.unit),
      note: K.of(goalText(r.goal, r.unit)),
      mark: lead ? K.focus : undefined,
      ...(r.key === 'water' && onWater ? { onClick: onWater, ariaLabel: K.waterAria(r.amount == null ? '—' : `${numeral(r.amount, r.unit)} ${r.unit}`, goalText(r.goal, r.unit)) } : {}),
    }
  })
  return (
    <div className={leadKey ? 'fa-mac lead' : 'fa-mac'} role="group" aria-label={K.group}>
      <Vials items={items} height={118} />
    </div>
  )
}

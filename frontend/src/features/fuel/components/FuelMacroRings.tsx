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
import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from '@/shared/hooks/useReducedMotion'
import { useSettledArrival } from '@/shared/ui/mozaik/arrival'
import { useM } from '@/shared/i18n'
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

// jsdom implements a real requestAnimationFrame/setInterval, so an unguarded count-up would
// leave every numeral at 0 for the first frames of a test.
function isJsdomEnv(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.userAgent === 'string'
    && navigator.userAgent.includes('jsdom')
}

/** `0 → to` over `durationMs`, cubic ease-out; instant under reduced motion, on a 'pop' arrival and in jsdom.
 *  NOT used by the Folyadék Mai (a level rises by CSS, the number stands). Kept only until the other Fuel
 *  areas drop their import (plan § „The cuts"); the controller deletes it then. */
export function useFuelCountUp(to: number, durationMs = 950): number {
  const reduced = useReducedMotion()
  const returning = useSettledArrival()
  const skip = reduced || isJsdomEnv() || returning
  const [val, setVal] = useState(skip ? to : 0)
  const shownRef = useRef(skip ? to : 0)

  useEffect(() => {
    if (skip) {
      setVal(to)
      shownRef.current = to
      return
    }
    const from = shownRef.current
    let raf = 0
    let start: number | null = null
    const tick = (now: number) => {
      if (start === null) start = now
      const p = Math.min(1, (now - start) / durationMs)
      const eased = 1 - Math.pow(1 - p, 3)
      const next = from + (to - from) * eased
      setVal(next)
      shownRef.current = next
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [to, durationMs, skip])

  return val
}

/** The numeral of a formatted RingVM string without its unit ("148 g" → "148", "1,9 l" → "1,9"); a string
 *  without a number („—") comes back as it is. */
export function ringNumeral(formatted: string): string {
  const m = /^(−?\d[\d\s  .,]*?)\s*[^\d\s.,]+$/.exec(formatted.trim())
  return m ? m[1] : formatted.trim()
}

/** The number behind a formatted RingVM string; `null` when it carries none (honest-null). */
export function ringNumber(formatted: string): number | null {
  const m = /^−?\d[\d\s  .,]*/.exec(formatted.trim())
  if (!m) return null
  const raw = m[0].replace(/[\s  ]/g, '').replace('−', '-')
  // a single separator followed by one or two digits is the decimal mark; anything else groups thousands
  const dec = /[.,]\d{1,2}$/.test(raw)
  const n = Number(dec ? raw.replace(/[.,](?=\d{1,2}$)/, '.').replace(/,/g, '') : raw.replace(/[.,]/g, ''))
  return Number.isFinite(n) ? n : null
}

export function FuelMacroRings({ rings, onWater, leadKey }: {
  rings: RingVM[]; onWater?: () => void
  /** Kímélő mód / sérülés (Kihagyás S3): the vial that is the day's main goal — it is ringed in its colour
   *  and wears the „fő cél" mark (the protein, which rebuilds the tissue). */
  leadKey?: RingVM['key']
}) {
  const M = useM()
  const K = M.fuelMai.macros
  const items: VialItem[] = rings.map((r) => {
    const empty = ringNumber(r.target) == null || ringNumber(r.value) == null
    const lead = r.key === leadKey
    return {
      label: r.key === 'c'
        ? <><span className="fa-w">{r.label}</span><span className="fa-s">{K.carbsShort}</span></>
        : r.label,
      icon: VIAL[r.key].icon,
      color: VIAL[r.key].color,
      pct: empty ? 0 : Math.max(5, r.pct),
      value: ringNumeral(r.value),
      note: K.of(r.target),
      mark: lead ? K.focus : undefined,
      ...(r.key === 'water' && onWater ? { onClick: onWater, ariaLabel: K.waterAria(r.value, r.target) } : {}),
    }
  })
  return (
    <div className={leadKey ? 'fa-mac lead' : 'fa-mac'} role="group" aria-label={K.group}>
      <Vials items={items} height={118} />
    </div>
  )
}

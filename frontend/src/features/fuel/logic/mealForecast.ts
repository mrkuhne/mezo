// ============================================================
// Mezo · mealForecast — az óra-doboz „Mire számíts" sorai (mezo-6g52f)
//
// A glycemicBand szintjét FOGYASZTJA, nem írja át (a sávok szövegei és küszöbei owner-zároltak).
// Ez az a „peri" réteg, amit a glycemicBand fejléce külön szeletnek hagyott: az időzítés × a
// vércukor-válasz sávja × a nap ritmusa (edzés, lefekvés, következő ablak). Minden becslés
// „nagyjából"; szám a vércukorról soha.
//
// Folyadék F5 (mezo-n4wf5.5): a mondatok a `fuelEtkezes.forecast` katalógusból jönnek, HÍVÁSKOR (`m()`), ezért a
// hívó renderben hívja — egy modul-konstansba vagy memóba tett eredmény nyelvváltáskor beragadna (N1.3).
// ============================================================
import type { GlycemicLevel } from '@/features/fuel/logic/glycemicBand'
import { BEFORE_BED_MIN, toMin, toHHmm } from '@/data/fuel/fuelConfig'
import { hitOf, durHu, az, Az } from '@/features/fuel/logic/mealWindow'
import { m } from '@/shared/i18n'

export interface ForecastInput {
  level: GlycemicLevel | null
  energyText: string | null
  kcal: number | null
  eatenAt: string
  window: { from: string; to: string } | null
  training: { start: string; end: string } | null
  bed: string
  next: { label: string; from: string; to: string } | null
}
export interface ForecastRow { icon: 't-bolt' | 't-clock' | 't-moon' | 't-heart'; title: string; body: string }

export function mealForecast(i: ForecastInput): { rows: ForecastRow[]; tip: string | null; late: boolean } {
  const F = m().fuelEtkezes.forecast
  const at = toMin(i.eatenAt)
  const toBed = toMin(i.bed) - at
  const late = toBed >= 0 && toBed <= BEFORE_BED_MIN
  const toTrain = i.training ? toMin(i.training.start) - at : null
  const afterTrain = i.training ? at - toMin(i.training.end) : null
  const rows: ForecastRow[] = []
  // The next window's name inside a sentence: lower case, with its article in Hungarian („az ebéd"), bare in English.
  const next = i.next ? az(i.next.label.toLowerCase()) : ''
  const nextCap = i.next ? Az(i.next.label.toLowerCase()) : ''

  if (i.level && i.energyText) {
    let ctx: string | null = null
    if (toTrain != null && toTrain > 0 && toTrain <= 120) ctx = i.level === 'high' ? F.preTrainHigh : F.preTrainBase
    else if (toTrain != null && toTrain > 120 && toTrain <= 300) ctx = F.untilTrain(i.training!.start)
    else if (afterTrain != null && afterTrain >= 0 && afterTrain <= 180) ctx = F.afterTrain
    const energy = F.energyBody(i.energyText)
    rows.push({ icon: 't-bolt', title: F.energy, body: ctx ? `${energy} ${ctx}` : energy })
  }

  if (i.next) {
    const hungry = at + ((i.kcal ?? 400) < 400 ? 150 : 210) + (i.level === 'high' ? -45 : i.level === 'low' ? 20 : 0)
    const lo = toMin(i.next.from), hi = toMin(i.next.to)
    const body = hungry >= lo - 30 && hungry <= hi + 15 ? F.hungryIn(toHHmm(hungry), next)
      : hungry < lo ? F.hungryBefore(toHHmm(hungry), next)
        : F.hungryAfter(toHHmm(hungry), nextCap)
    rows.push({ icon: 't-clock', title: F.hungry, body })
  } else {
    rows.push({ icon: 't-clock', title: F.hungry, body: F.lastMeal })
  }

  if (late) {
    rows.push({ icon: 't-moon', title: F.sleep, body: i.level === 'high' ? F.lateHigh(durHu(toBed)) : F.late(durHu(toBed)) })
  } else if (!i.window) {
    rows.push({ icon: 't-heart', title: F.rhythm, body: F.noWindow })
  } else {
    const h = hitOf(i.window.from, i.window.to, i.eatenAt)
    const body = h.kind === 'in' ? F.inRhythm
      : h.offsetMin > 0
        ? (i.next ? F.laterNext(durHu(h.offsetMin), next) : F.later(durHu(h.offsetMin)))
        : (i.next ? F.earlierNext(durHu(h.offsetMin), next) : F.earlier(durHu(h.offsetMin)))
    rows.push({ icon: 't-heart', title: F.rhythm, body })
  }

  // Csak IDŐZÍTÉS-specifikus jegyzet — a sáv saját (owner-jóváhagyott) tippje a séta/rost tanácsot már adja.
  let tip: string | null = null
  if (i.level === 'high' && late) tip = F.tipLateHigh
  else if (i.level === 'low' && toTrain != null && toTrain > 0 && toTrain <= 120) tip = F.tipLowPreTrain

  return { rows, tip, late }
}

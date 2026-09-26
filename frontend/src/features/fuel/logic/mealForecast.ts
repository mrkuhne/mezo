// ============================================================
// Mezo · mealForecast — az óra-doboz „Mire számíts" sorai (mezo-6g52f)
//
// A glycemicBand szintjét FOGYASZTJA, nem írja át (a sávok szövegei és küszöbei owner-zároltak).
// Ez az a „peri" réteg, amit a glycemicBand fejléce külön szeletnek hagyott: az időzítés × a
// vércukor-válasz sávja × a nap ritmusa (edzés, lefekvés, következő ablak). Minden becslés
// „nagyjából"; szám a vércukorról soha.
// ============================================================
import type { GlycemicLevel } from '@/features/fuel/logic/glycemicBand'
import { BEFORE_BED_MIN, toMin, toHHmm } from '@/data/fuel/fuelConfig'
import { hitOf, durHu, az, Az } from '@/features/fuel/logic/mealWindow'

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
  const at = toMin(i.eatenAt)
  const toBed = toMin(i.bed) - at
  const late = toBed >= 0 && toBed <= BEFORE_BED_MIN
  const toTrain = i.training ? toMin(i.training.start) - at : null
  const afterTrain = i.training ? at - toMin(i.training.end) : null
  const rows: ForecastRow[] = []

  if (i.level && i.energyText) {
    let ctx = ''
    if (toTrain != null && toTrain > 0 && toTrain <= 120) {
      ctx = i.level === 'high' ? ' Edzés előtt ez most előny: gyorsan elérhető üzemanyag.' : ' Az edzésre ez tartós alapot ad.'
    } else if (toTrain != null && toTrain > 120 && toTrain <= 300) {
      ctx = ` Az edzésig (${i.training!.start}) ebből nagyjából kitart az alap.`
    } else if (afterTrain != null && afterTrain >= 0 && afterTrain <= 180) {
      ctx = ' Edzés után ez segíti a raktárak visszatöltését.'
    }
    rows.push({ icon: 't-bolt', title: 'Energia', body: `${i.energyText}.${ctx}` })
  }

  if (i.next) {
    const hungry = at + ((i.kcal ?? 400) < 400 ? 150 : 210) + (i.level === 'high' ? -45 : i.level === 'low' ? 20 : 0)
    const lo = toMin(i.next.from), hi = toMin(i.next.to)
    let body = `Nagyjából ${toHHmm(hungry)} körül jelez újra az éhség`
    if (hungry >= lo - 30 && hungry <= hi + 15) body += ` – pont ${az(i.next.label)} ablakában.`
    else if (hungry < lo) body += `, ${az(i.next.label)} előtt: egy pohár víz vagy kávé áthidalja.`
    else body += `. ${Az(i.next.label)} ablaka ezért kicsit később lehet, vagy kisebb adag is elég.`
    rows.push({ icon: 't-clock', title: 'Mikor leszel éhes', body })
  } else {
    rows.push({ icon: 't-clock', title: 'Mikor leszel éhes', body: 'Ez volt a nap utolsó étkezése, reggelig ennyi elég.' })
  }

  if (late) {
    rows.push({ icon: 't-moon', title: 'Alvás', body: `Lefekvés előtt ${durHu(toBed)}-cel ettél` + (i.level === 'high'
      ? ', ráadásul magas vércukor-válaszú ételt. Ma éjjel valószínűleg nyugtalanabb lesz az alvás és magasabb a pulzus.'
      : '. Az emésztés még dolgozik, amikor elalszol.') })
  } else if (!i.window) {
    rows.push({ icon: 't-heart', title: 'A nap ritmusa', body: 'Nem tartozott ablakhoz, így a nap többi ablaka változatlan.' })
  } else {
    const h = hitOf(i.window.from, i.window.to, i.eatenAt)
    rows.push({ icon: 't-heart', title: 'A nap ritmusa', body: h.kind === 'in'
      ? 'Tartja a 3–4 órás fehérje-ritmust, és a nap többi ablaka a helyén marad.'
      : `${durHu(h.offsetMin)}-cel ${h.offsetMin > 0 ? 'később' : 'korábban'} ettél. Ez nem gond, a nap elbírja${i.next ? `, csak ${az(i.next.label)} ablaka tolódik vele.` : '.'}` })
  }

  // Csak IDŐZÍTÉS-specifikus jegyzet — a sáv saját (owner-jóváhagyott) tippje a séta/rost tanácsot már adja.
  let tip: string | null = null
  if (i.level === 'high' && late) tip = 'Holnap reggel ne az éjszaka mérésein ítéld meg magad: ez egy késői, nehéz vacsora hatása, nem a formádé.'
  else if (i.level === 'low' && toTrain != null && toTrain > 0 && toTrain <= 120) tip = 'Ez az étel lassan ad energiát. Mivel hamarosan edzel, jól jöhet mellé egy gyorsabb szénhidrát.'

  return { rows, tip, late }
}

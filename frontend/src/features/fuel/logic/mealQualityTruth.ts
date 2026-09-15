// ============================================================
// Mezo · mealQualityTruth — a Minőség lapkák három ténye EGY logolt étkezésre (mezo-tm3sb)
//
// MIÉRT LÉTEZIK. A Minőség lapkák a logolt TÉTELSOROKBÓL számoltak. Egy receptből logolt étkezés
// viszont egyetlen összecsukott sor: a recept egy domináns feldolgozottság-bélyegével és „1 adag"
// mennyiséggel. Ezért az alapanyag-arány csak 0% vagy 100% tudott lenni (soha nem az igazság), az
// ultra-feldolgozott RECEPTEKET számolt hozzávalók helyett, az energiasűrűség pedig gramm híján
// gondolatjel volt — miközben UGYANANNAK a receptnek a saját oldala helyesen 57%-ot és
// 183 kcal/100 g-ot mutatott, mert azt a rendszer hozzávalónként építi. Ez az aszimmetria volt a
// hiba, és élesben is látszott: „többször van, hogy ezek nullán maradnak".
//
// A háttérrendszer mostantól a hozzávalókból pontoz (`MealCompositeLines`), tehát a BONTÁS maga
// hordozza a helyes választ — és ugyanaz a bontás, amiből az AI-pontszám készült. Ez a modul azt
// olvassa ki, és NEM számol másodszor: két aritmetika ugyanazon tények felett garantáltan
// elcsúszna (ezért él egy példányban a `scoreArithmetic.ts` is).
//
// ŐSZINTE-NULL, TÉNYENKÉNT KÜLÖN. Egy degradált dimenziónak nincs payloadja (mezo-jcpt.1), és azt
// SZERKEZETILEG ismerjük fel, nem az `id`-je alapján — egy degradált dimenzió ugyanazt az `id`-t
// viseli, mint élő párja. Amit a bontás nem tud, az `null` → a felület gondolatjelet ír rá.
// Kifejezetten NEM esünk vissza a tételsoros számításra: ha a háttérrendszer degradálta az
// energiasűrűséget, akkor ő már eldöntötte, hogy a tömeg nem megbízható (például a minimális
// tömeg-küszöb alatt van), és a felület nem gyárthat helyette egy kedvezőbb számot.
//
// FIGYELEM, A KÉT NULLA NEM UGYANAZ. Egy 0%-os 1-es sor a stackben MÉRT nulla („ebben az ételben
// tényleg nincs alapanyag") — az megy ki 0-ként. A hiányzó stack ISMERETLEN — az `null`.
// ============================================================
import type { MealBreakdown, MealDimension, NovaDimension, RowsDimension } from '@/data/types'

export interface MealQualityTruth {
  /** Az 1-es NOVA-csoport kalória-részesedése, %. */
  basePct: number | null
  /** Az ultra-feldolgozott (NOVA 4) HOZZÁVALÓK darabszáma. */
  ultraItems: number | null
  /** kcal / 100 g, a háttérrendszer saját energiasűrűség-dimenziójából. */
  densityKcalPer100g: number | null
}

const EMPTY: MealQualityTruth = { basePct: null, ultraItems: null, densityKcalPer100g: null }

/** Az élő NOVA-dimenzió — a degradált párjának nincs `nova` payloadja (szerkezeti szűkítés). */
function liveNova(dimensions: MealDimension[]): NovaDimension['nova'] | null {
  const dim = dimensions.find((d): d is NovaDimension => d.id === 'nova' && 'nova' in d)
  return dim ? dim.nova : null
}

/** Az élő energiasűrűség-dimenzió sorai — a degradáltnak nincs `context` payloadja. */
function densityRows(dimensions: MealDimension[]): RowsDimension['context'] | null {
  const dim = dimensions.find((d): d is RowsDimension => d.id === 'energy_density' && 'context' in d)
  return dim ? dim.context : null
}

/**
 * A „Sűrűség" sor számjegye. A sor egy MEGJELENÍTÉSRE formázott érték („183 kcal/100g"), ezért a
 * számot ki kell belőle olvasni; ha nincs benne értelmezhető szám (például „nincs adat"), akkor
 * `null` — sosem 0, mert a 0 kcal/100 g egy állítás lenne, nem egy hiány.
 */
function parseDensity(rows: RowsDimension['context']): number | null {
  const row = rows.find(r => r.label === 'Sűrűség')
  if (!row) {
    return null
  }
  const match = /-?\d+(?:[.,]\d+)?/.exec(row.value)
  if (!match) {
    return null
  }
  const n = Number(match[0].replace(',', '.'))
  return Number.isFinite(n) ? Math.round(n) : null
}

/**
 * A három Minőség-tény kiolvasva a logolt étkezés bontásából. Bontás nélkül (még nem pontozott
 * vagy friss log) mindhárom `null`.
 */
export function mealQualityTruth(breakdown: MealBreakdown | undefined): MealQualityTruth {
  if (!breakdown) {
    return EMPTY
  }
  const nova = liveNova(breakdown.dimensions)
  // Egy üres stack/lista nem „nulla alapanyag", hanem „nem tudjuk" — a hiányzó bizonyíték nem
  // bizonyíték a hiányra.
  const baseRow = nova?.stack.find(s => s.nova === 1)
  const rows = densityRows(breakdown.dimensions)
  return {
    basePct: nova && nova.stack.length > 0 ? (baseRow?.pct ?? 0) : null,
    ultraItems: nova && nova.items.length > 0 ? nova.items.filter(i => i.nova === 4).length : null,
    densityKcalPer100g: rows ? parseDensity(rows) : null,
  }
}

// ============================================================
// Mezo · fuelPatternRefs — a Trendek mintázat-rétege (Fuel Titanium S3, mezo-83g0; manifeszt C4
// „mintázatok — a Mezóra HIVATKOZUNK, nem duplikálunk").
//
// Jóváhagyott vizuális referencia: docs/design_2.0/prototypes/companion-titanium/fuel-pages.js
// `trendPatternGlass` (:277) — ott is egyetlen „Megnézem a Mezo oldalán" ajtó áll, a bizonyíték
// a Mezóban van.
//
// C4 ANTI-DUPLIKÁCIÓ, ez a fájl egyetlen dolga: innen CSAK a minta kanonikus AZONOSÍTÓJA, a
// CÍME (címke, nem újraírt szöveg) és egy állapot-szó megy a nézetbe. A mechanizmus, a
// bizonyíték-lista, a kritika, a lelet-mondat — SEMMI belőlük nem jön át, mert annak a Mezo a
// kanonikus otthona (`/mezo/patterns/:pairKey` → `PatternDetailPage`).
//
// Linkelhető kulcs nélkül a sor EGYÁLTALÁN nem jelenik meg: inkább semmit, mint másolatot.
// ============================================================
import { engineStatusCopy } from '@/features/insights/logic/lifecycle'
import type { Pattern } from '@/data/types'

/** Egy hivatkozó sor — szándékosan a minimum, amiből a felhasználó felismeri és odalép. */
export interface FuelPatternRef {
  pairKey: string
  /** A minta KANONIKUS címe, változtatás nélkül — címke, nem átírt szöveg. */
  title: string
  /** Egy-szavas állapot. A ház MEGLÉVŐ szótárából (PatternDecisionCard / PatternDetailHero /
   *  engineStatusCopy) — itt nem születik új megfogalmazás. */
  stateLabel: string
  /** A kanonikus Mezo-útvonal — ide lépünk, itt NEM másolunk. */
  route: string
}

/** A `PatternRowStatus` → a ház saját, máshol már kimondott állapot-szavai. A `refuted`/`dormant`
 *  sorszövegét a motor saját helpere (`engineStatusCopy`) adja, hogy egy helyen legyen. */
function stateLabelFor(status: Pattern['status']): string {
  const engine = engineStatusCopy(status)
  if (engine) return engine
  if (status === 'confirmed') return 'Megerősítve'   // PatternDetailHero / PatternDecisionCard
  if (status === 'monitoring') return 'Figyeljük'    // PatternDetailHero
  if (status === 'rejected') return 'Elvetve'        // PatternDetailHero
  return 'Döntésre vár'                              // PatternDetailHero („Döntésre vár")
}

/** Táplálkozási jelzés-tokenek. A pár-kulcs gépi metrika-nevein ÉS a magyar címen is keresünk,
 *  mert egy hipotézis-kulcs (`hyp-…`) nem hordoz metrikát, a címe viszont beszédes. Szűk és
 *  explicit lista — egy mintát inkább nem hozunk be, mint hogy idegen felismerést tegyünk a
 *  Fuel oldalára. */
const FUEL_TOKENS = [
  // metrika-nevek a pár-kulcsokból (`daily-kcal`, `late-meal`, `water-intake`, …)
  'kcal', 'meal', 'protein', 'carb', 'water', 'weight', 'food', 'nutrition', 'caffeine', 'alcohol',
  // magyar cím-töredékek
  'étkez', 'evés', 'kalór', 'fehérje', 'szénhidrát', 'zsír', 'víz', 'koffein', 'alkohol',
  'vacsor', 'reggeli', 'ebéd', 'súly', 'táplál',
]

function isFuelRelevant(pattern: Pattern): boolean {
  const haystack = `${pattern.pairKey} ${pattern.title}`.toLowerCase()
  return FUEL_TOKENS.some((token) => haystack.includes(token))
}

/** A Fuel oldalra illő mintázatok HIVATKOZÁSAI. Nem-táplálkozási minta és linkelhető kulcs
 *  nélküli sor kimarad; üres eredménynél a hívó a réteget CSENDBEN elhagyja (nem üres keret). */
export function fuelPatternRefs(patterns: Pattern[]): FuelPatternRef[] {
  return patterns
    .filter((p) => p.pairKey.trim() !== '' && isFuelRelevant(p))
    .map((p) => ({
      pairKey: p.pairKey,
      title: p.title,
      stateLabel: stateLabelFor(p.status),
      route: `/mezo/patterns/${p.pairKey}`,
    }))
}

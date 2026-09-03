// ============================================================
// Mezo · fogalmak — a kalauz KANONIKUS fogalom-szótára (mezo-gb1s.3).
// Egy fogalom PONTOSAN egyszer van megfogalmazva; minden kalauz-kártya innen
// kapja a `term`/`def` párt a `fogalom()` helperen át, hogy ugyanaz a fogalom
// sose kapjon két megfogalmazást (spec S2a-3). A definíció HANGTALAN és sima —
// Mezo hangja a kártya `voice` mezőjében szól, nem itt (Duolingo-szabály).
// Minden bejegyzés a forrását viseli: a definíció a kódból/dokumentációból jön,
// nem találgatásból — ugyanaz az idióma, mint `me/logic/sleepEducation.ts`.
// ============================================================

export type FogalomKey = 'napszak' | 'mezociklus' | 'makro' | 'minta' | 'szint'

export interface Fogalom {
  /** A fogalom neve — Fraunces-dőlt fejként renderel a fogalom-dobozban. */
  term: string
  /** Egy mondat, legfeljebb 25 szó. `**félkövér**` megengedett. */
  def: string
}

export const FOGALMAK: Record<FogalomKey, Fogalom> = {
  // Forrás: features/today/logic/dayFace.ts:12-20 — három ALVÁS-horgonyzott ablak
  // (MORNING_SPAN_MIN / EVENING_LEAD_MIN), nem fix óra. A fali óra említése szándékos:
  // a laikus alapfeltevése az, hogy „délután" órához kötött.
  napszak: {
    term: 'napszak',
    def: 'A napod három szakasza — reggel, nap, este. Az ébredésed és a lefekvésed igazítja őket, nem a fali óra.',
  },
  // Forrás: docs/features/train.md §Planner; features/train/pages/MesocyclePlannerPage.tsx
  mezociklus: {
    term: 'mezociklus',
    def: 'Több hetes edzésblokk: a terhelés hétről hétre nő, a végén egy könnyebb hét pihentet. A Mezo innen kapta a nevét.',
  },
  // Forrás: docs/features/fuel.md §1–§3. Szó szerint a fuel.ts S1-es szövege — a
  // megfogalmazás nem változott, csak a helye.
  makro: {
    term: 'makró',
    def: 'A három „építőanyag": **fehérje** (izom), **szénhidrát** (üzemanyag), **zsír** (hormonok). A kalória ezekből adódik össze.',
  },
  // Forrás: docs/features/insights.md §2.1 + companion.md; features/insights/logic/{lifecycle,verdicts}.ts
  // A példa szándékosan „kevés alvás", nem „rossz alvás": a `rossz` tiltott tő a hang-lintben.
  minta: {
    term: 'minta',
    def: 'Egy ismétlődő összefüggés a saját adataidban, amit Mezo vesz észre — például „kevés alvás után több szénhidrát".',
  },
  // Forrás: docs/features/growth.md + ADR 0010 (XP = visszajelzés, nem fizetség).
  // A „semmit nem nyit meg" tagmondat az ADR betartatása copy-szinten.
  szint: {
    term: 'szint',
    def: 'A szinted az összegyűjtött XP-ből jön. Visszajelzés arról, mennyit tettél magadért — nem verseny, és semmit nem nyit meg.',
  },
}

/**
 * A szótárat REGISTRY-IDŐBEN oldja fel `{term, def}` párrá, hogy a `KalauzCard` típusa
 * (és vele a `shared/ui/kalauz/KalauzSheet` szándékosan újradeklarált uniója) domain-mentes
 * maradjon. Használat: `{ kind: 'fogalom', spot: 's-reggel', title: '…', voice: '…', ...fogalom('napszak') }`
 */
export const fogalom = (key: FogalomKey): Fogalom => FOGALMAK[key]

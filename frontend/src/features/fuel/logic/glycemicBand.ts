// ============================================================
// Mezo · glycemicBand — a vércukor-válasz három sávja (mezo-6mi43)
//
// Jóváhagyott referencia: docs/design_2.0/prototypes/companion-titanium/food-state.js
// `glycemicFor` (:71). A SZÁMOK ÉS A SZÖVEGEK ONNAN JÖNNEK, SZÓ SZERINT — ez az, amit az owner
// jóváhagyott. Ne hangold újra a küszöböket és ne írd át a mondatokat.
//
// A deriváció: a szénhidrát terhe a benne levő cukor (finomított rész) arányával súlyozva, amit
// a rost / fehérje / zsír „felöltöztet" és lefékez.
//   teher = c × (0,6 + 0,4 × min(1, cukor / max(1, c)))
//   fék   = rost × 2 + fehérje × 0,25 + zsír × 0,2
//   index = teher − fék   → < 12 alacsony · < 24 közepes · egyébként magas
//
// HÁROM DOLOG, AMIT EGY KÉSŐBBI MENET MEG FOG AKARNI „JAVÍTANI" — NE:
//  1. A belső `index` SOHA nem kerül a felületre, és glikémiás indexként semmilyen szám nem
//     jelenik meg. A vegyes étkezés GI-matematikája 22-50%-ot téved, ezért a funkció három
//     őszinte sávra kötelezi magát (owner-döntés, kétszer megerősítve). A felület szava
//     „vércukor-válasz", nem „glikémiás index".
//  2. A „magas" sáv NEM kudarc. Egyetlen szöveg sem ítélkezik, nem hibáztat, nem szégyenít.
//  3. Ha a cukor nem ismert, a prototípus a szénhidrát 30%-át veszi finomítottnak. A feltevést
//     MEGTARTJUK (a kimenet sáv, nem szám), de `sugarEstimated`-del KIMONDJUK, hogy becslés —
//     feltevést mért adatként bemutatni tilos. Ha a szénhidrát sem ismert, nincs sáv: `null`.
//
// A prototípus edzés-közeli („peri") ága itt NEM szerepel: ez a réteg tiszta tápanyag-alapú
// derivációt ad, az étkezési ablak szerepét a hívó felület nem adja át (a terv aláírása sem
// kér `role`-t). Ha az edzés-közeli hang kell, az külön szelet.
// ============================================================

export type GlycemicLevel = 'low' | 'mid' | 'high'

export interface GlycemicBand {
  level: GlycemicLevel
  /** A sáv magyar szava — ez kerül a kártyára szám helyett. */
  label: string
  /** Igaz, ha a cukor nem volt ismert, és a finomított részt feltettük. */
  sugarEstimated: boolean
  facts: { label: string; value: string }[]
  tip: { title: string; body: string }
  expect: { energy: string; back: string; hunger: string }
  /**
   * „Legközelebb így lesz laposabb" (owner, 2026-09-26): a KÖVETKEZŐ ilyen tányérra szóló két
   * legerősebb csere, és hogy a kettő együtt melyik sávba vinné. `null` az alacsony sávon —
   * ott nincs mit simítani. A `tip` a MOST-ra szól (séta, sorrend), ez a legközelebbire.
   */
  improve: GlycemicImprove | null
}

export interface GlycemicImprove {
  steps: { title: string; body: string }[]
  /** A lépések EGYÜTT alkalmazva ebbe a sávba vinnék a tányért. */
  result: GlycemicLevel
}

export interface GlycemicInput {
  c: number | null
  sugarG: number | null
  fiberG: number | null
  p: number | null
  f: number | null
}

/** A prototípus feltevése: cukor nélkül a szénhidrát 30%-át tekintjük finomítottnak. */
const ASSUMED_SUGAR_SHARE = 0.3

const LABELS: Record<GlycemicLevel, string> = {
  low: 'alacsony',
  mid: 'közepes',
  high: 'magas',
}

const EXPECT: Record<GlycemicLevel, GlycemicBand['expect']> = {
  low: {
    energy: 'Egyenletes energia 3-4 órára',
    back: 'Kb. 2 óra múlva ér vissza az alapszintre, finoman',
    hunger: 'Az éhség későn, fokozatosan tér vissza',
  },
  mid: {
    energy: 'Stabil energia 2-3 órára',
    back: 'Kb. 2 óra múlva újra alapszinten',
    hunger: 'Az éhség 2-3 óra múlva jelentkezik',
  },
  high: {
    energy: 'Gyors löket, majd visszaesés',
    back: 'Kb. 1,5 óra múlva zuhan — az alapszint alá is eshet',
    hunger: 'A visszaesés után korán, akár 1-1,5 óra múlva újra megéhezhetsz',
  },
}

/** A sáv belső mértéke — SOHA nem kerül a felületre (lásd fent, 1. pont). */
function indexOf(carbs: number, sugar: number, fiber: number, protein: number, fat: number): number {
  const load = carbs * (0.6 + 0.4 * Math.min(1, sugar / Math.max(1, carbs)))
  const brake = fiber * 2 + protein * 0.25 + fat * 0.2
  return load - brake
}

const levelOf = (index: number): GlycemicLevel => (index < 12 ? 'low' : index < 24 ? 'mid' : 'high')

interface Plate { carbs: number; sugar: number; fiber: number; protein: number; fat: number }

/**
 * A „legközelebb" cserék jelöltjei. Mindegyik egy hétköznapi, egy mondatban leírható
 * változtatás, a tányér makróin kifejezve. Az édes ág CSAK ismert cukorral él: a becsült
 * 30%-ra nem mondhatjuk, hogy „feleannyi édes rész", ha nem tudjuk, van-e benne egyáltalán.
 */
function candidates(plate: Plate, sugarEstimated: boolean) {
  const starch = plate.carbs - plate.sugar
  const list: { title: string; body: string; apply: (p: Plate) => Plate }[] = []
  if (!sugarEstimated && plate.sugar >= 10) {
    list.push({
      title: 'Feleannyi édes rész',
      body: 'Az édes összetevőből (méz, lekvár, gyümölcslé, cukros öntet) elég a fele — ez a leggyorsabban felszívódó rész.',
      apply: p => ({ ...p, carbs: p.carbs - p.sugar / 2, sugar: p.sugar / 2 }),
    })
  }
  if (starch >= 40) {
    list.push({
      title: 'Negyeddel kisebb köret',
      body: 'A kenyérből, tésztából, rizsből vagy krumpliból negyeddel kevesebb — a helyére jöhet zöldség.',
      apply: p => ({ ...p, carbs: p.carbs - (p.carbs - p.sugar) * 0.25 }),
    })
  }
  list.push({
    title: 'Rost mellé',
    body: 'Egy marék zöldség, saláta vagy egy evőkanál chiamag a tányér mellé — a rost fékezi a felszívódást.',
    apply: p => ({ ...p, fiber: p.fiber + 5 }),
  })
  if (plate.protein < 30) {
    list.push({
      title: 'Fehérje mellé',
      body: '150 g túró, görög joghurt vagy két tojás mellé — a fehérje lassítja a csúcsot.',
      apply: p => ({ ...p, protein: p.protein + 18 }),
    })
  }
  return list
}

const plateIndex = (p: Plate) => indexOf(p.carbs, p.sugar, p.fiber, p.protein, p.fat)

/** A két legtöbbet simító csere, és hogy együtt hová vinnék. */
function improveFor(plate: Plate, sugarEstimated: boolean): GlycemicImprove | null {
  const base = plateIndex(plate)
  if (levelOf(base) === 'low') return null
  const ranked = candidates(plate, sugarEstimated)
    .map(c => ({ ...c, gain: base - plateIndex(c.apply(plate)) }))
    .sort((a, b) => b.gain - a.gain)
    .slice(0, 2)
  const combined = ranked.reduce((p, c) => c.apply(p), plate)
  return {
    steps: ranked.map(({ title, body }) => ({ title, body })),
    result: levelOf(plateIndex(combined)),
  }
}

const num = (v: number | null | undefined): number => (Number.isFinite(v) ? (v as number) : 0)

/**
 * A három sáv a tányér tápanyagaiból. `null`, ha a szénhidrát nem ismert — sáv nélkül
 * őszintébb, mint találgatva.
 */
export function glycemicBand({ c, sugarG, fiberG, p, f }: GlycemicInput): GlycemicBand | null {
  if (!Number.isFinite(c)) return null
  const carbs = c as number

  const sugarEstimated = !Number.isFinite(sugarG)
  const sugar = sugarEstimated ? carbs * ASSUMED_SUGAR_SHARE : (sugarG as number)
  const fiber = num(fiberG)
  const protein = num(p)
  const fat = num(f)

  const level = levelOf(indexOf(carbs, sugar, fiber, protein, fat))
  // Az édes ág: a cukor a szénhidrát nagyobb részét adja, ÉS önmagában is sok.
  const sugary = sugar >= carbs * 0.45 && sugar >= 12
  // A „csupasz" ág: nincs mellette se rost, se érdemi fehérje, ami lassítson.
  const bare = fiber < 4 && protein < 15

  const tip = level === 'low'
    ? {
        title: 'Szép egyensúly',
        body: 'A fehérje és a rost lassan engedi fel a vércukrot — ez a tányér magától simít.',
      }
    : level === 'high'
      ? (sugary
          ? {
              title: 'Öltöztesd fel a szénhidrátot',
              body: 'Az édes rész magában gyorsan felszív. Egy kis fehérje vagy zsír mellé — '
                + 'joghurt, dió — sokat lapít a csúcson.',
            }
          : {
              title: 'Egy séta most sokat ér',
              body: '10-15 perc mozgás evés után az izmok azonnal elhasználják a glükóz egy '
                + 'részét — a csúcs láthatóan kisebb lesz.',
            })
      : (bare
          ? {
              title: 'Rost előre',
              body: 'Pár falat zöldség vagy saláta a szénhidrát előtt lassítja a felszívódást — '
                + 'a domb így laposabb.',
            }
          : {
              title: 'Jó irány, egy aprósággal',
              body: 'Ha teheted, a zöldséget és a fehérjét edd előre, a szénhidrátot utoljára — '
                + 'a sorrend önmagában simít a görbén.',
            })

  return {
    level,
    label: LABELS[level],
    sugarEstimated,
    tip,
    expect: EXPECT[level],
    improve: improveFor({ carbs, sugar, fiber, protein, fat }, sugarEstimated),
    facts: [
      { label: 'szénhidrát', value: `${Math.round(carbs)} g` },
      { label: 'ebből cukor', value: sugarEstimated ? 'becsült' : `${Math.round(sugar)} g` },
      { label: 'rost', value: `${Math.round(fiber)} g` },
      { label: 'fehérje', value: `${Math.round(protein)} g` },
    ],
  }
}

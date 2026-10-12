// ============================================================
// Mezo · FuelQualityBlocks — a Makrók / Hozzávalók / Minőség / Mikrotápanyagok szekciók EGY példánya
// (Fuel Titanium S4, mezo-hygp; Folyadék F5, mezo-n4wf5.5).
//
// MIÉRT ITT: az owner döntése szerint egy recept megnyitása UGYANAZT a mélységet adja, mint egy logolt étkezésé, és a
// Receptműhely ELŐRE ugyanezt mutatja a vázlatról. Négy felület, egy igazság — a hívók csak a saját adatukat fordítják rá:
//   · FuelMealDetailPage (étkezés),   · RecipeDetailPage (recept),
//   · RecipeWorkshopPage (élő vázlat), · KamraItemDetailPage (kamra-tétel: Makrók + a lapkarács).
// Második példány NEM nyílik belőlük: két másolat garantáltan elcsúszna.
//
// FOLYADÉK (prototípus `vilagos/fuel.js`: `macroVials`, `ingRows`, `qTiles`, `microRows`): minden szekció a készlet
// darabjaiból áll — számozott fejléc (`Section`) + fehér kártya (`Card`); a makrók fiolák, a hozzávalók kétszintes sorok a
// kalória-részükkel, a minőség szintet viselő lapkák (`Stat`), a mikrotápanyagok sorok a keretükhöz mért szinttel.
// A hívó az oldal saját számozását adja (`n`), a fejlécet elhagyhatja (`heading={false}`: két kártya egy fejléc alatt),
// és a kártya aljára saját jegyzetet tehet (`note`). A korábbi exportok és propok változatlanok.
//
// ŐSZINTE-NULL, ABSZOLÚT: a mikrotápanyag-rész KIZÁRÓLAG a négy tárolt tényt mutatja (rost, cukor, só, telített zsír —
// `Nutrients`, mezo-m6uv). Vitamin és ásványi anyag még nincs a rendszerben (mezo-vj61): itt nem találunk ki egyet sem, és a
// hiányzó érték „—", nem nulla. Ugyanez áll a minőség-lapkákra: amit a sorok nem árulnak el, az „—" marad.
// A „Növényféle" lapka SZÁNDÉKOSAN nincs: azt a produkció étkezésenként / receptenként nem tárolja.
// ============================================================
import type { ReactNode } from 'react'
import { pct } from '@/shared/lib/pct'
import { fmtGrouped, fmtNum } from '@/shared/lib/format'
import { m, useM } from '@/shared/i18n'
import { Card, Empty, Level, Note, Row, Bub, Section, St, Stat, StatGrid } from '@/shared/ui/folyadek'
import type { ClayIconName, Icon3DName } from '@/shared/ui/clay'
import type { Nutrients } from '@/data/types'
import type { MealShareRow } from '@/features/fuel/logic/mealShare'
import type { MealQualityTruth } from '@/features/fuel/logic/mealQualityTruth'
import type { GlycemicBand } from '@/features/fuel/logic/glycemicBand'
import {
  GLY_COLOR, ItemRow, LineTags, MACRO_COLOR, MacroVials, NOVA_COLOR, type LineSource,
} from '@/features/fuel/components/folyadek'

/** What every section takes on top of its own data: the page's own number for the heading, an optional replacement
 *  title, or no heading at all (`heading={false}` — a second card under the previous heading). */
interface SectionFrame {
  n?: number
  heading?: string | false
}

function Heading({ n, heading, fallback }: SectionFrame & { fallback: string }) {
  if (heading === false) return null
  return <Section n={n} title={heading ?? fallback} />
}

/** NOVA-csoport rövid neve + színe. A rövid név a nyelvet követi, ezért OLVASÁSKOR számolódik (getter): a hívó renderben
 *  olvassa (`NOVA[n].short`), és sosem másolja modul-konstansba vagy memóba (N1.3). */
const novaFace = (n: 1 | 2 | 3 | 4): { short: string; color: string } => ({
  get short() { return m().fuelKozos.nova[`n${n}`] },
  color: NOVA_COLOR[n],
})
export const NOVA: Record<number, { short: string; color: string }> = {
  1: novaFace(1), 2: novaFace(2), 3: novaFace(3), 4: novaFace(4),
}

/**
 * Hozzávaló-szín + jel élelmiszer-család szerint (prototípus `ingredientStyle`). A név TÁROLT, a felhasználó írta szöveg:
 * a családot a magyar szótövek ismerik fel, más nyelvű névnél a semleges tányér marad.
 */
export function ingredientStyle(name: string): { color: string; icon: Icon3DName } {
  const n = name.toLowerCase()
  if (/csirke|lazac|tojás|hús|pulyka|tonhal|marha|hal/.test(n)) return { color: MACRO_COLOR.protein, icon: 't-meat' }
  if (/joghurt|skyr|túró|tej|sajt/.test(n)) return { color: MACRO_COLOR.lilac, icon: 't-protein' }
  if (/zab|rizs|tortilla|bulgur|kenyér|tészta|burgonya/.test(n)) return { color: MACRO_COLOR.carbs, icon: 't-carb' }
  if (/olaj|vaj|avok|mogyoró|mandula|mag/.test(n)) return { color: MACRO_COLOR.fat, icon: 't-avocado' }
  if (/méz|cukor|szirup/.test(n)) return { color: MACRO_COLOR.lilac, icon: 't-sugar' }
  if (/zöldség|gyümölcs|brokkoli|paprika|banán|erdei|saláta|spenót|áfonya/.test(n)) return { color: MACRO_COLOR.fiber, icon: 't-fiber' }
  return { color: MACRO_COLOR.water, icon: 't-plate' }
}

// ── Makrók ────────────────────────────────────────────────────────────────────────────────

/**
 * A Makrók szekció: a tányér / recept / vázlat SAJÁT összetétele három fiolában — a szám a gramm, a szint az energia
 * megoszlása (owner-döntés: itt NINCS „a nap céljához mérve"). Honest-null: hiányzó grammnál „—" és „nincs adat", és
 * akkor egyik fiola sem mutat részesedést. `groupLabel` a csoport felolvasott neve; `frame` a régi gyűrűk mondatának
 * kerete volt — a fiolák a saját feliratukkal beszélnek, a prop a hívók kedvéért marad.
 */
export function FuelMacroShareSection({ shares, groupLabel, n, heading, note }: SectionFrame & {
  shares: MealShareRow[]; groupLabel: string; frame: string
  /** A sentence under the vials (the meal page says where the energy comes from). */
  note?: ReactNode
}) {
  const M = useM()
  const g = (key: MealShareRow['key']) => shares.find(s => s.key === key)?.grams ?? null
  return (
    <>
      <Heading n={n} heading={heading} fallback={M.fuelEtkezes.quality.macros} />
      <Card className="fe-mac" role="group" aria-label={groupLabel}>
        <MacroVials p={g('p')} c={g('c')} f={g('f')} />
        {note != null && <Note>{note}</Note>}
      </Card>
    </>
  )
}

// ── Hozzávalók ────────────────────────────────────────────────────────────────────────────

/** Egy olvasható hozzávaló-sor — annyi, amennyit a felület valóban el tud mondani róla. */
export interface FuelIngredientRowVM {
  key: string
  name: string
  /** A sor kcal-ja, vagy `null`, ha a forrás nem adott értéket (sosem kitalált 0). */
  kcal: number | null
  /** A sor részesedése a tételek kcal-jából, `null`, ha nem számolható. */
  share: number | null
  /** Mennyiség emberi alakban („150 g"). */
  amount: string
  /** A sor eredete — a hívó saját felirata; elhagyható, ha a felület nem tud eredetet. (Az ikon a régi bőré volt.) */
  origin?: { label: string; icon?: ClayIconName | Icon3DName }
  /** A sor eredete KULCSKÉNT — megadva a közös címke szól (kamra / recept / becslés), a nyelvet követve. */
  source?: LineSource | null
  nova?: number | null
}

/** A Hozzávalók szekció — csak olvasás (a szerkesztés a logolóban és a Műhelyben él); a sorok nem koppinthatók. */
export function FuelIngredientSection({ rows, empty, n, heading, note }: SectionFrame & {
  rows: FuelIngredientRowVM[]; empty: string
  /** What the bar means on this surface („…az étkezés kalóriájának mekkora részét adja a tétel."). */
  note?: ReactNode
}) {
  const M = useM()
  const Q = M.fuelEtkezes.quality
  return (
    <>
      <Heading n={n} heading={heading} fallback={rows.length > 0 ? Q.ingredientsCount(rows.length) : Q.ingredients} />
      <Card className="fe-ing">
        {rows.length === 0 ? <Empty icon="t-plate">{empty}</Empty> : (
          <>
            {rows.map(row => (
              <ItemRow key={row.key} icon={ingredientStyle(row.name).icon} title={row.name}
                sub={<LineTags source={row.source} nova={row.nova} extra={[row.source ? null : row.origin?.label]} />}
                value={<>{row.kcal == null ? '—' : fmtGrouped(row.kcal)}{row.kcal != null && <small>kcal</small>}</>}>
                <Level pct={row.share ?? 0} height={8} />
                <small className="fe-shn">{row.share == null ? row.amount : Q.shareAmount(row.amount, row.share)}</small>
              </ItemRow>
            ))}
            {note != null && <Note>{note}</Note>}
          </>
        )}
      </Card>
    </>
  )
}

// ── Minőség ───────────────────────────────────────────────────────────────────────────────

/** Amit EGY tételsorról a minőség-lapkák tudnak — a hiányzó tény `null`, nem nulla. */
export interface FuelQualityLine { grams: number | null; kcal: number | null; nova: number | null }

/** A három számolt lapka stabil kulcsa — erre köt a `truth` felülírás (mezo-tm3sb). */
export type QualityTileKey = 'base' | 'density' | 'ultra'

/** Melyik `truth`-tény tartozik melyik lapkához. Egy lapka-átrendezés ezt nem tudja elrontani. */
const TRUTH_OF: Record<QualityTileKey, keyof MealQualityTruth> = {
  base: 'basePct', density: 'densityKcalPer100g', ultra: 'ultraItems',
}

/** A lapka szintje a SAJÁT értékéből (prototípus `qTiles`): arány = önmaga; sűrűség = 400 kcal/100 g a tele lapka;
 *  ultra = tételenként egy harmad. Ismeretlen értéknél nincs szint. */
function tileLevel(key: QualityTileKey, value: number | null): number | null {
  if (value == null) return null
  return key === 'base' ? value : key === 'density' ? Math.min(100, value / 4) : Math.min(100, value * 34)
}
const tileColor = (key: QualityTileKey, value: number | null): string =>
  key === 'base' ? MACRO_COLOR.carbs : key === 'density' ? MACRO_COLOR.protein : value ? MACRO_COLOR.lilac : MACRO_COLOR.water

/** Minőség-lapkák a tételsorokból, honest-nullal: amit a sorok nem árulnak el, az „—". A feliratok a nyelvet követik,
 *  ezért a függvényt RENDERBEN kell hívni. A növényfélék száma SZÁNDÉKOSAN nincs itt. */
export function qualityTiles(lines: FuelQualityLine[]): {
  key: QualityTileKey; label: string; value: number | null; unit: string
  icon: Icon3DName; color: string
}[] {
  const Q = m().fuelEtkezes.quality
  const lineKcal = lines.reduce((s, l) => s + (l.kcal ?? 0), 0)
  const hasNova = lines.length > 0 && lines.every(l => l.nova != null)
  const baseShare = hasNova && lineKcal > 0
    ? Math.round((lines.filter(l => l.nova === 1).reduce((s, l) => s + (l.kcal ?? 0), 0) / lineKcal) * 100)
    : null
  const gramTotal = lines.length > 0 && lines.every(l => l.grams != null)
    ? lines.reduce((s, l) => s + (l.grams as number), 0)
    : null
  const density = gramTotal != null && gramTotal > 0 && lineKcal > 0
    ? Math.round((lineKcal / gramTotal) * 100)
    : null
  const ultra = hasNova ? lines.filter(l => l.nova === 4).length : null
  return [
    { key: 'base', label: Q.base, value: baseShare, unit: '%', icon: 't-processing', color: tileColor('base', baseShare) },
    { key: 'density', label: Q.density, value: density, unit: 'kcal/100 g', icon: 't-bolt', color: tileColor('density', density) },
    { key: 'ultra', label: Q.ultra, value: ultra, unit: Q.items(ultra ?? 0), icon: 't-ultra', color: tileColor('ultra', ultra) },
  ]
}

/** Egy minőség-lapka: EGY nagy szám (vagy „—") a saját egységével. */
export interface FuelNutriTile {
  label: string
  /** Már formázott érték, vagy `null` — a `null` „—"-t és „nincs adat"-ot ad, sosem kitalált nullát. Lehet SZÓ is, nem
   *  csak szám: a vércukor-kártya a sáv szavát viseli itt, szándékosan szám helyett. */
  value: string | null
  unit: string
  /** A lapka sarok-jele. Csak a jel-készlet (`t-…`) rajzolódik; egy régi clay-név jel nélkül marad. */
  icon: ClayIconName | Icon3DName
  color: string
  /** A lapka szintje %-ban (a lapka maga az edény); elhagyva a lapka sima. */
  pct?: number | null
  /** Halk sor az érték alatt. */
  note?: ReactNode
  /** Megadva a lapka gombbá válik és ezt hívja. A többi lapka nem interaktív. */
  onOpen?: () => void
}

const glyph = (icon: ClayIconName | Icon3DName): Icon3DName | undefined =>
  icon.startsWith('t-') ? (icon as Icon3DName) : undefined

/** A minőség-lapka rács. Ezt a primitívet a recept / étkezés Minőség szekciója ÉS a kamra-tétel per-100 g lapkái is
 *  használják (egy markup, két hívó). */
export function FuelNutriTiles({ tiles }: { tiles: FuelNutriTile[] }) {
  const M = useM()
  const K = M.fuelKozos
  return (
    <StatGrid className="fe-q">
      {tiles.map(t => (
        <Stat key={t.label} label={t.label} icon={glyph(t.icon)} color={t.color}
          value={t.value ?? '—'} unit={t.value == null ? undefined : t.unit}
          pct={t.value == null ? null : t.pct}
          note={t.value == null ? K.noData : t.note}
          onClick={t.onOpen}
          aria-label={t.onOpen ? M.fuelEtkezes.quality.tileAria(t.label, t.value ?? K.noData) : undefined} />
      ))}
    </StatGrid>
  )
}

/**
 * A Minőség szekció.
 *
 * `truth` (mezo-tm3sb) — HA meg van adva, az felülírja a tételsoros számítást lapkánként. A logolt étkezés részletlapja
 * ezt adja, mert ott a tételsorok egy receptet EGY összecsukott sorként hordoznak, és abból az alapanyag-arány csak 0%
 * vagy 100% tud kijönni. A recept és a Receptműhely NEM ad `truth`-ot: ott a sorok valóban hozzávalók.
 *
 * FONTOS: egy `truth`-beli `null` azt jelenti, hogy „nem tudjuk" — NEM azt, hogy „számold ki a sorokból".
 *
 * `glycemic` — a negyedik kártya (mezo-6mi43), a vércukor-válasz SÁVJA. Sáv, nem szám (owner-döntés). `undefined` → a
 * kártya nincs (recept, vázlat); `null` → a kártya ott van, „—" és „nincs adat" (étkezés, aminek a szénhidrátja ismeretlen).
 */
export function FuelQualitySection({ lines, truth, glycemic, onOpenGlycemic, n, heading, note }: SectionFrame & {
  lines: FuelQualityLine[]
  truth?: MealQualityTruth
  glycemic?: GlycemicBand | null
  onOpenGlycemic?: () => void
  note?: ReactNode
}) {
  const M = useM()
  const Q = M.fuelEtkezes.quality
  // Kulcsra kötve, NEM sorrendre: egy átrendezés így nem tud csendben rossz számot a rossz lapkára tenni.
  const tiles: FuelNutriTile[] = qualityTiles(lines).map(t => {
    const value = truth ? truth[TRUTH_OF[t.key]] : t.value
    return {
      ...t,
      value: value == null ? null : fmtNum(value),
      unit: t.key === 'ultra' ? Q.items(value ?? 0) : t.unit,
      color: tileColor(t.key, value),
      pct: tileLevel(t.key, value),
    }
  })
  if (glycemic !== undefined) {
    tiles.push(glycemic == null
      ? { label: Q.glucose, value: null, unit: '', icon: 't-glucose', color: MACRO_COLOR.water }
      : {
          label: Q.glucose,
          // A SÁV SZAVA áll a nagy-szám helyén. Ha a cukor becsült, a kártya kimondja — feltevést mért adatként bemutatni tilos.
          value: glycemic.label,
          unit: '',
          icon: 't-glucose',
          color: GLY_COLOR[glycemic.level],
          pct: GLY_LEVEL[glycemic.level],
          note: onOpenGlycemic
            ? (glycemic.sugarEstimated ? Q.estimatedDetails : Q.details)
            : (glycemic.sugarEstimated ? Q.estimated : undefined),
          onOpen: onOpenGlycemic,
        })
  }
  return (
    <>
      <Heading n={n} heading={heading} fallback={Q.quality} />
      <Card className="fe-qc">
        <FuelNutriTiles tiles={tiles} />
        {note != null && <Note>{note}</Note>}
      </Card>
    </>
  )
}

/** A sáv szintje a lapkán: alacsony · közepes · magas (prototípus `[26, 55, 84]`) — rajz, nem mérés. */
const GLY_LEVEL: Record<GlycemicBand['level'], number> = { low: 26, mid: 55, high: 84 }

// ── Mikrotápanyagok ───────────────────────────────────────────────────────────────────────

type MicroStatus = 'good' | 'ok' | 'low'
const STATUS_TONE: Record<MicroStatus, 'ok' | 'q' | 'warn'> = { good: 'ok', ok: 'q', low: 'warn' }

/** A NÉGY tárolt tény egy étkezés-méretű kerethez mérve (prototípus `microRows`). Más nem jön ide: vitamin / ásványi
 *  anyag a produkcióban nem létezik (mezo-vj61). `limit` = keret (kevesebb a jobb), különben cél. */
function microRows(n: Nutrients): {
  key: 'fiber' | 'sugar' | 'salt' | 'satFat'; value: number | null; allot: number; icon: Icon3DName; color: string
  status: (v: number) => MicroStatus; limit: boolean
}[] {
  return [
    { key: 'fiber', value: n.fiberG, allot: 7, icon: 't-fiber', color: MACRO_COLOR.fiber, status: v => (v >= 6 ? 'good' : 'ok'), limit: false },
    { key: 'sugar', value: n.sugarG, allot: 25, icon: 't-sugar', color: MACRO_COLOR.lilac, status: v => (v <= 12 ? 'good' : v <= 22 ? 'ok' : 'low'), limit: true },
    { key: 'salt', value: n.saltG, allot: 1.7, icon: 't-salt', color: MACRO_COLOR.water, status: v => (v <= 1 ? 'good' : 'ok'), limit: true },
    { key: 'satFat', value: n.saturatedFatG, allot: 7, icon: 't-avocado', color: MACRO_COLOR.carbs, status: v => (v <= 5 ? 'good' : v <= 9 ? 'ok' : 'low'), limit: true },
  ]
}

/**
 * A Mikrotápanyagok szekció. `frame` a keret megnevezése, amihez mérünk, a hívó nyelvén („az étkezés", „az adag" /
 * "the meal", "a serving’s") — így ugyanaz a szekció tud étkezésről ÉS receptadagról beszélni. A sorok kizárólag a négy
 * tárolt tényt tartalmazzák; a képesség-hiányról szóló mondat (`FuelMicroNote`) a kártya aljára a `note` propon át kerül.
 */
export function FuelMicroSection({ nutrients, frame, n, heading, note }: SectionFrame & {
  nutrients: Nutrients; frame: string; note?: ReactNode
}) {
  const M = useM()
  const Q = M.fuelEtkezes.quality
  const K = M.fuelKozos
  return (
    <>
      <Heading n={n} heading={heading} fallback={Q.micros} />
      <Card className="fe-mic">
        {microRows(nutrients).map(row => {
          const label = K.factsLong[row.key]
          if (row.value == null) {
            return (
              <Row key={row.key} className="fe-micro is-unknown" left={<Bub icon={row.icon} size={40} color="var(--fo-faint)" />}
                title={label} sub={Q.noSourceValue} value="—" right={<St tone="q">{K.noData}</St>} />
            )
          }
          const status = row.status(row.value)
          const share = Math.round(pct(row.value, row.allot))
          return (
            <ItemRow key={row.key} icon={row.icon} title={label}
              sub={row.limit ? Q.shareOfLimit(frame, share) : Q.shareOfGoal(frame, share)}
              value={<>{fmtNum(row.value)}<small>g</small></>}>
              <Level pct={Math.min(100, share)} height={8} color={row.color} />
              <St tone={STATUS_TONE[status]}>{Q.status[status]}</St>
            </ItemRow>
          )
        })}
        {note}
      </Card>
    </>
  )
}

/** Ismert hiány, nem figyelmetlenség: vitamin / ásványi anyag = mezo-vj61. A mondat a KÉPESSÉG hiányáról beszél, nem egy
 *  mikrotápanyagról — ezért külön darab: a hívó a Mikrotápanyagok kártya aljára adja (`note`), vagy a lapra teszi. */
export function FuelMicroNote({ children }: { children?: ReactNode }) {
  const M = useM()
  return <Note className="fe-micnote">{children ?? M.fuelEtkezes.quality.microNote}</Note>
}

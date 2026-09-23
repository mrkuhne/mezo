// ============================================================
// Mezo · FuelQualityBlocks — a Hozzávalók / Minőség / Mikrotápanyagok szekciók EGY példánya
// (Fuel Titanium S4, mezo-hygp; az S1b étkezés-részletlapból kiemelve, mezo-33k6).
//
// MIÉRT ITT: az owner döntése szerint egy recept megnyitása UGYANAZT a mélységet adja, mint egy
// logolt étkezésé, és a Receptműhely ELŐRE ugyanezt mutatja a vázlatról. Három felület, egy
// igazság — ezért a három szekció itt lakik, és a hívók csak a saját adatukat fordítják rá:
//   · FuelMealDetailPage (étkezés),      · RecipeDetailPage (recept),
//   · RecipeWorkshopPage (élő vázlat).
// Második példány NEM nyílik belőlük (a plan Anti-duplication pontja): két másolat garantáltan
// elcsúszna, és az owner épp az azonos mélységet kérte.
//
// Vizuális referencia VÁLTOZATLAN: a prototípus `qualityTilesHtml` (:104), `microCardsHtml`
// (:114) és `ingredientStyle` (:93) darabjai, az S1b `fmx-` CSS-blokkjának osztályaival — a
// stílus ott él, ide nem kerül második CSS-blokk.
//
// ŐSZINTE-NULL, ABSZOLÚT: a mikrotápanyag-rész KIZÁRÓLAG a négy tárolt tényt mutatja (rost,
// cukor, só, telített zsír — `Nutrients`, mezo-m6uv). Vitamin és ásványi anyag még nincs a
// rendszerben (mezo-vj61, manifeszt F1 sor): itt nem találunk ki egyet sem, és a hiányzó érték
// „—", nem nulla. Ugyanez áll a minőség-lapkákra: amit a sorok nem árulnak el (NOVA-csoport,
// grammos tömeg), az „—" marad.
// ============================================================
import type { ReactNode } from 'react'
import { pct } from '@/shared/lib/pct'
import { hu1, huInt } from '@/shared/lib/huNum'
import { ContentIcon, type ClayIconName, type Icon3DName } from '@/shared/ui/clay'
import type { Nutrients } from '@/data/types'
import type { MealShareRow } from '@/features/fuel/logic/mealShare'
import type { MealQualityTruth } from '@/features/fuel/logic/mealQualityTruth'
import type { GlycemicBand } from '@/features/fuel/logic/glycemicBand'
import { useFuelCountUp } from '@/features/fuel/components/FuelMacroRings'

/** NOVA-csoport rövid neve + hue (prototípus `NOVA_SHORT` :179 / `NOVA_COLOR` :91). */
export const NOVA: Record<number, { short: string; color: string }> = {
  1: { short: 'Alapanyag', color: 'var(--sage)' },
  2: { short: 'Konyhai összetevő', color: 'var(--sky)' },
  3: { short: 'Feldolgozott', color: 'var(--amber)' },
  4: { short: 'Ultra-feldolgozott', color: 'var(--coral)' },
}

/**
 * Hozzávaló-hue + clay ikon élelmiszer-család szerint (prototípus `ingredientStyle`, :93),
 * a ház tokenjeire és a ház clay-készletére fordítva — új gradiens/ikon nem kellett hozzá.
 */
export function ingredientStyle(name: string): { color: string; icon: Icon3DName } {
  // Üveg (mezo-me75u.1): the 3D content set — dairy = the protein blob, honey/sugar = the
  // sugar cubes (fuel-uveg.html + uveg-alap-ikonok.html).
  const n = name.toLocaleLowerCase('hu-HU')
  if (/csirke|lazac|tojás|hús|pulyka|tonhal|marha|hal/.test(n)) return { color: 'var(--coral)', icon: 't-meat' }
  if (/joghurt|skyr|túró|tej|sajt/.test(n)) return { color: 'var(--lav)', icon: 't-protein' }
  if (/zab|rizs|tortilla|bulgur|kenyér|tészta|burgonya/.test(n)) return { color: 'var(--amber)', icon: 't-carb' }
  if (/olaj|vaj|avok|mogyoró|mandula|mag/.test(n)) return { color: 'var(--sage)', icon: 't-avocado' }
  if (/méz|cukor|szirup/.test(n)) return { color: 'var(--rose)', icon: 't-sugar' }
  if (/zöldség|gyümölcs|brokkoli|paprika|banán|erdei|saláta|spenót|áfonya/.test(n)) return { color: 'var(--sage)', icon: 't-fiber' }
  return { color: 'var(--sky)', icon: 't-plate' }
}

// ── Makrók ────────────────────────────────────────────────────────────────────────────────

/**
 * Egy makró-gyűrű: a GRAMM a nagy, makró-színű szám a gyűrű belsejében, ALATTA a saját
 * összetételből vett százalék (owner, mezo-n9peo — korábban fordítva volt). Az ívet továbbra
 * is a részesedés rajzolja: a gyűrű alakja a megoszlásról beszél, a számjegy a mennyiségről.
 *
 * Honest-null, KÜLÖN a két tényre: ismeretlen részesedésnél az ív üres és a százalék „—";
 * ismeretlen grammnál a nagy szám „—" — egyik sem esik vissza nullára, és a hiányzó gramm nem
 * viszi magával a meglévő százalékot.
 */
function ShareRing({ label, grams, sharePct, color, icon, frame }: {
  label: string; grams: number | null; sharePct: number | null
  color: string; icon: ClayIconName; frame: string
}) {
  // A felszámolás azt a számot kíséri, ami NAGY — az most a gramm.
  const counted = useFuelCountUp(grams ?? 0)
  return (
    // Üveg (mezo-me75u.1): each share is its own glass tile in the macro hue.
    <div className="fmx-cell glass" style={{ '--macro-color': color } as React.CSSProperties}>
      <span className="fmx-ico" aria-hidden="true"><ContentIcon name={icon} size={30} /></span>
      <div className={`fmx-ring is-share${sharePct == null ? ' is-empty' : ''}`}
        style={{ '--macro-color': color, '--ring-progress': String(sharePct ?? 0) } as React.CSSProperties}>
        <svg viewBox="0 0 80 80" aria-hidden="true">
          <circle className="fmx-ring-track" cx="40" cy="40" r="34" pathLength={100} />
          <circle className="fmx-ring-progress" cx="40" cy="40" r="34" pathLength={100} />
        </svg>
        {/* A felolvasott mondat a GRAMMAL nyit, ahogy a látvány is. */}
        <span aria-label={`${label}: ${grams == null ? 'nincs adat' : `${huInt(grams)} g`}, ${sharePct == null ? 'nincs adat' : `${frame} ${sharePct}%-a`}`}>
          <strong aria-hidden="true" className="fmx-share-g">
            {/* A „ g" a SZÖVEGBEN él, nem margóban: így a gyűrű belseje egyetlen olvasható
                karakterláncot ad („23 g"), és a felületet szövegre kereső tesztek nem egy
                elemhatáron hasadó számot látnak. */}
            {grams == null ? '—' : <>{huInt(Math.round(counted))}<i>&nbsp;g</i></>}
          </strong>
          <b aria-hidden="true" className="fmx-share-pct">{sharePct == null ? '—' : `${sharePct}%`}</b>
        </span>
      </div>
      <span className="fmx-share-name">{label}</span>
    </div>
  )
}

const MACRO_COLOR: Record<MealShareRow['key'], string> = {
  p: 'var(--macro-protein)', c: 'var(--macro-carbs)', f: 'var(--macro-fat)',
}
const MACRO_ICON: Record<MealShareRow['key'], ClayIconName> = {
  p: 'i-hus', c: 'i-gabona', f: 'i-avokado',
}

/**
 * A Makrók szekció: a tányér/recept/vázlat SAJÁT összetétele — owner-döntés, hogy itt NINCS
 * „a nap céljához mérve" felirat, ezért a három szám 100%-ra jön ki. `frame` az a keret, amihez
 * a képernyőolvasó mondata mér („az étkezés energiájának", „a recept energiájának").
 */
export function FuelMacroShareSection({ shares, groupLabel, frame }: {
  shares: MealShareRow[]; groupLabel: string; frame: string
}) {
  return (
    <section className="fmx-detail-sec">
      <div className="fmx-section"><h2>Makrók</h2></div>
      <div className="fmx-detail-rings" role="group" aria-label={groupLabel}>
        {shares.map(s => (
          <ShareRing key={s.key} label={s.label} grams={s.grams} sharePct={s.pct}
            color={MACRO_COLOR[s.key]} icon={MACRO_ICON[s.key]} frame={frame} />
        ))}
      </div>
    </section>
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
  /** A sor eredete — felirat + clay ikon; elhagyható, ha a felület nem tud eredetet. */
  origin?: { label: string; icon: ClayIconName | Icon3DName }
  nova?: number | null
}

/** A Hozzávalók szekció — csak olvasás (a szerkesztés a logolóban és a Műhelyben él). */
export function FuelIngredientSection({ rows, empty }: { rows: FuelIngredientRowVM[]; empty: string }) {
  return (
    <section className="fmx-detail-sec">
      <div className="fmx-section"><h2>Hozzávalók</h2></div>
      {rows.length === 0 ? (
        <p className="fmx-block-empty">{empty}</p>
      ) : (
        <div className="fmx-ing-list">
          {rows.map(row => {
            const style = ingredientStyle(row.name)
            const nova = row.nova != null ? NOVA[row.nova] : null
            return (
              <div key={row.key} className="fmx-ing-row glass"
                style={{ '--ing-color': style.color } as React.CSSProperties}>
                <span className="fmx-ing-art" aria-hidden="true"><ContentIcon name={style.icon} size={34} /></span>
                <span className="fmx-ing-copy">
                  <strong>{row.name}</strong>
                  <span className="fmx-ing-meta">
                    {row.origin && (
                      <em><ContentIcon name={row.origin.icon} size={13} />{row.origin.label}</em>
                    )}
                    {nova && (
                      <em className="is-nova" style={{ '--nova': nova.color } as React.CSSProperties}>
                        <i aria-hidden="true" />{nova.short}
                      </em>
                    )}
                  </span>
                  {row.share != null && (
                    <i className="fmx-ing-bar" aria-hidden="true">
                      <b style={{ '--w': `${row.share}%` } as React.CSSProperties} />
                    </i>
                  )}
                </span>
                <span className="fmx-ing-end">
                  <b>{row.kcal == null ? '—' : huInt(row.kcal)}<small>kcal</small></b>
                  <small>{row.amount}</small>
                </span>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

// ── Minőség ───────────────────────────────────────────────────────────────────────────────

/** Amit EGY tételsorról a minőség-lapkák tudnak — a hiányzó tény `null`, nem nulla. */
export interface FuelQualityLine { grams: number | null; kcal: number | null; nova: number | null }

/** Minőség-lapkák a prototípus `qualityTilesHtml` (:104) számai szerint, honest-nullal:
 *  amit a sorok nem árulnak el, az „—". A növényfélék száma SZÁNDÉKOSAN nincs itt: azt a
 *  produkció per-étkezés/per-recept nem tárolja, és egy kitalált szám tiltott. */
/** A három számolt lapka stabil kulcsa — erre köt a `truth` felülírás (mezo-tm3sb). */
export type QualityTileKey = 'base' | 'density' | 'ultra'

/** Melyik `truth`-tény tartozik melyik lapkához. Egy lapka-átrendezés ezt nem tudja elrontani. */
const TRUTH_OF: Record<QualityTileKey, keyof MealQualityTruth> = {
  base: 'basePct', density: 'densityKcalPer100g', ultra: 'ultraItems',
}

export function qualityTiles(lines: FuelQualityLine[]): {
  key: QualityTileKey; label: string; value: number | null; unit: string
  icon: Icon3DName; color: string
}[] {
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
    // Üveg (mezo-me75u.1): alapanyag = the processing gear, energy = the bolt (fuel-uveg.html),
    // ultra = the sealed pack (uveg-alap-ikonok.html).
    { key: 'base', label: 'Alapanyag-arány', value: baseShare, unit: '%', icon: 't-processing', color: 'var(--amber)' },
    { key: 'density', label: 'Energiasűrűség', value: density, unit: 'kcal/100 g', icon: 't-bolt', color: 'var(--coral)' },
    { key: 'ultra', label: 'Ultra-feldolgozott', value: ultra, unit: 'tétel', icon: 't-ultra', color: ultra ? 'var(--coral)' : 'var(--sky)' },
  ]
}

/** Egy minőség-lapka: EGY nagy szám (vagy „—") a saját egységével, clay szimbólummal. */
export interface FuelNutriTile {
  label: string
  /** Már formázott érték, vagy `null` — a `null` „—"-t ad, sosem kitalált nullát. Lehet SZÓ is,
   *  nem csak szám: a vércukor-kártya a sáv szavát viseli itt, szándékosan szám helyett. */
  value: string | null
  unit: string
  /** Üveg (mezo-me75u.1): a 3D content icon; a clay name still renders through `CLAY_TO_3D`
   *  (or as clay) for the surfaces not yet re-dressed (Kamra item). */
  icon: ClayIconName | Icon3DName
  color: string
  /** Megadva a lapka gombbá válik és ezt hívja. A többi lapka nem interaktív. */
  onOpen?: () => void
}

/** A minőség-lapka rács — a prototípus `nutri-tiles`-a. Ezt a primitívet a recept/étkezés
 *  Minőség szekciója ÉS a kamra-tétel per-100 g lapkái is használják (egy markup, két hívó). */
export function FuelNutriTiles({ tiles }: { tiles: FuelNutriTile[] }) {
  return (
    <div className="fmx-nutri-tiles">
      {tiles.map(t => {
        const body = (
          <>
            <span className="fmx-nt-top">
              <span className="fmx-nt-art" aria-hidden="true"><ContentIcon name={t.icon} size={36} /></span>
              <strong>{t.value == null ? '—' : t.value}{t.value != null && t.unit !== '' && <small>{t.unit}</small>}</strong>
            </span>
            <span className="fmx-nt-label">{t.label}</span>
          </>
        )
        // Üveg: a known value is a glass tile; the honest gap (`is-unknown`) is the dashed state.
        const cls = `fmx-nutri-tile${t.value == null ? ' is-unknown' : ' glass'}`
        const style = { '--nt-color': t.color } as React.CSSProperties
        // Csak a `onOpen`-t hordozó lapka gomb — a többi nem koppintható, és nem is úgy néz ki.
        return t.onOpen ? (
          <button key={t.label} type="button" className={`${cls} is-door np-press`} style={style}
            onClick={t.onOpen} aria-label={`${t.label}: ${t.value ?? 'nincs adat'} — részletek`}>
            {body}
          </button>
        ) : (
          <div key={t.label} className={cls} style={style}>{body}</div>
        )
      })}
    </div>
  )
}

/**
 * A Minőség szekció. A fejléc SZÁNDÉKOSAN nem visel darabszámot/feliratot (owner).
 *
 * `truth` (mezo-tm3sb) — HA meg van adva, az felülírja a tételsoros számítást lapkánként. A
 * logolt étkezés részletlapja ezt adja, mert ott a tételsorok egy receptet EGY összecsukott
 * sorként hordoznak, és abból az alapanyag-arány csak 0% vagy 100% tud kijönni. A recept és a
 * Receptműhely NEM ad `truth`-ot: ott a sorok valóban hozzávalók, tehát a helyi számítás helyes.
 *
 * FONTOS: egy `truth`-beli `null` azt jelenti, hogy „nem tudjuk" — NEM azt, hogy „számold ki a
 * sorokból". A visszaesés épp az a hazugság lenne, ami ellen ez az egész változás született: ha a
 * háttérrendszer degradálta egy dimenziót, ő már eldöntötte, hogy az adat nem megbízható.
 *
 * `glycemic` — a negyedik kártya (mezo-6mi43), a vércukor-válasz SÁVJA. Sáv, nem szám: a vegyes
 * étkezés GI-matematikája 22-50%-ot téved (owner-döntés). `null` → a kártya nem jelenik meg.
 */
export function FuelQualitySection({ lines, truth, glycemic, onOpenGlycemic }: {
  lines: FuelQualityLine[]
  truth?: MealQualityTruth
  glycemic?: GlycemicBand | null
  onOpenGlycemic?: () => void
}) {
  const computed = qualityTiles(lines)
  // Kulcsra kötve, NEM sorrendre: egy átrendezés így nem tud csendben rossz számot a rossz
  // lapkára tenni.
  const tiles: FuelNutriTile[] = computed.map(t => {
    const value = truth ? truth[TRUTH_OF[t.key]] : t.value
    return { ...t, value: value == null ? null : hu1(value) }
  })
  if (glycemic) {
    tiles.push({
      label: 'Vércukor-válasz',
      // A SÁV SZAVA áll a nagy-szám helyén. Ha a cukor becsült, a kártya kimondja — feltevést
      // mért adatként bemutatni tilos.
      value: glycemic.label,
      unit: glycemic.sugarEstimated ? 'becsült' : '',
      icon: 't-glucose',
      color: GLYCEMIC_COLOR[glycemic.level],
      onOpen: onOpenGlycemic,
    })
  }
  return (
    <section className="fmx-detail-sec">
      <div className="fmx-section"><h2>Minőség</h2></div>
      <FuelNutriTiles tiles={tiles} />
    </section>
  )
}

/** A sáv hangulat-színe. A „magas" LILA, nem a ház hiba-korallja: egy magas vércukor-válasz nem
 *  kudarc, csak egy tény a tányérról (szégyenmentes keretezés). */
const GLYCEMIC_COLOR: Record<GlycemicBand['level'], string> = {
  low: 'var(--sage)', mid: 'var(--amber)', high: 'var(--lav)',
}

// ── Mikrotápanyagok ───────────────────────────────────────────────────────────────────────

type MicroStatus = 'good' | 'ok' | 'low'
const STATUS_LABEL: Record<MicroStatus, string> = { good: 'rendben', ok: 'oké', low: 'figyeld' }

/** A NÉGY tárolt tény egy étkezés-méretű kerethez mérve (prototípus `microCardsHtml`, :114).
 *  Más nem jön ide: vitamin/ásványi anyag a produkcióban nem létezik (mezo-vj61). */
function microRows(n: Nutrients): {
  label: string; value: number | null; allot: number; icon: Icon3DName; color: string;
  status: (v: number) => MicroStatus; kind: string
}[] {
  return [
    { label: 'Rost', value: n.fiberG, allot: 7, icon: 't-fiber', color: 'var(--sage)', status: v => (v >= 6 ? 'good' : 'ok'), kind: 'cél' },
    { label: 'Cukor', value: n.sugarG, allot: 25, icon: 't-sugar', color: 'var(--rose)', status: v => (v <= 12 ? 'good' : v <= 22 ? 'ok' : 'low'), kind: 'keret' },
    { label: 'Só', value: n.saltG, allot: 1.7, icon: 't-salt', color: 'var(--sky)', status: v => (v <= 1 ? 'good' : 'ok'), kind: 'keret' },
    { label: 'Telített zsír', value: n.saturatedFatG, allot: 7, icon: 't-avocado', color: 'var(--amber)', status: v => (v <= 5 ? 'good' : v <= 9 ? 'ok' : 'low'), kind: 'keret' },
  ]
}

/**
 * A Mikrotápanyagok szekció. `frame` a keret magyar megnevezése, amihez mérünk („az étkezés",
 * „az adag") — így ugyanaz a szekció tud étkezésről ÉS receptadagról beszélni anélkül, hogy a
 * szöveg hazudna. A szekció MAGA kizárólag a négy tárolt tényt tartalmazza: a képesség-hiányról
 * szóló lábjegyzet SZÁNDÉKOSAN a szekción KÍVÜL áll (lásd `FuelMicroNote`).
 */
export function FuelMicroSection({ nutrients, frame }: { nutrients: Nutrients; frame: string }) {
  const rows = microRows(nutrients)
  return (
    <section className="fmx-detail-sec">
      <div className="fmx-section"><h2>Mikrotápanyagok</h2></div>
      <div className="fmx-micro-list">
        {rows.map(row => {
          if (row.value == null) {
            return (
              <div key={row.label} className="fmx-micro-card is-unknown"
                style={{ '--mc-color': row.color } as React.CSSProperties}>
                <span className="fmx-mc-art" aria-hidden="true"><ContentIcon name={row.icon} size={34} /></span>
                <span className="fmx-mc-copy">
                  <strong>{row.label}</strong>
                  <small>a forrás nem adott értéket</small>
                </span>
                <span className="fmx-mc-end"><b>—</b><em>nincs adat</em></span>
              </div>
            )
          }
          const status = row.status(row.value)
          const share = Math.round(pct(row.value, row.allot))
          return (
            <div key={row.label} className={`fmx-micro-card is-${status} glass`}
              style={{ '--mc-color': row.color } as React.CSSProperties}>
              <span className="fmx-mc-art" aria-hidden="true"><ContentIcon name={row.icon} size={34} /></span>
              <span className="fmx-mc-copy">
                <strong>{row.label}</strong>
                <i aria-hidden="true"><b style={{ '--w': `${Math.min(100, share)}%` } as React.CSSProperties} /></i>
                <small>{frame}-{row.kind} {share}%-a</small>
              </span>
              <span className="fmx-mc-end"><b>{hu1(row.value)} g</b><em>{STATUS_LABEL[status]}</em></span>
            </div>
          )
        })}
      </div>
    </section>
  )
}

/** Ismert hiány, nem figyelmetlenség: vitamin/ásványi anyag = mezo-vj61, manifeszt F1. A mondat
 *  a KÉPESSÉG hiányáról beszél, nem egy mikrotápanyagról — ezért áll a szekción kívül. */
export function FuelMicroNote({ children }: { children?: ReactNode }) {
  return (
    <p className="fmx-nutri-note">
      {children ?? 'Ezt tároljuk ma. A vitaminok és ásványi anyagok még úton vannak.'}
    </p>
  )
}

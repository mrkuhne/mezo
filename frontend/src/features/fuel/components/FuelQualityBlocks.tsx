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
import { ClayIcon, type ClayIconName } from '@/shared/ui/clay'
import type { Nutrients } from '@/data/types'
import type { MealShareRow } from '@/features/fuel/logic/mealShare'
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
export function ingredientStyle(name: string): { color: string; icon: ClayIconName } {
  const n = name.toLocaleLowerCase('hu-HU')
  if (/csirke|lazac|tojás|hús|pulyka|tonhal|marha|hal/.test(n)) return { color: 'var(--coral)', icon: 'i-hus' }
  if (/joghurt|skyr|túró|tej|sajt/.test(n)) return { color: 'var(--lav)', icon: 'i-kiegeszito' }
  if (/zab|rizs|tortilla|bulgur|kenyér|tészta|burgonya/.test(n)) return { color: 'var(--amber)', icon: 'i-gabona' }
  if (/olaj|vaj|avok|mogyoró|mandula|mag/.test(n)) return { color: 'var(--sage)', icon: 'i-avokado' }
  if (/méz|cukor|szirup/.test(n)) return { color: 'var(--rose)', icon: 'i-termes' }
  if (/zöldség|gyümölcs|brokkoli|paprika|banán|erdei|saláta|spenót|áfonya/.test(n)) return { color: 'var(--sage)', icon: 'i-noveny' }
  return { color: 'var(--sky)', icon: 'i-tanyer' }
}

// ── Makrók ────────────────────────────────────────────────────────────────────────────────

/** Egy makró-gyűrű: a saját összetétel százaléka + a gramm. Honest-null: ismeretlen
 *  részesedésnél az ív üres marad és a szám „—", nem 0. */
function ShareRing({ label, grams, sharePct, color, icon, frame }: {
  label: string; grams: number | null; sharePct: number | null
  color: string; icon: ClayIconName; frame: string
}) {
  const counted = useFuelCountUp(sharePct ?? 0)
  return (
    <div className="fmx-cell">
      <span className="fmx-ico" aria-hidden="true"><ClayIcon name={icon} size={29} /></span>
      <div className={`fmx-ring is-share${sharePct == null ? ' is-empty' : ''}`}
        style={{ '--macro-color': color, '--ring-progress': String(sharePct ?? 0) } as React.CSSProperties}>
        <svg viewBox="0 0 80 80" aria-hidden="true">
          <circle className="fmx-ring-track" cx="40" cy="40" r="34" pathLength={100} />
          <circle className="fmx-ring-progress" cx="40" cy="40" r="34" pathLength={100} />
        </svg>
        <span aria-label={`${label}: ${sharePct == null ? 'nincs adat' : `${frame} ${sharePct}%-a`}, ${grams == null ? 'nincs adat' : `${huInt(grams)} g`}`}>
          <strong aria-hidden="true" className="fmx-share-pct">
            {sharePct == null ? '—' : `${Math.round(counted)}%`}
          </strong>
          <b aria-hidden="true">{grams == null ? '—' : `${huInt(grams)} g`}</b>
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
  origin?: { label: string; icon: ClayIconName }
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
              <div key={row.key} className="fmx-ing-row"
                style={{ '--ing-color': style.color } as React.CSSProperties}>
                <span className="fmx-ing-art" aria-hidden="true"><ClayIcon name={style.icon} size={29} /></span>
                <span className="fmx-ing-copy">
                  <strong>{row.name}</strong>
                  <span className="fmx-ing-meta">
                    {row.origin && (
                      <em><ClayIcon name={row.origin.icon} size={13} />{row.origin.label}</em>
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
export function qualityTiles(lines: FuelQualityLine[]): {
  label: string; value: number | null; unit: string; icon: ClayIconName; color: string
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
    { label: 'Alapanyag-arány', value: baseShare, unit: '%', icon: 'i-termes', color: 'var(--amber)' },
    { label: 'Energiasűrűség', value: density, unit: 'kcal/100 g', icon: 'i-lang', color: 'var(--coral)' },
    { label: 'Ultra-feldolgozott', value: ultra, unit: 'tétel', icon: 'i-retegek', color: ultra ? 'var(--coral)' : 'var(--sky)' },
  ]
}

/** Egy minőség-lapka: EGY nagy szám (vagy „—") a saját egységével, clay szimbólummal. */
export interface FuelNutriTile {
  label: string
  /** Már formázott érték, vagy `null` — a `null` „—"-t ad, sosem kitalált nullát. */
  value: string | null
  unit: string
  icon: ClayIconName
  color: string
}

/** A minőség-lapka rács — a prototípus `nutri-tiles`-a. Ezt a primitívet a recept/étkezés
 *  Minőség szekciója ÉS a kamra-tétel per-100 g lapkái is használják (egy markup, két hívó). */
export function FuelNutriTiles({ tiles }: { tiles: FuelNutriTile[] }) {
  return (
    <div className="fmx-nutri-tiles">
      {tiles.map(t => (
        <div key={t.label} className={`fmx-nutri-tile${t.value == null ? ' is-unknown' : ''}`}
          style={{ '--nt-color': t.color } as React.CSSProperties}>
          <span className="fmx-nt-top">
            <span className="fmx-nt-art" aria-hidden="true"><ClayIcon name={t.icon} size={34} /></span>
            <strong>{t.value == null ? '—' : t.value}{t.value != null && <small>{t.unit}</small>}</strong>
          </span>
          <span className="fmx-nt-label">{t.label}</span>
        </div>
      ))}
    </div>
  )
}

/** A Minőség szekció. A fejléc SZÁNDÉKOSAN nem visel darabszámot/feliratot (owner). */
export function FuelQualitySection({ lines }: { lines: FuelQualityLine[] }) {
  const tiles = qualityTiles(lines)
  return (
    <section className="fmx-detail-sec">
      <div className="fmx-section"><h2>Minőség</h2></div>
      <FuelNutriTiles tiles={tiles.map(t => ({ ...t, value: t.value == null ? null : hu1(t.value) }))} />
    </section>
  )
}

// ── Mikrotápanyagok ───────────────────────────────────────────────────────────────────────

type MicroStatus = 'good' | 'ok' | 'low'
const STATUS_LABEL: Record<MicroStatus, string> = { good: 'rendben', ok: 'oké', low: 'figyeld' }

/** A NÉGY tárolt tény egy étkezés-méretű kerethez mérve (prototípus `microCardsHtml`, :114).
 *  Más nem jön ide: vitamin/ásványi anyag a produkcióban nem létezik (mezo-vj61). */
function microRows(n: Nutrients): {
  label: string; value: number | null; allot: number; icon: ClayIconName; color: string;
  status: (v: number) => MicroStatus; kind: string
}[] {
  return [
    { label: 'Rost', value: n.fiberG, allot: 7, icon: 'i-noveny', color: 'var(--sage)', status: v => (v >= 6 ? 'good' : 'ok'), kind: 'cél' },
    { label: 'Cukor', value: n.sugarG, allot: 25, icon: 'i-termes', color: 'var(--rose)', status: v => (v <= 12 ? 'good' : v <= 22 ? 'ok' : 'low'), kind: 'keret' },
    { label: 'Só', value: n.saltG, allot: 1.7, icon: 'i-kristaly', color: 'var(--sky)', status: v => (v <= 1 ? 'good' : 'ok'), kind: 'keret' },
    { label: 'Telített zsír', value: n.saturatedFatG, allot: 7, icon: 'i-avokado', color: 'var(--amber)', status: v => (v <= 5 ? 'good' : v <= 9 ? 'ok' : 'low'), kind: 'keret' },
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
                <span className="fmx-mc-art" aria-hidden="true"><ClayIcon name={row.icon} size={29} /></span>
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
            <div key={row.label} className={`fmx-micro-card is-${status}`}
              style={{ '--mc-color': row.color } as React.CSSProperties}>
              <span className="fmx-mc-art" aria-hidden="true"><ClayIcon name={row.icon} size={29} /></span>
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

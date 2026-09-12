// ============================================================
// Mezo · FuelMealDetailPage — EGY logolt étkezés Titán részletező oldala
// (Fuel Titanium S1b, mezo-33k6; fagyasztott manifeszt A10 · A11).
//
// Jóváhagyott vizuális referencia: docs/design_2.0/prototypes/companion-titanium/
// fuel-dashboard.js `mealDetailPage` (:118) a `qualityTilesHtml` (:104),
// `microCardsHtml` (:114), `ingredientStyle` (:93) és `NOVA_COLOR`/`NOVA_SHORT`
// (:91/:179) darabjaival; CSS: fuel-pages.css `Shared sub-page head` (:107),
// `Meal detail page` (:113), `Meal detail — icon-rich, hue-coded` (:406) és
// `Meal detail v3 — split hero, share rings, micronutrient cards` (:453).
//
// Owner-döntések, amiket az anatómia hordoz:
//   • hero: BAL oldal a tál-ikon és ALATTA a kcal; JOBB oldal az idő-és-blokk sor a saját
//     ikonjával, alatta a nap x%-a; az AI értékelés jobbra FENT,
//   • a makró gyűrűk az ÉTKEZÉS saját összetételét mutatják (mealShare.ts) — nincs
//     „a nap céljához mérve" felirat,
//   • a Minőség alatt van Mikrotápanyagok szekció is, ikonokkal,
//   • sem a Hozzávalók, sem a Minőség fejléc nem visel darabszámot/feliratot,
//   • szerkesztés NINCS a sorokon — az a logolóban él (S1c).
//
// ŐSZINTE-NULL, ABSZOLÚT: a mikrotápanyag-rész KIZÁRÓLAG a négy tárolt tényt mutatja
// (rost, cukor, só, telített zsír — `Nutrients`, mezo-m6uv). Vitamin és ásványi anyag
// még nincs a rendszerben: az külön, még meg nem épített képesség (mezo-vj61, manifeszt
// F1 sor) — ezért itt nem találunk ki egyet sem, és a hiányzó érték „—", nem nulla.
// Ugyanez áll a minőség-lapkákra: amit a sorok nem árulnak el (NOVA-csoport, grammos
// tömeg), az „—" marad.
// ============================================================
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useFuelDay } from '@/data/hooks'
import { pct } from '@/shared/lib/pct'
import { hu1, huInt } from '@/shared/lib/huNum'
import { ClayIcon, type ClayIconName } from '@/shared/ui/clay'
import type { FuelMeal, MealItemLine, MealSlot, Nutrients } from '@/data/types'
import { hhmmFromLoggedAt, mealSlotKey } from '@/features/fuel/logic/buildDayPlan'
import { mealDisplayName } from '@/features/fuel/logic/mealDisplayName'
import { mealContextOf, MEAL_CONTEXT_LABEL } from '@/features/fuel/logic/mealContext'
import { mealMacroShare } from '@/features/fuel/logic/mealShare'
import { FuelScoreChip } from '@/features/fuel/components/FuelMealBlocks'
import { useFuelCountUp } from '@/features/fuel/components/FuelMacroRings'

/** Blokk-arc: hue + clay ikon + magyar név. A hue a ház tokenjeiből (lásd a prototype.css
 *  `fuel-mai titanium` blokk fejlécét: a beégetett prototípus-hexeket nem vesszük át). */
const BLOCK: Record<MealSlot, { color: string; icon: ClayIconName; label: string }> = {
  breakfast: { color: 'var(--amber)', icon: 'i-reggeli', label: 'Reggeli' },
  lunch: { color: 'var(--sage)', icon: 'i-ebed', label: 'Ebéd' },
  snack: { color: 'var(--lav)', icon: 'i-snack', label: 'Uzsonna' },
  dinner: { color: 'var(--sky)', icon: 'i-vacsora', label: 'Vacsora' },
}

/** NOVA-csoport rövid neve + hue (prototípus `NOVA_SHORT` :179 / `NOVA_COLOR` :91). */
const NOVA: Record<number, { short: string; color: string }> = {
  1: { short: 'Alapanyag', color: 'var(--sage)' },
  2: { short: 'Konyhai összetevő', color: 'var(--sky)' },
  3: { short: 'Feldolgozott', color: 'var(--amber)' },
  4: { short: 'Ultra-feldolgozott', color: 'var(--coral)' },
}

/** A sor eredete — a logolt `MealItemLine.source` háza szerinti arca. */
const SOURCE: Record<MealItemLine['source'], { label: string; icon: ClayIconName }> = {
  recipe: { label: 'recept', icon: 'i-recept' },
  pantry: { label: 'kamra', icon: 'i-kamra' },
  estimate: { label: 'becslés', icon: 'i-lombik' },
}

/**
 * Hozzávaló-hue + clay ikon élelmiszer-család szerint (prototípus `ingredientStyle`, :93),
 * a ház tokenjeire és a ház clay-készletére fordítva — új gradiens/ikon nem kellett hozzá.
 */
function ingredientStyle(name: string): { color: string; icon: ClayIconName } {
  const n = name.toLocaleLowerCase('hu-HU')
  if (/csirke|lazac|tojás|hús|pulyka|tonhal|marha|hal/.test(n)) return { color: 'var(--coral)', icon: 'i-hus' }
  if (/joghurt|skyr|túró|tej|sajt/.test(n)) return { color: 'var(--lav)', icon: 'i-kiegeszito' }
  if (/zab|rizs|tortilla|bulgur|kenyér|tészta|burgonya/.test(n)) return { color: 'var(--amber)', icon: 'i-gabona' }
  if (/olaj|vaj|avok|mogyoró|mandula|mag/.test(n)) return { color: 'var(--sage)', icon: 'i-avokado' }
  if (/méz|cukor|szirup/.test(n)) return { color: 'var(--rose)', icon: 'i-termes' }
  if (/zöldség|gyümölcs|brokkoli|paprika|banán|erdei|saláta|spenót|áfonya/.test(n)) return { color: 'var(--sage)', icon: 'i-noveny' }
  return { color: 'var(--sky)', icon: 'i-tanyer' }
}

/** A sor grammos tömege, ha grammban van megadva — különben null (nem találgatunk). */
function gramsOf(line: MealItemLine): number | null {
  return line.unit.trim().toLowerCase() === 'g' ? line.amount : null
}

/** Minőség-lapkák a prototípus `qualityTilesHtml` (:104) számai szerint, honest-nullal:
 *  amit a sorok nem árulnak el, az „—". A növényfélék száma SZÁNDÉKOSAN nincs itt: azt a
 *  produkció per-étkezés nem tárolja, és egy kitalált szám tiltott. */
function qualityTiles(lines: MealItemLine[]): { label: string; value: number | null; unit: string; icon: ClayIconName; color: string }[] {
  const lineKcal = lines.reduce((s, l) => s + l.contribution.kcal, 0)
  const hasNova = lines.length > 0 && lines.every(l => l.nova != null)
  const baseShare = hasNova && lineKcal > 0
    ? Math.round((lines.filter(l => l.nova === 1).reduce((s, l) => s + l.contribution.kcal, 0) / lineKcal) * 100)
    : null
  const grams = lines.map(gramsOf)
  const gramTotal = grams.every(g => g != null) ? (grams as number[]).reduce((s, g) => s + g, 0) : null
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

type MicroStatus = 'good' | 'ok' | 'low'
const STATUS_LABEL: Record<MicroStatus, string> = { good: 'rendben', ok: 'oké', low: 'figyeld' }

/** A NÉGY tárolt tény, étkezés-szintű keretéhez mérve (prototípus `microCardsHtml`, :114).
 *  Más nem jön ide: vitamin/ásványi anyag a produkcióban nem létezik (mezo-vj61). */
function microRows(meal: FuelMeal): {
  label: string; value: number | null; allot: number; icon: ClayIconName; color: string; status: (v: number) => MicroStatus; kind: string
}[] {
  const n: Nutrients | undefined = meal.nutrients
  return [
    { label: 'Rost', value: n?.fiberG ?? meal.fiberG ?? null, allot: 7, icon: 'i-noveny', color: 'var(--sage)', status: v => (v >= 6 ? 'good' : 'ok'), kind: 'cél' },
    { label: 'Cukor', value: n?.sugarG ?? null, allot: 25, icon: 'i-termes', color: 'var(--rose)', status: v => (v <= 12 ? 'good' : v <= 22 ? 'ok' : 'low'), kind: 'keret' },
    { label: 'Só', value: n?.saltG ?? null, allot: 1.7, icon: 'i-kristaly', color: 'var(--sky)', status: v => (v <= 1 ? 'good' : 'ok'), kind: 'keret' },
    { label: 'Telített zsír', value: n?.saturatedFatG ?? null, allot: 7, icon: 'i-avokado', color: 'var(--amber)', status: v => (v <= 5 ? 'good' : v <= 9 ? 'ok' : 'low'), kind: 'keret' },
  ]
}

function ShareRing({ label, grams, sharePct, color, icon }: {
  label: string; grams: number | null; sharePct: number | null; color: string; icon: ClayIconName
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
        <span aria-label={`${label}: ${sharePct == null ? 'nincs adat' : `az étkezés energiájának ${sharePct}%-a`}, ${grams == null ? 'nincs adat' : `${huInt(grams)} g`}`}>
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

export function FuelMealDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [search] = useSearchParams()
  const navigate = useNavigate()
  // A korábbi napok étkezései ugyanezen az oldalon nyílnak — a nap az URL-ben él (`?d=`),
  // a /fuel/log `?d=` szerződésének mintájára.
  const day = search.get('d')
  const { fuel } = useFuelDay(day ?? undefined)
  const meal = fuel.meals.find(m => m.id === id)

  if (!meal) {
    return (
      <div className="fmx-page">
        <div className="fmx-subhead">
          <button type="button" onClick={() => navigate('/fuel')} aria-label="Vissza a Mai oldalra">‹</button>
          <span><strong>Ez az étkezés nincs meg</strong></span>
        </div>
        <p className="fmx-block-empty">
          Lehet, hogy egy másik napon logoltad, vagy közben törölted. A Mai oldalon minden
          mai étkezésed ott van.
        </p>
      </div>
    )
  }

  const slotKey = mealSlotKey(meal)
  const block = slotKey ? BLOCK[slotKey] : { color: 'var(--sky)', icon: 'i-tanyer' as ClayIconName, label: 'Étkezés' }
  const time = hhmmFromLoggedAt(meal.loggedAt, '—')
  const ctx = mealContextOf(meal)
  const dayTarget = fuel.targets.kcal
  const dayShare = dayTarget > 0 ? Math.round(pct(meal.kcal, dayTarget)) : null
  const shares = mealMacroShare(meal)
  const lines = meal.mealItems
  const lineKcal = lines.reduce((s, l) => s + l.contribution.kcal, 0)
  const tiles = qualityTiles(lines)
  const micros = microRows(meal)
  const toScore = () => navigate(`/fuel/etkezes/${meal.id}/ertekeles${day ? `?d=${day}` : ''}`)

  return (
    <div className="fmx-page" style={{ '--block-color': block.color } as React.CSSProperties}>
      <div className="fmx-subhead">
        <button type="button" onClick={() => navigate('/fuel')} aria-label="Vissza a Mai oldalra">‹</button>
        <span>
          <small>{block.label.toLocaleUpperCase('hu-HU')}{ctx && ctx !== 'standard' ? ` · ${MEAL_CONTEXT_LABEL[ctx].toLocaleUpperCase('hu-HU')}` : ''}</small>
          <strong>{mealDisplayName(meal) ?? 'Étkezés'}</strong>
        </span>
      </div>

      {/* Split hero (v3): bal = ikon + kcal, jobb = idő-és-blokk + nap-részesedés, az AI jobbra fent. */}
      <div className="fmx-detail-hero">
        <span className="fmx-detail-glow" aria-hidden="true" />
        <div className="fmx-detail-left">
          <span className="fmx-detail-art" aria-hidden="true"><ClayIcon name={block.icon} size={96} /></span>
          <div className="fmx-detail-kcal">
            <strong>{huInt(meal.kcal)}</strong><small>kcal</small>
          </div>
        </div>
        <div className="fmx-detail-right">
          <div className="fmx-detail-when">
            <span className="fmx-di-art" aria-hidden="true"><ClayIcon name={block.icon} size={30} /></span>
            <span>
              <strong>{block.label}</strong>
              <small>{time === '—' ? 'az időpont nem ismert' : `${time}-kor logoltad`}</small>
            </span>
          </div>
          <div className="fmx-detail-share">
            <span className="fmx-di-art" aria-hidden="true"><ClayIcon name="i-cel" size={30} /></span>
            <span>
              <strong>{dayShare == null ? 'a napod — %-a' : `a napod ${dayShare}%-a`}</strong>
              <small>{dayTarget > 0 ? `a ${huInt(dayTarget)} kcal-os keretből` : 'a napi keret még nem ismert'}</small>
            </span>
          </div>
        </div>
        <div className="fmx-detail-score">
          <FuelScoreChip scorePct={meal.score == null ? null : Math.round(meal.score * 100)}
            onOpen={toScore} size="big" />
        </div>
      </div>

      <section className="fmx-detail-sec">
        <div className="fmx-section"><h2>Makrók</h2></div>
        {/* Az étkezés SAJÁT összetétele (owner) — nincs „a nap céljához mérve" felirat. */}
        <div className="fmx-detail-rings" role="group" aria-label="Az étkezés energiájának megoszlása">
          {shares.map(s => (
            <ShareRing key={s.key} label={s.label} grams={s.grams} sharePct={s.pct}
              color={s.key === 'p' ? 'var(--macro-protein)' : s.key === 'c' ? 'var(--macro-carbs)' : 'var(--macro-fat)'}
              icon={s.key === 'p' ? 'i-hus' : s.key === 'c' ? 'i-gabona' : 'i-avokado'} />
          ))}
        </div>
      </section>

      <section className="fmx-detail-sec">
        <div className="fmx-section"><h2>Hozzávalók</h2></div>
        {lines.length === 0 ? (
          <p className="fmx-block-empty">Ehhez az étkezéshez nincsenek részletezett sorok.</p>
        ) : (
          <div className="fmx-ing-list">
            {lines.map((line, i) => {
              const style = ingredientStyle(line.name)
              const share = lineKcal > 0 ? Math.round((line.contribution.kcal / lineKcal) * 100) : null
              const nova = line.nova != null ? NOVA[line.nova] : null
              return (
                <div key={`${line.refId}-${i}`} className="fmx-ing-row"
                  style={{ '--ing-color': style.color } as React.CSSProperties}>
                  <span className="fmx-ing-art" aria-hidden="true"><ClayIcon name={style.icon} size={29} /></span>
                  <span className="fmx-ing-copy">
                    <strong>{line.name}</strong>
                    <span className="fmx-ing-meta">
                      <em><ClayIcon name={SOURCE[line.source].icon} size={13} />{SOURCE[line.source].label}</em>
                      {nova && (
                        <em className="is-nova" style={{ '--nova': nova.color } as React.CSSProperties}>
                          <i aria-hidden="true" />{nova.short}
                        </em>
                      )}
                    </span>
                    {share != null && (
                      <i className="fmx-ing-bar" aria-hidden="true">
                        <b style={{ '--w': `${share}%` } as React.CSSProperties} />
                      </i>
                    )}
                  </span>
                  <span className="fmx-ing-end">
                    <b>{huInt(line.contribution.kcal)}<small>kcal</small></b>
                    <small>{hu1(line.amount)} {line.unit}</small>
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section className="fmx-detail-sec">
        <div className="fmx-section"><h2>Minőség</h2></div>
        <div className="fmx-nutri-tiles">
          {tiles.map(t => (
            <div key={t.label} className={`fmx-nutri-tile${t.value == null ? ' is-unknown' : ''}`}
              style={{ '--nt-color': t.color } as React.CSSProperties}>
              <span className="fmx-nt-top">
                <span className="fmx-nt-art" aria-hidden="true"><ClayIcon name={t.icon} size={34} /></span>
                <strong>{t.value == null ? '—' : hu1(t.value)}{t.value != null && <small>{t.unit}</small>}</strong>
              </span>
              <span className="fmx-nt-label">{t.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="fmx-detail-sec">
        <div className="fmx-section"><h2>Mikrotápanyagok</h2></div>
        <div className="fmx-micro-list">
          {micros.map(row => {
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
                  <small>az étkezés-{row.kind} {share}%-a</small>
                </span>
                <span className="fmx-mc-end"><b>{hu1(row.value)} g</b><em>{STATUS_LABEL[status]}</em></span>
              </div>
            )
          })}
        </div>
      </section>
      {/* Ismert hiány, nem figyelmetlenség: vitamin/ásványi anyag = mezo-vj61, manifeszt F1.
          A lábjegyzet SZÁNDÉKOSAN a szekción KÍVÜL áll: a szekció maga kizárólag a négy tárolt
          tényt tartalmazza, és a tesztje épp azt őrzi, hogy vitamin-szó ne kerüljön a tények
          közé. Ez a mondat a képesség hiányáról beszél, nem egy mikrotápanyagról. */}
      <p className="fmx-nutri-note">
        Ezt tároljuk ma. A vitaminok és ásványi anyagok még úton vannak.
      </p>
    </div>
  )
}

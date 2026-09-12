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
//   • szerkesztés NINCS a sorokon — az a logolóban él (S1c): a lap alján egy halk ajtó visz a
//     `/fuel/log/uj?edit=<id>` javításra (és `&d=`, ha az étkezés korábbi napra esik). A törlés
//     szándékosan ott, két lépésben lakik — egy részletező lapon egy koppintás nem törölhet.
//
// ŐSZINTE-NULL, ABSZOLÚT: a mikrotápanyag-rész KIZÁRÓLAG a négy tárolt tényt mutatja
// (rost, cukor, só, telített zsír — `Nutrients`, mezo-m6uv). Vitamin és ásványi anyag
// még nincs a rendszerben: az külön, még meg nem épített képesség (mezo-vj61, manifeszt
// F1 sor) — ezért itt nem találunk ki egyet sem, és a hiányzó érték „—", nem nulla.
// Ugyanez áll a minőség-lapkákra: amit a sorok nem árulnak el (NOVA-csoport, grammos
// tömeg), az „—" marad.
//
// S4 (mezo-hygp): a Hozzávalók / Minőség / Mikrotápanyagok szekciók átkerültek a megosztott
// `FuelQualityBlocks`-ba — az owner szerint egy recept megnyitása UGYANEZT a mélységet adja,
// és a Receptműhely előre ugyanezt mutatja. Egy példány, három hívó; a markup és a `fmx-`
// osztályok változatlanok, csak már nem itt laknak.
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
import {
  FuelIngredientSection, FuelMacroShareSection, FuelMicroNote, FuelMicroSection, FuelQualitySection,
  type FuelIngredientRowVM, type FuelQualityLine,
} from '@/features/fuel/components/FuelQualityBlocks'

/** Blokk-arc: hue + clay ikon + magyar név. A hue a ház tokenjeiből (lásd a prototype.css
 *  `fuel-mai titanium` blokk fejlécét: a beégetett prototípus-hexeket nem vesszük át). */
const BLOCK: Record<MealSlot, { color: string; icon: ClayIconName; label: string }> = {
  breakfast: { color: 'var(--amber)', icon: 'i-reggeli', label: 'Reggeli' },
  lunch: { color: 'var(--sage)', icon: 'i-ebed', label: 'Ebéd' },
  snack: { color: 'var(--lav)', icon: 'i-snack', label: 'Uzsonna' },
  dinner: { color: 'var(--sky)', icon: 'i-vacsora', label: 'Vacsora' },
}

/** A sor eredete — a logolt `MealItemLine.source` háza szerinti arca. */
const SOURCE: Record<MealItemLine['source'], { label: string; icon: ClayIconName }> = {
  recipe: { label: 'recept', icon: 'i-recept' },
  pantry: { label: 'kamra', icon: 'i-kamra' },
  estimate: { label: 'becslés', icon: 'i-lombik' },
}

/** A sor grammos tömege, ha grammban van megadva — különben null (nem találgatunk). */
function gramsOf(line: MealItemLine): number | null {
  return line.unit.trim().toLowerCase() === 'g' ? line.amount : null
}

/** A megosztott minőség-lapkák bemenete EGY logolt sorból. */
function qualityLineOf(line: MealItemLine): FuelQualityLine {
  return { grams: gramsOf(line), kcal: line.contribution.kcal, nova: line.nova ?? null }
}

/** Az étkezés NÉGY tárolt ténye — a rost a régi lapos `meal.fiberG`-ből is feloldható. */
function mealNutrients(meal: FuelMeal): Nutrients {
  const n: Nutrients | undefined = meal.nutrients
  return {
    fiberG: n?.fiberG ?? meal.fiberG ?? null,
    sugarG: n?.sugarG ?? null,
    saltG: n?.saltG ?? null,
    saturatedFatG: n?.saturatedFatG ?? null,
  }
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
  const ingredientRows: FuelIngredientRowVM[] = lines.map((line, i) => ({
    key: `${line.refId}-${i}`,
    name: line.name,
    kcal: line.contribution.kcal,
    share: lineKcal > 0 ? Math.round((line.contribution.kcal / lineKcal) * 100) : null,
    amount: `${hu1(line.amount)} ${line.unit}`,
    origin: SOURCE[line.source],
    nova: line.nova ?? null,
  }))
  const toScore = () => navigate(`/fuel/etkezes/${meal.id}/ertekeles${day ? `?d=${day}` : ''}`)
  // A8 (S1c, mezo-33k6): a javítás ajtaja. A `&d=` akkor is megy, ha az étkezés korábbi napra
  // esik — így a logoló ugyanannak a napnak az idő-szerződését tartja meg.
  const toEdit = () => navigate(`/fuel/log/uj?edit=${meal.id}${day ? `&d=${day}` : ''}`)

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

      {/* Az étkezés SAJÁT összetétele (owner) — nincs „a nap céljához mérve" felirat. */}
      <FuelMacroShareSection shares={shares}
        groupLabel="Az étkezés energiájának megoszlása" frame="az étkezés energiájának" />

      <FuelIngredientSection rows={ingredientRows}
        empty="Ehhez az étkezéshez nincsenek részletezett sorok." />

      <FuelQualitySection lines={lines.map(qualityLineOf)} />

      <FuelMicroSection nutrients={mealNutrients(meal)} frame="az étkezés" />
      {/* Ismert hiány, nem figyelmetlenség: vitamin/ásványi anyag = mezo-vj61, manifeszt F1.
          A lábjegyzet SZÁNDÉKOSAN a szekción KÍVÜL áll: a szekció maga kizárólag a négy tárolt
          tényt tartalmazza, és a tesztje épp azt őrzi, hogy vitamin-szó ne kerüljön a tények
          közé. Ez a mondat a képesség hiányáról beszél, nem egy mikrotápanyagról. */}
      {/* A8: a javítás ajtaja — halk, lap-szintű művelet (a sorokon továbbra sincs szerkesztés).
          A törlés a logolóban, két lépésben él, nem itt: egy részletező lapon egy koppintás
          nem törölhet napot. */}
      <button type="button" className="fmx-edit-door" onClick={toEdit}>
        Javítom ezt az étkezést
      </button>

      <FuelMicroNote />
    </div>
  )
}

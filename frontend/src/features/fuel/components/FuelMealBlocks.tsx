// ============================================================
// Mezo · FuelMealBlocks — a Fuel Mai nap-blokkjai (Fuel Titanium S1b, mezo-33k6;
// fagyasztott manifeszt A10 nap-étkezéslista · A11 per-étkezés AI értékelés ·
// A14 az étkezési ablak BELEOLVAD a blokkba).
//
// Jóváhagyott vizuális referencia: docs/design_2.0/prototypes/companion-titanium/
// fuel-dashboard.js `blocksSection` (:49) → `blockCard` (:40) → `windowBar` (:32) +
// `budgetRing` (:39), a fuel-pages.css `/* Meal blocks on Mai */` (:53),
// `/* Variant A — colored wash + block-level clay icon */` (:63) és
// `/* Budget ring (option 3) */` (:77) blokkjaival. Az owner EZT a kalibrációt
// választotta: Variant A mosás + a 3-as opció gyűrűje.
//
// Owner-döntések, amiket a markup hordoz:
//   • a blokkok a lista, és a naplózás a BLOKKBA történik (a generikus naplózás a lap alján,
//     FuelMaiPage),
//   • a logolt étkezés sora a nevét és az AI pontszámát viszi — kcal-t NEM (azt a blokk gyűrűje
//     mondja el egyszer), ikont sem, „ajánlott keret" számot sem,
//   • a sor IDEJE az ablak-csíkon él, nem külön szövegként,
//   • a pont-chip finoman animál, hogy koppinthatónak olvasódjon (a `reduce` ág kivezeti).
//
// Őszinte-null + szégyenmentesség: ismeretlen kcal „—", kihagyott ablak semleges hangon
// „még pótolható" — soha nem hiba- vagy szégyen-állapot.
// ============================================================
import { pct } from '@/shared/lib/pct'
import { huInt, hu1 } from '@/shared/lib/huNum'
import { toMin, toHHmm } from '@/data/fuel/fuelConfig'
import { ClayIcon } from '@/shared/ui/clay'
import type { MealSlot } from '@/data/types'
import type { WindowLaneVM, WindowTileVM } from '@/features/fuel/logic/fuelSwimlane'
import type { DoneMealRow } from '@/features/fuel/logic/keretHero'

/** Blokk-hue a ház tokenjeiből (a prototípus beégetett hexei helyett — a Mai a ház saját
 *  világos/sötét témájában él, lásd a prototype.css `fuel-mai titanium` blokk fejlécét). */
const BLOCK_COLOR: Record<MealSlot, string> = {
  breakfast: 'var(--amber)',
  lunch: 'var(--sage)',
  snack: 'var(--lav)',
  dinner: 'var(--sky)',
}

/** Az ablak-csík fél szélessége: a prototípus 5 órás boxa (`windowBar`, :32). */
const BOX_HALF_MIN = 150
/** A csíkon kiemelt sáv fél szélessége — a TERVEZETT idő rajzolási toleranciája. */
const BAND_HALF_MIN = 30

/**
 * Az ablak-csík. A produkciós adat EGY időpontot tart számon ablakonként (`FuelSlot.time`:
 * nyitott ablaknál a tervezett, lezárt ablaknál a logolás ideje — buildDayPlan.ts 3. lépés),
 * ezért a csík ANKER-alapú: az 5 órás box a blokk saját idejére van centrálva, a kiemelt sáv
 * maga a tervezett idő. A prototípus „optimális 07:00–09:00" sávját NEM vesszük át: olyan
 * tényt állítana, amit a rendszer nem tárol.
 */
function WindowBar({ tile, rows }: { tile: WindowTileVM; rows: DoneMealRow[] }) {
  const anchor = toMin(tile.time)
  const from = anchor - BOX_HALF_MIN
  const to = anchor + BOX_HALF_MIN
  const at = (hhmm: string) => Math.min(98, Math.max(2, ((toMin(hhmm) - from) / (to - from)) * 100))
  const label = rows.length
    ? `${tile.label}-ablak ${tile.time} körül · ${rows.map(r => `${r.time}-kor ettél`).join(', ')}`
    : `${tile.label}-ablak ${tile.time} körül`

  return (
    <div className="fmx-window" role="img" aria-label={label}>
      <span>{toHHmm(from)}</span>
      <i>
        <em style={{
          '--from': `${at(toHHmm(anchor - BAND_HALF_MIN))}%`,
          '--to': `${at(toHHmm(anchor + BAND_HALF_MIN))}%`,
        } as React.CSSProperties} />
        {rows.map(r => (
          <b key={r.mealId} className="fmx-window-at" style={{ '--at': `${at(r.time)}%` } as React.CSSProperties} />
        ))}
      </i>
      <span>{toHHmm(to)}</span>
    </div>
  )
}

/**
 * A blokk gyűrűje (prototípus `budgetRing`, :39) — a blokk EGYETLEN kcal-száma.
 * A számjegy a logolt kcal, amíg nincs logolva, a blokk tervezett kerete; az ív a nap
 * energia-keretéből vett részt rajzolja (ugyanaz a „day-basis" olvasat, amit a
 * fuelSwimlane.ts gyűrűi is használnak). Ismeretlen kcal → „—", nincs ív.
 */
function BudgetRing({ kcal, dayKcal, logged }: { kcal: number | null; dayKcal: number; logged: boolean }) {
  const share = kcal == null || dayKcal <= 0 ? null : pct(kcal, dayKcal)
  const aria = kcal == null
    ? `${logged ? 'Logolt' : 'Tervezett'} energia: nincs adat`
    : `${logged ? 'Logolva' : 'Keret'}: ${huInt(kcal)} kcal${share == null ? '' : ` · a napi keret ${Math.round(share)}%-a`}`
  return (
    <span className={`fmx-budget-ring${logged ? '' : ' is-empty'}`} role="img" aria-label={aria}>
      <svg viewBox="0 0 44 44" aria-hidden="true">
        <circle className="fmx-br-track" cx="22" cy="22" r="18" pathLength={100} />
        <circle className="fmx-br-fill" cx="22" cy="22" r="18" pathLength={100}
          style={{ '--p': String(share ?? 0) } as React.CSSProperties} />
      </svg>
      <b>{kcal == null ? '—' : huInt(kcal)}</b>
    </span>
  )
}

/** A pont-chip: az értékelés kapuja. Pontszám nélküli (friss) logra „folyamatban" — passzív. */
export function FuelScoreChip({ scorePct, onOpen, size }: {
  scorePct: number | null
  onOpen?: () => void
  size?: 'big'
}) {
  const cls = `fmx-score${size === 'big' ? ' is-big' : ''}`
  if (scorePct == null) {
    return (
      <span className={`${cls} is-pending`}>
        <ClayIcon name="i-kristaly" size={size === 'big' ? 34 : 28} />
        <b>folyamatban</b>
      </span>
    )
  }
  const value = hu1(scorePct / 10)
  return (
    <button type="button" className={cls} onClick={onOpen} aria-label={`AI értékelés: ${value}`}>
      <ClayIcon name="i-kristaly" size={size === 'big' ? 34 : 28} />
      <b>{value}</b>
    </button>
  )
}

function BlockCard({ tile, rows, dayKcal, onLogInto, onOpenMeal }: {
  tile: WindowTileVM
  rows: DoneMealRow[]
  dayKcal: number
  onLogInto: (tile: WindowTileVM) => void
  onOpenMeal: (mealId: string) => void
}) {
  const loggedKcal = rows.length
    ? rows.reduce<number | null>((sum, r) => (sum == null || r.kcal == null ? null : sum + r.kcal), 0)
    : null

  return (
    <section className={`fmx-block is-${tile.state}`} aria-label={tile.label}
      style={{ '--block-color': BLOCK_COLOR[tile.slotKey] } as React.CSSProperties}>
      <div className="fmx-block-head">
        <span className="fmx-block-art" aria-hidden="true"><ClayIcon name={tile.icon} size={38} /></span>
        <strong className="fmx-block-name">{tile.label}</strong>
        <BudgetRing kcal={rows.length ? loggedKcal : tile.kcal} dayKcal={dayKcal} logged={rows.length > 0} />
      </div>
      <WindowBar tile={tile} rows={rows} />
      {rows.map(r => (
        <div key={r.mealId} className="fmx-meal-row">
          <button type="button" className="fmx-meal-main" onClick={() => onOpenMeal(r.mealId)}>
            <span className="fmx-meal-copy">
              <strong>{r.name || 'Étkezés'}</strong>
              {/* Provenancia-nyom, nem második kcal: ennyi fehérjét vitt a tányér. */}
              <small>{r.proteinG == null ? 'részletek' : `${huInt(r.proteinG)} g fehérje`}</small>
            </span>
          </button>
          <FuelScoreChip scorePct={r.scorePct} onOpen={() => onOpenMeal(r.mealId)} />
        </div>
      ))}
      {rows.length === 0 && (
        <button type="button" className="fmx-block-log" onClick={() => onLogInto(tile)}
          aria-label={`${tile.label} · logolás ide`}>
          <span aria-hidden="true">＋</span>
          <span>
            <strong>Logolás ide</strong>
            {/* Szégyenmentes: a kimaradt ablak „még pótolható", nem hiba. */}
            <small>{tile.state === 'missed' ? 'még pótolható' : tile.state === 'now' ? 'most nyitva' : `${tile.time} körül`}</small>
          </span>
        </button>
      )}
    </section>
  )
}

export function FuelMealBlocks({ lane, meals, dayKcal, onLogInto, onOpenMeal }: {
  lane: WindowLaneVM
  meals: DoneMealRow[]
  /** A nap energia-kerete — a blokkgyűrű ívének nevezője (honest: ha 0, nincs ív). */
  dayKcal: number
  onLogInto: (tile: WindowTileVM) => void
  onOpenMeal: (mealId: string) => void
}) {
  if (lane.tiles.length === 0) {
    return (
      <div className="fmx-blocks">
        <p className="fmx-block-empty">Ma még nincs tervezett étkezési ablak — logolj bármit, bármikor.</p>
      </div>
    )
  }
  return (
    <div className="fmx-blocks">
      {lane.tiles.map(tile => (
        <BlockCard key={tile.key} tile={tile} dayKcal={dayKcal}
          rows={meals.filter(m => m.mealId === tile.mealId)}
          onLogInto={onLogInto} onOpenMeal={onOpenMeal} />
      ))}
    </div>
  )
}

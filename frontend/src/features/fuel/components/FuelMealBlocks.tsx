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
// választotta: Variant A mosás + a 3-as opció gyűrűje. Az étkezés-sor a v2 kalibrációt követi:
// docs/design_2.0/prototypes/fuel-kartya-ido.html (v2, mezo-l2gp0).
//
// Owner-döntések, amiket a markup hordoz:
//   • a blokkok a lista, és a naplózás a BLOKKBA történik (a generikus naplózás a lap alján,
//     FuelMaiPage),
//   • a logolt étkezés sora a NEVÉT teljes szélességben viszi, alatta a négy makró/rost
//     mini-gyűrűvel és az AI pontszámmal egy sorban — kcal-t NEM (azt a blokk gyűrűje mondja
//     el egyszer), „ajánlott keret" számot sem. A gyűrűk ikonjai mezo-n9peo-val jöttek: az
//     owner színes, ikonos grammokat kért felirat nélkül; a v2 kalibráció (mezo-l2gp0,
//     docs/design_2.0/prototypes/fuel-kartya-ido.html) ezt arány-gyűrűkké alakította,
//   • az idő az étkezési órán él (mezo-6g52f, Task 7): a blokk mindig kint tartja a napóra-gyűrűs
//     órát (`MealClock`), ami az óra-dobozt (`MealClockBox`) nyitja szövegesen — a kártyán nincs
//     idő-szöveg, a naplózás előtti blokk csak az "Ajánlott" sort viszi,
//   • a pont-chip finoman animál, hogy koppinthatónak olvasódjon (a `reduce` ág kivezeti).
//
// Őszinte-null + szégyenmentesség: ismeretlen kcal „—", kihagyott ablak semleges hangon
// „még pótolható" — soha nem hiba- vagy szégyen-állapot.
// ============================================================
import { useState } from 'react'
import { huInt, hu1 } from '@/shared/lib/huNum'
import { toMin } from '@/data/fuel/fuelConfig'
import { ContentIcon } from '@/shared/ui/clay'
import { glycemicBand, type GlycemicLevel } from '@/features/fuel/logic/glycemicBand'
import { GlycemicGlassFor, GlycemicMiniCurve } from '@/features/fuel/components/GlycemicGlass'
import { macroEnergyShares, fiberSharePct } from '@/features/fuel/logic/mealShare'
import { durHu } from '@/features/fuel/logic/mealWindow'
import { MealClock, MealClockBox, type ClockDay } from '@/features/fuel/components/MealClockBox'
import type { MealSlot } from '@/data/types'
import type { WindowLaneVM, WindowTileVM } from '@/features/fuel/logic/fuelSwimlane'
import type { DoneMealRow } from '@/features/fuel/logic/keretHero'

/**
 * A sor makró-gyűrűi (mezo-l2gp0, a v2 prototípus kalibrációja): NÉGY cella — P/Ch/Zs a
 * saját energia-arányával (mealShare.ts), a rost a napi adag részesedésével. Az azonosság
 * marad hue + clay ikon, felirat nélkül (mezo-n9peo); a gyűrűben a GRAMM a szám. Őszinte-null:
 * hiányzó gramm „—" és nincs ív; csonka összetételen egyik makró-ív sem rajzolódik.
 */
const MACRO_RINGS = [
  { key: 'proteinG' as const, share: 'p' as const, word: 'fehérje', color: 'var(--macro-protein)', icon: 'i-hus' as const },
  { key: 'carbsG' as const, share: 'c' as const, word: 'szénhidrát', color: 'var(--macro-carbs)', icon: 'i-gabona' as const },
  { key: 'fatG' as const, share: 'f' as const, word: 'zsír', color: 'var(--macro-fat)', icon: 'i-avokado' as const },
]

function RingCell({ color, icon, grams, sharePct }: {
  color: string; icon: 'i-hus' | 'i-gabona' | 'i-avokado' | 'i-noveny'
  grams: number | null; sharePct: number | null
}) {
  return (
    <span className="fmx-mcell" style={{ '--macro-color': color } as React.CSSProperties}>
      <ContentIcon name={icon} size={15} />
      <span className={`fmx-mring${grams == null ? ' is-null' : ''}`}>
        <svg viewBox="0 0 40 40" aria-hidden="true">
          <circle className="tr" cx="20" cy="20" r="16" pathLength={100} />
          {grams != null && sharePct != null && (
            <circle className="fl" cx="20" cy="20" r="16" pathLength={100}
              style={{ '--p': String(sharePct) } as React.CSSProperties} />
          )}
        </svg>
        <b>{grams == null ? '—' : <>{huInt(grams)}<i>g</i></>}</b>
      </span>
    </span>
  )
}

function MacroRings({ row, fiberTargetG }: { row: DoneMealRow; fiberTargetG: number }) {
  const shares = macroEnergyShares(row)
  const fiberPct = fiberSharePct(row.fiberG, fiberTargetG)
  const label = [
    ...MACRO_RINGS.map(m => {
      const g = row[m.key]
      if (g == null) return `${m.word} nincs adat`
      const s = shares[m.share]
      return s == null ? `${m.word} ${huInt(g)} g` : `${m.word} ${huInt(g)} g, az étkezés energiájának ${s}%-a`
    }),
    row.fiberG == null
      ? 'rost nincs adat'
      : fiberPct == null ? `rost ${huInt(row.fiberG)} g` : `rost ${huInt(row.fiberG)} g, a napi adag ${fiberPct}%-a`,
  ].join('; ')
  return (
    <span className="fmx-mrings" role="img" aria-label={label}>
      {MACRO_RINGS.map(m => (
        <RingCell key={m.key} color={m.color} icon={m.icon} grams={row[m.key]} sharePct={shares[m.share]} />
      ))}
      <RingCell color="var(--macro-fiber)" icon="i-noveny" grams={row.fiberG} sharePct={fiberPct} />
    </span>
  )
}

/** Blokk-hue a ház tokenjeiből (a prototípus beégetett hexei helyett — a Mai a ház saját
 *  világos/sötét témájában él, lásd a prototype.css `fuel-mai` blokk fejlécét). */
const BLOCK_COLOR: Record<MealSlot, string> = {
  breakfast: 'var(--amber)',
  lunch: 'var(--sage)',
  snack: 'var(--lav)',
  dinner: 'var(--sky)',
}

/**
 * A blokk gyűrűje (mezo-6g52f, owner 2026-09-26): az ÉTKEZÉS SAJÁT keretéhez mér — teli kör =
 * eltaláltad, ami túlfut, egy borostyán második kör (legfeljebb egy extra kör). Logolás előtt a
 * pálya szaggatott, a számjegy a tervezett keret. Ismeretlen kcal/keret → „—" / nincs ív.
 */
function BudgetRing({ kcal, budgetKcal, logged }: { kcal: number | null; budgetKcal: number | null; logged: boolean }) {
  const ratio = logged && kcal != null && budgetKcal ? (kcal / budgetKcal) * 100 : null
  const fill = ratio == null ? 0 : Math.min(100, ratio)
  const over = ratio == null ? 0 : Math.min(100, Math.max(0, ratio - 100))
  const shown = logged ? kcal : budgetKcal
  const aria = shown == null
    ? `${logged ? 'Logolt' : 'Tervezett'} energia: nincs adat`
    : logged
      ? `Logolva: ${huInt(kcal!)}${budgetKcal ? ` / ${huInt(budgetKcal)} kcal (${Math.round(ratio!)}%)` : ' kcal'}`
      : `Keret: ${huInt(shown)} kcal`
  return (
    <span className={`fmx-budget-ring${logged ? '' : ' is-empty'}`} role="img" aria-label={aria}>
      <svg viewBox="0 0 44 44" aria-hidden="true">
        <circle className="fmx-br-track" cx="22" cy="22" r="18" pathLength={100} />
        <circle className="fmx-br-fill" cx="22" cy="22" r="18" pathLength={100} style={{ '--p': String(fill) } as React.CSSProperties} />
        {over > 3 && <circle className="fmx-br-over" cx="22" cy="22" r="18" pathLength={100} style={{ '--p': String(over) } as React.CSSProperties} />}
      </svg>
      <b>{shown == null ? '—' : huInt(shown)}</b>
    </span>
  )
}

/** A pont-chip: az értékelés kapuja. Pontszám nélküli (friss) logra „folyamatban" — passzív.
 *  `unboxed` (mezo-6g52f): a blokk-kártyán a chip keret és háttér nélkül, kristály-ikonnal
 *  úszik a sorban, együtt lüktetve a csoport többi ilyen chipjével (`--i` staggerrel) — a
 *  `size="big"` hívók (a részletek/recept fejléce) változatlanok maradnak. */
export function FuelScoreChip({ scorePct, onOpen, size, unboxed, index }: {
  scorePct: number | null
  onOpen?: () => void
  size?: 'big'
  unboxed?: boolean
  index?: number
}) {
  const cls = `fmx-score${size === 'big' ? ' is-big' : ''}${unboxed ? ' is-unboxed' : ''}`
  const iconSize = unboxed ? 40 : size === 'big' ? 34 : 28
  if (scorePct == null) {
    return (
      <span className={`${cls} is-pending`}>
        {/* Üveg (mezo-me75u.1): the sparkle = „értékelés folyamatban" (uveg-alap-ikonok.html). */}
        <ContentIcon name="t-other" size={iconSize} />
        <b>folyamatban</b>
      </span>
    )
  }
  const value = hu1(scorePct / 10)
  return (
    <button type="button" className={cls} onClick={onOpen} aria-label={`AI értékelés: ${value}`}
      style={{ '--i': index ?? 0 } as React.CSSProperties}>
      <ContentIcon name="i-kristaly" size={iconSize} />
      <b>{value}</b>
    </button>
  )
}

/** A sáv szava a chipen — az owner „csak sáv" döntése (mezo-6g52f): szám soha. */
const BAND_WORD: Record<GlycemicLevel, string> = { low: 'Alacsony', mid: 'Közepes', high: 'Magas' }

/** A sor sávja a tárolt tényekből — UGYANAZ a deriváció, amit a részletek oldal doboza kap. */
function bandOf(row: DoneMealRow) {
  return glycemicBand({ c: row.carbsG, sugarG: row.sugarG, fiberG: row.fiberG, p: row.proteinG, f: row.fatG })
}

/** A Mai sor vércukor-chipje: a mini görbe a sáv színében + a sáv szava, a pontszám-chip
 *  bal oldalán. */
function GlycemicChip({ row, onOpen }: { row: DoneMealRow; onOpen: () => void }) {
  const band = bandOf(row)
  // Őszinte-null: szénhidrát-adat nélkül nincs sáv, és nincs chip sem — üres helyet hagyunk,
  // nem kitalált jelzést.
  if (!band) return null
  return (
    <button type="button" className={`fmx-glu-chip lvl-${band.level}`} onClick={onOpen}
      aria-label={`Vércukor-válasz: ${band.label}`}>
      <GlycemicMiniCurve level={band.level} />
      <b className="fmx-glu-word">{BAND_WORD[band.level]}</b>
    </button>
  )
}

/** Az „Ajánlott …" sor chipje (owner 2026-09-26: marad). Szégyenmentes: a lezárt ablak nem hiba.
 *  Null `now` (mezo-6g52f R4, múltbéli nap): nincs „most" jel — mindig „még pótolható". */
function whenChip(from: string, to: string, now: string | null): string {
  if (now == null) return 'még pótolható'
  const n = toMin(now), lo = toMin(from), hi = toMin(to)
  if (n < lo) return lo - n <= 90 ? `nyílik ${durHu(lo - n)} múlva` : `nyílik ${from}`
  if (n <= hi) return `most nyitva · még ${durHu(hi - n)}`
  return 'még pótolható'
}

/** A „Logolás ide" gomb ALSÓ sora (mezo-6g52f R1). Az ablakhoz kötött, semleges hangú
 *  helyzet-mondat: a tile.state (`most nyitva`) a NAP ELSŐ lognélküli ablakára igaz, nem
 *  arra, hogy EZ az ablak most van-e nyitva — ezért ablak esetén a saját window-ból és a
 *  `nowHHmm`-ból számoljuk, nem a tile.state-ből. Null `now` (múltbéli nap) → mindig
 *  „még pótolható" (nincs „most"). Ablak nélkül a régi tile.state-alapú szöveg marad. */
function logButtonLabel(tile: WindowTileVM, nowHHmm: string | null): string {
  if (tile.windowFrom && tile.windowTo) {
    if (tile.state === 'missed') return 'még pótolható'
    if (nowHHmm == null) return 'még pótolható'
    const n = toMin(nowHHmm), lo = toMin(tile.windowFrom), hi = toMin(tile.windowTo)
    if (n < lo) return 'még ráér'
    if (n <= hi) return 'most van itt az ideje'
    return 'még pótolható'
  }
  return tile.state === 'missed' ? 'még pótolható' : tile.state === 'now' ? 'most nyitva' : `${tile.time} körül`
}

function BlockCard({ tile, rows, nowHHmm, fiberTargetG, index, onLogInto, onOpenMeal, onOpenScore, onOpenClock, onOpenGlycemic }: {
  tile: WindowTileVM
  rows: DoneMealRow[]
  /** A jelen idő — az „Ajánlott" sor chipjéhez és az óra „most nyitva" jelöléséhez. Null a
   *  múltbéli napokon (mezo-6g52f R4) — nincs „most" jel. */
  nowHHmm: string | null
  /** A rost-gyűrű nevezője (mezo-l2gp0) — `dietSettings.fiberG`, threaded down to `MacroRings`. */
  fiberTargetG: number
  /** A blokk sorszáma a listában — a pont-chip lüktetés-staggerének (`--i`) nevezője. */
  index: number
  onLogInto: (tile: WindowTileVM) => void
  onOpenMeal: (mealId: string) => void
  /** A pont-chip SAJÁT célja: az AI értékelés, nem az étkezés részletei (mezo-jb84). */
  onOpenScore: (mealId: string) => void
  /** Az óra célja (mezo-6g52f): az óra-doboz nyitása erre a blokkra. */
  onOpenClock: (tileKey: string) => void
  /** A vércukor-chip célja (mezo-ya2wp): a `GlycemicGlass` nyitása ugyanarra az étkezésre. */
  onOpenGlycemic: (mealId: string) => void
}) {
  const loggedKcal = rows.length
    ? rows.reduce<number | null>((sum, r) => (sum == null || r.kcal == null ? null : sum + r.kcal), 0)
    : null

  return (
    // Üveg (mezo-me75u.1, §3.4): a logged block is glass in its slot hue; an empty one is the
    // dashed free state (`is-open`), no glass.
    <section className={`fmx-block is-${tile.state} ${rows.length > 0 ? 'glass' : 'is-open'}`} aria-label={tile.label}
      style={{ '--block-color': BLOCK_COLOR[tile.slotKey] } as React.CSSProperties}>
      <div className="fmx-block-head">
        <span className="fmx-block-art" aria-hidden="true"><ContentIcon name={tile.icon} size={38} /></span>
        <strong className="fmx-block-name">{tile.label}</strong>
        {/* A két kör EGY csoport a jobb szélen (owner 2026-09-16): az óra korábban a név után
            állt, így rövid néven — „Tízórai" — gazdátlanul lebegett a sor közepén. */}
        <span className="fmx-block-end">
          <MealClock tile={tile} row={rows[0] ?? null} nowHHmm={nowHHmm} onOpen={() => onOpenClock(tile.key)} />
          {/* mezo-6g52f minor d: `?? tile.kcal` is NOT dead — buildDayPlan sets windowFrom/windowTo
              and budgetKcal together (same `windowOf(i)` spread), so budgetKcal is always non-null
              on a windowed tile, but a tile with NO window (windowFrom/windowTo null) still renders
              this ring and has budgetKcal null; tile.kcal is its only kcal source then. */}
          <BudgetRing kcal={rows.length ? loggedKcal : tile.budgetKcal ?? tile.kcal} budgetKcal={tile.budgetKcal} logged={rows.length > 0} />
        </span>
      </div>
      {rows.length === 0 && tile.windowFrom && tile.windowTo && (
        <div className="fmx-when">Ajánlott <b>{tile.windowFrom}–{tile.windowTo}</b>
          <span className={`fmx-when-chip${nowHHmm != null && toMin(nowHHmm) >= toMin(tile.windowFrom) && toMin(nowHHmm) <= toMin(tile.windowTo) ? ' is-now' : ''}`}>
            {whenChip(tile.windowFrom, tile.windowTo, nowHHmm)}
          </span></div>
      )}
      {rows.map(r => (
        <div key={r.mealId} className="fmx-meal-row">
          {/* A név teljes szélességben (két sorig törhet) — a pont-chip az ALSÓ sorba került
              a gyűrűk mellé (mezo-l2gp0): korábban a név mellett szorongott, üres jobb oldallal. */}
          <button type="button" className="fmx-meal-main" onClick={() => onOpenMeal(r.mealId)}>
            <strong>{r.name || 'Étkezés'}</strong>
          </button>
          <div className="fmx-meal-bottom">
            <MacroRings row={r} fiberTargetG={fiberTargetG} />
            {/* A vércukor-chip a pontszámtól BALRA (a jóváhagyott prototípus rendje,
                fuel-dashboard.js `glucoseChip`): a mini görbe maga az ikon, a sáv színében.
                Sáv nélküli sor (nincs szénhidrát-adat) semmit nem mutat — nem találgatunk. */}
            {/* Üveg (mezo-me75u.1): the two chips are one group, so at 320px they wrap TOGETHER
                under the rings (right-aligned) instead of splitting across two lines. */}
            <span className="fmx-meal-chips">
              <GlycemicChip row={r} onOpen={() => onOpenGlycemic(r.mealId)} />
              {/* A chip célja változatlan: az ÉRTÉKELÉS (mezo-jb84). Unboxed (mezo-6g52f):
                  keret és háttér nélkül, saját lüktetéssel a blokk-index szerint. */}
              <FuelScoreChip scorePct={r.scorePct} onOpen={() => onOpenScore(r.mealId)} unboxed index={index} />
            </span>
          </div>
        </div>
      ))}
      {rows.length === 0 && (
        <button type="button" className="fmx-block-log" onClick={() => onLogInto(tile)}
          aria-label={`${tile.label} · logolás ide`}>
          <span aria-hidden="true">＋</span>
          <span>
            <strong>Logolás ide</strong>
            {/* Szégyenmentes: a kimaradt ablak „még pótolható", nem hiba (mezo-6g52f R1: a saját
                ablakból számolva, nem a tile.state „most" jelöléséből, ami a nap ELSŐ lognélküli
                ablakára igaz akkor is, ha az később nyílik). */}
            <small>{logButtonLabel(tile, nowHHmm)}</small>
          </span>
        </button>
      )}
    </section>
  )
}

export function FuelMealBlocks({ lane, meals, day, fiberTargetG, onLogInto, onOpenMeal, onOpenScore }: {
  lane: WindowLaneVM
  meals: DoneMealRow[]
  /** A napóra napi kerete (mezo-6g52f) — az ablakok és az étkezésszám a lane-ből származik.
   *  `nowHHmm` null a múltbéli napokon (R4) — nincs „most" jel sehol az órán. */
  day: { wake: string; bed: string; nowHHmm: string | null; training: { start: string; end: string; label: string } | null }
  /** A rost-gyűrű nevezője (mezo-l2gp0) — `dietSettings.fiberG`, threaded down to `MacroRings`. */
  fiberTargetG: number
  onLogInto: (tile: WindowTileVM) => void
  onOpenMeal: (mealId: string) => void
  onOpenScore: (mealId: string) => void
}) {
  const [clockFor, setClockFor] = useState<string | null>(null)
  const [glucoseFor, setGlucoseFor] = useState<string | null>(null)
  const glucoseRow = meals.find(m => m.mealId === glucoseFor) ?? null
  const glucoseBand = glucoseRow ? bandOf(glucoseRow) : null
  const clockTile = lane.tiles.find(t => t.key === clockFor) ?? null
  // mezo-6g52f minor a: mealCount csak a VALÓDI ablakos tileokat számolja (ugyanaz a halmaz, mint
  // a `windows` lent) — a felesleges extra logok (`lane.tiles.length` régen ezeket is számolta)
  // nem torzíthatják a „hányadik étkezés az M-ből" számot.
  const windowedTiles = lane.tiles.filter(t => t.windowFrom && t.windowTo)
  const clockDay: ClockDay = {
    ...day,
    windows: windowedTiles.map(t => ({ key: t.key, from: t.windowFrom!, to: t.windowTo! })),
    mealCount: windowedTiles.length,
  }
  if (lane.tiles.length === 0) {
    return (
      <div className="fmx-blocks">
        <p className="fmx-block-empty">Ma még nincs tervezett étkezési ablak — logolj bármit, bármikor.</p>
      </div>
    )
  }
  return (
    <div className="fmx-blocks">
      {lane.tiles.map((tile, index) => (
        <BlockCard key={tile.key} tile={tile} nowHHmm={day.nowHHmm} fiberTargetG={fiberTargetG} index={index}
          rows={meals.filter(m => m.mealId === tile.mealId)}
          onLogInto={onLogInto} onOpenMeal={onOpenMeal} onOpenScore={onOpenScore} onOpenClock={setClockFor}
          onOpenGlycemic={setGlucoseFor} />
      ))}
      {clockTile && (
        <MealClockBox tile={clockTile} row={meals.find(m => m.mealId === clockTile.mealId) ?? null}
          day={clockDay} next={lane.tiles[lane.tiles.indexOf(clockTile) + 1] ?? null}
          blockColor={BLOCK_COLOR[clockTile.slotKey]} onClose={() => setClockFor(null)} />
      )}
      {/* Ugyanaz a doboz, amit a részletek oldal negyedik kártyája nyit — egy komponens,
          egy deriváció, két ajtó. */}
      {glucoseBand && glucoseRow && (
        <GlycemicGlassFor mealId={glucoseRow.mealId} band={glucoseBand} onClose={() => setGlucoseFor(null)} />
      )}
    </div>
  )
}

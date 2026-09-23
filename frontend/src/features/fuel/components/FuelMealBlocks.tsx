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
//   • az idő az ablak-csíkon él ÉS az óra-dobozból kérhető le szövegesen (Task 5) — a kártyán
//     továbbra sincs idő-szöveg,
//   • a pont-chip finoman animál, hogy koppinthatónak olvasódjon (a `reduce` ág kivezeti).
//
// Őszinte-null + szégyenmentesség: ismeretlen kcal „—", kihagyott ablak semleges hangon
// „még pótolható" — soha nem hiba- vagy szégyen-állapot.
// ============================================================
import { useState } from 'react'
import { pct } from '@/shared/lib/pct'
import { huInt, hu1 } from '@/shared/lib/huNum'
import { toMin, toHHmm } from '@/data/fuel/fuelConfig'
import { ContentIcon } from '@/shared/ui/clay'
import { glycemicBand } from '@/features/fuel/logic/glycemicBand'
import { GlycemicGlass, GlycemicMiniCurve } from '@/features/fuel/components/GlycemicGlass'
import { macroEnergyShares, fiberSharePct } from '@/features/fuel/logic/mealShare'
import { GlassBox } from '@/features/fuel/components/GlassBox'
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

/**
 * Az óra-doboz (mezo-l2gp0): kis üvegdoboz a logolás idejével — a kártyán az idő az
 * ablak-csíkon ÉL, szövegesen innen kérhető le. View-only (owner-döntés); a "Terv szerint"
 * sor csak akkor áll, ha a done slot hozott tervezett időt (őszinte-null).
 */
function TimeBox({ label, blockColor, row, onClose }: {
  label: string; blockColor: string; row: DoneMealRow; onClose: () => void
}) {
  return (
    <GlassBox onClose={onClose} labelledBy="fmx-timebox-title" className="fmx-timebox"
      style={{ '--block-color': blockColor } as React.CSSProperties}>
      <span className="fmx-timebox-art" aria-hidden="true"><ContentIcon name="i-idozito" size={54} /></span>
      <div className="fmx-timebox-eyebrow" id="fmx-timebox-title">Logolva</div>
      <div className="fmx-timebox-time">{row.time}</div>
      <div className="fmx-timebox-sub">{row.name ? `${label} · ${row.name}` : label}</div>
      {row.plannedTime != null && (
        <div className="fmx-timebox-items">
          <div><span>Terv szerint</span><b>~{row.plannedTime}</b></div>
        </div>
      )}
      <button type="button" className="fmx-timebox-close" onClick={onClose}>Rendben</button>
    </GlassBox>
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
        {/* Üveg (mezo-me75u.1): the sparkle = „értékelés folyamatban" (uveg-alap-ikonok.html). */}
        <ContentIcon name="t-other" size={size === 'big' ? 34 : 28} />
        <b>folyamatban</b>
      </span>
    )
  }
  const value = hu1(scorePct / 10)
  return (
    <button type="button" className={cls} onClick={onOpen} aria-label={`AI értékelés: ${value}`}>
      <ContentIcon name="i-kristaly" size={size === 'big' ? 34 : 28} />
      <b>{value}</b>
    </button>
  )
}

/** A sor sávja a tárolt tényekből — UGYANAZ a deriváció, amit a részletek oldal doboza kap. */
function bandOf(row: DoneMealRow) {
  return glycemicBand({ c: row.carbsG, sugarG: row.sugarG, fiberG: row.fiberG, p: row.proteinG, f: row.fatG })
}

/** A Mai sor vércukor-chipje: a mini görbe a sáv színében, a pontszám-chip bal oldalán. */
function GlycemicChip({ row, onOpen }: { row: DoneMealRow; onOpen: () => void }) {
  const band = bandOf(row)
  // Őszinte-null: szénhidrát-adat nélkül nincs sáv, és nincs chip sem — üres helyet hagyunk,
  // nem kitalált jelzést.
  if (!band) return null
  return (
    <button type="button" className={`fmx-glu-chip lvl-${band.level}`} onClick={onOpen}
      aria-label={`Vércukor-válasz: ${band.label}`}>
      <GlycemicMiniCurve level={band.level} />
    </button>
  )
}

function BlockCard({ tile, rows, dayKcal, fiberTargetG, onLogInto, onOpenMeal, onOpenScore, onOpenTime, onOpenGlycemic }: {
  tile: WindowTileVM
  rows: DoneMealRow[]
  dayKcal: number
  /** A rost-gyűrű nevezője (mezo-l2gp0) — `dietSettings.fiberG`, threaded down to `MacroRings`. */
  fiberTargetG: number
  onLogInto: (tile: WindowTileVM) => void
  onOpenMeal: (mealId: string) => void
  /** A pont-chip SAJÁT célja: az AI értékelés, nem az étkezés részletei (mezo-jb84). */
  onOpenScore: (mealId: string) => void
  /** Az óra gomb célja (mezo-l2gp0): a logolás idejét mutató üvegdoboz nyitása. */
  onOpenTime: (mealId: string) => void
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
          {rows.length > 0 && (
            <button type="button" className="fmx-clock" onClick={() => onOpenTime(rows[0].mealId)}
              aria-label={`${tile.label} · logolás ideje`}>
              <ContentIcon name="i-idozito" size={21} />
            </button>
          )}
          <BudgetRing kcal={rows.length ? loggedKcal : tile.kcal} dayKcal={dayKcal} logged={rows.length > 0} />
        </span>
      </div>
      <WindowBar tile={tile} rows={rows} />
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
            <GlycemicChip row={r} onOpen={() => onOpenGlycemic(r.mealId)} />
            {/* A chip célja változatlan: az ÉRTÉKELÉS (mezo-jb84). */}
            <FuelScoreChip scorePct={r.scorePct} onOpen={() => onOpenScore(r.mealId)} />
          </div>
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

export function FuelMealBlocks({ lane, meals, dayKcal, fiberTargetG, onLogInto, onOpenMeal, onOpenScore }: {
  lane: WindowLaneVM
  meals: DoneMealRow[]
  /** A nap energia-kerete — a blokkgyűrű ívének nevezője (honest: ha 0, nincs ív). */
  dayKcal: number
  /** A rost-gyűrű nevezője (mezo-l2gp0) — `dietSettings.fiberG`, threaded down to `MacroRings`. */
  fiberTargetG: number
  onLogInto: (tile: WindowTileVM) => void
  onOpenMeal: (mealId: string) => void
  onOpenScore: (mealId: string) => void
}) {
  const [timeboxFor, setTimeboxFor] = useState<string | null>(null)
  const [glucoseFor, setGlucoseFor] = useState<string | null>(null)
  const glucoseRow = meals.find(m => m.mealId === glucoseFor) ?? null
  const glucoseBand = glucoseRow ? bandOf(glucoseRow) : null
  const timeboxRow = meals.find(m => m.mealId === timeboxFor) ?? null
  const timeboxTile = timeboxFor == null ? null : lane.tiles.find(t => t.mealId === timeboxFor) ?? null
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
        <BlockCard key={tile.key} tile={tile} dayKcal={dayKcal} fiberTargetG={fiberTargetG}
          rows={meals.filter(m => m.mealId === tile.mealId)}
          onLogInto={onLogInto} onOpenMeal={onOpenMeal} onOpenScore={onOpenScore} onOpenTime={setTimeboxFor}
          onOpenGlycemic={setGlucoseFor} />
      ))}
      {timeboxRow && timeboxTile && (
        <TimeBox label={timeboxTile.label} row={timeboxRow} onClose={() => setTimeboxFor(null)}
          blockColor={BLOCK_COLOR[timeboxTile.slotKey]} />
      )}
      {/* Ugyanaz a doboz, amit a részletek oldal negyedik kártyája nyit — egy komponens,
          egy deriváció, két ajtó. */}
      {glucoseBand && <GlycemicGlass band={glucoseBand} onClose={() => setGlucoseFor(null)} />}
    </div>
  )
}

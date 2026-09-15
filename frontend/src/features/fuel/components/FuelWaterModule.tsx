// ============================================================
// Mezo · FuelWaterModule — a víz a Fuel Mai-on, első osztályú modulként (Fuel Titanium S1d,
// mezo-33k6; fagyasztott manifeszt A12 „víz + visszavonás"). Owner-döntés: a víz a Mai-on
// MARAD — nem csempe-ugrás egy külön oldalra, hanem itt, egy koppintásra.
//
// Vizuális nyelv: az S1a által behozott `fmx-` gyűrű-vokabulárium (ugyanaz az SVG-anatómia,
// mint a hero makró-gyűrűinél), mellette a gyorsgombok és a visszavonás. Clay ikon, nincs emoji.
//
// A mennyiségek UGYANAZOK, amiket a `WaterLogSheet` kínál (250/400/500 ml) — nem nyitunk második,
// elcsúszható készletet; a sheet maga életben marad a többi hívójának (FAB, hero víz-gyűrű).
//
// A visszavonás a `useWaterActions` session-alapú undo-ja (mezo-mhum): CSAK azt vonja vissza,
// amit ebben a mountban logoltál — sosem találgat szerver-előzményt. Ezért a gomb is csak akkor
// létezik, ha van mit visszavonni (`canUndo`), nem pedig tiltva áll ott.
//
// Szégyenmentesség: a cél alatti érték SEMLEGES — se „keveset ittál", se elmaradás-hang. Az
// őszinte-null szabály a gyűrűre is áll: cél nélkül nincs ív és nincs nevező, csak „—".
// ============================================================
import { useWaterActions } from '@/data/hooks'
import { pct } from '@/shared/lib/pct'
import { hu1 } from '@/shared/lib/huNum'
import { ClayIcon } from '@/shared/ui/clay'

/** A WaterLogSheet saját chip-készlete, változatlanul (ml). */
const QUICK_ML = [250, 400, 500] as const

/** 250 → „2,5 dl", 400 → „4 dl" — a pohár-léptékű mennyiség olvasható mértéke. */
const dl = (ml: number) => `${hu1(ml / 100)} dl`

export function FuelWaterModule({ date, currentMl, targetMl }: {
  date: string
  currentMl: number
  targetMl: number
}) {
  const { logWater, undoLastWater, canUndo } = useWaterActions(date)

  const known = targetMl > 0
  const p = known ? Math.round(pct(currentMl, targetMl)) : 0
  const valueL = `${hu1(currentMl / 1000)} l`
  const targetL = known ? `${hu1(targetMl / 1000)} l` : '—'

  return (
    <section className="fmx-water" aria-label="Víz">
      <div className="fmx-water-head">
        <span className="fmx-ico" aria-hidden="true"><ClayIcon name="i-viz" size={30} /></span>
        <div className="fmx-water-copy">
          <strong>Víz</strong>
          {/* Semleges tény, nem értékelés: ennyi van, ennyi a cél. */}
          <small>{valueL} a mai {targetL}-ből</small>
        </div>
        <div className={`fmx-ring${known ? '' : ' is-empty'}`}
          style={{ '--macro-color': 'var(--sky)', '--ring-progress': String(p) } as React.CSSProperties}>
          <svg viewBox="0 0 80 80" aria-hidden="true">
            <circle className="fmx-ring-track" cx="40" cy="40" r="34" pathLength={100} />
            <circle className="fmx-ring-progress" cx="40" cy="40" r="34" pathLength={100} />
          </svg>
          {/* EGY mondat a felolvasónak; a látható számjegyek ennek a díszei. */}
          <span aria-label={`Víz: ${valueL} / ${targetL}`}>
            <strong aria-hidden="true">{hu1(currentMl / 1000)}</strong>
            <b aria-hidden="true">/ {known ? hu1(targetMl / 1000) : '—'}<i>l</i></b>
          </span>
        </div>
      </div>
      <div className="fmx-water-quick" role="group" aria-label="Víz gyors naplózása">
        {QUICK_ML.map(ml => (
          <button key={ml} type="button" className="fmx-water-add" onClick={() => logWater(ml)}>
            +{dl(ml)}
          </button>
        ))}
      </div>
      {canUndo && (
        <button type="button" className="fmx-water-undo" onClick={() => undoLastWater()}>
          ↺ Visszavonom · az utolsó pohár
        </button>
      )}
    </section>
  )
}

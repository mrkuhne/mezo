// ============================================================
// Mezo · FuelWeekDayGlass — egy nap részletező LAPJA a Trendek heti képéből (Fuel Titanium S3, mezo-83g0;
// manifeszt C5 „napi minőség a heti képben"). A név a régi üvegdobozé; a darab ma világos Folyadék-lap.
//
// Folyadék (mezo-n4wf5.5, prototype vilagos/fuel.js `sheetsB.day`): `<Sheet className="fo-sheet">` + `FoSheetHead`.
// A lap fején nincs kerek × (a prototípus szerint a lapot az alsó „Bezárom" zárja, a hátlap koppintása és a lehúzás mellett).
// Négy arc:
//   • kímélő nap — „Így számolom" + ajtó a nap lapjára,
//   • a hét még HÁTRALÉVŐ napja — üres tál, „Ez a nap még előtted áll.", pótlás NÉLKÜL (owner-döntés 2026-10-12),
//   • nem naplózott MÚLTBELI nap — üres tál, az őszinte mondat, „Pótolom a napot",
//   • rendes nap — a tál a keretig töltve (a keret felett más szín, nem hiba), a nap étkezés-pontja, a keret-tény,
//     a két étkezés-dimenzió szintként, a Táplálkozás négy ténysora, a nap étkezései, ajtó a nap lapjára.
//
// SZÉGYENMENTES: a keret felett járó nap SEMLEGES hangot kap — „így alakult", soha nem „hiba".
// ŐSZINTE-NULL: nem naplózott napra nem találunk ki becslést, és kimondjuk, hogy kimarad a heti átlagból;
// pontszám nélküli dimenzió „—"-t és üres szintet kap, nem nullát.
//
// C5: a felület CSAK a már kiszámolt napi értékelést OLVASSA. Étkezés-coach előzményt NEM kér és nem generál.
// ============================================================
import { SafeMarkdown } from '@/shared/lib/safeMarkdown'
import { useId } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sheet } from '@/shared/ui/Sheet'
import { Acts, Bub, Fill, FoSheetHead, Lab, Level, Lk, Note, Row, Txt } from '@/shared/ui/folyadek'
import { BOWL_D, BOWL_VB, MACRO_COLOR, NumG, Tip } from '@/features/fuel/components/folyadek'
import type { Icon3DName } from '@/shared/ui/clay'
import { useM } from '@/shared/i18n'
import { fmtGrouped } from '@/shared/lib/format'
import type { FuelWeekDay } from '@/data/fuel/mealApi'
import { dayTitle, fixed1, type WeekDayVM } from '@/features/fuel/logic/fuelWeekView'

/** Egy dimenzió egy ténysora — címke + kész, olvasható érték. */
export interface DimFactRow { label: string; value: string }

/** A `**félkövér**` jelölés kirajzolása (a katalógus egy mondata, benne egy kiemelt értékkel). */

const pct = (value: number, target: number | null): number =>
  target != null && target > 0 ? Math.max(0, Math.min(100, Math.round((value / target) * 100))) : 0

/** A Táplálkozás egy ténysora: buborék, név, „érték / cél", és a cél felé álló szint (cél nélkül nincs szint, nem hazudunk célt). */
function FactRow({ icon, color, label, value, target, unit }: {
  icon: Icon3DName; color: string; label: string; value: number; target: number | null; unit: string
}) {
  const hasTarget = target != null && target > 0
  return (
    <li className="fr-mr">
      <Bub icon={icon} size={30} color={color} />
      <span className="l">{label}</span>
      <span className="v"><b>{fmtGrouped(value)}</b>{hasTarget ? ` / ${fmtGrouped(target)}` : ''} {unit}</span>
      {hasTarget && <Level pct={pct(value, target)} color={color} height={12} />}
    </li>
  )
}

export function FuelWeekDayGlass({ day, rollup, subscores, onClose, children }: {
  day: WeekDayVM
  /** A nap nyers rollup-sora — a makró-tények EGYETLEN forrása (a Fuel kanonikus adata). */
  rollup: FuelWeekDay
  /** A hat dimenziós napi értékelés két étkezés-dimenziója, 0–100; null = nincs adat. */
  subscores: { nutrition: number | null; quality: number | null }
  onClose: () => void
  /** C5 (mezo-83g0): „A nap étkezései" szekció — CSAK naplózott napon jelenik meg, ezért a
   *  naplózatlan ágak (lent) el sem renderelik, így a napi olvasás ott el sem indul. A tartalmat a
   *  lap adja (`FuelTrendekPage`), mert a napi étkezés-olvasás a LAP adatforrása, nem a dobozé. */
  children?: React.ReactNode
}) {
  const titleId = useId()
  const navigate = useNavigate()
  const M = useM()
  const D = M.fuelTrendek.day
  const dayName = dayTitle(day.date)
  const emptyBowl = <Fill d={BOWL_D} viewBox={BOWL_VB} pct={0} size={120} />

  const body = (close: () => void) => {
    const goDay = () => { onClose(); navigate(`/fuel?d=${day.date}`) }
    const bye = <Acts><Lk onClick={close}>{D.close}</Lk></Acts>

    // Kihagyás S3: egy kímélő nap nem a kerethez mért — se pont, se „felett"; a beírt étel megmarad.
    if (day.recovery) {
      return (
        <>
          <FoSheetHead icon="t-kimelo" title={D.recoveryTitle} titleId={titleId} sub={dayName} />
          <Tip icon="t-info" title={D.howICount}>
            {day.logged ? D.recoveryLogged(fmtGrouped(rollup.consumed.kcal)) : D.recoveryPlain}
          </Tip>
          <Row icon="t-journal" title={D.openDay} sub={D.openDayRecoverySub} onClick={goDay} />
          {bye}
        </>
      )
    }

    // Owner-döntés 2026-10-12: a hét még hátralévő napja nem „nem naplózott" nap — nincs mit pótolni rajta.
    if (!day.logged && day.future) {
      return (
        <>
          <FoSheetHead icon="t-calendar" title={dayName} titleId={titleId} sub={D.ahead} />
          <NumG graphic={emptyBowl} value="—" />
          <Txt>{D.aheadText}</Txt>
          {bye}
        </>
      )
    }

    if (!day.logged) {
      return (
        <>
          <FoSheetHead icon="t-plate" title={dayName} titleId={titleId} sub={D.noData} />
          <NumG graphic={emptyBowl} value="—" />
          <Tip icon="t-info" title={D.honestTitle}>{D.honest}</Tip>
          <Row icon="t-journal" title={D.backfill} sub={D.backfillSub} onClick={goDay} />
          {bye}
        </>
      )
    }

    const kcal = rollup.consumed.kcal
    const target = day.targetKcal
    const overBy = day.over && target != null ? kcal - target : null
    const dim = (name: string, weightPct: number, score: number | null) => (
      <>
        <Lab>{D.dim(name, weightPct)}</Lab>
        <div className={score == null ? 'fr-eqb is-degraded' : 'fr-eqb'}>
          <Level pct={score ?? 0} height={16} value={score == null ? '—' : String(Math.round(score))} />
        </div>
      </>
    )

    return (
      <>
        <FoSheetHead icon="t-calendar" title={dayName} titleId={titleId} sub={D.mealScore} />
        <NumG
          graphic={(
            <Fill d={BOWL_D} viewBox={BOWL_VB} size={120}
              pct={target == null ? 94 : Math.min(100, (kcal / target) * 94)}
              color={day.over ? 'color-mix(in srgb,var(--fo-warn) 55%,#fff)' : undefined}
              color2={day.over ? 'var(--fo-warn)' : undefined} />
          )}
          value={day.dayScore == null ? '—' : fixed1(day.dayScore)}
          unit={day.dayScore == null ? undefined : M.fuelTrendek.numbers.outOfTen}
        >
          <p>
            {D.kcalOf(fmtGrouped(kcal), target == null ? '—' : fmtGrouped(target))}
            {day.training && ` · ${D.training}`}
            {day.dayScore == null && <><br />{D.noScoreYet}</>}
          </p>
        </NumG>

        {/* SEMLEGES keret-tény: a túllépés TÉNY, nem vád. „így alakult" — az owner hangja. */}
        <Txt className="fr-fact">
          {target == null
            ? D.budgetUnknown
            : <><SafeMarkdown text={(day.training ? D.budgetTraining : D.budget)(fmtGrouped(target))} />{' '}{overBy != null ? D.over(fmtGrouped(overBy)) : D.within}</>}
        </Txt>

        {dim(D.nutrition, 30, subscores.nutrition)}
        {/* OLVASHATÓ: egy tény = egy sor. Lista, hogy a képernyőolvasó is sorként mondja. */}
        <ul className="fr-mrs">
          <FactRow icon="t-plate" color="var(--dom)" label={D.calories} value={kcal} target={target} unit="kcal" />
          <FactRow icon="t-meat" color={MACRO_COLOR.protein} label={M.fuelKozos.macro.protein} value={rollup.consumed.p} target={rollup.targets.p} unit="g" />
          <FactRow icon="t-carb" color={MACRO_COLOR.carbs} label={M.fuelKozos.macro.carbs} value={rollup.consumed.c} target={rollup.targets.c} unit="g" />
          <FactRow icon="t-avocado" color={MACRO_COLOR.fat} label={M.fuelKozos.macro.fat} value={rollup.consumed.f} target={rollup.targets.f} unit="g" />
        </ul>

        {dim(D.quality, 15, subscores.quality)}
        {/* A Minőségnek nincsenek napi ténysorai: a megjegyzés csak pont nélkül áll alatta. */}
        {subscores.quality == null && <Note className="fr-dim-note">{D.qualityNoData}</Note>}

        {/* A nap étkezései — a lap adja (a napi olvasás csak nyitott dobozban, naplózott napon indul). */}
        {children}

        <Row icon="t-journal" title={D.openDay} sub={D.openDaySub} onClick={goDay} />
        <Note>{D.footnote}</Note>
        {bye}
      </>
    )
  }

  const face = day.recovery ? 'is-recovery' : !day.logged ? (day.future ? 'is-future' : 'is-empty') : day.over ? 'is-over' : ''
  return (
    <Sheet onClose={onClose} className={`fo-sheet fr-day ${face}`.trim()} labelledBy={titleId}>
      {body}
    </Sheet>
  )
}

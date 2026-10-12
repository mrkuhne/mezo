// ============================================================
// Mezo · GlycemicGlass — a vércukor-válasz lapja (Fuel Titanium, mezo-6mi43; Folyadék F5, mezo-n4wf5.5)
//
// FOLYADÉK (prototípus `vilagos/fuel.js`, `glu` lap): világos lap (`Sheet.fo-sheet` + `FoSheetHead`) — a SÁV SZAVA a cím →
// a háromsávos csík → egy mondat → a várható válasz ALAKJA folyadék-felszínként → a tányér négy ténye → mit érzel majd
// (energia · alapszint · éhség) → egy tipp mostanra → két csere legközelebbre → jegyzet. A számok és a mondatok a
// `glycemicBand` deriválásából jönnek. A komponens neve és a propjai változatlanok (a Mai és az étkezés lapja nyitja).
//
// HÁROM DOLOG, AMIT EGY KÉSŐBBI MENET MEG FOG AKARNI „JAVÍTANI" — NE:
//  1. Nincs glikémiás index. Se a szó, se szám. A lap a SÁV SZAVÁT mutatja nagyban, mert a vegyes étkezés
//     GI-matematikája 22-50%-ot téved (owner-döntés, kétszer megerősítve). A felület szava „vércukor-válasz". A görbe
//     tengelyén sincs érték: csak az idő (evés · +1 ó · +2 ó · +3 ó) és az alapszint.
//  2. A „magas" sáv nem kudarc: lila, nem hiba-szín, és nincs hibáztató mondat.
//  3. Ha a cukor becsült (`sugarEstimated`), a lap KIMONDJA. Feltevést mért adatként bemutatni tilos.
//
// Mozgás: a görbe egyszer megrajzolja magát, kizárólag a stíluslap `prefers-reduced-motion: no-preference` ágában;
// csökkentett mozgásnál a kész alak áll.
// ============================================================
import { useId } from 'react'
import { Sheet } from '@/shared/ui/Sheet'
import { useM } from '@/shared/i18n'
import { Acts, FoSheetHead, Lab, Lk, Note, Txt } from '@/shared/ui/folyadek'
import { useMealCoachFor } from '@/data/hooks'
import type { GlycemicBand, GlycemicLevel } from '@/features/fuel/logic/glycemicBand'
import { GLY_COLOR, GLY_CURVE, GlyBand, Kv, Tip } from '@/features/fuel/components/folyadek'

/** A három válasz-alak — a közös `GLY_CURVE` (a Mai sor chipje ugyanezt hordja kicsiben). A `note` a régi felirat volt;
 *  a felirat már a katalógusból jön (`fuelEtkezes.glu.shape`), az export a régi hívók kedvéért marad. */
export const CURVE: Record<GlycemicLevel, { path: string; peak: [number, number] }> = {
  high: { path: GLY_CURVE.high.d, peak: GLY_CURVE.high.peak },
  mid: { path: GLY_CURVE.mid.d, peak: GLY_CURVE.mid.peak },
  low: { path: GLY_CURVE.low.d, peak: GLY_CURVE.low.peak },
}

const AXIS: Array<[x: number, key: 'meal' | 'h1' | 'h2' | 'h3', anchor: 'start' | 'middle' | 'end']> = [
  [8, 'meal', 'start'], [82, 'h1', 'middle'], [157, 'h2', 'middle'], [232, 'h3', 'end'],
]

/** A várható válasz alakja három órán át (prototípus `gCurve`): folyadék-felszín a sáv színében, az alapszint szaggatott
 *  vonala, a csúcs pontja a nevével; a tengelyen csak idő áll. */
function ResponseCurve({ level }: { level: GlycemicLevel }) {
  const M = useM()
  const G = M.fuelEtkezes.glu
  const id = `fe-gc-${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const c = GLY_CURVE[level]
  return (
    <svg className="fe-gcv" viewBox="0 0 240 128" role="img" aria-label={G.curveAria(G.shape[level])}
      style={{ ['--gc' as string]: GLY_COLOR[level] }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--gc)' }} stopOpacity=".75" />
          <stop offset="1" style={{ stopColor: 'var(--gc)' }} stopOpacity=".12" />
        </linearGradient>
      </defs>
      <path className="fill" d={`${c.d} L232 78 8 78Z`} fill={`url(#${id})`} />
      <path className="base" d="M8 78H232" />
      <text x="8" y="91">{G.baseline}</text>
      <path className="line" d={c.d} />
      <circle className="peak" cx={c.peak[0]} cy={c.peak[1]} r="4.5" />
      <text className="val" x={c.peak[0] + 10} y={Math.max(14, c.peak[1] - 2)}>{G.shape[level]}</text>
      {level === 'high' && <text className="val" x="176" y="70">{G.dip}</text>}
      {AXIS.map(([x, key, anchor]) => (
        <g key={key}>
          <path className="tick" d={`M${x === 8 ? 9 : x === 232 ? 231 : x} 110v5`} />
          <text x={x} y="125" textAnchor={anchor}>{G.axis[key]}</text>
        </g>
      ))}
    </svg>
  )
}

/** Egy AI-javaslat a „Legközelebb" részhez — a tányér SAJÁT tételeit nevezi meg (tárolt szöveg, nem fordítjuk). */
export interface GlucoseTip { title: string; body: string }

/**
 * A lap egy LOGOLT étkezéshez: Mezo ugyanabban a hívásban írja a vércukor-tippeket, amiben az értékelést
 * (owner, 2026-09-26) — mentéskor magától lefut, és ha mégsem, ez a lekérés pótolja.
 */
export function GlycemicGlassFor({ mealId, band, onClose }: {
  mealId: string
  band: GlycemicBand
  onClose: () => void
}) {
  const { verdict } = useMealCoachFor(mealId)
  return <GlycemicGlass band={band} onClose={onClose} aiTips={verdict?.glucoseTips ?? null} />
}

export function GlycemicGlass({ band, onClose, aiTips = null }: {
  band: GlycemicBand
  onClose: () => void
  /** Az AI tippjei; `null` → a kiszámolt cserék, `[]` → az AI szerint nincs mit simítani. */
  aiTips?: GlucoseTip[] | null
}) {
  const M = useM()
  const G = M.fuelEtkezes.glu
  const W = M.fuelKozos.gly
  const titleId = useId()
  const ai = band.level !== 'low' && aiTips && aiTips.length > 0 ? aiTips : null
  const computed = aiTips == null ? band.improve : null

  return (
    <Sheet onClose={onClose} labelledBy={titleId} className={`fo-sheet fe-glu lvl-${band.level}`}>
      {(close) => (
        <>
          {/* A SÁV SZAVA áll ott, ahol máshol a nagy szám — szándékosan. */}
          <FoSheetHead icon="t-glucose" title={W.levelCap[band.level]} titleId={titleId} sub={G.sub} onClose={close} />
          <GlyBand level={band.level} />
          <Txt className="fe-gl1"><b>{G.headline[band.level]}</b></Txt>
          <ResponseCurve level={band.level} />
          <Kv items={band.facts.map(f => [f.label, f.value] as [string, string])} />

          {band.sugarEstimated && <Note tone="warn">{G.estimated}</Note>}

          <Lab>{G.feel}</Lab>
          <Tip icon="t-bolt" title={G.energy}>{band.expect.energy}</Tip>
          <Tip icon="t-clock" title={G.back}>{band.expect.back}</Tip>
          <Tip icon="t-plate" title={G.hunger}>{band.expect.hunger}</Tip>
          <Note>{G.meaning}</Note>

          <Lab>{G.now}</Lab>
          <Tip icon="t-sprout" title={band.tip.title}>{band.tip.body}</Tip>

          {/* „Legközelebb így lesz laposabb" (owner, 2026-09-26): a tipp a MOST-ra szól, ez a következő ilyen tányérra.
              Az AI-tippek elsőbbséget kapnak: ők a tányér SAJÁT tételeit nevezik meg. Üres AI-lista = nincs mit simítani
              → a rész elmarad. A kiszámolt cseréknél őszintén kimondjuk, melyik sávba vinnék együtt. */}
          {ai && (
            <section className="fe-next" aria-label={G.next}>
              <Lab>{G.next}</Lab>
              {ai.map((tip, k) => <Tip key={tip.title} icon="t-swap" title={G.step(k + 1, tip.title)}>{tip.body}</Tip>)}
              <Note>{G.fromPlate}</Note>
            </section>
          )}
          {computed && (
            <section className="fe-next" aria-label={G.next}>
              <Lab>{G.next}</Lab>
              {computed.steps.map((step, k) => <Tip key={step.title} icon="t-swap" title={G.step(k + 1, step.title)}>{step.body}</Tip>)}
              <Note className="fe-result">
                <b>{computed.result === band.level ? G.resultSame(W.level[band.level]) : G.resultOther(W.level[computed.result])}</b>
              </Note>
            </section>
          )}

          <Note>{G.note}</Note>
          <Acts><Lk onClick={close}>{G.close}</Lk></Acts>
        </>
      )}
    </Sheet>
  )
}

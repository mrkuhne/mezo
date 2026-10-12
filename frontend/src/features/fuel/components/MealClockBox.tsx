// ============================================================
// Mezo · MealClockBox — az étkezési óra lapja (mezo-6g52f; Folyadék F5, mezo-n4wf5.5).
//
// FOLYADÉK (prototípus `vilagos/fuel.js`, `ora` lap): világos lap (`Sheet.fo-sheet` + `FoSheetHead`), két arccal:
//   logolás ELŐTT: AJÁNLOTT ABLAK · 24 órás napóra · Miért ekkor? · Hogyan illik a napodba · jegyzet
//   logolás UTÁN:  LOGOLVA + eltalálás-pilula · napóra · Vércukor-válasz (CSAK SÁV) · Mire számíts
// Szám a vércukorról SOHA (owner, harmadszor is megerősítve 2026-09-26). A napóra az EGY megengedett kör: valódi óra.
//
// A komponens neve és a propjai változatlanok (a Mai blokkjai nyitják). `blockColor` a régi bőr blokk-színe volt: a lap a
// Fuel folyadékát viseli, a prop a hívók kedvéért marad. `onOpenGlycemic` ÚJ és elhagyható: megadva a vércukor-rész alatt
// megjelenik „A vércukor-válasz részletei" (a prototípus linkje a `glu` lapra).
//
// A fejléc az ablak nevét úgy írja ki, ahogy érkezik (`tile.label`) — az ablak nélküli étkezés „Ablakon kívül · HH:mm"
// neve a forrásánál (`logic/buildDayPlan`) dől el.
// ============================================================
import { Sheet } from '@/shared/ui/Sheet'
import { useM } from '@/shared/i18n'
import { SafeMarkdown } from '@/shared/lib/safeMarkdown'
import { fmtGrouped } from '@/shared/lib/format'
import type { Icon3DName } from '@/shared/ui/clay'
import { Acts, Btn, FoSheetHead, Lab, Lk, Note, St, Txt } from '@/shared/ui/folyadek'
import { GLY_COLOR, GlyBand, GlyMini, Tip } from '@/features/fuel/components/folyadek'
import { glycemicBand } from '@/features/fuel/logic/glycemicBand'
import { hitOf, hitLabel, durHu, windowReasonCopy } from '@/features/fuel/logic/mealWindow'
import { mealForecast } from '@/features/fuel/logic/mealForecast'
import { BEFORE_BED_MIN, toMin } from '@/data/fuel/fuelConfig'
import type { WindowTileVM } from '@/features/fuel/logic/fuelSwimlane'
import type { DoneMealRow } from '@/features/fuel/logic/keretHero'
import type { MealSlot } from '@/data/types'
import { judgedWindow } from '@/features/fuel/components/mealClockWindow'

export { MealClock } from '@/features/fuel/components/MealClock'
export { judgedWindow }

export interface ClockDay {
  wake: string; bed: string
  /** Null a múltbéli napokon (mezo-6g52f R4) — nincs „most" jel: nincs most-kéz a számlapon,
   *  a logolás előtti állapot „AJÁNLOTT"-ot mutat, nem „MOST"-ot. */
  nowHHmm: string | null
  training: { start: string; end: string; label: string } | null
  /** All meal windows of the day for the 24h dial (faint arcs). */
  windows: { key: string; from: string; to: string }[]
  /** Count of meal windows — "N. étkezés az M-ből". */
  mealCount: number
}

/** The window's glyph by its stable slot key (prototype `SLOTS[i].ic`). */
const SLOT_GLYPH: Record<MealSlot, Icon3DName> = { breakfast: 't-sun', lunch: 't-bowl', snack: 't-snack', dinner: 't-moon' }

function DayDial({ tile, day, window, loggedAt, hitIn }: {
  tile: WindowTileVM; day: ClockDay; window: { from: string; to: string } | null; loggedAt: string | null; hitIn: boolean
}) {
  const M = useM()
  const D = M.fuelEtkezes.clock.dial
  const C = 115, R = 88, L = 1440
  const arc = (a: string, b: string, cls: string, r = R) => {
    const s = toMin(a), len = ((toMin(b) - s) + L) % L
    return <circle className={cls} cx={C} cy={C} r={r} pathLength={L} strokeDasharray={`${len} ${L - len}`}
      strokeDashoffset={-s} transform={`rotate(-90 ${C} ${C})`} />
  }
  const pt = (min: number, r: number): [number, number] => {
    const a = (min / L) * 2 * Math.PI - Math.PI / 2
    return [C + r * Math.cos(a), C + r * Math.sin(a)]
  }
  const now = day.nowHHmm != null ? toMin(day.nowHHmm) : null
  const nowPt = now != null ? [pt(now, R - 8), pt(now, R + 6)] as const : null
  const range = window ? `${window.from}–${window.to}` : '—'
  const c1 = loggedAt ? D.was : now != null ? D.now : D.suggested
  const c2 = loggedAt ? range : now != null ? day.nowHHmm! : range
  const c3 = loggedAt
    ? (window ? D.long(durHu(toMin(window.to) - toMin(window.from))) : D.noWindow)
    : now != null && window && now <= toMin(window.to) && now >= toMin(window.from) ? D.left(durHu(toMin(window.to) - now)) : ''
  const moon = pt(toMin('02:00'), R - 22)
  return (
    <svg className="fe-dd24" viewBox="0 0 230 230" role="img"
      aria-label={day.training ? D.ariaTraining(day.wake, day.bed, day.training.start, day.training.end) : D.aria(day.wake, day.bed)}>
      <circle className="face" cx={C} cy={C} r={104} />
      {arc(day.wake, day.bed, 'awake')}
      {arc(day.bed, day.wake, 'night')}
      {day.windows.filter(w => w.key !== tile.key).map(w => <g key={w.key}>{arc(w.from, w.to, 'other')}</g>)}
      {window && arc(window.from, window.to, 'this')}
      {day.training && arc(day.training.start, day.training.end, 'train', R + 13)}
      {[0, 6, 12, 18].map(h => { const [x, y] = pt(h * 60, R - 20); return <text key={h} className="hr" x={x} y={y + 4} textAnchor="middle">{h}</text> })}
      {/* a két tájoló-jel a számlapon: a hold éjfél után 2 órával, a súlyzó az edzés-ív közepén */}
      <use href="#t-moon" x={moon[0] - 8} y={moon[1] - 8} width={16} height={16} aria-hidden="true" />
      {day.training && (() => {
        const s = toMin(day.training.start), len = ((toMin(day.training.end) - s) + L) % L
        const [x, y] = pt(s + len / 2, R + 25)
        return <use href="#t-dumbbell" x={x - 9} y={y - 9} width={18} height={18} aria-hidden="true" />
      })()}
      {nowPt && <line className="nowhand" x1={nowPt[0][0]} y1={nowPt[0][1]} x2={nowPt[1][0]} y2={nowPt[1][1]} />}
      {loggedAt && (() => { const [x, y] = pt(toMin(loggedAt), R); return <circle className={hitIn ? 'logdot' : 'logdot out'} cx={x} cy={y} r={8} /> })()}
      <text className="c1" x={C} y={C - 18} textAnchor="middle">{c1}</text>
      <text className={c2.length > 5 ? 'c2 rng' : 'c2'} x={C} y={C + 8} textAnchor="middle">{c2}</text>
      <text className="c3" x={C} y={C + 26} textAnchor="middle">{c3}</text>
    </svg>
  )
}

/** A hint row with a value at its end (prototype `sRow(ic, t, b, v)`) — the Fuel-shared `Tip` plus the number. */
function TipValue({ icon, title, body, value }: { icon: Icon3DName; title: string; body: string; value?: string }) {
  if (!value) return <Tip icon={icon} title={title}>{body}</Tip>
  return <div className="fe-tv"><Tip icon={icon} title={title}>{body}</Tip><em>{value}</em></div>
}

export function MealClockBox({ tile, row, day, next, onClose, onOpenGlycemic }: {
  tile: WindowTileVM; row: DoneMealRow | null; day: ClockDay; next: WindowTileVM | null
  blockColor: string; onClose: () => void
  /** Opens the blood sugar sheet of this meal; without it the link is not drawn. */
  onOpenGlycemic?: () => void
}) {
  const M = useM()
  const C = M.fuelEtkezes.clock
  const W = M.fuelKozos.gly
  const window = judgedWindow(tile, row)
  const idx = day.windows.findIndex(w => w.key === tile.key) + 1
  const reasonCtx = { wake: day.wake, bed: day.bed, trainingStart: day.training?.start ?? null, trainingEnd: day.training?.end ?? null, shiftedAfter: tile.shiftedAfter }
  const hit = row && window ? hitOf(window.from, window.to, row.time) : null
  const band = row ? glycemicBand({ c: row.carbsG, sugarG: row.sugarG, fiberG: row.fiberG, p: row.proteinG, f: row.fatG }) : null
  const late = row ? (() => { const d = toMin(day.bed) - toMin(row.time); return d >= 0 && d <= BEFORE_BED_MIN })() : false
  // Nincs „most" múltbéli napon (mezo-6g52f R4) — szégyenmentesen „még pótolható", nem találgatott „most nyitva" / „nyílik ekkor".
  const status = row ? C.status.logged : window && day.nowHHmm != null ? (toMin(day.nowHHmm) < toMin(window.from)
    ? C.status.opens(window.from) : toMin(day.nowHHmm) <= toMin(window.to) ? C.status.openNow : C.status.closed(window.to))
    : window ? C.status.canAdd : ''
  const sub = idx > 0 ? (status ? C.headSub(C.mealOf(idx, day.mealCount), status) : C.mealOf(idx, day.mealCount)) : status

  return (
    <Sheet onClose={onClose} labelledBy="fe-mclockbox-title" className="fo-sheet fe-ora">
      {(close) => (
        <>
          <FoSheetHead icon={SLOT_GLYPH[tile.slotKey] ?? 't-clock'} title={tile.label} titleId="fe-mclockbox-title"
            sub={sub || undefined} onClose={close} />

          <div className="fe-ob">
            <small>{row ? C.logged : C.window}</small>
            <span className="fo-big">{row ? row.time : window ? `${window.from}–${window.to}` : '—'}</span>
            {row && window && <p>{C.suggested(window.from, window.to)}</p>}
            {hit && <St tone={hit.kind === 'in' ? 'ok' : 'warn'}>{hitLabel(hit)}</St>}
          </div>

          <DayDial tile={tile} day={day} window={window} loggedAt={row?.time ?? null} hitIn={hit ? hit.kind === 'in' : true} />
          <div className="fe-lg">
            <span><i className="liq" />{tile.label}</span>
            <span><i className="oth" />{C.legend.other}</span>
            {day.training && <span><i className="trn" />{C.legend.training}</span>}
            <span><i className="ngt" />{C.legend.sleep}</span>
          </div>

          {!row && (
            <>
              {tile.windowReasons.length > 0 && (
                <>
                  <Lab>{C.why}</Lab>
                  {tile.windowReasons.map(code => { const c = windowReasonCopy(code, reasonCtx); return <Tip key={code} icon={c.icon} title={c.title}>{c.body}</Tip> })}
                </>
              )}
              <Lab>{C.fits}</Lab>
              {day.training && <Tip icon="t-dumbbell" title={C.movement}>{`${day.training.label} ${day.training.start}–${day.training.end}`}</Tip>}
              {tile.budgetKcal != null && (
                <TipValue icon="t-plate" title={C.plan}
                  body={idx > 0 ? C.planBody(idx, day.mealCount, fmtGrouped(tile.budgetKcal)) : C.planBodyBare(fmtGrouped(tile.budgetKcal))}
                  value={`${fmtGrouped(tile.budgetKcal)} kcal`} />
              )}
              <Note>{C.note}</Note>
            </>
          )}

          {row && (() => {
            const f = mealForecast({
              level: band?.level ?? null, energyText: band?.expect.energy ?? null, kcal: row.kcal, eatenAt: row.time, window,
              training: day.training ? { start: day.training.start, end: day.training.end } : null,
              bed: day.bed,
              next: next && next.windowFrom && next.windowTo ? { label: next.label, from: next.windowFrom, to: next.windowTo } : null,
            })
            return (
              <>
                {band && (
                  <>
                    <Lab>{C.glucose}</Lab>
                    <div className="fe-ogl" style={{ ['--gc' as string]: GLY_COLOR[band.level] }}>
                      <GlyMini level={band.level} late={late} />
                      <b>{late ? C.lateWord(W.levelCap[band.level]) : W.levelCap[band.level]}</b>
                    </div>
                    <GlyBand level={band.level} />
                    <Txt><SafeMarkdown text={late ? C.tipLate(band.tip.title, band.tip.body) : C.tip(band.tip.title, band.tip.body)} /></Txt>
                    {onOpenGlycemic && <Acts><Lk onClick={onOpenGlycemic}>{C.glucoseDetails}</Lk></Acts>}
                  </>
                )}
                <Lab>{C.expect}</Lab>
                {f.rows.map(r => <Tip key={r.title} icon={r.icon} title={r.title}>{r.body}</Tip>)}
                {f.tip && <Note>{f.tip}</Note>}
              </>
            )
          })()}

          <Acts><Btn sm grow onClick={close}>{C.ok}</Btn></Acts>
        </>
      )}
    </Sheet>
  )
}

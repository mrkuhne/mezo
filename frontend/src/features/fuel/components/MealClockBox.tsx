// ============================================================
// Mezo · MealClockBox — az óra-doboz (mezo-6g52f). Fuel-középre nyíló GlassBox; a keret áll, a
// tartalom belül görget (.fmx-mclockbox-in). Két állapot, a jóváhagyott prototípus szerint
// (docs/design_2.0/prototypes/fuel-ora-ablak.html `open()`):
//   logolás ELŐTT: AJÁNLOTT ABLAK · 24 órás napóra · Miért ekkor? · Hogyan illik a napodba · jegyzet
//   logolás UTÁN:  LOGOLVA + eltalálás-chip · napóra · Vércukor-válasz (CSAK SÁV) · Mire számíts · tipp
// Szám a vércukorról SOHA (owner, harmadszor is megerősítve 2026-09-26).
// ============================================================
import type { CSSProperties } from 'react'
import { ContentIcon, type ClayIconName, type Icon3DName } from '@/shared/ui/clay'
import { GlassBox } from '@/features/fuel/components/GlassBox'
import { GlycemicMiniCurve } from '@/features/fuel/components/GlycemicGlass'
import { glycemicBand, type GlycemicLevel } from '@/features/fuel/logic/glycemicBand'
import { hitOf, hitLabel, durHu, windowReasonCopy } from '@/features/fuel/logic/mealWindow'
import { mealForecast } from '@/features/fuel/logic/mealForecast'
import { BEFORE_BED_MIN, toMin } from '@/data/fuel/fuelConfig'
import { huInt } from '@/shared/lib/huNum'
import type { WindowTileVM } from '@/features/fuel/logic/fuelSwimlane'
import type { DoneMealRow } from '@/features/fuel/logic/keretHero'
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

const BAND_WORD: Record<GlycemicLevel, string> = { low: 'Alacsony', mid: 'Közepes', high: 'Magas' }

function DayDial({ tile, day, window, loggedAt, hitIn }: {
  tile: WindowTileVM; day: ClockDay; window: { from: string; to: string } | null; loggedAt: string | null; hitIn: boolean
}) {
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
  const c1 = loggedAt ? 'AJÁNLOTT VOLT' : now != null ? 'MOST' : 'AJÁNLOTT'
  const c2 = loggedAt ? (window ? `${window.from}–${window.to}` : '—')
    : now != null ? day.nowHHmm! : (window ? `${window.from}–${window.to}` : '—')
  const c3 = loggedAt
    ? (window ? `${durHu(toMin(window.to) - toMin(window.from))} hosszú ablak` : 'nem tartozott ablakhoz')
    : now != null
      ? (window && now <= toMin(window.to) && now >= toMin(window.from) ? `még ${durHu(toMin(window.to) - now)}` : '')
      : ''
  return (
    <>
      <svg className="fmx-mclockbox-dial" viewBox="0 0 230 230" role="img"
        aria-label={`Napóra: ébredés ${day.wake}, lefekvés ${day.bed}${day.training ? `, edzés ${day.training.start}–${day.training.end}` : ''}`}>
        <circle className="face" cx={C} cy={C} r={104} />
        {arc(day.wake, day.bed, 'awake')}
        {arc(day.bed, day.wake, 'night')}
        {day.windows.filter(w => w.key !== tile.key).map(w => <g key={w.key}>{arc(w.from, w.to, 'other')}</g>)}
        {window && arc(window.from, window.to, 'this')}
        {day.training && arc(day.training.start, day.training.end, 'train', R + 13)}
        {[0, 6, 12, 18].map(h => { const [x, y] = pt(h * 60, R - 20); return <text key={h} className="hr" x={x} y={y}>{h}</text> })}
        {/* mezo-6g52f minor c: a jóváhagyott prototípus (fuel-ora-ablak.html `dial()`) két
            tájoló-glyphje a számlapon — a hold éjfél után 2 órával, a súlyzó az edzés-ív
            közepén; ugyanaz a `<use>`-mintázat, amit a Titanium sprite `ContentIcon`/`Icon3D`
            is használ (`#t-…` id-k a titanium-icons.svg-ből), csak itt közvetlenül a
            napóra-koordinátákra pozicionálva x/y/width/height-tel. */}
        {(() => { const [x, y] = pt(toMin('02:00'), R - 22)
          return <use href="#t-moon" x={x - 8} y={y - 8} width={16} height={16} aria-hidden="true" /> })()}
        {day.training && (() => {
          const s = toMin(day.training.start), len = ((toMin(day.training.end) - s) + L) % L
          const [x, y] = pt(s + len / 2, R + 25)
          return <use href="#t-dumbbell" x={x - 9} y={y - 9} width={18} height={18} aria-hidden="true" />
        })()}
        {nowPt && <line className="nowhand" x1={nowPt[0][0]} y1={nowPt[0][1]} x2={nowPt[1][0]} y2={nowPt[1][1]} />}
        {loggedAt && (() => { const [x, y] = pt(toMin(loggedAt), R); return <circle className="logdot" cx={x} cy={y} r={8} style={{ fill: hitIn ? 'var(--block-color)' : 'var(--amber)' }} /> })()}
        <text className="c1" x={C} y={C - 18}>{c1}</text>
        <text className="c2" x={C} y={C + 6}>{c2}</text>
        <text className="c3" x={C} y={C + 24}>{c3}</text>
      </svg>
      <div className="fmx-mclockbox-legend">
        <span><i style={{ background: 'var(--block-color)' }} />{tile.label}</span>
        <span><i className="is-other" />többi étkezés</span>
        {day.training && <span><i style={{ background: 'var(--coral)' }} />edzés</span>}
        <span><i className="is-night" />alvás</span>
      </div>
    </>
  )
}

function Row({ icon, title, body, value }: { icon: ClayIconName | Icon3DName; title: string; body: string; value?: string }) {
  return (
    <div className="fmx-mclockbox-row">
      <ContentIcon name={icon} size={30} />
      <div><b>{title}</b><span>{body}</span></div>
      {value && <em>{value}</em>}
    </div>
  )
}

export function MealClockBox({ tile, row, day, next, blockColor, onClose }: {
  tile: WindowTileVM; row: DoneMealRow | null; day: ClockDay; next: WindowTileVM | null
  blockColor: string; onClose: () => void
}) {
  const window = judgedWindow(tile, row)
  const idx = day.windows.findIndex(w => w.key === tile.key) + 1
  const reasonCtx = { wake: day.wake, bed: day.bed, trainingStart: day.training?.start ?? null, trainingEnd: day.training?.end ?? null }
  const hit = row && window ? hitOf(window.from, window.to, row.time) : null
  const band = row ? glycemicBand({ c: row.carbsG, sugarG: row.sugarG, fiberG: row.fiberG, p: row.proteinG, f: row.fatG }) : null
  const late = row ? (() => { const d = toMin(day.bed) - toMin(row.time); return d >= 0 && d <= BEFORE_BED_MIN })() : false
  // Nincs „most" múltbéli napon (mezo-6g52f R4) — szégyenmentesen „még pótolható", nem
  // találgatott „most nyitva"/„nyílik ekkor".
  const status = row ? 'logolva' : window && day.nowHHmm != null ? (toMin(day.nowHHmm) < toMin(window.from)
    ? `nyílik ${window.from}` : toMin(day.nowHHmm) <= toMin(window.to) ? 'most nyitva' : `az ablak ${window.to}-kor zárult`)
    : window ? 'még pótolható' : ''

  return (
    <GlassBox onClose={onClose} labelledBy="fmx-mclockbox-title" className="fmx-mclockbox"
      style={{ '--block-color': blockColor, '--c': blockColor } as CSSProperties}>
      <div className="fmx-mclockbox-in">
        <div className="fmx-mclockbox-head">
          <ContentIcon name={tile.icon} size={34} />
          <div><b id="fmx-mclockbox-title">{tile.label}</b>
            <small>{idx > 0 ? `${idx}. étkezés ${day.mealCount} közül · ` : ''}{status}</small></div>
          <button type="button" className="fmx-mclockbox-x" onClick={onClose} aria-label="Bezárás">✕</button>
        </div>

        <div className="fmx-mclockbox-big">
          <span className="fmx-mclockbox-eyebrow">{row ? 'Logolva' : 'Ajánlott ablak'}</span>
          <div className="fmx-mclockbox-time">{row ? row.time : window ? `${window.from}–${window.to}` : '—'}</div>
          {row && window && <div className="fmx-mclockbox-sub">ajánlott ablak: {window.from}–{window.to}</div>}
          {hit && <span className={`fmx-mclockbox-hit${hit.kind === 'in' ? ' is-in' : ''}`}>{hitLabel(hit)}</span>}
        </div>

        <DayDial tile={tile} day={day} window={window} loggedAt={row?.time ?? null} hitIn={hit?.kind === 'in'} />

        {!row && (
          <>
            {tile.windowReasons.length > 0 && (
              <section className="fmx-mclockbox-sec"><h3>Miért ekkor?</h3>
                {tile.windowReasons.map(code => { const c = windowReasonCopy(code, reasonCtx); return <Row key={code} icon={c.icon} title={c.title} body={c.body} /> })}
              </section>
            )}
            <section className="fmx-mclockbox-sec"><h3>Hogyan illik a napodba</h3>
              {day.training && <Row icon="t-dumbbell" title="Mozgás ma" body={`${day.training.label} ${day.training.start}–${day.training.end}`} />}
              {tile.budgetKcal != null && (
                <Row icon="t-plate" title="Étkezési terv"
                  body={`${idx}. étkezés ${day.mealCount} közül. Erre ~${huInt(tile.budgetKcal)} kcal jut a napi keretből.`}
                  value={`${huInt(tile.budgetKcal)} kcal`} />
              )}
            </section>
            <p className="fmx-mclockbox-note">Az ablak iránymutatás. A napi összes fehérje és kalória többet számít, mint az, hogy percre pontosan mikor eszel.</p>
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
                <section className="fmx-mclockbox-sec"><h3>Vércukor-válasz</h3>
                  <div className={`fmx-mclockbox-gly lvl-${band.level}`}>
                    <div className="fmx-mclockbox-gly-top"><ContentIcon name="t-glucose" size={30} /><b>{BAND_WORD[band.level]}{late ? ' · késő este' : ''}</b></div>
                    <div className="fmx-mclockbox-bands" aria-hidden="true">
                      {(['low', 'mid', 'high'] as const).map(k => <i key={k} className={k === band.level ? 'on' : ''} />)}
                    </div>
                    <div className="fmx-mclockbox-bandlbl">
                      {(['low', 'mid', 'high'] as const).map(k => <span key={k} className={k === band.level ? 'on' : ''}>{BAND_WORD[k]}</span>)}
                    </div>
                    <GlycemicMiniCurve level={band.level} />
                    <p><b>{band.tip.title}.</b> {band.tip.body}{late ? ' Késő este ugyanez általában magasabbra és tovább emelkedik.' : ''}</p>
                  </div>
                </section>
              )}
              <section className="fmx-mclockbox-sec"><h3>Mire számíts</h3>
                {f.rows.map(r => <Row key={r.title} icon={r.icon} title={r.title} body={r.body} />)}
              </section>
              {f.tip && <p className="fmx-mclockbox-note">{f.tip}</p>}
            </>
          )
        })()}

        <button type="button" className="fmx-mclockbox-close" onClick={onClose}>Rendben</button>
      </div>
    </GlassBox>
  )
}

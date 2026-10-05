// Mezo · LifelineCard — „Életvonal", the Én hub's 12-week curve (mezo-lhqw7).
// Prototype: docs/design_2.0/prototypes/elo/en.html `elv()` + `elvChart()`. ONE sky glass card:
// the 12-week change as the big numeral, the 7-day average beside it, the smoothed weekly-average
// curve (geometry: lifelineGeometry.ts) with its gold stations, the lavender weekly sleep band,
// the tapped station's caption, and the door to the Test tab.
// The card is a `div`: the stations and the footer are the buttons (never a button in a button).
// Honest states (model: logic/lifeline.ts):
//  · fewer than two measured weeks → the dashed empty state with „Mérj most", no invented curve;
//  · the target line, its label and the dotted projection only when the 4-week trend really
//    heads to the target;
//  · stations only from stored events; with none, the caption line is absent;
//  · a week without a logged night is a marked stub in the sleep band; no night at all → no band;
//  · an unresolved trend (0) never prints „0 kg" as the 7-day average.
// Motion: the curve draws once (CSS `enh-elv-draw`, armed by the entrance group, only under
// prefers-reduced-motion: no-preference) — reduced motion and a back-navigation show the final frame.
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon3D } from '@/shared/ui/clay'
import { useAchievements, useGoal, useSleep, useWeight } from '@/data/hooks'
import { buildLifeline } from '@/features/me/logic/lifeline'
import { WeightLogSheet } from '@/features/me/sheets/WeightLogSheet'
import { localDateString } from '@/shared/lib/dates'
import { hu1 } from '@/shared/lib/huNum'
import { lifelineGeometry, PLOT } from './lifelineGeometry'

const HU_MONTHS_SHORT = ['jan.', 'febr.', 'márc.', 'ápr.', 'máj.', 'jún.', 'júl.', 'aug.', 'szept.', 'okt.', 'nov.', 'dec.']
/** '2026-09-02' → 'szept. 2.' — the prototype's station/axis date form (`huMonthDay` is 'Szep 2'). */
const huShortDate = (iso: string): string => {
  const [, m, d] = iso.split('-').map(Number)
  return `${HU_MONTHS_SHORT[m - 1]} ${d}.`
}
/** Signed one-decimal Hungarian numeral with U+2212; a value that rounds to zero carries no sign. */
const huSigned = (n: number): string => {
  const r = Math.round(n * 10) / 10
  return `${r > 0 ? '+' : r < 0 ? '−' : ''}${hu1(Math.abs(r))}`
}
/** The prototype's bar height: 5,6 h is the floor of the 22px band. */
const sleepBarPx = (h: number): number => Math.max(4, Math.min(22, Math.round((h - 5.6) * 12)))
const pct = (n: number, of: number): string => `${((n / of) * 100).toFixed(2)}%`

export function LifelineCard() {
  const navigate = useNavigate()
  const { weightLog, weightTrends, logWeight } = useWeight()
  const { sleepLog } = useSleep()
  const { goal } = useGoal()
  const { data: achievements } = useAchievements()
  const [selected, setSelected] = useState(-1)
  const [logOpen, setLogOpen] = useState(false)

  const l = buildLifeline({
    weightLog, sleepLog, perks: achievements?.perks ?? [], goal: goal ?? null,
    weeklyRate4w: weightTrends.last4w.weeklyRate, todayIso: localDateString(),
  })

  if (l == null) {
    const latest = weightLog.length > 0 ? weightLog[weightLog.length - 1].value : null
    return (
      <>
        <div className="enh-elv enh-elv-empty uv-empty rise" style={{ '--d': '120ms', '--c': 'var(--dv-sky)' } as React.CSSProperties}>
          <Icon3D name="t-weight" size={64} />
          <span className="enh-elv-eb uv-eyebrow">Életvonal</span>
          <p>Még kevés a mérés — két mérés után rajzolódik ki az életvonalad.</p>
          <button type="button" className="enh-elv-pill" onClick={() => setLogOpen(true)}>
            <Icon3D name="t-weight" size={18} />Mérj most
          </button>
        </div>
        {logOpen && <WeightLogSheet onClose={() => setLogOpen(false)} onSave={logWeight} currentWeight={latest ?? 0} />}
      </>
    )
  }

  const g = lifelineGeometry(l)
  const n = l.points.length
  const last = g.pts[n - 1]
  const first = l.points[0], latestPoint = l.points[n - 1]
  const avg7 = weightTrends.last7d.avg
  const slept = l.sleepHours.filter((h): h is number => h != null)
  const station = selected >= 0 ? l.stations[selected] : null
  // The axis names the first, the middle and the last week (the prototype's three labels).
  const axis = [...new Set(n >= 5 ? [0, Math.floor((n - 1) / 2), n - 1] : [0, n - 1])]
  // Two stations in the same week would sit on one spot — the later one steps up.
  const stackOf = l.stations.map((s, k) => l.stations.slice(0, k).filter((o) => o.index === s.index).length)

  return (
    <div className="enh-elv glass rise" style={{ '--d': '120ms', '--c': 'var(--dv-sky)' } as React.CSSProperties}>
      <div className="enh-elv-top">
        <div>
          <span className="enh-elv-eb uv-eyebrow">Életvonal · {n} hét</span>
          <div className="enh-elv-big">{huSigned(l.deltaKg)}<small>kg</small></div>
        </div>
        {avg7 > 0 && <div className="enh-elv-side"><b>{hu1(avg7)} kg</b>7 napos átlag</div>}
      </div>

      <div className="enh-elv-plot">
        <svg className="enh-elv-svg" viewBox={`0 0 ${PLOT.vbW} ${PLOT.vbH}`} role="img"
          aria-label={`Életvonal: ${n} hét, ${hu1(first.avgKg)} kg → ${hu1(latestPoint.avgKg)} kg${g.targetY != null && l.targetKg != null ? `; cél ${hu1(l.targetKg)} kg` : ''}`}>
          <defs>
            <linearGradient id="enh-elv-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" style={{ stopColor: 'var(--dv-sky)', stopOpacity: 0.22 }} />
              <stop offset="1" style={{ stopColor: 'var(--dv-sky)', stopOpacity: 0 }} />
            </linearGradient>
          </defs>
          {g.grid.map((line) => (
            <g key={line.value}>
              <line className="enh-elv-grid" x1={PLOT.x0} x2={PLOT.xp + 4} y1={line.y.toFixed(1)} y2={line.y.toFixed(1)} />
              <text className="enh-elv-gl" x={PLOT.labelX} y={(line.y + 3).toFixed(1)} textAnchor="end">{hu1(line.value)}</text>
            </g>
          ))}
          <path className="enh-elv-area" d={g.area} fill="url(#enh-elv-fill)" />
          <path className="enh-elv-curve" d={g.path} pathLength={100} />
          {g.targetY != null && l.targetKg != null && g.projection != null && (
            <>
              <line className="enh-elv-tgt" x1={PLOT.x0} x2={PLOT.labelX} y1={g.targetY.toFixed(1)} y2={g.targetY.toFixed(1)} />
              <path className="enh-elv-proj" d={g.projection} />
              <text className="enh-elv-tgl" x={PLOT.labelX} y={(g.targetY - 5).toFixed(1)} textAnchor="end">cél {hu1(l.targetKg)}</text>
            </>
          )}
          <circle className="enh-elv-endp" cx={last.x.toFixed(1)} cy={last.y.toFixed(1)} r="5.2" />
          {axis.map((i) => (
            <text key={i} className="enh-elv-gl" x={g.pts[i].x.toFixed(1)} y={PLOT.h + 12}
              textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}>{huShortDate(l.points[i].weekStart)}</text>
          ))}
        </svg>
        {l.stations.map((s, k) => (
          <button key={`${s.kind}-${s.index}-${s.title}`} type="button"
            className={`enh-elv-stn${s.index === n - 1 ? ' is-end' : ''}${selected === k ? ' is-on' : ''}`}
            style={{
              left: pct(g.pts[s.index].x, PLOT.vbW), top: pct(g.pts[s.index].y, PLOT.vbH),
              '--i': k, '--stack': stackOf[k],
            } as React.CSSProperties}
            aria-label={`${s.title} · ${huShortDate(s.dateIso)}`} aria-pressed={selected === k}
            onClick={() => setSelected(selected === k ? -1 : k)}>
            <i aria-hidden="true" />
          </button>
        ))}
      </div>

      {slept.length > 0 && (
        <>
          <div className="enh-elv-sleep" role="img" aria-label="Alvás, heti átlag"
            style={{ gridTemplateColumns: `repeat(${n}, 1fr)` }}>
            {l.sleepHours.map((h, i) => (
              <i key={l.points[i].weekStart} className={h == null ? 'is-none' : undefined}
                style={{ height: h == null ? 3 : sleepBarPx(h), '--i': i } as React.CSSProperties} />
            ))}
          </div>
          <div className="enh-elv-sleepleg">
            <span><i aria-hidden="true" />alvás · heti átlag</span>
            <span>{Math.min(...slept) === Math.max(...slept)
              ? `${hu1(slept[0])} ó` : `${hu1(Math.min(...slept))}–${hu1(Math.max(...slept))} ó`}</span>
          </div>
        </>
      )}

      {l.stations.length > 0 && (
        <div className={`enh-elv-cap${station ? ' is-on' : ''}`} aria-live="polite">
          <i aria-hidden="true" />
          {station
            ? <span><b>{station.title}</b> · {huShortDate(station.dateIso)} — {station.caption}</span>
            : <span>Koppints egy arany pontra: mi történt ott.</span>}
        </div>
      )}

      <button type="button" className="enh-elv-next" onClick={() => navigate('/me/weight')}>
        {l.targetKg != null && l.remainingKg != null
          ? <span>A következő állomás: <b>{hu1(l.targetKg)} kg</b> — még {hu1(l.remainingKg)} kg</span>
          : <span>A részletek a Test fülön</span>}
        <span className="enh-chev" aria-hidden="true">›</span>
      </button>
    </div>
  )
}

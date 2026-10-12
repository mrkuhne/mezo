// Fuel · Folyadék vessels (mezo-n4wf5.5): the day's bowl, the meal poured into it, a window's cup, the pot, the glass and the
// real clock face. Prototype: docs/design_2.0/prototypes/vilagos/fuel.js (`dayBowl`, `bowlHero`, `pour`, `pk`, `slotCup`,
// `plainCup`, `potG`, `GLASS`, `dial`). CSS: styles/folyadek-fuel-kozos.css (`.fx-`). Words: the `fuelKozos` catalog.
import { useId, type ReactNode } from 'react'
import { useM } from '@/shared/i18n'
import { fmtGrouped } from '@/shared/lib/format'
import { Fill } from '@/shared/ui/folyadek'

const clampPct = (v: number) => Math.max(0, Math.min(100, Number.isFinite(v) ? v : 0))
const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(' ')
/** A per-instance id safe inside `url(#…)` (bible trap 2). */
const useSvgId = (prefix: string) => prefix + useId().replace(/[^a-zA-Z0-9_-]/g, '')

export const BOWL_D = 'M6 4 H194 C194 62 152 100 100 100 C48 100 6 62 6 4Z'
export const BOWL_VB = '0 0 200 104'
export const CUP_D = 'M6 6 H54 V32 C54 46 44 54 30 54 C16 54 6 46 6 32Z'
export const CUP_VB = '0 0 60 58'
export const POT_D = 'M14 26 H106 V62 C106 80 94 92 76 92 H44 C26 92 14 80 14 62Z'
export const POT_VB = '0 0 120 96'
export const GLASS_D = 'M12 4 H88 L79 116 C78.4 122 74 126 68 126 H32 C26 126 21.6 122 21 116Z'
export const GLASS_VB = '0 0 100 130'

const wave = (y: number, x0 = -10, n = 10, a = 25, amp = 4) => `M${x0} ${y.toFixed(1)} q${a / 2} ${-amp} ${a} 0 ${`t${a} 0 `.repeat(n)}`
/** The bowl's inner y for a level in % (the bowl holds 4…100 of its 104 box). */
const bowlY = (pct: number) => 4 + 96 * (1 - clampPct(pct) / 100)

/** The day's bowl: what was eaten (liquid) and, above it, the share of skipped windows (a faint dashed band — neither „still
 *  fits" nor a miss). Levels are % of the bowl; `over` paints the liquid amber. Decorative: the caller names it. */
export function DayBowl({ eatPct, skipPct = 0, over, size = 152 }: { eatPct: number; skipPct?: number; over?: boolean; size?: number }) {
  const id = useSvgId('fxdb')
  const ya = bowlY(eatPct)
  const yb = bowlY(Math.min(100, eatPct + skipPct))
  return (
    <svg className="fx-bowl-svg" viewBox={BOWL_VB} style={{ width: size }} aria-hidden="true">
      <defs>
        <clipPath id={id}><path d={BOWL_D} /></clipPath>
        <linearGradient id={`${id}g`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={over ? 'color-mix(in srgb,var(--fo-warn) 55%,#fff)' : 'var(--liq1)'} />
          <stop offset="1" stopColor={over ? 'var(--fo-warn)' : 'var(--liq2)'} />
        </linearGradient>
      </defs>
      <path d={BOWL_D} fill="#fff" stroke="rgba(10,42,60,.10)" strokeWidth="3" />
      <g clipPath={`url(#${id})`}>
        {skipPct > 0 && <path className="fx-bowl-skip" d={`${wave(yb)}V${(ya + 3).toFixed(1)} H-10Z`} fill="rgba(10,42,60,.07)" stroke="var(--fo-faint)" strokeWidth="1.5" strokeDasharray="4 4" />}
        {eatPct > 0 && <g className="fx-wv"><path className="fx-bowl-liq" d={`${wave(ya, -210, 18)}V110 H-210Z`} fill={`url(#${id}g)`} /></g>}
      </g>
      <path d={BOWL_D} fill="none" stroke="rgba(255,255,255,.55)" strokeWidth="2" />
    </svg>
  )
}

/** The Mai hero's graphic row (`bowlHero`'s `.fm-g`): eaten on the left, the bowl filled to the budget in the middle, what
 *  still fits (or the overshoot) on the right. `plain` = the bowl alone, empty (a closed day without data, loading, error).
 *  kcal values are raw numbers; `remLabel` is the caller's word under the right numeral („kcal fér még bele"). The bowl is
 *  a button when `onClick` is given (it opens the energy sheet). */
export function BowlGauge({ eaten = 0, target = 0, rem = 0, remLabel, skipped = 0, over, plain, onClick, size }: {
  eaten?: number; target?: number; rem?: number; remLabel?: ReactNode; skipped?: number; over?: boolean; plain?: boolean
  onClick?: () => void; size?: number
}) {
  const M = useM()
  const K = M.fuelKozos.bowl
  const safe = target > 0 ? target : 1
  const eatPct = plain || !eaten ? 0 : Math.max(7, Math.min(100, (eaten / safe) * 94))
  const skipPct = plain ? 0 : (skipped / safe) * 94
  const label = plain ? K.empty
    : skipped > 0 ? K.ariaSkipped(fmtGrouped(eaten), fmtGrouped(target), fmtGrouped(skipped))
      : K.aria(fmtGrouped(eaten), fmtGrouped(target))
  const bowl = <><DayBowl eatPct={eatPct} skipPct={skipPct} over={over} size={size} />{!plain && <small>{K.budgetLine(fmtGrouped(target))}</small>}</>
  return (
    <div className={cx('fx-bg', plain && 'plain')}>
      {!plain && <div className="fx-bg-n"><b>{fmtGrouped(eaten)}</b><small>{K.eaten}</small></div>}
      {onClick
        ? <button type="button" className="fx-bg-bowl" onClick={onClick} aria-label={label}>{bowl}</button>
        : <span className="fx-bg-bowl" role="img" aria-label={label}>{bowl}</span>}
      {!plain && <div className="fx-bg-n r"><b>{fmtGrouped(Math.abs(rem))}</b>{remLabel != null && <small>{remLabel}</small>}</div>}
    </div>
  )
}

/** A meal poured into the day's bowl (`pour`): faint = what was already in it (`before` %), strong = what this meal adds
 *  (`add` %); `ghost` draws the addition dashed (a draft, not logged yet). Decorative; put a `PourKey` under it. */
export function PourBowl({ before, add, ghost, size = 168 }: { before: number; add: number; ghost?: boolean; size?: number }) {
  const id = useSvgId('fxpb')
  const ya = bowlY(before)
  const yb = bowlY(before + add)
  return (
    <svg className="fx-bowl-svg fx-pour" viewBox={BOWL_VB} style={{ width: size }} aria-hidden="true">
      <defs>
        <clipPath id={id}><path d={BOWL_D} /></clipPath>
        <linearGradient id={`${id}g`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--liq1)" /><stop offset="1" stopColor="var(--liq2)" /></linearGradient>
      </defs>
      <path d={BOWL_D} fill="#fff" stroke="rgba(10,42,60,.10)" strokeWidth="3" />
      <g clipPath={`url(#${id})`}>
        <path d={`${wave(ya)}V110 H-10Z`} fill="color-mix(in srgb,var(--liq2) 42%,#fff)" />
        {add > 0 && (ghost
          ? <path className="ghost" d={`${wave(yb)}V${ya.toFixed(1)} H-10Z`} fill="color-mix(in srgb,var(--liq1) 22%,#fff)" stroke="var(--liq2)" strokeWidth="1.5" strokeDasharray="4 4" />
          : <path className="add" d={`${wave(yb)}V${(ya + 3).toFixed(1)} H-10Z`} fill={`url(#${id}g)`} />)}
      </g>
      <path d={BOWL_D} fill="none" stroke="rgba(255,255,255,.55)" strokeWidth="2" />
    </svg>
  )
}

/** The two-dot key under a `PourBowl` (`pk`): what was in the bowl · what this pours in. */
export function PourKey({ before, add }: { before: ReactNode; add: ReactNode }) {
  return <p className="fx-pk"><span><i className="a" />{before}</span><span><i className="b" />{add}</span></p>
}

/** A window's small cup (`slotCup`): the level is the logged kcal against the window's OWN budget; an overshoot (> 3 %) is
 *  amber. Nothing logged = the dashed budget line and the budget as the number. `neutral` (a gentle-mode day) never says
 *  „over" and leaves the % out of the name. */
export function SlotCup({ kcal, budget, neutral }: { kcal: number; budget: number; neutral?: boolean }) {
  const M = useM()
  const K = M.fuelKozos
  const b = budget > 0 ? budget : 1
  const over = !neutral && kcal > budget * 1.03
  const label = kcal
    ? (neutral ? K.cup.logged(fmtGrouped(kcal), fmtGrouped(budget)) : K.cup.loggedPct(fmtGrouped(kcal), fmtGrouped(budget), Math.round((kcal / b) * 100)))
    : K.cup.budget(fmtGrouped(budget))
  return (
    <span className={cx('fx-cup', over && 'over')} role="img" aria-label={label}>
      <Fill d={BOWL_D} viewBox={BOWL_VB} size={46} pct={kcal ? Math.max(10, Math.min(96, (kcal / b) * 94)) : 0}
        color={over ? 'color-mix(in srgb,var(--fo-warn) 55%,#fff)' : undefined} color2={over ? 'var(--fo-warn)' : undefined}>
        {!kcal && <path d="M30 40H170" stroke="var(--liq2)" strokeWidth="5" strokeDasharray="10 9" opacity=".6" />}
      </Fill>
      <span><b>{fmtGrouped(kcal || budget)}</b><small>{kcal ? `/ ${fmtGrouped(budget)}` : K.budget}</small></span>
    </span>
  )
}

/** The cup's number without a vessel (`plainCup`): a window-less block, a day without a budget. `null` = „—". */
export function PlainCup({ kcal }: { kcal: number | null }) {
  return <span className="fx-cup"><span><b>{kcal == null ? '—' : fmtGrouped(kcal)}</b><small>kcal</small></span></span>
}

/** The pot (`potG`): the Konyha / Műhely vessel. `pct` 0 = the empty pot with its dashed fill line (the invitation). */
export function Pot({ pct, size = 92 }: { pct: number; size?: number }) {
  return (
    <Fill className="fx-pot" d={POT_D} viewBox={POT_VB} size={size} pct={pct ? 4 + clampPct(pct) * 0.66 : 0}>
      <path d="M4 40H14M106 40H116" stroke="rgba(10,42,60,.22)" strokeWidth="7" strokeLinecap="round" />
      <path d="M26 15H94" stroke="rgba(10,42,60,.22)" strokeWidth="7" strokeLinecap="round" />
      <circle cx="60" cy="7" r="5" fill="rgba(10,42,60,.22)" />
      {!pct && <path d="M22 58H98" stroke="var(--liq2)" strokeWidth="2" strokeDasharray="4 5" opacity=".6" />}
    </Fill>
  )
}

/** The water glass (`GLASS`): `pct` of the day's target, the dashed target line at the rim, and — with `nextPct` — the level
 *  the chosen amount would reach. `label` names it (the sheet's „Ma eddig 1,3 / 2,5 liter"). */
export function Glass({ pct, nextPct, size = 104, label }: { pct: number; nextPct?: number | null; size?: number; label?: string }) {
  const y = (p: number) => 4 + 122 * (1 - clampPct(p) * 0.92 / 100)
  return (
    <span className="fx-glass" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <Fill d={GLASS_D} viewBox={GLASS_VB} size={size} pct={clampPct(pct) * 0.92} color="color-mix(in srgb,var(--fx-water) 50%,#fff)" color2="var(--fx-water)">
        <path d="M14 14H86" stroke="var(--fo-ink)" strokeWidth="1.5" strokeDasharray="3 4" opacity=".4" />
        {nextPct != null && <path className="next" d={`M20 ${y(nextPct).toFixed(1)}H80`} stroke="var(--fx-water)" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="5 5" />}
      </Fill>
    </span>
  )
}

const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }

/** A REAL clock face, 12 hours (`dial`) — the one place a circle is allowed (bible §1.4): the recommended window as an arc,
 *  the log / the current time as a dot (white inside the window, amber outside). Times are 'HH:mm'. Decorative. */
export function Dial({ from, to, at, size = 40 }: { from?: string | null; to?: string | null; at?: string | null; size?: number }) {
  const ang = (t: string) => ((toMin(t) % 720) / 720) * 2 * Math.PI - Math.PI / 2
  const pt = (t: string, r: number): [number, number] => [22 + r * Math.cos(ang(t)), 22 + r * Math.sin(ang(t))]
  const win = from && to ? { a: pt(from, 15.5), b: pt(to, 15.5) } : null
  const dot = at ? pt(at, 15.5) : null
  const inWin = !win || (!!at && toMin(at) >= toMin(from!) && toMin(at) <= toMin(to!))
  return (
    <svg className="fx-dial" viewBox="0 0 44 44" style={{ width: size, height: size }} aria-hidden="true">
      <circle cx="22" cy="22" r="20.5" fill="#fff" stroke="rgba(10,42,60,.10)" strokeWidth="1.5" />
      {[0, 1, 2, 3].map((q) => <path key={q} d="M22 6.5V9" transform={`rotate(${q * 90} 22 22)`} stroke="var(--fo-faint)" strokeWidth="1.5" strokeLinecap="round" />)}
      {win && <path className="win" d={`M${win.a[0].toFixed(1)} ${win.a[1].toFixed(1)} A15.5 15.5 0 0 1 ${win.b[0].toFixed(1)} ${win.b[1].toFixed(1)}`} fill="none" stroke="var(--dom)" strokeWidth="4.5" strokeLinecap="round" />}
      {dot && <circle className={inWin ? 'at' : 'at out'} cx={dot[0].toFixed(1)} cy={dot[1].toFixed(1)} r="3.4" fill={inWin ? '#fff' : 'var(--fo-warn)'} stroke={inWin ? 'var(--liq2)' : '#fff'} strokeWidth="1.8" />}
      <circle cx="22" cy="22" r="1.8" fill="var(--fo-ink)" />
    </svg>
  )
}

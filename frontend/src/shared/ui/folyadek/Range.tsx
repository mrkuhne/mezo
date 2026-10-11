import type { ReactNode } from 'react'
import { cx } from './util'

/** A range on a scale: the liquid reaches `lo`, the hatched part runs on to `hi` (the dashed end is the upper bound).
 *  The scale starts at 0 and ends at the next round `step` above `hi`. `pending` = the empty vessel while the numbers
 *  are still being worked out. The numbers under it are the scale's ticks and the range itself; when the range is too
 *  narrow for two labels it is written as one („60–70 perc"). Decorative — say the range in the hero's sentence. */
export function RangeBand(p: { lo?: number; hi?: number; unit?: ReactNode; step?: number; pending?: boolean; className?: string }) {
  if (p.pending || p.lo == null || p.hi == null) {
    return <div className={cx('fo-range', p.className)} aria-hidden="true"><span className="t" /></div>
  }
  const { lo, hi } = p
  const step = p.step ?? 30
  const max = Math.ceil((hi + 8) / step) * step
  const at = (v: number) => (v / max) * 100
  const ticks: number[] = []
  for (let v = 0; v < max; v += step) if (v < lo - 14 || v > hi + 14) ticks.push(v)
  const unit = p.unit != null ? <> {p.unit}</> : null
  return (
    <div className={cx('fo-range', p.className)} aria-hidden="true">
      <span className="t">
        <i style={{ width: `${at(lo)}%` }} />
        <u style={{ left: `${at(lo)}%`, width: `${at(hi - lo)}%` }} />
      </span>
      <span className="ax">
        {ticks.map((v) => <em key={v} className={v === 0 ? 'z' : undefined} style={{ left: `${at(v)}%` }}>{v}</em>)}
        {at(hi - lo) < 16
          ? <em className="k" style={{ left: `${at((lo + hi) / 2)}%` }}>{lo}–{hi}{unit}</em>
          : <><em className="k" style={{ left: `${at(lo)}%` }}>{lo}</em><em className="k" style={{ left: `${at(hi)}%` }}>{hi}{unit}</em></>}
      </span>
    </div>
  )
}

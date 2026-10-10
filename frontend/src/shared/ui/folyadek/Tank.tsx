import type { CSSProperties, ReactNode } from 'react'
import { Wave } from './Wave'
import { clamp, cx } from './util'

export interface TankProps {
  pct: number; num: ReactNode; cap?: string; label?: string; verdict?: ReactNode; marks?: number[]; cta?: string; onCta?: () => void
  /** Vessel height in px (default 372). */
  height?: number
  /** A quiet line under the verdict. */
  air?: ReactNode
  /** `dusk` = the evening liquid. */
  tone?: 'dusk'
  /** Appended inside the vessel (e.g. a `fo-tank-shift` button: it stands 24px above the liquid level). */
  extra?: ReactNode
  /** Makes the whole air area (label + verdict + air) a button. */
  onAir?: () => void
  airLabel?: string
  className?: string
}

/** The big vessel hero (Nap · Mai): verdict in the air, liquid with a big number, optional CTA pill. */
export function Tank(p: TankProps) {
  const long = String(p.num).length > 3
  const numStyle: CSSProperties | undefined = long ? { fontSize: 96, letterSpacing: -5 } : undefined
  const lv = `${clamp(p.pct, p.cta ? 56 : 44, 78)}%`
  const air = (
    <>
      {p.label && <small>{p.label}</small>}
      {p.verdict && <span className="v">{p.verdict}</span>}
      {p.air != null && <span className="fo-tank-airs">{p.air}</span>}
    </>
  )
  return (
    <section className={cx('fo-tank', p.tone === 'dusk' && 'fo-dusk', p.className)} style={{ ...(p.height ? { height: p.height } : {}), '--fo-tank-lv': lv } as CSSProperties}>
      {p.onAir
        ? <button type="button" className="fo-tank-air" onClick={p.onAir} aria-label={p.airLabel}>{air}</button>
        : <div className="fo-tank-air">{air}</div>}
      <div className="fo-tank-liq" style={{ height: lv }}>
        <Wave opacity={0.55} className="b" />
        <Wave />
        <i className="fo-tank-bub" style={{ left: '62%', bottom: '20%', width: 12, height: 12, '--d': '6s' } as CSSProperties} />
        <i className="fo-tank-bub" style={{ left: '78%', bottom: '8%', width: 7, height: 7, '--d': '8s', '--dl': '2s' } as CSSProperties} />
        <i className="fo-tank-bub" style={{ left: '48%', bottom: '12%', width: 9, height: 9, '--d': '7s', '--dl': '1s' } as CSSProperties} />
        {p.marks && <div className="fo-tank-marks">{p.marks.map((m, i) => <span key={i}>{m}</span>)}</div>}
        <div className="fo-tank-n">
          <b style={numStyle}>{p.num}</b>
          {p.cap && <small>{p.cap}</small>}
        </div>
      </div>
      {p.cta && <button type="button" className="fo-tank-cta" onClick={p.onCta}>{p.cta}<i>→</i></button>}
      {p.extra}
    </section>
  )
}

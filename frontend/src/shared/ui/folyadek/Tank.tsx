import type { CSSProperties, ReactNode } from 'react'
import { Wave } from './Wave'
import { clamp, cx, type PassProps } from './util'

export interface TankProps extends PassProps {
  pct: number; num: ReactNode; cap?: string; label?: string; verdict?: ReactNode; marks?: number[]; cta?: string; onCta?: () => void
  /** The CTA pill stays in place but does not answer. */
  ctaDisabled?: boolean
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

/** The big vessel hero (Nap · Mai): verdict in the air, liquid with a big number, optional CTA pill. `id`, `role`, `aria-*`, `data-*` land on the vessel. */
export function Tank({ pct, num, cap, label, verdict, marks, cta, onCta, ctaDisabled, height, air: airLine, tone, extra, onAir, airLabel, className, ...rest }: TankProps) {
  const long = String(num).length > 3
  const numStyle: CSSProperties | undefined = long ? { fontSize: 96, letterSpacing: -5 } : undefined
  const lv = `${clamp(pct, cta ? 56 : 44, 78)}%`
  const air = (
    <>
      {label && <small>{label}</small>}
      {verdict && <span className="v">{verdict}</span>}
      {airLine != null && <span className="fo-tank-airs">{airLine}</span>}
    </>
  )
  return (
    <section className={cx('fo-tank', tone === 'dusk' && 'fo-dusk', className)} style={{ ...(height ? { height } : {}), '--fo-tank-lv': lv } as CSSProperties} {...rest}>
      {onAir
        ? <button type="button" className="fo-tank-air" onClick={onAir} aria-label={airLabel}>{air}</button>
        : <div className="fo-tank-air">{air}</div>}
      <div className="fo-tank-liq" style={{ height: lv }}>
        <Wave opacity={0.55} className="b" />
        <Wave />
        <i className="fo-tank-bub" style={{ left: '62%', bottom: '20%', width: 12, height: 12, '--d': '6s' } as CSSProperties} />
        <i className="fo-tank-bub" style={{ left: '78%', bottom: '8%', width: 7, height: 7, '--d': '8s', '--dl': '2s' } as CSSProperties} />
        <i className="fo-tank-bub" style={{ left: '48%', bottom: '12%', width: 9, height: 9, '--d': '7s', '--dl': '1s' } as CSSProperties} />
        {marks && <div className="fo-tank-marks">{marks.map((m, i) => <span key={i}>{m}</span>)}</div>}
        <div className={cx('fo-tank-n', marks && 'has-marks')}>
          <b style={numStyle}>{num}</b>
          {cap && <small>{cap}</small>}
        </div>
      </div>
      {cta && <button type="button" className="fo-tank-cta" onClick={onCta} disabled={ctaDisabled}>{cta}<i>→</i></button>}
      {extra}
    </section>
  )
}

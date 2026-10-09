import type { CSSProperties, ReactNode } from 'react'
import { Wave } from './Wave'
import { clamp } from './util'

/** The big vessel hero (Nap · Mai): verdict in the air, liquid with a big number, optional CTA pill. */
export function Tank(p: { pct: number; num: ReactNode; cap?: string; label?: string; verdict?: ReactNode; marks?: number[]; cta?: string; onCta?: () => void }) {
  const long = String(p.num).length > 3
  const numStyle: CSSProperties | undefined = long ? { fontSize: 96, letterSpacing: -5 } : undefined
  return (
    <section className="fo-tank">
      <div className="fo-tank-air">
        {p.label && <small>{p.label}</small>}
        {p.verdict && <p>{p.verdict}</p>}
      </div>
      <div className="fo-tank-liq" style={{ height: `${clamp(p.pct, p.cta ? 56 : 44, 78)}%` }}>
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
    </section>
  )
}

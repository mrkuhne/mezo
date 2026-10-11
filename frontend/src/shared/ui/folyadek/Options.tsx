import type { CSSProperties, ReactNode } from 'react'
import { clamp, cx } from './util'

export interface OptionVessel { label: ReactNode; /** How full the answer is, 0–100. */ pct: number; /** The liquid of this answer (state colours for a pain scale); default the domain. */ color?: string }

/** A short answer scale as small vessels: each option is a vessel filled to what the answer MEANS, the chosen one in
 *  full colour. `line` = a dashed waterline across every vessel (the „just right" level). One of them is pressed. */
export function OptionVessels(p: { items: OptionVessel[]; value: number | null; onChange: (index: number) => void; line?: number; 'aria-label': string; className?: string }) {
  return (
    <div className={cx('fo-vo', p.className)} role="group" aria-label={p['aria-label']}>
      {p.items.map((o, i) => (
        <button key={i} type="button" className={p.value === i ? 'on' : undefined} aria-pressed={p.value === i} onClick={() => p.onChange(i)}
          style={{ '--p': `${clamp(o.pct)}%`, '--c': o.color ?? 'var(--dom)' } as CSSProperties}>
          <span className="v" aria-hidden="true"><i />{p.line != null && <u style={{ bottom: `${clamp(p.line)}%` }} />}</span>
          <b>{o.label}</b>
        </button>
      ))}
    </div>
  )
}

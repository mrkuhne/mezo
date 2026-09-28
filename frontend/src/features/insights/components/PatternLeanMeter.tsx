// ============================================================
// Mezo · PatternLeanMeter — a „merre húz" mérő és a nap-pipák (mezo-rstt7, prototypes/uveg-minta.html).
// A pötty a mostani támogatottságnál (`support`) ül, a sáv a 90%-os intervallumot (`lo`–`hi`)
// mutatja; egy szellem-pötty a megerősítéskori állást jelzi, ha van `then`. A pipák a gyűjtött
// napokat világítják ki a szükséges napszámból.
// ============================================================
import type { CSSProperties } from 'react'
import { leanSideOf, type Lean } from '@/features/insights/logic/patternReading'

const pos = (s: number) => `${(50 + 50 * Math.max(-1, Math.min(1, s))).toFixed(1)}%`
const SIDE = ['Épp fordítva', 'Nincs hatás', 'Igaz rád'] as const

/** `side` az olvasat állapotából jön (`leanSide`), nem egy saját küszöbből — így a kiemelt
 *  felirat sosem mond mást, mint a válasz-szó. */
export function PatternLeanMeter({ now, then, side }: { now: Lean; then: Lean | null; side: 0 | 1 | 2 }) {
  // a képolvasó a szellem-pöttyöt is hallja: a döntéskori oldal ugyanabból az osztályozásból jön
  const label = `Merre húz az adat: ${SIDE[side].toLowerCase()}`
    + (then ? `. Amikor megerősítetted: ${SIDE[leanSideOf(then)].toLowerCase()}.` : '')
  return (
    <div className={`pmx-meter${then ? ' has-ghost' : ''}`} role="img" aria-label={label}>
      <div className="pmx-trk">
        <i className="pmx-mid" />
        <i className="pmx-band" style={{ '--lo': pos(now.lo), '--hi': pos(now.hi) } as CSSProperties} />
        {then && <>
          <i className="pmx-ghost" data-testid="lean-then" style={{ '--x': pos(then.support) } as CSSProperties} />
          <span className="pmx-ghost-l" style={{ '--x': pos(then.support) } as CSSProperties}>amikor megerősítetted</span>
        </>}
        <i className="pmx-dot" data-testid="lean-now" style={{ '--x': pos(now.support) } as CSSProperties} />
      </div>
      <div className="pmx-lbls">{SIDE.map((l, i) => <span key={l} className={i === side ? 'on' : undefined}>{l}</span>)}</div>
      <p className="pmx-how">A pötty: amit most látok. A sáv: ennyit billeghet még — minél több nap, annál keskenyebb.</p>
    </div>
  )
}

export function PatternDayPips({ count, of }: { count: number; of: number }) {
  return (
    <div className="pmx-pips-wrap" role="img" aria-label={`${count} nap a ${of}-ból`}>
      <div className="pmx-pips">{Array.from({ length: of }, (_, i) => <i key={i} className={i < count ? 'on' : undefined} />)}</div>
      <div className="pmx-pips-l"><span><b>{count}</b> / {of} nap</span><span>még {Math.max(0, of - count)} nap</span></div>
    </div>
  )
}

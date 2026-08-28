// ============================================================
// Mezo · AnchorIsland — the „rough day" melt content (mezo-euze).
// The AnchorModeView successor: `?day=rough` no longer swaps to a
// separate full-screen view — this component's content fills the whole
// panel instead (wrapped in a constant `DaypartPanel tone="reggel"` by
// TodayPage, mezo-puci — see ADR 0025 §9's anchor-tone gotcha). Same
// three anchors, same companion voice; this is the ONE place a
// greeting-tone sentence survives on Today, because the warmth IS the
// mode. The anchor rows are demo affordances (no handler yet — Phase-3
// signal work): ticking one only flips it locally.
// ============================================================
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CoachBubble } from '@/shared/ui/CoachBubble'
import { ItemRow } from '@/shared/ui/ItemRow'

const anchors: { label: string; sub: string; emoji: string }[] = [
  { label: 'Egy pohár víz', sub: 'Most. Egyszerű kezdet.', emoji: '💧' },
  { label: 'Egy fehérje-étkezés', sub: 'Bármi. 30g protein elég.', emoji: '🍳' },
  { label: '10 perces sétálás', sub: 'Friss levegő. Nem futás.', emoji: '🚶' },
]

export function AnchorIsland() {
  const navigate = useNavigate()
  const [ticked, setTicked] = useState<Set<number>>(new Set())

  return (
    // `.anch-melt` — this is the melt's OWN horizontal-inset scope (pre-merge review Finding 1):
    // the retired `.isl-bigview` shell used to give these bare `.isl-*` elements their 16px rail
    // via `.dayview`'s old padding; now that the rail lives on each `.td-*` element instead, this
    // wrapper carries it directly so the fix cannot leak onto Fuel's "Mai" window flow, which
    // renders the SAME `.isl-*` classes through `shared/ui/Island`'s `.isl-bigview` shell.
    <div className="anch-melt">
      <div className="isl-openhead">🫧 Horgony mód · csendben</div>
      <CoachBubble eyebrow="Mezo" className="anch-coach">
        Nehéz nap — ma elég a minimum. Itt vagyok.
      </CoachBubble>
      <div className="isl-hero-v">
        3<span className="isl-hero-u">apró horgony</span>
      </div>
      <div className="isl-hero-sub">Semmi lista, semmi elvárás — csak ami jólesik.</div>
      <div className="isl-anchor-rows">
        {anchors.map((a, i) => (
          <ItemRow
            key={a.label}
            tone="mind"
            emoji={a.emoji}
            title={a.label}
            subtitle={a.sub}
            done={ticked.has(i)}
            actionLabel={ticked.has(i) ? undefined : 'Megvolt ✓'}
            onAction={ticked.has(i) ? undefined : () => setTicked((s) => new Set(s).add(i))}
          />
        ))}
      </div>
      <div className="isl-act">
        <button type="button" className="isl-more" onClick={() => navigate('/nap')}>
          Kilépés a horgony módból
        </button>
      </div>
    </div>
  )
}

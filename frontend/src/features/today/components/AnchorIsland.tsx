// ============================================================
// Mezo · AnchorIsland — the „rough day" melt content (mezo-euze).
// The AnchorModeView successor: `?day=rough` no longer swaps to a
// separate full-screen view — the three islands collapse and this one
// warm island fills the sky (IslandSky's `anchor` state). Same three
// anchors, same companion voice; this is the ONE place a greeting-tone
// sentence survives on Today, because the warmth IS the mode. The
// anchor rows are demo affordances (no handler yet — Phase-3 signal
// work): ticking one only flips it locally.
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
    <>
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
        <button type="button" className="isl-more" onClick={() => navigate('/today')}>
          Kilépés a horgony módból
        </button>
      </div>
    </>
  )
}

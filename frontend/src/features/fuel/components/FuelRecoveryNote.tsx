// ============================================================
// Mezo · FuelRecoveryNote + FuelRecoveryStrip — the two quiet signs of a kímélő day on the
// Fuel Mai when the day still has a (maintenance / estimate) keret (Kihagyás S3, mezo-q4xt2.3;
// prototype elo/fuel.html `kmStrip` / `kmNote`). Both are flat lavender rows, never glass —
// they sit beside the hero's own instrument. Nothing here is red or amber, and nothing grades.
// ============================================================
import { Icon3D, type Icon3DName } from '@/shared/ui/clay'
import type { SkipReason } from '@/features/train/logic/plannedSkips'

const WHO: Partial<Record<SkipReason, string>> = {
  ILLNESS: 'Beteg vagy', STOMACH: 'Gyomorrontás', INJURY: 'Sérülés', TRAVEL: 'Úton vagy',
}

/** The slim „Kímélő mód · Sérülés · 2. nap" strip above the hero (MAINTENANCE / ESTIMATE). */
export function FuelRecoveryStrip({ category, day, onTap }: {
  category: SkipReason | null
  day: number | null
  /** The strip only explains where the mode is closed (the Nap page) — it is a button, not a switch. */
  onTap: () => void
}) {
  const who = category ? WHO[category] : null
  return (
    <button type="button" className="fmx-kmstrip" onClick={onTap}
      aria-label={`Kímélő mód${who ? `, ${who}` : ''}${day != null ? `, ${day}. nap` : ''}`}>
      <Icon3D name="t-kimelo" size={26} />
      <span><b>Kímélő mód</b>{who ? ` · ${who}` : ''}{day != null ? ` · ${day}. nap` : ''}</span>
      <b aria-hidden="true">›</b>
    </button>
  )
}

const NOTE: Record<'MAINTENANCE' | 'ESTIMATE', { icon: Icon3DName; title: string; body: string; foot?: string }> = {
  MAINTENANCE: {
    icon: 't-pain',
    title: 'Sérülés alatt nem fogyókúrázunk',
    body: 'A hiányt kikapcsoltam: szinten tartó keretet látsz. A fehérje most a legfontosabb, abból épül vissza a szövet.',
    foot: 'Ez nem orvosi tanács.',
  },
  ESTIMATE: {
    icon: 't-travel',
    title: 'Úton vagy, becsülj nyugodtan',
    body: 'Elég nagyjából beírni, a keret most csak tájékoztat. Ha egy dologra figyelsz, a fehérje legyen.',
  },
}

export function FuelRecoveryNote({ mode }: { mode: 'MAINTENANCE' | 'ESTIMATE' }) {
  const n = NOTE[mode]
  return (
    <div className="fmx-kmnote">
      <Icon3D name={n.icon} size={34} />
      <span><b>{n.title}</b>{n.body}{n.foot && <em>{n.foot}</em>}</span>
    </div>
  )
}

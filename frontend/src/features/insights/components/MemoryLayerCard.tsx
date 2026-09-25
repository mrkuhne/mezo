import { Icon3D, type Icon3DName } from '@/shared/ui/clay'
import { cn } from '@/shared/lib/cn'

/** A négy réteg saját akcentje (üveg, mezo-me75u.8): L0 borostyán, L1 ég, L2 korall, L3 levendula. */
export type MemoryLayerTone = 'amber' | 'sky' | 'coral' | 'lav'

const TONE_COLOR: Record<MemoryLayerTone, string> = {
  amber: 'var(--dv-amber)',
  sky: 'var(--dv-sky)',
  coral: 'var(--dv-coral)',
  lav: 'var(--dv-lav)',
}

interface MemoryLayerCardProps {
  tone: MemoryLayerTone
  icon: Icon3DName
  eyebrow: string
  /** A réteg egysoros neve az eyebrow alatt. */
  title: string
  /** A nagy szám — a mértékegység külön, halkan (unit). */
  big: string
  unit: string
  chips: string[]
  /** rise-stagger késleltetés (prototípus: 0/60/120/180 ms) */
  delayMs: number
  onOpen?: () => void
}

/** Egy memória-réteg üvegkártyája (mezo-me75u.8, prototípus `.layer.glass`): saját akcent,
 *  3D ikon világító kútban, eyebrow + cím, jobbra a nagy szám, alatta lapos chip-sor;
 *  koppintható, ha a rétegnek saját felülete van. Viselkedés (tap/Enter/Space) változatlan. */
export function MemoryLayerCard({ tone, icon, eyebrow, title, big, unit, chips, delayMs, onOpen }: MemoryLayerCardProps) {
  return (
    <div
      className={cn('mmr-layer glass', `mmr-t-${tone}`, 'rise', onOpen && 'np-press')}
      style={{ '--c': TONE_COLOR[tone], '--d': `${delayMs}ms`, '--i': delayMs / 60, cursor: onOpen ? 'pointer' : undefined } as React.CSSProperties}
      onClick={onOpen}
      role={onOpen ? 'button' : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onKeyDown={onOpen ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen() } } : undefined}
    >
      <div className="mmr-layrow">
        <span className="uv-well mmr-well"><Icon3D name={icon} size={30} /></span>
        <div className="mmr-laygrow">
          <span className="uv-eyebrow mmr-eb">{eyebrow}</span>
          <strong className="mmr-laytitle">{title}</strong>
        </div>
        <div className="mmr-bignm">{big}<small className="mmr-unit">{unit}</small></div>
      </div>
      {chips.length > 0 && (
        <div className="mmr-chips">
          {chips.map((chip) => <span key={chip}>{chip}</span>)}
        </div>
      )}
    </div>
  )
}

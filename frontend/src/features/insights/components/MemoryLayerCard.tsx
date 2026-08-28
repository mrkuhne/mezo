import { ClayIcon, type ClayIconName } from '@/shared/ui/clay'
import { cn } from '@/shared/lib/cn'

/** A négy réteg-wash — a prototípus .laycard c-sand/c-gold/c-coral/c-lav skálája. */
export type MemoryLayerTone = 'sand' | 'gold' | 'coral' | 'lav'

interface MemoryLayerCardProps {
  tone: MemoryLayerTone
  icon: ClayIconName
  eyebrow: string
  /** A nagy szám (mem-bignm) — a mértékegység külön, halkan (unit). */
  big: string
  unit: string
  chips: string[]
  /** rise-stagger késleltetés (prototípus: 0/60/120/180 ms) */
  delayMs: number
  onOpen?: () => void
}

/** Egy memória-réteg SZÍNES kártyája (mezo-d20.5.7) — a prototípus .laycard arca:
 *  réteg-wash + clay ikon-korong + eyebrow + nagy szám + chip-sor; koppintható,
 *  ha a rétegnek saját felülete van. Viselkedés (tap/Enter/Space) változatlan. */
export function MemoryLayerCard({ tone, icon, eyebrow, big, unit, chips, delayMs, onOpen }: MemoryLayerCardProps) {
  return (
    <div
      className={cn('mem-laycard', `mem-t-${tone}`, 'rise', onOpen && 'np-press')}
      style={{ '--d': `${delayMs}ms`, cursor: onOpen ? 'pointer' : undefined } as React.CSSProperties}
      onClick={onOpen}
      role={onOpen ? 'button' : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onKeyDown={onOpen ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen() } } : undefined}
    >
      <div className="mem-layrow">
        <span className="mem-lic"><ClayIcon name={icon} size={24} /></span>
        <div className="mem-laygrow">
          <span className="mz-eyebrow">{eyebrow}</span>
          <div className="mem-bignm">{big}<span className="mem-unit">{unit}</span></div>
        </div>
      </div>
      <div className="mem-chips">
        {chips.map((chip) => <span key={chip}>{chip}</span>)}
      </div>
    </div>
  )
}

// ============================================================
// Mezo · Mozaik 2.0 primitives (design_2.0 — mezo-d20.1.3)
// The tile language every redesigned page speaks: one long hero
// tile per panel + a 2-column mosaic; tile anatomy = eyebrow +
// clay spot + one datum; tile → own full page (slide-in scaffold
// with a colored hero zone, ‹ back chip and a quiet principle
// line); stat strip; tinted mini-cells; thin collapsible strips.
// CSS lives in styles/prototype.css §Mozaik — values are the
// prototype's (en/nap/session heads), ×1.18 (330→390px frame).
// ============================================================
import { useId, useState, type ReactNode } from 'react'
import { cn } from '@/shared/lib/cn'
import { ClayIcon, ClaySpot, type ClayIconName, type ClaySpotName } from '@/shared/ui/clay'

/** Domain washes — Mozaik 2.0 relaxation: domain color ON the tile (handoff §10). */
export type MozaikWash =
  | 'coral'   // Edzés / Mezo warmth       (prototype .t-train / .t-mezo)
  | 'sage'    // Fuel / done               (.t-stack, .alldone)
  | 'sky'     // Futás / water             (.t-water)
  | 'gold'    // reward / habits morning   (.t-hab, .t-quest)
  | 'lav'     // Me / Insights             (.t-habe, .t-minta)
  | 'rose'    // Sport / check-in          (.t-check)
  | 'white'   // neutral                   (.t-vital)
  | 'most'    // the NOW focus card        (.t-most — coral ring + colored shadow)

interface TileProps {
  wash: MozaikWash
  /** Optional: the prototype's Kreed tile carries prose instead of a spot. */
  icon?: ClayIconName
  /** The mosaic spot is 40px in the 330px prototype frame → 47 at ×1.18. A handful of
   *  tiles use 38 or 42 there; those pass their own size rather than the whole set drifting. */
  iconSize?: number
  eyebrow: string
  line?: ReactNode
  /** unread/attention badge dot (coral) */
  dot?: boolean
  /** A COUNT rides here (the prototype's `.badge.unread`), where `dot` is the bare
   *  attention mark. Never render both — a number already says there is something. */
  badge?: ReactNode
  /** entrance-stagger delay; the choreography trigger itself is the motion kit's job (F0.4) */
  delayMs?: number
  onClick?: () => void
  className?: string
  children?: ReactNode
  'aria-label'?: string
  /** Full-bleed row tile spanning both mosaic columns (the Mezo hub's Diagnózis precedent). */
  wide?: boolean
}

export function Tile({ wash, icon, iconSize = 47, eyebrow, line, dot, badge, delayMs, onClick, className, children, wide, ...rest }: TileProps) {
  const cls = cn('mz-tile', `mz-w-${wash}`, 'rise', wide && 'mz-tile-wide mz-tile-row', className)
  const style = delayMs !== undefined ? ({ '--d': `${delayMs}ms` } as React.CSSProperties) : undefined
  const inner = wide ? (
    <>
      {icon && <div className="mz-spotwrap"><ClayIcon name={icon} size={iconSize} /></div>}
      <div className="mz-tile-body">
        <div className="mz-tile-top"><span className="mz-eyebrow">{eyebrow}</span></div>
        {line !== undefined && <div className="mz-tile-line">{line}</div>}
      </div>
      <span className="mz-chev" aria-hidden="true">›</span>
    </>
  ) : (
    <>
      <div className="mz-tile-top">
        <span className="mz-eyebrow">{eyebrow}</span>
        {badge !== undefined ? <span className="mz-badge">{badge}</span>
          : dot ? <span className="mz-dot" aria-hidden="true" /> : null}
      </div>
      {icon && <div className="mz-spotwrap"><ClayIcon name={icon} size={iconSize} /></div>}
      {line !== undefined && <div className="mz-tile-line">{line}</div>}
      {children}
    </>
  )
  if (onClick) {
    return (
      <button type="button" className={cls} style={style} onClick={onClick} aria-label={rest['aria-label'] ?? eyebrow}>
        {inner}
      </button>
    )
  }
  return <div className={cls} style={style}>{inner}</div>
}

/** The 2-column tile grid. One long hero tile per panel lives OUTSIDE the mosaic. */
export function Mosaic({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('mz-mosaic', className)}>{children}</div>
}

export function StatStrip({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('mz-statstrip', className)}>{children}</div>
}

export function StatCell({ value, label, over }: {
  value: ReactNode
  label: string
  /** Over its cap — the prototype's dashed cell (a flag, never a red alarm). */
  over?: boolean
}) {
  return (
    <div className={cn('mz-statcell', over && 'mz-statcell-over')}>
      <b>{value}</b>
      <small>{label}</small>
    </div>
  )
}

export type MCellTone = 'sage' | 'coral' | 'amber' | 'lav' | 'sky' | 'rose' | 'gold'
export interface MCell { label: string; value: ReactNode; tone: MCellTone }

/** Tinted mini-cell row — the `.mcells` recipe (macro cells, provenance cells…). */
export function MCells({ cells, className }: { cells: MCell[]; className?: string }) {
  return (
    <div className={cn('mz-mcells', className)}>
      {cells.map((c, i) => (
        <span key={i} className={`mz-c-${c.tone}`}>
          <b>{c.value}</b>
          <small>{c.label}</small>
        </span>
      ))}
    </div>
  )
}

export type PageTone = 'coral' | 'gold' | 'lav' | 'rose' | 'sage' | 'sky'

/** Tile → own full page: the Huawei-pattern scaffold. Routing stays the caller's
 *  concern — this provides the visual anatomy (tone gradient, head, hero, body). */
export function MozaikPage({ tone, children, className }: { tone: PageTone; children: ReactNode; className?: string }) {
  return <div className={cn('mz-page', `mz-p-${tone}`, className)}>{children}</div>
}

export function PageHead({ onBack, label = '‹ vissza', children }: { onBack: () => void; label?: string; children?: ReactNode }) {
  return (
    <div className="mz-page-head">
      <button type="button" className="mz-backbtn" onClick={onBack} aria-label="Vissza">
        {label}
      </button>
      {children}
    </div>
  )
}

interface PageHeroProps {
  icon?: ClayIconName
  /** A clay SPOT (s-*) instead of an icon — Skillek (s-hajtas) / Kitüntetések (s-medal) heroes. */
  spot?: ClaySpotName
  /** The prototypes size a hero spot per page (54 and 72 are both common, 48–92 across the
   *  set), so there is no single faithful default — a page that has been checked against its
   *  prototype passes the scaled value. 45 is what every page shipped with. */
  iconSize?: number
  big?: ReactNode
  name: string
  sub?: string
  children?: ReactNode
  /** Kalauz-horgony (mezo-gb1s.6) — a hős a legtöbb aloldalon az EGYETLEN feltétel nélkül
   *  renderelő elem, tehát a „Mutasd meg a képernyőn" gomb csak rajta tud őszintén állni.
   *  Ugyanaz az idióma, mint a `DayStrip` `kalauzAnchor` propja (mezo-gb1s.5). */
  kalauzAnchor?: string
}

/** Subpage hero recipe (session rounds): title, then icon + big number in ONE row, no subtitle theater. */
export function PageHero({ icon, spot, iconSize = 45, big, name, sub, children, kalauzAnchor }: PageHeroProps) {
  return (
    <div className="mz-page-hero" data-kalauz-anchor={kalauzAnchor}>
      <div className="mz-hero-nm">{name}</div>
      <div className="mz-hero-row">
        {spot && <ClaySpot name={spot} size={iconSize} />}
        {icon && <ClayIcon name={icon} size={iconSize} />}
        {big !== undefined && <span className="mz-bignum">{big}</span>}
      </div>
      {sub && <div className="mz-hero-sb">{sub}</div>}
      {children}
    </div>
  )
}

export function PageBody({ children, principle, className }: { children: ReactNode; principle?: string; className?: string }) {
  return (
    <div className={cn('mz-page-body', className)}>
      {children}
      {principle && <p className="mz-principle">{principle}</p>}
    </div>
  )
}

interface CollapsibleStripProps {
  eyebrow: string
  /** the informative closed-header summary — the strip must already tell the story closed */
  summary?: ReactNode
  chip?: ReactNode
  defaultOpen?: boolean
  children: ReactNode
  className?: string
}

/** Thin reference strip — "a kártyán logolsz, a sávokban utánanézel" (session rounds). */
export function CollapsibleStrip({ eyebrow, summary, chip, defaultOpen = false, children, className }: CollapsibleStripProps) {
  const [open, setOpen] = useState(defaultOpen)
  const bodyId = useId()
  return (
    <div className={cn('mz-colstrip', open && 'open', className)}>
      <button type="button" className="mz-colhead" aria-expanded={open} aria-controls={bodyId} onClick={() => setOpen(o => !o)}>
        <span className="mz-eyebrow">{eyebrow}</span>
        {chip}
        {summary !== undefined && <span className="mz-csum">{summary}</span>}
        <span className="mz-chev" aria-hidden="true">▾</span>
      </button>
      <div className="mz-colbody" id={bodyId} hidden={!open}>
        {children}
      </div>
    </div>
  )
}

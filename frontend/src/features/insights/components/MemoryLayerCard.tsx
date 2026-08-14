interface MemoryLayerCardProps {
  eyebrow: string
  title: string
  big: string
  stats: string[]
  /** A réteg accent-színe (UI-spec §1) — eyebrow + bal csík + chip-szín. */
  accent: string
  /** A réteg wash-háttere (UI-spec §1). */
  wash: string
  last?: string | null
  onOpen?: () => void
}

/** Egy memória-réteg kártyája (érés-oszlop, UI-spec §2) — wash-háttér + 4px accent-csík; koppintható, ha a rétegnek saját felülete van. */
export function MemoryLayerCard({ eyebrow, title, big, stats, accent, wash, last, onOpen }: MemoryLayerCardProps) {
  return (
    <div
      className={onOpen ? 'card np-press' : 'card'}
      style={{ padding: '14px 14px 14px 18px', cursor: onOpen ? 'pointer' : undefined,
        background: wash, position: 'relative', overflow: 'hidden' }}
      onClick={onOpen}
      role={onOpen ? 'button' : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onKeyDown={onOpen ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen() } } : undefined}
    >
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: accent }} />
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="eyebrow" style={{ color: accent }}>{eyebrow}</span>
        {last && <span className="eyebrow text-tertiary">utoljára: {last}</span>}
      </div>
      <div style={{ fontFamily: 'var(--ff-display)', fontSize: 15, marginTop: 6, color: 'var(--text-primary)' }}>
        {title}
      </div>
      <div style={{ fontFamily: 'var(--ff-display)', fontSize: 28, fontWeight: 600, marginTop: 4, color: 'var(--text-primary)' }}>
        {big}
      </div>
      <div className="row gap-sm" style={{ marginTop: 8, flexWrap: 'wrap' }}>
        {stats.map((stat) => (
          <span key={stat} className="chip" style={{ fontSize: 9, color: accent }}>{stat}</span>
        ))}
      </div>
    </div>
  )
}

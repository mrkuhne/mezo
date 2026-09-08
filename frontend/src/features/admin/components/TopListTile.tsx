import { Link } from 'react-router-dom'

// TopListTile (mezo-m079 Task 2) — the shared "top-N with an összes →" card behind every
// Pulzus top list (kik viszik a költést, mire megy a pénz, csendes tesztelők) and later
// slices' feature scorecards. `share` (0..1) drives the bar width; `topNFromEntries`
// (adminViz.ts) is the one place that computes it, this component only renders it.
export interface TopRow {
  key: string
  label: string
  sub?: string
  value: string
  share: number
  to?: string
}

export function TopListTile({
  title,
  eyebrow,
  rows,
  moreLabel,
  moreTo,
  unit,
  emptyLabel = 'Nincs adat.',
}: {
  title: string
  eyebrow: string
  rows: TopRow[]
  moreLabel: string
  moreTo: string
  unit?: string
  /** Override the generic "Nincs adat." empty copy — a list whose emptiness is itself good
   *  news (mezo-m079 Task 3's "Csendes tesztelők": nobody quiet) needs its own honest phrasing. */
  emptyLabel?: string
}) {
  return (
    <div className="ad-top">
      <div className="ad-eyebrow">{eyebrow}</div>
      <h3>{title}</h3>
      {rows.length === 0 ? (
        <div className="ad-top-empty">{emptyLabel}</div>
      ) : (
        rows.map((row, i) => {
          const body = (
            <>
              <span className="rank">{i + 1}.</span>
              <div className="info">
                <div className="lb">{row.label}</div>
                {row.sub && <div className="sub">{row.sub}</div>}
                <div className="sharebar"><i style={{ transform: `scaleX(${row.share})` }} /></div>
              </div>
              <span className="val">{row.value}{unit ? ` ${unit}` : ''}</span>
            </>
          )
          return row.to ? (
            <Link key={row.key} to={row.to} className="ad-toprow">{body}</Link>
          ) : (
            <div key={row.key} className="ad-toprow">{body}</div>
          )
        })
      )}
      <Link to={moreTo} className="ad-more">{moreLabel}</Link>
    </div>
  )
}

import { Link } from 'react-router-dom'

// TopListTile (mezo-m079 Task 2, fix round 1) — the shared "top-N with an összes →" card
// behind every Pulzus top list (kik viszik a költést, mire megy a pénz, csendes tesztelők) and
// later slices' feature scorecards. Ported verbatim from the approved Pulzus mockup's `.ad-top`
// block (prototype.css's own comment) — that block has NO heading of its own; the caption is
// the ENCLOSING tile's eyebrow (AdminTile's `eyebrow` prop). Fix round 1: a first version of
// this component additionally rendered its own `.ad-eyebrow` + `<h3>` inside `.ad-top`, and the
// page passed the same/overlapping text to both — three renders of the same caption on screen.
// Removed both; `title` survives only as the card's accessible name (`aria-label`), invisible.
//
// `share` (0..1) drives the bar width when present; `topNFromEntries` (adminViz.ts) is the one
// place that computes it. A row can omit `share` entirely (undefined) for a bar-less variant —
// "Csendes tesztelők"'s day counts aren't a share of anything, so a bar there would be a lie.
// `tone` colors the value text instead (`warn` for an actual quiet-day count, `mut` for the
// honest "még nem aktív" rows — never a fabricated day count for a user who has never been seen).
export interface TopRow {
  key: string
  label: string
  sub?: string
  value: string
  share?: number
  tone?: 'warn' | 'mut'
  to?: string
}

export function TopListTile({
  title,
  rows,
  moreLabel,
  moreTo,
  unit,
  emptyLabel = 'Nincs adat.',
}: {
  /** The card's accessible name (rendered as `aria-label`, not visible text — the visible
   *  caption is the enclosing AdminTile's own eyebrow; see the file-level comment). */
  title: string
  rows: TopRow[]
  moreLabel: string
  moreTo: string
  unit?: string
  /** Override the generic "Nincs adat." empty copy — a list whose emptiness is itself good
   *  news (mezo-m079 Task 3's "Csendes tesztelők": nobody quiet) needs its own honest phrasing. */
  emptyLabel?: string
}) {
  return (
    <div className="ad-top" aria-label={title}>
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
                {row.share !== undefined && (
                  <div className="sharebar"><i style={{ transform: `scaleX(${row.share})` }} /></div>
                )}
              </div>
              <span className={row.tone ? `val ${row.tone}` : 'val'}>{row.value}{unit ? ` ${unit}` : ''}</span>
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

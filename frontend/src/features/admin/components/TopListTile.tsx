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
// `share` (0..1) drives the bar's resting WIDTH when present (fix round 2: an inline
// `transform: scaleX(share)` does NOT work here — `.mz-play .ad-toprow .sharebar i`'s `adGrow`
// entrance animation ends at `transform: scaleX(1)` with fill-mode `both`, which permanently
// overrides any inline `transform` the instant the animation plays, so every bar rendered full
// width regardless of `share`. `width` is a different property: the animation only ever touches
// `transform`, so setting the resting size via `width` composes with the entrance's
// `scaleX(0→1)` instead of being clobbered by it — the same fix already used by `.ad-bar i`
// (AdminUserDetailPage's footprint bars); see prototype.css's `adGrow`/"nyugalmi állapot MINDIG
// a végállapot" rule). `topNFromEntries` (adminViz.ts) is the one place that computes `share`.
// A row can omit `share` entirely (undefined) for a bar-less variant — "Csendes tesztelők"'s day
// counts aren't a share of anything, so a bar there would be a lie. `tone` colors the value text
// instead (`warn` for an actual quiet-day count, `mut` for the honest "még nem aktív" rows —
// never a fabricated day count for a user who has never been seen).
//
// Fix round 1 (mezo-kxnn): `moreTo`/`moreLabel` are optional — a caller whose "teljes lista"
// affordance is a `CollapsibleStrip` (not a drill-through route) renders no footer link at all,
// rather than being forced to invent a fake `moreTo` target or hand-roll its own `.ad-top` markup.
//
// Fix round 1 (mezo-3u4r): `missing` marks a row whose `label` came from an undictionaried key
// (`featureLabel(key).missing`) — a raw slug rendering bare (no visible signal that it isn't a
// real Hungarian label) is exactly the completeness gate `labels.completeness.test.ts` exists to
// prevent everywhere ELSE on the admin surface; this closes the one gap the top-list pipeline
// left (`costMatrixTotals`/`AdminCostPage`'s `featureEntries` both propagate it into `AdminVizEntry`,
// `topNFromEntries` carries it through unchanged). Omitted/false ⇒ no visible change.
export interface TopRow {
  key: string
  label: string
  sub?: string
  value: string
  share?: number
  tone?: 'warn' | 'mut'
  to?: string
  missing?: boolean
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
  /** Both omitted together renders no footer link (see the file-level fix-round-1 comment). */
  moreLabel?: string
  moreTo?: string
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
                <div className="lb">
                  {row.label}
                  {row.missing && <span className="ad-mut"> (nincs címke)</span>}
                </div>
                {row.sub && <div className="sub">{row.sub}</div>}
                {row.share !== undefined && (
                  <div className="sharebar"><i style={{ width: `${row.share * 100}%` }} /></div>
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
      {moreTo && moreLabel && <Link to={moreTo} className="ad-more">{moreLabel}</Link>}
    </div>
  )
}

import type { ReactNode } from 'react'
import { Tile, type MozaikWash } from '@/shared/ui/mozaik'

// Per-tile error isolation (mezo-d5iy.11 spec requirement) — the Áttekintés page alone fires
// several independent queries (overview + cost matrix), and one failing endpoint must degrade
// ONLY the tile(s) that depend on it, never the whole page. Every admin tile is wrapped in this
// instead of reading `query.isError` ad hoc, so the "nem elérhető" + retry recipe is one place.
export interface AdminTileQuery {
  isError: boolean
  refetch: () => void
  /**
   * Real-mode cold-load flag (mezo-d5iy.16 fix). `useDualQuery`'s `data` deliberately falls
   * back to a zeroed `realEmpty` while a real fetch is in flight (by design — see that hook's
   * doc comment), which without this branch made every tile paint "0 fiók" / "$0.00" / an
   * empty sparkline during the cold-load window instead of a loading state. Every synthetic
   * tile-query object literal (a page combining >1 query into one tile, e.g.
   * AdminOverviewPage's `costQuery`, AdminDataPage's `rowsTileQuery`) must OR its constituent
   * queries' `isPending` in here the same way it already ORs `isError`.
   */
  isPending: boolean
}

export function AdminTile({
  query,
  wash,
  eyebrow,
  span,
  icon,
  iconSize,
  children,
}: {
  query: AdminTileQuery
  wash: MozaikWash
  eyebrow: string
  span?: 3 | 4 | 6 | 12
  icon?: Parameters<typeof Tile>[0]['icon']
  iconSize?: number
  children: ReactNode
}) {
  if (query.isError) {
    return (
      <Tile wash={wash} eyebrow={eyebrow} span={span}>
        <div className="ad-tile-error">
          <span>Ez az adat jelenleg nem elérhető.</span>
          <button type="button" className="ad-retry" onClick={query.refetch}>
            Újra
          </button>
        </div>
      </Tile>
    )
  }
  if (query.isPending) {
    return (
      <Tile wash={wash} eyebrow={eyebrow} span={span}>
        <div className="ad-tile-pending" aria-label="Betöltés…">
          <div className="sk" style={{ height: 14, width: '60%' }} />
          <div className="sk" style={{ height: 28, width: '40%' }} />
        </div>
      </Tile>
    )
  }
  return (
    <Tile wash={wash} eyebrow={eyebrow} span={span} icon={icon} iconSize={iconSize}>
      {children}
    </Tile>
  )
}

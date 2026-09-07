import type { ReactNode } from 'react'
import { Tile, type MozaikWash } from '@/shared/ui/mozaik'

// Per-tile error isolation (mezo-d5iy.11 spec requirement) — the Áttekintés page alone fires
// several independent queries (overview + cost matrix), and one failing endpoint must degrade
// ONLY the tile(s) that depend on it, never the whole page. Every admin tile is wrapped in this
// instead of reading `query.isError` ad hoc, so the "nem elérhető" + retry recipe is one place.
export interface AdminTileQuery {
  isError: boolean
  refetch: () => void
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
  return (
    <Tile wash={wash} eyebrow={eyebrow} span={span} icon={icon} iconSize={iconSize}>
      {children}
    </Tile>
  )
}

import type { ReactNode } from 'react'
import { Icon3D } from '@/shared/ui/clay'
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

// Üveg (mezo-me75u.10): every admin tile is a `.glass` tile; its ONE accent (`--c`) follows the
// `wash` prop through the `mz-w-<wash>` class the Tile already carries (the `uveg reteg admin`
// block maps sage/gold/coral/lav/sky/rose/white → `--dv-*`). Error = a flat coral cell with the
// `t-info` icon, pending = quiet muted text (the aria-label stays for the tests and AT).
export const ADMIN_TILE_CLASS = 'glass ad-gt'

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
      <Tile wash={wash} eyebrow={eyebrow} span={span} className={ADMIN_TILE_CLASS}>
        <AdminErrorCell message="Ez az adat jelenleg nem elérhető." onRetry={query.refetch} />
      </Tile>
    )
  }
  if (query.isPending) {
    return (
      <Tile wash={wash} eyebrow={eyebrow} span={span} className={ADMIN_TILE_CLASS}>
        <AdminLoading className="ad-tile-pending" />
      </Tile>
    )
  }
  return (
    <Tile wash={wash} eyebrow={eyebrow} span={span} icon={icon} iconSize={iconSize} className={ADMIN_TILE_CLASS}>
      {children}
    </Tile>
  )
}

/** The admin error state (üveg, mezo-me75u.10): a flat coral cell with the ⓘ 3D icon, the
 *  message and an optional lit „Újra” retry — shared by every tile and by the page-level
 *  errors (Költés hívás-részlet, Meghívók és fiókok) so there is ONE error look. */
export function AdminErrorCell({ message, onRetry, retryLabel = 'Újra' }: {
  message: string
  onRetry?: () => void
  retryLabel?: string
}) {
  return (
    <div className="ad-tile-error" role="status">
      <Icon3D name="t-info" size={22} />
      <span>{message}</span>
      {onRetry && (
        <button type="button" className="ad-retry" onClick={onRetry}>
          {retryLabel}
        </button>
      )}
    </div>
  )
}

/** The admin loading state: quiet muted text. The `aria-label` names the busy region for AT and
 *  the tests; the visible copy is the same words, hidden from AT so it is not read twice. */
export function AdminLoading({ text = 'Betöltés…', className }: { text?: string; className?: string }) {
  return (
    <div className={className ? `ad-loading ${className}` : 'ad-loading'} aria-label={text} aria-busy="true">
      <span aria-hidden="true">{text}</span>
    </div>
  )
}

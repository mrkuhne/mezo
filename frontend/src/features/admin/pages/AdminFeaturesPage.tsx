import { useMemo, useState } from 'react'
import { useMe } from '@/data/hooks'
import { useAdminFeatureBoard, useAdminScreenUsage } from '@/data/admin/adminInsightsHooks'
import type { AdminFeaturePeriod, AdminFeatureRow } from '@/data/admin/adminInsightsApi'
import { AdminTile } from '@/features/admin/components/AdminTile'
import { FeatureScoreRow } from '@/features/admin/components/FeatureScoreRow'
import { ScreenUsageTable } from '@/features/admin/components/ScreenUsageTable'
import { TopListTile, type TopRow } from '@/features/admin/components/TopListTile'
import { ValueCostQuadrant } from '@/features/admin/components/ValueCostQuadrant'
import { screenLabel } from '@/features/admin/lib/labels'
import { valueScore } from '@/features/admin/lib/adminViz'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { CollapsibleStrip, MosaicDesktop, MozaikPage, PageBody, PageHero } from '@/shared/ui/mozaik'
import { huInt, usd } from '@/shared/lib/huNum'

// Funkciók scorecard (mezo-kxnn Task 1) — replaces the old Feature-használat matrix page
// (AdminUsagePage, deleted this task; /admin/usage now redirects here). Layout per the plan:
// summary strip (3 cells) → period toggle → scorecard list tile (sp12, one FeatureScoreRow per
// row, non-system rows sorted by the chosen criterion, system rows grouped under a muted
// divider) → screen-usage supporting tile (top-8, "teljes lista" behind a lenyitó — the cheaper
// option the Rulings explicitly allow over inventing a full-list ROUTE that doesn't exist yet).
//
// Task 2 (mezo-kxnn) inserted the value/cost quadrant tile between the period toggle and the
// scorecard (self-review notes: "order: summary → quadrant → scorecard → screen tile").

const PERIODS: { key: AdminFeaturePeriod; label: string }[] = [
  { key: '30d', label: '30 nap' },
  { key: '90d', label: '90 nap' },
]

// Final review Finding 5 — a bare `${period}` rendered the raw API value ("30d"/"90d") into
// Hungarian copy ("Összköltség · 30d"); this is the one place that turns it into "30 nap"/
// "90 nap", reused both by the summary-strip cell and the hero subtitle so the two never drift.
const periodLabel = (period: AdminFeaturePeriod): string =>
  PERIODS.find((p) => p.key === period)?.label ?? period

type SortKey = 'ertek' | 'koltseg' | 'hasznalat'
const SORTS: { key: SortKey; label: string }[] = [
  { key: 'ertek', label: 'érték' },
  { key: 'koltseg', label: 'költség' },
  { key: 'hasznalat', label: 'használat' },
]

const SORT_COMPARATORS: Record<SortKey, (a: AdminFeatureRow, b: AdminFeatureRow) => number> = {
  ertek: (a, b) => valueScore(b) - valueScore(a),
  koltseg: (a, b) => b.costUsd - a.costUsd,
  hasznalat: (a, b) => b.uniqueUsers - a.uniqueUsers,
}

export function AdminFeaturesPage() {
  const me = useMe()
  const isOwner = me.data?.role === 'OWNER'
  const [period, setPeriod] = useState<AdminFeaturePeriod>('30d')
  const [sort, setSort] = useState<SortKey>('ertek')
  const board = useAdminFeatureBoard(period, isOwner)
  // Screen-usage tile (Rulings): an INDEPENDENT query in its own tile, same per-tile error
  // isolation recipe as the old AdminUsagePage — a failing screens endpoint must never blank
  // the scorecard.
  const screens = useAdminScreenUsage(period, isOwner)

  const rows = board.data.rows
  const { sortedNonSystem, systemRows } = useMemo(() => {
    const nonSystem = rows.filter((r) => r.kind !== 'system')
    const system = rows.filter((r) => r.kind === 'system')
    return { sortedNonSystem: [...nonSystem].sort(SORT_COMPARATORS[sort]), systemRows: system }
  }, [rows, sort])

  const activeCount = rows.filter((r) => r.kind !== 'system' && r.uniqueUsers > 0).length
  // Final review Finding 4 — must match the sibling "aktívan használt" cell's own system
  // exclusion: a system row (the `unknown` bucket) never has real user feedback to report.
  const feedbackCount = rows.filter((r) => r.kind !== 'system' && r.helped !== null).length
  const totalCostUsd = rows.reduce((sum, r) => sum + r.costUsd, 0)

  // Top-8 bar-less TopListTile rows (Rulings) — `share` is deliberately omitted: a screen's
  // view count isn't a share of anything meaningful here (the shared component's bar-less
  // variant, same as "Csendes tesztelők" on Pulzus).
  const topScreenRows: TopRow[] = [...screens.data.screens]
    .sort((a, b) => b.views - a.views)
    .slice(0, 8)
    .map((row) => {
      const label = screenLabel(row.screen)
      return {
        key: row.screen,
        label: `${label.label}${label.missing ? ' (nincs címke)' : ''}`,
        value: huInt(row.views),
      }
    })

  return (
    <MozaikPage tone="lav">
      <PageHero name="Funkciók" sub={`${periodLabel(period)} · ${rows.length} funkció · ${usd(totalCostUsd)}`} />
      <PageBody>
        <EntranceGroup>
          <MosaicDesktop>
            <AdminTile query={board} wash="lav" eyebrow="Aktívan használt funkciók" span={4}>
              <div className="ad-poster"><div className="ad-big">{huInt(activeCount)}</div></div>
            </AdminTile>
            <AdminTile query={board} wash="sage" eyebrow="Van visszajelzése" span={4}>
              <div className="ad-poster"><div className="ad-big">{huInt(feedbackCount)}</div></div>
            </AdminTile>
            <AdminTile query={board} wash="gold" eyebrow={`Összköltség · ${periodLabel(period)}`} span={4}>
              <div className="ad-poster"><div className="ad-big">{usd(totalCostUsd)}</div></div>
            </AdminTile>
          </MosaicDesktop>

          <div className="ad-chiprow ad-period-row" role="group" aria-label="Időszak">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                type="button"
                className={`ad-chip${period === p.key ? ' on' : ''}`}
                aria-pressed={period === p.key}
                onClick={() => setPeriod(p.key)}
              >
                {p.label}
              </button>
            ))}
          </div>

          <MosaicDesktop>
            <AdminTile query={board} wash="lav" eyebrow="Érték–költség térkép" span={12}>
              <ValueCostQuadrant rows={rows} />
            </AdminTile>
          </MosaicDesktop>

          <MosaicDesktop>
            <AdminTile query={board} wash="lav" eyebrow="Funkciók listája" span={12}>
              <div className="ad-chiprow" role="group" aria-label="Rendezés" style={{ marginBottom: 10 }}>
                {SORTS.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    className={`ad-chip${sort === s.key ? ' on' : ''}`}
                    aria-pressed={sort === s.key}
                    onClick={() => setSort(s.key)}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <div className="ad-scorecard">
                {sortedNonSystem.map((row) => <FeatureScoreRow key={row.key} row={row} />)}
                {systemRows.length > 0 && (
                  <>
                    <div className="ad-score-divider">Rendszer</div>
                    {systemRows.map((row) => <FeatureScoreRow key={row.key} row={row} />)}
                  </>
                )}
              </div>
            </AdminTile>

            <AdminTile query={screens} wash="sky" eyebrow="Képernyők · megnyitások" span={4}>
              <TopListTile
                title="Képernyők · megnyitások"
                rows={topScreenRows}
                emptyLabel="Még nincs képernyő-esemény."
              />
              {screens.data.screens.length > 8 && (
                <CollapsibleStrip eyebrow="Teljes lista" summary={`${screens.data.screens.length} képernyő`}>
                  <ScreenUsageTable screens={screens.data.screens} />
                </CollapsibleStrip>
              )}
            </AdminTile>
          </MosaicDesktop>
        </EntranceGroup>
      </PageBody>
    </MozaikPage>
  )
}

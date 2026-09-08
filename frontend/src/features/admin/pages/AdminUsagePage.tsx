import { useState } from 'react'
import { useMe } from '@/data/hooks'
import { useAdminFeatureUsage, useAdminScreenUsage } from '@/data/admin/adminInsightsHooks'
import type { AdminPeriod } from '@/data/admin/adminInsightsApi'
import { AdminTile } from '@/features/admin/components/AdminTile'
import { MatrixGrid } from '@/features/admin/components/MatrixGrid'
import { ScreenUsageTable } from '@/features/admin/components/ScreenUsageTable'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { MosaicDesktop, MozaikPage, PageBody, PageHero } from '@/shared/ui/mozaik'
import { huInt } from '@/shared/lib/huNum'

// Feature-használat — ported from admin-body.html's #d-features (the matrix half; the cost
// grid on that same prototype screen belongs to the deferred /admin/cost route, tasks 12-13):
// one sp12 tile, a feature × day matrix, a 7/30/90 period selector.
const PERIODS: { key: AdminPeriod; label: string }[] = [
  { key: '7d', label: '7 nap' },
  { key: '30d', label: '30 nap' },
  { key: '90d', label: '90 nap' },
]

export function AdminUsagePage() {
  const me = useMe()
  const isOwner = me.data?.role === 'OWNER'
  const [period, setPeriod] = useState<AdminPeriod>('30d')
  const usage = useAdminFeatureUsage(period, isOwner)
  // Képernyők (mezo-o5cz): an INDEPENDENT query on the same period chip, in its own tile — a
  // failing screen-usage endpoint must degrade only its own tile, never the feature matrix
  // (AdminTile's per-tile error isolation, mezo-d5iy.11).
  const screens = useAdminScreenUsage(period, isOwner)
  const callTotal = usage.data.features.reduce((sum, f) => sum + f.days.reduce((a, d) => a + d.count, 0), 0)

  return (
    <MozaikPage tone="lav">
      {/* Fix round: final review Finding 4 — render the page's own `period` state, not
          `usage.data.period`. The response field can be stale/wrong-looking: switching the
          chip changes the query key immediately, but while real-mode data is unresolved
          `usage.data` is `ADMIN_FEATURE_USAGE_EMPTY`, whose hardcoded `period: '30d'` would
          flash under a "90 nap" chip. `period` (local state) is always the period the user
          actually selected. */}
      <PageHero name="Feature-használat" sub={`${period} · ${usage.data.features.length} feature · ${huInt(callTotal)} hívás`} />
      <PageBody>
        <div className="ad-chiprow" role="group" aria-label="Időszak">
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
        <EntranceGroup>
          <MosaicDesktop>
            <AdminTile query={usage} wash="lav" eyebrow="Mátrix · feature × nap" span={12}>
              <MatrixGrid
                rows={usage.data.features}
                columns={usage.data.days}
                rowKey={(r) => r.key}
                rowLabel={(r) => r.key}
                columnKey={(c) => c}
                columnLabel={(c) => c.slice(5)}
                valueOf={(r, day) => r.days.find((d) => d.day === day)?.count ?? 0}
                formatValue={(v) => `${v} hívás`}
              />
            </AdminTile>
            <AdminTile query={screens} wash="sky" eyebrow="Képernyők · megnyitások" span={12}>
              <ScreenUsageTable screens={screens.data.screens} />
            </AdminTile>
          </MosaicDesktop>
        </EntranceGroup>
      </PageBody>
    </MozaikPage>
  )
}

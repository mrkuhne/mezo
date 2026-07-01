import { Outlet, useLocation } from 'react-router-dom'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { PageTitle } from '@/components/ui/PageTitle'
import { Icon } from '@/components/ui/Icon'
import { InsightsSubNav } from '@/features/insights/InsightsSubNav'
import { INSIGHTS_TABS } from '@/features/insights/tabs'

export function InsightsScreen() {
  const { pathname } = useLocation()
  const seg = pathname.split('/')[2] ?? 'patterns'
  const active = INSIGHTS_TABS.find((t) => t.id === seg) ?? INSIGHTS_TABS[0]

  return (
    <>
      <div className="page-header">
        <div>
          <Eyebrow brand>Insights</Eyebrow>
          <PageTitle className="mt-sm">{active.label}</PageTitle>
        </div>
        {/* Decorative — the prototype's settings chip has no handler */}
        <button type="button" className="chip" aria-label="Insights beállítások">
          <Icon name="settings" size={12} />
        </button>
      </div>

      <InsightsSubNav />

      <div style={{ padding: '8px 24px 24px' }}>
        <Outlet />
      </div>
    </>
  )
}

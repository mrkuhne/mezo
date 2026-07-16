import { Outlet, useLocation } from 'react-router-dom'
import { InsightsSubNav } from '@/features/insights/pages/InsightsSubNav'
import { INSIGHTS_TABS } from '@/features/insights/pages/tabs'

export function InsightsSection() {
  const { pathname } = useLocation()
  const seg = pathname.split('/')[2] ?? 'patterns'
  const active = INSIGHTS_TABS.find((t) => t.id === seg) ?? INSIGHTS_TABS[0]

  return (
    <>
      <div className="pghead-np lav">
        <div>
          <div className="over">Insights</div>
          <h1>{active.title}</h1>
        </div>
      </div>

      <InsightsSubNav />

      <div style={{ padding: '8px 24px 24px' }}>
        <Outlet />
      </div>
    </>
  )
}

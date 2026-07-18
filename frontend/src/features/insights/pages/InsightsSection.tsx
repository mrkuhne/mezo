import { Outlet } from 'react-router-dom'
import { AppHero } from '@/features/progression/components/AppHero'
import { visibleInsightsTabs } from '@/features/insights/pages/tabs'
import { SubNavDropdown } from '@/shared/ui/SubNavDropdown'

export function InsightsSection() {
  return (
    <>
      <AppHero
        utilities={
          <SubNavDropdown
            label="Insights alnavigáció"
            items={visibleInsightsTabs()}
            accent="var(--lav-deep)"
          />
        }
      />
      <div style={{ padding: '8px 24px 24px' }}>
        <Outlet />
      </div>
    </>
  )
}

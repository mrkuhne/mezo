import { PageTitle } from '@/components/ui/PageTitle'
import { Eyebrow } from '@/components/ui/Eyebrow'
export function InsightsScreen() {
  return (
    <div className="page-header">
      <div className="col gap-xs">
        <Eyebrow brand>FELISMERÉSEK</Eyebrow>
        <PageTitle>Insights</PageTitle>
      </div>
    </div>
  )
}

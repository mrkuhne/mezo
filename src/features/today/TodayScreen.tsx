import { PageTitle } from '@/components/ui/PageTitle'
import { Eyebrow } from '@/components/ui/Eyebrow'
export function TodayScreen() {
  return (
    <div className="page-header">
      <div className="col gap-xs">
        <Eyebrow brand>MA</Eyebrow>
        <PageTitle>Today</PageTitle>
      </div>
    </div>
  )
}

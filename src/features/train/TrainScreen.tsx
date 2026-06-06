import { Outlet, useLocation } from 'react-router-dom'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { PageTitle } from '@/components/ui/PageTitle'
import { TrainSubNav } from './TrainSubNav'
import { TRAIN_TABS } from './tabs'

const HEADER: Record<string, { eyebrow: string; title: string }> = {
  mai: { eyebrow: 'Train · Mai', title: 'Edzés' },
  gym: { eyebrow: 'Train · GYM', title: 'GYM' },
  sport: { eyebrow: 'Train · Sport', title: 'Röplabda' },
  mesocycles: { eyebrow: 'Train · Mesocycles', title: 'Mesociklusok' },
}

export function TrainScreen() {
  const { pathname } = useLocation()
  const seg = pathname.split('/')[2] ?? 'mai'
  const active = TRAIN_TABS.find((t) => t.id === seg) ?? TRAIN_TABS[0]
  const h = HEADER[active.id] ?? HEADER.mai

  return (
    <>
      <div className="page-header">
        <div>
          <Eyebrow brand>{h.eyebrow}</Eyebrow>
          <PageTitle className="mt-sm">{h.title}</PageTitle>
        </div>
      </div>
      <TrainSubNav />
      <div style={{ padding: '8px 24px 24px' }}>
        <Outlet />
      </div>
    </>
  )
}

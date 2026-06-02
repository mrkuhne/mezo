import { Navigate, type RouteObject } from 'react-router-dom'
import { AppLayout } from './AppLayout'
import { TodayScreen } from '@/features/today/TodayScreen'
import { TrainScreen } from '@/features/train/TrainScreen'
import { FuelScreen } from '@/features/fuel/FuelScreen'
import { InsightsScreen } from '@/features/insights/InsightsScreen'
import { MeScreen } from '@/features/me/MeScreen'

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/today" replace /> },
      { path: 'today', element: <TodayScreen /> },
      { path: 'train', element: <TrainScreen /> },
      { path: 'fuel', element: <FuelScreen /> },
      { path: 'insights', element: <InsightsScreen /> },
      { path: 'me', element: <MeScreen /> },
      { path: '*', element: <Navigate to="/today" replace /> },
    ],
  },
]

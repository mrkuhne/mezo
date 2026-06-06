import { Navigate, useOutletContext, type RouteObject } from 'react-router-dom'
import { AppLayout } from './AppLayout'
import { TodayScreen } from '@/features/today/TodayScreen'
import { TrainScreen } from '@/features/train/TrainScreen'
import { TrainTodayView } from '@/features/train/views/TrainTodayView'
import { GymView } from '@/features/train/views/GymView'
import { SportView } from '@/features/train/views/SportView'
import { MesocycleLibraryView } from '@/features/train/views/MesocycleLibraryView'
import { ActiveWorkoutScreen } from '@/features/train/ActiveWorkoutScreen'
import { MesocyclePlanner } from '@/features/train/MesocyclePlanner'
import { MesocycleBuilder } from '@/features/train/MesocycleBuilder'
import { FuelScreen } from '@/features/fuel/FuelScreen'
import { FuelMaiView } from '@/features/fuel/views/FuelMaiView'
import { FuelPlanView } from '@/features/fuel/views/FuelPlanView'
import { FuelStackView } from '@/features/fuel/views/FuelStackView'
import { FuelRecipesView } from '@/features/fuel/views/FuelRecipesView'
import { FuelKamraView } from '@/features/fuel/views/FuelKamraView'
import { InsightsScreen } from '@/features/insights/InsightsScreen'
import { PatternsView } from '@/features/insights/views/PatternsView'
import { WeeklyView } from '@/features/insights/views/WeeklyView'
import { MemoirView } from '@/features/insights/views/MemoirView'
import { KnowledgeListView } from '@/features/insights/views/KnowledgeListView'
import { ChatView } from '@/features/insights/views/ChatView'
import { PredictionsView } from '@/features/insights/views/PredictionsView'
import { ExperimentsView } from '@/features/insights/views/ExperimentsView'
import { MeScreen, type MeOutletContext } from '@/features/me/MeScreen'
import { ProfileView } from '@/features/me/views/ProfileView'
import { GoalsView } from '@/features/me/views/GoalsView'
import { SleepView } from '@/features/me/views/SleepView'
import { PeopleView } from '@/features/me/views/PeopleView'
import { KnowledgeView } from '@/features/me/views/KnowledgeView'

function ProfileRoute() {
  const { openSettings } = useOutletContext<MeOutletContext>()
  return <ProfileView onOpenSettings={openSettings} />
}

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/today" replace /> },
      { path: 'today', element: <TodayScreen /> },
      {
        path: 'train',
        element: <TrainScreen />,
        children: [
          { index: true, element: <TrainTodayView /> },
          { path: 'gym', element: <GymView /> },
          { path: 'sport', element: <SportView /> },
          { path: 'mesocycles', element: <MesocycleLibraryView /> },
        ],
      },
      { path: 'train/session', element: <ActiveWorkoutScreen /> },
      { path: 'train/mesocycles/new', element: <MesocyclePlanner /> },
      { path: 'train/mesocycles/:id', element: <MesocycleBuilder /> },
      {
        path: 'fuel',
        element: <FuelScreen />,
        children: [
          { index: true, element: <FuelMaiView /> },
          { path: 'plan', element: <FuelPlanView /> },
          { path: 'stack', element: <FuelStackView /> },
          { path: 'recipes', element: <FuelRecipesView /> },
          { path: 'kamra', element: <FuelKamraView /> },
        ],
      },
      {
        path: 'insights',
        element: <InsightsScreen />,
        children: [
          { index: true, element: <PatternsView /> },
          { path: 'weekly', element: <WeeklyView /> },
          { path: 'memoir', element: <MemoirView /> },
          { path: 'knowledge', element: <KnowledgeListView /> },
          { path: 'chat', element: <ChatView /> },
          { path: 'predictions', element: <PredictionsView /> },
          { path: 'experiments', element: <ExperimentsView /> },
        ],
      },
      {
        path: 'me',
        element: <MeScreen />,
        children: [
          { index: true, element: <ProfileRoute /> },
          { path: 'goals', element: <GoalsView /> },
          { path: 'sleep', element: <SleepView /> },
          { path: 'people', element: <PeopleView /> },
          { path: 'knowledge', element: <KnowledgeView /> },
        ],
      },
      { path: '*', element: <Navigate to="/today" replace /> },
    ],
  },
]

import { Navigate, useOutletContext, type RouteObject } from 'react-router-dom'
import { AppLayout } from '@/app/AppLayout'
import { TodayPage } from '@/features/today/pages/TodayPage'
import { TrainScreen } from '@/features/train/TrainScreen'
import { TrainTodayView } from '@/features/train/views/TrainTodayView'
import { GymView } from '@/features/train/views/GymView'
import { SportView } from '@/features/train/views/SportView'
import { RunningView } from '@/features/train/views/RunningView'
import { ExercisesView } from '@/features/train/views/ExercisesView'
import { MesocycleLibraryView } from '@/features/train/views/MesocycleLibraryView'
import { ActiveWorkoutScreen } from '@/features/train/ActiveWorkoutScreen'
import { MesocyclePlanner } from '@/features/train/MesocyclePlanner'
import { MesocycleBuilder } from '@/features/train/MesocycleBuilder'
import { RunningBlockBuilder } from '@/features/train/RunningBlockBuilder'
import { FuelSection } from '@/features/fuel/pages/FuelSection'
import { FuelMaiPage } from '@/features/fuel/pages/FuelMaiPage'
import { FuelPlanPage } from '@/features/fuel/pages/FuelPlanPage'
import { FuelStackPage } from '@/features/fuel/pages/FuelStackPage'
import { FuelRecipesPage } from '@/features/fuel/pages/FuelRecipesPage'
import { FuelKamraPage } from '@/features/fuel/pages/FuelKamraPage'
import { KamraItemDetailPage } from '@/features/fuel/pages/KamraItemDetailPage'
import { FuelMedicationPage } from '@/features/fuel/pages/FuelMedicationPage'
import { RecipeDetailPage } from '@/features/fuel/pages/RecipeDetailPage'
import { RecipeEditorPage } from '@/features/fuel/pages/RecipeEditorPage'
import { InsightsSection } from '@/features/insights/pages/InsightsSection'
import { PatternsPage } from '@/features/insights/pages/PatternsPage'
import { WeeklyPage } from '@/features/insights/pages/WeeklyPage'
import { MemoirPage } from '@/features/insights/pages/MemoirPage'
import { KnowledgeListPage } from '@/features/insights/pages/KnowledgeListPage'
import { ChatPage } from '@/features/insights/pages/ChatPage'
import { PredictionsPage } from '@/features/insights/pages/PredictionsPage'
import { ExperimentsPage } from '@/features/insights/pages/ExperimentsPage'
import { MeSection, type MeOutletContext } from '@/features/me/pages/MeSection'
import { GoalPlannerPage } from '@/features/me/pages/GoalPlannerPage'
import { ProfilePage } from '@/features/me/pages/ProfilePage'
import { GoalsPage } from '@/features/me/pages/GoalsPage'
import { WeightPage } from '@/features/me/pages/WeightPage'
import { SleepPage } from '@/features/me/pages/SleepPage'
import { PeoplePage } from '@/features/me/pages/PeoplePage'
import { KnowledgePage } from '@/features/me/pages/KnowledgePage'

function ProfileRoute() {
  const { openSettings } = useOutletContext<MeOutletContext>()
  return <ProfilePage onOpenSettings={openSettings} />
}

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/today" replace /> },
      { path: 'today', element: <TodayPage /> },
      {
        path: 'train',
        element: <TrainScreen />,
        children: [
          { index: true, element: <TrainTodayView /> },
          { path: 'gym', element: <GymView /> },
          { path: 'sport', element: <SportView /> },
          { path: 'futas', element: <RunningView /> },
          { path: 'exercises', element: <ExercisesView /> },
          { path: 'mesocycles', element: <MesocycleLibraryView /> },
        ],
      },
      { path: 'train/session', element: <ActiveWorkoutScreen /> },
      { path: 'train/mesocycles/new', element: <MesocyclePlanner /> },
      { path: 'train/mesocycles/:id', element: <MesocycleBuilder /> },
      { path: 'train/futas/:id', element: <RunningBlockBuilder /> },
      {
        path: 'fuel',
        element: <FuelSection />,
        children: [
          { index: true, element: <FuelMaiPage /> },
          { path: 'plan', element: <FuelPlanPage /> },
          { path: 'stack', element: <FuelStackPage /> },
          { path: 'recipes', element: <FuelRecipesPage /> },
          { path: 'kamra', element: <FuelKamraPage /> },
          { path: 'kamra/:id', element: <KamraItemDetailPage /> },
          { path: 'gyogyszer', element: <FuelMedicationPage /> },
        ],
      },
      // Recipe detail + editor are full pages (no Fuel sub-nav chrome), mirroring
      // train/session — siblings of the `fuel` group, not nested children. `new`
      // is listed before `:id` for clarity (React Router ranks static over dynamic).
      { path: 'fuel/recipes/new', element: <RecipeEditorPage /> },
      { path: 'fuel/recipes/:id', element: <RecipeDetailPage /> },
      { path: 'fuel/recipes/:id/edit', element: <RecipeEditorPage /> },
      {
        path: 'insights',
        element: <InsightsSection />,
        children: [
          { index: true, element: <PatternsPage /> },
          { path: 'weekly', element: <WeeklyPage /> },
          { path: 'memoir', element: <MemoirPage /> },
          { path: 'knowledge', element: <KnowledgeListPage /> },
          { path: 'chat', element: <ChatPage /> },
          { path: 'predictions', element: <PredictionsPage /> },
          { path: 'experiments', element: <ExperimentsPage /> },
        ],
      },
      {
        path: 'me',
        element: <MeSection />,
        children: [
          { index: true, element: <ProfileRoute /> },
          { path: 'goals', element: <GoalsPage /> },
          { path: 'weight', element: <WeightPage /> },
          { path: 'sleep', element: <SleepPage /> },
          { path: 'people', element: <PeoplePage /> },
          { path: 'knowledge', element: <KnowledgePage /> },
        ],
      },
      { path: 'me/goals/new', element: <GoalPlannerPage /> },
      { path: '*', element: <Navigate to="/today" replace /> },
    ],
  },
]

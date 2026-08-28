import { Navigate, type RouteObject, useLocation } from 'react-router-dom'
import { AppLayout } from '@/app/AppLayout'
import { NapHubPage } from '@/features/today/pages/NapHubPage'
import { NapCheckinPage } from '@/features/today/pages/NapCheckinPage'
import { TrainSection } from '@/features/train/pages/TrainSection'
import { TrainTodayPage } from '@/features/train/pages/TrainTodayPage'
import { TrainWeekPage } from '@/features/train/pages/TrainWeekPage'
import { GymPage } from '@/features/train/pages/GymPage'
import { SportPage } from '@/features/train/pages/SportPage'
import { RunningPage } from '@/features/train/pages/RunningPage'
import { ExercisesPage } from '@/features/train/pages/ExercisesPage'
import { MedalsPage } from '@/features/train/pages/MedalsPage'
import { MesocycleLibraryPage } from '@/features/train/pages/MesocycleLibraryPage'
import { MesoTemplatesPage } from '@/features/train/pages/MesoTemplatesPage'
import { ActiveWorkoutPage } from '@/features/train/pages/ActiveWorkoutPage'
import { WorkoutReviewPage } from '@/features/train/pages/WorkoutReviewPage'
import { MesocyclePlannerPage } from '@/features/train/pages/MesocyclePlannerPage'
import { MesocycleBuilderPage } from '@/features/train/pages/MesocycleBuilderPage'
import { MesoOverviewPage } from '@/features/train/pages/MesoOverviewPage'
import { MesoReportPage } from '@/features/train/pages/MesoReportPage'
import { MesoComparePage } from '@/features/train/pages/MesoComparePage'
import { MesoTemplateEditorPage } from '@/features/train/pages/MesoTemplateEditorPage'
import { RunningBlockBuilderPage } from '@/features/train/pages/RunningBlockBuilderPage'
import { CustomWorkoutBuilderPage } from '@/features/train/pages/CustomWorkoutBuilderPage'
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
import { FuelSlotsPage } from '@/features/fuel/pages/FuelSlotsPage'
import { InsightsSection } from '@/features/insights/pages/InsightsSection'
import { PatternsPage } from '@/features/insights/pages/PatternsPage'
import { PatternDetailPage } from '@/features/insights/pages/PatternDetailPage'
import { MemoirPage } from '@/features/insights/pages/MemoirPage'
import { KnowledgeListPage } from '@/features/insights/pages/KnowledgeListPage'
import { ChatPage } from '@/features/insights/pages/ChatPage'
import { PredictionsPage } from '@/features/insights/pages/PredictionsPage'
import { ExperimentsPage } from '@/features/insights/pages/ExperimentsPage'
import { MemoryPage } from '@/features/insights/pages/MemoryPage'
import { MeSection } from '@/features/me/pages/MeSection'
import { GoalPlannerPage } from '@/features/me/pages/GoalPlannerPage'
import { NightPage } from '@/features/me/pages/NightPage'
import { ProfilePage } from '@/features/me/pages/ProfilePage'
import { GrowthPage } from '@/features/me/pages/GrowthPage'
import { JournalPage } from '@/features/me/pages/JournalPage'
import { WeekPage } from '@/features/me/pages/WeekPage'
import { RoutineEditorPage } from '@/features/me/pages/RoutineEditorPage'
import { GoalsPage } from '@/features/me/pages/GoalsPage'
import { WeightPage } from '@/features/me/pages/WeightPage'
import { SleepPage } from '@/features/me/pages/SleepPage'
import { PeoplePage } from '@/features/me/pages/PeoplePage'
import { KnowledgePage } from '@/features/me/pages/KnowledgePage'
import { NotificationsPage } from '@/features/me/pages/NotificationsPage'
import { AiUsagePage } from '@/features/me/pages/AiUsagePage'
import { AiCallDetailPage } from '@/features/me/pages/AiCallDetailPage'
import { RitualPage } from '@/features/ritual/pages/RitualPage'

// Design 2.0 shell (mezo-d20.1.1): /today → /nap and /insights → /mezo renames. The legacy
// paths survive as redirects (PWA bookmarks, in-app navigate() calls not yet migrated).
function LegacyPathRedirect({ prefix, to }: { prefix: string; to: string }) {
  const location = useLocation()
  return <Navigate to={location.pathname.replace(prefix, to) + location.search} replace />
}

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/nap" replace /> },
      { path: 'nap', element: <NapHubPage /> },
      // Nap tile → own full page (Huawei pattern, mezo-d20.2.5)
      { path: 'nap/checkin', element: <NapCheckinPage /> },
      { path: 'today/*', element: <LegacyPathRedirect prefix="/today" to="/nap" /> },
      {
        path: 'train',
        element: <TrainSection />,
        children: [
          { index: true, element: <TrainTodayPage /> },
          { path: 'week', element: <TrainWeekPage /> },
          { path: 'gym', element: <GymPage /> },
          { path: 'sport', element: <SportPage /> },
          { path: 'futas', element: <RunningPage /> },
          { path: 'exercises', element: <ExercisesPage /> },
          { path: 'medals', element: <MedalsPage /> },
          { path: 'mesocycles', element: <MesocycleLibraryPage /> },
          // The `Sablonok` tab (mezo-tlwa) — a Train tab like the ones above (keeps the
          // sub-nav), NOT a full-screen sibling; the template EDITOR below still is one.
          { path: 'templates', element: <MesoTemplatesPage /> },
        ],
      },
      { path: 'train/session', element: <ActiveWorkoutPage /> },
      { path: 'train/review/:workoutId', element: <WorkoutReviewPage /> },
      { path: 'train/mesocycles/new', element: <MesocyclePlannerPage /> },
      // Template day-plan editor (mezo-meyc.1) — full-screen sibling, no Train sub-nav.
      // Listed before `:id` for clarity (React Router ranks static over dynamic anyway).
      { path: 'train/mesocycles/templates/:id', element: <MesoTemplateEditorPage /> },
      // The frozen run report (mezo-meyc.2) — listed BEFORE the `:id` builder so the deeper
      // path is unmistakable at a glance (React Router ranks by specificity anyway). An
      // archived run's builder visit redirects here: a closed run has no builder.
      { path: 'train/mesocycles/:id/report', element: <MesoReportPage /> },
      // Two-run compare (mezo-meyc.4) — listed BEFORE the `:id` builder so the static
      // `compare` segment is unmistakable at a glance (React Router ranks static over
      // dynamic anyway). Full-screen sibling; the pair travels in `?a=&b=`.
      { path: 'train/mesocycles/compare', element: <MesoComparePage /> },
      { path: 'train/mesocycles/:id', element: <MesocycleBuilderPage /> },
      { path: 'train/mesocycles/:id/overview', element: <MesoOverviewPage /> },
      { path: 'train/custom/new', element: <CustomWorkoutBuilderPage /> },
      { path: 'train/custom/:id', element: <CustomWorkoutBuilderPage /> },
      { path: 'train/futas/:id', element: <RunningBlockBuilderPage /> },
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
      // Meal-slot template editor (mezo-7102) — a full page, same sibling idiom as the recipe
      // editor above (no Fuel sub-nav chrome).
      { path: 'fuel/slots', element: <FuelSlotsPage /> },
      // Pattern-pair detail (mezo-tk88.5) — a full leaf page, same sibling idiom as
      // fuel/recipes/:id above (no Insights sub-nav chrome).
      { path: 'mezo/patterns/:pairKey', element: <PatternDetailPage /> },
      { path: 'insights/*', element: <LegacyPathRedirect prefix="/insights" to="/mezo" /> },
      {
        path: 'mezo',
        element: <InsightsSection />,
        children: [
          { index: true, element: <PatternsPage /> },
          // Heti retired (mezo-p2tr): the review moved to /me/week (WeekPage) — including the
          // score hero, the growth card and the weekly tervjavaslat prose. The route survives as
          // an honest redirect so any old bookmark/link still lands somewhere sensible.
          { path: 'weekly', element: <Navigate to="/me/week" replace /> },
          { path: 'memoir', element: <MemoirPage /> },
          { path: 'knowledge', element: <KnowledgeListPage /> },
          { path: 'chat', element: <ChatPage /> },
          { path: 'predictions', element: <PredictionsPage /> },
          { path: 'experiments', element: <ExperimentsPage /> },
          // Motor retired (mezo-tk88.4) — the diagnostics moved into the Minták dashboard +
          // the pattern-pair detail page above (mezo-tk88.5); the route survives as an honest
          // redirect so any old bookmark/link (`?pair=` cross-links included) still lands
          // somewhere sensible.
          { path: 'motor', element: <Navigate to="/mezo" replace /> },
          { path: 'memoria', element: <MemoryPage /> },
        ],
      },
      {
        path: 'me',
        element: <MeSection />,
        children: [
          { index: true, element: <ProfilePage /> },
          { path: 'growth', element: <GrowthPage /> },
          { path: 'naplo', element: <JournalPage /> },
          { path: 'week', element: <WeekPage /> },
          { path: 'goals', element: <GoalsPage /> },
          { path: 'weight', element: <WeightPage /> },
          { path: 'sleep', element: <SleepPage /> },
          { path: 'people', element: <PeoplePage /> },
          { path: 'knowledge', element: <KnowledgePage /> },
          { path: 'ertesitesek', element: <NotificationsPage /> },
        ],
      },
      { path: 'me/goals/new', element: <GoalPlannerPage /> },
      // Full-screen routine editor (mezo-n5e9.2) — same sibling idiom (no Me sub-nav chrome).
      { path: 'me/routines/edit', element: <RoutineEditorPage /> },
      // Full-screen night surface (train/session idiom) — no Me sub-nav chrome.
      { path: 'me/sleep/night', element: <NightPage /> },
      // Full-screen AI audit log browser (mezo-uakh) — no Me sub-nav chrome.
      { path: 'me/ai-usage', element: <AiUsagePage /> },
      { path: 'me/ai-usage/:id', element: <AiCallDetailPage /> },
      // Full-screen Napzárás flow (train/session idiom) — no tab-bar chrome (mezo-ilsj).
      { path: 'ritual', element: <RitualPage /> },
      { path: '*', element: <Navigate to="/nap" replace /> },
    ],
  },
]

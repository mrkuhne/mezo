import { settingsRoutes } from '@/features/settings/settingsRoutes'
import type { ReactNode } from 'react'
import { Navigate, type RouteObject, useLocation, useParams, useSearchParams } from 'react-router-dom'
import { AppLayout } from '@/app/AppLayout'
import { useMe } from '@/data/hooks'
import { adminRoutes } from '@/features/admin/adminRoutes'
import { NapHubPage } from '@/features/today/pages/NapHubPage'
import { NapMezoPage } from '@/features/today/pages/NapMezoPage'
import { NapRutinPage } from '@/features/today/pages/NapRutinPage'
import { NapKuldetesekPage } from '@/features/today/pages/NapKuldetesekPage'
import { NapCheckinPage } from '@/features/today/pages/NapCheckinPage'
import { NapGyorsPage } from '@/features/today/pages/NapGyorsPage'
import { EletjelPage } from '@/features/today/pages/EletjelPage'
import { NapomPage } from '@/features/today/pages/NapomPage'
import { ALL_FEATURES_ROUTE } from '@/features/insights/logic/boopNavigation'
import { lazyPage } from '@/app/lazyPage'

const BoopMemoriesPage = lazyPage(() => import('@/features/insights/pages/BoopMemoriesPage'), 'BoopMemoriesPage')
const MemoryDayPage = lazyPage(() => import('@/features/insights/pages/MemoryDayPage'), 'MemoryDayPage')
const KnowledgeNodePage = lazyPage(() => import('@/features/insights/pages/KnowledgeNodePage'), 'KnowledgeNodePage')
const PredictionDetailPage = lazyPage(() => import('@/features/insights/pages/PredictionDetailPage'), 'PredictionDetailPage')
const ExperimentDetailPage = lazyPage(() => import('@/features/insights/pages/ExperimentDetailPage'), 'ExperimentDetailPage')
const MezoPersonalPage = lazyPage(() => import('@/features/settings/pages/MezoPersonalPage'), 'MezoPersonalPage')
const AccountSettingsPage = lazyPage(() => import('@/features/settings/pages/AccountSettingsPage'), 'AccountSettingsPage')
const TrainTodayPage = lazyPage(() => import('@/features/train/pages/TrainTodayPage'), 'TrainTodayPage')
const TrainWeekPage = lazyPage(() => import('@/features/train/pages/TrainWeekPage'), 'TrainWeekPage')
const TrainWeekMapPage = lazyPage(() => import('@/features/train/pages/TrainWeekMapPage'), 'TrainWeekMapPage')
const TrainWeekJelekPage = lazyPage(() => import('@/features/train/pages/TrainWeekJelekPage'), 'TrainWeekJelekPage')
const TrainWeekMozgasPage = lazyPage(() => import('@/features/train/pages/TrainWeekMozgasPage'), 'TrainWeekMozgasPage')
const GymPage = lazyPage(() => import('@/features/train/pages/GymPage'), 'GymPage')
const SportPage = lazyPage(() => import('@/features/train/pages/SportPage'), 'SportPage')
const SportLogPage = lazyPage(() => import('@/features/train/pages/SportLogPage'), 'SportLogPage')
const RunningPage = lazyPage(() => import('@/features/train/pages/RunningPage'), 'RunningPage')
const ExercisesPage = lazyPage(() => import('@/features/train/pages/ExercisesPage'), 'ExercisesPage')
const ExerciseStoryPage = lazyPage(() => import('@/features/train/pages/ExerciseStoryPage'), 'ExerciseStoryPage')
const MedalsPage = lazyPage(() => import('@/features/train/pages/MedalsPage'), 'MedalsPage')
const MesoTervPage = lazyPage(() => import('@/features/train/pages/MesoTervPage'), 'MesoTervPage')
const MesoKonyvtarPage = lazyPage(() => import('@/features/train/pages/MesoKonyvtarPage'), 'MesoKonyvtarPage')
const MesoFutamokPage = lazyPage(() => import('@/features/train/pages/MesoFutamokPage'), 'MesoFutamokPage')
const MesoTemplatesPage = lazyPage(() => import('@/features/train/pages/MesoTemplatesPage'), 'MesoTemplatesPage')
const MesoTemplateStoryPage = lazyPage(() => import('@/features/train/pages/MesoTemplateStoryPage'), 'MesoTemplateStoryPage')
const ActiveWorkoutPage = lazyPage(() => import('@/features/train/pages/ActiveWorkoutPage'), 'ActiveWorkoutPage')
const WorkoutReviewPage = lazyPage(() => import('@/features/train/pages/WorkoutReviewPage'), 'WorkoutReviewPage')
const MesocyclePlannerPage = lazyPage(() => import('@/features/train/pages/MesocyclePlannerPage'), 'MesocyclePlannerPage')
const MesocycleBuilderPage = lazyPage(() => import('@/features/train/pages/MesocycleBuilderPage'), 'MesocycleBuilderPage')
const MesoWeekPage = lazyPage(() => import('@/features/train/pages/MesoWeekPage'), 'MesoWeekPage')
const MesoMusclePage = lazyPage(() => import('@/features/train/pages/MesoMusclePage'), 'MesoMusclePage')
const MesoDayPage = lazyPage(() => import('@/features/train/pages/MesoDayPage'), 'MesoDayPage')
const MesoDayEditPage = lazyPage(() => import('@/features/train/pages/MesoDayEditPage'), 'MesoDayEditPage')
const MesoReportPage = lazyPage(() => import('@/features/train/pages/MesoReportPage'), 'MesoReportPage')
const MesoComparePage = lazyPage(() => import('@/features/train/pages/MesoComparePage'), 'MesoComparePage')
const MesoTemplateEditorPage = lazyPage(() => import('@/features/train/pages/MesoTemplateEditorPage'), 'MesoTemplateEditorPage')
const RunningBlockBuilderPage = lazyPage(() => import('@/features/train/pages/RunningBlockBuilderPage'), 'RunningBlockBuilderPage')
const CustomWorkoutBuilderPage = lazyPage(() => import('@/features/train/pages/CustomWorkoutBuilderPage'), 'CustomWorkoutBuilderPage')
const FuelMaiPage = lazyPage(() => import('@/features/fuel/pages/FuelMaiPage'), 'FuelMaiPage')
const FuelLogNewPage = lazyPage(() => import('@/features/fuel/pages/FuelLogNewPage'), 'FuelLogNewPage')
const FuelMealDetailPage = lazyPage(() => import('@/features/fuel/pages/FuelMealDetailPage'), 'FuelMealDetailPage')
const FuelMealScorePage = lazyPage(() => import('@/features/fuel/pages/FuelMealScorePage'), 'FuelMealScorePage')
const FuelTrendekPage = lazyPage(() => import('@/features/fuel/pages/FuelTrendekPage'), 'FuelTrendekPage')
const LearningPage = lazyPage(() => import('@/features/fuel/pages/LearningPage'), 'LearningPage')
const FuelKonyhaPage = lazyPage(() => import('@/features/fuel/pages/FuelKonyhaPage'), 'FuelKonyhaPage')
const FuelStackPage = lazyPage(() => import('@/features/fuel/pages/FuelStackPage'), 'FuelStackPage')
const FuelStackProtocolPage = lazyPage(() => import('@/features/fuel/pages/FuelStackProtocolPage'), 'FuelStackProtocolPage')
const FuelStackAddPage = lazyPage(() => import('@/features/fuel/pages/FuelStackAddPage'), 'FuelStackAddPage')
const FuelRecipesPage = lazyPage(() => import('@/features/fuel/pages/FuelRecipesPage'), 'FuelRecipesPage')
const FuelKamraPage = lazyPage(() => import('@/features/fuel/pages/FuelKamraPage'), 'FuelKamraPage')
const KamraItemDetailPage = lazyPage(() => import('@/features/fuel/pages/KamraItemDetailPage'), 'KamraItemDetailPage')
const FuelMedicationPage = lazyPage(() => import('@/features/fuel/pages/FuelMedicationPage'), 'FuelMedicationPage')
const RecipeDetailPage = lazyPage(() => import('@/features/fuel/pages/RecipeDetailPage'), 'RecipeDetailPage')
const RecipeEditorPage = lazyPage(() => import('@/features/fuel/pages/RecipeEditorPage'), 'RecipeEditorPage')
const RecipeWorkshopPage = lazyPage(() => import('@/features/fuel/pages/RecipeWorkshopPage'), 'RecipeWorkshopPage')
const TeamFeedPage = lazyPage(() => import('@/features/insights/pages/TeamFeedPage'), 'TeamFeedPage')
const TeamPage = lazyPage(() => import('@/features/insights/pages/TeamPage'), 'TeamPage')
const CharacterRoomPage = lazyPage(() => import('@/features/insights/pages/CharacterRoomPage'), 'CharacterRoomPage')
const TeamChatPage = lazyPage(() => import('@/features/insights/pages/TeamChatPage'), 'TeamChatPage')
const BoopMenuPage = lazyPage(() => import('@/features/insights/pages/BoopMenuPage'), 'BoopMenuPage')
const BoopAboutPage = lazyPage(() => import('@/features/insights/pages/BoopAboutPage'), 'BoopAboutPage')
const RoladLifeEventsPage = lazyPage(() => import('@/features/insights/pages/RoladLifeEventsPage'), 'RoladLifeEventsPage')
const PatternsPage = lazyPage(() => import('@/features/insights/pages/PatternsPage'), 'PatternsPage')
const PatternDetailPage = lazyPage(() => import('@/features/insights/pages/PatternDetailPage'), 'PatternDetailPage')
const MemoirPage = lazyPage(() => import('@/features/insights/pages/MemoirPage'), 'MemoirPage')
const MemoirArchivePage = lazyPage(() => import('@/features/insights/pages/MemoirArchivePage'), 'MemoirArchivePage')
const MemoirChapterPage = lazyPage(() => import('@/features/insights/pages/MemoirChapterPage'), 'MemoirChapterPage')
const KnowledgeListPage = lazyPage(() => import('@/features/insights/pages/KnowledgeListPage'), 'KnowledgeListPage')
const ChatPage = lazyPage(() => import('@/features/insights/pages/ChatPage'), 'ChatPage')
const PredictionsPage = lazyPage(() => import('@/features/insights/pages/PredictionsPage'), 'PredictionsPage')
const ExperimentsPage = lazyPage(() => import('@/features/insights/pages/ExperimentsPage'), 'ExperimentsPage')
const DiagnosisListPage = lazyPage(() => import('@/features/insights/pages/DiagnosisListPage'), 'DiagnosisListPage')
const DiagnosisDetailPage = lazyPage(() => import('@/features/insights/pages/DiagnosisDetailPage'), 'DiagnosisDetailPage')
const CoachingHubPage = lazyPage(() => import('@/features/insights/pages/CoachingHubPage'), 'CoachingHubPage')
const CoachingObserverPage = lazyPage(() => import('@/features/insights/pages/CoachingObserverPage'), 'CoachingObserverPage')
const CoachingCardPage = lazyPage(() => import('@/features/insights/pages/CoachingCardPage'), 'CoachingCardPage')
const MemoryPage = lazyPage(() => import('@/features/insights/pages/MemoryPage'), 'MemoryPage')
const EnHubPage = lazyPage(() => import('@/features/me/pages/EnHubPage'), 'EnHubPage')
const GoalPlannerPage = lazyPage(() => import('@/features/me/pages/GoalPlannerPage'), 'GoalPlannerPage')
const NightPage = lazyPage(() => import('@/features/me/pages/NightPage'), 'NightPage')
const GrowthHubPage = lazyPage(() => import('@/features/me/pages/GrowthHubPage'), 'GrowthHubPage')
const GrowthSkillsPage = lazyPage(() => import('@/features/me/pages/GrowthSkillsPage'), 'GrowthSkillsPage')
const HabitPage = lazyPage(() => import('@/features/me/pages/HabitPage'), 'HabitPage')
const HabitEditPage = lazyPage(() => import('@/features/me/pages/HabitEditPage'), 'HabitEditPage')
const ChainPage = lazyPage(() => import('@/features/me/pages/ChainPage'), 'ChainPage')
const SzokasaidPage = lazyPage(() => import('@/features/me/pages/SzokasaidPage'), 'SzokasaidPage')
const RoutineWizardPage = lazyPage(() => import('@/features/me/pages/RoutineWizardPage'), 'RoutineWizardPage')
const RutinHubPage = lazyPage(() => import('@/features/me/pages/RutinHubPage'), 'RutinHubPage')
const GrowthNaploPage = lazyPage(() => import('@/features/me/pages/GrowthNaploPage'), 'GrowthNaploPage')
const GrowthAwardsPage = lazyPage(() => import('@/features/me/pages/GrowthAwardsPage'), 'GrowthAwardsPage')
const JournalPage = lazyPage(() => import('@/features/me/pages/JournalPage'), 'JournalPage')
const WeekHubPage = lazyPage(() => import('@/features/me/pages/WeekHubPage'), 'WeekHubPage')
const WeekAnalysisPage = lazyPage(() => import('@/features/me/pages/WeekAnalysisPage'), 'WeekAnalysisPage')
const WeekDaysPage = lazyPage(() => import('@/features/me/pages/WeekDaysPage'), 'WeekDaysPage')
const WeekLessonsPage = lazyPage(() => import('@/features/me/pages/WeekLessonsPage'), 'WeekLessonsPage')
const WeekDiscoveriesPage = lazyPage(() => import('@/features/me/pages/WeekDiscoveriesPage'), 'WeekDiscoveriesPage')
const GoalsPage = lazyPage(() => import('@/features/me/pages/GoalsPage'), 'GoalsPage')
const GoalDietPage = lazyPage(() => import('@/features/me/pages/GoalDietPage'), 'GoalDietPage')
const GoalSegmentPage = lazyPage(() => import('@/features/me/pages/GoalSegmentPage'), 'GoalSegmentPage')
const GoalPlansPage = lazyPage(() => import('@/features/me/pages/GoalPlansPage'), 'GoalPlansPage')
const GoalGuardsPage = lazyPage(() => import('@/features/me/pages/GoalGuardsPage'), 'GoalGuardsPage')
const GoalSuggestionPage = lazyPage(() => import('@/features/me/pages/GoalSuggestionPage'), 'GoalSuggestionPage')
const CelokPage = lazyPage(() => import('@/features/me/pages/CelokPage'), 'CelokPage')
const CelPage = lazyPage(() => import('@/features/me/pages/CelPage'), 'CelPage')
const CelWizardPage = lazyPage(() => import('@/features/me/pages/CelWizardPage'), 'CelWizardPage')
const JelekPage = lazyPage(() => import('@/features/me/pages/JelekPage'), 'default')
const WeightPage = lazyPage(() => import('@/features/me/pages/WeightPage'), 'WeightPage')
const SleepPage = lazyPage(() => import('@/features/me/pages/SleepPage'), 'SleepPage')
const PeoplePage = lazyPage(() => import('@/features/me/pages/PeoplePage'), 'PeoplePage')
const PeopleJeloltekPage = lazyPage(() => import('@/features/me/pages/PeopleJeloltekPage'), 'PeopleJeloltekPage')
const PeopleKorPage = lazyPage(() => import('@/features/me/pages/PeopleKorPage'), 'PeopleKorPage')
const PeopleEmlitesekPage = lazyPage(() => import('@/features/me/pages/PeopleEmlitesekPage'), 'PeopleEmlitesekPage')
const PeopleHetiPage = lazyPage(() => import('@/features/me/pages/PeopleHetiPage'), 'PeopleHetiPage')
const PersonDetailPage = lazyPage(() => import('@/features/me/pages/PersonDetailPage'), 'PersonDetailPage')
const NotificationFeedPage = lazyPage(() => import('@/features/me/pages/NotificationFeedPage'), 'NotificationFeedPage')
const RitualPage = lazyPage(() => import('@/features/ritual/pages/RitualPage'), 'RitualPage')
const MindenOldalPage = lazyPage(() => import('@/app/MindenOldalPage'), 'default')
const KarakterHubPage = lazyPage(() => import('@/features/character/pages/KarakterHubPage'), 'KarakterHubPage')
const DimensionsPage = lazyPage(() => import('@/features/character/pages/DimensionsPage'), 'DimensionsPage')
const DimensionPage = lazyPage(() => import('@/features/character/pages/DimensionPage'), 'DimensionPage')
const CharacterFeedPage = lazyPage(() => import('@/features/character/pages/CharacterFeedPage'), 'CharacterFeedPage')
const KonziliumPage = lazyPage(() => import('@/features/character/pages/KonziliumPage'), 'KonziliumPage')
const GeptermPage = lazyPage(() => import('@/features/character/pages/GeptermPage'), 'GeptermPage')
const FutasokPage = lazyPage(() => import('@/features/character/pages/FutasokPage'), 'FutasokPage')
const RunPage = lazyPage(() => import('@/features/character/pages/RunPage'), 'RunPage')
const AdatforrasokPage = lazyPage(() => import('@/features/character/pages/AdatforrasokPage'), 'AdatforrasokPage')
const KorPage = lazyPage(() => import('@/features/character/pages/KorPage'), 'KorPage')
const DetektorokPage = lazyPage(() => import('@/features/character/pages/DetektorokPage'), 'DetektorokPage')
const FuelRecipeScorePage = lazyPage(() => import('@/features/fuel/pages/FuelRecipeScorePage'), 'FuelRecipeScorePage')

// Design 2.0 shell (mezo-d20.1.1): /today → /nap and /insights → /mezo renames. The legacy
// paths survive as redirects (PWA bookmarks, in-app navigate() calls not yet migrated).
function LegacyPathRedirect({ prefix, to }: { prefix: string; to: string }) {
  const location = useLocation()
  return <Navigate to={location.pathname.replace(prefix, to) + location.search} replace />
}

/**
 * Fuel Titanium S5 (mezo-qt5q): the retired Fuel routes and where they now land. A saved
 * bookmark, a push notification (`notificationScheduleWriter.ts` FUEL_SLOT → /fuel/stack) or a
 * Kalauz step pointing at any of these must NEVER 404 — the catch-all `*` would silently eject
 * the user to /nap.
 *
 * The targets follow the DELIVERED surface, which corrects the plan's first draft in one place:
 * `/fuel/stack/meals` (manifest D4, étkezési kötések) is retired too, because S2 folded the
 * bindings into `FuelStackProtocolPage`'s own sub-section rather than leaving a second page.
 *
 *   /fuel/log                     → /fuel                  (A10: Mai is the canonical day list)
 *   /fuel/plan                    → /fuel/trendek          (C1/C6: weekly picture merged)
 *   /fuel/naplo                   → /fuel/trendek          (C5: day quality merged)
 *   /fuel/stack/today             → /fuel/stack            (D1: hub + Today are one page)
 *   /fuel/stack/meals             → /fuel/stack/protocol   (D4: bindings are a sub-section)
 *   /fuel/stack/manage{,/*}       → /fuel/stack/protocol   (D3: 4 manage pages folded in)
 *
 * `/fuel/stack/manage/add` (Új elem) SURVIVES — which is why this is an exact-path table and not
 * a `manage/*` prefix rule that would swallow it.
 */
export const FUEL_RETIRED_REDIRECTS: Record<string, string> = {
  '/fuel/log': '/fuel',
  '/fuel/plan': '/fuel/trendek',
  '/fuel/naplo': '/fuel/trendek',
  '/fuel/stack/today': '/fuel/stack',
  '/fuel/stack/meals': '/fuel/stack/protocol',
  '/fuel/stack/manage': '/fuel/stack/protocol',
  '/fuel/stack/manage/protocol': '/fuel/stack/protocol',
  '/fuel/stack/manage/timing': '/fuel/stack/protocol',
  '/fuel/stack/manage/meals': '/fuel/stack/protocol',
}

/** Keeps the query string, so a `?d=2026-09-08` bookmark of a paged-back day lands on that SAME
 *  day on the new page (Mai derives the viewed day from `?d=`), not on today. */
function RetiredRouteRedirect({ to }: { to: string }) {
  const location = useLocation()
  return <Navigate to={to + location.search} replace />
}

/** Route objects for the table above — one source of truth, so a row can never be listed as
 *  redirected while its path stays unmatched (the test asserts both directions). */
const fuelRetiredRedirectRoutes: RouteObject[] = Object.entries(FUEL_RETIRED_REDIRECTS).map(
  ([from, to]) => ({ path: from.slice(1), element: <RetiredRouteRedirect to={to} /> }),
)

/**
 * Owner-gates a legacy redirect that lands inside `/admin` (mezo-d5iy.17). The two entries
 * this wraps — `me/beallitasok/admin` and `me/ai-usage/*` — sit INSIDE the AppLayout route
 * tree, so any authenticated user (not just owners) can reach them via an old bookmark or a
 * stale in-app `navigate()` call. Without this gate, a non-owner following one lands on
 * `/admin`, where `AdminLayout` fires an error toast and bounces them back to `/` — a jarring
 * "eject" UX for what should just be a quiet dead link.
 *
 * Mirrors `AdminLayout`'s own owner check (`useMe().data?.role === 'OWNER'`) so the two stay
 * in lockstep, but resolves silently instead of via AdminLayout's toast-and-bounce: a
 * non-owner here never even reaches `/admin` to trigger that path.
 *
 * - pending (`me.data` not yet resolved) → render nothing; don't guess either way.
 * - owner → perform the wrapped redirect (`children`).
 * - non-owner → silently redirect to `/`, no toast.
 */
function OwnerOnlyRedirect({ children }: { children: ReactNode }) {
  const me = useMe()
  if (me.isPending) return null
  const isOwner = me.data?.role === 'OWNER'
  if (!isOwner) return <Navigate to="/" replace />
  return <>{children}</>
}

/** `/train/mesocycles/:id/overview` — the retired standalone Volumen page (mezo-d20.15
 *  Task 4): its provenance anatomy moved into MesoMusclePage (reached from the week
 *  page's tiles), so a bookmark/in-app navigate() to the old route lands on the week
 *  page instead — the nearest surviving equivalent (Heti vizsgálat), not a dead end. */
function RedirectToWeek() {
  const { id } = useParams<{ id: string }>()
  return <Navigate to={`/train/mesocycles/${id}/week`} replace />
}

/** `/me/knowledge` — the old standalone Tudásgráf page (mezo-ms9a: merged into the
 *  unified Tudástár) — redirects to that page's Kategóriák view. A `?kind=` deep link
 *  (old page's tile-drill) is forwarded as `&kind=` so bookmarks/notifications still
 *  land in the same category. */
function MeKnowledgeRedirect() {
  const [params] = useSearchParams()
  const kind = params.get('kind')
  return <Navigate to={`/mezo/knowledge?view=kategoriak${kind ? `&kind=${kind}` : ''}`} replace />
}

/** `/me/week/napok/:date` — the retired single-day route (mezo-yjzhw.4: A napom replaces
 *  the Napzárás tab and becomes the day's own address). The mosaic (`/me/week/napok`)
 *  survives; only the ONE-day deep link forwards, so an old bookmark or push-notification
 *  link still lands on a day, just the new one. */
function NapomRedirect() {
  const { date } = useParams<{ date: string }>()
  return <Navigate to={`/nap/napom/${date ?? ''}`} replace />
}

/** `/train` has no face of its own under the four-tab IA (owner 2026-09-12) — it forwards
 *  to Mai, keeping the legacy Heti `?day={0..6}` deep-link intact. */
function TrainIndex() {
  const [params] = useSearchParams()
  const day = params.get('day')
  return <Navigate to={`/train/mai${day !== null && day !== '' ? `?day=${day}` : ''}`} replace />
}

export const routes: RouteObject[] = [
  // Registered BEFORE the app root so `/admin` is matched by its own layout (desktop
  // shell, no PhoneFrame/BottomBar) rather than falling into AppLayout's `*` catch-all
  // (mezo-d5iy.9). The two trees are otherwise disjoint — no path collides.
  ...adminRoutes,
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/nap" replace /> },
      { path: 'nap', element: <NapHubPage /> },
      // A napom (mezo-yjzhw.4): replaces the Napzárás tab — the day's own reading + next
      // action, deep-linkable by date (a closed day's review, a push notification).
      { path: 'nap/napom', element: <NapomPage /> },
      { path: 'nap/napom/:date', element: <NapomPage /> },
      // Nap tile → own full page (mezo-d20.2.2): the hub's Mezo tile.
      { path: 'nap/uzenetek', element: <NapMezoPage /> },
      { path: 'nap/rutin', element: <NapRutinPage /> },
      // Nap tile → own page (F1.4, mezo-d20.2.4): Napi küldetések detail
      { path: 'nap/kuldetesek', element: <NapKuldetesekPage /> },
      // Nap tile → own full page (Huawei pattern, mezo-d20.2.5)
      { path: 'nap/checkin', element: <NapCheckinPage /> },
      // FAB Titanium destination FROM /nap exactly (mezo-mhum): full-page quick-log picker,
      // sharing `QuickLogSurface` with the `QuickInputSheet` modal used everywhere else.
      { path: 'nap/gyors', element: <NapGyorsPage /> },
      // Nap detail pages (F1.2–F1.6) — full-page siblings, tile → own page (Huawei pattern).
      { path: 'nap/eletjel', element: <EletjelPage /> },
      { path: 'today/*', element: <LegacyPathRedirect prefix="/today" to="/nap" /> },
      // Edzés tab — Train Titanium T4 (mezo-88iwa.5): the six-tile Mozaik hub that
      // replaced the original AppHero/SubNavDropdown shell is ITSELF retired now.
      // /train has no face of its own any more — TrainIndex below unconditionally
      // redirects it to /train/mai. Four owner-approved tabs (Mai/Terv/Terhelés/
      // Gyakorlatok, navModel.ts's `train` row) light the global BottomBar; every route
      // below is a full-page sibling reached either as a tab home or via that tab's
      // `owns` deep-route list — see docs/features/train.md for the tab → route map.
      { path: 'train', element: <TrainIndex /> },
      { path: 'train/mai', element: <TrainTodayPage /> },
      { path: 'train/week', element: <TrainWeekPage /> },
      // Terhelés subpages (Train Titanium T12 Task 4, + `jelek` from parity P2 Task 1):
      // all three sit UNDER /train/week, and the Terhelés tab also OWNS the path
      // explicitly (navModel.ts) so the lit tab is a statement, not a prefix guess.
      { path: 'train/week/terkep', element: <TrainWeekMapPage /> },
      { path: 'train/week/mozgas', element: <TrainWeekMozgasPage /> },
      { path: 'train/week/jelek', element: <TrainWeekJelekPage /> },
      { path: 'train/gym', element: <GymPage /> },
      { path: 'train/sport', element: <SportPage /> },
      // The full-screen sport-logging flow (mezo-88iwa.9, T8): pick a sport, then only the
      // fields that sport actually asks. Sits UNDER /train/sport, so the Mai tab's own
      // `/train/sport` ownership already lights it (navModel.ts `isPrefix`).
      { path: 'train/sport/log', element: <SportLogPage /> },
      { path: 'train/futas', element: <RunningPage /> },
      { path: 'train/exercises', element: <ExercisesPage /> },
      // ONE exercise's whole story (Train parity P2 Task 5, mezo-lf3cv) — the catalogue
      // card's target. `:key` is the catalog uuid when the row has one, else the local
      // catalogue row's own id (`exerciseKey`). Listed after the static catalogue route
      // (React Router ranks static over dynamic anyway); the Gyakorlatok tab's
      // `owns: ['/train/exercises']` already lights it by prefix (navModel.isPrefix).
      { path: 'train/exercises/:key', element: <ExerciseStoryPage /> },
      { path: 'train/medals', element: <MedalsPage /> },
      { path: 'train/mesocycles', element: <MesoTervPage /> },
      // The plan library (Train Titanium T9 Task 2, mezo-88iwa.10): the landing's
      // Sablonok/Új blokk/Futóblokkok tiles + Tervezett + Történet moved here intact
      // behind the landing's `Edzéstervek` doorway.
      { path: 'train/mesocycles/konyvtar', element: <MesoKonyvtarPage /> },
      // „Lezárt futamaid" (Train Titanium T10 Task 2, mezo-88iwa.11): the library's
      // Történet section moved here verbatim when the landing was refaced, so the closed
      // runs never lost their entry. Task 4 gives the page its own Titanium face.
      { path: 'train/mesocycles/futamok', element: <MesoFutamokPage /> },
      // Sablonok (mezo-tlwa) folds into the Mesociklus page in the new IA, but the
      // route stays reachable (the library's nav row still links here).
      { path: 'train/templates', element: <MesoTemplatesPage /> },
      // One template, READ-FIRST (Train Titanium T10 Task 3, mezo-88iwa.11): the week
      // spelled out, its weekly per-muscle load, the runs that came out of it, and the
      // start/edit CTAs. Listed AFTER the plain list route (React Router ranks static
      // over dynamic anyway); the Terv tab's `owns: ['/train/templates']` already covers
      // it by prefix (navModel.isPrefix). NOT to be confused with
      // `train/mesocycles/templates/:id`, which is the raw day-plan EDITOR.
      { path: 'train/templates/:id', element: <MesoTemplateStoryPage /> },
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
      // ONE day of a running block (mezo-d20.15): the run page is status-first and the
      // editing lives here, one level down. The day token travels URL-encoded ('H%C3%A9t').
      { path: 'train/mesocycles/:id/days/:day', element: <MesoDayPage /> },
      // …and its EDITOR, one level further down (Train parity P1 Task 4, mezo-e1ii9).
      // The day page used to carry a whole pre-Titanium editor welded under the Titanium
      // content; it lives here now, the way the TEMPLATE's day plan lives at
      // `train/mesocycles/templates/:id`. `?add=1` opens the exercise picker on arrival.
      { path: 'train/mesocycles/:id/days/:day/edit', element: <MesoDayEditPage /> },
      // „Heti vizsgálat" + „izom-részlet" (mezo-d20.15 Task 4) — absorbs the retired
      // Volumen page's provenance anatomy (MesoMusclePage's DerivationSteps).
      { path: 'train/mesocycles/:id/week', element: <MesoWeekPage /> },
      { path: 'train/mesocycles/:id/week/:muscle', element: <MesoMusclePage /> },
      { path: 'train/mesocycles/:id/overview', element: <RedirectToWeek /> },
      { path: 'train/custom/new', element: <CustomWorkoutBuilderPage /> },
      { path: 'train/custom/:id', element: <CustomWorkoutBuilderPage /> },
      { path: 'train/futas/:id', element: <RunningBlockBuilderPage /> },
      // Fuel tab — Design 2.0 shell dissolution (mezo-d20.4.1): the Fuel shell
      // (AppHero + SubNavDropdown + its ⚙️ Fuel-beállítások action) is gone. /fuel is
      // the hub Mozaik face, which carries the settings band itself; the former
      // sub-tabs are FULL-PAGE SIBLINGS on their stable routes (they keep their
      // current faces until their own F3 slices land) — the same idiom the Mezo
      // (mezo-d20.5.1) and Én (mezo-d20.6.1) tabs took.
      { path: 'fuel', element: <FuelMaiPage /> },
      // A blokk-CTA-k saját logoló oldala (mezo-bq2t) — a kontextus az URL-ben él (d/w/ai).
      { path: 'fuel/log/uj', element: <FuelLogNewPage /> },
      // Fuel Titanium S1b (mezo-33k6): az étkezés AI értékelése saját oldalon — A11.
      // A hosszabb (statikus végű) útvonal áll előbb, a fájl konvenciója szerint.
      { path: 'fuel/etkezes/:id/ertekeles', element: <FuelMealScorePage /> },
      // Fuel Titanium S1b (mezo-33k6): egy logolt étkezés részletei — A10/A14.
      { path: 'fuel/etkezes/:id', element: <FuelMealDetailPage /> },
      // Fuel Titanium S0 (mezo-o6uv): a két új cél route-ja — a tartalom S3/S4.
      { path: 'fuel/trendek', element: <FuelTrendekPage /> },
      // „Hogy tanultam?” (mezo-3n2so): the learned base week by week, the last 14 days' switches and
      // the six-section explainer — opened from the energy sheet, the weekly sheet and the bell.
      { path: 'fuel/tanulas', element: <LearningPage /> },
      { path: 'fuel/konyha', element: <FuelKonyhaPage /> },
      { path: 'fuel/stack', element: <FuelStackPage /> },
      { path: 'fuel/stack/protocol', element: <FuelStackProtocolPage /> },
      { path: 'fuel/stack/manage/add', element: <FuelStackAddPage /> },
      { path: 'fuel/kamra', element: <FuelKamraPage /> },
      { path: 'fuel/kamra/:id', element: <KamraItemDetailPage /> },
      { path: 'fuel/gyogyszer', element: <FuelMedicationPage /> },
      // `new` is listed before `:id` for clarity (React Router ranks static over dynamic).
      { path: 'fuel/recipes/new', element: <RecipeEditorPage /> },
      // Receptműhely (mezo-92pb) — static, so it must precede `:id`; `?recipeId=` seeds it.
      { path: 'fuel/recipes/muhely', element: <RecipeWorkshopPage /> },
      { path: 'fuel/recipes', element: <FuelRecipesPage /> },
      { path: 'fuel/recipes/:id', element: <RecipeDetailPage /> },
      // mezo-jb84: a recept AI értékelése a Titán felületen — ugyanaz, mint az étkezésé.
      { path: 'fuel/recipes/:id/ertekeles', element: <FuelRecipeScorePage /> },
      { path: 'fuel/recipes/:id/edit', element: <RecipeEditorPage /> },
      // Fuel settings is a full-page sibling; its meal-window row continues to the
      // dedicated slot-template editor (mezo-7102).
      ...settingsRoutes,
      { path: 'settings/account', element: <AccountSettingsPage /> },
      { path: 'settings/mezo/about', element: <MezoPersonalPage mode="about" /> },
      { path: 'settings/mezo/communication', element: <MezoPersonalPage mode="communication" /> },
      { path: 'settings/mezo/context', element: <MezoPersonalPage mode="context" /> },
      { path: 'fuel/settings', element: <Navigate to="/settings/fuel" replace /> },
      { path: 'fuel/slots', element: <Navigate to="/settings/fuel/slots" replace /> },
      // Fuel Titanium S5 (mezo-qt5q): a leváltott Fuel-útvonalak redirectjei — `FUEL_RETIRED_REDIRECTS`.
      ...fuelRetiredRedirectRoutes,
      // Pattern-pair detail (mezo-tk88.5) — a full leaf page, same sibling idiom as
      // fuel/recipes/:id above (no Insights sub-nav chrome).
      { path: 'mezo/patterns/:pairKey', element: <PatternDetailPage /> },
      { path: 'insights/*', element: <LegacyPathRedirect prefix="/insights" to="/mezo" /> },
      // Mezo tab — Design 2.0 shell dissolution (mezo-d20.5.1): the Insights shell
      // (AppHero + SubNavDropdown) is gone. /mezo is the hub Mozaik face; the former
      // sub-tabs are FULL-PAGE SIBLINGS on their stable paths (they render their own
      // MozaikPage scaffolds as their F4 slices land). Minták — previously the /mezo
      // index — lives at /mezo/patterns, next to the pattern-pair detail leaf above.
      // Csapat-üzenőfal (mezo-a9bo7.10): the wall IS the Mezo home.
      { path: 'mezo', element: <TeamFeedPage /> },
      { path: 'mezo/csapat', element: <TeamPage /> },
      // Csapatfal Act III (mezo-a9bo7.24): a csapat élő beszélgetése (`?d=YYYY-MM-DD` = másik nap).
      { path: 'mezo/elo', element: <TeamChatPage /> },
      { path: 'mezo/csapat/:id', element: <CharacterRoomPage /> },
      { path: 'mezo/emlekek', element: <BoopMemoriesPage /> },
      { path: 'mezo/emlekek/:date', element: <MemoryDayPage /> },
      { path: 'mezo/knowledge/node/:id', element: <KnowledgeNodePage /> },
      { path: 'mezo/predictions/:id', element: <PredictionDetailPage /> },
      { path: 'mezo/experiments/:id', element: <ExperimentDetailPage /> },
      // The old 12-tile menu is the Gépterem's „Összes funkció” dev-menu now (spec §2.4);
      // a saved `/mezo/menu` link lands on the same grid.
      { path: 'mezo/menu', element: <Navigate to={ALL_FEATURES_ROUTE} replace /> },
      { path: 'mezo/rolad', element: <BoopAboutPage /> },
      // S6c (mezo-2dfy2): the life-event timeline moved behind the Rólad page's own door.
      { path: 'mezo/rolad/eletesemenyek', element: <RoladLifeEventsPage /> },
      { path: 'mezo/patterns', element: <PatternsPage /> },
      // Heti retired (mezo-p2tr): the review moved to /me/week (WeekHubPage) — including the
      // score hero, the growth card and the weekly tervjavaslat prose. The route survives as
      // an honest redirect so any old bookmark/link still lands somewhere sensible.
      { path: 'mezo/weekly', element: <Navigate to="/me/week" replace /> },
      { path: 'mezo/memoir', element: <MemoirPage /> },
      // F7.5 (mezo-d20.8.5): the archive shelf + one chapter (static segment ranks above the param)
      { path: 'mezo/memoir/archivum', element: <MemoirArchivePage /> },
      { path: 'mezo/memoir/:weekStart', element: <MemoirChapterPage /> },
      { path: 'mezo/knowledge', element: <KnowledgeListPage /> },
      { path: 'mezo/chat', element: <ChatPage /> },
      { path: 'mezo/predictions', element: <PredictionsPage /> },
      { path: 'mezo/experiments', element: <ExperimentsPage /> },
      // Diagnózis — the on-demand report catalog (mezo-hqfi.4): full-page siblings on the
      // patterns/:pairKey idiom; Hungarian slug per the spec's resolved micro-decision.
      { path: 'mezo/diagnozis', element: <DiagnosisListPage /> },
      { path: 'mezo/diagnozis/:id', element: <DiagnosisDetailPage /> },
      // Proaktív coaching (mezo-6269.3) — the decision made visible: hub → Megfigyelő → a napi
      // kártya. Flat `/mezo/*` siblings, the `mezo/diagnozis` idiom; static segments only, so
      // no ordering hazard with a param route.
      { path: 'mezo/coaching', element: <CoachingHubPage /> },
      { path: 'mezo/coaching/megfigyelo', element: <CoachingObserverPage /> },
      { path: 'mezo/coaching/kartya', element: <CoachingCardPage /> },
      // Motor retired (mezo-tk88.4) — the diagnostics moved into the Minták dashboard +
      // the pattern-pair detail page above (mezo-tk88.5); the route survives as an honest
      // redirect so any old bookmark/link (`?pair=` cross-links included) still lands
      // somewhere sensible.
      { path: 'mezo/motor', element: <Navigate to="/mezo/patterns" replace /> },
      { path: 'mezo/memoria', element: <MemoryPage /> },
      // Karakter dossier — moved from `/me/karakter/*` into the Mezo domain (mezo-jkh4) so
      // the Mezo bar stays active on the Karakter surface (active domain = first segment).
      // The component files are unchanged; only the route PATHS moved (legacy `/me/karakter/*`
      // redirects live in the Én section below).
      // Karakter dossier hub (mezo-1gim.13) — the Mezo hub's Karakter tile.
      { path: 'mezo/karakter', element: <KarakterHubPage /> },
      // Dimenziók/dimenzió/feed full-page siblings (Task 4); Csapat/Konzílium (Task 5) —
      // Konzílium's transcript view rides `?id=` on the SAME route (the WeekHub sibling
      // idiom, e.g. WeekLessonsPage's `?start=`), not a child route.
      { path: 'mezo/karakter/dimenziok', element: <DimensionsPage /> },
      { path: 'mezo/karakter/dimenzio/:key', element: <DimensionPage /> },
      { path: 'mezo/karakter/feed', element: <CharacterFeedPage /> },
      // The 9-expert roster retired (U9, mezo-me75u.9, owner 2026-09-25): the team is the csapatfal's
      // five characters now — an old link lands on A csapat.
      { path: 'mezo/karakter/csapat', element: <Navigate to="/mezo/csapat" replace /> },
      { path: 'mezo/karakter/konzilium', element: <KonziliumPage /> },
      // Gépterem (mezo-1gim.14, Task 4) — the geek-transparency hub + its Futások timeline +
      // the generic run-detail page every row (and, from Task 5, every Feed ⚙) opens into.
      { path: 'mezo/karakter/gepterem', element: <GeptermPage /> },
      { path: 'mezo/karakter/gepterem/osszes', element: <BoopMenuPage /> },
      { path: 'mezo/karakter/gepterem/futasok', element: <FutasokPage /> },
      { path: 'mezo/karakter/gepterem/futas/:id', element: <RunPage /> },
      // Adatforrások/kör/Detektorok (Task 5) — the kör mini-pages are discrete indexed items
      // (DimensionsPage's `/dimenzio/:key` sibling idiom), not a continuous stepped range, so
      // they get a path param (`/kor/:n`), not FutasokPage's `?start=` query-param idiom.
      { path: 'mezo/karakter/gepterem/adatforrasok', element: <AdatforrasokPage /> },
      { path: 'mezo/karakter/gepterem/adatforrasok/kor/:n', element: <KorPage /> },
      { path: 'mezo/karakter/gepterem/detektorok', element: <DetektorokPage /> },
      // Én tab — Design 2.0 shell dissolution (mezo-d20.6.1): the Me shell
      // (AppHero + SubNavDropdown + its ⚙️ Beállítások action) is gone. /me is the hub
      // Mozaik face, which carries the settings band itself; the former sub-tabs are
      // full-page siblings on their stable routes (they keep their current faces until
      // their own F5 slices land) — the same idiom the Mezo tab took in mezo-d20.5.1.
      { path: 'me', element: <EnHubPage /> },
      // Karakter moved to the Mezo domain (mezo-jkh4): the dossier now lives under
      // `/mezo/karakter/*` (registered in the Mezo section above) so the Mezo bar stays
      // active on the Karakter surface. Every legacy `/me/karakter/*` link — old bookmarks,
      // notification deep-links (character_portrait, konzilium_verdict) — redirects there,
      // preserving the subpath and query (the /today, /insights redirect idiom).
      { path: 'me/karakter/*', element: <LegacyPathRedirect prefix="/me/karakter" to="/mezo/karakter" /> },
      // Growth hub (mezo-rmi0.1) — hero + Ma strip + 2×2 mosaic; the four sub-pages are flat siblings below (added per task).
      { path: 'me/growth', element: <GrowthHubPage /> },
      { path: 'me/growth/skillek', element: <GrowthSkillsPage /> },
      { path: 'me/growth/naplo', element: <GrowthNaploPage /> },
      { path: 'me/growth/kituntetesek', element: <GrowthAwardsPage /> },
      // Routine BUILDING lives on Nap's Rutin tab (mezo-lhqw7, „egy téma, egy hely"): ticking is
      // /nap/rutin, building is /nap/rutin/epites (+ the pages below). Absorbed /me/rutin (mezo-3zue),
      // /me/growth/rutin (mezo-rmi0.1) and the /me/routines/edit editor.
      { path: 'nap/rutin/epites', element: <RutinHubPage /> },
      // The 4-step recipe wizard (mezo-3zue.4). Registered BEFORE any `:param` sibling so
      // "uj" can never be swallowed as a habit key.
      { path: 'nap/rutin/uj', element: <RoutineWizardPage /> },
      // One chain's own page (mezo-vxd8): rename, daypart, order + the stacking drawn.
      { path: 'nap/rutin/lanc/:chainKey', element: <ChainPage /> },
      // The habit list on its own page (mezo-mgpr): stage filters + one tile per habit.
      { path: 'nap/rutin/szokasok', element: <SzokasaidPage /> },
      // The single-recipe page (mezo-3zue.4). LAST of the `nap/rutin/szokas*` family: every static
      // sibling is registered above it so none is swallowed as a habit key. The parameter is
      // the habitKey (what the hub's rows link with), not the definition id.
      { path: 'nap/rutin/szokas/:habitKey', element: <HabitPage /> },
      // The recipe editor on its own page (mezo-bk26, choice board option B): HabitPage is the
      // details surface, every definition write lives here.
      { path: 'nap/rutin/szokas/:habitKey/szerkesztes', element: <HabitEditPage /> },
      // Én IA (mezo-lhqw7): the old /me/rutin home moved — old URLs (bookmarks, stored
      // notifications with /me/rutin/szokas/…) must never 404.
      { path: 'me/rutin', element: <RetiredRouteRedirect to="/nap/rutin/epites" /> },
      { path: 'me/rutin/*', element: <LegacyPathRedirect prefix="/me/rutin" to="/nap/rutin" /> },
      { path: 'me/growth/rutin', element: <RetiredRouteRedirect to="/nap/rutin/epites" /> },
      { path: 'me/routines/edit', element: <RetiredRouteRedirect to="/nap/rutin/epites" /> },
      { path: 'me/naplo', element: <JournalPage /> },
      // Heti hub (mezo-d20.6.10) — the Design 2.0 tile hub replacing the long-scroll
      // WeekPage. Its four view tiles open full-screen siblings, NOT child routes: the
      // Heti detail pages take the same "tile → own page" idiom as the Nap/Fuel/Mezo tabs.
      // The browsed week rides along in `?start=` (absent = the current week).
      { path: 'me/week', element: <WeekHubPage /> },
      { path: 'me/week/elemzes', element: <WeekAnalysisPage /> },
      // The day mosaic, and ONE day as its own deep-linkable route (audit gap §8.3/6 —
      // a push notification can point at a day). The day page derives the week from
      // `:date` when `?start=` is absent.
      { path: 'me/week/napok', element: <WeekDaysPage /> },
      { path: 'me/week/napok/:date', element: <NapomRedirect /> },
      { path: 'me/week/tanulsagok', element: <WeekLessonsPage /> },
      { path: 'me/week/felfedezesek', element: <WeekDiscoveriesPage /> },
      { path: 'me/goals', element: <CelokPage /> },
      // Weight goal moved under /me/goals/weight (mezo-iizd.1, Task 8) — /me/goals itself is
      // now the Célok (life-goals) hub (Task 9), and Task 10 adds `me/goals/:id`; these
      // static children stay registered ahead of that future dynamic sibling per the
      // `me/people/*` precedent above (React Router ranks static over dynamic regardless of
      // source order, but the ordering stays explicit here too).
      { path: 'me/goals/weight', element: <GoalsPage /> },
      { path: 'me/goals/weight/diet', element: <GoalDietPage /> },
      { path: 'me/goals/weight/segment', element: <GoalSegmentPage /> },
      { path: 'me/goals/weight/plans', element: <GoalPlansPage /> },
      { path: 'me/goals/weight/guards', element: <GoalGuardsPage /> },
      { path: 'me/goals/weight/settings', element: <Navigate to="/settings/me/goal" replace /> },
      { path: 'me/goals/weight/suggestions/:suggestionId', element: <GoalSuggestionPage /> },
      { path: 'me/goals/weight/new', element: <GoalPlannerPage /> },
      // Task 11's five-step wizard (mezo-iizd.1) — another static `me/goals/*` sibling,
      // registered ahead of the dynamic `me/goals/:id` below per the same precedent.
      { path: 'me/goals/new', element: <CelWizardPage /> },
      // Jelek · transzparencia-oldal (mezo-iizd.7) — újabb STATIKUS `me/goals/*` testvér, a
      // dinamikus `me/goals/:id` elé regisztrálva, ugyanazon precedens szerint.
      { path: 'me/goals/signals', element: <JelekPage /> },
      // Goal detail (Task 10, mezo-iizd.1) — registered AFTER every static `me/goals/*`
      // sibling above (React Router ranks static over dynamic regardless of source order,
      // but the ordering stays explicit here per the `me/people/:id` precedent).
      { path: 'me/goals/:id', element: <CelPage /> },
      { path: 'me/weight', element: <WeightPage /> },
      { path: 'me/sleep', element: <SleepPage /> },
      // Emberek S3 hub (mezo-06o0.2): static children BEFORE `me/people/:id` (Task 3's "A
      // köröm" detail route) — React Router ranks static over dynamic regardless of source
      // order, but the WeekHub precedent (me/week/napok/:date) keeps the ordering explicit
      // here too. `kor`/`emlitesek`/`heti` are the hub tiles' destinations; Task 3–5 own
      // those page components — this slice only wires `jeloltek` (S3) and the hub itself.
      { path: 'me/people', element: <PeoplePage /> },
      { path: 'me/people/jeloltek', element: <PeopleJeloltekPage /> },
      { path: 'me/people/kor', element: <PeopleKorPage /> },
      { path: 'me/people/emlitesek', element: <PeopleEmlitesekPage /> },
      { path: 'me/people/heti', element: <PeopleHetiPage /> },
      // Person detail (Task 4) — registered AFTER every static `me/people/*` sibling
      // above (React Router ranks static over dynamic regardless of source order, but
      // the ordering stays explicit here per the WeekHub/`me/week/napok/:date` precedent).
      { path: 'me/people/:id', element: <PersonDetailPage /> },
      { path: 'me/knowledge', element: <MeKnowledgeRedirect /> },
      // mezo-nol0: a főnevet a FEED viszi (ide vezet a fejléc dropdown „Összes értesítés ›"
      // lábléce), a kapcsolók alá költöztek.
      { path: 'me/ertesitesek', element: <NotificationFeedPage /> },
      { path: 'me/ertesitesek/beallitasok', element: <Navigate to="/settings/notifications" replace /> },
      // Beállítások oldal (hub-tile-reorg): az Én hub Beállítások csempéjének célja —
      // Téma helyben + az Értesítések-kapcsolók és az AI-napló ajtajai.
      { path: 'me/beallitasok', element: <Navigate to="/settings" replace /> },
      // Beta admin + AI-napló (mezo-qw37.3 / mezo-uakh) moved under /admin (mezo-d5iy.13) — both
      // were OWNER-only already, so they now live beside the rest of the owner console. These
      // two entries are pure redirects for old bookmarks/in-app navigate() calls, not pages.
      {
        path: 'me/beallitasok/admin',
        element: <OwnerOnlyRedirect><Navigate to="/admin/accounts" replace /></OwnerOnlyRedirect>,
      },
      {
        path: 'me/ai-usage/*',
        element: <OwnerOnlyRedirect><LegacyPathRedirect prefix="/me/ai-usage" to="/admin/cost" /></OwnerOnlyRedirect>,
      },
      // Full-screen night surface (train/session idiom) — no Me sub-nav chrome.
      { path: 'me/sleep/night', element: <NightPage /> },
      // Full-screen Napzárás flow (train/session idiom) — no tab-bar chrome (mezo-ilsj).
      { path: 'ritual', element: <RitualPage /> },
      // Az oldal-leltár (mezo-ju4j6.17) — a területváltó alsó sorából nyílik, nem fülből.
      // Domain-en KÍVÜL él szándékosan: minden területet egyszerre mutat, és a `#nap`…`#me`
      // horgonnyal arra a szakaszra nyit, ahonnan érkeztél.
      { path: 'minden', element: <MindenOldalPage /> },
      { path: '*', element: <Navigate to="/nap" replace /> },
    ],
  },
]

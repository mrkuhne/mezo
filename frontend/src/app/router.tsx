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
import { EdzesHubPage } from '@/features/train/pages/EdzesHubPage'
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
import { MesoWeekPage } from '@/features/train/pages/MesoWeekPage'
import { MesoMusclePage } from '@/features/train/pages/MesoMusclePage'
import { MesoDayPage } from '@/features/train/pages/MesoDayPage'
import { MesoReportPage } from '@/features/train/pages/MesoReportPage'
import { MesoComparePage } from '@/features/train/pages/MesoComparePage'
import { MesoTemplateEditorPage } from '@/features/train/pages/MesoTemplateEditorPage'
import { RunningBlockBuilderPage } from '@/features/train/pages/RunningBlockBuilderPage'
import { CustomWorkoutBuilderPage } from '@/features/train/pages/CustomWorkoutBuilderPage'
import { FuelMaiPage } from '@/features/fuel/pages/FuelMaiPage'
import { FuelLogNewPage } from '@/features/fuel/pages/FuelLogNewPage'
import { FuelMealDetailPage } from '@/features/fuel/pages/FuelMealDetailPage'
import { FuelMealScorePage } from '@/features/fuel/pages/FuelMealScorePage'
import { FuelTrendekPage } from '@/features/fuel/pages/FuelTrendekPage'
import { FuelKonyhaPage } from '@/features/fuel/pages/FuelKonyhaPage'
import { FuelStackPage } from '@/features/fuel/pages/FuelStackPage'
import { FuelStackProtocolPage } from '@/features/fuel/pages/FuelStackProtocolPage'
import { FuelStackAddPage } from '@/features/fuel/pages/FuelStackAddPage'
import { FuelRecipesPage } from '@/features/fuel/pages/FuelRecipesPage'
import { FuelKamraPage } from '@/features/fuel/pages/FuelKamraPage'
import { KamraItemDetailPage } from '@/features/fuel/pages/KamraItemDetailPage'
import { FuelMedicationPage } from '@/features/fuel/pages/FuelMedicationPage'
import { RecipeDetailPage } from '@/features/fuel/pages/RecipeDetailPage'
import { RecipeEditorPage } from '@/features/fuel/pages/RecipeEditorPage'
import { RecipeWorkshopPage } from '@/features/fuel/pages/RecipeWorkshopPage'
import { FuelSettingsPage } from '@/features/fuel/pages/FuelSettingsPage'
import { FuelSlotsPage } from '@/features/fuel/pages/FuelSlotsPage'
import { MezoHubPage } from '@/features/insights/pages/MezoHubPage'
import { PatternsPage } from '@/features/insights/pages/PatternsPage'
import { PatternDetailPage } from '@/features/insights/pages/PatternDetailPage'
import { MemoirPage } from '@/features/insights/pages/MemoirPage'
import { MemoirArchivePage } from '@/features/insights/pages/MemoirArchivePage'
import { MemoirChapterPage } from '@/features/insights/pages/MemoirChapterPage'
import { KnowledgeListPage } from '@/features/insights/pages/KnowledgeListPage'
import { ChatPage } from '@/features/insights/pages/ChatPage'
import { PredictionsPage } from '@/features/insights/pages/PredictionsPage'
import { ExperimentsPage } from '@/features/insights/pages/ExperimentsPage'
import { DiagnosisListPage } from '@/features/insights/pages/DiagnosisListPage'
import { DiagnosisDetailPage } from '@/features/insights/pages/DiagnosisDetailPage'
import { CoachingHubPage } from '@/features/insights/pages/CoachingHubPage'
import { CoachingObserverPage } from '@/features/insights/pages/CoachingObserverPage'
import { CoachingCardPage } from '@/features/insights/pages/CoachingCardPage'
import { MemoryPage } from '@/features/insights/pages/MemoryPage'
import { EnHubPage } from '@/features/me/pages/EnHubPage'
import { GoalPlannerPage } from '@/features/me/pages/GoalPlannerPage'
import { NightPage } from '@/features/me/pages/NightPage'
import { GrowthHubPage } from '@/features/me/pages/GrowthHubPage'
import { GrowthSkillsPage } from '@/features/me/pages/GrowthSkillsPage'
import { HabitPage } from '@/features/me/pages/HabitPage'
import { HabitEditPage } from '@/features/me/pages/HabitEditPage'
import { ChainPage } from '@/features/me/pages/ChainPage'
import { SzokasaidPage } from '@/features/me/pages/SzokasaidPage'
import { RoutineWizardPage } from '@/features/me/pages/RoutineWizardPage'
import { RutinHubPage } from '@/features/me/pages/RutinHubPage'
import { GrowthNaploPage } from '@/features/me/pages/GrowthNaploPage'
import { GrowthAwardsPage } from '@/features/me/pages/GrowthAwardsPage'
import { JournalPage } from '@/features/me/pages/JournalPage'
import { WeekHubPage } from '@/features/me/pages/WeekHubPage'
import { WeekAnalysisPage } from '@/features/me/pages/WeekAnalysisPage'
import { WeekDaysPage } from '@/features/me/pages/WeekDaysPage'
import { WeekDayPage } from '@/features/me/pages/WeekDayPage'
import { WeekLessonsPage } from '@/features/me/pages/WeekLessonsPage'
import { WeekDiscoveriesPage } from '@/features/me/pages/WeekDiscoveriesPage'
import { GoalsPage } from '@/features/me/pages/GoalsPage'
import { GoalDietPage } from '@/features/me/pages/GoalDietPage'
import { GoalSegmentPage } from '@/features/me/pages/GoalSegmentPage'
import { GoalPlansPage } from '@/features/me/pages/GoalPlansPage'
import { GoalGuardsPage } from '@/features/me/pages/GoalGuardsPage'
import { GoalSettingsPage } from '@/features/me/pages/GoalSettingsPage'
import { GoalSuggestionPage } from '@/features/me/pages/GoalSuggestionPage'
import { CelokPage } from '@/features/me/pages/CelokPage'
import { CelPage } from '@/features/me/pages/CelPage'
import { CelWizardPage } from '@/features/me/pages/CelWizardPage'
import JelekPage from '@/features/me/pages/JelekPage'
import { WeightPage } from '@/features/me/pages/WeightPage'
import { SleepPage } from '@/features/me/pages/SleepPage'
import { PeoplePage } from '@/features/me/pages/PeoplePage'
import { PeopleJeloltekPage } from '@/features/me/pages/PeopleJeloltekPage'
import { PeopleKorPage } from '@/features/me/pages/PeopleKorPage'
import { PeopleEmlitesekPage } from '@/features/me/pages/PeopleEmlitesekPage'
import { PeopleHetiPage } from '@/features/me/pages/PeopleHetiPage'
import { PersonDetailPage } from '@/features/me/pages/PersonDetailPage'
import { NotificationsPage } from '@/features/me/pages/NotificationsPage'
import { NotificationFeedPage } from '@/features/me/pages/NotificationFeedPage'
import { BeallitasokPage } from '@/features/me/pages/BeallitasokPage'
import { RitualPage } from '@/features/ritual/pages/RitualPage'
import { KarakterHubPage } from '@/features/character/pages/KarakterHubPage'
import { DimensionsPage } from '@/features/character/pages/DimensionsPage'
import { DimensionPage } from '@/features/character/pages/DimensionPage'
import { CharacterFeedPage } from '@/features/character/pages/CharacterFeedPage'
import { CsapatPage } from '@/features/character/pages/CsapatPage'
import { KonziliumPage } from '@/features/character/pages/KonziliumPage'
import { GeptermPage } from '@/features/character/pages/GeptermPage'
import { FutasokPage } from '@/features/character/pages/FutasokPage'
import { RunPage } from '@/features/character/pages/RunPage'
import { AdatforrasokPage } from '@/features/character/pages/AdatforrasokPage'
import { KorPage } from '@/features/character/pages/KorPage'
import { DetektorokPage } from '@/features/character/pages/DetektorokPage'
import { FuelRecipeScorePage } from '@/features/fuel/pages/FuelRecipeScorePage'

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

/** `/train` is the Edzés hub — except for the Heti drill-in, which still speaks
 *  `?day={0..6}`: that deep link belongs to the full day view and is forwarded to
 *  `/train/mai` with the selection intact (Mai derives it from the URL). */
function TrainIndex() {
  const [params] = useSearchParams()
  const day = params.get('day')
  if (day !== null && day !== '') return <Navigate to={`/train/mai?day=${day}`} replace />
  return <EdzesHubPage />
}

export const routes: RouteObject[] = [
  // Registered BEFORE the app root so `/admin` is matched by its own layout (desktop
  // shell, no PhoneFrame/TabBar) rather than falling into AppLayout's `*` catch-all
  // (mezo-d5iy.9). The two trees are otherwise disjoint — no path collides.
  ...adminRoutes,
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/nap" replace /> },
      { path: 'nap', element: <NapHubPage /> },
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
      // Edzés tab — Design 2.0 shell dissolution (mezo-d20.3.1): the Train shell
      // (AppHero + SubNavDropdown over an <Outlet>) is gone. /train is the hub Mozaik
      // face (hero + six tiles); the former sub-tabs are FULL-PAGE SIBLINGS on their
      // stable paths, keeping their current faces until their own F2 slices land —
      // the idiom the Mezo (d20.5.1) and Én (d20.6.1) tabs took. Mai — previously the
      // /train index — keeps its whole day view at /train/mai.
      { path: 'train', element: <TrainIndex /> },
      { path: 'train/mai', element: <TrainTodayPage /> },
      { path: 'train/week', element: <TrainWeekPage /> },
      { path: 'train/gym', element: <GymPage /> },
      { path: 'train/sport', element: <SportPage /> },
      { path: 'train/futas', element: <RunningPage /> },
      { path: 'train/exercises', element: <ExercisesPage /> },
      { path: 'train/medals', element: <MedalsPage /> },
      { path: 'train/mesocycles', element: <MesocycleLibraryPage /> },
      // Sablonok (mezo-tlwa) folds into the Mesociklus page in the new IA, but the
      // route stays reachable (the library's nav row still links here).
      { path: 'train/templates', element: <MesoTemplatesPage /> },
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
      { path: 'fuel/settings', element: <FuelSettingsPage /> },
      { path: 'fuel/slots', element: <FuelSlotsPage /> },
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
      { path: 'mezo', element: <MezoHubPage /> },
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
      { path: 'mezo/karakter/csapat', element: <CsapatPage /> },
      { path: 'mezo/karakter/konzilium', element: <KonziliumPage /> },
      // Gépterem (mezo-1gim.14, Task 4) — the geek-transparency hub + its Futások timeline +
      // the generic run-detail page every row (and, from Task 5, every Feed ⚙) opens into.
      { path: 'mezo/karakter/gepterem', element: <GeptermPage /> },
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
      // Rutin home (mezo-3zue): the routine surface's own page under Én, reached from the Én
      // hub's full-width Rutin tile. It absorbed /me/growth/rutin (mezo-rmi0.1) and the
      // /me/routines/edit editor — build and edit here, tick on /nap/rutin.
      { path: 'me/rutin', element: <RutinHubPage /> },
      // The 4-step recipe wizard (mezo-3zue.4). Registered BEFORE any `:param` sibling so
      // "uj" can never be swallowed as a habit key.
      { path: 'me/rutin/uj', element: <RoutineWizardPage /> },
      // One chain's own page (mezo-vxd8): rename, daypart, order + the stacking drawn.
      { path: 'me/rutin/lanc/:chainKey', element: <ChainPage /> },
      // The habit list on its own page (mezo-mgpr): stage filters + one tile per habit.
      { path: 'me/rutin/szokasok', element: <SzokasaidPage /> },
      // The single-recipe page (mezo-3zue.4). LAST of the `me/rutin/*` family: every static
      // sibling is registered above it so none is swallowed as a habit key. The parameter is
      // the habitKey (what the hub's rows link with), not the definition id.
      { path: 'me/rutin/szokas/:habitKey', element: <HabitPage /> },
      // The recipe editor on its own page (mezo-bk26, choice board option B): HabitPage is the
      // details surface, every definition write lives here.
      { path: 'me/rutin/szokas/:habitKey/szerkesztes', element: <HabitEditPage /> },
      // Both former homes keep working as redirects.
      { path: 'me/growth/rutin', element: <Navigate to="/me/rutin" replace /> },
      { path: 'me/routines/edit', element: <Navigate to="/me/rutin" replace /> },
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
      { path: 'me/week/napok/:date', element: <WeekDayPage /> },
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
      { path: 'me/goals/weight/settings', element: <GoalSettingsPage /> },
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
      { path: 'me/ertesitesek/beallitasok', element: <NotificationsPage /> },
      // Beállítások oldal (hub-tile-reorg): az Én hub Beállítások csempéjének célja —
      // Téma helyben + az Értesítések-kapcsolók és az AI-napló ajtajai.
      { path: 'me/beallitasok', element: <BeallitasokPage /> },
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
      { path: '*', element: <Navigate to="/nap" replace /> },
    ],
  },
]

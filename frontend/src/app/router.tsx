import { Navigate, type RouteObject, useLocation, useSearchParams } from 'react-router-dom'
import { AppLayout } from '@/app/AppLayout'
import { NapHubPage } from '@/features/today/pages/NapHubPage'
import { NapMezoPage } from '@/features/today/pages/NapMezoPage'
import { NapRutinPage } from '@/features/today/pages/NapRutinPage'
import { NapKuldetesekPage } from '@/features/today/pages/NapKuldetesekPage'
import { NapCheckinPage } from '@/features/today/pages/NapCheckinPage'
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
import { MesoOverviewPage } from '@/features/train/pages/MesoOverviewPage'
import { MesoReportPage } from '@/features/train/pages/MesoReportPage'
import { MesoComparePage } from '@/features/train/pages/MesoComparePage'
import { MesoTemplateEditorPage } from '@/features/train/pages/MesoTemplateEditorPage'
import { RunningBlockBuilderPage } from '@/features/train/pages/RunningBlockBuilderPage'
import { CustomWorkoutBuilderPage } from '@/features/train/pages/CustomWorkoutBuilderPage'
import { FuelMaiPage } from '@/features/fuel/pages/FuelMaiPage'
import { FuelLogPage } from '@/features/fuel/pages/FuelLogPage'
import { FuelLogNewPage } from '@/features/fuel/pages/FuelLogNewPage'
import { FuelNaploPage } from '@/features/fuel/pages/FuelNaploPage'
import { FuelPlanPage } from '@/features/fuel/pages/FuelPlanPage'
import { FuelStackPage } from '@/features/fuel/pages/FuelStackPage'
import { FuelRecipesPage } from '@/features/fuel/pages/FuelRecipesPage'
import { FuelKamraPage } from '@/features/fuel/pages/FuelKamraPage'
import { KamraItemDetailPage } from '@/features/fuel/pages/KamraItemDetailPage'
import { FuelMedicationPage } from '@/features/fuel/pages/FuelMedicationPage'
import { RecipeDetailPage } from '@/features/fuel/pages/RecipeDetailPage'
import { RecipeEditorPage } from '@/features/fuel/pages/RecipeEditorPage'
import { RecipeWorkshopPage } from '@/features/fuel/pages/RecipeWorkshopPage'
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
import { MemoryPage } from '@/features/insights/pages/MemoryPage'
import { EnHubPage } from '@/features/me/pages/EnHubPage'
import { GoalPlannerPage } from '@/features/me/pages/GoalPlannerPage'
import { NightPage } from '@/features/me/pages/NightPage'
import { GrowthPage } from '@/features/me/pages/GrowthPage'
import { JournalPage } from '@/features/me/pages/JournalPage'
import { WeekHubPage } from '@/features/me/pages/WeekHubPage'
import { WeekAnalysisPage } from '@/features/me/pages/WeekAnalysisPage'
import { WeekDaysPage } from '@/features/me/pages/WeekDaysPage'
import { WeekDayPage } from '@/features/me/pages/WeekDayPage'
import { WeekLessonsPage } from '@/features/me/pages/WeekLessonsPage'
import { WeekDiscoveriesPage } from '@/features/me/pages/WeekDiscoveriesPage'
import { RoutineEditorPage } from '@/features/me/pages/RoutineEditorPage'
import { GoalsPage } from '@/features/me/pages/GoalsPage'
import { CelokPage } from '@/features/me/pages/CelokPage'
import { CelPage } from '@/features/me/pages/CelPage'
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
import { AiUsagePage } from '@/features/me/pages/AiUsagePage'
import { AiCallDetailPage } from '@/features/me/pages/AiCallDetailPage'
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

// Design 2.0 shell (mezo-d20.1.1): /today → /nap and /insights → /mezo renames. The legacy
// paths survive as redirects (PWA bookmarks, in-app navigate() calls not yet migrated).
function LegacyPathRedirect({ prefix, to }: { prefix: string; to: string }) {
  const location = useLocation()
  return <Navigate to={location.pathname.replace(prefix, to) + location.search} replace />
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
      { path: 'train/mesocycles/:id/overview', element: <MesoOverviewPage /> },
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
      // The hub's Logolás hero tile → the stacked-window logging page (mezo-byo1).
      { path: 'fuel/log', element: <FuelLogPage /> },
      // A blokk-CTA-k saját logoló oldala (mezo-bq2t) — a kontextus az URL-ben él (d/w/ai).
      { path: 'fuel/log/uj', element: <FuelLogNewPage /> },
      // Fuel tile → own full page: the hub's Mezo banner (fuel iterations §2).
      { path: 'fuel/plan', element: <FuelPlanPage /> },
      { path: 'fuel/stack', element: <FuelStackPage /> },
      { path: 'fuel/kamra', element: <FuelKamraPage /> },
      { path: 'fuel/kamra/:id', element: <KamraItemDetailPage /> },
      { path: 'fuel/gyogyszer', element: <FuelMedicationPage /> },
      // Napló — the hub's 6th tile. Week-centric trend depth is F3.6 (+ the F6.2
      // backend series); this route is its honest destination today.
      { path: 'fuel/naplo', element: <FuelNaploPage /> },
      // `new` is listed before `:id` for clarity (React Router ranks static over dynamic).
      { path: 'fuel/recipes/new', element: <RecipeEditorPage /> },
      // Receptműhely (mezo-92pb) — static, so it must precede `:id`; `?recipeId=` seeds it.
      { path: 'fuel/recipes/muhely', element: <RecipeWorkshopPage /> },
      { path: 'fuel/recipes', element: <FuelRecipesPage /> },
      { path: 'fuel/recipes/:id', element: <RecipeDetailPage /> },
      { path: 'fuel/recipes/:id/edit', element: <RecipeEditorPage /> },
      // Meal-slot template editor (mezo-7102) — reachable only from FuelSettingsSheet,
      // which now opens from the hub's Fuel-beállítások band.
      { path: 'fuel/slots', element: <FuelSlotsPage /> },
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
      // Motor retired (mezo-tk88.4) — the diagnostics moved into the Minták dashboard +
      // the pattern-pair detail page above (mezo-tk88.5); the route survives as an honest
      // redirect so any old bookmark/link (`?pair=` cross-links included) still lands
      // somewhere sensible.
      { path: 'mezo/motor', element: <Navigate to="/mezo/patterns" replace /> },
      { path: 'mezo/memoria', element: <MemoryPage /> },
      // Én tab — Design 2.0 shell dissolution (mezo-d20.6.1): the Me shell
      // (AppHero + SubNavDropdown + its ⚙️ Beállítások action) is gone. /me is the hub
      // Mozaik face, which carries the settings band itself; the former sub-tabs are
      // full-page siblings on their stable routes (they keep their current faces until
      // their own F5 slices land) — the same idiom the Mezo tab took in mezo-d20.5.1.
      { path: 'me', element: <EnHubPage /> },
      // Karakter dossier hub (mezo-1gim.13) — the Én hub's Karakter tile.
      { path: 'me/karakter', element: <KarakterHubPage /> },
      // Dimenziók/dimenzió/feed full-page siblings (Task 4); Csapat/Konzílium (Task 5) —
      // Konzílium's transcript view rides `?id=` on the SAME route (the WeekHub sibling
      // idiom, e.g. WeekLessonsPage's `?start=`), not a child route.
      { path: 'me/karakter/dimenziok', element: <DimensionsPage /> },
      { path: 'me/karakter/dimenzio/:key', element: <DimensionPage /> },
      { path: 'me/karakter/feed', element: <CharacterFeedPage /> },
      { path: 'me/karakter/csapat', element: <CsapatPage /> },
      { path: 'me/karakter/konzilium', element: <KonziliumPage /> },
      // Gépterem (mezo-1gim.14, Task 4) — the geek-transparency hub + its Futások timeline +
      // the generic run-detail page every row (and, from Task 5, every Feed ⚙) opens into.
      { path: 'me/karakter/gepterem', element: <GeptermPage /> },
      { path: 'me/karakter/gepterem/futasok', element: <FutasokPage /> },
      { path: 'me/karakter/gepterem/futas/:id', element: <RunPage /> },
      // Adatforrások/kör/Detektorok (Task 5) — the kör mini-pages are discrete indexed items
      // (DimensionsPage's `/dimenzio/:key` sibling idiom), not a continuous stepped range, so
      // they get a path param (`/kor/:n`), not FutasokPage's `?start=` query-param idiom.
      { path: 'me/karakter/gepterem/adatforrasok', element: <AdatforrasokPage /> },
      { path: 'me/karakter/gepterem/adatforrasok/kor/:n', element: <KorPage /> },
      { path: 'me/karakter/gepterem/detektorok', element: <DetektorokPage /> },
      { path: 'me/growth', element: <GrowthPage /> },
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
      { path: 'me/goals/weight/new', element: <GoalPlannerPage /> },
      // Goal detail (Task 10, mezo-iizd.1) — registered AFTER every static `me/goals/*`
      // sibling above (React Router ranks static over dynamic regardless of source order,
      // but the ordering stays explicit here per the `me/people/:id` precedent). Task 11's
      // wizard adds `me/goals/new` as another static sibling ahead of this route.
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

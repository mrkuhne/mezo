# Cél oldal — állapotközpontú Mozaik hub — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use `executing-plans` (or
> `superpowers:subagent-driven-development` when explicitly delegated) and execute one task at a
> time. Every implementation task follows RED → GREEN → REFACTOR and ends in its own commit.

**Goal:** A `/me/goals/weight` oldal első pillantásra válaszolja meg, hogy a felhasználó jó úton
halad-e; a Diet Plan, szakasz, tervkapcsolat, guard, javaslat és beállítás adatai áttekinthető
Mozaik 2.0 csempék és színes részletoldalak mögé kerüljenek, miközben a hibás célirányból soha nem
készülhet veszélyes kalória-előírás.

**Architecture:** A backend egy contract-first `GoalOverviewResponse` read modellel komponálja a
meglévő goal engine, weight trend, prescription, schedule, timeline és suggestion adatokat. A
javaslat preview és accept ugyanazt a mellékhatásmentes prescription-calculatort használja, majd
szemantikus fingerprint védi a stale alkalmazást. A frontend a stabil `@/data/hooks` határon át
kap dual-mode adatot; a hub és minden tile-detail oldal a meglévő Mozaik 2.0 primitívekből épül.

**Tech Stack:** OpenAPI 3.0.3 · Java 21 · Spring Boot 4 · PostgreSQL 16 · React 19 · TypeScript ·
TanStack Query · Vitest/RTL · Playwright · Mozaik 2.0.

**Spec:** [`docs/superpowers/specs/2026-09-04-goal-hub-redesign-design.md`](../specs/2026-09-04-goal-hub-redesign-design.md)

**Driving bd:** `mezo-ricj`; biztonsági előfeltétel: `mezo-szsj`; végrehajtási szeletek:
`mezo-ricj.1` … `mezo-ricj.6`.

## Global Constraints

- **Biztonsági sorrend:** `mezo-szsj` minden más szelet blokkoló előfeltétele. Cut csak
  `targetWeightKg < startWeightKg`, bulk csak `targetWeightKg > startWeightKg`, maintain csak
  `targetWeightKg == null`; a célablak legalább 7 nap és `targetDate > startDate`.
- **Fail-safe legacy állapot:** inkonzisztens goalnál az engine törli/nem adja ki a prescriptiont,
  az overview `courseStatus=invalid`; a kliens nem renderel kcal számot.
- **Course tolerancia:** `mezo.goal.overview.rate-tolerance-percent=20` és
  `rate-tolerance-floor-kg-per-week=0.10`. `none → learning`; coherent, legalább provisional trend
  a signed célütem körüli `max(|target|×20%, 0.10)` sávban → `on_track`; máskülönben `watch`.
- **Contract-first:** előbb `api/feature/goal/goal.yml`, utána `api/openapi.yml`, generált frontend
  típusok, végül Java/React fogyasztók. Boundary DTO kézzel nem készül.
- **Ownership:** minden új endpoint no-token `401`; foreign goal/suggestion/plan B-user számára
  `404`. A principal kizárólag `CurrentUserId`-ból jön.
- **Suggestion safety:** első tap és preview GET nem ír. Accept body kötelező
  `{ previewFingerprint }`; semantic mismatch `409 GOAL_SUGGESTION_STALE`; blocker mellett nincs
  write. `generatedAt`/`createdAt` nincs a fingerprintben.
- **Notification:** `GOAL_SUGGESTION("goal_suggestion", null, "/me/goals/weight/suggestions")`;
  dedup `goal_suggestion:{suggestionId}`; csak új row után, `AFTER_COMMIT` listenerből emitál.
- **Plan links:** owner + non-archived plan, nincs duplicate vagy azonos típusú átfedés;
  `startWeek ∈ [1,totalWeeks]`; szerver származtat `endWeek`; túlnyúlás explicit
  `clippedAtGoalEnd=true`.
- **Energetikai igazság:** MEV/MAV/MRV címke önmagában nem változtat kcal-t. Gym/sport schedule és
  running duration hajtja az EAT-et; `dayTypeShiftKcal` a heti átlagot megőrizve oszt training/rest
  napokra. A változatlan kcal-hoz magyarázat tartozik.
- **Vizuális hűség:** a jóváhagyott
  [`mockup`](../specs/assets/2026-09-04-goal-hub-redesign-mockup.html) a referencia. Egy széles
  hero + kétoszlopos Mozaik, sage/coral/gold/sky/lav/rose wash, clay ikonok, egy-shot motion,
  reduced-motion alatt azonnali állapot.
- **Diff-rács:** minden suggestion változássor fix `label | current | arrow | proposed | delta`
  gridet használ; a címke- és érték-baseline minden kártyán azonos. Delta nem tolhat oszlopot.
- **Frontend rétegek:** routed komponens `*Page`; domain UI `features/me`; data implementáció
  `data/me`; feature csak `@/data/hooks`-ból importál; nincs új barrel; nincs mock fallback real
  loading alatt.
- **Backend:** constructor DI; method-level `@Transactional`; config `GoalEngineProperties` +
  `application.yml`; hibák `SystemRuntimeErrorException` + `messages.properties`; nincs `@Value`.
- **Teszt:** backend integration-first, populátorokkal és AssertJ-vel; frontend colocated Vitest,
  real és mock mód; 320/390/430 px layout ellenőrzés. Lokálisan fókuszált backend IT,
  autoritatív full suite CI-ben.
- **Git:** minden bd szelet saját `feat/<topic>` branchen, saját self-PR + zöld CI után kerül mainre.
  Commit subject végén a hajtó bd id. A tervdokumentum commitja a jelenlegi
  `feat/goal-hub-redesign` design branch része.
- **Living docs:** viselkedést érintő commit frissíti a megfelelő részt a
  `goal-engine.md`, `me.md`, `_platform-notifications.md`, `_platform-design-system.md` fájlokban;
  CODEMAP csak `node scripts/gen-codemap.mjs` által változhat.

---

### Task 1: P0 célirány-invariáns és fail-safe engine (`mezo-szsj`)

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/goal/service/GoalInvariantValidator.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/goal/service/GoalService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/goal/engine/service/GoalFeasibilityService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/goal/engine/service/GoalEngineService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/goal/service/GoalSuggestionService.java`
- Modify: `backend/src/main/resources/messages.properties`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/support/populator/GoalPopulator.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/goal/GoalContractIT.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/goal/GoalSuggestionServiceIT.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/goal/engine/service/GoalEvaluationServiceIT.java`
- Modify: `docs/features/goal-engine.md`
- Modify: `docs/features/fuel.md`

**Interfaces:**
- Produce: `GoalInvariantValidator.validate(String trajectory, BigDecimal startWeightKg,
  BigDecimal targetWeightKg, LocalDate startDate, LocalDate targetDate)` — typed 400-at dob.
- Produce: `GoalInvariantValidator.isCoherent(GoalEntity goal)` — side-effect-free legacy guard.
- Consume: `GoalEngineService.evaluate(UUID userId, UUID goalId)`; incoherent rownál `null`
  prescription, trigger nélkül.
- Error: `GOAL_DIRECTION_TARGET_CONFLICT` (`targetWeightKg`) és `GOAL_WINDOW_TOO_SHORT`
  (`targetDate`).

- [ ] **Step 1: Írd meg a három regressziós RED tesztet**

`GoalContractIT` HTTP-n bizonyítsa a cross-field validációt:

```java
@Test
void testCreateGoal_shouldReturn400_whenCutTargetIsAboveStart() {
    GoalUpsertRequest request = validGoalRequest();
    request.setTrajectory("cut");
    request.setStartWeightKg(new BigDecimal("84.2"));
    request.setTargetWeightKg(new BigDecimal("90.0"));

    String body = postForBody("/api/goals", request, ownerAuthHeaders(),
        HttpStatus.BAD_REQUEST, String.class);

    assertHasFieldError(body, "targetWeightKg", "GOAL_DIRECTION_TARGET_CONFLICT");
}
```

Tegyél mellé bulk `84.2 → 78.0`, maintain non-null target és hatnapos ablak esetet.
`GoalSuggestionServiceIT` reprodukálja a released hibát: cut goal + bulk phase suggestion;
`accept(...)` dobjon `GOAL_DIRECTION_TARGET_CONFLICT`-ot, a goal maradjon cut és a suggestion
maradjon proposed. `GoalEvaluationServiceIT` populátoron át mentsen legacy bulk `84.2 → 78.0`
sort, tegyen rá régi prescriptiont, majd `goalEngineService.evaluate(...)` után ellenőrizze, hogy
`goal.prescription == null` és nem keletkezik új suggestion.

- [ ] **Step 2: Futtasd a RED teszteket**

```bash
cd backend && ./mvnw clean test \
  -Dtest='GoalContractIT,GoalSuggestionServiceIT,GoalEvaluationServiceIT' \
  -Dmezo.test.use-testcontainers=true
```

Várt: a cross-field esetek elfogadódnak, a phase accept trajektóriát fordít, a legacy evaluate
veszélyes prescriptiont hagy/készít — a teszt a megfelelő okból piros.

- [ ] **Step 3: Implementáld az egyetlen invariáns-validatort**

```java
@Component
public class GoalInvariantValidator {
    public void validate(String trajectory, BigDecimal start, BigDecimal target,
                         LocalDate startDate, LocalDate targetDate) {
        if (startDate == null || targetDate == null
                || ChronoUnit.DAYS.between(startDate, targetDate) < 7) {
            throw field("GOAL_WINDOW_TOO_SHORT", "targetDate");
        }
        boolean coherent = switch (trajectory) {
            case "cut" -> target != null && target.compareTo(start) < 0;
            case "bulk" -> target != null && target.compareTo(start) > 0;
            case "maintain" -> target == null;
            default -> false;
        };
        if (!coherent) throw field("GOAL_DIRECTION_TARGET_CONFLICT", "targetWeightKg");
    }
}
```

`GoalService.applyUpsert` és `GoalFeasibilityService.preview/deriveRatePctPerWeek` ugyanazt a
validatort hívja. `GoalSuggestionService.applyPhaseChange` a draft trajectory + élő súly/dátum
kombinációt validálja **mielőtt** a goalt módosítja. `GoalEngineService.evaluate` az ownership read
után `isCoherent=false` esetén `goal.setPrescription(null)` és `goal.setTdeeBootstrap(null)`, majd
`return null`; nem hív projectiont vagy suggestion triggert.

- [ ] **Step 4: Javítsd a fixture-t és az error contractot**

`GoalPopulator` valid bulk alapértéke `84.2 → 90.0`; az inkonzisztens legacy esethez külön
`createLegacyIncoherentGoal(...)` helper közvetlen repository mentést használ. Add a két HU
messages.properties sort, hardcoded szolgáltatásszöveg nélkül.

- [ ] **Step 5: Futtasd GREEN-ben, majd dokumentálj**

```bash
cd backend && ./mvnw clean test \
  -Dtest='GoalContractIT,GoalSuggestionServiceIT,GoalEvaluationServiceIT,GoalFeasibilityServiceIT' \
  -Dmezo.test.use-testcontainers=true
cd .. && node scripts/lint-docs.mjs --errors-only
```

Frissítsd a `goal-engine.md` invariáns/fail-safe és a `fuel.md` prescription-biztonság részét.

- [ ] **Step 6: Commit és PR-kapu**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/goal/service/GoalInvariantValidator.java \
  backend/src/main/java/io/mrkuhne/mezo/feature/goal/service/GoalService.java \
  backend/src/main/java/io/mrkuhne/mezo/feature/goal/service/GoalSuggestionService.java \
  backend/src/main/java/io/mrkuhne/mezo/feature/goal/engine/service/GoalFeasibilityService.java \
  backend/src/main/java/io/mrkuhne/mezo/feature/goal/engine/service/GoalEngineService.java \
  backend/src/main/resources/messages.properties \
  backend/src/test/java/io/mrkuhne/mezo/support/populator/GoalPopulator.java \
  backend/src/test/java/io/mrkuhne/mezo/feature/goal/GoalContractIT.java \
  backend/src/test/java/io/mrkuhne/mezo/feature/goal/GoalSuggestionServiceIT.java \
  backend/src/test/java/io/mrkuhne/mezo/feature/goal/engine/service/GoalEvaluationServiceIT.java \
  docs/features/goal-engine.md docs/features/fuel.md
git commit -m "fix(goal): reject incoherent weight trajectories (mezo-szsj)"
git push -u origin feat/goal-direction-invariant
gh pr create --base main --head feat/goal-direction-invariant \
  --title "fix(goal): reject incoherent weight trajectories (mezo-szsj)" \
  --body-file /tmp/mezo-szsj-pr.md
```

Várd meg a zöld CI-t és a projekt `--no-ff` merge-folyamatát; csak ezután indulhat Task 2.

---

### Task 2: Goal Overview contract és backend read model (`mezo-ricj.1`)

**Files:**
- Modify: `api/base.yml` (minor contract version bump)
- Modify: `api/feature/goal/goal.yml`
- Modify (generated): `api/openapi.yml`
- Modify (generated): `frontend/src/data/_client/api.gen.ts`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/goal/service/GoalOverviewCourseService.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/goal/service/GoalOverviewService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/goal/controller/GoalController.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/goal/engine/GoalEngineProperties.java`
- Modify: `backend/src/main/resources/application.yml`
- Create: `backend/src/test/java/io/mrkuhne/mezo/feature/goal/GoalOverviewApiIT.java`
- Create: `backend/src/test/java/io/mrkuhne/mezo/feature/goal/GoalOverviewCourseServiceTest.java`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/feature/goal/engine/GoalEnginePropertiesIT.java`
- Modify: `docs/features/goal-engine.md`

**Interfaces:**
- Produce: `GET /api/goals/{id}/overview` → generated `GoalOverviewResponse`.
- Produce: `GoalOverviewService.getOverview(UUID userId, UUID goalId)`.
- Produce: `GoalOverviewCourseService.classify(GoalEntity goal, WeightTrendResponse trend)` →
  `Course(status, reasonCode, signedObservedRate, signedTargetRate, projectedTargetDate)`.
- Consume unchanged: `WeightTrendService.computeTrend`, `GoalTimelineService.getTimeline`,
  `GoalSuggestionService.listOpen`, `SportService.getSchedule`, `WeeklyScheduledActivityService`.

- [ ] **Step 1: Bővítsd contract-first a goal fragmentet**

Add az endpointot 200/401/404 válasszal és az alábbi kötelező szerkezetet; a részobjektumok neve
legyen `GoalOverviewDiet`, `GoalOverviewSegment`, `GoalOverviewPlans`, `GoalOverviewGuards`:

```yaml
GoalOverviewResponse:
  type: object
  required: [goalId, title, trajectory, status, currentWeek, totalWeeks,
             completionPct, currentWeightKg, courseStatus, courseReasonCode,
             dataSufficiency, diet, segment, plans, guards, openSuggestionCount]
  properties:
    goalId: { type: string, format: uuid }
    courseStatus: { type: string, enum: [on_track, watch, learning, invalid] }
    courseReasonCode: { type: string }
    observedRateKgPerWeek: { type: number, nullable: true }
    targetRateKgPerWeek: { type: number, nullable: true }
    projectedTargetDate: { type: string, format: date, nullable: true }
    dataSufficiency: { type: string, enum: [none, provisional, full] }
    latestSuggestionId: { type: string, format: uuid, nullable: true }
```

`GoalOverviewDiet` adja: `weekAverageKcal`, `todayDayType` (`training|rest|uniform|unavailable`),
`todayKcal`, `trainingDayKcal`, `restDayKcal`, `proteinG`, `carbsG`, `fatG`, `basis`,
`explanationCode`. A nullable számokat ne tedd required listába. Plans tartalmazza a timeline
linkeket/gapeket és a valódi `SportScheduleSlotResponse[]`-t; guards a meglévő
`GoalGuardStatus`-t és `healthyCount/totalCount/topIssueCode` mezőket használja.

- [ ] **Step 2: Generáld a két fogyasztói oldalt**

```bash
cd api/generate && npm install && npm run generate:api
cd ../../frontend && pnpm generate:api
```

Várt: `GoalApi#getGoalOverview`, Java `GoalOverviewResponse` és TS
`components['schemas']['GoalOverviewResponse']` létrejön. Ne szerkessz generált Java fájlt.

- [ ] **Step 3: Írd meg a RED classifier- és HTTP-teszteket**

`GoalOverviewCourseServiceTest` fedje le: invalid; `none→learning`; cut és bulk helyes előjellel
on-track; rossz irányú observed trend watch; floor-domináns `0.10` tolerancia; maintain sáv.
`GoalOverviewApiIT` fedje le 401, B-user 404, valamint egy aktív cut goal teljes response-át:
aktuális prescription segment, mai nap-típus/kcal, P/C/F, `latestSuggestionId`, timeline gap és
sport schedule. A teszt dátumát `Clock`/mai lokális nap alapján képezd, ne hardcode-olj lejáró
ablakot.

- [ ] **Step 4: Futtasd RED-ben**

```bash
cd backend && ./mvnw clean test \
  -Dtest='GoalOverviewCourseServiceTest,GoalOverviewApiIT,GoalEnginePropertiesIT' \
  -Dmezo.test.use-testcontainers=true
```

Várt: hiányzó service/controller/config miatt compile vagy assertion FAIL.

- [ ] **Step 5: Implementáld a pure besorolást**

```java
public Course classify(GoalEntity goal, WeightTrendResponse trend) {
    if (!invariantValidator.isCoherent(goal)) return Course.invalid();
    if (trend.getDataSufficiency() == NONE) return Course.learning();
    BigDecimal target = signedTargetRate(goal);
    BigDecimal observed = trend.getLast4wRateKgPerWeek();
    BigDecimal tolerance = target.abs()
        .multiply(properties.overview().rateTolerancePercent())
        .movePointLeft(2)
        .max(properties.overview().rateToleranceFloorKgPerWeek());
    return sameDirection(goal, observed) && observed.subtract(target).abs().compareTo(tolerance) <= 0
        ? Course.onTrack(observed, target, projectedDate(goal, observed))
        : Course.watch(observed, target, projectedDate(goal, observed));
}
```

`projectedDate` csak nem nulla, célirányba mutató observed rate-nél számol
`ceil(abs(current-target)/abs(observed))` hetet; különben null. Reason code-ok stabil wire-kulcsok:
`goal_invalid`, `trend_missing`, `rate_on_track`, `rate_off_track`, `rate_wrong_direction`.

- [ ] **Step 6: Implementáld az overview assemblert és controllert**

`GoalOverviewService` egy ownership-gated goal read után egyszer kér trendet, timeline-t,
suggestion listát és sport schedule-t. A `currentWeek` clampelt 1..totalWeeks; az aktuális segment
`fromWeek <= currentWeek <= toWeek`; `todayKcal` a mai ISO weekday jelenléte alapján training/rest,
null splitnél a segment `kcal`. Invalid vagy prescription nélküli goal dietje `unavailable` és
null számokat ad. `GoalController#getGoalOverview(UUID id)` csak delegál.

- [ ] **Step 7: GREEN, contract drift és commit**

```bash
cd backend && ./mvnw clean test \
  -Dtest='GoalOverviewCourseServiceTest,GoalOverviewApiIT,GoalEnginePropertiesIT,ArchitectureTest' \
  -Dmezo.test.use-testcontainers=true
cd ../frontend && pnpm build
cd .. && node scripts/lint-docs.mjs --errors-only
git add api/base.yml api/feature/goal/goal.yml api/openapi.yml frontend/src/data/_client/api.gen.ts \
  backend/src/main/java/io/mrkuhne/mezo/feature/goal/service/GoalOverviewCourseService.java \
  backend/src/main/java/io/mrkuhne/mezo/feature/goal/service/GoalOverviewService.java \
  backend/src/main/java/io/mrkuhne/mezo/feature/goal/controller/GoalController.java \
  backend/src/main/java/io/mrkuhne/mezo/feature/goal/engine/GoalEngineProperties.java \
  backend/src/main/resources/application.yml \
  backend/src/test/java/io/mrkuhne/mezo/feature/goal/GoalOverviewApiIT.java \
  backend/src/test/java/io/mrkuhne/mezo/feature/goal/GoalOverviewCourseServiceTest.java \
  backend/src/test/java/io/mrkuhne/mezo/feature/goal/engine/GoalEnginePropertiesIT.java \
  docs/features/goal-engine.md
git commit -m "feat(goal): expose state-led goal overview (mezo-ricj.1)"
```

Pusholj `feat/goal-overview`, nyiss self-PR-t, várd meg a zöld CI-t és merge-öt.

---

### Task 3: Dual-mode overview adatkapu és a Cél Mozaik hub (`mezo-ricj.2` / 1)

**Files:**
- Modify: `frontend/src/data/me/goalApi.ts`
- Create: `frontend/src/data/me/goalOverviewHooks.ts`
- Create: `frontend/src/data/me/goalOverviewHooks.test.tsx`
- Modify: `frontend/src/data/me/goalHooks.ts`
- Modify: `frontend/src/data/me/goalHooks.test.tsx`
- Modify: `frontend/src/data/me/goals.ts`
- Modify: `frontend/src/data/hooks.ts`
- Create: `frontend/src/features/me/logic/goalOverviewCopy.ts`
- Create: `frontend/src/features/me/logic/goalOverviewCopy.test.ts`
- Create: `frontend/src/features/me/components/GoalCourseHero.tsx`
- Modify: `frontend/src/features/me/pages/GoalsPage.tsx`
- Modify: `frontend/src/features/me/pages/GoalsPage.test.tsx`
- Modify: `frontend/src/features/me/pages/GoalsSkeleton.tsx`
- Create: `frontend/src/features/me/pages/GoalDietPage.tsx`
- Create: `frontend/src/features/me/pages/GoalSegmentPage.tsx`
- Create: `frontend/src/features/me/pages/GoalPlansPage.tsx`
- Create: `frontend/src/features/me/pages/GoalGuardsPage.tsx`
- Create: `frontend/src/features/me/pages/GoalSettingsPage.tsx`
- Modify: `frontend/src/app/router.tsx`
- Modify: `frontend/src/styles/prototype.css`
- Modify: `docs/features/me.md`

**Interfaces:**
- Produce: `goalApi.overview(id): Promise<GoalOverviewResponse>`.
- Produce: `useGoalOverview(goalId: string | null)` → `{ overview, pending }` via `useDualQuery`.
- Produce: `courseCopy(status, reasonCode)` and `dietExplanation(code)` pure HU mapping.
- Change: `useGoal()` csak `status === 'active'` goalt választ; planned fallback nincs.
- Consume: `Tile`, `Mosaic`, `PageHero`, `MCells`, `EntranceGroup` meglévő Mozaik API-ja.

- [ ] **Step 1: Írd meg a data-layer RED teszteket mindkét módban**

Real teszt mockolja `GET /api/goals/{id}/overview`-t és ellenőrzi a query keyt
`['goal-overview', id]`, a typed response-t és `goalId=null` disabled állapotot. Mock teszt a
`goalOverviewSeed` objektumot kapja szinkron. A `goalHooks.test.tsx` új esete planned-only listára
`goal === null`, ne az első planned rekordot adja vissza.

```bash
cd frontend && pnpm vitest run src/data/me/goalOverviewHooks.test.tsx \
  src/data/me/goalHooks.test.tsx
VITE_USE_MOCK=true pnpm vitest run src/data/me/goalOverviewHooks.test.tsx \
  src/data/me/goalHooks.test.tsx
```

Várt: hiányzó hook/API és a planned fallback miatt FAIL.

- [ ] **Step 2: Implementáld a stabil dual-mode határt**

```ts
export function useGoalOverview(goalId: string | null) {
  const { data, isPending } = useDualQuery<GoalOverviewResponse>({
    queryKey: ['goal-overview', goalId],
    enabled: goalId !== null,
    mockData: goalOverviewSeed,
    realFetch: () => goalApi.overview(goalId!),
    realEmpty: EMPTY_GOAL_OVERVIEW,
  })
  return { overview: goalId ? data : null, pending: goalId !== null && isPending }
}
```

Ha `useDualQuery` jelenlegi propsa nem tartalmaz `enabled`-et, előbb egészítsd ki azt és a
colocated tesztjét; ne indíts `null` id-val hálózati kérést. Re-export kizárólag
`frontend/src/data/hooks.ts`-ban. A mock seed legyen az overview contract teljes, koherens példája.

- [ ] **Step 3: Írd meg a hub RED render/navigation tesztjeit**

Fedés: loading skeleton; no active goal CTA; invalid coral fail-safe kcal nélkül; learning copy;
on-track hero; open suggestion esetén hat, nélküle öt tile; a tile-ok pontos útvonalai. Mockold az
új hookot, ne a komponens belső részleteit. A fő assertionök:

```ts
expect(screen.getByRole('heading', { name: 'Jó úton haladsz' })).toBeInTheDocument()
expect(screen.getByRole('button', { name: /Mai étrendi keret/ })).toBeEnabled()
expect(screen.queryByText('3878 kcal')).not.toBeInTheDocument() // invalid fixture
```

- [ ] **Step 4: Építsd meg a herót és a csempés főoldalt**

`GoalsPage` a hosszú `GoalRecept`, `GoalTimeline`, `GoalPlanSlots`, inline accept/dismiss és
`remaining=current-target` blokkokat törli. A `GoalCourseHero` a course state-et, signed observed/
target rate-et, súlyutat és projected date-et mutatja; completion ring csak másodlagos. A hat tile:
diet(sage), segment(gold), plans(sky), guards(lav), suggestion(coral, conditional), settings(white).
Mindegyik `navigate(...)`; suggestion mindig review route-ra visz, soha `accept`-re.

- [ ] **Step 5: Regisztráld az öt route-ot ship-safe shell oldallal**

Az öt `*Page.tsx` már ebben a commitban létezzen és rendereljen `MozaikPage + PageHead + PageHero +
PageBody` scaffoldot, `‹ Cél` fix visszaúttal. Task 4 tölti fel a body-kat, de route ne legyen 404.

```tsx
{ path: 'me/goals/weight/diet', element: <GoalDietPage /> },
{ path: 'me/goals/weight/segment', element: <GoalSegmentPage /> },
{ path: 'me/goals/weight/plans', element: <GoalPlansPage /> },
{ path: 'me/goals/weight/guards', element: <GoalGuardsPage /> },
{ path: 'me/goals/weight/settings', element: <GoalSettingsPage /> },
```

- [ ] **Step 6: GREEN mindkét módban és commit**

```bash
cd frontend && pnpm vitest run src/data/me/goalOverviewHooks.test.tsx \
  src/data/me/goalHooks.test.tsx src/features/me/pages/GoalsPage.test.tsx
VITE_USE_MOCK=true pnpm vitest run src/data/me/goalOverviewHooks.test.tsx \
  src/data/me/goalHooks.test.tsx src/features/me/pages/GoalsPage.test.tsx
pnpm build
git add src/data/me/goalApi.ts src/data/me/goalOverviewHooks.ts \
  src/data/me/goalOverviewHooks.test.tsx src/data/me/goalHooks.ts \
  src/data/me/goalHooks.test.tsx src/data/me/goals.ts src/data/hooks.ts \
  src/features/me/logic/goalOverviewCopy.ts src/features/me/logic/goalOverviewCopy.test.ts \
  src/features/me/components/GoalCourseHero.tsx src/features/me/pages/GoalsPage.tsx \
  src/features/me/pages/GoalsPage.test.tsx src/features/me/pages/GoalsSkeleton.tsx \
  src/features/me/pages/GoalDietPage.tsx src/features/me/pages/GoalSegmentPage.tsx \
  src/features/me/pages/GoalPlansPage.tsx src/features/me/pages/GoalGuardsPage.tsx \
  src/features/me/pages/GoalSettingsPage.tsx src/app/router.tsx src/styles/prototype.css \
  ../docs/features/me.md
git commit -m "feat(me): turn the weight goal into a status hub (mezo-ricj.2)"
```

Maradj a `feat/goal-hub-ui` branchen; Task 4 ugyanennek a beadnek és PR-nek a második commitja.

---

### Task 4: Az öt állandó, színes részletoldal (`mezo-ricj.2` / 2)

**Files:**
- Create: `frontend/src/features/me/components/GoalDietWeekCard.tsx`
- Create: `frontend/src/features/me/components/GoalSegmentRail.tsx`
- Create: `frontend/src/features/me/components/GoalConnectionTimeline.tsx`
- Create: `frontend/src/features/me/components/GoalGuardCard.tsx`
- Test: az előző négy fájl mellett colocated `*.test.tsx`
- Modify + Test: `frontend/src/features/me/pages/GoalDietPage.tsx` / `.test.tsx`
- Modify + Test: `frontend/src/features/me/pages/GoalSegmentPage.tsx` / `.test.tsx`
- Modify + Test: `frontend/src/features/me/pages/GoalPlansPage.tsx` / `.test.tsx`
- Modify + Test: `frontend/src/features/me/pages/GoalGuardsPage.tsx` / `.test.tsx`
- Modify + Test: `frontend/src/features/me/pages/GoalSettingsPage.tsx` / `.test.tsx`
- Modify: `frontend/src/styles/prototype.css`
- Modify: `docs/features/me.md`
- Modify: `docs/features/_platform-design-system.md`

**Interfaces:**
- Consume: `useGoal()` kizárólag az aktív `goalId` és edit flow miatt.
- Consume: `useGoalOverview(goalId)` minden megjelenített szám/státusz egyetlen forrásaként.
- Consume: `useGoalActions`, `AttachPlanSheet`, `EditGoalSheet` write műveletekhez.
- Produce: négy tisztán presentational goal component; data hookot egyik sem importál.

- [ ] **Step 1: Írd meg oldalanként a RED viselkedési teszteket**

- Diet: training/rest/uniform/unavailable hero, P/C/F, heti átlag és magyarázat.
- Segment: aktuális label + hétintervallum, következő szakasz/dátum, nincs következő állapot.
- Plans: mesocycle/running külön lane, sport schedule név+nap+időtartam, gap, attach CTA.
- Guards: strength/muscle kártyák és top warning; inaktív guard nem kap riasztó színt.
- Settings: trajectory/weights/window/rate, `Cél szerkesztése` megnyitja `EditGoalSheet`-et.
- Mind: loading skeleton és invalid overview esetén nincs elavult kcal.

```bash
cd frontend && pnpm vitest run src/features/me/pages/GoalDietPage.test.tsx \
  src/features/me/pages/GoalSegmentPage.test.tsx src/features/me/pages/GoalPlansPage.test.tsx \
  src/features/me/pages/GoalGuardsPage.test.tsx src/features/me/pages/GoalSettingsPage.test.tsx
```

Várt: az üres scaffoldok miatt FAIL.

- [ ] **Step 2: Töltsd fel a Diet és Segment oldalakat**

Diet tone `sage`: `PageHero` big=`todayKcal`, sub=`Edzésnap|Pihenőnap|Egységes keret`; MCells P/C/F;
`GoalDietWeekCard` egymás mellett mutat training/rest kcal-t és heti átlagot; külön provenance
strip a `basis` és `explanationCode` HU copy számára. Unavailable állapotban big szám helyett
`Céljavítás szükséges`.

Segment tone `gold`: hero current label, `W{from}–{to}`; `GoalSegmentRail` a current/next adatot
és váltási dátumot mutatja. A magyarázat explicit: a fázis a guardot/szakaszolást változtathatja,
de önmagában nem becsül új kcal-égetést.

- [ ] **Step 3: Töltsd fel a Plans oldalt**

Plans tone `sky`; a `GoalConnectionTimeline` a szervertől kapott `timeline.links`, `gaps` és
`sportSchedule` adatokból rajzol. Ne maradjon `BVSC`, `végig` vagy más statikus sport copy. A plan
row mutassa `plan.status`, start/end week, illetve később a `clippedAtGoalEnd` chipet. A két CTA
ugyanazt az `AttachPlanSheet`-et nyitja előválasztott `mesocycle|running_block` típussal; detach után
overview és timeline invalidálódjon.

- [ ] **Step 4: Töltsd fel a Guards és Settings oldalakat**

Guards tone `lav`: összesített pajzs hero (`healthyCount/totalCount`), külön
`GoalGuardCard` strength/muscle statusra. Notes csak részletező szöveg; a státusz a typed mezőkből
jön. Settings tone `rose`: irány, célsúly, dátum, signed rate és guard chipek; az edit CTA a
meglévő sheetet nyitja, archive/delete másodlagos marad.

- [ ] **Step 5: Alkalmazd a mockup színeit és nyugodt motiont**

Új CSS kizárólag `--mz-*`/theme tokenből és `color-mix`-ből épül. Kártyánként egy `rise`, az
oldal `EntranceGroup`-ja indítja; hover/tap csak `np-press`. A komponensek 320 px-en is egy oszlopba
engedik a stat sort, értéket nem vágnak.

- [ ] **Step 6: GREEN mindkét módban, build és commit**

```bash
cd frontend && pnpm vitest run src/features/me/pages/Goal*Page.test.tsx \
  src/features/me/components/Goal*.test.tsx
VITE_USE_MOCK=true pnpm vitest run src/features/me/pages/Goal*Page.test.tsx \
  src/features/me/components/Goal*.test.tsx
pnpm build
cd .. && node scripts/lint-docs.mjs --errors-only
git add frontend/src/features/me/components/GoalDietWeekCard.tsx \
  frontend/src/features/me/components/GoalDietWeekCard.test.tsx \
  frontend/src/features/me/components/GoalSegmentRail.tsx \
  frontend/src/features/me/components/GoalSegmentRail.test.tsx \
  frontend/src/features/me/components/GoalConnectionTimeline.tsx \
  frontend/src/features/me/components/GoalConnectionTimeline.test.tsx \
  frontend/src/features/me/components/GoalGuardCard.tsx \
  frontend/src/features/me/components/GoalGuardCard.test.tsx \
  frontend/src/features/me/pages/GoalDietPage.tsx frontend/src/features/me/pages/GoalDietPage.test.tsx \
  frontend/src/features/me/pages/GoalSegmentPage.tsx frontend/src/features/me/pages/GoalSegmentPage.test.tsx \
  frontend/src/features/me/pages/GoalPlansPage.tsx frontend/src/features/me/pages/GoalPlansPage.test.tsx \
  frontend/src/features/me/pages/GoalGuardsPage.tsx frontend/src/features/me/pages/GoalGuardsPage.test.tsx \
  frontend/src/features/me/pages/GoalSettingsPage.tsx frontend/src/features/me/pages/GoalSettingsPage.test.tsx \
  frontend/src/styles/prototype.css docs/features/me.md docs/features/_platform-design-system.md
git commit -m "feat(me): add colorful goal detail pages (mezo-ricj.2)"
```

Pushold `feat/goal-hub-ui`, nyiss egy self-PR-t a Task 3+4 commitjaira, CI green után merge.

---

### Task 5: Suggestion preview, közös calculator és fingerprintes accept (`mezo-ricj.3` / 1)

**Files:**
- Modify: `api/base.yml` (minor contract version bump)
- Modify: `api/feature/goal/goal.yml`
- Modify (generated): `api/openapi.yml`
- Modify (generated): `frontend/src/data/_client/api.gen.ts`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/goal/engine/service/GoalPrescriptionCalculator.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/goal/service/GoalSuggestionDraftApplier.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/goal/service/GoalSuggestionFingerprintService.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/goal/service/GoalSuggestionPreviewService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/goal/engine/service/GoalEngineService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/goal/service/GoalSuggestionService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/goal/controller/GoalController.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/goal/repository/GoalSuggestionRepository.java`
- Modify: `backend/src/main/resources/messages.properties`
- Create: `backend/src/test/java/io/mrkuhne/mezo/feature/goal/GoalSuggestionPreviewApiIT.java`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/feature/goal/GoalSuggestionServiceIT.java`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/feature/goal/engine/service/GoalEvaluationServiceIT.java`
- Modify: `docs/features/goal-engine.md`

**Interfaces:**
- Produce: `GET /api/goals/{id}/suggestions/{suggestionId}/preview`.
- Change: accept endpoint body `GoalSuggestionAcceptRequest { previewFingerprint: string }`.
- Produce: `GoalSuggestionPreviewResponse { status, reasonCode, affectedFromWeek,
  affectedToWeek, current, proposed, changedFields, unchangedFields, warnings, blockers,
  canApply, previewFingerprint }`.
- Produce: `GoalPrescriptionCalculator.calculate(UUID userId, GoalEntity draft)` → internal
  `Calculation(TdeeBootstrapJson bootstrap, GoalPrescriptionJson prescription)`; no persistence,
  event vagy suggestion emit.
- Produce: `GoalSuggestionDraftApplier.apply(GoalEntity draft, GoalSuggestionEntity suggestion)`;
  pure mezőmódosítás, repository/service visszahívás nélkül.
- Produce: `GoalSuggestionFingerprintService.fingerprint(...)` → lowercase SHA-256 hex.

- [ ] **Step 1: Írd meg a preview/accept contractot és generálj**

`GoalSuggestionProjection` typed mezői: trajectory, targetWeightKg, targetDate,
`targetRateKgPerWeek`, `weekAverageKcal`, `trainingDayKcal`, `restDayKcal`, protein/carbs/fat,
`segmentFromWeek`, `segmentToWeek`, `segmentLabel`, `guardStatus`. `previewFingerprint` nullable
történeti/blocked nézetnél; accept request required `minLength: 64, maxLength: 64,
pattern: '^[0-9a-f]{64}$'`. A preview dokumentáljon 200/401/404; accept 400/401/404/409.

```bash
cd api/generate && npm install && npm run generate:api
cd ../../frontend && pnpm generate:api
```

- [ ] **Step 2: Írd meg a RED integration teszteket**

`GoalSuggestionPreviewApiIT`:

- GET nem módosít goal/suggestion sort;
- current/proposed ugyanaz phase/deload/weekly correction típusonként, és az unchanged lista
  tartalmazza a változatlan mezőket;
- bulkra forduló `84.2 → 78.0` preview blocker=`GOAL_DIRECTION_TARGET_CONFLICT`, canApply=false;
- no-token 401, B-user/foreign suggestion 404;
- accepted/dismissed/superseded row történeti diffet ad, canApply=false.

`GoalSuggestionServiceIT`: preview fingerprinttel acceptál; goal/diet setting/plan link/schedule/
suggestion status változás után a régi fingerprint `GOAL_SUGGESTION_STALE`; `generatedAt`-only
recompute után továbbra is acceptálható; blocker nem ír részlegesen.

- [ ] **Step 3: Futtasd RED-ben**

```bash
cd backend && ./mvnw clean test \
  -Dtest='GoalSuggestionPreviewApiIT,GoalSuggestionServiceIT,GoalEvaluationServiceIT' \
  -Dmezo.test.use-testcontainers=true
```

- [ ] **Step 4: Emeld ki a közös, mellékhatásmentes calculatort**

Mozgasd át a `GoalEngineService.evaluate` profile/bootstrap/trend/projection/guard/assemble részét:

```java
public Calculation calculate(UUID userId, GoalEntity goal) { ... }
public record Calculation(TdeeBootstrapJson bootstrap, GoalPrescriptionJson prescription) {}
```

Az engine ezután: ownership read → invariant fail-safe → `calculator.calculate` → a két JSON
persistálása → `triggerService.checkPhaseSuggestions`. A calculator nem hív repository `save`-ot,
nem publishol és nem hív trigger service-t. A meglévő engine IT-knek változatlanul zöldnek kell
maradniuk.

- [ ] **Step 5: Implementáld a draft previewt**

`GoalSuggestionPreviewService.preview(userId, goalId, suggestionId)` ownership szerint betölti a
goalt és a suggestiont státusztól függetlenül; mezőről mezőre másol egy transient `GoalEntity`
draftot ugyanazzal az id-val. A payloadot a külön, I/O-mentes `GoalSuggestionDraftApplier` viszi rá;
ugyanezt injektálja az accept service is, ezért nincs `GoalSuggestionService ↔ PreviewService`
constructor-ciklus. Direction conflictet blockerre fordít, más domain hibát nem nyel el.
Current/proposed calculationből építi a két typed projectiont és determinisztikusan rendezi a
changed/unchanged field keyeket.

- [ ] **Step 6: Implementáld a szemantikus fingerprintet**

```java
record SemanticInput(
    UUID suggestionId, String kind, String status, GoalSuggestionPayloadJson payload,
    String trajectory, BigDecimal startWeightKg, BigDecimal targetWeightKg,
    LocalDate startDate, LocalDate targetDate, BigDecimal rateTargetPctPerWeek,
    Integer balanceAdjustmentKcal, List<GoalSegmentOverrideJson> overrides,
    DietPreferences diet, List<PlanInput> plans, List<ScheduleInput> schedule) {}
```

Kanonikus rendezés: plans `(planType,startWeek,planId)`, schedule `(kind,day,time,id)`, override
`fromWeek,toWeek`; a `PlanInput` tartalmazza a link mezői mellett a linkelt terv
`status/startDate/endDate/weeks` értékeit és mesocycle esetén a phase-struktúrát is. Jacksonból
kapott byte tömb SHA-256. Tilos `prescription.generatedAt`, entity
`createdAt/updatedAt/decidedAt`. A fingerprintet preview és accept ugyanazzal a service-hívással
képzi újra.

- [ ] **Step 7: Kösd az acceptet a previewhoz**

`GoalSuggestionService.accept(userId, goalId, suggestionId, request)` sorrendje: owned proposed
read → `GoalSuggestionPreviewService` friss previewja → blocker check → constant-time fingerprint
compare → mismatch esetén `supersedeWriter.markSuperseded` + 409 → a
`GoalSuggestionDraftApplier` alkalmazása az élő managed goalon → accepted status → engine evaluate.
Controller csak továbbítja a generált requestet. A jelenlegi fingerprint nélküli accept megszűnik.

- [ ] **Step 8: GREEN, drift gate, docs és commit**

```bash
cd backend && ./mvnw clean test \
  -Dtest='GoalSuggestionPreviewApiIT,GoalSuggestionServiceIT,GoalEvaluationServiceIT,GoalContractIT,ArchitectureTest' \
  -Dmezo.test.use-testcontainers=true
cd ../frontend && pnpm build
cd .. && node scripts/lint-docs.mjs --errors-only
git add api/base.yml api/feature/goal/goal.yml api/openapi.yml frontend/src/data/_client/api.gen.ts \
  backend/src/main/java/io/mrkuhne/mezo/feature/goal/engine/service/GoalPrescriptionCalculator.java \
  backend/src/main/java/io/mrkuhne/mezo/feature/goal/engine/service/GoalEngineService.java \
  backend/src/main/java/io/mrkuhne/mezo/feature/goal/service/GoalSuggestionDraftApplier.java \
  backend/src/main/java/io/mrkuhne/mezo/feature/goal/service/GoalSuggestionFingerprintService.java \
  backend/src/main/java/io/mrkuhne/mezo/feature/goal/service/GoalSuggestionPreviewService.java \
  backend/src/main/java/io/mrkuhne/mezo/feature/goal/service/GoalSuggestionService.java \
  backend/src/main/java/io/mrkuhne/mezo/feature/goal/controller/GoalController.java \
  backend/src/main/java/io/mrkuhne/mezo/feature/goal/repository/GoalSuggestionRepository.java \
  backend/src/test/java/io/mrkuhne/mezo/feature/goal/GoalSuggestionPreviewApiIT.java \
  backend/src/test/java/io/mrkuhne/mezo/feature/goal/GoalSuggestionServiceIT.java \
  backend/src/test/java/io/mrkuhne/mezo/feature/goal/engine/service/GoalEvaluationServiceIT.java \
  backend/src/main/resources/messages.properties \
  docs/features/goal-engine.md
git commit -m "feat(goal): preview suggestions before applying them (mezo-ricj.3)"
```

Maradj a `feat/goal-suggestion-review` branchen; Task 6 ugyanennek a PR-nek a frontend commitja.

---

### Task 6: Javaslat részletoldal és igazított változásrács (`mezo-ricj.3` / 2)

**Files:**
- Modify: `frontend/src/data/me/goalApi.ts`
- Modify: `frontend/src/data/me/goalHooks.ts`
- Modify: `frontend/src/data/me/goalSuggestionHooks.test.tsx`
- Modify: `frontend/src/data/me/goals.ts`
- Create: `frontend/src/features/me/logic/goalSuggestionDiff.ts`
- Create: `frontend/src/features/me/logic/goalSuggestionDiff.test.ts`
- Create: `frontend/src/features/me/components/GoalSuggestionDiffGrid.tsx`
- Create: `frontend/src/features/me/components/GoalSuggestionDiffGrid.test.tsx`
- Create: `frontend/src/features/me/pages/GoalSuggestionPage.tsx`
- Create: `frontend/src/features/me/pages/GoalSuggestionPage.test.tsx`
- Modify: `frontend/src/app/router.tsx`
- Modify: `frontend/src/styles/prototype.css`
- Modify: `docs/features/me.md`

**Interfaces:**
- Produce: `useGoalSuggestionPreview(goalId, suggestionId)`.
- Change: `useSuggestionActions().accept(goalId, suggestionId, previewFingerprint)`.
- Produce: `toSuggestionDiffRows(preview)` → fix sorrendű `DiffRow[]`, formázott current/proposed/
  delta értékekkel; a komponens csak renderel.
- Route: `/me/goals/weight/suggestions/:suggestionId` → `GoalSuggestionPage`.

- [ ] **Step 1: Írd meg a hook és pure-diff RED teszteket**

Hook tesztelje a preview GET-et, null paraméterek disabled állapotát, accept body pontos
`{ previewFingerprint }` alakját és az alábbi success invalidációkat: `goals`, `goal-overview`,
`goal-suggestions`, konkrét preview és `notification-feed`. Mock módban preview seed és stateful
accept után `accepted` történeti állapot járjon.

`goalSuggestionDiff.test.ts` pinelje a sorok sorrendjét:
trajectory, targetWeightKg, targetDate, targetRate, weekAverageKcal, trainingDayKcal,
restDayKcal, protein, carbs, fat, segment, guards. Unchanged mező is kapjon `Nem változik` státuszt;
nullable szám ne formázódjon `NaN`-ná.

- [ ] **Step 2: Írd meg a review oldal RED tesztjeit**

Fedés: loading; teljes current/proposed diff; warning; blocker+disabled CTA; stale 409 után
`Előnézet frissítése`; apply success hubra navigál; `Most nem` csak visszalép; külön dismiss;
accepted/dismissed/superseded történeti oldal apply nélkül. Bizonyítsd, hogy mount és első CTA tap
nem hív acceptet.

```bash
cd frontend && pnpm vitest run src/data/me/goalSuggestionHooks.test.tsx \
  src/features/me/logic/goalSuggestionDiff.test.ts \
  src/features/me/components/GoalSuggestionDiffGrid.test.tsx \
  src/features/me/pages/GoalSuggestionPage.test.tsx
```

- [ ] **Step 3: Implementáld a data műveleteket**

`goalApi.previewSuggestion(id,sid)` typed response; `acceptSuggestion` generated
`GoalSuggestionAcceptRequest` bodyval és `satisfies`-szal. A preview query key stabil:
`['goal-suggestion-preview', goalId, suggestionId]`. A hook mutációja a globális mutation error
toastot használja; csak a 409 kap helyi, gazdag stale állapotot.

- [ ] **Step 4: Építsd meg a fix-baseline diff gridet**

DOM soronként ugyanaz:

```tsx
<article className="gdiff-row" data-field={row.field}>
  <div className="gdiff-label">{row.label}</div>
  <div className="gdiff-current"><small>Most</small><strong>{row.current}</strong></div>
  <span className="gdiff-arrow" aria-hidden="true">→</span>
  <div className="gdiff-proposed"><small>Javasolt</small><strong>{row.proposed}</strong></div>
  <div className="gdiff-delta">{row.delta}</div>
</article>
```

CSS: a külső grid fix `grid-template-areas` és közös sor-height; `small` és `strong` saját fix
baseline sorban; delta külön grid-area. 320 px-en sem vált current/proposed eltérő sorlogikára.
`GoalSuggestionDiffGrid.test.tsx` minden rowban azonos öt cellát és class-nevet vár.

- [ ] **Step 5: Építsd meg a színes review oldalt**

Coral/gold hero az okkal és érintett hetekkel; alatta diff, warnings, blockers. A primer gomb
felirata pontosan `Módosítások alkalmazása`; csak `canApply && previewFingerprint &&
status==='proposed'` esetén aktív. `Most nem` navigál a hubra és nem dismissel. Dismiss külön ghost
CTA megerősítéssel. Apply success `useToast().success(...)`, majd `/me/goals/weight`.

- [ ] **Step 6: GREEN mindkét módban, build és commit**

```bash
cd frontend && pnpm vitest run src/data/me/goalSuggestionHooks.test.tsx \
  src/features/me/logic/goalSuggestionDiff.test.ts \
  src/features/me/components/GoalSuggestionDiffGrid.test.tsx \
  src/features/me/pages/GoalSuggestionPage.test.tsx
VITE_USE_MOCK=true pnpm vitest run src/data/me/goalSuggestionHooks.test.tsx \
  src/features/me/logic/goalSuggestionDiff.test.ts \
  src/features/me/components/GoalSuggestionDiffGrid.test.tsx \
  src/features/me/pages/GoalSuggestionPage.test.tsx
pnpm build
cd .. && node scripts/lint-docs.mjs --errors-only
git add frontend/src/data/me/goalApi.ts frontend/src/data/me/goalHooks.ts \
  frontend/src/data/me/goalSuggestionHooks.test.tsx frontend/src/data/me/goals.ts \
  frontend/src/features/me/logic/goalSuggestionDiff.ts \
  frontend/src/features/me/logic/goalSuggestionDiff.test.ts \
  frontend/src/features/me/components/GoalSuggestionDiffGrid.tsx \
  frontend/src/features/me/components/GoalSuggestionDiffGrid.test.tsx \
  frontend/src/features/me/pages/GoalSuggestionPage.tsx \
  frontend/src/features/me/pages/GoalSuggestionPage.test.tsx \
  frontend/src/app/router.tsx frontend/src/styles/prototype.css docs/features/me.md
git commit -m "feat(me): review every goal change before apply (mezo-ricj.3)"
```

Pushold `feat/goal-suggestion-review`, self-PR + CI green után merge.

---

### Task 7: Goal suggestion értesítés a harang feedben (`mezo-ricj.4`)

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/appnotification/domain/AppNotificationKind.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/goal/service/GoalSuggestionProposedEvent.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/goal/service/GoalSuggestionNotificationListener.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/goal/service/GoalSuggestionService.java`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/feature/appnotification/AppNotificationKindTest.java`
- Create: `backend/src/test/java/io/mrkuhne/mezo/feature/goal/GoalSuggestionNotificationIT.java`
- Modify: `frontend/src/data/types.ts`
- Modify: `frontend/src/data/notificationKindMeta.test.ts`
- Modify: `frontend/src/data/notification/feedMock.ts`
- Modify: `frontend/src/features/me/pages/NotificationFeedPage.kinds.test.tsx`
- Modify: `docs/features/goal-engine.md`
- Modify: `docs/features/_platform-notifications.md`

**Interfaces:**
- Add enum: `GOAL_SUGGESTION("goal_suggestion", null,
  "/me/goals/weight/suggestions")`.
- Produce event: `GoalSuggestionProposedEvent(UUID userId, UUID goalId, UUID suggestionId,
  String kind)`.
- Consume: `AppNotificationEmitter.emit(owner, kind, title, body, deeplink, refId, dedupKey)`.
- FE kind: `'goal_suggestion'` → `{ tint: 'goal', clay: 'i-cel' }`.

- [ ] **Step 1: Írd meg a RED enum/meta teszteket**

`AppNotificationKindTest` várjon 15 kindot, `key=goal_suggestion`, null family, megfelelő base
deeplink. A TS meta teszt listája és countja tartalmazza a `goal_suggestion`-t; a feed kinds teszt
ellenőrizze az `i-cel` clay ikont és a suggestion review deeplink navigációját.

- [ ] **Step 2: Írd meg az AFTER_COMMIT RED integration tesztet**

`GoalSuggestionNotificationIT` valódi service tranzakcióval és repositorykkal bizonyítsa:

1. új proposed row után Awaitilityvel pontosan egy `goal_suggestion` notification;
2. ugyanaz a dedup input újraértékelve nem ad második sort;
3. superseding új suggestion új id-val új notificationt ad;
4. rollbackelt propose után nincs feed sor;
5. B-user feedje üres.

Ne mockold az emittert és ne hívj listener metódust közvetlenül.

```bash
cd backend && ./mvnw clean test \
  -Dtest='AppNotificationKindTest,GoalSuggestionNotificationIT' \
  -Dmezo.test.use-testcontainers=true
```

- [ ] **Step 3: Publisholj csak új suggestion után**

`GoalSuggestionService` constructor-injektál `ApplicationEventPublisher`-t. Az existing-open és
already-decided ág nem publishol. Kizárólag a `save(e)` eredménye után:

```java
GoalSuggestionEntity saved = suggestionRepository.save(e);
eventPublisher.publishEvent(new GoalSuggestionProposedEvent(
    userId, goalId, saved.getId(), kind));
return saved;
```

- [ ] **Step 4: Implementáld az izolált listener-t**

```java
@Component
@RequiredArgsConstructor
public class GoalSuggestionNotificationListener {
    private final AppNotificationEmitter emitter;

    @Async("taskExecutor")
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onProposed(GoalSuggestionProposedEvent event) {
        emitter.emit(event.userId(), AppNotificationKind.GOAL_SUGGESTION,
            "Új javaslat a célodhoz", bodyFor(event.kind()),
            AppNotificationKind.GOAL_SUGGESTION.deeplink() + "/" + event.suggestionId(),
            event.suggestionId(), "goal_suggestion:" + event.suggestionId());
    }
}
```

`bodyFor` csak a kindot nevezi meg (`Heti korrekció` / `Szakaszváltás`), kcal számot nem ígér.
Notification hiba az emitteren belül marad, goal transactiont nem érint.

- [ ] **Step 5: Kösd be a frontend katalógust**

Add a union/meta/mock bejegyzést. A meglévő `notificationKindMeta(string)` fallback marad; ne
szigorítsd a wire response-t úgy, hogy egy jövőbeli backend kind összeomlassza a feedet.

- [ ] **Step 6: GREEN, mindkét FE mód, docs és commit**

```bash
cd backend && ./mvnw clean test \
  -Dtest='AppNotificationKindTest,AppNotificationServiceIT,GoalSuggestionNotificationIT,ArchitectureTest' \
  -Dmezo.test.use-testcontainers=true
cd ../frontend && pnpm vitest run src/data/notificationKindMeta.test.ts \
  src/features/me/pages/NotificationFeedPage.kinds.test.tsx
VITE_USE_MOCK=true pnpm vitest run src/data/notificationKindMeta.test.ts \
  src/features/me/pages/NotificationFeedPage.kinds.test.tsx
pnpm build
cd .. && node scripts/lint-docs.mjs --errors-only
git add backend/src/main/java/io/mrkuhne/mezo/feature/appnotification/domain/AppNotificationKind.java \
  backend/src/main/java/io/mrkuhne/mezo/feature/goal/service/GoalSuggestionProposedEvent.java \
  backend/src/main/java/io/mrkuhne/mezo/feature/goal/service/GoalSuggestionNotificationListener.java \
  backend/src/main/java/io/mrkuhne/mezo/feature/goal/service/GoalSuggestionService.java \
  backend/src/test/java/io/mrkuhne/mezo/feature/appnotification/AppNotificationKindTest.java \
  backend/src/test/java/io/mrkuhne/mezo/feature/goal/GoalSuggestionNotificationIT.java \
  frontend/src/data/types.ts frontend/src/data/notificationKindMeta.test.ts \
  frontend/src/data/notification/feedMock.ts \
  frontend/src/features/me/pages/NotificationFeedPage.kinds.test.tsx \
  docs/features/goal-engine.md docs/features/_platform-notifications.md
git commit -m "feat(notification): announce new goal suggestions (mezo-ricj.4)"
```

Push `feat/goal-suggestion-notification`, self-PR + CI green után merge.

---

### Task 8: Plan-link hardening és valódi sport schedule lane (`mezo-ricj.5`)

**Files:**
- Modify: `api/base.yml` (minor contract version bump)
- Modify: `api/feature/goal/goal.yml`
- Modify (generated): `api/openapi.yml`
- Modify (generated): `frontend/src/data/_client/api.gen.ts`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/goal/service/GoalPlanLinkService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/goal/service/GoalTimelineService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/goal/mapper/GoalPlanLinkMapper.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/goal/repository/GoalPlanLinkRepository.java`
- Modify: `backend/src/main/resources/messages.properties`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/feature/goal/GoalPlanLinkServiceIT.java`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/feature/goal/GoalTimelineContractIT.java`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/feature/goal/GoalEngineRecomputeIT.java`
- Modify: `frontend/src/features/me/sheets/AttachPlanSheet.tsx`
- Modify: `frontend/src/features/me/sheets/AttachPlanSheet.test.tsx`
- Modify: `frontend/src/features/me/components/GoalConnectionTimeline.tsx`
- Modify: `frontend/src/features/me/components/GoalConnectionTimeline.test.tsx`
- Delete if `rg` proves no consumer: `frontend/src/features/me/components/GoalTimeline.tsx` / `.test.tsx`
- Delete if `rg` proves no consumer: `frontend/src/features/me/components/GoalPlanSlots.tsx` / `.test.tsx`
- Modify: `docs/features/goal-engine.md`
- Modify: `docs/features/me.md`

**Interfaces:**
- Change: `GoalPlanLinkResponse` required boolean `clippedAtGoalEnd`.
- Change: `GoalPlanLinkMapper.toResponse(GoalPlanLinkEntity entity, GoalPlanRef plan,
  int goalWeeks)` computes clipping from `startWeek + plan.weeks - 1 > goalWeeks`.
- Preserve: attach/detach calls `goalEngineService.evaluate(userId, goalId)` in the same write flow.
- Errors: `GOAL_PLAN_ARCHIVED`, `GOAL_PLAN_DUPLICATE`, `GOAL_PLAN_OVERLAP`,
  `GOAL_PLAN_OUTSIDE_WINDOW`.

- [ ] **Step 1: Contract-first add `clippedAtGoalEnd` és generálj**

```yaml
GoalPlanLinkResponse:
  required: [id, planType, planId, startWeek, endWeek, clippedAtGoalEnd, plan]
  properties:
    clippedAtGoalEnd:
      type: boolean
      description: true when the source plan continues beyond the goal window
```

```bash
cd api/generate && npm install && npm run generate:api
cd ../../frontend && pnpm generate:api
```

- [ ] **Step 2: Írd meg az összes validation RED tesztet**

`GoalPlanLinkServiceIT`: foreign/unknown mellett archived plan, ugyanaz a plan kétszer, azonos
planType intervallum-overlap, `startWeek=0`, `startWeek>goalWeeks`; a különböző típus átfedése
engedett. Túlnyúló 6 hetes plan W5-re nyolchetes goalban `endWeek=8` és
`clippedAtGoalEnd=true`. Nem túlnyúló eset false.

`GoalTimelineContractIT`: HTTP B-user 404; typed 400 kódok; clipped roundtrip.
`GoalEngineRecomputeIT`: mesocycle link a változatlan gym/sport schedule mellett szakaszt hoz létre,
de `weeklyEatKcalPerDay`/azonos heti kcal nem változik; running block hozzáadása viszont növeli az
EAT-et. Ez az auditált „miért nem változott a heti kalória?” viselkedést rögzíti.

- [ ] **Step 3: Futtasd RED-ben**

```bash
cd backend && ./mvnw clean test \
  -Dtest='GoalPlanLinkServiceIT,GoalTimelineContractIT,GoalEngineRecomputeIT' \
  -Dmezo.test.use-testcontainers=true
```

- [ ] **Step 4: Validálj mentés előtt, egy tranzakcióban**

`attachPlan` sorrendje: owned goal → totalWeeks → start range → owned plan → archived reject →
raw end → clamped end → meglévő active linkek ellen duplicate/azonos-típus overlap → save → map →
evaluate. Overlap képlete:

```java
boolean overlaps = existing.getPlanType().equals(req.getPlanType())
    && existing.getStartWeek() <= clampedEnd
    && startWeek <= existing.getEndWeek();
```

Az errorok `SystemMessage.error(code)` request-level hibák. A plan ownershipet továbbra is a két
train repository `findByIdAndCreatedByAndDeletedFalse` hívása adja; foreign row 404 marad.

- [ ] **Step 5: Add át a mappernek a goal windowt**

Mind attach, mind timeline ugyanazzal a `goalWeeks` értékkel hívja az új mapper szignatúrát. Az
entity `endWeek` már clampelt; a boolean a forrásterv teljes hossza alapján készül. Nincs DB
migráció és nincs elhallgatott truncation.

- [ ] **Step 6: Frissítsd a Plans UI-t valós adatokra**

`GoalConnectionTimeline` kizárólag response adatból rajzol sport row-t: title/kind, HU weekday,
time és `durationMin`. A clipped link chipje `A cél végéig`. `AttachPlanSheet` listájából vedd ki
az archived és már linkelt terveket, de a backend marad az autoritatív védelem. A `GoalTimeline`
hardcoded `BVSC · végig` implementációját és az immár nem használt plan slot komponenst csak
`rg`-vel bizonyított nulla consumer után töröld.

- [ ] **Step 7: GREEN backend + FE mindkét mód, docs és commit**

```bash
cd backend && ./mvnw clean test \
  -Dtest='GoalPlanLinkServiceIT,GoalTimelineContractIT,GoalEngineRecomputeIT,GoalOverviewApiIT,ArchitectureTest' \
  -Dmezo.test.use-testcontainers=true
cd ../frontend && pnpm vitest run src/features/me/sheets/AttachPlanSheet.test.tsx \
  src/features/me/components/GoalConnectionTimeline.test.tsx \
  src/features/me/pages/GoalPlansPage.test.tsx
VITE_USE_MOCK=true pnpm vitest run src/features/me/sheets/AttachPlanSheet.test.tsx \
  src/features/me/components/GoalConnectionTimeline.test.tsx \
  src/features/me/pages/GoalPlansPage.test.tsx
pnpm build
cd .. && node scripts/lint-docs.mjs --errors-only
git add api/base.yml api/feature/goal/goal.yml api/openapi.yml frontend/src/data/_client/api.gen.ts \
  backend/src/main/java/io/mrkuhne/mezo/feature/goal/service/GoalPlanLinkService.java \
  backend/src/main/java/io/mrkuhne/mezo/feature/goal/service/GoalTimelineService.java \
  backend/src/main/java/io/mrkuhne/mezo/feature/goal/mapper/GoalPlanLinkMapper.java \
  backend/src/main/java/io/mrkuhne/mezo/feature/goal/repository/GoalPlanLinkRepository.java \
  backend/src/test/java/io/mrkuhne/mezo/feature/goal/GoalPlanLinkServiceIT.java \
  backend/src/test/java/io/mrkuhne/mezo/feature/goal/GoalTimelineContractIT.java \
  backend/src/test/java/io/mrkuhne/mezo/feature/goal/GoalEngineRecomputeIT.java \
  backend/src/main/resources/messages.properties \
  frontend/src/features/me/sheets/AttachPlanSheet.tsx \
  frontend/src/features/me/sheets/AttachPlanSheet.test.tsx \
  frontend/src/features/me/components/GoalConnectionTimeline.tsx \
  frontend/src/features/me/components/GoalConnectionTimeline.test.tsx \
  frontend/src/features/me/components/GoalTimeline.tsx \
  frontend/src/features/me/components/GoalTimeline.test.tsx \
  frontend/src/features/me/components/GoalPlanSlots.tsx \
  frontend/src/features/me/components/GoalPlanSlots.test.tsx \
  docs/features/goal-engine.md docs/features/me.md
git commit -m "fix(goal): harden plan links and show real sport load (mezo-ricj.5)"
```

Push `feat/goal-plan-link-hardening`, self-PR + CI green után merge.

---

### Task 9: Vizuális/a11y hardening, living docs és teljes kapu (`mezo-ricj.6`)

**Files:**
- Modify: `frontend/tests/visual/visual.spec.ts`
- Modify: `frontend/tests/visual/layout.spec.ts`
- Add/update: `frontend/tests/visual/visual.spec.ts-snapshots/me-goal-*.png`
- Modify: `frontend/src/shared/ui/mozaik/mozaikCssTokens.test.ts`
- Modify: `frontend/src/styles/prototype.css`
- Modify: `frontend/src/features/me/pages/GoalsPage.test.tsx`
- Modify: `frontend/src/features/me/pages/GoalSuggestionPage.test.tsx`
- Modify: `docs/features/goal-engine.md`
- Modify: `docs/features/me.md`
- Modify: `docs/features/_platform-notifications.md`
- Modify: `docs/features/_platform-design-system.md`
- Regenerate: `docs/CODEMAP.md`

**Interfaces:**
- No new product contract. Ez a task a már szállított viselkedés vizuális, accessibility,
  dokumentációs és regressziós kapuja.
- Produce visual case names: `me-goal-hub`, `me-goal-diet`, `me-goal-segment`, `me-goal-plans`,
  `me-goal-guards`, `me-goal-settings`, `me-goal-suggestion`.

- [ ] **Step 1: Auditáld 1:1 a jóváhagyott mockup ellen**

Nyisd meg a repo assetet és a mock-mode appot azonos 390 px viewporton. Ellenőrizd: hero hierarchia,
csempearány, washok, clay spotok, stat-sűrűség, back chip, alsó tabbar/CTA távolság. Eltérésnél a
mockup konkrét tokenjét/arányát másold; ne „hasonló” új értéket találj ki. Valós adat miatti
eltérést írd a PR `Deviations` részébe.

- [ ] **Step 2: Írd meg a layout/a11y RED gate-eket**

`layout.spec.ts` 320, 390 és 430 px szélességen járja végig mind a hét route-ot, és várja:

```ts
expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
```

Ezen felül: primer CTA nem metszi a tabbart; diff minden row `current` és `proposed` bounding-box
top értéke legfeljebb 1 px-cel tér el; 200%-os text zoomnál sincs levágott kcal. RTL tesztekben
minden tile valódi button, fókuszolható; diff arrow `aria-hidden`; warning/blocker szövegesen is
azonosítható; reduced motion alatt nincs `mz-play`-ből időzített átmeneti állapot.

- [ ] **Step 3: Finomhangold a CSS-t és a motiont**

Csak a goal-prefixed vagy meglévő Mozaik classokat módosítsd. Minden új token mindkét theme rootban
szerepeljen, amit `mozaikCssTokens.test.ts` pinel. A count-up mountkor egyszer fut; adatfrissítésnél
`useCountUpOnChange`, nem nulláról villanás. `@media (prefers-reduced-motion: reduce)` alatt
duration/transform nélkül a végállapot renderelődik.

- [ ] **Step 4: Generáld a darwin baseline-okat friss szerverrel**

```bash
pkill -f 'vite.*4318' || true
cd frontend && pnpm test:visual:update --grep 'me-goal-'
```

Ellenőrizd `git status` és a snapshot mtime-ját; a puszta „passed” nem bizonyít baseline-írást.
Linux goldenhez használd a repo `update-visual-baselines.yml` workflow-ját a feature branchen, majd
ha a bot commit `action_required`, hagyd jóvá a run-t a projekt dokumentált módján.

- [ ] **Step 5: Frissítsd a living docsot és a CODEMAP-et**

- `goal-engine.md`: invariant, overview, preview/fingerprint, notification, plan validation.
- `me.md`: új hub IA, route-ok, hat tile és state-ek.
- `_platform-notifications.md`: `goal_suggestion`, dedup, after-commit, deeplink.
- `_platform-design-system.md`: goal hub mint Mozaik referencia + fixed-baseline diff recipe.

```bash
node scripts/gen-codemap.mjs
node scripts/gen-codemap.mjs --check
node scripts/lint-docs.mjs --errors-only
```

- [ ] **Step 6: Futtasd a lokális kapukat**

```bash
cd backend && ./mvnw clean test \
  -Dtest='Goal*,AppNotificationKindTest,AppNotificationServiceIT,ArchitectureTest' \
  -Dmezo.test.use-testcontainers=true
cd ../frontend && pnpm build && pnpm test
VITE_USE_MOCK=true pnpm test
pnpm test:visual --grep 'me-goal-'
cd ../api/generate && npm run generate:api
cd ../.. && git diff --exit-code api/openapi.yml frontend/src/data/_client/api.gen.ts
node scripts/gen-codemap.mjs --check
node scripts/lint-docs.mjs --errors-only
```

Várt: minden lokális kapu zöld. A teljes backend suite továbbra is CI-ben autoritatív.

- [ ] **Step 7: Commit, self-PR és CI**

```bash
git add frontend/tests/visual frontend/src/styles/prototype.css \
  frontend/src/shared/ui/mozaik/mozaikCssTokens.test.ts \
  frontend/src/features/me/pages/GoalsPage.test.tsx \
  frontend/src/features/me/pages/GoalSuggestionPage.test.tsx \
  docs/features/goal-engine.md docs/features/me.md \
  docs/features/_platform-notifications.md docs/features/_platform-design-system.md \
  docs/CODEMAP.md
git commit -m "test(goal): lock the goal hub visual contract (mezo-ricj.6)"
git push -u origin feat/goal-hub-polish
gh pr create --base main --head feat/goal-hub-polish \
  --title "test(goal): lock the goal hub visual contract (mezo-ricj.6)" \
  --body-file /tmp/mezo-ricj-6-pr.md
gh pr checks --watch
```

CI green után a projekt `--no-ff` folyamatával merge, push main, majd:

```bash
bd close mezo-szsj mezo-ricj.1 mezo-ricj.2 mezo-ricj.3 mezo-ricj.4 mezo-ricj.5 mezo-ricj.6 \
  --reason="Implemented, verified and merged through CI"
bd close mezo-ricj --reason="Goal hub redesign shipped"
bd dolt push
git status
```

Végállapot: nincs nyitott child, a main up-to-date, a release notes/PR hivatkozik a kilenc
implementációs commitra és az esetleges vizuális eltérésekre.

# Életcél 2c — ha–akkor triggerek + LIFE_GOAL_PLAN + Jelek Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A ha–akkor tervek gépi kiértékelése (két esemény-listener + az éjjeli job késleltetett ága) `LIFE_GOAL_PLAN` feed-értesítéssel, plusz a `GET /api/life-goals/signals` liveness-bővítése és a `JelekPage` transzparencia-oldal.

**Architecture:** Mindhárom trigger-forrás (`sport_session_logged`, `checkin_energy_lte`, `ritual_missed`) EGYETLEN közös predikátumra képződik le: „a nap metrika-értéke kielégíti-e a szabályt" (`SPORT_LOAD_MIN > 0`, `CHECKIN_ENERGY <= küszöb`, `RITUAL_CLOSED hiányzik/0`). A metrika-értéket a már meglévő `SignalSource` lista adja (`PillarSourceJson("metric", key, …)` dispatch, ahogy a `LifeGoalProgressService.windowFor`), így a lifegoal nem szerez új függőséget a companionra és a kapcsolók változatlanul kapuznak. Az azonnali (delayHours 0/null) tervek egy `@Async @TransactionalEventListener(AFTER_COMMIT)` listenerből szólalnak meg (`CheckInSavedEvent` — létezik; `SportSessionLoggedEvent` — a train adja hozzá, D-4), a késleltetettek és a `ritual_missed` a MEGLÉVŐ `LifeGoalEvalJob.runEval()` következő futásából. Az „egy terv naponta egyszer, csak első átmenetkor" garanciát a `dedupKey = <goalId>:<planIdx>:<day>` adja, amit az `AppNotificationService` exists-check + unique index szintjén kikényszerít. A liveness ugyanezt a `SignalSource` dispatch-et használja a 7 napos ablakon, forrásonként.

**Tech Stack:** Spring Boot 3 / Java 21 (backend, JPA + Liquibase, Testcontainers ITek), OpenAPI-first kontraktus (`api/feature/lifegoal/lifegoal.yml` → generált DTO-k), React 18 + TypeScript + Vite + Vitest + MSW (frontend), Playwright vizuális goldenek.

## Global Constraints

- **Worktree:** minden parancs `/Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mace-auto-approval-295081` alól, ABSZOLÚT úttal. SOHA ne `cd`-zz az elsődleges repóba. A Bash cwd ragad a hívások között.
- **Ág:** `feat/lifegoal-triggers` (már létezik, `origin/main`-ről). bd id minden commit-subjectben: `(mezo-iizd.7)`.
- **Backend fókuszált teszt MINDIG:** `./mvnw clean test -Dmezo.test.use-testcontainers=true -Dtest='...'` — `clean` nélkül és Testcontainers nélkül a fixed-DB mód versenyez és hamis hibát ad.
- **ArchUnit külön:** `./mvnw clean test -Dmezo.test.use-testcontainers=true -Dtest='*Arch*Test'`.
- **Nincs mock az integrációs tesztekben** (házirend). Ha egy hibaág mock nélkül nem provokálható, javadocba írd le, miért, és NE találj ki mockot.
- **FE tesztek MINDIG explicit módban, KÜLÖN parancsban:** `VITE_USE_MOCK=true pnpm test ...` ÉS `VITE_USE_MOCK=false pnpm test ...`. Az unset = mock, tehát a bare `pnpm test` kétszer mockot futtat.
- **Kontrakt-first:** boundary-DTO-t KÉZZEL ÍRNI TILOS. Sorrend: `api/feature/lifegoal/lifegoal.yml` szerkesztés → `cd api/generate && npm run generate:api` → `cd frontend && pnpm generate:api`.
- **CSS-guard:** a `lg-*` szabályok a `frontend/src/styles/prototype.css`-ben a „Today · maradék sheet-nyelv" szekció ELŐTT maradnak (jelenleg a `.lg-sumpil` blokk zárja őket ~8862. sor környékén).
- **Design 2.0 kötelező:** a `JelekPage` vizuális igazsága `docs/design_2.0/prototypes/src/celok-body.html` `#page-jelek` (480–504. sor). Clay ikon, sosem emoji.
- **Trigger-forrás zárt halmaz:** `sport_session_logged`, `checkin_energy_lte`, `ritual_missed` — pontosan az, amit `LifeGoalProposeLlmAdapter.TRIGGER_SOURCES` validál. Új forrást ez a szelet NEM vezet be.
- **Az „evaluable" definíció:** csak `status == "active"` cél kap kiértékelést/értesítést — ugyanaz a guard, amit `LifeGoalProgressService.evaluateDays` használ.
- **Értesítés sosem törhet domain-írást:** minden emit az `AppNotificationEmitter`-en megy (always-on facade, saját try/catch), minden listener saját try/catch-csel.

---

## File Structure

**Backend — új:**
- `backend/src/main/java/io/mrkuhne/mezo/feature/train/service/SportSessionLoggedEvent.java` — a train által publikált esemény (D-4), a `CheckInSavedEvent` mintája.
- `backend/src/main/java/io/mrkuhne/mezo/feature/lifegoal/service/LifeGoalTriggerRules.java` — tiszta (statikus, függőség nélküli) szabály-osztály: forrás → metrika-kulcs + predikátum.
- `backend/src/main/java/io/mrkuhne/mezo/feature/lifegoal/service/LifeGoalTriggerService.java` — a kiértékelő + emitter (azonnali és késleltetett ág).
- `backend/src/main/java/io/mrkuhne/mezo/feature/lifegoal/service/LifeGoalTriggerListener.java` — `@Async` `AFTER_COMMIT` listener a két eseményre.
- Tesztek: `LifeGoalTriggerRulesTest.java` (unit), `LifeGoalTriggerIT.java`, `LifeGoalSignalsLivenessIT.java`.

**Backend — módosul:**
- `appnotification/domain/AppNotificationKind.java` — `LIFE_GOAL_PLAN`.
- `feature/train/service/SportService.java:58-79` — esemény publikálás.
- `feature/lifegoal/service/LifeGoalEvalJob.java` — a késleltetett ág hívása.
- `feature/lifegoal/service/LifeGoalSignalService.java` — liveness.
- `feature/lifegoal/controller/LifeGoalController.java:46` — `currentUserId.get()` átadás.
- `backend/src/test/java/io/mrkuhne/mezo/feature/appnotification/AppNotificationKindTest.java` — 14 fajta.

**Kontraktus:** `api/feature/lifegoal/lifegoal.yml` (`SignalCatalogEntry` + 4 mező), `api/openapi.yml` + `frontend/src/data/_client/api.gen.ts` generált.

**Frontend — új:**
- `frontend/src/features/me/pages/JelekPage.tsx` + `JelekPage.test.tsx`.

**Frontend — módosul:**
- `frontend/src/app/router.tsx:337` környéke — statikus `me/goals/signals` route a `me/goals/:id` ELŐTT.
- `frontend/src/features/me/pages/CelokPage.tsx` — „Jelek" sor a parkolt célok után.
- `frontend/src/data/lifegoal/lifegoalMock.ts` — id + liveness a 28 katalógus-soron.
- `frontend/src/data/types.ts` + `frontend/src/data/notificationKindMeta.test.ts` — `life_goal_plan` fajta.
- `frontend/src/styles/prototype.css` — `.lg-sig*` szabályok a `.lg-sumpil` UTÁN, a Today-szekció ELŐTT.
- `frontend/tests/visual/visual.spec.ts` — `me-cel-jelek` route.

**Docs:** `docs/features/lifegoal.md` (§3/§5/§9/§10), `docs/CODEMAP.md` (regenerált), `backend/src/main/resources/application.yml` (komment).

---

### Task 1: Kontraktus — `SignalCatalogEntry` liveness-mezők

**Files:**
- Modify: `api/feature/lifegoal/lifegoal.yml:273-282`
- Generated (ne szerkeszd kézzel): `api/openapi.yml`, `frontend/src/data/_client/api.gen.ts`

**Interfaces:**
- Produces: `SignalCatalogEntry` DTO négy új mezővel — `id: String`, `live: Boolean`, `daysWithData: Integer`, `fedPillars: List<String>`. Ezekre épít a Task 2 (backend kitöltés) és a Task 7 (FE render).

- [ ] **Step 1: Írd át a `SignalCatalogEntry` sémát**

`api/feature/lifegoal/lifegoal.yml`-ben a `SignalCatalogEntry:` blokk (273. sor) legyen:

```yaml
    SignalCatalogEntry:
      type: object
      required: [id, source, label, group, kinds, unit, live, daysWithData, fedPillars]
      properties:
        id: { type: string, description: stable catalog id (SignalCatalog#id) — the JelekPage row key }
        source: { $ref: '#/components/schemas/PillarSource' }
        label: { type: string }
        group: { type: string, description: Hungarian group label (Alvás · Fuel · Edzés · Elme · Activity · Emberek · Életjel) }
        kinds: { type: array, items: { $ref: '#/components/schemas/PillarKind' } }
        unit: { type: string }
        defaultSkillKey: { type: string }
        live: { type: boolean, description: had at least one data day in the last 7 days (mezo-iizd.7) }
        daysWithData: { type: integer, minimum: 0, maximum: 7, description: data days out of the last 7 }
        fedPillars: { type: array, items: { type: string }, description: labels of the caller's ACTIVE goals' active pillars fed by this signal }
```

- [ ] **Step 2: Generáld újra a kontraktust**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mace-auto-approval-295081/api/generate && npm run generate:api
```

Ezután:

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mace-auto-approval-295081/frontend && pnpm generate:api
```

- [ ] **Step 3: Ellenőrizd, hogy a generált oldalak felvették a mezőket**

```bash
grep -n "daysWithData" api/openapi.yml frontend/src/data/_client/api.gen.ts | head
```

Elvárt: mindkét fájlban van találat.

- [ ] **Step 4: Fordulj le (a backend most még nem tölti a mezőket, de a DTO builder létezik)**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mace-auto-approval-295081/backend && ./mvnw -q compile
```

Elvárt: BUILD SUCCESS (a `LifeGoalSignalService` a builder hiányzó mezőit `null`-lal hagyja — Java builder, nem kötelező mező).

- [ ] **Step 5: Commit**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mace-auto-approval-295081 && git add api frontend/src/data/_client/api.gen.ts && git commit -m "feat(api): jel-katalógus liveness-mezők a kontraktusban (mezo-iizd.7)"
```

---

### Task 2: Backend liveness a `/signals` végponton

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/lifegoal/service/LifeGoalSignalService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/lifegoal/controller/LifeGoalController.java:46`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/lifegoal/LifeGoalSignalsLivenessIT.java` (create)

**Interfaces:**
- Consumes: Task 1 `SignalCatalogEntry` DTO mezői.
- Produces: `LifeGoalSignalService.catalog(UUID userId)` — a régi paraméter nélküli `catalog()` MEGSZŰNIK (egyetlen hívója a controller).

- [ ] **Step 1: Írd meg a bukó ITet**

Create `backend/src/test/java/io/mrkuhne/mezo/feature/lifegoal/LifeGoalSignalsLivenessIT.java`. Nézd meg előbb a szomszéd `LifeGoalTodayApiIT.java`-t: MÁSOLD annak az osztály-annotációit, base-osztályát, MockMvc/`@WithMockUser` beállítását és a seed-helpereit (check-in / metrika-írás módja), és csak a teszt-testet írd újra az alábbi szándék szerint:

```java
    @Test
    void signals_shouldMarkASourceLiveWithItsDataDayCountAndFedPillarLabels_whenTheUserLoggedCheckIns() throws Exception {
        // Két zárt napra check-in → a CHECKIN_ENERGY jel él, 2/7 nap.
        seedCheckIn(LocalDate.now().minusDays(1), 6);
        seedCheckIn(LocalDate.now().minusDays(2), 7);
        // Aktív cél egy CHECKIN_ENERGY-re mutató pillérrel → az a pillér a jel chipjeként jelenik meg.
        UUID goalId = createActiveGoalWithPillar("Nyugalom", "Energia", metricSource("CHECKIN_ENERGY"));

        mockMvc.perform(get("/api/life-goals/signals"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.entries[?(@.id=='checkin_energy')].live").value(hasItem(true)))
            .andExpect(jsonPath("$.entries[?(@.id=='checkin_energy')].daysWithData").value(hasItem(2)))
            .andExpect(jsonPath("$.entries[?(@.id=='checkin_energy')].fedPillars[0]").value(hasItem("Energia")))
            // Amihez nincs adat, az alszik — és sosem hiányzik a listából (transzparencia-oldal).
            .andExpect(jsonPath("$.entries[?(@.id=='social_mentions')].live").value(hasItem(false)))
            .andExpect(jsonPath("$.entries[?(@.id=='social_mentions')].daysWithData").value(hasItem(0)))
            .andExpect(jsonPath("$.entries.length()").value(28));
    }
```

- [ ] **Step 2: Futtasd — bukjon**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mace-auto-approval-295081/backend && ./mvnw clean test -Dmezo.test.use-testcontainers=true -Dtest='LifeGoalSignalsLivenessIT'
```

Elvárt: FAIL — `live` és `daysWithData` `null` a válaszban.

- [ ] **Step 3: Implementáld a liveness-t**

`LifeGoalSignalService.java` — a `catalog()` helyett:

```java
    /** A liveness-ablak: a mai nappal együtt 7 nap (spec §.7 „volt-e adat az elmúlt 7 napban"). */
    private static final int LIVENESS_WINDOW_DAYS = 7;

    private final SignalCatalog catalog;
    private final LifeGoalMapper mapper;
    private final List<SignalSource> sources;
    private final LifeGoalRepository goalRepository;
    private final LifeGoalPillarRepository pillarRepository;

    /**
     * A jel-katalógus + forrásonkénti liveness (mezo-iizd.7): hány napon volt adat az elmúlt
     * 7-ben, és a hívó AKTÍV céljainak mely aktív pillérei táplálkoznak ebből a jelből. A
     * forrás-diszpécs ugyanaz a {@code supports()}-válogatás, amit a
     * {@code LifeGoalProgressService.windowFor} használ — kikapcsolt companion mellett a
     * {@code MetricSignalSource} bean nincs, és minden metrika-jel egyszerűen alszik.
     */
    @Transactional(readOnly = true)
    public SignalCatalogResponse catalog(UUID userId) {
        LocalDate today = LocalDate.now();
        LocalDate from = today.minusDays(LIVENESS_WINDOW_DAYS - 1L);
        Map<String, List<String>> fedPillars = fedPillarsBySignalId(userId);
        return SignalCatalogResponse.builder()
            .entries(catalog.entries().stream()
                .map(e -> toDto(e, dataDays(userId, e, from, today), fedPillars.getOrDefault(e.id(), List.of())))
                .toList())
            .build();
    }

    private int dataDays(UUID userId, io.mrkuhne.mezo.feature.lifegoal.catalog.SignalCatalogEntry e,
                         LocalDate from, LocalDate to) {
        return sources.stream().filter(s -> s.supports(e.source())).findFirst()
            .map(s -> s.window(userId, e.source(), from, to))
            .map(w -> (int) w.values().entrySet().stream()
                .filter(v -> v.getValue() != null && !v.getKey().isBefore(from) && !v.getKey().isAfter(to))
                .count())
            .orElse(0);
    }

    private Map<String, List<String>> fedPillarsBySignalId(UUID userId) {
        List<UUID> activeGoalIds = goalRepository.findByCreatedByAndDeletedFalseOrderByCreatedAtDesc(userId)
            .stream().filter(g -> "active".equals(g.getStatus())).map(LifeGoalEntity::getId).toList();
        if (activeGoalIds.isEmpty()) {
            return Map.of();
        }
        Map<String, List<String>> byId = new LinkedHashMap<>();
        for (LifeGoalPillarEntity p : pillarRepository.findByGoalIdInAndDeletedFalseOrderByPositionAsc(activeGoalIds)) {
            if (!Boolean.TRUE.equals(p.getActive())) {
                continue;
            }
            catalog.find(p.getSource()).ifPresent(entry ->
                byId.computeIfAbsent(entry.id(), k -> new ArrayList<>()).add(p.getLabel()));
        }
        return byId;
    }

    private SignalCatalogEntry toDto(io.mrkuhne.mezo.feature.lifegoal.catalog.SignalCatalogEntry e,
                                     int daysWithData, List<String> fedPillars) {
        return SignalCatalogEntry.builder()
            .id(e.id())
            .source(mapper.toSourceDto(e.source()))
            .label(e.label())
            .group(e.group())
            .kinds(e.kinds().stream().map(PillarKind::fromValue).toList())
            .unit(e.unit())
            .defaultSkillKey(e.defaultSkillKey())
            .live(daysWithData > 0)
            .daysWithData(daysWithData)
            .fedPillars(fedPillars)
            .build();
    }
```

Ellenőrizd az `LifeGoalPillarEntity` getter-neveit (`getActive()`, `getLabel()`, `getSource()`) a fájlban, mielőtt fordítasz — Lombok `@Data`/`@Getter` szerint igazodj.

`LifeGoalController.java:46`:

```java
    @Override public SignalCatalogResponse listLifeGoalSignals() { return signalService.catalog(currentUserId.get()); }
```

- [ ] **Step 4: Futtasd — passzoljon**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mace-auto-approval-295081/backend && ./mvnw clean test -Dmezo.test.use-testcontainers=true -Dtest='LifeGoalSignalsLivenessIT,LifeGoalApiIT,LifeGoalProposeIT'
```

Elvárt: PASS mindhárom (a `LifeGoalApiIT` már hívja a `/signals`-t).

- [ ] **Step 5: Commit**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mace-auto-approval-295081 && git add backend && git commit -m "feat(lifegoal): forrásonkénti liveness a jel-katalóguson (mezo-iizd.7)"
```

---

### Task 3: `LIFE_GOAL_PLAN` értesítés-fajta (backend + FE leképezés)

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/appnotification/domain/AppNotificationKind.java`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/feature/appnotification/AppNotificationKindTest.java`
- Modify: `frontend/src/data/types.ts:1663-1704`
- Modify: `frontend/src/data/notificationKindMeta.test.ts:13-19`

**Interfaces:**
- Produces: `AppNotificationKind.LIFE_GOAL_PLAN` (`key = "life_goal_plan"`, `familyKey = null`, `deeplink = "/me/goals"`). A Task 4 emitel rá, a konkrét deeplink `"/me/goals/" + goalId`.

- [ ] **Step 1: Bővítsd a backend teszt-pint**

`AppNotificationKindTest.java`-ban `hasSize(13)` → `hasSize(14)`, és a `WEEKLY_REVIEW_READY` sorok után:

```java
        // life_goal_plan (mezo-iizd.7): feed-only — a ha–akkor terv nem kap saját push-kategóriát
        // az első körben (spec D-3, a weekly_review_ready precedens).
        assertThat(AppNotificationKind.LIFE_GOAL_PLAN.key()).isEqualTo("life_goal_plan");
        assertThat(AppNotificationKind.LIFE_GOAL_PLAN.familyKey()).isNull();
        assertThat(AppNotificationKind.LIFE_GOAL_PLAN.deeplink()).isEqualTo("/me/goals");
```

- [ ] **Step 2: Futtasd — bukjon**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mace-auto-approval-295081/backend && ./mvnw clean test -Dmezo.test.use-testcontainers=true -Dtest='AppNotificationKindTest'
```

Elvárt: fordítási hiba (`LIFE_GOAL_PLAN` nem létezik).

- [ ] **Step 3: Add hozzá az enum-értéket**

`AppNotificationKind.java`, a `WEEKLY_REVIEW_READY` után (vessző → pontosvessző igazítás):

```java
    WEEKLY_REVIEW_READY("weekly_review_ready", null, "/me/week"),
    /** mezo-iizd.7: a ha–akkor terv megszólalása. familyKey null (feed-only, spec D-3) — a
     *  {@code /me/goals} bázis mellé az emitter a konkrét cél id-jét teszi. */
    LIFE_GOAL_PLAN("life_goal_plan", null, "/me/goals");
```

Az osztály-javadocban a „12 kinds" → „14 kinds" megfogalmazást is igazítsd (a szöveg jelenleg `weekly_review_ready added mezo-p2tr`-t említ; toldd meg: `life_goal_plan added mezo-iizd.7`).

- [ ] **Step 4: Futtasd — passzoljon**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mace-auto-approval-295081/backend && ./mvnw clean test -Dmezo.test.use-testcontainers=true -Dtest='AppNotificationKindTest'
```

Elvárt: PASS.

- [ ] **Step 5: Írd meg a bukó FE tesztet**

`frontend/src/data/notificationKindMeta.test.ts` — a `BACKEND_KINDS` tömb végére `'life_goal_plan',`, és a második `it(...)` után:

```ts
  it('az életcél-terv a cél clay ikonját viszi', () => {
    expect(APP_NOTIFICATION_KIND_META.life_goal_plan.clay).toBe('i-cel')
  })
```

- [ ] **Step 6: Futtasd — bukjon (mindkét mód)**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mace-auto-approval-295081/frontend && VITE_USE_MOCK=true pnpm test --run src/data/notificationKindMeta.test.ts
```

Elvárt: FAIL — típushiba / `undefined`.

- [ ] **Step 7: Bővítsd a FE leképezést**

`frontend/src/data/types.ts`:
- az `AppNotificationKindKey` unió végére: `| 'life_goal_plan'`
- az `APP_NOTIFICATION_KIND_META` literál végére: `life_goal_plan: { emoji: '🎯', tint: 'experiment', clay: 'i-cel' },`

- [ ] **Step 8: Futtasd mindkét módban — passzoljon**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mace-auto-approval-295081/frontend && VITE_USE_MOCK=true pnpm test --run src/data/notificationKindMeta.test.ts
```

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mace-auto-approval-295081/frontend && VITE_USE_MOCK=false pnpm test --run src/data/notificationKindMeta.test.ts
```

Elvárt: PASS mindkettőben.

- [ ] **Step 9: Commit**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mace-auto-approval-295081 && git add backend frontend/src/data && git commit -m "feat(lifegoal): LIFE_GOAL_PLAN értesítés-fajta feed-only (mezo-iizd.7)"
```

---

### Task 4: `LifeGoalTriggerRules` — a forrás→predikátum szabályok (tiszta unit)

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/lifegoal/service/LifeGoalTriggerRules.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/lifegoal/service/LifeGoalTriggerRulesTest.java` (create)

**Interfaces:**
- Produces:
  - `static Optional<PillarSourceJson> sourceFor(String triggerSource)` — a trigger-forrás metrika-jele; ismeretlen forrásra `Optional.empty()`.
  - `static boolean matches(String triggerSource, String condition, BigDecimal dayValue)` — igaz, ha a nap értéke kiváltja a tervet. `dayValue` `null` = nincs adat aznap.
  - `static final String SPORT_SESSION_LOGGED / CHECKIN_ENERGY_LTE / RITUAL_MISSED`.

- [ ] **Step 1: Írd meg a bukó unit tesztet**

Create `backend/src/test/java/io/mrkuhne/mezo/feature/lifegoal/service/LifeGoalTriggerRulesTest.java`:

```java
package io.mrkuhne.mezo.feature.lifegoal.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import org.junit.jupiter.api.Test;

class LifeGoalTriggerRulesTest {

    @Test
    void matches_shouldFireOnAnyLoggedSportLoad_andStaySilentWithoutOne() {
        assertThat(LifeGoalTriggerRules.matches("sport_session_logged", null, BigDecimal.valueOf(45))).isTrue();
        assertThat(LifeGoalTriggerRules.matches("sport_session_logged", null, BigDecimal.ZERO)).isFalse();
        assertThat(LifeGoalTriggerRules.matches("sport_session_logged", null, null)).isFalse();
    }

    @Test
    void matches_shouldReadTheConditionAsTheEnergyThreshold_andFallBackToFour() {
        assertThat(LifeGoalTriggerRules.matches("checkin_energy_lte", "6", BigDecimal.valueOf(6))).isTrue();
        assertThat(LifeGoalTriggerRules.matches("checkin_energy_lte", "6", BigDecimal.valueOf(7))).isFalse();
        // Nincs/értelmezhetetlen condition → 4-es alapküszöb, nem néma és nem mindig-tüzelő.
        assertThat(LifeGoalTriggerRules.matches("checkin_energy_lte", null, BigDecimal.valueOf(4))).isTrue();
        assertThat(LifeGoalTriggerRules.matches("checkin_energy_lte", "hat", BigDecimal.valueOf(5))).isFalse();
        // Nincs check-in aznap → nem tudjuk, hogy alacsony volt-e; nem tüzel.
        assertThat(LifeGoalTriggerRules.matches("checkin_energy_lte", "4", null)).isFalse();
    }

    @Test
    void matches_shouldTreatAMissingOrZeroRitualAsAMiss() {
        assertThat(LifeGoalTriggerRules.matches("ritual_missed", null, null)).isTrue();
        assertThat(LifeGoalTriggerRules.matches("ritual_missed", null, BigDecimal.ZERO)).isTrue();
        assertThat(LifeGoalTriggerRules.matches("ritual_missed", null, BigDecimal.ONE)).isFalse();
    }

    @Test
    void matches_shouldNeverFireForAnUnknownSource() {
        assertThat(LifeGoalTriggerRules.matches("made_up_signal", null, BigDecimal.TEN)).isFalse();
        assertThat(LifeGoalTriggerRules.matches(null, null, BigDecimal.TEN)).isFalse();
        assertThat(LifeGoalTriggerRules.sourceFor("made_up_signal")).isEmpty();
    }

    @Test
    void sourceFor_shouldMapEachKnownTriggerToItsMetricSignal() {
        assertThat(LifeGoalTriggerRules.sourceFor("sport_session_logged")).get()
            .extracting(s -> s.type() + ":" + s.key()).isEqualTo("metric:SPORT_LOAD_MIN");
        assertThat(LifeGoalTriggerRules.sourceFor("checkin_energy_lte")).get()
            .extracting(s -> s.type() + ":" + s.key()).isEqualTo("metric:CHECKIN_ENERGY");
        assertThat(LifeGoalTriggerRules.sourceFor("ritual_missed")).get()
            .extracting(s -> s.type() + ":" + s.key()).isEqualTo("metric:RITUAL_CLOSED");
    }
}
```

- [ ] **Step 2: Futtasd — bukjon**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mace-auto-approval-295081/backend && ./mvnw clean test -Dmezo.test.use-testcontainers=true -Dtest='LifeGoalTriggerRulesTest'
```

Elvárt: fordítási hiba (`LifeGoalTriggerRules` nem létezik).

- [ ] **Step 3: Implementáld**

Create `backend/src/main/java/io/mrkuhne/mezo/feature/lifegoal/service/LifeGoalTriggerRules.java`:

```java
package io.mrkuhne.mezo.feature.lifegoal.service;

import io.mrkuhne.mezo.feature.lifegoal.entity.PillarSourceJson;
import java.math.BigDecimal;
import java.util.Optional;

/**
 * A ha–akkor triggerek zárt szabálykészlete (mezo-iizd.7, spec §.7). A három forrás — pontosan
 * az, amit a {@code LifeGoalProposeLlmAdapter.TRIGGER_SOURCES} beenged — EGYETLEN alakra képződik
 * le: „egy metrika-jel adott napi értéke kielégít-e egy predikátumot". Ettől az azonnali
 * (esemény-listener) és a késleltetett (éjjeli job) ág UGYANAZT a döntést hozza, és a jel a
 * meglévő {@code SignalSource} diszpécseren jön — a lifegoal nem szerez új függőséget.
 *
 * <p>Tiszta, állapotmentes osztály: a {@code LifeGoalTriggerRulesTest} teljesen lefedi.
 */
public final class LifeGoalTriggerRules {

    public static final String SPORT_SESSION_LOGGED = "sport_session_logged";
    public static final String CHECKIN_ENERGY_LTE = "checkin_energy_lte";
    public static final String RITUAL_MISSED = "ritual_missed";

    /** A {@code checkin_energy_lte} küszöbe, ha a terv nem mond sajátot (1–10 skála alsó harmada). */
    static final int DEFAULT_ENERGY_THRESHOLD = 4;

    private LifeGoalTriggerRules() {}

    /** A trigger metrika-jele — ezt adjuk a SignalSource diszpécsernek. Ismeretlen forrás: üres. */
    public static Optional<PillarSourceJson> sourceFor(String triggerSource) {
        if (triggerSource == null) {
            return Optional.empty();
        }
        return switch (triggerSource) {
            case SPORT_SESSION_LOGGED -> Optional.of(metric("SPORT_LOAD_MIN"));
            case CHECKIN_ENERGY_LTE -> Optional.of(metric("CHECKIN_ENERGY"));
            case RITUAL_MISSED -> Optional.of(metric("RITUAL_CLOSED"));
            default -> Optional.empty();
        };
    }

    /**
     * Kiváltja-e a nap értéke a tervet? {@code dayValue == null} = aznap nincs adat.
     * A {@code ritual_missed} az EGYETLEN hiány-alapú szabály: ott a hiányzó nap maga a jel.
     */
    public static boolean matches(String triggerSource, String condition, BigDecimal dayValue) {
        if (triggerSource == null) {
            return false;
        }
        return switch (triggerSource) {
            case SPORT_SESSION_LOGGED -> dayValue != null && dayValue.signum() > 0;
            case CHECKIN_ENERGY_LTE ->
                dayValue != null && dayValue.compareTo(BigDecimal.valueOf(threshold(condition))) <= 0;
            case RITUAL_MISSED -> dayValue == null || dayValue.signum() == 0;
            default -> false;
        };
    }

    private static int threshold(String condition) {
        if (condition == null) {
            return DEFAULT_ENERGY_THRESHOLD;
        }
        try {
            return Integer.parseInt(condition.trim());
        } catch (NumberFormatException e) {
            // Az LLM szabad szöveget is adhat conditionnek; a nem-szám sosem lazíthat a küszöbön.
            return DEFAULT_ENERGY_THRESHOLD;
        }
    }

    private static PillarSourceJson metric(String key) {
        return new PillarSourceJson("metric", key, null, null, null, null);
    }
}
```

- [ ] **Step 4: Futtasd — passzoljon**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mace-auto-approval-295081/backend && ./mvnw clean test -Dmezo.test.use-testcontainers=true -Dtest='LifeGoalTriggerRulesTest'
```

Elvárt: PASS (5 teszt).

- [ ] **Step 5: Commit**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mace-auto-approval-295081 && git add backend && git commit -m "feat(lifegoal): ha–akkor trigger-szabályok (forrás → metrika-predikátum) (mezo-iizd.7)"
```

---

### Task 5: `LifeGoalTriggerService` — a kiértékelő + emitter

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/lifegoal/service/LifeGoalTriggerService.java`
- Test: a következő taskban (Task 6) IT-vel, itt csak fordítás — a szolgáltatás egyedül nem hívható semmiről.

**Interfaces:**
- Consumes: `LifeGoalTriggerRules` (Task 4), `AppNotificationKind.LIFE_GOAL_PLAN` (Task 3).
- Produces:
  - `void fireImmediate(UUID userId, String triggerSource, LocalDate day)` — a listener hívja; csak a `delayHours` nélküli/0 terveket nézi.
  - `void fireDelayed(UUID userId, LifeGoalEntity goal, LocalDate today)` — a job hívja célonként; a `delayHours > 0` terveket + MINDEN `ritual_missed` tervet a tegnapi napra nézi.

- [ ] **Step 1: Implementáld**

Create `backend/src/main/java/io/mrkuhne/mezo/feature/lifegoal/service/LifeGoalTriggerService.java`:

```java
package io.mrkuhne.mezo.feature.lifegoal.service;

import io.mrkuhne.mezo.feature.appnotification.domain.AppNotificationKind;
import io.mrkuhne.mezo.feature.appnotification.service.AppNotificationEmitter;
import io.mrkuhne.mezo.feature.lifegoal.engine.SignalSource;
import io.mrkuhne.mezo.feature.lifegoal.engine.SignalWindow;
import io.mrkuhne.mezo.feature.lifegoal.entity.IfThenPlanJson;
import io.mrkuhne.mezo.feature.lifegoal.entity.LifeGoalEntity;
import io.mrkuhne.mezo.feature.lifegoal.entity.PillarSourceJson;
import io.mrkuhne.mezo.feature.lifegoal.entity.PlanTriggerJson;
import io.mrkuhne.mezo.feature.lifegoal.repository.LifeGoalRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * A ha–akkor tervek kiértékelése és megszólalása (mezo-iizd.7, spec §.7 + D-3).
 *
 * <p>Két belépő, egy döntés: az AZONNALI ág ({@code delayHours} null vagy 0) az esemény
 * pillanatában fut a {@code LifeGoalTriggerListener}-ből, a KÉSLELTETETT ág ({@code delayHours > 0})
 * a {@code LifeGoalEvalJob} következő futásából a tegnapi napra — külön ütemező-mechanika nincs
 * (D-3). A {@code ritual_missed} MINDIG a késleltetett ágon fut, akármit mond a delay: nincs
 * „napzárás elmaradt" esemény, a hiányt csak a nap lezárása után lehet kimondani.
 *
 * <p>Egy terv naponta legfeljebb egyszer szólal meg, és csak az ELSŐ átmenetkor: ezt a
 * {@code dedupKey = <goalId>:<planIdx>:<day>} adja, amit az {@code AppNotificationService}
 * exists-check + unique index szinten kikényszerít — az újra-kiértékelés (kézi evaluate, második
 * job-futás) így néma marad. Csak {@code active} cél szólal meg: ugyanaz az „evaluable" definíció,
 * amit a {@code LifeGoalProgressService.evaluateDays} használ.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.LIFEGOAL_SWITCH, havingValue = "true")
public class LifeGoalTriggerService {

    private static final String STATUS_ACTIVE = "active";

    private final LifeGoalRepository goalRepository;
    private final List<SignalSource> sources;
    private final AppNotificationEmitter emitter;

    /** Az esemény-ág: minden aktív cél azonnali terve, ami erre a forrásra figyel. */
    @Transactional(readOnly = true)
    public void fireImmediate(UUID userId, String triggerSource, LocalDate day) {
        for (LifeGoalEntity goal : goalRepository.findByCreatedByAndDeletedFalseOrderByCreatedAtDesc(userId)) {
            if (!STATUS_ACTIVE.equals(goal.getStatus())) {
                continue;
            }
            evaluatePlans(userId, goal, day, triggerSource, false);
        }
    }

    /** A job-ág: a tegnapi napra a késleltetett tervek + minden {@code ritual_missed}. */
    @Transactional(readOnly = true)
    public void fireDelayed(UUID userId, LifeGoalEntity goal, LocalDate today) {
        if (!STATUS_ACTIVE.equals(goal.getStatus())) {
            return;
        }
        evaluatePlans(userId, goal, today.minusDays(1), null, true);
    }

    private void evaluatePlans(UUID userId, LifeGoalEntity goal, LocalDate day,
                               String onlySource, boolean delayedPass) {
        List<IfThenPlanJson> plans = goal.getIfThenPlans();
        if (plans == null) {
            return;
        }
        for (int i = 0; i < plans.size(); i++) {
            IfThenPlanJson plan = plans.get(i);
            PlanTriggerJson trigger = plan == null ? null : plan.trigger();
            if (trigger == null || trigger.source() == null) {
                continue; // kézi terv — nincs gépi jel, sosem szólal meg magától
            }
            if (!delayedPass && (onlySource == null || !onlySource.equals(trigger.source()))) {
                continue;
            }
            if (delayedPass != isDelayed(trigger)) {
                continue;
            }
            BigDecimal value = dayValue(userId, trigger.source(), day);
            if (!LifeGoalTriggerRules.matches(trigger.source(), trigger.condition(), value)) {
                continue;
            }
            emit(goal, plan, i, day);
        }
    }

    /** Késleltetett-e: a pozitív delayHours az, ÉS a hiány-alapú ritual_missed mindig az. */
    private boolean isDelayed(PlanTriggerJson trigger) {
        return LifeGoalTriggerRules.RITUAL_MISSED.equals(trigger.source())
            || (trigger.delayHours() != null && trigger.delayHours() > 0);
    }

    private BigDecimal dayValue(UUID userId, String triggerSource, LocalDate day) {
        PillarSourceJson source = LifeGoalTriggerRules.sourceFor(triggerSource).orElse(null);
        if (source == null) {
            return null;
        }
        SignalWindow window = sources.stream().filter(s -> s.supports(source)).findFirst()
            .map(s -> s.window(userId, source, day, day))
            .orElseGet(() -> SignalWindow.of(Map.of()));
        return window.values().get(day);
    }

    private void emit(LifeGoalEntity goal, IfThenPlanJson plan, int planIdx, LocalDate day) {
        emitter.emit(
            goal.getCreatedBy(),
            AppNotificationKind.LIFE_GOAL_PLAN,
            "Ha–akkor · " + goal.getTitle(),
            plan.akkor(),
            AppNotificationKind.LIFE_GOAL_PLAN.deeplink() + "/" + goal.getId(),
            goal.getId(),
            goal.getId() + ":" + planIdx + ":" + day);
    }
}
```

- [ ] **Step 2: Fordulj le**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mace-auto-approval-295081/backend && ./mvnw -q compile
```

Elvárt: BUILD SUCCESS. (Ha `LifeGoalEntity.getCreatedBy()`/`getTitle()` másképp hívódik, igazítsd a fájl szerint.)

- [ ] **Step 3: Commit**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mace-auto-approval-295081 && git add backend && git commit -m "feat(lifegoal): ha–akkor kiértékelő + LIFE_GOAL_PLAN emit (mezo-iizd.7)"
```

---

### Task 6: `SportSessionLoggedEvent` + listener + job-ág (IT-vel)

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/train/service/SportSessionLoggedEvent.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/service/SportService.java:57-79`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/lifegoal/service/LifeGoalTriggerListener.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/lifegoal/service/LifeGoalEvalJob.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/lifegoal/LifeGoalTriggerIT.java` (create)

**Interfaces:**
- Consumes: `LifeGoalTriggerService.fireImmediate/fireDelayed` (Task 5).
- Produces: `record SportSessionLoggedEvent(UUID userId, LocalDate date)` a `feature.train.service` csomagban — a lifegoal CSAK fogyasztja (ArchUnit-irány lifegoal → train).

- [ ] **Step 1: Írd meg a bukó ITet**

Create `backend/src/test/java/io/mrkuhne/mezo/feature/lifegoal/LifeGoalTriggerIT.java`. Az osztály-vázat (base-osztály, annotációk, seed-helperek) a `LifeGoalEvalJobIT.java`-ból MÁSOLD — az már tud aktív célt + pillért + felhasználót seedelni, és az `AppNotificationRepository`-t a `NotificationFeed*IT` mintája szerint injektáld. A tesztek:

```java
    @Test
    void job_shouldEmitADelayedPlanOnceForTheClosedDay_andStaySilentOnASecondRun() {
        UUID goalId = seedActiveGoalWithPlan(
            "Félmaraton", "ha edzés volt", "másnap 10 perc mobilizáció",
            "sport_session_logged", null, 4); // delayHours 4 → késleltetett ág
        seedSportSession(LocalDate.now().minusDays(1), 60);

        evalJob.runEval();
        evalJob.runEval();

        assertThat(notifications("life_goal_plan")).hasSize(1);
        assertThat(notifications("life_goal_plan").get(0).getDeeplink()).isEqualTo("/me/goals/" + goalId);
        assertThat(notifications("life_goal_plan").get(0).getDedupKey())
            .isEqualTo(goalId + ":0:" + LocalDate.now().minusDays(1));
    }

    @Test
    void job_shouldEmitTheRitualMissedPlan_whenYesterdayHasNoClosedRitual() {
        seedActiveGoalWithPlan("Fegyelem", "kimarad a napzárás", "másnap reggel 2 percben pótolom",
            "ritual_missed", null, 10);

        evalJob.runEval();

        assertThat(notifications("life_goal_plan")).hasSize(1);
    }

    @Test
    void job_shouldStaySilentForAParkedGoal() {
        UUID goalId = seedActiveGoalWithPlan("Félmaraton", "ha edzés volt", "nyújts",
            "sport_session_logged", null, 4);
        seedSportSession(LocalDate.now().minusDays(1), 60);
        parkGoal(goalId);

        evalJob.runEval();

        assertThat(notifications("life_goal_plan")).isEmpty();
    }

    @Test
    void immediate_shouldEmitOnTheEventDay_whenTheCheckInEnergyIsAtOrBelowTheThreshold() {
        UUID goalId = seedActiveGoalWithPlan("Nyugalom", "ha alacsony az energia",
            "sétálok egyet", "checkin_energy_lte", "5", 0); // delayHours 0 → azonnali ág

        // Nincs mock: a valódi CheckInService-en megyünk be, az publikálja a CheckInSavedEvent-et.
        checkInService.save(userId, checkInRequest(LocalDate.now(), 3));
        awaitNotification("life_goal_plan");

        assertThat(notifications("life_goal_plan")).hasSize(1);
        assertThat(notifications("life_goal_plan").get(0).getDedupKey())
            .isEqualTo(goalId + ":0:" + LocalDate.now());
    }

    @Test
    void immediate_shouldEmitOnASportSessionLog_throughTheTrainEvent() {
        seedActiveGoalWithPlan("Félmaraton", "ha lement a sport", "beírom a jegyzetet",
            "sport_session_logged", null, 0);

        sportService.logSportSession(userId, sportSessionRequest(LocalDate.now(), 45));
        awaitNotification("life_goal_plan");

        assertThat(notifications("life_goal_plan")).hasSize(1);
    }
```

A `@Async` listener miatt kell egy `awaitNotification(String kind)` helper — Awaitility-vel, ha a repo már használja (`grep -rn "awaitility" backend/pom.xml`), különben rövid poll-hurokkal:

```java
    private void awaitNotification(String kind) {
        for (int i = 0; i < 100 && notifications(kind).isEmpty(); i++) {
            try {
                Thread.sleep(50);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new IllegalStateException(e);
            }
        }
    }
```

- [ ] **Step 2: Futtasd — bukjon**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mace-auto-approval-295081/backend && ./mvnw clean test -Dmezo.test.use-testcontainers=true -Dtest='LifeGoalTriggerIT'
```

Elvárt: FAIL — nincs értesítés (a listener és a job-ág még nem létezik).

- [ ] **Step 3: Add hozzá a train eseményt**

Create `backend/src/main/java/io/mrkuhne/mezo/feature/train/service/SportSessionLoggedEvent.java`:

```java
package io.mrkuhne.mezo.feature.train.service;

import java.time.LocalDate;
import java.util.UUID;

/**
 * Published by {@link SportService#logSportSession} inside its {@code @Transactional} method, so an
 * {@code AFTER_COMMIT} listener sees it only once the session row is durable — the
 * {@code CheckInSavedEvent} precedent (mezo-iizd.7, spec D-4). Consumed by the life-goal
 * {@code LifeGoalTriggerListener}: a logged sport session is the {@code sport_session_logged}
 * ha–akkor trigger. The train feature knows nothing about life goals.
 */
public record SportSessionLoggedEvent(UUID userId, LocalDate date) {
}
```

`SportService.java` — vedd fel az `ApplicationEventPublisher eventPublisher` mezőt a `private final` blokkba (import: `org.springframework.context.ApplicationEventPublisher`), és a `logSportSession` `return base;` ELÉ:

```java
        // mezo-iizd.7 (spec D-4): a ha–akkor triggerek AFTER_COMMIT reagálnak; a listener @Async
        // és nyeli a saját hibáit, tehát ez a válasz sem lassulni, sem bukni nem tud tőle.
        eventPublisher.publishEvent(new SportSessionLoggedEvent(createdBy, s.getDate()));
```

- [ ] **Step 4: Add hozzá a listenert**

Create `backend/src/main/java/io/mrkuhne/mezo/feature/lifegoal/service/LifeGoalTriggerListener.java`:

```java
package io.mrkuhne.mezo.feature.lifegoal.service;

import io.mrkuhne.mezo.feature.biometrics.checkin.service.CheckInSavedEvent;
import io.mrkuhne.mezo.feature.train.service.SportSessionLoggedEvent;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Az azonnali ha–akkor triggerek belépője (mezo-iizd.7, a {@code FlagEvaluationListener} sablonja):
 * AFTER_COMMIT (csak megírt sorra reagálunk) és a kérés-szálon KÍVÜL ({@code @Async}), hogy egy
 * értesítés se lassíthassa vagy buktathassa a check-in / sport-session választ. A késleltetett
 * tervek nem itt, hanem a {@code LifeGoalEvalJob} következő futásában szólalnak meg (spec D-3).
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.LIFEGOAL_SWITCH, havingValue = "true")
public class LifeGoalTriggerListener {

    private final LifeGoalTriggerService triggerService;

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onCheckInSaved(CheckInSavedEvent event) {
        fire(event.userId(), LifeGoalTriggerRules.CHECKIN_ENERGY_LTE, event.date());
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onSportSessionLogged(SportSessionLoggedEvent event) {
        fire(event.userId(), LifeGoalTriggerRules.SPORT_SESSION_LOGGED, event.date());
    }

    private void fire(UUID userId, String triggerSource, LocalDate day) {
        try {
            triggerService.fireImmediate(userId, triggerSource, day);
        } catch (Exception e) {
            log.warn("Life-goal trigger evaluation after {} failed for user {}", triggerSource, userId, e);
        }
    }
}
```

- [ ] **Step 5: Kösd be a késleltetett ágat a MEGLÉVŐ jobba**

`LifeGoalEvalJob.java` — vedd fel a `private final LifeGoalTriggerService triggerService;` mezőt, és a belső `try` blokkban a `progressService.evaluateDays(...)` UTÁN:

```java
                        progressService.evaluateDays(user.getId(), goal);
                        // A késleltetett („másnap reggel") ha–akkor tervek + a hiány-alapú
                        // ritual_missed itt szólalnak meg, a tegnapi napra (spec D-3) — külön
                        // ütemező nincs. A cél-szintű catch ezt is izolálja.
                        triggerService.fireDelayed(user.getId(), goal, today);
                        goals++;
```

Az osztály-javadocot told meg egy mondattal: a job a pillér-napokon és az XP-n túl a késleltetett ha–akkor tervek emittálását is végzi (mezo-iizd.7).

- [ ] **Step 6: Futtasd — passzoljon**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mace-auto-approval-295081/backend && ./mvnw clean test -Dmezo.test.use-testcontainers=true -Dtest='LifeGoalTriggerIT,LifeGoalEvalJobIT,LifeGoalEvalJobSwitchOffIT,LifeGoalXpIT'
```

Elvárt: PASS mind.

- [ ] **Step 7: ArchUnit külön (a lifegoal → train irány új)**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mace-auto-approval-295081/backend && ./mvnw clean test -Dmezo.test.use-testcontainers=true -Dtest='*Arch*Test'
```

Elvárt: PASS. Ha a fagyasztott ciklus-szabály elbukik a `lifegoal → train` élre, NE lazíts a szabályon: nézd meg, hogy a train nem hivatkozik-e vissza a lifegoalra, és ha nem, a fagyasztott store frissítése a helyes lépés (a szabály `FreezingArchRule`; a store `backend/src/test/resources/archunit_store` alatt van).

- [ ] **Step 8: Commit**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mace-auto-approval-295081 && git add backend && git commit -m "feat(lifegoal): sport-session esemény + ha–akkor listener + job-ág (mezo-iizd.7)"
```

---

### Task 7: `JelekPage` + route + adatréteg (FE)

**Files:**
- Create: `frontend/src/features/me/pages/JelekPage.tsx`
- Create: `frontend/src/features/me/pages/JelekPage.test.tsx`
- Modify: `frontend/src/app/router.tsx` (a `me/goals/new` sor UTÁN, a `me/goals/:id` sor ELŐTT)
- Modify: `frontend/src/data/lifegoal/lifegoalMock.ts:125-152`
- Modify: `frontend/src/styles/prototype.css` (a `.lg-sumpil` blokk UTÁN)
- Modify: `frontend/src/test/msw/handlers.ts:1617` (a `/signals` handler már a `:id` ELŐTT van — csak a fixture bővül)

**Interfaces:**
- Consumes: `useSignalCatalog()` (`@/data/hooks`) — most már `id`/`live`/`daysWithData`/`fedPillars` mezőkkel jövő `SignalCatalogEntry[]`.
- Produces: `JelekPage` default export; `/me/goals/signals` route.

- [ ] **Step 1: Bővítsd a mockot liveness-szel**

`frontend/src/data/lifegoal/lifegoalMock.ts` — a `MOCK_SIGNAL_CATALOG` fölötti kommentet írd át (már NEM „minus the Java-only id"), tegyél `id: '<katalógus-id>'`-t minden sorra a `SignalCatalog.java` ENTRIES sorrendje és id-jei szerint (`sleep_duration`, `sleep_quality`, `bedtime_variability`, `protein`, `kcal`, `water`, `late_meal`, `meal_score`, `gym_volume`, `sport_load`, `acwr`, `hr_recovery`, `weight_goal`, `checkin_energy`, `checkin_mental`, `checkin_stress`, `habits_done`, `ritual_closed`, `daily_xp`, `activity_productivity`, `activity_learning`, `activity_financial`, `activity_connection`, `activity_cooking`, `social_mentions`, `ring_mozgas`, `ring_pihenes`, `ring_lelek`), majd a tömb definícióját csomagold be:

```ts
// A liveness a mock-oldalon fix: a prototípus (celok.html #page-jelek) él/alszik aránya, hogy a
// JelekPage mindkét szekciója (Él · Alszik) valódi tartalommal renderelődjön. Ami nincs a
// táblában, az alszik — a valódi backend a 7 napos ablakból számolja (LifeGoalSignalService).
const MOCK_LIVENESS: Record<string, { days: number; fedPillars?: string[] }> = {
  sleep_duration: { days: 7, fedPillars: ['Alvás ≥ 7 óra'] },
  protein: { days: 7, fedPillars: ['Fehérje'] },
  kcal: { days: 6 },
  gym_volume: { days: 5, fedPillars: ['Gym-volumen'] },
  sport_load: { days: 5 },
  weight_goal: { days: 6, fedPillars: ['Testkompozíció'] },
  checkin_energy: { days: 6, fedPillars: ['Energia'] },
  checkin_mental: { days: 4 },
  ritual_closed: { days: 4, fedPillars: ['Fegyelem'] },
  social_mentions: { days: 3, fedPillars: ['Társas élet'] },
}

function withLiveness(entries: Omit<SignalCatalogEntry, 'live' | 'daysWithData' | 'fedPillars'>[]): SignalCatalogEntry[] {
  return entries.map((e) => {
    const l = MOCK_LIVENESS[e.id] ?? { days: 0 }
    return { ...e, live: l.days > 0, daysWithData: l.days, fedPillars: l.fedPillars ?? [] }
  })
}

export const MOCK_SIGNAL_CATALOG: SignalCatalogEntry[] = withLiveness([
  // …a 28 sor, mindegyik `id`-vel, live/daysWithData/fedPillars NÉLKÜL…
])
```

- [ ] **Step 2: Írd meg a bukó oldal-tesztet**

Create `frontend/src/features/me/pages/JelekPage.test.tsx`. A render-helpert és a provider-wrappert a szomszéd `CelokPage.test.tsx`-ből MÁSOLD (ugyanaz a QueryClient + MemoryRouter + MSW felállás):

```tsx
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import JelekPage from './JelekPage'
// …a CelokPage.test.tsx renderWithProviders helpere…

describe('JelekPage', () => {
  it('a hero az élő források arányát mondja', async () => {
    renderWithProviders(<JelekPage />)
    expect(await screen.findByText('Jelek')).toBeInTheDocument()
    // 10 élő a 28-ból (MOCK_LIVENESS) — a hero számpárja.
    expect(await screen.findByLabelText('10 élő forrás a 28-ból')).toBeInTheDocument()
  })

  it('az élő forrást a napszámával és a tápált pillérek chipjeivel mutatja', async () => {
    renderWithProviders(<JelekPage />)
    const row = await screen.findByRole('listitem', { name: /Alváshossz/ })
    expect(row).toHaveTextContent('7 / 7 nap')
    expect(row).toHaveTextContent('Alvás ≥ 7 óra')
  })

  it('az alvó forrás az Alszik szekcióba kerül, nem tűnik el', async () => {
    renderWithProviders(<JelekPage />)
    const row = await screen.findByRole('listitem', { name: /Akut:krónikus terhelés/ })
    expect(row).toHaveTextContent('nincs adat 7 napja')
  })

  it('kimondja a záró elvet', async () => {
    renderWithProviders(<JelekPage />)
    expect(await screen.findByText(/Nincs külső forrás/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Futtasd mindkét módban — bukjon**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mace-auto-approval-295081/frontend && VITE_USE_MOCK=true pnpm test --run src/features/me/pages/JelekPage.test.tsx
```

Elvárt: FAIL — nincs `JelekPage` modul.

- [ ] **Step 4: Írd meg az oldalt**

Create `frontend/src/features/me/pages/JelekPage.tsx`. A `MozaikPage`/`PageHead`/`PageBody`/`EntranceGroup`/`GhostState`/`ScreenSkeleton`/`ClayIcon` importokat és a hiba-/üres-állapot idiómát a `CelokPage.tsx` FELSŐ feléből másold (ugyanaz a `tone="sage"`, ugyanaz az `isError && length === 0` szabály).

```tsx
// A prototípus celok.html #page-jelek (docs/design_2.0/prototypes/src/celok-body.html:480) a
// vizuális igazság: hero = „x / y forrás él", aztán Él és Alszik szekció, soronként clay ikon,
// „n / 7 nap · csoport" és a tápált pillérek chipjei. Semmi új naplózó — ez a transzparencia-oldal.
const GROUP_ICON: Record<string, ClayIconName> = {
  'Alvás': 'i-alvas', 'Fuel': 'i-fuel', 'Edzés': 'i-edzes', 'Elme': 'i-checkin',
  'Activity': 'i-mezo', 'Emberek': 'i-emberek', 'Életjel': 'i-eletjel',
}

export default function JelekPage() {
  const navigate = useNavigate()
  const { data: entries = [], isPending, isError, refetch } = useSignalCatalog()

  if (isPending) return <ScreenSkeleton />
  if (isError && entries.length === 0) {
    return (
      <MozaikPage tone="sage">
        <PageHead onBack={() => navigate('/me/goals')} label="‹ Célok" />
        <PageBody>
          <GhostState message="Nem sikerült betölteni a jeleket." ctaLabel="Újra" onCta={refetch} />
        </PageBody>
      </MozaikPage>
    )
  }

  const live = entries.filter((e) => e.live).sort((a, b) => b.daysWithData - a.daysWithData)
  const asleep = entries.filter((e) => !e.live)

  const row = (e: SignalCatalogEntry, i: number, off: boolean) => (
    <li key={e.id} className={`lg-sig rise${off ? ' off' : ''}`} style={{ '--d': `${60 + i * 20}ms` } as React.CSSProperties}
        aria-label={e.label}>
      <ClayIcon name={GROUP_ICON[e.group] ?? 'i-retegek'} size={24} />
      <div className="grow">
        <b>{e.label}</b>
        <small>{off ? 'nincs adat 7 napja' : `${e.daysWithData} / 7 nap`} · {e.group}</small>
        {e.fedPillars.length > 0 && (
          <div className="lg-sigchips">{e.fedPillars.map((p) => <span key={p}>{p}</span>)}</div>
        )}
      </div>
      <i className={off ? 'dead' : 'live'} aria-hidden="true" />
    </li>
  )

  return (
    <MozaikPage tone="sage">
      <PageHead onBack={() => navigate('/me/goals')} label="‹ Célok" />
      <PageBody principle="Nincs külső forrás — se naptár, se időjárás, se GitHub. Ami itt nincs, azt a rendszer nem tudja.">
        <EntranceGroup>
          <div className="lg-hero rise" style={{ '--d': '0ms', marginBottom: 12 } as React.CSSProperties}>
            <ClayIcon name="i-retegek" size={44} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 22, fontWeight: 700 }}>Jelek</div>
              <div style={{ fontSize: 26, fontWeight: 200 }} aria-label={`${live.length} élő forrás a ${entries.length}-ból`}>
                {live.length}<span style={{ fontSize: 15, color: 'var(--text-secondary)' }}> / {entries.length}</span>
              </div>
              <div className="mz-eyebrow">forrás él · volt adata az elmúlt 7 napban</div>
            </div>
          </div>
          <p className="lg-sighint rise" style={{ '--d': '40ms' } as React.CSSProperties}>
            Semmi újat nem kell naplóznod. Ezekből számolom a pilléreket — ami alszik, ott a pillér üres marad, nem nulla.
          </p>
          <div className="lg-sighead rise" style={{ '--d': '60ms' } as React.CSSProperties}>
            <span className="mz-eyebrow">Él</span><span className="cnt">{live.length} forrás</span>
          </div>
          <ul className="lg-siglist">{live.map((e, i) => row(e, i, false))}</ul>
          <div className="lg-sighead rise" style={{ '--d': '80ms' } as React.CSSProperties}>
            <span className="mz-eyebrow">Alszik</span><span className="cnt">{asleep.length} forrás</span>
          </div>
          <ul className="lg-siglist">{asleep.map((e, i) => row(e, i, true))}</ul>
        </EntranceGroup>
      </PageBody>
    </MozaikPage>
  )
}
```

Ellenőrizd a `PageBody principle` propot a `CelokPage.tsx`-ben (ott is így megy) és a `mz-eyebrow` osztályt — ha a `MozaikPage` API eltér, igazodj a `CelokPage`-hez, nem fordítva.

- [ ] **Step 5: Add hozzá a CSS-t**

`frontend/src/styles/prototype.css` — KÖZVETLENÜL a `.lg-sumpil b { … }` sor UTÁN (és a „Today · maradék sheet-nyelv" komment-blokk ELŐTT):

```css
/* Jelek-oldal (mezo-iizd.7, prototype celok.html #page-jelek): forrás-sorok él/alszik ponttal. */
.lg-siglist { list-style: none; margin: 0 0 10px; padding: 0; }
.lg-sig { display: flex; align-items: center; gap: 10px; padding: 9px 12px; margin-bottom: 7px; border-radius: 16px;
  background: #fff; border: 0.5px solid rgba(43,33,24,0.06); box-shadow: 0 10px 20px -14px rgba(43,33,24,0.28); }
.lg-sig.off { opacity: 0.55; }
.lg-sig .grow { flex: 1; min-width: 0; }
.lg-sig b { font-size: 12.5px; display: block; }
.lg-sig small { font-size: 10px; color: #6E6257; display: block; }
.lg-sig i.live { width: 8px; height: 8px; border-radius: 50%; flex: none; background: linear-gradient(135deg, #8FAF7E, #6E8B5E); }
.lg-sig i.dead { width: 8px; height: 8px; border-radius: 50%; flex: none; background: rgba(43,33,24,0.18); }
.lg-sigchips { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
.lg-sigchips span { font-size: 8.5px; font-weight: 700; color: #6E6257; background: rgba(43,33,24,0.06); border-radius: 6px; padding: 2px 6px; }
.lg-sighead { display: flex; align-items: baseline; gap: 8px; margin: 10px 2px 6px; }
.lg-sighead .cnt { margin-left: auto; font-size: 9.5px; color: #A2958A; }
.lg-sighint { font-size: 11px; color: #6E6257; margin: 0 2px 4px; }
```

- [ ] **Step 6: Regisztráld a route-ot**

`frontend/src/app/router.tsx` — a `me/goals/new` sor UTÁN, a `me/goals/:id` komment-blokk ELŐTT:

```tsx
      // Jelek · transzparencia-oldal (mezo-iizd.7) — újabb STATIKUS `me/goals/*` testvér, a
      // dinamikus `me/goals/:id` elé regisztrálva, ugyanazon precedens szerint.
      { path: 'me/goals/signals', element: <JelekPage /> },
```

Az importot a fájl tetején a szomszéd oldal-importok (lazy vagy sima — igazodj) MINTÁJA szerint vedd fel.

- [ ] **Step 7: Futtasd mindkét módban — passzoljon**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mace-auto-approval-295081/frontend && VITE_USE_MOCK=true pnpm test --run src/features/me/pages/JelekPage.test.tsx src/features/me/pages/CelPage.test.tsx src/features/me/pages/CelokPage.test.tsx
```

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mace-auto-approval-295081/frontend && VITE_USE_MOCK=false pnpm test --run src/features/me/pages/JelekPage.test.tsx src/features/me/pages/CelPage.test.tsx src/features/me/pages/CelokPage.test.tsx
```

Elvárt: PASS mindkettőben.

- [ ] **Step 8: Commit**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mace-auto-approval-295081 && git add frontend && git commit -m "feat(lifegoal): JelekPage a /me/goals/signals route-on (mezo-iizd.7)"
```

---

### Task 8: A hub „Jelek" sora + vizuális goldenek

**Files:**
- Modify: `frontend/src/features/me/pages/CelokPage.tsx` (a parkolt célok `map` UTÁN, az `EntranceGroup` záró tagje előtt)
- Modify: `frontend/src/features/me/pages/CelokPage.test.tsx`
- Modify: `frontend/tests/visual/visual.spec.ts:72` környéke

**Interfaces:**
- Consumes: `useSignalCatalog()` (Task 7 mezői), `/me/goals/signals` route (Task 7).

- [ ] **Step 1: Írd meg a bukó teszt-esetet**

`CelokPage.test.tsx` — új eset a meglévő `describe` blokkba:

```tsx
  it('a Jelek sor az élő/alvó forrásarányt mondja és a jel-oldalra visz', async () => {
    const user = userEvent.setup()
    renderWithProviders(<CelokPage />)
    const row = await screen.findByRole('button', { name: /Jelek/ })
    expect(row).toHaveTextContent('28 forrás · 10 él · 18 alszik')
    await user.click(row)
    expect(navigateSpy).toHaveBeenCalledWith('/me/goals/signals')
  })
```

A `navigateSpy` a fájlban már használt `useNavigate` mock-mintát kövesse (nézd meg a meglévő navigációs eseteket ugyanabban a fájlban, és AZT használd — ne vezess be újat).

- [ ] **Step 2: Futtasd — bukjon**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mace-auto-approval-295081/frontend && VITE_USE_MOCK=true pnpm test --run src/features/me/pages/CelokPage.test.tsx
```

Elvárt: FAIL — nincs „Jelek" gomb.

- [ ] **Step 3: Add hozzá a sort**

`CelokPage.tsx` — a `useSignalCatalog` hookot vedd fel a meglévő hook-hívások mellé:

```tsx
  const { data: signals = [] } = useSignalCatalog()
  const liveSignals = signals.filter((s) => s.live).length
```

és a parkolt célok `map` UTÁN, még az `EntranceGroup`-on belül:

```tsx
          {/* Jelek (mezo-iizd.7, prototípus celok.html:106): a hub alján egy sor nyitja a
              transzparencia-oldalt. A parkrow-nyelvet viszi, de teljes egészében gomb. */}
          <button type="button" className="lg-parkrow lg-parkrow-nav rise"
            style={{ '--d': `${300 + parked.length * 40}ms`, marginTop: 10 } as React.CSSProperties}
            onClick={() => navigate('/me/goals/signals')} aria-label="Jelek · mit figyel a rendszer">
            <ClayIcon name="i-retegek" size={22} />
            <div style={{ flex: 1 }}>
              <div className="nm" style={{ color: 'var(--text-primary)' }}>Jelek · mit figyel a rendszer</div>
              <div className="sb">{signals.length} forrás · {liveSignals} él · {signals.length - liveSignals} alszik</div>
            </div>
            <span style={{ marginLeft: 'auto', color: 'var(--text-secondary)', fontSize: 12 }}>›</span>
          </button>
```

- [ ] **Step 4: Futtasd mindkét módban — passzoljon**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mace-auto-approval-295081/frontend && VITE_USE_MOCK=true pnpm test --run src/features/me/pages/CelokPage.test.tsx
```

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mace-auto-approval-295081/frontend && VITE_USE_MOCK=false pnpm test --run src/features/me/pages/CelokPage.test.tsx
```

Elvárt: PASS mindkettőben.

- [ ] **Step 5: Vedd fel a vizuális route-ot**

`frontend/tests/visual/visual.spec.ts` — a `['me-cel-reszlet', '/me/goals/lg-kockahas'],` sor UTÁN:

```ts
  // mezo-iizd.7: a Jelek transzparencia-oldal saját felület, saját anatómiával (Él/Alszik szekciók).
  ['me-cel-jelek', '/me/goals/signals'],
```

- [ ] **Step 6: Frissítsd a goldeneket (Darwin, csak az érintetteket)**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mace-auto-approval-295081/frontend && pnpm test:visual:update
```

Ezután KIZÁRÓLAG az érintett fájlokat add-old — a `me-cel` (a Jelek sortól változik) és az új `me-cel-jelek` darwin-képeket; minden más a futás driftje:

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mace-auto-approval-295081 && git status --short frontend/tests/visual/visual.spec.ts-snapshots
```

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mace-auto-approval-295081 && git add frontend/tests/visual/visual.spec.ts-snapshots/me-cel-light-darwin.png frontend/tests/visual/visual.spec.ts-snapshots/me-cel-dark-darwin.png frontend/tests/visual/visual.spec.ts-snapshots/me-cel-jelek-light-darwin.png frontend/tests/visual/visual.spec.ts-snapshots/me-cel-jelek-dark-darwin.png && git checkout -- frontend/tests/visual/visual.spec.ts-snapshots
```

- [ ] **Step 7: Commit + linux goldenek a boton**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mace-auto-approval-295081 && git add frontend && git commit -m "feat(lifegoal): Jelek sor a Célok hubon + vizuális goldenek (mezo-iizd.7)" && git push -u origin feat/lifegoal-triggers
```

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mace-auto-approval-295081 && gh workflow run update-visual-baselines.yml -r feat/lifegoal-triggers
```

A bot-commit NEM triggerel CI-t: miután beérkezett, `git pull`, majd egy üres commit indítja a futást:

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mace-auto-approval-295081 && git pull && git commit --allow-empty -m "chore(ci): CI újraindítás a linux goldenek után (mezo-iizd.7)" && git push
```

---

### Task 9: Dokumentáció + codemap + teljes helyi kapuk

**Files:**
- Modify: `docs/features/lifegoal.md` (§3 Adatfolyam, §5 Job, §9 Kapcsolók/konfiguráció, §10 Csapdák — a meglévő §-számozáshoz igazodj, ne írd újra a .6 utáni állapotot)
- Modify: `backend/src/main/resources/application.yml` (a `mezo.lifegoal` blokk kommentje)
- Regenerated: `docs/CODEMAP.md`

- [ ] **Step 1: Írd meg a doksit**

`docs/features/lifegoal.md` — told tovább a meglévő szekciókat (ne szervezd át):
- **Adatfolyam:** a ha–akkor tervek két útja — azonnali (`LifeGoalTriggerListener`, `CheckInSavedEvent` + `SportSessionLoggedEvent`, AFTER_COMMIT + `@Async`) és késleltetett (`LifeGoalEvalJob` → `LifeGoalTriggerService.fireDelayed`, a tegnapi napra). A `ritual_missed` MINDIG a késleltetett ágon fut (nincs „elmaradt" esemény).
- A három trigger-forrás → metrika-predikátum táblázata (`LifeGoalTriggerRules`), a `checkin_energy_lte` alapküszöbe 4, a `condition` szabad szövege 4-re esik vissza.
- **Értesítés:** `LIFE_GOAL_PLAN`, feed-only (`familyKey = null`, `WEEKLY_REVIEW_READY` precedens), deeplink `/me/goals/{id}`, `dedupKey = <goalId>:<planIdx>:<day>` — ez adja az „egy terv naponta egyszer, csak első átmenetkor" garanciát; az újra-kiértékelés néma.
- **`/signals` liveness:** forrásonként `daysWithData` a 7 napos ablakból, `live = daysWithData > 0`, `fedPillars` = a hívó AKTÍV céljainak aktív pillér-címkéi. Kikapcsolt companion mellett minden metrika-jel alszik (nincs `MetricSignalSource` bean) — ez szándék, nem hiba.
- **FE:** `JelekPage` a `/me/goals/signals` statikus route-on (a `:id` ELŐTT), a hub Jelek-sora; a prototípus `celok.html #page-jelek`.
- **Csapdák:** a `dedupKey` a NAPRA szól, tehát egy nap egy terv egyszer szólal meg akkor is, ha a jel többször teljesül; a `LIFE_GOAL_PLAN` push-kategóriát NEM kapott (első kör, D-3).

`application.yml` — a `mezo.lifegoal` blokk `eval-cron` kommentjéhez told hozzá: a job a késleltetett ha–akkor tervek (és a `ritual_missed`) emittálását is végzi (mezo-iizd.7).

- [ ] **Step 2: Regeneráld a codemapet és lintelj**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mace-auto-approval-295081 && node scripts/gen-codemap.mjs && node scripts/lint-docs.mjs --errors-only
```

Elvárt: a lint 0 errort ad (a 13–17 stale doc figyelmeztetés előzetes, nem error). Ha a `--check` mód elbukik később, a regenerálás + amend a helyes lépés.

- [ ] **Step 3: Teljes helyi FE kapu (mindkét mód + build)**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mace-auto-approval-295081/frontend && VITE_USE_MOCK=true pnpm test --run
```

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mace-auto-approval-295081/frontend && VITE_USE_MOCK=false pnpm test --run
```

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mace-auto-approval-295081/frontend && pnpm build
```

Elvárt: mind PASS.

- [ ] **Step 4: Fókuszált backend kapu**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mace-auto-approval-295081/backend && ./mvnw clean test -Dmezo.test.use-testcontainers=true -Dtest='LifeGoal*,AppNotification*,*Arch*Test'
```

Elvárt: PASS. (A TELJES suite a CI dolga — a self-PR az autoritatív kapu.)

- [ ] **Step 5: Commit + push + self-PR**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mace-auto-approval-295081 && git add -A && git commit -m "docs(lifegoal): ha–akkor triggerek, LIFE_GOAL_PLAN és Jelek a feature-doksiban (mezo-iizd.7)" && git push
```

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mace-auto-approval-295081 && gh pr create --base main --head feat/lifegoal-triggers --title "feat(lifegoal): ha–akkor triggerek + LIFE_GOAL_PLAN + Jelek (mezo-iizd.7)" --body "$(cat <<'BODY'
bd: mezo-iizd.7 — a lifegoal 2. szelet záró darabja (spec 2026-09-03-lifegoal-slice2-motor-design.md §0/.7 + D-3/D-4).

- Ha–akkor triggerek: `LifeGoalTriggerRules` (3 forrás → metrika-predikátum) + `LifeGoalTriggerService`; azonnali ág a `LifeGoalTriggerListener`-ből (`CheckInSavedEvent` + az ÚJ `SportSessionLoggedEvent`), késleltetett ág a meglévő `LifeGoalEvalJob`-ból.
- `AppNotificationKind.LIFE_GOAL_PLAN` feed-only (`familyKey = null`), deeplink `/me/goals/{id}`, `dedupKey = <goalId>:<planIdx>:<day>`.
- `GET /api/life-goals/signals` liveness: `id` · `live` · `daysWithData` · `fedPillars`.
- FE: `JelekPage` a `/me/goals/signals` statikus route-on + a Célok hub „Jelek" sora.

A PR célja a CI teljes suite kapuja (self-PR, egy fejlesztő).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
BODY
)"
```

---

## Zárás (a .6 protokollja)

1. `gh pr checks --watch` → CI ZÖLD (a teljes backend IT suite + FE mindkét mód + lint + contract-drift).
2. `git fetch origin` → `git checkout --detach origin/main` → `git merge --no-ff feat/lifegoal-triggers` → `node scripts/gen-codemap.mjs --check` (ha stale: regen + `git commit --amend`) → `git push origin HEAD:main`.
3. Ág törlése (lokál + origin), `bd close mezo-iizd.7`.
4. `git pull --rebase && bd dolt push && git push`; `git status` = up to date.

**Ami NEM ebbe a szeletbe való** (a .8 follow-up bucket): a `partial` non-award teszt-lyuk, a `LIFE_GOAL_PLAN` push-kategória, és a `/signals` 28 forrás-lekérdezésének batch-elése, ha valaha mérhetően lassú lesz.

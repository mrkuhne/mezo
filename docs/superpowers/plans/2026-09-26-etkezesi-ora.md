# Étkezési óra (the meal clock) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Fuel Mai window strip with an always-on "talking clock": a pre-log recommended window with its reasons, and a post-log hit with a "what to expect" forecast. The window comes from one source, shared by the clock and the backend timing score.

**Architecture:**
- The FE planner (`placeWindows` / `compileTemplate`) now records *why* each window was placed. A new pure module widens every placed time into a `from–to` range with reason codes, and these travel on `FuelSlot` → tile VM → card.
- When a meal is logged into a block, the FE sends that range. The backend stores it on `meal` (`window_from` / `window_to`) and scores timing against it, falling back to the static config.
- `MealTimingDetail.windowSource` tells the FE which one it got.
- A second pure module derives the "Mire számíts" rows from the owner-locked `glycemicBand` level + timing + the day. The card and a new glass box render it all.

**Tech Stack:**
- Frontend: React 19 + TypeScript + Vitest (`frontend/`).
- Backend: Spring Boot 4 / Java 25 + Liquibase + JUnit/AssertJ (`backend/`).
- Contract: OpenAPI fragments in `api/feature/meal/meal.yml`, merged to `api/openapi.yml`.

**Spec:** `docs/superpowers/specs/2026-09-26-etkezesi-ora-design.md` · **Prototype:** `docs/design_2.0/prototypes/fuel-ora-ablak.html` · **bd:** `mezo-6g52f` · **Branch:** `feat/etkezesi-ora`

## Global Constraints

- **Never show a blood-sugar number.** Band only (`Alacsony` / `Közepes` / `Magas`). The UI word is "vércukor-válasz", never "glikémiás index" (owner-locked, `glycemicBand.ts:14-22`).
- **Do not edit `glycemicBand.ts` texts or thresholds.** New logic only *consumes* its `level`.
- **No red and no score for timing.** Inside the window the accent is the block colour. Outside it is always `var(--amber)`, whatever the distance.
- **Copy is hedged:** use *segít / általában / nagyjából*, never *kell / különben*. All UI copy is Hungarian.
- **Icons:** Titanium sprite via `ContentIcon` (`t-clock`, `t-dumbbell`, `t-moon`, `t-sun`, `t-protein`, `t-bolt`, `t-heart`, `t-plate`, `i-idozito`, `i-kristaly`). No emoji, no new sprite.
- **No glass inside glass.** The clock button is a flat secondary fill (`rgba(245,239,230,.05)` + hairline).
- **Motion:**
  - Every animation lives under `@media (prefers-reduced-motion: no-preference)`.
  - The reduced branch shows the final state.
  - Score shake: every 6 s, ±5° wobble with scale ≤1.06, over the last 16% of the cycle, staggered by `--i × 0.8s`.
- **Window widths** (minutes before / after the placed time):

  | Rule | Before / after |
  |---|---|
  | breakfast | 40 / 80 |
  | main | 45 / 45 |
  | snack | 30 / 30 |
  | pre-training-main | 30 / 30 |
  | pre-training-snack | 30 / 15 |
  | post-training | 30 / 60 |
  | template meal | 45 / 45 |
  | template snack | 30 / 30 |

  Minimum width is 30. Overlapping neighbours split at the midpoint of their placed times. `before-bed` is added when `to ≥ bedMin − 150`.
- **Hit:** inside counts as `in`. Up to 45 min outside is `near`, beyond that `far`. The wording is `+25 p később` / `−40 p korábban` / `+1 ó 45 p később`.
- **Frontend gates:** run in both modes with explicit env. `VITE_USE_MOCK` unset means mock.
- **`pnpm test` file filters don't scope.** It always runs the full suite with `CI=true`.
- **Backend:** focused ITs + ArchUnit. Nutrition must not import train or meal. Regenerate `docs/CODEMAP.md` in the same change.
- **Commits:** conventional subject carrying `(mezo-6g52f)`, ending with the `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` line.

---

## File Structure

**Backend**
- `api/feature/meal/meal.yml`:
  - add `MealWindow`, `MealRequest.window`, `MealTimingDetail.windowSource`;
  - then regenerate `api/openapi.yml` (`cd api/generate && npm run generate:api`).
- `backend/src/main/resources/db/changelog/1.1.0/script/202609261200_mezo-6g52f_meal_window.sql` (new) and its changeSet in `1.1.0_master.yml`.
- `backend/.../feature/meal/entity/MealEntity.java`: `windowFrom`, `windowTo` (`LocalTime`).
- `backend/.../feature/meal/service/MealService.java`:
  - `applyHeader` persists the window;
  - `applyScore` passes it on.
- `backend/.../feature/nutrition/service/MealWindow.java` (new record).
- `backend/.../feature/nutrition/service/MealScoringService.java`: 7-arg `scoreMeal`, and `timingSub` / `contextDim` use the stored window.
- `backend/.../feature/nutrition/entity/MealBreakdownJson.java`: `TimingDetail.windowSource`.
- `backend/.../feature/nutrition/mapper/BreakdownDtoMapper.java`: map `windowSource`.
- Tests: `MealScoringServiceTest.java`, `MealApiIT.java`.

**Frontend**
- `frontend/src/data/types.ts`:
  - `WindowReason`;
  - `FuelSlot.windowFrom/windowTo/windowReasons/budgetKcal`;
  - `MealInput.window`;
  - `MealTiming.windowSource`.
- `frontend/src/data/fuel/fuelConfig.ts`: `WINDOW_OFFSETS`, `WINDOW_MIN_WIDTH_MIN`, `BEFORE_BED_MIN`, `HIT_NEAR_MIN`.
- `frontend/src/features/fuel/logic/mealWindow.ts` (new): `widenWindows`, `hitOf`, `durHu`, `windowReasonCopy`, `hunArticle`.
- `frontend/src/features/fuel/logic/mealForecast.ts` (new): `mealForecast`.
- `frontend/src/features/fuel/logic/buildDayPlan.ts`:
  - `PlannedWindow.rule`;
  - `placeWindows` records rules;
  - `buildDayPlan` widens and stamps slots.
- `frontend/src/features/fuel/logic/compileTemplate.ts`: rule from the anchor.
- `frontend/src/features/fuel/logic/fuelSwimlane.ts`: tile VM window fields.
- `frontend/src/features/fuel/logic/keretHero.ts`: `DoneMealRow.timing`.
- `frontend/src/data/fuel/mealApi.ts`: `toRequest` sends `window`, and `windowSource` is mapped.
- `frontend/src/features/fuel/components/MealComposer.tsx` + `pages/FuelLogNewPage.tsx`: thread the `window` prop.
- `frontend/src/features/fuel/components/MealClock.tsx` (new): card button with the 12 h ring.
- `frontend/src/features/fuel/components/MealClockBox.tsx` (new): the glass box with the 24 h dial and sections.
- `frontend/src/features/fuel/components/FuelMealBlocks.tsx`: integrate, kcal ring semantics, unboxed score, band word on the glycemic chip.
- `frontend/src/features/fuel/pages/FuelMaiPage.tsx`: pass `day` context.
- `frontend/src/styles/prototype.css`:
  - delete `.fmx-window*`, `.fmx-timebox*` and `.fmx-clock`;
  - add `.fmx-mclock*`, `.fmx-mclockbox*` and the `.fmx-score` / `.fmx-budget-ring` / `.fmx-glu-chip` changes.
- Tests:
  - `logic/mealWindow.test.ts`, `logic/mealForecast.test.ts` (new);
  - `logic/buildDayPlan.test.ts`, `components/FuelMealBlocks.test.tsx`, `components/MealClockBox.test.tsx` (new);
  - `data/fuel/mealApi.test.ts`.

**Docs:** `docs/features/fuel.md`, `docs/design_2.0/2026-09-23-uveg-style-bible.md` (appendix), `docs/CODEMAP.md`.

---

### Task 1: Backend — store the planned window on the meal

**Files:**
- Modify: `api/feature/meal/meal.yml` (schemas `MealRequest` ~:396, `MealTimingDetail` ~:280, add `MealWindow`)
- Regenerate: `api/openapi.yml`, `frontend/src/data/_client/api.gen.ts`
- Create: `backend/src/main/resources/db/changelog/1.1.0/script/202609261200_mezo-6g52f_meal_window.sql`
- Modify: `backend/src/main/resources/db/changelog/1.1.0/1.1.0_master.yml` (append changeSet)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/meal/entity/MealEntity.java` (after `slot`, ~:70)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/meal/service/MealService.java` (`applyHeader` ~:203)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/meal/MealApiIT.java`

**Interfaces:**
- Produces:
  - wire `MealRequest.window?: { from: "HH:mm", to: "HH:mm" } | null`;
  - generated DTO `io.mrkuhne.mezo.api.dto.MealWindow` (`getFrom()`, `getTo()`: `String`);
  - entity `MealEntity#getWindowFrom()` / `getWindowTo()`: `LocalTime` (nullable).
  - Update semantics: a request with `window == null` on **update** keeps the stored window, and on **create** stores none.

- [ ] **Step 1: Extend the contract**

In `api/feature/meal/meal.yml`, add under `MealRequest.properties` (after `loggedAt`):

```yaml
        window:
          nullable: true
          description: >-
            A tervező ajánlott ablaka, amibe az étkezést logolták (mezo-6g52f). Megadva ehhez mér a
            timing-pontszám; hiányzik → a statikus slot-ablak config. Frissítéskor a null NEM törli
            a tárolt ablakot.
          allOf: [ { $ref: '#/components/schemas/MealWindow' } ]
```

Add a new schema next to `MealTimingDetail`:

```yaml
    MealWindow:
      type: object
      required: [from, to]
      properties:
        from: { type: string, pattern: '^([01][0-9]|2[0-3]):[0-5][0-9]$', description: 'Helyi idő "HH:mm"' }
        to: { type: string, pattern: '^([01][0-9]|2[0-3]):[0-5][0-9]$', description: 'Helyi idő "HH:mm"' }
```

Add to `MealTimingDetail.properties`:

```yaml
        windowSource:
          type: string
          nullable: true
          enum: [plan, config]
          description: 'plan = az étkezéssel tárolt tervező-ablak (mezo-6g52f); config = a statikus slot-ablak; null = régi envelope'
```

Change the `MealTimingDetail.description` sentence "UGYANABBÓL a szerver-oldali slot-ablak configból származik" to "UGYANABBÓL az ablakból származik (tárolt tervező-ablak, ha van, különben a slot-ablak config), ami a timing-részpontszámot adta".

- [ ] **Step 2: Regenerate the merged spec and the FE client**

```bash
cd api/generate && npm run generate:api && cd ../../frontend && pnpm generate:api
```

Expected: `git diff --stat` shows `api/openapi.yml` and `frontend/src/data/_client/api.gen.ts` changed, with `MealWindow` present in both.

- [ ] **Step 3: Write the failing IT**

Append to `MealApiIT.java`. `LOGGED_AT` is 13:20 local (UTC offset). Add `import io.mrkuhne.mezo.api.dto.MealWindow;` and `MealTimingDetail` if not already imported.

```java
    @Test
    void testCreate_shouldStoreThePlannedWindowAndScoreTimingAgainstIt_whenWindowSent() {
        HttpHeaders auth = ownerAuthHeaders();
        UUID food = createFood(auth, "Zabpehely", "370", "13", "59", "7");
        MealRequest req = mealReq(pantryItem(food, "100"));   // breakfast @ 13:20 local
        MealWindow w = new MealWindow();
        w.setFrom("12:30");
        w.setTo("14:00");
        req.setWindow(w);

        MealResponse res = postForBody("/api/meal", req, auth, HttpStatus.CREATED, MealResponse.class);

        MealTimingDetail timing = res.getScore().getBreakdown().getDimensions().stream()
            .filter(d -> "context".equals(d.getId())).findFirst().orElseThrow().getTiming();
        assertThat(timing.getWindowFrom()).isEqualTo("12:30");
        assertThat(timing.getWindowTo()).isEqualTo("14:00");
        assertThat(timing.getWindowSource()).isEqualTo(MealTimingDetail.WindowSourceEnum.PLAN);
    }

    @Test
    void testCreate_shouldFallBackToConfigWindow_whenNoWindowSent() {
        HttpHeaders auth = ownerAuthHeaders();
        UUID food = createFood(auth, "Zabpehely", "370", "13", "59", "7");

        MealResponse res = postForBody("/api/meal", mealReq(pantryItem(food, "100")), auth,
            HttpStatus.CREATED, MealResponse.class);

        MealTimingDetail timing = res.getScore().getBreakdown().getDimensions().stream()
            .filter(d -> "context".equals(d.getId())).findFirst().orElseThrow().getTiming();
        assertThat(timing.getWindowFrom()).isEqualTo("05:00");
        assertThat(timing.getWindowSource()).isEqualTo(MealTimingDetail.WindowSourceEnum.CONFIG);
    }

    @Test
    void testUpdate_shouldKeepTheStoredWindow_whenUpdateOmitsIt() {
        HttpHeaders auth = ownerAuthHeaders();
        UUID food = createFood(auth, "Zabpehely", "370", "13", "59", "7");
        MealRequest req = mealReq(pantryItem(food, "100"));
        MealWindow w = new MealWindow();
        w.setFrom("12:30");
        w.setTo("14:00");
        req.setWindow(w);
        MealResponse created = postForBody("/api/meal", req, auth, HttpStatus.CREATED, MealResponse.class);

        MealRequest upd = mealReq(pantryItem(food, "120"));   // window omitted
        MealResponse updated = putForBody("/api/meal/" + created.getId(), upd, auth, HttpStatus.OK,
            MealResponse.class);

        MealTimingDetail timing = updated.getScore().getBreakdown().getDimensions().stream()
            .filter(d -> "context".equals(d.getId())).findFirst().orElseThrow().getTiming();
        assertThat(timing.getWindowFrom()).isEqualTo("12:30");
        assertThat(timing.getWindowSource()).isEqualTo(MealTimingDetail.WindowSourceEnum.PLAN);
    }
```

If `ApiIntegrationTest` has no `putForBody`, check its helpers (`grep -n "protected .* put" backend/src/test/java/io/mrkuhne/mezo/support/*.java`). Use the existing PUT helper name. The PUT endpoint returns the `MealResponse` body: check `MealController#update`. If it returns 204, re-read the meal with `GET /api/fuel/day/2026-06-24` and take the meal from `getMeals()`.

- [ ] **Step 4: Run it, expect a failure**

```bash
cd backend && ./mvnw -q test -Dtest=MealApiIT -Dsurefire.failIfNoSpecifiedTests=false
```

Expected: compile error (`getWindowSource` / `setWindow` exist, but the backend never fills them) or assertion failures.

- [ ] **Step 5: Migration**

Create `backend/src/main/resources/db/changelog/1.1.0/script/202609261200_mezo-6g52f_meal_window.sql`:

```sql
-- mezo-6g52f: a tervező ajánlott ablaka, amibe az étkezést logolták. NULL = régi sor vagy ablak
-- nélküli logolás; a pontozó ilyenkor a statikus slot-ablak configra esik vissza.
alter table meal add column window_from time;
alter table meal add column window_to time;
alter table meal add constraint ck_meal_window_pair
    check ((window_from is null) = (window_to is null));
```

Append to `1.1.0_master.yml`:

```yaml
  - changeSet:
      id: "1.1.0:202609261200_mezo-6g52f_meal_window"
      author: daniel.kuhne
      changes:
        - sqlFile:
            relativeToChangelogFile: true
            path: script/202609261200_mezo-6g52f_meal_window.sql
```

- [ ] **Step 6: Entity + write path**

In `MealEntity.java`, after the `slot` field:

```java
    /** A tervező ajánlott ablaka (mezo-6g52f) — mindkettő null vagy mindkettő kitöltött (DB CHECK). */
    @Column(name = "window_from")
    private LocalTime windowFrom;

    @Column(name = "window_to")
    private LocalTime windowTo;
```

Add `import java.time.LocalTime;` (Lombok `@Getter @Setter` is already on the class; confirm with `sed -n 40,50p`).

In `MealService.applyHeader`, after `meal.setTitle(req.getTitle());`:

```java
        // mezo-6g52f: a tervező-ablak csak akkor íródik, ha a kérés hozza — frissítéskor a hiánya
        // megtartja a tárolt ablakot (a szerkesztő nem ismeri az eredeti ablakot).
        if (req.getWindow() != null) {
            meal.setWindowFrom(LocalTime.parse(req.getWindow().getFrom()));
            meal.setWindowTo(LocalTime.parse(req.getWindow().getTo()));
        }
```

The score path is Task 2. The IT stays red on `windowSource` until then, which is expected.

- [ ] **Step 7: Commit**

```bash
git add api/ frontend/src/data/_client/api.gen.ts backend/src/main/resources/db backend/src/main/java/io/mrkuhne/mezo/feature/meal backend/src/test/java/io/mrkuhne/mezo/feature/meal/MealApiIT.java
git commit -m "feat(meal): store the planned eating window on the meal (mezo-6g52f)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Backend — score timing against the stored window

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/nutrition/service/MealWindow.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/nutrition/service/MealScoringService.java` (:171-176 overloads, :653-689 `contextDim`, :745-755 `timingSub`)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/nutrition/entity/MealBreakdownJson.java:114`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/nutrition/mapper/BreakdownDtoMapper.java:81-86`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/meal/service/MealService.java:234-248` (`applyScore`)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/nutrition/service/MealScoringServiceTest.java`

**Interfaces:**
- Consumes: `MealEntity#getWindowFrom/To()` (Task 1).
- Produces:
  - `record MealWindow(LocalTime from, LocalTime to)`;
  - `MealScoringService.scoreMeal(String slot, List<ScoredLine> lines, LocalTime localTime, MealRole role, DailyTargets base, DayContext day, MealWindow window)`, where `window` may be null;
  - `TimingDetail(String eatenAt, String windowFrom, String windowTo, String slotLabel, String windowSource)`.

- [ ] **Step 1: Write the failing unit tests**

Append to `MealScoringServiceTest.java` (imports: `DailyTargets`, `DayContext`, `MealRole` if missing):

```java
    private MealBreakdownJson scoreWith(String slot, LocalTime at, MealWindow window) {
        return service.scoreMeal(slot, lunchLines(), at, MealRole.STANDARD,
            DailyTargets.fromConfig(targets), DayContext.unknown(), window);
    }

    @Test
    void storedWindow_is_what_timing_is_scored_and_drawn_against() {
        MealWindow w = new MealWindow(LocalTime.of(12, 30), LocalTime.of(14, 0));
        MealBreakdownJson.Dimension ctx = dimension(scoreWith("breakfast", LocalTime.of(13, 20), w), "context");

        assertThat(ctx.timing().windowFrom()).isEqualTo("12:30");
        assertThat(ctx.timing().windowTo()).isEqualTo("14:00");
        assertThat(ctx.timing().windowSource()).isEqualTo("plan");
        assertThat(ctx.context()).anySatisfy(r -> assertThat(r.value()).contains("ablakban"));
    }

    @Test
    void storedWindow_penalizes_linearly_by_minutes_outside() {
        MealWindow w = new MealWindow(LocalTime.of(12, 30), LocalTime.of(14, 0));
        double in = dimension(scoreWith("breakfast", LocalTime.of(13, 0), w), "context").score().doubleValue();
        double late90 = dimension(scoreWith("breakfast", LocalTime.of(15, 30), w), "context").score().doubleValue();
        assertThat(late90).isLessThan(in);
    }

    @Test
    void storedWindow_scores_a_snack_that_used_to_fit_any_hour() {
        MealWindow w = new MealWindow(LocalTime.of(10, 30), LocalTime.of(11, 30));
        double in = dimension(scoreWith("snack", LocalTime.of(11, 0), w), "context").score().doubleValue();
        double far = dimension(scoreWith("snack", LocalTime.of(15, 0), w), "context").score().doubleValue();
        assertThat(far).isLessThan(in);
        assertThat(dimension(scoreWith("snack", LocalTime.of(11, 0), w), "context").timing().windowFrom())
            .isEqualTo("10:30");
    }

    @Test
    void no_storedWindow_keeps_the_config_path_and_says_so() {
        MealBreakdownJson.Dimension ctx = dimension(scoreWith("dinner", LocalTime.of(19, 0), null), "context");
        assertThat(ctx.timing().windowFrom()).isEqualTo("17:00");
        assertThat(ctx.timing().windowSource()).isEqualTo("config");
        MealBreakdownJson.Dimension snack = dimension(scoreWith("snack", LocalTime.of(15, 30), null), "context");
        assertThat(snack.timing().windowFrom()).isNull();
        assertThat(snack.timing().windowSource()).isNull();
    }
```

- [ ] **Step 2: Run, expect a compile failure**

```bash
cd backend && ./mvnw -q test -Dtest=MealScoringServiceTest
```

Expected: `cannot find symbol: class MealWindow`.

- [ ] **Step 3: Implement**

Create `MealWindow.java`:

```java
package io.mrkuhne.mezo.feature.nutrition.service;

import java.time.LocalTime;

/**
 * A tervező ajánlott étkezési ablaka (mezo-6g52f), ahogy a logoláskor az étkezéssel együtt
 * tárolódott. A pontozó ehhez méri az időzítést; {@code null} ablak = a statikus slot-ablak config.
 */
public record MealWindow(LocalTime from, LocalTime to) {
}
```

In `MealBreakdownJson.java:114`:

```java
    /** {@code windowSource}: "plan" (tárolt tervező-ablak), "config" (statikus slot-ablak) vagy
     *  null (nincs ablak / régi envelope). */
    public record TimingDetail(String eatenAt, String windowFrom, String windowTo, String slotLabel,
                               String windowSource) {
    }
```

In `MealScoringService.java`:

1. Change the 6-arg `scoreMeal` into a delegate, then add the 7-arg one carrying the old body with `window` threaded into `contextDim`:

```java
    public MealBreakdownJson scoreMeal(String slot, List<ScoredLine> lines, LocalTime localTime,
                                       MealRole role, DailyTargets base, DayContext day) {
        return scoreMeal(slot, lines, localTime, role, base, day, null);
    }

    /** Ablak-tudatos pontozás (mezo-6g52f): a tárolt tervező-ablak, ha van, a statikus slot-ablak
     *  config helyett — ugyanaz az ablak, amit a felület az óra-dobozban rajzol. */
    public MealBreakdownJson scoreMeal(String slot, List<ScoredLine> lines, LocalTime localTime,
                                       MealRole role, DailyTargets base, DayContext day, MealWindow window) {
        // … the previous 6-arg body verbatim, with the Stream.of(...) entry changed to:
        //     contextDim(slot, lines, kcal, localTime, role, base, day, window)
    }
```

2. `contextDim`: add a `MealWindow window` parameter. Replace the `timingSub(slot, localTime)` call and the `TimingDetail` construction:

```java
        double timingSub = timingSub(slot, localTime, window);
        // …
        rows.add(new ContextRow("Időzítés", String.format("%s · %s", localTime.format(HHMM), timingSub >= 1
            ? slotLabel(slot) + " ablakban" : "a " + slotLabel(slot) + " ablakon kívül")));
        // …
        TimingDetail timing;
        if (window != null) {
            timing = new TimingDetail(localTime.format(HHMM), window.from().format(HHMM),
                window.to().format(HHMM), slotLabel(slot), "plan");
        } else {
            int[] cfg = windowOf(props.slotWindows(), slot);
            timing = new TimingDetail(localTime.format(HHMM),
                hourOrNull(cfg == null ? null : cfg[0]), hourOrNull(cfg == null ? null : cfg[1]),
                slotLabel(slot), cfg == null ? null : "config");
        }
```

Delete the now-unused local `MealScoringProperties.SlotWindows w = props.slotWindows(); int[] window = windowOf(w, slot);` lines in `contextDim` (the name `window` now belongs to the parameter).

3. `timingSub`:

```java
    /** In-window 1.0; outside: linear to 0 at 3h distance. With a stored plan window (mezo-6g52f)
     *  the distance is minute-precise and a snack is scored too; without one, the config hours
     *  apply and a snack fits at any hour. */
    private double timingSub(String slot, LocalTime t, MealWindow stored) {
        double hour = t.getHour() + t.getMinute() / 60.0;
        double from;
        double to;
        if (stored != null) {
            from = stored.from().getHour() + stored.from().getMinute() / 60.0;
            to = stored.to().getHour() + stored.to().getMinute() / 60.0;
        } else {
            int[] window = windowOf(props.slotWindows(), slot);
            if (window == null) {
                return 1.0;
            }
            from = window[0];
            to = window[1];
        }
        double distance = hour < from ? from - hour : hour > to ? hour - to : 0;
        return Math.max(0, 1 - distance / 3);
    }
```

`windowPassed` / `remainingSlotShare` stay on the config (they decide *other* slots' budget share, and the own slot always counts). Add one sentence to the `windowPassed` javadoc: "A tárolt tervező-ablak (mezo-6g52f) szándékosan nem számít itt: ez a MÁSIK slotok keretéről dönt."

In `BreakdownDtoMapper.java:81-86`, add after `.slotLabel(...)`:

```java
                .windowSource(d.timing().windowSource() == null ? null
                    : MealTimingDetail.WindowSourceEnum.fromValue(d.timing().windowSource()))
```

In `MealService.applyScore`, replace the `scoreMeal` call:

```java
        MealWindow window = meal.getWindowFrom() == null ? null
            : new MealWindow(meal.getWindowFrom(), meal.getWindowTo());
        MealBreakdownJson breakdown =
            scoringService.scoreMeal(meal.getSlot(), lines, loggedAt.toLocalTime(), role, base, day, window);
```

Add `import io.mrkuhne.mezo.feature.nutrition.service.MealWindow;`. Meal may import nutrition, not the reverse. Check `grep -rn "new TimingDetail(" backend/src` for any other constructor call site and add `null` as its fifth argument.

- [ ] **Step 4: Run the focused tests**

```bash
cd backend && ./mvnw -q test -Dtest='MealScoringServiceTest,MealApiIT,MealServiceIT,MealRescoreRunnerIT,*ArchTest*' -Dsurefire.failIfNoSpecifiedTests=false
```

Expected: all PASS, including Task 1's three ITs.

- [ ] **Step 5: Commit**

```bash
git add backend/
git commit -m "feat(nutrition): score meal timing against the stored plan window (mezo-6g52f)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: FE — window widening, reasons and hit (pure)

**Files:**
- Modify: `frontend/src/data/types.ts` (add `WindowReason`)
- Modify: `frontend/src/data/fuel/fuelConfig.ts` (constants after `SLOT_WEIGHT`)
- Create: `frontend/src/features/fuel/logic/mealWindow.ts`
- Test: `frontend/src/features/fuel/logic/mealWindow.test.ts`

**Interfaces:**
- Produces:
  - `type WindowReason = 'after-wake' | 'protein-start' | 'protein-spacing' | 'bridge' | 'pre-training-main' | 'pre-training-snack' | 'post-training' | 'before-bed' | 'template-fixed'` (in `data/types.ts`).
  - `type WindowRule = 'breakfast' | 'main' | 'snack' | 'pre-training-main' | 'pre-training-snack' | 'post-training' | 'template-wake' | 'template-bed' | 'template-fixed' | 'template-training-start' | 'template-training-end'`.
  - `widenWindows(ws: { time: number; kind: 'meal' | 'snack'; rule: WindowRule }[], ctx: { eatingStart: number; kitchenClose: number; bedMin: number }): { from: number; to: number; reasons: WindowReason[] }[]`: same order as the input.
  - `hitOf(from: string, to: string, at: string): { kind: 'in' } | { kind: 'near' | 'far'; offsetMin: number }`.
  - `durHu(min: number): string`, e.g. `durHu(105) === '1 ó 45 p'`, `durHu(25) === '25 p'`, `durHu(120) === '2 ó'`.
  - `hitLabel(h): string`, e.g. `'Az ablakban'`, `'+25 p később'`, `'−40 p korábban'`.
  - `windowReasonCopy(code: WindowReason, ctx: { wake: string; bed: string; trainingStart: string | null; trainingEnd: string | null }): { icon: 't-sun' | 't-protein' | 't-clock' | 't-dumbbell' | 't-moon'; title: string; body: string }`.
  - `az(label: string): string` returns `'az Ebéd'` / `'a Vacsora'`, and `Az(label)` is the same capitalised.

- [ ] **Step 1: Constants and type**

`data/types.ts`, just above `export interface FuelSlot`:

```ts
/** Miért ott van egy étkezési ablak (mezo-6g52f) — a tervező szabályából; a szöveget a
 *  `windowReasonCopy` adja. */
export type WindowReason =
  | 'after-wake' | 'protein-start' | 'protein-spacing' | 'bridge'
  | 'pre-training-main' | 'pre-training-snack' | 'post-training' | 'before-bed' | 'template-fixed'
```

`fuelConfig.ts`, after `SLOT_WEIGHT`:

```ts
// Étkezési óra (mezo-6g52f): a tervezett IDŐPONTOT ablakká szélesítő percek [előtte, utána]
// szabályonként — a jóváhagyott prototípus (fuel-ora-ablak.html) érzete.
export const WINDOW_OFFSETS = {
  breakfast: [40, 80], main: [45, 45], snack: [30, 30],
  'pre-training-main': [30, 30], 'pre-training-snack': [30, 15], 'post-training': [30, 60],
  templateMeal: [45, 45], templateSnack: [30, 30],
} as const
export const WINDOW_MIN_WIDTH_MIN = 30
/** Ennyi percen belül a lefekvéshez: az ablak „before-bed" okot is kap, a forecast „Alvás" sort. */
export const BEFORE_BED_MIN = 150
/** Ennyi percen belül az ablakon kívül: „near" (a szín és a szó ugyanaz — nincs fokozat). */
export const HIT_NEAR_MIN = 45
```

- [ ] **Step 2: Write the failing tests**

`frontend/src/features/fuel/logic/mealWindow.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { widenWindows, hitOf, hitLabel, durHu, windowReasonCopy, az, Az } from './mealWindow'

const ctx = { eatingStart: 7 * 60 + 25, kitchenClose: 21 * 60 + 30, bedMin: 23 * 60 }
const h = (hh: number, mm = 0) => hh * 60 + mm

describe('widenWindows', () => {
  it('widens by rule and attaches reasons', () => {
    const [b, l] = widenWindows([
      { time: h(8), kind: 'meal', rule: 'breakfast' },
      { time: h(13), kind: 'meal', rule: 'main' },
    ], ctx)
    expect(b).toEqual({ from: h(7, 25), to: h(9, 20), reasons: ['after-wake', 'protein-start'] }) // 7:20 clamped to eatingStart
    expect(l).toEqual({ from: h(12, 15), to: h(13, 45), reasons: ['protein-spacing'] })
  })

  it('clamps to kitchen close and adds before-bed near bedtime', () => {
    const [d] = widenWindows([{ time: h(21), kind: 'meal', rule: 'post-training' }], ctx)
    expect(d.from).toBe(h(20, 30))
    expect(d.to).toBe(h(21, 30))
    expect(d.reasons).toEqual(['post-training', 'before-bed'])
  })

  it('splits overlapping neighbours at the midpoint of their placed times', () => {
    const [a, b] = widenWindows([
      { time: h(15), kind: 'meal', rule: 'main' },
      { time: h(16), kind: 'snack', rule: 'pre-training-snack' },
    ], ctx)
    expect(a.to).toBe(h(15, 30))
    expect(b.from).toBe(h(15, 30))
    expect(b.to).toBe(h(16, 15))
    expect(b.reasons).toEqual(['pre-training-snack'])
  })

  it('keeps input order even when times are unsorted', () => {
    const out = widenWindows([
      { time: h(13), kind: 'meal', rule: 'main' },
      { time: h(10, 30), kind: 'snack', rule: 'snack' },
    ], ctx)
    expect(out[1].reasons).toEqual(['bridge'])
    expect(out[1].from).toBe(h(10))
  })

  it('never returns a window narrower than 30 min', () => {
    const [w] = widenWindows([{ time: h(21, 30), kind: 'snack', rule: 'snack' }], ctx)
    expect(w.to - w.from).toBeGreaterThanOrEqual(30)
  })

  it('maps template anchors to reasons', () => {
    const out = widenWindows([
      { time: h(8), kind: 'meal', rule: 'template-wake' },
      { time: h(16), kind: 'snack', rule: 'template-training-start' },
      { time: h(19), kind: 'meal', rule: 'template-training-end' },
      { time: h(12), kind: 'meal', rule: 'template-fixed' },
    ], ctx)
    expect(out.map(o => o.reasons)).toEqual([
      ['after-wake', 'protein-start'], ['pre-training-snack'], ['post-training'], ['template-fixed'],
    ])
  })
})

describe('hitOf / hitLabel / durHu', () => {
  it('classifies in / near / far', () => {
    expect(hitOf('07:20', '09:20', '08:46')).toEqual({ kind: 'in' })
    expect(hitOf('10:30', '11:30', '11:55')).toEqual({ kind: 'near', offsetMin: 25 })
    expect(hitOf('19:00', '20:30', '22:15')).toEqual({ kind: 'far', offsetMin: 105 })
    expect(hitOf('12:00', '13:00', '11:20')).toEqual({ kind: 'near', offsetMin: -40 })
  })
  it('words the hit without a score', () => {
    expect(hitLabel({ kind: 'in' })).toBe('Az ablakban')
    expect(hitLabel({ kind: 'near', offsetMin: 25 })).toBe('+25 p később')
    expect(hitLabel({ kind: 'near', offsetMin: -40 })).toBe('−40 p korábban')
    expect(hitLabel({ kind: 'far', offsetMin: 105 })).toBe('+1 ó 45 p később')
  })
  it('formats durations', () => {
    expect(durHu(25)).toBe('25 p')
    expect(durHu(120)).toBe('2 ó')
    expect(durHu(105)).toBe('1 ó 45 p')
  })
})

describe('windowReasonCopy / articles', () => {
  const c = { wake: '06:40', bed: '23:00', trainingStart: '17:30', trainingEnd: '18:45' }
  it('names the concrete anchors', () => {
    expect(windowReasonCopy('after-wake', c).title).toContain('06:40')
    expect(windowReasonCopy('pre-training-main', c).title).toContain('17:30')
    expect(windowReasonCopy('post-training', c).title).toContain('18:45')
    expect(windowReasonCopy('before-bed', c)).toMatchObject({ icon: 't-moon' })
    expect(windowReasonCopy('before-bed', c).title).toContain('23:00')
  })
  it('drops the training time when there is none', () => {
    const t = windowReasonCopy('pre-training-snack', { ...c, trainingStart: null }).title
    expect(t).not.toContain('(')
  })
  it('never uses imperative must-copy', () => {
    const codes = ['after-wake', 'protein-start', 'protein-spacing', 'bridge', 'pre-training-main',
      'pre-training-snack', 'post-training', 'before-bed', 'template-fixed'] as const
    for (const code of codes) {
      const { title, body } = windowReasonCopy(code, c)
      expect(`${title} ${body}`).not.toMatch(/\bkell\b|különben/)
    }
  })
  it('picks the Hungarian article', () => {
    expect(az('Ebéd')).toBe('az Ebéd')
    expect(az('Vacsora')).toBe('a Vacsora')
    expect(Az('Uzsonna')).toBe('Az Uzsonna')
  })
})
```

- [ ] **Step 3: Run, expect a failure**

```bash
cd frontend && CI=true VITE_USE_MOCK=true pnpm test 2>&1 | grep -E "mealWindow|Test Files|FAIL" | head
```

Expected: `mealWindow.test.ts` FAIL (module not found).

- [ ] **Step 4: Implement `mealWindow.ts`**

```ts
// ============================================================
// Mezo · mealWindow — az étkezési óra ablak-logikája (mezo-6g52f)
//
// A tervező (placeWindows / compileTemplate) EGY időpontot helyez el és — mostantól — azt is
// feljegyzi, MELYIK szabály tette oda (`WindowRule`). Ez a modul az időpontot ablakká szélesíti
// (WINDOW_OFFSETS), a szabályból okokat ad (`WindowReason`), és a logolt időt az ablakhoz méri.
// Tiszta függvények: nincs ambiens idő, minden percben / "HH:mm"-ben jön be.
//
// Owner-döntések (2026-09-26, fuel-ora-ablak.html): az eltalálás SZÓ, nem pontszám; kívül
// mindig borostyán, soha piros; a szöveg „segít / általában", sosem „kell".
// ============================================================
import type { WindowReason } from '@/data/types'
import { WINDOW_OFFSETS, WINDOW_MIN_WIDTH_MIN, BEFORE_BED_MIN, HIT_NEAR_MIN, toMin } from '@/data/fuel/fuelConfig'

export type WindowRule =
  | 'breakfast' | 'main' | 'snack' | 'pre-training-main' | 'pre-training-snack' | 'post-training'
  | 'template-wake' | 'template-bed' | 'template-fixed' | 'template-training-start' | 'template-training-end'

export interface WidenInput { time: number; kind: 'meal' | 'snack'; rule: WindowRule }
export interface WidenCtx { eatingStart: number; kitchenClose: number; bedMin: number }
export interface WindowRange { from: number; to: number; reasons: WindowReason[] }

function offsetsOf(w: WidenInput): readonly [number, number] {
  switch (w.rule) {
    case 'breakfast': case 'main': case 'snack':
    case 'pre-training-main': case 'pre-training-snack': case 'post-training':
      return WINDOW_OFFSETS[w.rule]
    case 'template-training-start':
      return w.kind === 'meal' ? WINDOW_OFFSETS['pre-training-main'] : WINDOW_OFFSETS['pre-training-snack']
    case 'template-training-end':
      return WINDOW_OFFSETS['post-training']
    default:
      return w.kind === 'meal' ? WINDOW_OFFSETS.templateMeal : WINDOW_OFFSETS.templateSnack
  }
}

function baseReasons(w: WidenInput): WindowReason[] {
  switch (w.rule) {
    case 'breakfast': return ['after-wake', 'protein-start']
    case 'main': return ['protein-spacing']
    case 'snack': return ['bridge']
    case 'pre-training-main': return ['pre-training-main']
    case 'pre-training-snack': return ['pre-training-snack']
    case 'post-training': return ['post-training']
    case 'template-wake': return w.kind === 'meal' ? ['after-wake', 'protein-start'] : ['bridge']
    case 'template-training-start': return [w.kind === 'meal' ? 'pre-training-main' : 'pre-training-snack']
    case 'template-training-end': return ['post-training']
    case 'template-fixed': return ['template-fixed']
    case 'template-bed': return []
  }
}

/** Ablakká szélesítés. A bemenet sorrendjében ad vissza; az átfedő szomszédokat a tervezett
 *  időpontjaik felezőjénél vágja. Éjfélen átnyúló napon (eatingStart ≥ kitchenClose) a
 *  span-clampet kihagyja — csak a minimum-szélesség és a vágás él. */
export function widenWindows(ws: WidenInput[], ctx: WidenCtx): WindowRange[] {
  const spanOk = ctx.eatingStart < ctx.kitchenClose
  const out: WindowRange[] = ws.map(w => {
    const [before, after] = offsetsOf(w)
    let from = w.time - before
    let to = w.time + after
    if (spanOk) {
      from = Math.max(ctx.eatingStart, from)
      to = Math.min(ctx.kitchenClose, to)
    }
    if (to - from < WINDOW_MIN_WIDTH_MIN) from = to - WINDOW_MIN_WIDTH_MIN
    return { from, to, reasons: baseReasons(w) }
  })
  const order = ws.map((_, i) => i).sort((a, z) => ws[a].time - ws[z].time)
  for (let k = 1; k < order.length; k++) {
    const a = out[order[k - 1]]
    const b = out[order[k]]
    if (a.to > b.from) {
      const mid = (ws[order[k - 1]].time + ws[order[k]].time) / 2
      a.to = Math.min(a.to, mid)
      b.from = Math.max(b.from, mid)
    }
  }
  for (const r of out) {
    r.from = Math.round(r.from)
    r.to = Math.round(r.to)
    if (r.to >= ctx.bedMin - BEFORE_BED_MIN && !r.reasons.includes('before-bed')) r.reasons = [...r.reasons, 'before-bed']
  }
  return out
}

export type Hit = { kind: 'in' } | { kind: 'near' | 'far'; offsetMin: number }

export function hitOf(from: string, to: string, at: string): Hit {
  const a = toMin(at), lo = toMin(from), hi = toMin(to)
  if (a >= lo && a <= hi) return { kind: 'in' }
  const offsetMin = a < lo ? a - lo : a - hi
  return { kind: Math.abs(offsetMin) <= HIT_NEAR_MIN ? 'near' : 'far', offsetMin }
}

export function durHu(min: number): string {
  const m = Math.abs(Math.round(min))
  const h = Math.floor(m / 60), r = m % 60
  if (h && r) return `${h} ó ${r} p`
  return h ? `${h} ó` : `${r} p`
}

export function hitLabel(h: Hit): string {
  if (h.kind === 'in') return 'Az ablakban'
  return h.offsetMin > 0 ? `+${durHu(h.offsetMin)} később` : `−${durHu(h.offsetMin)} korábban`
}

export const az = (label: string) => (/^[AÁEÉIÍOÓÖŐUÚÜŰ]/i.test(label) ? 'az ' : 'a ') + label
export const Az = (label: string) => { const t = az(label); return t[0].toUpperCase() + t.slice(1) }

export interface ReasonCtx { wake: string; bed: string; trainingStart: string | null; trainingEnd: string | null }
export interface ReasonCopy { icon: 't-sun' | 't-protein' | 't-clock' | 't-dumbbell' | 't-moon'; title: string; body: string }

export function windowReasonCopy(code: WindowReason, c: ReasonCtx): ReasonCopy {
  const ts = c.trainingStart ? ` (${c.trainingStart})` : ''
  const te = c.trainingEnd ? ` (${c.trainingEnd})` : ''
  switch (code) {
    case 'after-wake': return { icon: 't-sun', title: `Ébredés (${c.wake}) után nem sokkal`, body: 'Az éjszakai böjt után itt töltöd fel a raktárakat.' }
    case 'protein-start': return { icon: 't-protein', title: 'A nap első fehérjeadagja', body: 'Ez indítja a napi fehérje-sort, nagyjából 3–4 órás lépésközzel.' }
    case 'protein-spacing': return { icon: 't-protein', title: 'Nagyjából 3–4 órára az előzőtől', body: 'A fehérje egyenletes elosztása segíti az izomépítést, és kordában tartja az éhséget.' }
    case 'bridge': return { icon: 't-clock', title: 'Két fő étkezés között', body: 'Áthidalja a hosszabb szünetet, így nem esel be éhesen a következő étkezésbe.' }
    case 'pre-training-main': return { icon: 't-dumbbell', title: `Néhány órával az edzés${ts} előtt`, body: 'Itt jön a nap fő szénhidrátos étkezése: tele raktárral indulsz, és addigra meg is emészted.' }
    case 'pre-training-snack': return { icon: 't-dumbbell', title: `45–90 perccel az edzés${ts} előtt`, body: 'Könnyű, gyorsan hasznosuló szénhidrát: ne üres gyomorral, de ne is tele hassal edzz.' }
    case 'post-training': return { icon: 't-dumbbell', title: `Az edzés${te} után fél–másfél órával`, body: 'Fehérje és szénhidrát segíti a regenerációt és a raktárak visszatöltését.' }
    case 'before-bed': return { icon: 't-moon', title: `Lefekvés (${c.bed}) előtt legalább 2,5 órával`, body: 'Késő este ugyanaz az étel általában nagyobb vércukor-emelkedést okoz, és ronthatja az alvást.' }
    case 'template-fixed': return { icon: 't-clock', title: 'A saját napi sablonod szerint', body: 'Ezt az időpontot a napi sablonodban rögzítetted.' }
  }
}
```

Note: `toMin` is exported from `fuelConfig.ts:59`. Import it from there, as shown above.

- [ ] **Step 5: Run the tests, expect a pass**

```bash
cd frontend && CI=true VITE_USE_MOCK=true pnpm test 2>&1 | grep -E "mealWindow|Test Files" | head
```

Expected: `mealWindow.test.ts` passes. Fix any expected value that is off by one only if the spec rule is honoured. Example: breakfast `from` is clamped to `eatingStart` 07:25.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/data/types.ts frontend/src/data/fuel/fuelConfig.ts frontend/src/features/fuel/logic/mealWindow.ts frontend/src/features/fuel/logic/mealWindow.test.ts
git commit -m "feat(fuel): pure meal-window widening, reasons and hit (mezo-6g52f)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: FE — the planner stamps windows on slots, and the log sends them

**Files:**
- Modify: `frontend/src/features/fuel/logic/buildDayPlan.ts`:
  - `PlannedWindow` :80-92;
  - `placeWindows` :200-262;
  - `buildDayPlan` steps 1 & 3 :375-420.
- Modify: `frontend/src/features/fuel/logic/compileTemplate.ts:70-73`
- Modify: `frontend/src/data/types.ts`:
  - `FuelSlot` :51-69;
  - `MealInput` :215;
  - `MealTiming` :128.
- Modify: `frontend/src/features/fuel/logic/fuelSwimlane.ts`: `WindowTileVM` :60-90 and the tile map :148+.
- Modify: `frontend/src/features/fuel/logic/keretHero.ts`: `DoneMealRow` :146-164 and `doneMealRows` :168-190.
- Modify: `frontend/src/data/fuel/mealApi.ts`: `toRequest` :151 and the timing mapper :93-94.
- Modify: `frontend/src/features/fuel/components/MealComposer.tsx`: props :215-240, destructure :262, `input` :545.
- Modify: `frontend/src/features/fuel/pages/FuelLogNewPage.tsx:138-155`
- Test: `frontend/src/features/fuel/logic/buildDayPlan.test.ts`, `frontend/src/data/fuel/mealApi.test.ts`

**Interfaces:**
- Consumes: `widenWindows`, `WindowRule` (Task 3); backend `MealRequest.window` / `MealTimingDetail.windowSource` (Tasks 1–2).
- Produces:
  - `PlannedWindow.rule: WindowRule`;
  - `FuelSlot.windowFrom?: string; windowTo?: string; windowReasons?: WindowReason[]; budgetKcal?: number`;
  - `WindowTileVM.windowFrom: string | null; windowTo: string | null; windowReasons: WindowReason[]; budgetKcal: number | null; plannedTime: string`;
  - `DoneMealRow.timing: MealTiming | null`;
  - `MealInput.window?: { from: string; to: string } | null`;
  - `MealTiming.windowSource?: 'plan' | 'config' | null`;
  - `MealComposer` prop `window?: { from: string; to: string }`.

- [ ] **Step 1: Write the failing planner tests**

Append to `frontend/src/features/fuel/logic/buildDayPlan.test.ts`. Reuse the file's existing input factory. Check its name with `grep -n "function .*Input\|const base" buildDayPlan.test.ts` and adapt `baseInput()` below to it.

```ts
describe('meal windows (mezo-6g52f)', () => {
  it('placeWindows records the placing rule', () => {
    const ws = placeWindows('06:40', '23:00', 5, [{ kind: 'gym', time: '17:30', durationMin: 75, label: 'Edzés' }])
    const byLabel = Object.fromEntries(ws.map(w => [w.label, w.rule]))
    expect(byLabel['Reggeli']).toBe('breakfast')
    expect(byLabel['Tízórai']).toBe('snack')
    expect(Object.values(byLabel)).toContain('post-training')
  })

  it('every meal slot carries a from–to window, reasons and its kcal budget', () => {
    const plan = buildDayPlan(baseInput())
    const meals = plan.slots.filter(s => s.slotKey != null)
    expect(meals.length).toBeGreaterThan(0)
    for (const s of meals) {
      expect(s.windowFrom).toMatch(/^\d\d:\d\d$/)
      expect(s.windowTo).toMatch(/^\d\d:\d\d$/)
      expect(s.windowFrom! < s.windowTo!).toBe(true)
      expect(s.windowReasons!.length).toBeGreaterThan(0)
      expect(s.budgetKcal).toBeGreaterThan(0)
    }
  })

  it('a done slot keeps the planned window, not the logged time', () => {
    const input = baseInput()
    const plan = buildDayPlan(input)
    const done = plan.slots.find(s => s.state === 'done' && s.slotKey != null)
    if (done) expect(done.windowFrom).not.toBe(done.time)
  })
})
```

Make sure `placeWindows` is imported in the test file. If `baseInput()` has no logged meal, the third case is a no-op guard and may be kept or dropped.

- [ ] **Step 2: Run, expect a failure**

```bash
cd frontend && CI=true VITE_USE_MOCK=true pnpm test 2>&1 | grep -E "buildDayPlan|Test Files" | head
```

- [ ] **Step 3: Implement the planner changes**

`buildDayPlan.ts`:

(a) `import { widenWindows, type WindowRule } from '@/features/fuel/logic/mealWindow'`. The module must not import `buildDayPlan`, so there is no cycle. Add to `PlannedWindow`:

```ts
  /** Melyik szabály helyezte ide (mezo-6g52f) — ebből lesz az ablak szélessége és a „Miért ekkor?". */
  rule: WindowRule
```

(b) In `placeWindows`:
- give each literal a `rule`: `reggeli` `'breakfast'`, `ebed` / `vacsora` `'main'`;
- `snack(time, label, rule: WindowRule = 'snack')` returns `{ …, rule }`;
- the peri push becomes `windows.push(snack(t, 'Pre-workout snack', 'pre-training-snack'))`;
- inside the training-snap block, after `post.weight = …` add `post.rule = 'post-training'`;
- after `pre.time = …` add `pre.rule = pre.kind === 'meal' ? 'pre-training-main' : 'pre-training-snack'`.

(c) In `buildDayPlan`, right after `const budgets = …`:

```ts
  // Étkezési óra (mezo-6g52f): az időpontokból ablak + okok — egy forrás a kártyának, az óra-
  // doboznak ÉS a logolásnak (ami ezt küldi a szervernek pontozásra).
  const ranges = widenWindows(windows, {
    eatingStart: span.wakeMin + EATING_START_OFFSET_MIN,
    kitchenClose: kitchenCloseMin,
    bedMin: span.bedMin,
  })
  const windowOf = (i: number) => ({
    windowFrom: toHHmm(ranges[i].from), windowTo: toHHmm(ranges[i].to),
    windowReasons: ranges[i].reasons, budgetKcal: budgets[i].kcal,
  })
```

Add `EATING_START_OFFSET_MIN` to the existing `fuelConfig` import if missing. In step 3's three returns, spread `...windowOf(i)` into each object: the done one, the recipe one and the budget-only one.

`compileTemplate.ts:72`: add a rule from the anchor type:

```ts
const RULE_BY_ANCHOR = {
  wake: 'template-wake', bed: 'template-bed', fixed: 'template-fixed',
  training_start: 'template-training-start', training_end: 'template-training-end',
} as const satisfies Record<SlotTemplate['slots'][number]['anchor']['type'], WindowRule>
// …
windows.push({ …existing fields…, rule: RULE_BY_ANCHOR[row.anchor.type] })
```

Import `type WindowRule` from `mealWindow`. If the anchor type union differs, run `grep -n "anchor" data/types.ts` and align the keys. Also fix any test fixture that builds a `PlannedWindow` literal. Run `grep -rn "slotKey: '.*', kind: '" frontend/src --include=*.test.ts`, or let `tsc` list them, and add `rule: 'main'` / `'snack'`.

- [ ] **Step 4: Thread the fields through types and VMs**

`data/types.ts`:
- `FuelSlot`: add

  ```ts
  /** Étkezési óra (mezo-6g52f): az ajánlott ablak "HH:mm"-ben, az okai, és az ablak kcal-kerete. */
  windowFrom?: string; windowTo?: string; windowReasons?: WindowReason[]; budgetKcal?: number
  ```
- `MealInput`: `window?: { from: string; to: string } | null`.
- `MealTiming`: `windowSource?: 'plan' | 'config' | null`.

`fuelSwimlane.ts`: add the fields to `WindowTileVM`:

```ts
  /** Az ajánlott ablak (mezo-6g52f); null egy ablak nélküli sloton. */
  windowFrom: string | null
  windowTo: string | null
  windowReasons: WindowReason[]
  /** Az ablak saját kcal-kerete — a blokkgyűrű nevezője (nem a napi keret). */
  budgetKcal: number | null
  /** A tervezett időpont (done tile-on a `time` a logolás ideje). */
  plannedTime: string
```

And in the tile map's returned object:

```ts
      windowFrom: slot.windowFrom ?? null,
      windowTo: slot.windowTo ?? null,
      windowReasons: slot.windowReasons ?? [],
      budgetKcal: slot.budgetKcal ?? null,
      plannedTime: slot.plannedTime ?? slot.time,
```

Fix any hand-built `WindowTileVM` literals in tests that `tsc` flags. Run `cd frontend && pnpm exec tsc -b --pretty false | head -30`.

`keretHero.ts`: add to `DoneMealRow`

```ts
  /** A szerver timing-tényei (mezo-6g52f): `windowSource === 'plan'` → a tárolt ablak az igazság. */
  timing: MealTiming | null
```

In `doneMealRows` set:

```ts
        timing: (meal?.breakdown?.dimensions.find(d => d.id === 'context') as ContextDimension | undefined)?.timing ?? null,
```

Import `ContextDimension` / `MealTiming` types. Update every `DoneMealRow` literal in tests with `timing: null`.

- [ ] **Step 5: The log path sends the window**

`mealApi.ts` `toRequest`: after `loggedAt`, add `window: input.window ?? null,`. At the timing mapper (~:93), add `windowSource: d.timing.windowSource ?? null,`.

`MealComposer.tsx`:
- add the prop `/** A blokk ajánlott ablaka (mezo-6g52f) — a szerver ehhez pontozza az időzítést. */ window?: { from: string; to: string }`;
- destructure it;
- in `input` add `...(window ? { window } : {}),` after `slot`.

Edit mode keeps omitting it, because the server keeps the stored window.

`FuelLogNewPage.tsx` `<MealComposer …>`: add

```tsx
          window={slot?.windowFrom && slot.windowTo && !editing ? { from: slot.windowFrom, to: slot.windowTo } : undefined}
```

Append to `mealApi.test.ts`:

```ts
it('toRequest carries the block window when present and null otherwise (mezo-6g52f)', () => {
  const base = { slot: 'breakfast' as const, items: [{ source: 'pantry' as const, refId: 'p1', amount: 100, unit: 'g' }] }
  expect(toRequest({ ...base, window: { from: '07:20', to: '09:20' } }).window).toEqual({ from: '07:20', to: '09:20' })
  expect(toRequest(base).window).toBeNull()
})
```

If `MealItemInput` needs more fields, copy the item literal from an existing `toRequest` test in the same file.

- [ ] **Step 6: Run the full FE suite in both modes + tsc**

```bash
cd frontend && pnpm exec tsc -b --pretty false && CI=true VITE_USE_MOCK=true pnpm test 2>&1 | tail -5 && CI=true VITE_USE_MOCK=false pnpm test 2>&1 | tail -5
```

Expected: no type errors, and both runs are green.

- [ ] **Step 7: Commit**

```bash
git add frontend/src
git commit -m "feat(fuel): planner stamps meal windows on slots, the block log sends them (mezo-6g52f)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: FE — "Mire számíts" forecast (pure)

**Files:**
- Create: `frontend/src/features/fuel/logic/mealForecast.ts`
- Test: `frontend/src/features/fuel/logic/mealForecast.test.ts`

**Interfaces:**
- Consumes: `GlycemicLevel` from `glycemicBand.ts`; `hitOf`, `durHu`, `az`, `Az` (Task 3); `BEFORE_BED_MIN` (fuelConfig).
- Produces:

```ts
export interface ForecastInput {
  level: GlycemicLevel | null     // null = no band (no carbs known)
  /** `glycemicBand(...).expect.energy` — the owner-approved sentence, used verbatim. */
  energyText: string | null
  kcal: number | null
  eatenAt: string                 // "HH:mm"
  window: { from: string; to: string } | null
  training: { start: string; end: string } | null
  bed: string
  next: { label: string; from: string; to: string } | null
}
export interface ForecastRow { icon: 't-bolt' | 't-clock' | 't-moon' | 't-heart'; title: string; body: string }
export function mealForecast(i: ForecastInput): { rows: ForecastRow[]; tip: string | null; late: boolean }
```

The band's own `tip` (owner-approved, `glycemicBand.ts`) already gives the walk / fibre-first advice, so `mealForecast.tip` is only the TIMING-specific note: the late + high line, or the low-and-soon-training line. Otherwise it is `null`.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest'
import { mealForecast, type ForecastInput } from './mealForecast'

const E = { low: 'Egyenletes energia 3-4 órára', mid: 'Stabil energia 2-3 órára', high: 'Gyors löket, majd visszaesés' }
const base: ForecastInput = {
  level: 'mid', energyText: E.mid, kcal: 784, eatenAt: '08:46', window: { from: '07:20', to: '09:20' },
  training: { start: '17:30', end: '18:45' }, bed: '23:00',
  next: { label: 'Tízórai', from: '10:30', to: '11:30' },
}

describe('mealForecast', () => {
  it('builds energy / hunger / rhythm for an in-window breakfast', () => {
    const f = mealForecast(base)
    expect(f.rows.map(r => r.title)).toEqual(['Energia', 'Mikor leszel éhes', 'A nap ritmusa'])
    expect(f.rows[0].body).toBe('Stabil energia 2-3 órára.')
    expect(f.rows[1].body).toContain('Nagyjából 12:16') // 08:46 + 210
    expect(f.rows[2].body).toContain('3–4 órás')
    expect(f.late).toBe(false)
    expect(f.tip).toBeNull()
  })

  it('adds the pre-training clause within 2h of training', () => {
    const f = mealForecast({ ...base, level: 'high', energyText: E.high, kcal: 240, eatenAt: '16:20', window: { from: '16:00', to: '16:45' }, next: { label: 'Vacsora', from: '19:00', to: '20:30' } })
    expect(f.rows[0].body).toContain('Edzés előtt ez most előny')
  })

  it('late high-load dinner → sleep row and the no-judgement tip', () => {
    const f = mealForecast({ ...base, level: 'high', energyText: E.high, kcal: 1120, eatenAt: '22:15', window: { from: '19:00', to: '20:30' }, next: null })
    expect(f.late).toBe(true)
    expect(f.rows[1].body).toContain('utolsó étkezése')
    expect(f.rows[2].title).toBe('Alvás')
    expect(f.rows[2].body).toContain('nyugtalanabb')
    expect(f.tip).toContain('ne az éjszaka mérésein')
  })

  it('outside the window: rhythm row names the shift, with the Hungarian article', () => {
    const f = mealForecast({ ...base, level: 'low', energyText: E.low, kcal: 290, eatenAt: '11:55', window: { from: '10:30', to: '11:30' }, next: { label: 'Ebéd', from: '13:00', to: '14:00' } })
    expect(f.rows[2].body).toContain('25 p-cel később')
    expect(f.rows[2].body).toContain('az Ebéd ablaka')
  })

  it('no band → no energy row, still hunger + rhythm', () => {
    const f = mealForecast({ ...base, level: null, energyText: null })
    expect(f.rows.map(r => r.title)).toEqual(['Mikor leszel éhes', 'A nap ritmusa'])
  })

  it('no window → rhythm row says it had no window', () => {
    const f = mealForecast({ ...base, window: null })
    expect(f.rows.at(-1)!.body).toContain('Nem tartozott ablakhoz')
  })

  it('never shows a number or the word "glikémiás"', () => {
    for (const level of ['low', 'mid', 'high'] as const) {
      const f = mealForecast({ ...base, level, energyText: E[level] })
      const all = [...f.rows.map(r => r.body), f.tip ?? ''].join(' ')
      expect(all).not.toMatch(/glikémiás/i)
    }
  })
})
```

- [ ] **Step 2: Run, expect a failure**

```bash
cd frontend && CI=true VITE_USE_MOCK=true pnpm test 2>&1 | grep -E "mealForecast|Test Files" | head
```

- [ ] **Step 3: Implement `mealForecast.ts`**

```ts
// ============================================================
// Mezo · mealForecast — az óra-doboz „Mire számíts" sorai (mezo-6g52f)
//
// A glycemicBand szintjét FOGYASZTJA, nem írja át (a sávok szövegei és küszöbei owner-zároltak).
// Ez az a „peri" réteg, amit a glycemicBand fejléce külön szeletnek hagyott: az időzítés × a
// vércukor-válasz sávja × a nap ritmusa (edzés, lefekvés, következő ablak). Minden becslés
// „nagyjából"; szám a vércukorról soha.
// ============================================================
import type { GlycemicLevel } from '@/features/fuel/logic/glycemicBand'
import { BEFORE_BED_MIN, toMin, toHHmm } from '@/data/fuel/fuelConfig'
import { hitOf, durHu, az, Az } from '@/features/fuel/logic/mealWindow'

export interface ForecastInput {
  level: GlycemicLevel | null
  energyText: string | null
  kcal: number | null
  eatenAt: string
  window: { from: string; to: string } | null
  training: { start: string; end: string } | null
  bed: string
  next: { label: string; from: string; to: string } | null
}
export interface ForecastRow { icon: 't-bolt' | 't-clock' | 't-moon' | 't-heart'; title: string; body: string }

export function mealForecast(i: ForecastInput): { rows: ForecastRow[]; tip: string | null; late: boolean } {
  const at = toMin(i.eatenAt)
  const toBed = toMin(i.bed) - at
  const late = toBed >= 0 && toBed <= BEFORE_BED_MIN
  const toTrain = i.training ? toMin(i.training.start) - at : null
  const afterTrain = i.training ? at - toMin(i.training.end) : null
  const rows: ForecastRow[] = []

  if (i.level && i.energyText) {
    let ctx = ''
    if (toTrain != null && toTrain > 0 && toTrain <= 120) {
      ctx = i.level === 'high' ? ' Edzés előtt ez most előny: gyorsan elérhető üzemanyag.' : ' Az edzésre ez tartós alapot ad.'
    } else if (toTrain != null && toTrain > 120 && toTrain <= 300) {
      ctx = ` Az edzésig (${i.training!.start}) ebből nagyjából kitart az alap.`
    } else if (afterTrain != null && afterTrain >= 0 && afterTrain <= 180) {
      ctx = ' Edzés után ez segíti a raktárak visszatöltését.'
    }
    rows.push({ icon: 't-bolt', title: 'Energia', body: `${i.energyText}.${ctx}` })
  }

  if (i.next) {
    const hungry = at + ((i.kcal ?? 400) < 400 ? 150 : 210) + (i.level === 'high' ? -45 : i.level === 'low' ? 20 : 0)
    const lo = toMin(i.next.from), hi = toMin(i.next.to)
    let body = `Nagyjából ${toHHmm(hungry)} körül jelez újra az éhség`
    if (hungry >= lo - 30 && hungry <= hi + 15) body += ` – pont ${az(i.next.label)} ablakában.`
    else if (hungry < lo) body += `, ${az(i.next.label)} előtt: egy pohár víz vagy kávé áthidalja.`
    else body += `. ${Az(i.next.label)} ablaka ezért kicsit később lehet, vagy kisebb adag is elég.`
    rows.push({ icon: 't-clock', title: 'Mikor leszel éhes', body })
  } else {
    rows.push({ icon: 't-clock', title: 'Mikor leszel éhes', body: 'Ez volt a nap utolsó étkezése, reggelig nem kell több.' })
  }

  if (late) {
    rows.push({ icon: 't-moon', title: 'Alvás', body: `Lefekvés előtt ${durHu(toBed)}-cel ettél` + (i.level === 'high'
      ? ', ráadásul magas vércukor-válaszú ételt. Ma éjjel valószínűleg nyugtalanabb lesz az alvás és magasabb a pulzus.'
      : '. Az emésztés még dolgozik, amikor elalszol.') })
  } else if (!i.window) {
    rows.push({ icon: 't-heart', title: 'A nap ritmusa', body: 'Nem tartozott ablakhoz, így a nap többi ablaka változatlan.' })
  } else {
    const h = hitOf(i.window.from, i.window.to, i.eatenAt)
    rows.push({ icon: 't-heart', title: 'A nap ritmusa', body: h.kind === 'in'
      ? 'Tartja a 3–4 órás fehérje-ritmust, és a nap többi ablaka a helyén marad.'
      : `${durHu(h.offsetMin)}-cel ${h.offsetMin > 0 ? 'később' : 'korábban'} ettél. Ez nem gond, a nap elbírja${i.next ? `, csak ${az(i.next.label)} ablaka tolódik vele.` : '.'}` })
  }

  // Csak IDŐZÍTÉS-specifikus jegyzet — a sáv saját (owner-jóváhagyott) tippje a séta/rost tanácsot már adja.
  let tip: string | null = null
  if (i.level === 'high' && late) tip = 'Holnap reggel ne az éjszaka mérésein ítéld meg magad: ez egy késői, nehéz vacsora hatása, nem a formádé.'
  else if (i.level === 'low' && toTrain != null && toTrain > 0 && toTrain <= 120) tip = 'Ez az étel lassan ad energiát. Mivel hamarosan edzel, jól jöhet mellé egy gyorsabb szénhidrát.'

  return { rows, tip, late }
}
```

Honest-null note: the "no window" rhythm body is the spec's *Nem tartozott ablakhoz* case, and the first test with `window: null` checks it.

- [ ] **Step 4: Run, expect a pass**

```bash
cd frontend && CI=true VITE_USE_MOCK=true pnpm test 2>&1 | grep -E "mealForecast|Test Files" | head
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/fuel/logic/mealForecast.ts frontend/src/features/fuel/logic/mealForecast.test.ts
git commit -m "feat(fuel): pure 'Mire számíts' meal forecast around the blood-sugar band (mezo-6g52f)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: FE — MealClock button and MealClockBox

**Files:**
- Create: `frontend/src/features/fuel/components/MealClock.tsx`
- Create: `frontend/src/features/fuel/components/MealClockBox.tsx`
- Modify: `frontend/src/styles/prototype.css` (add the `.fmx-mclock*` / `.fmx-mclockbox*` block next to `.fmx-timebox*` at ~:10413)
- Test: `frontend/src/features/fuel/components/MealClockBox.test.tsx`

**Interfaces:**
- Consumes:
  - `hitOf`, `hitLabel`, `durHu`, `windowReasonCopy`, `type Hit` (Task 3);
  - `mealForecast` (Task 5);
  - `glycemicBand`, `GlycemicMiniCurve` (existing);
  - `GlassBox` (`features/fuel/components/GlassBox.tsx`);
  - `ContentIcon`.
- Produces:

```ts
export interface ClockDay {
  wake: string; bed: string; nowHHmm: string
  training: { start: string; end: string; label: string } | null
  /** All meal windows of the day for the 24h dial (faint arcs). */
  windows: { key: string; from: string; to: string }[]
  /** Count of meal windows — "N. étkezés az M-ből". */
  mealCount: number
}
export function MealClock(props: { tile: WindowTileVM; row: DoneMealRow | null; nowHHmm: string; onOpen: () => void }): JSX.Element
export function MealClockBox(props: { tile: WindowTileVM; row: DoneMealRow | null; day: ClockDay; next: WindowTileVM | null; blockColor: string; onClose: () => void }): JSX.Element
/** The window the POST-log view judges against: stored plan window when the server says so, else the tile's. */
export function judgedWindow(tile: WindowTileVM, row: DoneMealRow | null): { from: string; to: string } | null
```

- [ ] **Step 1: Write the failing component tests**

`MealClockBox.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MealClock, MealClockBox, judgedWindow, type ClockDay } from './MealClockBox'
import type { WindowTileVM } from '@/features/fuel/logic/fuelSwimlane'
import type { DoneMealRow } from '@/features/fuel/logic/keretHero'

const tile = (over: Partial<WindowTileVM> = {}): WindowTileVM => ({
  key: '10:52-Tízórai', slotKey: 'snack', state: 'now', icon: 'i-snack', label: 'Tízórai', time: '10:52',
  name: 'Tízórai', ghost: true, fromPlan: false, kcal: 311, rings: [], mealId: null,
  windowFrom: '10:30', windowTo: '11:30', windowReasons: ['bridge'], budgetKcal: 311, plannedTime: '10:52',
  ...over,
} as WindowTileVM)
const row = (over: Partial<DoneMealRow> = {}): DoneMealRow => ({
  mealId: 'm1', name: 'Kókuszos csirke', time: '08:46', kcal: 784, proteinG: 63, carbsG: 92, fatG: 14,
  scorePct: 87, fiberG: 10, sugarG: 6, plannedTime: '08:15', timing: null, ...over,
})
const day: ClockDay = {
  wake: '06:40', bed: '23:00', nowHHmm: '10:52', training: { start: '17:30', end: '18:45', label: 'Edzés' },
  windows: [{ key: 'a', from: '07:20', to: '09:20' }, { key: 'b', from: '10:30', to: '11:30' }], mealCount: 5,
}

describe('MealClock', () => {
  it('renders on a pre-log tile with the window in its label', () => {
    render(<MealClock tile={tile()} row={null} nowHHmm="10:52" onOpen={vi.fn()} />)
    expect(screen.getByRole('button', { name: /Tízórai · ajánlott ablak 10:30–11:30/ })).toBeInTheDocument()
  })
  it('names the hit on a logged tile', () => {
    render(<MealClock tile={tile({ label: 'Reggeli', state: 'done', windowFrom: '07:20', windowTo: '09:20' })} row={row()} nowHHmm="10:52" onOpen={vi.fn()} />)
    expect(screen.getByRole('button', { name: /logolva 08:46 · Az ablakban/ })).toBeInTheDocument()
  })
})

describe('judgedWindow', () => {
  it('prefers the stored plan window over the tile window', () => {
    const r = row({ timing: { eatenAt: '08:46', windowFrom: '07:00', windowTo: '09:00', slotLabel: 'reggeli', windowSource: 'plan' } })
    expect(judgedWindow(tile({ windowFrom: '07:20', windowTo: '09:20' }), r)).toEqual({ from: '07:00', to: '09:00' })
  })
  it('ignores a config window and falls back to the tile', () => {
    const r = row({ timing: { eatenAt: '08:46', windowFrom: '05:00', windowTo: '10:00', slotLabel: 'reggeli', windowSource: 'config' } })
    expect(judgedWindow(tile({ windowFrom: '07:20', windowTo: '09:20' }), r)).toEqual({ from: '07:20', to: '09:20' })
  })
})

describe('MealClockBox', () => {
  it('pre-log: recommended window, why, and how it fits the day', () => {
    render(<MealClockBox tile={tile()} row={null} day={day} next={null} blockColor="var(--lav)" onClose={vi.fn()} />)
    expect(screen.getByText('Ajánlott ablak')).toBeInTheDocument()
    expect(screen.getByText('Miért ekkor?')).toBeInTheDocument()
    expect(screen.getByText('Két fő étkezés között')).toBeInTheDocument()
    expect(screen.getByText('Hogyan illik a napodba')).toBeInTheDocument()
    expect(screen.getByText(/Edzés 17:30–18:45/)).toBeInTheDocument()
  })
  it('post-log: logged time, hit chip, band without a number, forecast', () => {
    render(<MealClockBox tile={tile({ label: 'Reggeli', state: 'done', windowFrom: '07:20', windowTo: '09:20' })} row={row()} day={day} next={tile()} blockColor="var(--amber)" onClose={vi.fn()} />)
    expect(screen.getByText('Logolva')).toBeInTheDocument()
    expect(screen.getByText('Az ablakban')).toBeInTheDocument()
    expect(screen.getByText('Vércukor-válasz')).toBeInTheDocument()
    expect(screen.getByText('Mire számíts')).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/glikémiás/i)
    expect(document.body.textContent).not.toMatch(/≈\s*\d/)
  })
  it('post-log without carbs: no blood-sugar section (honest-null)', () => {
    render(<MealClockBox tile={tile({ state: 'done' })} row={row({ carbsG: null })} day={day} next={null} blockColor="var(--lav)" onClose={vi.fn()} />)
    expect(screen.queryByText('Vércukor-válasz')).toBeNull()
  })
})
```

`MealClock` lives in its own file but is re-exported from `MealClockBox.tsx` for the test import: `export { MealClock } from './MealClock'`. If `WindowTileVM` has extra required fields (check `fuelSwimlane.ts:60-92`), add them to `tile()`.

- [ ] **Step 2: Run, expect a failure**

```bash
cd frontend && CI=true VITE_USE_MOCK=true pnpm test 2>&1 | grep -E "MealClockBox|Test Files" | head
```

- [ ] **Step 3: Implement `MealClock.tsx`**

```tsx
// ============================================================
// Mezo · MealClock — a blokk MINDIG kint levő órája (mezo-6g52f, owner 2026-09-26: „A · beszédes óra").
// A Titanium óra ikon köré 12 órás számlap-gyűrű: logolás előtt az AJÁNLOTT ív (+ most-pötty és
// halk lüktetés, ha nyitva), logolás után az ív + a LOG pöttye (bent: a blokk színe, kint:
// borostyán — soha piros). A kártyán nincs idő-szöveg a logolt blokkon; a részletek az óra-dobozban.
// Referencia: docs/design_2.0/prototypes/fuel-ora-ablak.html `ring12`.
// ============================================================
import { ContentIcon } from '@/shared/ui/clay'
import { toMin } from '@/data/fuel/fuelConfig'
import { hitOf, hitLabel } from '@/features/fuel/logic/mealWindow'
import type { WindowTileVM } from '@/features/fuel/logic/fuelSwimlane'
import type { DoneMealRow } from '@/features/fuel/logic/keretHero'
import { judgedWindow } from '@/features/fuel/components/mealClockWindow'

const L = 720, R = 20.5, C = 22
const pt = (min: number): [number, number] => {
  const a = ((min % L) / L) * 2 * Math.PI - Math.PI / 2
  return [C + R * Math.cos(a), C + R * Math.sin(a)]
}

export function MealClock({ tile, row, nowHHmm, onOpen }: {
  tile: WindowTileVM; row: DoneMealRow | null; nowHHmm: string; onOpen: () => void
}) {
  const w = judgedWindow(tile, row)
  const open = !row && w != null && toMin(nowHHmm) >= toMin(w.from) && toMin(nowHHmm) <= toMin(w.to)
  const hit = row && w ? hitOf(w.from, w.to, row.time) : null
  const aria = row
    ? `${tile.label} · logolva ${row.time}${hit ? ` · ${hitLabel(hit)}` : ''}`
    : w ? `${tile.label} · ajánlott ablak ${w.from}–${w.to}` : `${tile.label} · étkezési idő`
  let marker: React.ReactNode = null
  if (row) {
    const [x, y] = pt(toMin(row.time))
    marker = <circle className="fmx-mclock-dot" cx={x} cy={y} r={4}
      style={{ fill: hit && hit.kind !== 'in' ? 'var(--amber)' : 'var(--block-color)' }} />
  } else if (open) {
    const [x, y] = pt(toMin(nowHHmm))
    marker = <circle className="fmx-mclock-now" cx={x} cy={y} r={2.6} />
  }
  const start = w ? toMin(w.from) % L : 0
  const len = w ? toMin(w.to) - toMin(w.from) : 0
  return (
    <button type="button" className={`fmx-mclock${open ? ' is-open' : ''}`} onClick={onOpen} aria-label={aria}>
      <svg className="fmx-mclock-ring" viewBox="0 0 44 44" aria-hidden="true">
        <circle className="tr" cx={C} cy={C} r={R} />
        {w && <circle className="win" cx={C} cy={C} r={R} pathLength={L}
          strokeDasharray={`${len} ${L - len}`} strokeDashoffset={-start} transform={`rotate(-90 ${C} ${C})`} />}
        {marker}
      </svg>
      <ContentIcon name="i-idozito" size={25} />
      {open && <i className="fmx-mclock-live" aria-hidden="true" />}
    </button>
  )
}
```

Create a tiny `mealClockWindow.ts` next to it, so both components share `judgedWindow` without a cycle:

```ts
import type { WindowTileVM } from '@/features/fuel/logic/fuelSwimlane'
import type { DoneMealRow } from '@/features/fuel/logic/keretHero'

/** Az ablak, amihez mérünk (mezo-6g52f): a szerveren tárolt TERVEZŐ-ablak, ha a szerver azt
 *  pontozta (`windowSource === 'plan'`) — így a rajz és a pontszám nem mondhat mást; különben a
 *  tile saját ablaka. A config-ablak (5–10 stb.) SOSEM kerül az órára. */
export function judgedWindow(tile: WindowTileVM, row: DoneMealRow | null): { from: string; to: string } | null {
  const t = row?.timing
  if (t?.windowSource === 'plan' && t.windowFrom && t.windowTo) return { from: t.windowFrom, to: t.windowTo }
  return tile.windowFrom && tile.windowTo ? { from: tile.windowFrom, to: tile.windowTo } : null
}
```

- [ ] **Step 4: Implement `MealClockBox.tsx`**

```tsx
// ============================================================
// Mezo · MealClockBox — az óra-doboz (mezo-6g52f). Fuel-középre nyíló GlassBox; a keret áll, a
// tartalom belül görget (.fmx-mclockbox-in). Két állapot, a jóváhagyott prototípus szerint
// (docs/design_2.0/prototypes/fuel-ora-ablak.html `open()`):
//   logolás ELŐTT: AJÁNLOTT ABLAK · 24 órás napóra · Miért ekkor? · Hogyan illik a napodba · jegyzet
//   logolás UTÁN:  LOGOLVA + eltalálás-chip · napóra · Vércukor-válasz (CSAK SÁV) · Mire számíts · tipp
// Szám a vércukorról SOHA (owner, harmadszor is megerősítve 2026-09-26).
// ============================================================
import { ContentIcon } from '@/shared/ui/clay'
import { GlassBox } from '@/features/fuel/components/GlassBox'
import { GlycemicMiniCurve } from '@/features/fuel/components/GlycemicGlass'
import { glycemicBand, type GlycemicLevel } from '@/features/fuel/logic/glycemicBand'
import { hitOf, hitLabel, durHu, windowReasonCopy } from '@/features/fuel/logic/mealWindow'
import { mealForecast } from '@/features/fuel/logic/mealForecast'
import { BEFORE_BED_MIN, toMin } from '@/data/fuel/fuelConfig'
import { huInt } from '@/shared/lib/huNum'
import type { WindowTileVM } from '@/features/fuel/logic/fuelSwimlane'
import type { DoneMealRow } from '@/features/fuel/logic/keretHero'
import { judgedWindow } from '@/features/fuel/components/mealClockWindow'

export { MealClock } from '@/features/fuel/components/MealClock'
export { judgedWindow }

export interface ClockDay {
  wake: string; bed: string; nowHHmm: string
  training: { start: string; end: string; label: string } | null
  windows: { key: string; from: string; to: string }[]
  mealCount: number
}

const BAND_WORD: Record<GlycemicLevel, string> = { low: 'Alacsony', mid: 'Közepes', high: 'Magas' }

function DayDial({ tile, day, window, loggedAt, hitIn }: {
  tile: WindowTileVM; day: ClockDay; window: { from: string; to: string } | null; loggedAt: string | null; hitIn: boolean
}) {
  const C = 115, R = 88, L = 1440
  const arc = (a: string, b: string, cls: string, r = R) => {
    const s = toMin(a), len = ((toMin(b) - s) + L) % L
    return <circle className={cls} cx={C} cy={C} r={r} pathLength={L} strokeDasharray={`${len} ${L - len}`}
      strokeDashoffset={-s} transform={`rotate(-90 ${C} ${C})`} />
  }
  const pt = (min: number, r: number): [number, number] => {
    const a = (min / L) * 2 * Math.PI - Math.PI / 2
    return [C + r * Math.cos(a), C + r * Math.sin(a)]
  }
  const [nx1, ny1] = pt(toMin(day.nowHHmm), R - 8), [nx2, ny2] = pt(toMin(day.nowHHmm), R + 6)
  const c1 = loggedAt ? 'AJÁNLOTT VOLT' : 'MOST'
  const c2 = loggedAt ? (window ? `${window.from}–${window.to}` : '—') : day.nowHHmm
  const c3 = loggedAt
    ? (window ? `${durHu(toMin(window.to) - toMin(window.from))} hosszú ablak` : 'nem tartozott ablakhoz')
    : (window && toMin(day.nowHHmm) <= toMin(window.to) && toMin(day.nowHHmm) >= toMin(window.from)
      ? `még ${durHu(toMin(window.to) - toMin(day.nowHHmm))}` : '')
  return (
    <>
      <svg className="fmx-mclockbox-dial" viewBox="0 0 230 230" role="img"
        aria-label={`Napóra: ébredés ${day.wake}, lefekvés ${day.bed}${day.training ? `, edzés ${day.training.start}–${day.training.end}` : ''}`}>
        <circle className="face" cx={C} cy={C} r={104} />
        {arc(day.wake, day.bed, 'awake')}
        {arc(day.bed, day.wake, 'night')}
        {day.windows.filter(w => w.key !== tile.key).map(w => <g key={w.key}>{arc(w.from, w.to, 'other')}</g>)}
        {window && arc(window.from, window.to, 'this')}
        {day.training && arc(day.training.start, day.training.end, 'train', R + 13)}
        {[0, 6, 12, 18].map(h => { const [x, y] = pt(h * 60, R - 20); return <text key={h} className="hr" x={x} y={y}>{h}</text> })}
        <line className="nowhand" x1={nx1} y1={ny1} x2={nx2} y2={ny2} />
        {loggedAt && (() => { const [x, y] = pt(toMin(loggedAt), R); return <circle className="logdot" cx={x} cy={y} r={8} style={{ fill: hitIn ? 'var(--block-color)' : 'var(--amber)' }} /> })()}
        <text className="c1" x={C} y={C - 18}>{c1}</text>
        <text className="c2" x={C} y={C + 6}>{c2}</text>
        <text className="c3" x={C} y={C + 24}>{c3}</text>
      </svg>
      <div className="fmx-mclockbox-legend">
        <span><i style={{ background: 'var(--block-color)' }} />{tile.label}</span>
        <span><i className="is-other" />többi étkezés</span>
        {day.training && <span><i style={{ background: 'var(--coral)' }} />edzés</span>}
        <span><i className="is-night" />alvás</span>
      </div>
    </>
  )
}

function Row({ icon, title, body, value }: { icon: string; title: string; body: string; value?: string }) {
  return (
    <div className="fmx-mclockbox-row">
      <ContentIcon name={icon as never} size={30} />
      <div><b>{title}</b><span>{body}</span></div>
      {value && <em>{value}</em>}
    </div>
  )
}

export function MealClockBox({ tile, row, day, next, blockColor, onClose }: {
  tile: WindowTileVM; row: DoneMealRow | null; day: ClockDay; next: WindowTileVM | null
  blockColor: string; onClose: () => void
}) {
  const window = judgedWindow(tile, row)
  const idx = day.windows.findIndex(w => w.key === tile.key) + 1
  const reasonCtx = { wake: day.wake, bed: day.bed, trainingStart: day.training?.start ?? null, trainingEnd: day.training?.end ?? null }
  const hit = row && window ? hitOf(window.from, window.to, row.time) : null
  const band = row ? glycemicBand({ c: row.carbsG, sugarG: row.sugarG, fiberG: row.fiberG, p: row.proteinG, f: row.fatG }) : null
  const late = row ? (() => { const d = toMin(day.bed) - toMin(row.time); return d >= 0 && d <= BEFORE_BED_MIN })() : false
  const status = row ? 'logolva' : window ? (toMin(day.nowHHmm) < toMin(window.from)
    ? `nyílik ${window.from}` : toMin(day.nowHHmm) <= toMin(window.to) ? 'most nyitva' : `az ablak ${window.to}-kor zárult`) : ''

  return (
    <GlassBox onClose={onClose} labelledBy="fmx-mclockbox-title" className="fmx-mclockbox"
      style={{ '--block-color': blockColor, '--c': blockColor } as React.CSSProperties}>
      <div className="fmx-mclockbox-in">
        <div className="fmx-mclockbox-head">
          <ContentIcon name={tile.icon} size={34} />
          <div><b id="fmx-mclockbox-title">{tile.label}</b>
            <small>{idx > 0 ? `${idx}. étkezés ${day.mealCount} közül · ` : ''}{status}</small></div>
          <button type="button" className="fmx-mclockbox-x" onClick={onClose} aria-label="Bezárás">✕</button>
        </div>

        <div className="fmx-mclockbox-big">
          <span className="fmx-mclockbox-eyebrow">{row ? 'Logolva' : 'Ajánlott ablak'}</span>
          <div className="fmx-mclockbox-time">{row ? row.time : window ? `${window.from}–${window.to}` : '—'}</div>
          {row && window && <div className="fmx-mclockbox-sub">ajánlott ablak: {window.from}–{window.to}</div>}
          {hit && <span className={`fmx-mclockbox-hit${hit.kind === 'in' ? ' is-in' : ''}`}>{hitLabel(hit)}</span>}
        </div>

        <DayDial tile={tile} day={day} window={window} loggedAt={row?.time ?? null} hitIn={hit?.kind === 'in'} />

        {!row && (
          <>
            {tile.windowReasons.length > 0 && (
              <section className="fmx-mclockbox-sec"><h3>Miért ekkor?</h3>
                {tile.windowReasons.map(code => { const c = windowReasonCopy(code, reasonCtx); return <Row key={code} icon={c.icon} title={c.title} body={c.body} /> })}
              </section>
            )}
            <section className="fmx-mclockbox-sec"><h3>Hogyan illik a napodba</h3>
              {day.training && <Row icon="t-dumbbell" title="Mozgás ma" body={`${day.training.label} ${day.training.start}–${day.training.end}`} />}
              {tile.budgetKcal != null && (
                <Row icon="t-plate" title="Étkezési terv"
                  body={`${idx}. étkezés ${day.mealCount} közül. Erre ~${huInt(tile.budgetKcal)} kcal jut a napi keretből.`}
                  value={`${huInt(tile.budgetKcal)} kcal`} />
              )}
            </section>
            <p className="fmx-mclockbox-note">Az ablak iránymutatás. A napi összes fehérje és kalória többet számít, mint az, hogy percre pontosan mikor eszel.</p>
          </>
        )}

        {row && (() => {
          const f = mealForecast({
            level: band?.level ?? null, energyText: band?.expect.energy ?? null, kcal: row.kcal, eatenAt: row.time, window,
            training: day.training ? { start: day.training.start, end: day.training.end } : null,
            bed: day.bed,
            next: next && next.windowFrom && next.windowTo ? { label: next.label, from: next.windowFrom, to: next.windowTo } : null,
          })
          return (
            <>
              {band && (
                <section className="fmx-mclockbox-sec"><h3>Vércukor-válasz</h3>
                  <div className={`fmx-mclockbox-gly lvl-${band.level}`}>
                    <div className="fmx-mclockbox-gly-top"><ContentIcon name="t-glucose" size={30} /><b>{BAND_WORD[band.level]}{late ? ' · késő este' : ''}</b></div>
                    <div className="fmx-mclockbox-bands" aria-hidden="true">
                      {(['low', 'mid', 'high'] as const).map(k => <i key={k} className={k === band.level ? 'on' : ''} />)}
                    </div>
                    <div className="fmx-mclockbox-bandlbl">
                      {(['low', 'mid', 'high'] as const).map(k => <span key={k} className={k === band.level ? 'on' : ''}>{BAND_WORD[k]}</span>)}
                    </div>
                    <GlycemicMiniCurve level={band.level} />
                    <p><b>{band.tip.title}.</b> {band.tip.body}{late ? ' Késő este ugyanez általában magasabbra és tovább emelkedik.' : ''}</p>
                  </div>
                </section>
              )}
              <section className="fmx-mclockbox-sec"><h3>Mire számíts</h3>
                {f.rows.map(r => <Row key={r.title} icon={r.icon} title={r.title} body={r.body} />)}
              </section>
              {f.tip && <p className="fmx-mclockbox-note">{f.tip}</p>}
            </>
          )
        })()}

        <button type="button" className="fmx-mclockbox-close" onClick={onClose}>Rendben</button>
      </div>
    </GlassBox>
  )
}
```

`band.tip` / `band.expect` are the owner-approved texts from `glycemicBand.ts` (verbatim, never edited). `band.label` is only the lowercase band word; the box uses its own capitalised `BAND_WORD`. Never add a number. Also check that `ContentIcon` accepts `t-glucose` / `t-plate` (it does, see `shared/ui/clay/index.tsx:72-73`), and replace the `icon as never` cast with the real `ContentIconName` type import.

- [ ] **Step 5: CSS**

In `frontend/src/styles/prototype.css`, next to the `.fmx-timebox*` block (~:10413), add the classes with the prototype's values, translated to house tokens. Port them 1:1 from `docs/design_2.0/prototypes/fuel-ora-ablak.html`:

| Prototype rule | App class |
|---|---|
| `.clk` | `.fmx-mclock` |
| `.clk .ring .tr/.win/.dot` | `.fmx-mclock-ring .tr/.win`, `.fmx-mclock-dot`, `.fmx-mclock-now` |
| `.clk .live` + `@keyframes ping` | `.fmx-mclock-live` + `@keyframes fmx-mclock-ping` |
| `.box` / `.box-in` | `.fmx-mclockbox` (`display:flex;flex-direction:column;max-height:88vh;width:min(92%,380px);padding:0`) and `.fmx-mclockbox-in` (`overflow-y:auto;padding:22px 18px 16px;min-height:0;scrollbar-width:none`) |
| `.bx-head`, `.bx-x`, `.bx-big .time/.sub` | `.fmx-mclockbox-head`, `-x`, `-big`, `-time`, `-sub`, `-eyebrow` |
| `.chip` (hit) | `.fmx-mclockbox-hit` (amber) / `.fmx-mclockbox-hit.is-in` (sage) |
| `.dial *`, `.legend` | `.fmx-mclockbox-dial *`, `.fmx-mclockbox-legend` (`.is-other` / `.is-night` swatches) |
| `.sec`, `.row`, `.mnote` | `.fmx-mclockbox-sec h3` (eyebrow style), `.fmx-mclockbox-row`, `.fmx-mclockbox-note` |
| `.gly*`, `.bands`, `.bandlbl` | `.fmx-mclockbox-gly` (`--g` per `lvl-low/mid/high` = `var(--sage)/var(--amber)/var(--coral)`), `-bands`, `-bandlbl` |
| `.close` | `.fmx-mclockbox-close` |

Use `var(--text-primary)`, `var(--text-secondary)`, `var(--text-muted)` and `var(--divider)` rather than literals, per bible §1. Put the ping keyframe under `@media (prefers-reduced-motion: no-preference)`.

- [ ] **Step 6: Run the tests, expect a pass**

```bash
cd frontend && CI=true VITE_USE_MOCK=true pnpm test 2>&1 | grep -E "MealClockBox|Test Files" | head
```

- [ ] **Step 7: Commit**

```bash
git add frontend/src/features/fuel/components/MealClock.tsx frontend/src/features/fuel/components/MealClockBox.tsx frontend/src/features/fuel/components/mealClockWindow.ts frontend/src/features/fuel/components/MealClockBox.test.tsx frontend/src/styles/prototype.css
git commit -m "feat(fuel): meal clock button and its glass box (mezo-6g52f)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: FE — wire the clock into the Mai blocks and re-dress the ring, score and chip

**Files:**
- Modify: `frontend/src/features/fuel/components/FuelMealBlocks.tsx`:
  - delete `WindowBar` :100-144, `TimeBox` :169-192, `BOX_HALF_MIN` / `BAND_HALF_MIN`;
  - change `BudgetRing` :146-167, `FuelScoreChip` :195-217, `GlycemicChip` :224-236, `BlockCard` :238-318, `FuelMealBlocks` :320-356;
  - update the file header comment (the "idő az ablak-csíkon él" bullet becomes the clock).
- Modify: `frontend/src/features/fuel/pages/FuelMaiPage.tsx:98` (take `wake, bed, blocks` from `useFuelTimeline`) and :183 (pass `day`).
- Modify: `frontend/src/styles/prototype.css`:
  - delete `.fmx-window*` (~:10493-10505), `.fmx-timebox*` (~:10413-10430) and `.fmx-clock` (~:10485-10490);
  - adjust `.fmx-score`, `.fmx-budget-ring`, `.fmx-glu-chip`.
- Test: `frontend/src/features/fuel/components/FuelMealBlocks.test.tsx` (rewrite :63-69, :156-163, :169-196, :248), `frontend/src/features/fuel/pages/FuelMaiPage.test.tsx` (only if it asserts `.fmx-window`)

**Interfaces:**
- Consumes: `MealClock`, `MealClockBox`, `ClockDay` (Task 6); `WindowTileVM.windowFrom/windowTo/budgetKcal` (Task 4).
- Produces: `FuelMealBlocks` new prop `day: Omit<ClockDay, 'windows' | 'mealCount'>`. Windows and the count are derived inside from `lane.tiles`.

- [ ] **Step 1: Rewrite the tests first**

In `FuelMealBlocks.test.tsx`, replace the strip/timebox/clock assertions with these (keep the file's existing `lane` / `meals` fixtures, and add `windowFrom`, `windowTo`, `windowReasons`, `budgetKcal`, `plannedTime` to its tile fixtures and `timing: null` to rows):

```tsx
const day = { wake: '06:40', bed: '23:00', nowHHmm: '10:52', training: null }

it('every block carries the meal clock, logged or not, and no window strip', () => {
  const { container } = render(<FuelMealBlocks lane={lane} meals={meals} dayKcal={2400} fiberTargetG={30} day={day}
    onLogInto={vi.fn()} onOpenMeal={vi.fn()} onOpenScore={vi.fn()} />)
  const blocks = container.querySelectorAll('.fmx-block')
  expect(blocks.length).toBeGreaterThan(0)
  blocks.forEach(b => expect(b.querySelector('.fmx-mclock')).not.toBeNull())
  expect(container.querySelector('.fmx-window')).toBeNull()
})

it('a pre-log block shows the recommended line; a logged block shows no time line', () => {
  const { container } = render(<FuelMealBlocks lane={lane} meals={meals} dayKcal={2400} fiberTargetG={30} day={day}
    onLogInto={vi.fn()} onOpenMeal={vi.fn()} onOpenScore={vi.fn()} />)
  const open = container.querySelector('.fmx-block.is-open')!
  expect(open.querySelector('.fmx-when')?.textContent).toMatch(/Ajánlott \d\d:\d\d–\d\d:\d\d/)
  const logged = container.querySelector('.fmx-block.glass')!
  expect(logged.querySelector('.fmx-when')).toBeNull()
})

it('the clock opens the clock box', async () => {
  render(<FuelMealBlocks lane={lane} meals={meals} dayKcal={2400} fiberTargetG={30} day={day}
    onLogInto={vi.fn()} onOpenMeal={vi.fn()} onOpenScore={vi.fn()} />)
  await userEvent.click(screen.getAllByRole('button', { name: /ajánlott ablak|logolva/ })[0])
  expect(screen.getByRole('dialog')).toBeInTheDocument()
})

it('the kcal ring measures the meal budget, with an overflow lap past 100%', () => {
  // a logged tile with budgetKcal 780 and a 1120 kcal meal
  const { container } = render(/* fixture with one done tile budgetKcal:780 + row kcal:1120 */)
  const ring = container.querySelector('.fmx-block.glass .fmx-budget-ring')!
  expect(ring.getAttribute('aria-label')).toBe('Logolva: 1120 / 780 kcal (144%)')
  expect(ring.querySelector('.fmx-br-over')).not.toBeNull()
})

it('the score is an unboxed button with the crystal icon', () => {
  const { container } = render(<FuelMealBlocks lane={lane} meals={meals} dayKcal={2400} fiberTargetG={30} day={day}
    onLogInto={vi.fn()} onOpenMeal={vi.fn()} onOpenScore={vi.fn()} />)
  const score = container.querySelector('.fmx-meal-chips .fmx-score')!
  expect(score.tagName).toBe('BUTTON')
  expect(score.classList.contains('is-unboxed')).toBe(true)
})

it('the blood-sugar chip carries the band word, never a number', () => {
  const { container } = render(<FuelMealBlocks lane={lane} meals={meals} dayKcal={2400} fiberTargetG={30} day={day}
    onLogInto={vi.fn()} onOpenMeal={vi.fn()} onOpenScore={vi.fn()} />)
  const chip = container.querySelector('.fmx-glu-chip')
  if (chip) expect(chip.textContent).toMatch(/^(Alacsony|Közepes|Magas)$/)
})
```

For the overflow test, build the fixture explicitly: copy the file's done-tile fixture, set `budgetKcal: 780`, and give its row `kcal: 1120`. Import `userEvent` from `@testing-library/user-event` if the file does not already. Delete the old tests that asserted `.fmx-window`, `.fmx-window-at`, the `/logolás ideje/` button and `.fmx-timebox-*`.

- [ ] **Step 2: Run, expect a failure**

```bash
cd frontend && CI=true VITE_USE_MOCK=true pnpm test 2>&1 | grep -E "FuelMealBlocks|Test Files" | head
```

- [ ] **Step 3: Implement**

`BudgetRing` becomes the meal-budget ring:

```tsx
/**
 * A blokk gyűrűje (mezo-6g52f, owner 2026-09-26): az ÉTKEZÉS SAJÁT keretéhez mér — teli kör =
 * eltaláltad, ami túlfut, egy borostyán második kör (legfeljebb egy extra kör). Logolás előtt a
 * pálya szaggatott, a számjegy a tervezett keret. Ismeretlen kcal/keret → „—" / nincs ív.
 */
function BudgetRing({ kcal, budgetKcal, logged }: { kcal: number | null; budgetKcal: number | null; logged: boolean }) {
  const ratio = logged && kcal != null && budgetKcal ? (kcal / budgetKcal) * 100 : null
  const fill = ratio == null ? 0 : Math.min(100, ratio)
  const over = ratio == null ? 0 : Math.min(100, Math.max(0, ratio - 100))
  const shown = logged ? kcal : budgetKcal
  const aria = shown == null
    ? `${logged ? 'Logolt' : 'Tervezett'} energia: nincs adat`
    : logged
      ? `Logolva: ${huInt(kcal!)}${budgetKcal ? ` / ${huInt(budgetKcal)} kcal (${Math.round(ratio!)}%)` : ' kcal'}`
      : `Keret: ${huInt(shown)} kcal`
  return (
    <span className={`fmx-budget-ring${logged ? '' : ' is-empty'}`} role="img" aria-label={aria}>
      <svg viewBox="0 0 44 44" aria-hidden="true">
        <circle className="fmx-br-track" cx="22" cy="22" r="18" pathLength={100} />
        <circle className="fmx-br-fill" cx="22" cy="22" r="18" pathLength={100} style={{ '--p': String(fill) } as React.CSSProperties} />
        {over > 3 && <circle className="fmx-br-over" cx="22" cy="22" r="18" pathLength={100} style={{ '--p': String(over) } as React.CSSProperties} />}
      </svg>
      <b>{shown == null ? '—' : huInt(shown)}</b>
    </span>
  )
}
```

`FuelScoreChip`: add `is-unboxed` to the button's class **only in the card context**. Add a prop `unboxed?: boolean`, so the `size="big"` uses elsewhere stay unchanged, and pass `unboxed` from `BlockCard`. The icon size becomes 40 when `unboxed`. The button keeps its `style={{ '--i': index }}` for the stagger, with `index` passed from the tile's position.

`GlycemicChip`: render the band word under the curve:

```tsx
      <GlycemicMiniCurve level={band.level} />
      <b className="fmx-glu-word">{BAND_WORD[band.level]}</b>
```

`BAND_WORD` is `{ low: 'Alacsony', mid: 'Közepes', high: 'Magas' }`, defined locally (the owner chose "csak sáv").

`BlockCard`:
- props: drop `dayKcal`, `onOpenTime`; add `nowHHmm: string`, `onOpenClock: (tileKey: string) => void`, `index: number`.
- head: `<span className="fmx-block-end"><MealClock tile={tile} row={rows[0] ?? null} nowHHmm={nowHHmm} onOpen={() => onOpenClock(tile.key)} /><BudgetRing kcal={rows.length ? loggedKcal : tile.budgetKcal ?? tile.kcal} budgetKcal={tile.budgetKcal} logged={rows.length > 0} /></span>`.
- replace `<WindowBar …/>` with the pre-log line only:

```tsx
      {rows.length === 0 && tile.windowFrom && tile.windowTo && (
        <div className="fmx-when">Ajánlott <b>{tile.windowFrom}–{tile.windowTo}</b>
          <span className="fmx-when-chip">{whenChip(tile.windowFrom, tile.windowTo, nowHHmm)}</span></div>
      )}
```

with:

```ts
/** Az „Ajánlott …" sor chipje (owner 2026-09-26: marad). Szégyenmentes: a lezárt ablak nem hiba. */
function whenChip(from: string, to: string, now: string): string {
  const n = toMin(now), lo = toMin(from), hi = toMin(to)
  if (n < lo) return lo - n <= 90 ? `nyílik ${durHu(lo - n)} múlva` : `nyílik ${from}`
  if (n <= hi) return `most nyitva · még ${durHu(hi - n)}`
  return 'még pótolható'
}
```

The `is-now` state adds `fmx-when-chip is-now` (accent tinted).

`FuelMealBlocks`:
- props: drop `dayKcal`; add `day: { wake: string; bed: string; nowHHmm: string; training: { start: string; end: string; label: string } | null }`.
- state: replace `timeboxFor` with `clockFor: string | null` (a tile key).
- derived: `const clockDay: ClockDay = { ...day, windows: lane.tiles.filter(t => t.windowFrom && t.windowTo).map(t => ({ key: t.key, from: t.windowFrom!, to: t.windowTo! })), mealCount: lane.tiles.length }`.
- render:

```tsx
      {clockTile && (
        <MealClockBox tile={clockTile} row={meals.find(m => m.mealId === clockTile.mealId) ?? null}
          day={clockDay} next={lane.tiles[lane.tiles.indexOf(clockTile) + 1] ?? null}
          blockColor={BLOCK_COLOR[clockTile.slotKey]} onClose={() => setClockFor(null)} />
      )}
```

Here `clockTile = lane.tiles.find(t => t.key === clockFor) ?? null`. Remove the unused `pct` / `toHHmm` imports.

`FuelMaiPage.tsx`: take `wake, bed, blocks` from `useFuelTimeline(date)`, pass `day={{ wake, bed, nowHHmm, training: trainingSpan(blocks) }}`, and drop `dayKcal`. Add `trainingSpan` to `logic/mealWindow.ts`:

```ts
/** A nap edzés-burka a napórához és a forecasthoz: legkorábbi kezdet, legkésőbbi vég; több blokknál
 *  „első címke +N". Nincs blokk → null (őszinte-null: nincs edzés-ív, nincs edzés-mondat). */
export function trainingSpan(blocks: { time: string; durationMin: number | null; label: string }[]): { start: string; end: string; label: string } | null {
  if (!blocks.length) return null
  const sorted = [...blocks].sort((a, z) => toMin(a.time) - toMin(z.time))
  const end = Math.max(...blocks.map(b => toMin(b.time) + (b.durationMin ?? DEFAULT_BLOCK_MIN)))
  const label = sorted[0].label.split('·')[0].trim() + (blocks.length > 1 ? ` +${blocks.length - 1}` : '')
  return { start: sorted[0].time, end: toHHmm(end), label }
}
```

(import `DEFAULT_BLOCK_MIN`, `toHHmm` from `fuelConfig`) and append to `mealWindow.test.ts`:

```ts
describe('trainingSpan', () => {
  it('null without blocks', () => expect(trainingSpan([])).toBeNull())
  it('one block', () => expect(trainingSpan([{ time: '17:30', durationMin: 75, label: 'Felsőtest · gym' }]))
    .toEqual({ start: '17:30', end: '18:45', label: 'Felsőtest' }))
  it('envelope of two', () => expect(trainingSpan([
    { time: '19:00', durationMin: 90, label: 'Röplabda' }, { time: '17:30', durationMin: null, label: 'Edzés' },
  ])).toEqual({ start: '17:30', end: '20:30', label: 'Edzés +1' }))
})
```

CSS (`prototype.css`):
- delete `.fmx-window*`, `.fmx-timebox*` and `.fmx-clock*`;
- add `.fmx-when` (12.5px, `--text-secondary`, flex, gap 8px, `padding: 0 2px 10px`) and `.fmx-when-chip` (the prototype's `.chip`);
- add `.fmx-br-over { stroke: var(--amber); stroke-dasharray: var(--p) 100; … glow }` and `.fmx-budget-ring.is-empty .fmx-br-track { stroke-dasharray: 2 3 }`;
- `.fmx-score.is-unboxed`: no border, no background, `padding: 0 2px`, icon 40px with a lavender halo, the numeral as 22px gradient text;
- add the keyframe:

  ```css
  @media (prefers-reduced-motion:no-preference){
    .fmx-score.is-unboxed{animation:fmx-nudge 6s ease-in-out infinite;animation-delay:calc(1.2s + var(--i,0) * .8s);transform-origin:50% 60%}
    @keyframes fmx-nudge{0%,84%,100%{transform:none}86%{transform:rotate(-5deg) scale(1.04)}88%{transform:rotate(5deg) scale(1.06)}90%{transform:rotate(-4deg) scale(1.05)}92%{transform:rotate(3deg) scale(1.03)}94%{transform:rotate(-1.5deg)}96%{transform:none}}
  }
  ```

  Remove the old score animation this replaces: grep `.fmx-score` for an existing `animation:`.
- `.fmx-glu-chip`: column layout, and `.fmx-glu-word` at 10.5px/600 in the band colour.

- [ ] **Step 4: Full FE gates**

```bash
cd frontend && pnpm exec tsc -b --pretty false && CI=true VITE_USE_MOCK=true pnpm test 2>&1 | tail -5 && CI=true VITE_USE_MOCK=false pnpm test 2>&1 | tail -5 && pnpm build 2>&1 | tail -3
```

Expected: green in both modes, and the build succeeds. Fix every other consumer of the removed `dayKcal` prop / `FuelMealBlocks` signature that `tsc` reports.

- [ ] **Step 5: Runtime check (verify skill)**

Invoke the `verify` skill to launch the mock-mode PWA. Open `/fuel` at 390px and check:
- every block shows the clock;
- a pre-log block shows the "Ajánlott" line;
- the clock opens the box in both states;
- the late dinner fixture (`data/fuel/fuel.ts:418`, 23:35) shows an amber dot and the Alvás row;
- the score shakes, and does not shake with reduced motion emulated.

Also run the layout spec:

```bash
cd frontend && pnpm test:layout 2>&1 | tail -5
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src
git commit -m "feat(fuel): the meal clock replaces the window strip; meal-budget ring, unboxed score (mezo-6g52f)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Docs, codemap, final gates, merge

**Files:**
- Modify: `docs/features/fuel.md`:
  - the meal-block section around :123 and :562;
  - the §9 "past days" trap (logged meals now carry their window);
  - the ring semantics.
- Modify: `docs/design_2.0/2026-09-23-uveg-style-bible.md`: append `### Étkezési óra (mezo-6g52f, 2026-09-26)` to the appendix, with lessons:
  - the glass frame must not scroll with the content (frame and inner scroller split);
  - "talking icon" = sprite icon + data ring;
  - "tap me" = joint periodic shake, not float/breathe.
- Regenerate: `docs/CODEMAP.md`

- [ ] **Step 1: Write the doc updates**

Update `fuel.md` with:
- the clock and its two states;
- window truth (plan window stored at log, `windowSource`);
- the kcal ring = meal budget;
- the removed `WindowBar` / `TimeBox`;
- the "no number" rule restated.

Link the spec and prototype.

- [ ] **Step 2: Codemap + docs lint**

```bash
node scripts/gen-codemap.mjs && node scripts/lint-docs.mjs 2>&1 | tail -3
```

- [ ] **Step 3: Backend focused gates + ArchUnit**

```bash
cd backend && ./mvnw -q test -Dtest='MealScoringServiceTest,MealApiIT,MealServiceIT,MealRescoreRunnerIT,FuelDayServiceIT,*Arch*' -Dsurefire.failIfNoSpecifiedTests=false
```

This touches the contract and a migration, so also run the full suite:

```bash
cd backend && ./mvnw clean test -Dmezo.test.use-testcontainers=true 2>&1 | tail -20
```

- [ ] **Step 4: Commit, close, merge, push**

```bash
git add docs/
git commit -m "docs(fuel): meal clock — feature doc, bible appendix, codemap (mezo-6g52f)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
bd close mezo-6g52f
bd create "Étkezési óra: késés után a tervező tolja el a hátralévő ablakokat (mezo-6g52f follow-up)" -t feature -p 3
node scripts/check-beads-backup.mjs --fix && git add .beads/issues.jsonl && git commit -m "chore(beads): tracker backup after meal clock (mezo-6g52f) [skip ci]"
git fetch origin && git rebase origin/main
node scripts/gen-codemap.mjs && git diff --quiet docs/CODEMAP.md || git commit -am "docs: regenerate codemap after rebase (mezo-6g52f)"
git checkout --detach origin/main && git merge --no-ff feat/etkezesi-ora -m "Merge branch 'feat/etkezesi-ora' — étkezési óra (mezo-6g52f)" && git push origin HEAD:main
bd dolt push
git branch -d feat/etkezesi-ora
gh run list --branch main --limit 1
```

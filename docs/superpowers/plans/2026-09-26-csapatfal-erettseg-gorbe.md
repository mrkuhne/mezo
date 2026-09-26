# Csapatfal — real maturity curve Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the room's post-count curve with "Így érik a képe rólad", a weekly per-room
maturity curve fed by a nightly per-dimension snapshot and a live current week.

**Architecture:** A pure `MaturityFormula` becomes the single definition of dimension maturity. The
overview and dimension reads, `PortraitWriter` and a new `CharacterMaturityService` all use it. A
nightly `CharacterMaturityJob` upserts `character_maturity_week` rows. `GET
/api/character/maturity-history` returns the stored past weeks plus a live current week. The FE
turns that into an 8-slot room series and draws text, then dots, then a line.

**Tech Stack:** Spring Boot 3 / JPA / Liquibase SQL / OpenAPI codegen; React + TanStack Query
(`useDualQuery`) + Vitest.

Spec: `docs/superpowers/specs/2026-09-26-csapatfal-erettseg-gorbe-design.md`.

## Global Constraints

- Bead id `mezo-a9bo7.11` in every commit subject and in the migration file name (`_mezo-a9bo7.11_`).
- Formula: `min(100, round_half_up(20 × activeCount + 40 × meanActiveConfidence))`, and 0 for no active claims.
- Week = ISO Monday in `Europe/Budapest`. Nightly cron `0 55 23 * * *`.
- Job switch `mezo.techcore.cron.character-maturity-job.enabled`: true in `application.yml`,
  false in `backend/src/test/resources/application.properties`.
- `weeks` query param 1..26, default 8, out of range → 400 `CHARACTER_RUN_RANGE_INVALID`.
- Line from 4 points; fewer → dots + text. A null week breaks the line. No backfill, no filler rows.
- Copy (Hungarian, verbatim):
  - section title: `Így érik a képe rólad`
  - early text: `Most kezdtem el hétről hétre feljegyezni, mennyire ismerlek — a 4. héttől vonal köti össze a pontokat.`
  - no-point text: `Most kezdtem el hétről hétre feljegyezni, mennyire ismerlek — jövő héttől itt látod.`
  - drop notes: `{title}: {n} állítás kikerült a képből, ezért halványult.` /
    `{title}: a meglévő állítások bizonyossága csökkent.`
- No UI emoji. Reduced motion follows the existing `.tf-draw` rules.

---

### Task 1: `MaturityFormula` + deterministic reads

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/character/service/MaturityFormula.java`
- Modify: `backend/.../character/service/PortraitWriter.java` (drop `computeMaturity` + the three constants; call `MaturityFormula.compute`)
- Modify: `backend/.../character/service/CharacterService.java` (`overview`, `dimension`: `.maturity(MaturityFormula.compute(activeClaims))`)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/character/MaturityFormulaTest.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/character/CharacterApiIT.java` (new test)

**Interfaces:**
- Produces:
  - `MaturityFormula.compute(List<CharacterClaimEntity> active): short`
  - `MaturityFormula.meanConfidence(List<CharacterClaimEntity> active): BigDecimal` (scale 3, null when empty)

- [ ] **Step 1: Failing unit test**

```java
class MaturityFormulaTest {
    private static CharacterClaimEntity claim(String c) {
        var e = new CharacterClaimEntity(); e.setConfidence(new BigDecimal(c)); return e;
    }
    @Test void empty_isZero() { assertThat(MaturityFormula.compute(List.of())).isZero(); }
    @Test void twoClaims() { // 20*2 + 40*0.65 = 66
        assertThat(MaturityFormula.compute(List.of(claim("0.50"), claim("0.80")))).isEqualTo((short) 66); }
    @Test void capsAt100() {
        assertThat(MaturityFormula.compute(List.of(claim("0.9"), claim("0.9"), claim("0.9"), claim("0.9"))))
                .isEqualTo((short) 100); }
    @Test void roundsHalfUp() { // 20 + 40*0.51 = 40.4 -> 40 ; 20 + 40*0.5125 = 40.5 -> 41
        assertThat(MaturityFormula.compute(List.of(claim("0.51")))).isEqualTo((short) 40); }
    @Test void meanConfidence_nullWhenEmpty_scale3() {
        assertThat(MaturityFormula.meanConfidence(List.of())).isNull();
        assertThat(MaturityFormula.meanConfidence(List.of(claim("0.50"), claim("0.81")))).isEqualByComparingTo("0.655");
    }
}
```

- [ ] **Step 2: Run it and confirm it FAILS** (class missing):
  `cd backend && ./mvnw -q test -Dtest=MaturityFormulaTest`

- [ ] **Step 3: Implement**

```java
package io.mrkuhne.mezo.feature.character.service;

/** A dimenzió érettsége (0..100) az AKTÍV állításaiból — az egyetlen definíció (mezo-a9bo7.11):
 *  a portré-író, az overview/dimension olvasás és a heti érettség-történet mind ezt hívja. */
public final class MaturityFormula {
    private static final BigDecimal COVERAGE_WEIGHT = new BigDecimal("20");
    private static final BigDecimal CONFIDENCE_WEIGHT = new BigDecimal("40");
    private static final int MAX = 100;
    private MaturityFormula() {}

    public static short compute(List<CharacterClaimEntity> active) {
        if (active.isEmpty()) return 0;
        BigDecimal mean = mean(active, 10);
        int rounded = COVERAGE_WEIGHT.multiply(BigDecimal.valueOf(active.size()))
                .add(CONFIDENCE_WEIGHT.multiply(mean)).setScale(0, RoundingMode.HALF_UP).intValue();
        return (short) Math.min(MAX, rounded);
    }

    public static BigDecimal meanConfidence(List<CharacterClaimEntity> active) {
        return active.isEmpty() ? null : mean(active, 3);
    }

    private static BigDecimal mean(List<CharacterClaimEntity> active, int scale) {
        BigDecimal sum = active.stream().map(CharacterClaimEntity::getConfidence).reduce(BigDecimal.ZERO, BigDecimal::add);
        return sum.divide(BigDecimal.valueOf(active.size()), scale, RoundingMode.HALF_UP);
    }
}
```

Wire it up:
- `PortraitWriter`: `dimension.setMaturity(MaturityFormula.compute(activeClaims));`, and delete the
  private method and its constants.
- `CharacterService.overview`: fetch the full ACTIVE list once (`var active = claimRepository.find...(owner, dim.getId(), ACTIVE)`),
  use `active.stream().limit(TOP_CLAIMS_CAP)` for top claims and `.maturity((int) MaturityFormula.compute(active))`.
- `CharacterService.dimension`: `.maturity((int) MaturityFormula.compute(activeClaimsOfDim))`,
  using the ACTIVE subset of the claims it already loads. If it loads all statuses, filter on
  `ACTIVE.equals(c.getStatus())`.

- [ ] **Step 4: IT — the read ignores a zeroed stored column**

In `CharacterApiIT`, add:
```java
@Test
void overview_maturityComesFromActiveClaims_evenWhenStoredColumnWasZeroed() {
    UUID owner = ownerId();
    getForBody("/api/character", ownerAuthHeaders(), HttpStatus.OK, CharacterOverviewResponse.class);
    var dim = dimensionRepository.findByCreatedByAndKey(owner, "recovery").orElseThrow();
    dim.setMaturity((short) 0); dimensionRepository.saveAndFlush(dim);
    saveActiveClaim(owner, dim.getId(), "0.50");
    saveActiveClaim(owner, dim.getId(), "0.80");
    CharacterOverviewResponse res = getForBody("/api/character", ownerAuthHeaders(), HttpStatus.OK, CharacterOverviewResponse.class);
    assertThat(res.getDimensions()).filteredOn(d -> d.getKey().equals("recovery"))
            .singleElement().extracting(CharacterDimensionSummary::getMaturity).isEqualTo(66);
    CharacterDimensionResponse one = getForBody("/api/character/dimension/recovery", ownerAuthHeaders(), HttpStatus.OK, CharacterDimensionResponse.class);
    assertThat(one.getMaturity()).isEqualTo(66);
}
```
The helper `saveActiveClaim(owner, dimId, conf)` builds the entity the way
`CharacterReplyPopulator.claim` does (text, ACTIVE, proposedBy "szomnologus", the empty envelopes).
Autowire `CharacterDimensionRepository dimensionRepository` and `CharacterClaimRepository claimRepository`.

- [ ] **Step 5: Run** `./mvnw -q test -Dtest='MaturityFormulaTest,CharacterApiIT,PortraitWriterNameIT,CharacterWeeklySynthesisIT'`. Expected: PASS.
- [ ] **Step 6: Commit** `refactor(character): one maturity formula, reads compute it from active claims (mezo-a9bo7.11)`

### Task 2: `character_maturity_week` storage + snapshot service + nightly job

**Files:**
- Create: `backend/src/main/resources/db/changelog/1.1.0/script/202609262200_mezo-a9bo7.11_character_maturity_week.sql`
- Modify: `backend/src/main/resources/db/changelog/1.1.0/1.1.0_master.yml` (append the changeSet)
- Create: `backend/.../character/entity/CharacterMaturityWeekEntity.java`
- Create: `backend/.../character/repository/CharacterMaturityWeekRepository.java`
- Create: `backend/.../character/config/CharacterMaturityProperties.java`
- Create: `backend/.../character/service/CharacterMaturityService.java`
- Create: `backend/.../character/service/CharacterMaturityJob.java`
- Modify: `backend/.../techcore/configuration/FeaturesConfiguration.java` (`CHARACTER_MATURITY_JOB_SWITCH`)
- Modify: `backend/src/main/resources/application.yml` (the switch under `mezo.techcore.cron`, plus `mezo.character.maturity.{cron,zone}`)
- Modify: `backend/src/test/resources/application.properties` (`mezo.techcore.cron.character-maturity-job.enabled=false`)
- Modify: `backend/src/test/java/io/mrkuhne/mezo/support/ResetDatabase.java` (add `character_maturity_week` before `character_claim_revision`)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/character/CharacterMaturityIT.java`

**Interfaces:**
- Produces:
  - `CharacterMaturityService.weekStart(LocalDate day): LocalDate` (static, ISO Monday)
  - `CharacterMaturityService.snapshot(UUID owner, LocalDate day): int` (rows written)
  - `CharacterMaturityService.history(UUID owner, LocalDate today, int weeks): CharacterMaturityHistory`
    (the DTO comes in Task 3; in this task `history` is not written yet)

- [ ] **Step 1: Migration**

```sql
create table character_maturity_week (
 id uuid not null default gen_random_uuid(),
 created_by uuid not null,
 created_at timestamptz not null default now(),
 is_deleted boolean not null default false,
 dimension_id uuid not null,
 week_start date not null,
 maturity smallint not null,
 claim_count smallint not null,
 mean_confidence numeric(4,3),
 updated_at timestamptz not null default now(),
 constraint pk_character_maturity_week_id primary key(id),
 constraint fk_character_maturity_week_created_by foreign key(created_by) references app_user(id) on delete cascade,
 constraint fk_character_maturity_week_dimension_id foreign key(dimension_id) references character_dimension(id) on delete cascade,
 constraint ck_character_maturity_week_maturity check(maturity between 0 and 100),
 constraint ck_character_maturity_week_claim_count check(claim_count >= 0),
 constraint ck_character_maturity_week_monday check(extract(isodow from week_start) = 1)
);
create unique index uq_character_maturity_week on character_maturity_week(created_by, dimension_id, week_start) where is_deleted=false;
create index idx_character_maturity_week_dimension_id on character_maturity_week(dimension_id);
create index idx_character_maturity_week_owner_week on character_maturity_week(created_by, week_start);
```
The master changeSet copies the last entry's shape, with id `"1.1.0:202609262200_mezo-a9bo7.11_character_maturity_week"`.

- [ ] **Step 2: Entity + repository**. The entity mirrors `TeamEditionEntity`: `@SQLDelete`/`@SQLRestriction`,
  fields `dimensionId`, `weekStart`, `Short maturity` (`@Min(0) @Max(100)`), `Short claimCount`,
  `BigDecimal meanConfidence` (`precision=4, scale=3`), `Instant updatedAt`. Repository:

```java
public interface CharacterMaturityWeekRepository extends JpaRepository<CharacterMaturityWeekEntity, UUID> {
    Optional<CharacterMaturityWeekEntity> findByCreatedByAndDimensionIdAndWeekStart(UUID createdBy, UUID dimensionId, LocalDate weekStart);
    List<CharacterMaturityWeekEntity> findByCreatedByAndWeekStartBetweenOrderByWeekStartAsc(UUID createdBy, LocalDate from, LocalDate to);
}
```

- [ ] **Step 3: Failing IT**

```java
class CharacterMaturityIT extends AbstractIntegrationTest {
    @Autowired CharacterMaturityService service;
    @Autowired CharacterMaturityWeekRepository weeks;
    @Autowired CharacterService characterService;
    @Autowired CharacterDimensionRepository dimensions;
    @Autowired CharacterClaimRepository claims;
    @Autowired DatabasePopulator populator;

    private static final LocalDate WED = LocalDate.of(2026, 9, 23); // the queried week, never now()

    @Test void weekStart_isIsoMonday() {
        assertThat(CharacterMaturityService.weekStart(LocalDate.of(2026, 9, 27))).isEqualTo(LocalDate.of(2026, 9, 21));
        assertThat(CharacterMaturityService.weekStart(LocalDate.of(2026, 9, 21))).isEqualTo(LocalDate.of(2026, 9, 21));
    }

    @Test void snapshot_isIdempotentPerWeek_andRefreshesTheValue() {
        UUID owner = populator.populateUser("maturity-a@example.com");
        characterService.overview(owner); // seeds the 8 core/meta dimensions
        var rec = dimensions.findByCreatedByAndKey(owner, "recovery").orElseThrow();
        claim(owner, rec.getId(), "0.50");
        assertThat(service.snapshot(owner, WED)).isEqualTo(8);
        claim(owner, rec.getId(), "0.80");
        service.snapshot(owner, WED.plusDays(4)); // Sunday of the same week
        var rows = weeks.findByCreatedByAndWeekStartBetweenOrderByWeekStartAsc(owner, WED.minusDays(2), WED.minusDays(2));
        assertThat(rows).hasSize(8);
        var r = rows.stream().filter(w -> w.getDimensionId().equals(rec.getId())).findFirst().orElseThrow();
        assertThat(r.getMaturity()).isEqualTo((short) 66);
        assertThat(r.getClaimCount()).isEqualTo((short) 2);
        assertThat(r.getMeanConfidence()).isEqualByComparingTo("0.650");
    }
}
```
`claim(...)` follows the `CharacterReplyPopulator.claim` field set. If `AbstractIntegrationTest`
needs `@Transactional` handling for `snapshot` (REQUIRES_NEW writes), copy the idiom from
`CharacterRunLogIT`.

- [ ] **Step 4: Run it and confirm it FAILS**: `./mvnw -q test -Dtest=CharacterMaturityIT`

- [ ] **Step 5: Implement the properties, service, job and switch**

```java
@Validated
@ConfigurationProperties(prefix = "mezo.character.maturity")
public record CharacterMaturityProperties(@NotBlank String cron, @NotBlank String zone) {}
```

```java
@Slf4j @Service @RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.CHARACTER_SWITCH, havingValue = "true")
public class CharacterMaturityService {
    private static final String ACTIVE = "ACTIVE";
    private final CharacterDimensionRepository dimensions;
    private final CharacterClaimRepository claims;
    private final CharacterMaturityWeekRepository weeks;

    public static LocalDate weekStart(LocalDate day) { return day.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)); }

    /** Upserts this ISO week's row for every dimension of the owner; returns rows written. */
    @Transactional
    public int snapshot(UUID owner, LocalDate day) {
        LocalDate week = weekStart(day);
        int n = 0;
        for (var dim : dimensions.findByCreatedBy(owner)) {
            var active = claims.findByCreatedByAndDimensionIdAndStatusOrderByConfidenceDesc(owner, dim.getId(), ACTIVE);
            var row = weeks.findByCreatedByAndDimensionIdAndWeekStart(owner, dim.getId(), week).orElseGet(() -> {
                var w = new CharacterMaturityWeekEntity();
                w.setCreatedBy(owner); w.setDimensionId(dim.getId()); w.setWeekStart(week); return w;
            });
            row.setMaturity(MaturityFormula.compute(active));
            row.setClaimCount((short) active.size());
            row.setMeanConfidence(MaturityFormula.meanConfidence(active));
            row.setUpdatedAt(Instant.now());
            weeks.save(row);
            n++;
        }
        return n;
    }
}
```

```java
@Slf4j @Component @RequiredArgsConstructor
@ConditionalOnProperty(name = {FeaturesConfiguration.CHARACTER_SWITCH, FeaturesConfiguration.CHARACTER_MATURITY_JOB_SWITCH}, havingValue = "true")
public class CharacterMaturityJob {
    private final UserFanOut userFanOut;
    private final CharacterMaturityService service;
    private final CharacterMaturityProperties properties;

    @Scheduled(cron = "${mezo.character.maturity.cron}", zone = "${mezo.character.maturity.zone}")
    public void run() { run(LocalDate.now(ZoneId.of(properties.zone()))); }

    void run(LocalDate today) {
        userFanOut.forEachActiveUser("Character maturity snapshot", user -> {
            try { service.snapshot(user.getId(), today); }
            catch (RuntimeException e) {
                // A concurrent writer (a second node) raced us on uq_character_maturity_week — the
                // week already has a row; the next night refreshes it. Anything else is logged too.
                log.warn("Maturity snapshot failed for user {} day {}", user.getId(), today, e);
            }
        });
    }
}
```
`FeaturesConfiguration`:
```java
/** Csapatfal érettség-görbe (mezo-a9bo7.11) — nightly per-dimension maturity snapshot
 *  (schedule: mezo.character.maturity.cron). Off ⇒ the CharacterMaturityJob bean does not exist. */
public static final String CHARACTER_MATURITY_JOB_SWITCH = "mezo.techcore.cron.character-maturity-job.enabled";
```
`application.yml`: `character-maturity-job: enabled: true` next to `team-chat-expiry-job`, and under
`mezo.character`:
```yaml
    maturity:
      # 23:55 Budapest — after the 21:00–23:30 council/edition window; the Sunday run finalises the week.
      cron: "0 55 23 * * *"
      zone: Europe/Budapest
```
Add a job test to the IT: call `job.run(WED)` directly (with `@Autowired(required=false)`, the bean
is off in tests). Instead, construct it by hand:
`new CharacterMaturityJob(userFanOut, service, new CharacterMaturityProperties("x", "Europe/Budapest")).run(WED)`.
Assert that the owner's rows exist.

- [ ] **Step 6: Run** `./mvnw -q test -Dtest='CharacterMaturityIT,MaturityFormulaTest'`. Expected: PASS.
- [ ] **Step 7: Commit** `feat(character): nightly weekly maturity snapshot (mezo-a9bo7.11)`

### Task 3: History API

**Files:**
- Modify: `api/feature/character/character.yml` (path + 3 schemas)
- Regenerate: `api/openapi.yml` (`cd api/generate && npm run generate:api`) and `frontend/src/data/_client/api.gen.ts` (`cd frontend && pnpm generate:api`)
- Modify: `CharacterMaturityService` (`history`), `CharacterController` (`getMaturityHistory`)
- Test: `CharacterMaturityIT` (service), `CharacterApiIT` (HTTP incl. 400 + foreign owner)

**Interfaces:**
- Produces: DTO `CharacterMaturityHistory { weeks: List<CharacterMaturityWeek> }`,
  `CharacterMaturityWeek { weekStart: LocalDate, live: boolean, dimensions: List<CharacterMaturityPoint> }`,
  `CharacterMaturityPoint { key, title, expertKey (nullable), maturity: int, claimCount: int }`.

- [ ] **Step 1: Contract** (after `/api/character/edition`):

```yaml
  /api/character/maturity-history:
    get:
      tags: [Character]
      operationId: getMaturityHistory
      summary: >-
        Weekly per-dimension maturity (csapatfal, mezo-a9bo7.11): stored ISO weeks oldest first,
        plus the CURRENT week computed live (live=true). A week without rows is absent — never
        back-filled (ADR 0049).
      parameters:
        - name: weeks
          in: query
          required: false
          schema: { type: integer, default: 8 }
      responses:
        '200':
          description: The history (the live current week is always present)
          content:
            application/json:
              schema: { $ref: '#/components/schemas/CharacterMaturityHistory' }
        '400':
          description: weeks outside 1..26
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
        '401':
          description: Missing or invalid token
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
```
Schemas:
```yaml
    CharacterMaturityHistory:
      type: object
      required: [weeks]
      properties:
        weeks: { type: array, items: { $ref: '#/components/schemas/CharacterMaturityWeek' } }
    CharacterMaturityWeek:
      type: object
      required: [weekStart, live, dimensions]
      properties:
        weekStart: { type: string, format: date }
        live: { type: boolean }
        dimensions: { type: array, items: { $ref: '#/components/schemas/CharacterMaturityPoint' } }
    CharacterMaturityPoint:
      type: object
      required: [key, title, maturity, claimCount]
      properties:
        key: { type: string }
        title: { type: string }
        expertKey: { type: string, nullable: true }
        maturity: { type: integer, minimum: 0, maximum: 100 }
        claimCount: { type: integer, minimum: 0 }
```

- [ ] **Step 2: Failing tests.** Service IT:
  seed rows for `W-2` and `W-1` via `snapshot`, add a claim, call `history(owner, WED, 8)`.
  Expect 3 weeks (`W-2`, `W-1`, `W` live). The live week reflects the new claim; `W-1` does not.
  Also: owner B's rows never appear in owner A's history. HTTP in `CharacterApiIT`:
  `?weeks=0` → 400 `CHARACTER_RUN_RANGE_INVALID`, `?weeks=27` → 400, and the default returns exactly
  one live week for a fresh owner.

- [ ] **Step 3: Implement**

```java
@Transactional(readOnly = true)
public CharacterMaturityHistory history(UUID owner, LocalDate today, int weeksBack) {
    if (weeksBack < 1 || weeksBack > 26) {
        throw new SystemRuntimeErrorException(SystemMessage.error("CHARACTER_RUN_RANGE_INVALID").build(), HttpStatus.BAD_REQUEST);
    }
    LocalDate current = weekStart(today);
    LocalDate from = current.minusWeeks(weeksBack - 1L);
    Map<UUID, CharacterDimensionEntity> dims = new HashMap<>();
    dimensions.findByCreatedBy(owner).forEach(d -> dims.put(d.getId(), d));
    Map<LocalDate, List<CharacterMaturityPoint>> byWeek = new TreeMap<>();
    for (var row : weeks.findByCreatedByAndWeekStartBetweenOrderByWeekStartAsc(owner, from, current.minusWeeks(1))) {
        var dim = dims.get(row.getDimensionId());
        if (dim == null) continue; // dimension soft-deleted: its FK row survives, its identity does not
        byWeek.computeIfAbsent(row.getWeekStart(), w -> new ArrayList<>())
              .add(point(dim, row.getMaturity(), row.getClaimCount()));
    }
    List<CharacterMaturityWeek> out = new ArrayList<>();
    byWeek.forEach((w, pts) -> out.add(CharacterMaturityWeek.builder().weekStart(w).live(false).dimensions(pts).build()));
    List<CharacterMaturityPoint> live = new ArrayList<>();
    for (var dim : dims.values()) {
        var active = claims.findByCreatedByAndDimensionIdAndStatusOrderByConfidenceDesc(owner, dim.getId(), ACTIVE);
        live.add(point(dim, MaturityFormula.compute(active), (short) active.size()));
    }
    live.sort(Comparator.comparing(CharacterMaturityPoint::getKey));
    out.add(CharacterMaturityWeek.builder().weekStart(current).live(true).dimensions(live).build());
    return CharacterMaturityHistory.builder().weeks(out).build();
}

private static CharacterMaturityPoint point(CharacterDimensionEntity d, short maturity, short claimCount) {
    return CharacterMaturityPoint.builder().key(d.getKey()).title(d.getTitle()).expertKey(d.getExpertKey())
            .maturity((int) maturity).claimCount((int) claimCount).build();
}
```
In the controller, inject `CharacterMaturityService` and `CharacterCouncilProperties` (already present):
```java
@Override
public CharacterMaturityHistory getMaturityHistory(Integer weeks) {
    characterService.overview(currentUserId.get()); // lazily seeds the core dimensions, as the overview read does
    return maturityService.history(currentUserId.get(),
            LocalDate.now(ZoneId.of(councilProperties.zone())), weeks == null ? 8 : weeks);
}
```
If seeding through `overview` is too heavy, call `characterService.ensureCoreDimensions(owner)`
when it is reachable (make it package-private or public). Check the generated method signature in
`CharacterApi` before writing this.

- [ ] **Step 4: Run** `./mvnw -q test -Dtest='CharacterMaturityIT,CharacterApiIT,CharacterApiSwitchOffIT'`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(api): character maturity history read (mezo-a9bo7.11)`

### Task 4: FE data layer

**Files:**
- Modify: `frontend/src/data/character/characterApi.ts` (types + `maturityHistory`)
- Modify: `frontend/src/data/character/characterMock.ts` (`MOCK_MATURITY_HISTORY: CharacterMaturityHistory = { weeks: [] }`)
- Modify: `frontend/src/data/character/characterHooks.ts` (`useMaturityHistory`)
- Modify: `frontend/src/data/hooks.ts` (re-export), and `hooks.reexport.test.ts` if it lists names

```ts
export type CharacterMaturityHistory = components['schemas']['CharacterMaturityHistory']
export type CharacterMaturityWeek = components['schemas']['CharacterMaturityWeek']
maturityHistory: (weeks = 8): Promise<CharacterMaturityHistory> =>
  apiFetch<CharacterMaturityHistory>(`${BASE}/maturity-history?weeks=${weeks}`),
```
```ts
/** Heti érettség-történet (mezo-a9bo7.11): tárolt hetek + az élő aktuális hét. Mock: üres —
 *  a mock overview is üresen indul, a kettő így nem mond ellent egymásnak. */
export function useMaturityHistory(): { history: CharacterMaturityHistory; isLoading: boolean } {
  const { data, isPending } = useDualQuery<CharacterMaturityHistory>({
    queryKey: ['characterMaturityHistory'],
    mockData: MOCK_MATURITY_HISTORY,
    realFetch: () => characterApi.maturityHistory(8),
    realEmpty: { weeks: [] },
    realStaleTime: DEFAULT_QUERY_STALE_TIME_MS,
  })
  return { history: data, isLoading: isPending }
}
```
Commit it together with Task 5.

### Task 5: Room series logic + `MaturityWell`

**Files:**
- Modify: `frontend/src/features/insights/logic/teamRooms.ts` (remove `weeklyGrowth`; add `roomMaturitySeries`, `maturityDropNote`; `growthPoints` null-aware)
- Modify: `frontend/src/features/insights/logic/teamRooms.test.ts`
- Modify: `frontend/src/features/insights/pages/CharacterRoomPage.tsx` (export `MaturityWell`)
- Modify: `frontend/src/features/insights/pages/CharacterRoomPage.test.tsx`
- Modify: `frontend/src/features/insights/boop-world.css` (`.tf-dot`)

**Interfaces:**
- Produces:
  - `roomMaturitySeries(history: CharacterMaturityHistory, id: TeamCharacterId, slots = 8): (number | null)[]`
  - `maturityDropNote(history: CharacterMaturityHistory, id: TeamCharacterId): string | null`
  - `growthPoints(series: (number | null)[]): ([number, number] | null)[]`

- [ ] **Step 1: Failing logic tests**

```ts
const wk = (weekStart: string, dims: [string, string | null, number, number][], live = false) => ({
  weekStart, live, dimensions: dims.map(([key, expertKey, maturity, claimCount]) => ({ key, title: key === 'athletic' ? 'Sport' : 'Fegyelem', expertKey, maturity, claimCount })),
})
test('roomMaturitySeries: 8 naptári hét, hiányzó hét null, a szoba a dimenziói átlaga', () => {
  const h = { weeks: [
    wk('2026-08-31', [['athletic', 'edzo', 40, 2], ['discipline', 'drill', 20, 1]]),
    wk('2026-09-14', [['athletic', 'edzo', 60, 3], ['discipline', 'drill', 40, 2], ['recovery', 'szomnologus', 90, 4]]),
    wk('2026-09-21', [['athletic', 'edzo', 70, 3], ['discipline', 'drill', 40, 2]], true),
  ] }
  expect(roomMaturitySeries(h, 'mocor')).toEqual([null, null, null, null, 30, null, 50, 55])
  expect(roomMaturitySeries(h, 'falat')).toEqual([null, null, null, null, null, null, null, null])
})
test('maturityDropNote: állítás-szám esés → "kikerült", egyébként bizonyosság; emelkedésnél null', () => {
  const drop = { weeks: [wk('2026-09-14', [['athletic', 'edzo', 60, 3], ['discipline', 'drill', 40, 2]]),
                         wk('2026-09-21', [['athletic', 'edzo', 40, 2], ['discipline', 'drill', 40, 2]], true)] }
  expect(maturityDropNote(drop, 'mocor')).toBe('Sport: 1 állítás kikerült a képből, ezért halványult.')
  const conf = { weeks: [wk('2026-09-14', [['athletic', 'edzo', 60, 3]]), wk('2026-09-21', [['athletic', 'edzo', 52, 3]], true)] }
  expect(maturityDropNote(conf, 'mocor')).toBe('Sport: a meglévő állítások bizonyossága csökkent.')
  const up = { weeks: [wk('2026-09-14', [['athletic', 'edzo', 40, 2]]), wk('2026-09-21', [['athletic', 'edzo', 60, 3]], true)] }
  expect(maturityDropNote(up, 'mocor')).toBeNull()
})
test('growthPoints: null pont null marad, a skála a meglévő értékekből', () => {
  expect(growthPoints([null, 10, 30])).toEqual([null, [14 + 38.6, 46], [14 + 2 * 38.6, 16]])
})
```
Remove the old `weeklyGrowth` test and adapt the `growthPoints` assertions it contained.

- [ ] **Step 2: Implement**

```ts
const ISO_WEEK_MS = 7 * 86_400_000

function roomValue(week: CharacterMaturityWeek, id: TeamCharacterId): number | null {
  const ds = week.dimensions.filter(d => characterForPersona(d.expertKey ?? '') === id)
  return ds.length ? Math.round(ds.reduce((s, d) => s + d.maturity, 0) / ds.length) : null
}

/** Így érik a képe: a szoba heti érettsége, 8 naptári hét (legrégebbi → e hét). Hiányzó hét =
 *  null — sosem kitöltve, sosem nulla (ADR 0049, mezo-a9bo7.11). */
export function roomMaturitySeries(history: CharacterMaturityHistory, id: TeamCharacterId, slots = 8): (number | null)[] {
  const out = new Array<number | null>(slots).fill(null)
  const last = history.weeks[history.weeks.length - 1]
  if (!last) return out
  const end = Date.parse(`${last.weekStart}T12:00:00Z`)
  for (const w of history.weeks) {
    const idx = slots - 1 - Math.round((end - Date.parse(`${w.weekStart}T12:00:00Z`)) / ISO_WEEK_MS)
    if (idx >= 0 && idx < slots) out[idx] = roomValue(w, id)
  }
  return out
}

/** A csendes felirat: ha a szoba legutóbbi értéke az előzőnél lejjebb van, a legtöbbet eső témát
 *  nevezi meg — kevesebb állítás vagy csökkent bizonyosság. Nincs értesítés, nincs poszt. */
export function maturityDropNote(history: CharacterMaturityHistory, id: TeamCharacterId): string | null {
  const own = history.weeks
    .map(w => ({ w, v: roomValue(w, id) }))
    .filter((x): x is { w: CharacterMaturityWeek; v: number } => x.v !== null)
  if (own.length < 2) return null
  const [prev, cur] = own.slice(-2)
  if (cur.v >= prev.v) return null
  let worst: { title: string; delta: number; lost: number } | null = null
  for (const d of cur.w.dimensions.filter(d => characterForPersona(d.expertKey ?? '') === id)) {
    const before = prev.w.dimensions.find(p => p.key === d.key)
    if (!before) continue
    const delta = before.maturity - d.maturity
    if (delta > 0 && (!worst || delta > worst.delta)) worst = { title: d.title, delta, lost: before.claimCount - d.claimCount }
  }
  if (!worst) return null
  return worst.lost > 0
    ? `${worst.title}: ${worst.lost} állítás kikerült a képből, ezért halványult.`
    : `${worst.title}: a meglévő állítások bizonyossága csökkent.`
}

export function growthPoints(series: (number | null)[]): ([number, number] | null)[] {
  const vals = series.filter((v): v is number => v !== null)
  const mn = Math.min(...vals), mx = Math.max(...vals), sp = (mx - mn) || 1
  return series.map((v, j) => (v === null ? null : [14 + j * 38.6, 46 - ((v - mn) / sp) * 30]))
}
```

- [ ] **Step 3: `MaturityWell`** (replaces `GrowthWell` in `CharacterRoomPage.tsx`)

```tsx
const LINE_MIN_POINTS = 4

/** Így érik a képe rólad (mezo-a9bo7.11): 4 pont alatt pöttyök + őszinte szöveg, onnan vonal;
 *  hiányzó hétnél a vonal megszakad. Az utolsó pont = a gyűrű (élő hét). */
export function MaturityWell({ series, note }: { series: (number | null)[]; note: string | null }) {
  const count = series.filter(v => v !== null).length
  if (count === 0) {
    return <p className="tf-note">Most kezdtem el hétről hétre feljegyezni, mennyire ismerlek — jövő héttől itt látod.</p>
  }
  const pts = growthPoints(series)
  const segments: string[] = []
  let cur = ''
  pts.forEach(p => {
    if (!p) { if (cur) segments.push(cur); cur = ''; return }
    cur += `${cur ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)} `
  })
  if (cur) segments.push(cur)
  const lastIdx = pts.map(p => p !== null).lastIndexOf(true)
  const last = pts[lastIdx]!
  const latest = series[lastIdx]!
  const drawLine = count >= LINE_MIN_POINTS
  return (
    <>
      <div className="tf-matwell" data-testid="room-growth" data-state={drawLine ? 'line' : 'dots'}>
        <svg viewBox="0 0 330 60" className="tf-chart" aria-hidden="true">
          <path className="tf-grid" d="M14 50 H316" />
          {drawLine && segments.map((d, i) => {
            const xs = d.trim().split(' ').map(s => s.slice(1).split(',')[0])
            return (
              <g key={i}>
                <path className="tf-marea" d={`${d}L${xs[xs.length - 1]},50 L${xs[0]},50 Z`} />
                <path className="tf-l1 tf-draw" pathLength={100} d={d.trim()} />
              </g>
            )
          })}
          {!drawLine && pts.map((p, j) => p && j !== lastIdx && (
            <circle key={j} className="tf-dot" cx={p[0].toFixed(1)} cy={p[1].toFixed(1)} r="3" />
          ))}
          <circle className="tf-pt" cx={last[0].toFixed(1)} cy={last[1].toFixed(1)} r="4.5" />
        </svg>
        <span className="tf-matnow">{latest}%</span>
        <span className="tf-matcap"><em>8 hete</em><em>e hét</em></span>
      </div>
      {!drawLine && <p className="tf-note">Most kezdtem el hétről hétre feljegyezni, mennyire ismerlek — a 4. héttől vonal köti össze a pontokat.</p>}
      {note && <p className="tf-note tf-end" data-testid="room-growth-note">{note}</p>}
    </>
  )
}
```
In `Room`:
```tsx
const { history, isLoading: historyLoading } = useMaturityHistory()
// ... include historyLoading in the skeleton guard
const series = roomMaturitySeries(history, id)
const note = maturityDropNote(history, id)
const hint = series[7] !== null && series[4] !== null ? `${series[7]! - series[4]! >= 0 ? '+' : ''}${series[7]! - series[4]!}% · 3 hét` : null
<div className="tf-sec"><h2>Így érik a képe rólad</h2>{hint && <span className="tf-hint">{hint}</span>}</div>
<MaturityWell series={series} note={note} />
```
CSS in `boop-world.css`, next to `.tf-matwell .tf-pt`:
```css
.tf-matwell .tf-dot { fill: color-mix(in srgb, var(--c) 55%, transparent); }
```

- [ ] **Step 4: Page tests.** Update the heading order test to `'Így érik a képe rólad'`. Replace the
  old growth test with:
  - mock mode, the history is empty: the text "jövő héttől itt látod" is shown and `room-growth` is absent;
  - `MaturityWell` rendered directly:
    - `[null,null,null,null,null,40,null,55]` gives `data-state="dots"`, no `path.tf-l1`, the early text, and `55%`;
    - `[10,20,30,null,40,50,60,70]` gives `data-state="line"` with two `path.tf-l1` segments;
    - `note="X"` renders `room-growth-note`.

- [ ] **Step 5: Run** (from `frontend/`):
  `CI=true VITE_USE_MOCK=true pnpm vitest run src/features/insights src/data` and
  `CI=true VITE_USE_MOCK=false pnpm vitest run src/features/insights src/data`. Expected: PASS.
- [ ] **Step 6: Commit** `feat(insights): room curve reads the real weekly maturity (mezo-a9bo7.11)`

### Task 6: Docs, CODEMAP, gates, merge, deploy

- [ ] `docs/features/insights.md` rooms section: replace the post-count curve text with the maturity
  curve (source, the ladder, the drop note).
- [ ] `docs/features/character.md` §4 data model: add `character_maturity_week`, `MaturityFormula`
  as the single definition, reads computed live, the nightly job and its switch, and the new endpoint.
- [ ] `node scripts/gen-codemap.mjs` (then `--check`).
- [ ] Gates:
  - backend: `./mvnw -q test -Dtest='*Character*IT,*Konzilium*IT,ClaimLifecycleIT,PortraitWriterNameIT,MaturityFormulaTest,ArchitectureTest'`;
  - `node scripts/lint-liquibase.mjs`;
  - FE: full `pnpm test` in both modes (CI=true) plus `pnpm build`, and `pnpm typecheck` if present;
  - contract drift: regenerate and `git diff --exit-code`.
- [ ] Merge: `git fetch && git rebase origin/main`, regenerate the CODEMAP, then
  `git checkout --detach origin/main && git merge --no-ff feat/csapatfal-erettseg-gorbe && git push origin HEAD:main`.
- [ ] Watch the `ci.yml` and deploy runs on main. Close `mezo-a9bo7.11`, back up the beads, push.

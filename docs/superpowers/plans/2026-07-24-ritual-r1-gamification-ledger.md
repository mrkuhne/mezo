# Ritual R1 — Gamification Ledger Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The account-wide gamification backend (`mezo-huzd`): coins/streak/titles become real, server-side and honest — and `GET /api/gamification/day/{date}` becomes the ritual's Harvest read.

**Architecture:** No duplicate XP table — `level_up_event` IS the XP ledger (spec D6); it gains a business-date column (`occurred_on`). A new `feature/gamification` package owns `gamification_profile` + `coin_event` + `owned_title`, serves profile/day/title/saver endpoints, and awards coins through an `AccountProgressPort` hook called from `ProgressionService.award()`'s tail (quest +10/+20, level-up +50, streak milestones; saver auto-consume). Streak state rolls over at award time; the READ projects it honestly. FE hooks swap real with unchanged signatures. Spec: `docs/superpowers/specs/2026-07-24-daily-closing-ritual-design.md` §6.

**Tech Stack:** Java 21, Spring Boot 4.x, Maven, PostgreSQL 16 (Liquibase), OpenAPI contract-first, React 19 + TanStack Query dual-mode hooks.

**bd:** `mezo-huzd` (claim: `bd update mezo-huzd --claim`). **Branch:** `feat/gamification-ledger` off current `main`.

## Global Constraints

- Same house rules as every backend slice: base package `io.mrkuhne.mezo`; contract-first (`api_contract_conventions.md`); UUID PKs + soft delete; migration naming `{ts}_mezo-huzd_{desc}.sql` with explicit constraint names; `@Validated` `*Properties` (never `@Value`); `SystemMessage` errors; integration-first tests on real Postgres; new tables → `ResetDatabase`; ALWAYS `./mvnw clean test` with FOCUSED `-Dtest`; CI is the full gate.
- FE: hooks change behavior, **not signatures** (`useGamification`/`useTitles`/`useGamificationActions`); dual-mode invariant — real mode never falls back to the mock seed; both `pnpm test` modes must stay green.
- Numbers are LAW (must match the FE mock store, which stays for mock mode): saver 200 🪙 max 2; level-up +50; milestones 7/30/100 → +50/+150/+500; quest +10, all-3 +20; account curve `xpToNext(n) = 80 + 40·(n−1)`; title catalog keys/prices exactly as `frontend/src/data/gamification/titleCatalog.ts`.
- ADR 0010: coins celebrate, never punish — a broken streak resets quietly, no negative events (the only negative `amount` rows are purchases).
- Hand-off notes honored (bd `mezo-huzd`): business date drives streak/day-aggregation; the streak chip must be honest on read; quest coins are entirely backend-side.

---

### Task 1: API contract fragment + type generation

**Files:**
- Create: `api/feature/gamification/gamification.yml`
- Modify (generated): `api/openapi.yml`, `frontend/src/data/_client/api.gen.ts`

**Interfaces:**
- Produces: generated `GamificationApi` + DTOs `GamificationProfileResponse`, `GamificationDayResponse`, `XpBySource`, `CoinEventResponse` in `io.mrkuhne.mezo.api`; FE types in `api.gen.ts`.

- [ ] **Step 1: Write the fragment** (copy the `SystemMessageList` ref idiom from `api/feature/intention/intention.yml`):

```yaml
openapi: 3.0.3
info: { title: mezo gamification fragment, version: 1.0.0 }
paths:
  /api/gamification/profile:
    get:
      tags: [Gamification]
      operationId: getGamificationProfile
      summary: Account XP/level/coins/streak/titles (Gamification)
      responses:
        '200':
          description: The account profile (ghost-shaped zeros before any activity)
          content:
            application/json:
              schema: { $ref: '#/components/schemas/GamificationProfileResponse' }
  /api/gamification/day/{date}:
    get:
      tags: [Gamification]
      operationId: getGamificationDay
      summary: The day's XP-by-source + coin events + streak — the ritual Harvest read (Gamification)
      parameters:
        - { name: date, in: path, required: true, schema: { type: string, format: date } }
      responses:
        '200':
          description: Day aggregate (honest zeros, never 404)
          content:
            application/json:
              schema: { $ref: '#/components/schemas/GamificationDayResponse' }
  /api/gamification/title/{key}/buy:
    post:
      tags: [Gamification]
      operationId: buyTitle
      summary: Buy a shop title (auto-equips) (Gamification)
      parameters:
        - { name: key, in: path, required: true, schema: { type: string } }
      responses:
        '200':
          description: Updated profile
          content:
            application/json:
              schema: { $ref: '#/components/schemas/GamificationProfileResponse' }
        '404': { description: GAMIFICATION_TITLE_UNKNOWN, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
        '409': { description: GAMIFICATION_TITLE_OWNED / GAMIFICATION_COINS_INSUFFICIENT / GAMIFICATION_TITLE_NOT_SHOP, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
  /api/gamification/title/{key}/equip:
    post:
      tags: [Gamification]
      operationId: equipTitle
      summary: Equip an owned/unlocked title (Gamification)
      parameters:
        - { name: key, in: path, required: true, schema: { type: string } }
      responses:
        '200':
          description: Updated profile
          content:
            application/json:
              schema: { $ref: '#/components/schemas/GamificationProfileResponse' }
        '404': { description: GAMIFICATION_TITLE_UNKNOWN, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
        '409': { description: GAMIFICATION_TITLE_LOCKED, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
  /api/gamification/saver/buy:
    post:
      tags: [Gamification]
      operationId: buyStreakSaver
      summary: Buy a streak saver (200 coins, max 2 held) (Gamification)
      responses:
        '200':
          description: Updated profile
          content:
            application/json:
              schema: { $ref: '#/components/schemas/GamificationProfileResponse' }
        '409': { description: GAMIFICATION_COINS_INSUFFICIENT / GAMIFICATION_SAVER_LIMIT, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
components:
  schemas:
    GamificationProfileResponse:
      type: object
      required: [totalXp, level, xpInLevel, xpForNext, coins, streakDays, streakAlive, streakSavers, equippedTitleKey, ownedTitleKeys]
      properties:
        totalXp: { type: integer, format: int64 }
        level: { type: integer }
        xpInLevel: { type: integer, format: int64 }
        xpForNext: { type: integer, format: int64 }
        coins: { type: integer }
        streakDays: { type: integer }
        streakAlive: { type: boolean }
        streakSavers: { type: integer }
        equippedTitleKey: { type: string }
        ownedTitleKeys: { type: array, items: { type: string }, description: "shop titles bought (ladder unlocks are level-derived)" }
    XpBySource:
      type: object
      required: [source, xp]
      properties:
        source: { type: string, description: "GYM|RUN|SPORT|QUEST|ACTIVITY|HABIT" }
        xp: { type: integer, format: int64 }
    CoinEventResponse:
      type: object
      required: [reason, amount]
      properties:
        reason: { type: string, description: "quest|all3|level_up|streak_7|streak_30|streak_100|saver_used|purchase" }
        amount: { type: integer }
    GamificationDayResponse:
      type: object
      required: [date, xpBySource, xpTotal, coinEvents, coinTotal, streakDays, streakAlive]
      properties:
        date: { type: string, format: date }
        xpBySource: { type: array, items: { $ref: '#/components/schemas/XpBySource' } }
        xpTotal: { type: integer, format: int64 }
        coinEvents: { type: array, items: { $ref: '#/components/schemas/CoinEventResponse' } }
        coinTotal: { type: integer }
        streakDays: { type: integer }
        streakAlive: { type: boolean }
```

- [ ] **Step 2: Merge + regenerate; verify backend generation**

```bash
cd api/generate && npm run generate:api
cd ../../frontend && pnpm generate:api
cd ../backend && ./mvnw clean generate-sources -q
```
Expected: BUILD SUCCESS; `GamificationApi.java` generated.

- [ ] **Step 3: Commit**

```bash
git add api/ frontend/src/data/_client/api.gen.ts
git commit -m "feat(api): gamification contract — profile, day aggregate, titles, saver (mezo-huzd)"
```

---

### Task 2: Migrations + entities + repositories

**Files:**
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202607241100_mezo-huzd_create_gamification.sql`
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202607241130_mezo-huzd_level_up_event_occurred_on.sql`
- Modify: `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/gamification/entity/{GamificationProfileEntity,CoinEventEntity,OwnedTitleEntity}.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/gamification/repository/{GamificationProfileRepository,CoinEventRepository,OwnedTitleRepository}.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/progression/entity/LevelUpEventEntity.java` (+ `occurredOn`)
- Modify: `backend/src/test/java/io/mrkuhne/mezo/support/ResetDatabase.java` (prepend `gamification_profile, coin_event, owned_title, `)
- Create: `backend/src/test/java/io/mrkuhne/mezo/support/populator/GamificationPopulator.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/gamification/GamificationEntityIT.java`

**Interfaces:**
- Produces:
  - `GamificationProfileEntity { UUID id; int coins; int streakDays; int streakSavers; String equippedTitleKey; LocalDate lastStreakDate (nullable); int accountLevel }`
  - `CoinEventEntity { UUID id; String reason; int amount; String sourceRefId; LocalDate occurredOn }`
  - `OwnedTitleEntity { UUID id; String titleKey; Instant acquiredAt }`
  - Repos: `GamificationProfileRepository.findByCreatedBy(UUID): Optional<…>`; `CoinEventRepository.findByCreatedByAndOccurredOnOrderByCreatedAtAsc(UUID, LocalDate): List<…>` + `existsByCreatedByAndReasonAndSourceRefId(UUID, String, String): boolean`; `OwnedTitleRepository.findByCreatedBy(UUID): List<…>` + `existsByCreatedByAndTitleKey(UUID, String): boolean`
  - `LevelUpEventEntity.occurredOn: LocalDate` + `LevelUpEventRepository.findByCreatedByAndOccurredOn(UUID, LocalDate): List<LevelUpEventEntity>` and `@Query("select distinct e.occurredOn from LevelUpEventEntity e where e.createdBy = :createdBy order by e.occurredOn desc") findDistinctOccurredOnDesc(UUID): List<LocalDate>`
  - `GamificationPopulator.profile(UUID owner, int coins, int streakDays, int savers, LocalDate lastStreakDate): GamificationProfileEntity`

- [ ] **Step 1: Gamification tables migration** (`202607241100_…_create_gamification.sql`; copy the changeset header format from the newest sibling script):

```sql
-- Account gamification ledger (mezo-huzd): profile state + coin events + bought shop titles.
create table gamification_profile (
    id                 uuid        not null default gen_random_uuid(),
    created_by         uuid        not null,
    is_deleted         boolean     not null default false,
    created_at         timestamptz not null default now(),
    coins              int         not null default 0,
    streak_days        int         not null default 0,
    streak_savers      int         not null default 0,
    equipped_title_key varchar(40) not null default 'ujonc',
    last_streak_date   date,
    account_level      int         not null default 1,
    constraint pk_gamification_profile primary key (id),
    constraint fk_gamification_profile_created_by_app_user_id
        foreign key (created_by) references app_user (id) on delete cascade,
    constraint ck_gamification_profile_savers check (streak_savers between 0 and 2)
);
create unique index uq_gamification_profile_user
    on gamification_profile (created_by) where is_deleted = false;

create table coin_event (
    id            uuid        not null default gen_random_uuid(),
    created_by    uuid        not null,
    is_deleted    boolean     not null default false,
    created_at    timestamptz not null default now(),
    reason        varchar(16) not null,
    amount        int         not null,
    source_ref_id varchar(64) not null,
    occurred_on   date        not null,
    constraint pk_coin_event primary key (id),
    constraint fk_coin_event_created_by_app_user_id
        foreign key (created_by) references app_user (id) on delete cascade,
    constraint ck_coin_event_reason check (reason in
        ('quest','all3','level_up','streak_7','streak_30','streak_100','saver_used','purchase'))
);
create unique index uq_coin_event_user_reason_ref
    on coin_event (created_by, reason, source_ref_id) where is_deleted = false;
create index idx_coin_event_user_day
    on coin_event (created_by, occurred_on) where is_deleted = false;

create table owned_title (
    id          uuid        not null default gen_random_uuid(),
    created_by  uuid        not null,
    is_deleted  boolean     not null default false,
    created_at  timestamptz not null default now(),
    title_key   varchar(40) not null,
    acquired_at timestamptz not null default now(),
    constraint pk_owned_title primary key (id),
    constraint fk_owned_title_created_by_app_user_id
        foreign key (created_by) references app_user (id) on delete cascade
);
create unique index uq_owned_title_user_key
    on owned_title (created_by, title_key) where is_deleted = false;
```

- [ ] **Step 2: `level_up_event.occurred_on` migration** (`202607241130_…`; additive — released changesets untouched):

```sql
-- Business date for streak/day aggregation (mezo-huzd, spec D7). Backfill: the event's wall-clock date.
alter table level_up_event add column occurred_on date;
update level_up_event set occurred_on = (occurred_at at time zone 'Europe/Budapest')::date;
alter table level_up_event alter column occurred_on set not null;
create index idx_level_up_event_user_day
    on level_up_event (created_by, occurred_on) where is_deleted = false;
```

- [ ] **Step 3: Entities/repos.** Model all three entities on `RitualDayEntity`'s shape (OwnedEntity + `@SQLDelete`/`@SQLRestriction` + explicit `@Column(name=…)`); fields/finders exactly as the **Interfaces** block above. Add to `LevelUpEventEntity`:

```java
    @NotNull
    @Column(name = "occurred_on", nullable = false)
    private LocalDate occurredOn;
```

and the two new finders to `LevelUpEventRepository` (Interfaces block).

- [ ] **Step 4: Populator + ResetDatabase + entity IT.** Populator per the Interfaces block (mirror `RitualPopulator`'s form). Entity IT: profile round-trip + soft-delete hide; coin-event uniqueness — inserting the same `(reason, sourceRefId)` twice must throw `DataIntegrityViolationException`:

```java
@Test
void testCoinEvent_shouldRejectDuplicate_whenSameReasonAndRef() {
    gamificationPopulator.coinEvent(ownerId(), "quest", 10, "q-1", LocalDate.now());
    assertThatThrownBy(() ->
        gamificationPopulator.coinEvent(ownerId(), "quest", 10, "q-1", LocalDate.now()))
        .isInstanceOf(DataIntegrityViolationException.class);
}
```

(Add the matching `coinEvent(...)` factory to the populator: sets all five fields, `saveAndFlush`.)

Run: `cd backend && ./mvnw clean test -Dtest='GamificationEntityIT' -DargLine=-Xmx3g`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src
git commit -m "feat(gamification): ledger tables + level_up_event business date (mezo-huzd)"
```

---

### Task 3: Business dates through the award tail + `AccountProgressPort`

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/progression/service/ProgressionService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/progression/quest/QuestSignal.java`, `…/activity/ActivitySignal.java`, `…/habit/HabitSignal.java` (+ `LocalDate occurredOn` component)
- Modify: the signal construction sites — `feature/quest/service/QuestService.java` (pass `quest.getQuestDate()`), `feature/activity/service/ActivityService.java` (pass the entry's `occurredOn`), `feature/habit/service/HabitService.java` (pass the habit date). Find them: `grep -rn "new QuestSignal\|new ActivitySignal\|new HabitSignal" backend/src/main`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/progression/AccountProgressPort.java`
- Test: extend `backend/src/test/java/io/mrkuhne/mezo/feature/progression/ProgressionHabitIT.java` (occurred_on assertion)

**Interfaces:**
- Produces:
  - `AccountProgressPort { void onXpAwarded(UUID createdBy, String sourceType, UUID sourceRefId, LocalDate occurredOn); }` — implemented in Task 5; consumed via `ObjectProvider` (absent bean → no-op).
  - `award(...)` signature gains `LocalDate occurredOn` (GYM/RUN/SPORT call sites pass `LocalDate.now()`).

- [ ] **Step 1: Failing test** — in `ProgressionHabitIT` (matching its style) assert the business date lands:

```java
@Test
void testApplyHabit_shouldStampBusinessDate_whenAwarded() {
    LocalDate businessDate = LocalDate.now().minusDays(1);
    progressionService.applyHabit(ownerId(),
        new HabitSignal(UUID.randomUUID(), "mindset", 10, "Napzárás", businessDate));
    var events = levelUpEventRepository.findByCreatedByAndOccurredOn(ownerId(), businessDate);
    assertThat(events).hasSize(1);
}
```

Run: `cd backend && ./mvnw clean test -Dtest='ProgressionHabitIT' -DargLine=-Xmx3g`
Expected: FAIL (compile error — the record has no date component yet).

- [ ] **Step 2: Implement.** Add `LocalDate occurredOn` as the LAST component of the three signal records; thread it through: each `apply*` passes `signal.occurredOn()` into `award(...)`; `applyGym`/`applyRun`/`applySport` pass `LocalDate.now()`. In `award(...)`: set `event.setOccurredOn(occurredOn)` before save, and AFTER `levelUpEventRepository.save(event)` (new events only — the idempotent early-return path must NOT re-fire):

```java
        levelUpEventRepository.save(event);
        accountProgressPort.ifAvailable(p ->
            p.onXpAwarded(createdBy, sourceType, sourceRefId, occurredOn));
        return payload;
```

with `private final ObjectProvider<AccountProgressPort> accountProgressPort;` injected. Update every signal construction site found by the grep to pass the owning row's business date (quest → `questDate`, activity → `occurredOn`, habit → the `habit_date`).

- [ ] **Step 3: Run the progression + consumers suite**

Run: `cd backend && ./mvnw clean test -Dtest='Progression*IT,QuestApiIT,Habit*IT' -DargLine=-Xmx3g`
Expected: PASS (no gamification bean yet → the port is a no-op).

- [ ] **Step 4: Commit**

```bash
git add backend/src
git commit -m "feat(progression): business-date on awards + AccountProgressPort hook (mezo-huzd)"
```

---

### Task 4: Title catalog, properties, switch, level curve

**Files:**
- Create: `backend/src/main/resources/content/gamification-titles.json`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/gamification/TitleCatalog.java` (fail-fast loader — copy `PerkCatalog`'s loading idiom)
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/gamification/config/GamificationProperties.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/gamification/AccountLevelCurve.java`
- Modify: `FeaturesConfiguration.java` (+ `GAMIFICATION_SWITCH = "mezo.feature.gamification.enabled"`), `application.yml`, `messages.properties`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/gamification/TitleCatalogIT.java`, unit `AccountLevelCurveTest.java`

**Interfaces:**
- Produces: `TitleCatalog.all(): List<TitleDef(key, name, kind, unlockLevel, priceCoins)>` + `find(String key): Optional<TitleDef>`; `AccountLevelCurve.levelFor(long totalXp): LevelInfo(int level, long xpInLevel, long xpForNext)` (static, `xpToNext(n) = 80 + 40·(n−1)`); `GamificationProperties(saverPrice=200, maxSavers=2, levelUpCoins=50, questCoins=10, all3Coins=20, milestoneCoins={7:50,30:150,100:500})` under `mezo.gamification`.

- [ ] **Step 1:** `gamification-titles.json` — the 16 entries copied EXACTLY from `frontend/src/data/gamification/titleCatalog.ts` (keys, names, kinds, `unlockLevel`s 1/3/5/8/12/16/20/25/30, prices 100/150/240/240/400/400/600). Loader validates: unique keys, LADDER⇔unlockLevel, SHOP⇔priceCoins, default key `ujonc` present — else fail startup.
- [ ] **Step 2:** `AccountLevelCurve` unit-test first (Lv1 at 0 XP; 80 XP → Lv2; the FE mock's 3140 XP → Lv12/60-in-level — the same numbers `levelCurve.test.ts` pins), then implement the loop from `frontend/src/data/gamification/levelCurve.ts` in Java.
- [ ] **Step 3:** Properties record + yml:

```yaml
    # Account gamification ledger (bd mezo-huzd) — coins/streak/titles; off ⇒ /api/gamification 404s,
    # and the AccountProgressPort adapter is absent (progression awards fire no coin hook).
    gamification:
      enabled: true
```
```yaml
  gamification:
    saver-price: 200
    max-savers: 2
    level-up-coins: 50
    quest-coins: 10
    all3-coins: 20
    milestone-coins: { 7: 50, 30: 150, 100: 500 }
```

`messages.properties`: `GAMIFICATION_TITLE_UNKNOWN`, `GAMIFICATION_TITLE_OWNED`, `GAMIFICATION_TITLE_NOT_SHOP`, `GAMIFICATION_TITLE_LOCKED`, `GAMIFICATION_COINS_INSUFFICIENT`, `GAMIFICATION_SAVER_LIMIT` (HU copy, mirror the intention lines' tone).

- [ ] **Step 4:** Run: `cd backend && ./mvnw clean test -Dtest='TitleCatalogIT,AccountLevelCurveTest' -DargLine=-Xmx3g` → PASS. Commit: `git commit -m "feat(gamification): title catalog + account curve + properties (mezo-huzd)"`.

---

### Task 5: `GamificationService` reads + `GamificationAccountAdapter` awards

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/gamification/service/GamificationService.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/gamification/service/GamificationAccountAdapter.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/gamification/controller/GamificationController.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/gamification/{GamificationApiIT,GamificationCoinIT,GamificationStreakIT}.java`

**Interfaces:**
- Consumes: `SkillProgressRepository` (Σ `cumulativeXp` — add `@Query("select coalesce(sum(s.cumulativeXp),0) from SkillProgressEntity s where s.createdBy = :createdBy") long sumCumulativeXp(UUID)`), `LevelUpEventRepository.findByCreatedByAndOccurredOn` + `findDistinctOccurredOnDesc` (Task 2), `AccountProgressPort` (Task 3), `TitleCatalog`/`AccountLevelCurve`/`GamificationProperties` (Task 4).
- Produces: `GamificationService.getProfile(UUID)`, `.getDay(UUID, LocalDate)`, `.buyTitle(UUID, String)`, `.equipTitle(UUID, String)`, `.buySaver(UUID)` — all returning generated DTOs; `GamificationAccountAdapter implements AccountProgressPort`.

**Behavior contract (write the ITs from THIS, test-first):**

1. **Profile read:** `totalXp` = skill-band sum; level trio from `AccountLevelCurve`; profile row absent → ghost zeros + default title `ujonc`, `streakAlive=false`. `streakAlive` = `lastStreakDate != null && !lastStreakDate.isBefore(LocalDate.now().minusDays(1))` — a fresh day still shows yesterday's living streak (honest projection); an older gap shows `streakDays` as stored but `streakAlive=false` (the FE dims the flame).
2. **Day read:** group the date's `level_up_event`s by `sourceType`, sum `totalXp` per group (stable order GYM,RUN,SPORT,QUEST,ACTIVITY,HABIT — skip empty); coin rows listed oldest-first; honest zeros on an empty day.
3. **Adapter `onXpAwarded`** (runs inside the award transaction; every step idempotent):
   - ensure the profile row exists;
   - **streak rollover** when `lastStreakDate` ≠ `occurredOn` and `occurredOn` is today or later than `lastStreakDate`: gap 1 → `streakDays+1`; gap 2 with `streakSavers>0` → consume one, write `coin_event(saver_used, 0, "saver-{occurredOn}")`, `streakDays+1`; else → `streakDays=1`; set `lastStreakDate=occurredOn`; if the new `streakDays` ∈ {7,30,100} → `coin_event(streak_{n}, +{50|150|500}, "streak-{n}-{occurredOn}")` + add coins;
   - **quest coins** when `sourceType=="QUEST"`: `coin_event(quest, +10, sourceRefId)`; if the day now holds exactly 3 QUEST events (`findByCreatedByAndOccurredOn` filtered) → `coin_event(all3, +20, "all3-{occurredOn}")`;
   - **level-up coins:** compute account level from the (already-updated) skill sum; for each level crossed above the stored `accountLevel` → `coin_event(level_up, +50, "level-{n}")`; store the new `accountLevel`;
   - every `coin_event` insert is guarded by `existsByCreatedByAndReasonAndSourceRefId` (the DB partial-unique is the backstop) and `coins` is incremented by the sum actually inserted.
4. **buyTitle:** unknown → 404 `GAMIFICATION_TITLE_UNKNOWN`; LADDER → 409 `GAMIFICATION_TITLE_NOT_SHOP`; owned → 409 `GAMIFICATION_TITLE_OWNED`; `coins < price` → 409 `GAMIFICATION_COINS_INSUFFICIENT`; else: `coin_event(purchase, −price, "buy-{key}")`, insert `owned_title`, auto-equip.
5. **equipTitle:** unknown → 404; LADDER below `unlockLevel` (account level from the sum) or SHOP not owned → 409 `GAMIFICATION_TITLE_LOCKED`; else set `equippedTitleKey`.
6. **buySaver:** `coins < 200` → 409 `GAMIFICATION_COINS_INSUFFICIENT`; `streakSavers >= 2` → 409 `GAMIFICATION_SAVER_LIMIT`; else `coin_event(purchase, −200, "saver-buy-{now-epoch-ms}")` + increment.

- [ ] **Step 1: Write the three failing ITs** covering the contract above. Key cases (name them `test{Method}_should{Result}_when{Condition}`; use `GamificationPopulator` + drive real awards through `ProgressionService.applyQuest`/`applyHabit`):
  - ApiIT: ghost profile; profile after one `applyHabit` (+10 XP → totalXp 10, level 1); day aggregate shows `HABIT: 10` + `xpTotal 10`; buy/equip/saver happy + each error branch (assert the `SystemMessage` codes).
  - CoinIT: one `applyQuest` → `quest +10` coin row + coins 10; re-`applyQuest` same id → still one row (idempotent replay does not re-fire the port); three distinct quests same `occurredOn` → `all3 +20` exactly once; enough XP deltas to cross Lv1→Lv2 (award a 90-XP habit signal) → `level_up +50` once, `accountLevel==2`.
  - StreakIT: awards on D-1 then D → `streakDays 2`, alive; awards on D-3 then D with a held saver → saver consumed (`saver_used` row, savers 1→0) and streak continues; without a saver → reset to 1; 7 consecutive business dates → `streak_7 +50` exactly once; profile read on a fresh day (last award yesterday) → `streakAlive=true` with yesterday's count.

Run: `cd backend && ./mvnw clean test -Dtest='Gamification*IT' -DargLine=-Xmx3g` → FAIL (no beans).

- [ ] **Step 2: Implement** `GamificationService` (reads + 3 mutations, `@ConditionalOnProperty(GAMIFICATION_SWITCH)`, mutations `@Transactional`), `GamificationAccountAdapter implements AccountProgressPort` (same switch gate; `@Transactional(propagation = MANDATORY)` — it must join the award transaction), `GamificationController implements GamificationApi` (thin, `CurrentUserId`, the `RitualController` shape).

- [ ] **Step 3: Run until green**, including the untouched consumers:

Run: `cd backend && ./mvnw clean test -Dtest='Gamification*IT,Progression*IT,QuestApiIT' -DargLine=-Xmx3g` → PASS.

- [ ] **Step 4: Commit**

```bash
git add backend/src
git commit -m "feat(gamification): profile/day reads + coin awards + honest streak (mezo-huzd)"
```

---

### Task 6: Demodata seed

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/gamification/GamificationDemoData.java` (find the existing `@Profile("demodata")` seeder class for the owner user — `grep -rn "demodata" backend/src/main/java --include=*.java -l` — and mirror its registration/ordering pattern)

- [ ] **Step 1:** Seed on startup (owner user only, idempotent — skip when a profile row exists): profile `{coins 240, streakDays 6, streakSavers 1, equippedTitleKey 'fegyelmezett', lastStreakDate yesterday, accountLevel from the seeded skill XP}` — the FE mock seed's numbers, so demo mode and mock mode tell the same story.
- [ ] **Step 2:** Boot check: `cd backend && ./mvnw spring-boot:run -Dspring-boot.run.profiles=demodata` then `curl -s localhost:8090/api/gamification/profile -H "Authorization: Bearer $(…owner token…)"` → coins 240. (Use the login flow from `docs/infrastructure/local-dev-testing.md` for the token; stop the server after.) Commit: `git commit -m "feat(gamification): demodata seed (mezo-huzd)"`.

---

### Task 7: FE swap — real profile/actions + `useGamificationDay`

**Files:**
- Modify: `frontend/src/data/gamification/gamificationApi.ts` (real profile fetch + mutation calls)
- Modify: `frontend/src/data/gamification/gamificationHooks.ts` (real-mode actions, `canMutate: true`)
- Create: `frontend/src/data/gamification/gamificationDayMock.ts` + extend `gamificationTypes.ts` (`GamificationDay` type) + `useGamificationDay` in `gamificationHooks.ts`
- Modify: `frontend/src/data/hooks.ts` (barrel: `useGamificationDay`)
- Test: `frontend/src/data/gamification/gamificationHooks.test.tsx` (extend both modes)

**Interfaces:**
- Consumes: `apiFetch` from `@/data/_client/api` (mirror `progressionApi`'s call idiom); generated types `components['schemas']['GamificationProfileResponse']` etc. from `api.gen.ts`.
- Produces (R3 consumes these exact shapes):
  - `useGamificationDay(date: string): { data: GamificationDay; isPending: boolean }` with `GamificationDay = { date: string; xpBySource: { source: XpEventType; xp: number }[]; xpTotal: number; coinEvents: { reason: string; amount: number }[]; coinTotal: number; streakDays: number; streakAlive: boolean }`; query key `['gamificationDay', date]`.
  - `useGamification()` / `useTitles()` / `useGamificationActions()` — signatures UNCHANGED; in real mode actions call the endpoints and invalidate `['gamification']`.

- [ ] **Step 1: Failing tests first** (extend `gamificationHooks.test.tsx`; mode-stub with `vi.stubEnv` as the sibling tests do): real-mode profile maps the MSW fixture (`coins`, `streakDays`, `equippedTitleKey → activeTitleKey`, `ownedTitleKeys → ownedShopTitleKeys`); real-mode `buyTitle` POSTs and invalidates; mock-mode behavior byte-unchanged (existing tests must keep passing); `useGamificationDay` mock returns the deterministic seed, real maps the fixture. Add MSW handlers next to the existing ones — locate the handler file with `grep -rln "api/progression/profile" frontend/src` and add `/api/gamification/profile`, `/api/gamification/day/:date` fixtures there.

- [ ] **Step 2: Implement.**

`gamificationApi.ts` — replace the derived interim:

```ts
import { apiFetch } from '@/data/_client/api'
import type { components } from '@/data/_client/api.gen'
import type { GamificationDay, GamificationProfile } from '@/data/gamification/gamificationTypes'

type ProfileWire = components['schemas']['GamificationProfileResponse']
type DayWire = components['schemas']['GamificationDayResponse']

const toProfile = (w: ProfileWire): GamificationProfile => ({
  level: w.level,
  totalXp: w.totalXp,
  xpInLevel: w.xpInLevel,
  xpForNext: w.xpForNext,
  coins: w.coins,
  streakDays: w.streakDays,
  streakSavers: w.streakSavers,
  activeTitleKey: w.equippedTitleKey,
  ownedShopTitleKeys: w.ownedTitleKeys,
  lastActiveDate: null,
  dayCounters: { date: '', counts: {} },
})

export const gamificationApi = {
  profile: async () => toProfile(await apiFetch<ProfileWire>('/api/gamification/profile')),
  day: async (date: string): Promise<GamificationDay> => {
    const w = await apiFetch<DayWire>(`/api/gamification/day/${date}`)
    return { date: w.date, xpBySource: w.xpBySource as GamificationDay['xpBySource'],
      xpTotal: w.xpTotal, coinEvents: w.coinEvents, coinTotal: w.coinTotal,
      streakDays: w.streakDays, streakAlive: w.streakAlive }
  },
  buyTitle: (key: string) => apiFetch<ProfileWire>(`/api/gamification/title/${key}/buy`, { method: 'POST' }),
  equipTitle: (key: string) => apiFetch<ProfileWire>(`/api/gamification/title/${key}/equip`, { method: 'POST' }),
  buySaver: () => apiFetch<ProfileWire>('/api/gamification/saver/buy', { method: 'POST' }),
}
```

(Check `data/_client/api.ts` for `apiFetch`'s exact POST idiom — if it takes `(path, init)` differently, adapt; if a 404-ghost guard is the house norm for switch-off — see `fetchDerivedGamification`'s `ApiError` branch — keep returning `GHOST_GAMIFICATION` on 404.) Wire `useGamification`'s `realFetch` to `gamificationApi.profile`; keep `GHOST_GAMIFICATION` as `realEmpty`. In `useGamificationActions`: real mode calls the api then `qc.invalidateQueries({ queryKey: GAMIFICATION_KEY })`; `canMutate: true` in both modes now; mock arm unchanged. `useGamificationDay`: `useDualQuery` with `mockData: mockGamificationDay(date)` (deterministic seed matching the approved Harvest mockup: quests 45, HABIT 35, ACTIVITY 15, GYM 20 → xpTotal 115; coins `quest +10`, `all3 +20`; streak 12 alive) and `realFetch: () => gamificationApi.day(date)`, `realEmpty`: honest zero day.

- [ ] **Step 3: Both modes + build**

Run: `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test`
Expected: green. `TitleShopSheet` needs NO code change (it reads `canMutate`), but if its test asserts the "A bolt a backend-szelettel érkezik." real-mode copy, update that test to the live-shop branch.

- [ ] **Step 4: Commit**

```bash
git add frontend/src
git commit -m "feat(gamification): FE hooks go real — profile, shop, streak saver, day read (mezo-huzd)"
```

---

### Task 8: Feature-doc touch + gates + PR

**Files:**
- Modify: `docs/features/growth.md` (§2 "Account progression": real-mode interim RETIRED — coins/streak/titles/shop real, `fetchDerivedGamification` replaced by `GET /api/gamification/profile`, quest coin rows LIVE; §5 the new `AccountProgressPort` seam), `docs/features/_platform-api-backend.md` if it lists feature packages.

- [ ] **Step 1:** Update docs, run `node scripts/lint-docs.mjs` → clean.
- [ ] **Step 2:** Full local focused gate:

```bash
cd backend && ./mvnw clean test -Dtest='Gamification*IT,Progression*IT,QuestApiIT,Habit*IT' -DargLine=-Xmx3g
cd ../frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test
```

- [ ] **Step 3: Push, self-PR, merge on green**

```bash
git push -u origin feat/gamification-ledger
gh pr create --fill --title "feat(gamification): account ledger backend — coins, honest streak, titles, day aggregate (mezo-huzd)"
# CI green →
git checkout main && git pull --rebase
git merge --no-ff feat/gamification-ledger && git push
bd close mezo-huzd && bd dolt push
```

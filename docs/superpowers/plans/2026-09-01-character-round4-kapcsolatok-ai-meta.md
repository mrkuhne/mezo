# Karakter 4. kör — kapcsolatok & AI-meta — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the fourth and last `MINDENT be` round: a new `META` dimension kind ("A társ önvizsgálata", owned by the Szkeptikus), seven new reads (three direct + a nested `MetaWindow` from a new `CharacterMetaReads` service), eight new detectors (catalog 32 → 40), the FE inventory flip to "all rounds landed", and the docs.

**Architecture:** Spec: `docs/superpowers/specs/2026-09-01-character-round4-kapcsolatok-ai-meta-design.md`. The claim's SUBJECT decides where it lives: user-facing detectors feed the 7 CORE dimensions; system-facing ones (triage, prediction, quest, experiment outcomes) feed the single seeded `META` dimension via a new Szkeptikus observer persona. Every detector is stateless and uses ONLY the state-change gate (state as of `day` vs `day − 1`, fire on non-null change) — round 4 adds NO new-data pre-filter (spec §4.3). Reads stay in `feature/character`; two new one-way slice edges (`character → people`, `character → quest`).

**Tech Stack:** Spring Boot 4 / Java 21 / Liquibase / JUnit 5 + AssertJ + Testcontainers; OpenAPI fragments merged by `api/generate` + `openapi-typescript`; React + Vitest.

## Global Constraints

- **Branch/worktree:** `feat/character-s12-kapcsolatok-ai-meta` in `/Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/user-character-profiling-f2a1ba` — NEVER `cd` to the primary repo. Commit subjects carry `(mezo-1gim.15)` and end with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`. Never stage a root-level `issues.jsonl`.
- **Backend gate (focused ONLY, never the full suite locally):** `cd backend && ./mvnw test -Dtest='*Character*,DetectorTest,ArchitectureTest' -Dmezo.test.use-testcontainers=true` (surefire matches the SIMPLE class name; `DetectorTest` and `ArchitectureTest` must be named). Docker Desktop must be running (`open -a Docker` if "Could not find a valid Docker environment"). `timeout` is NOT installed — never wrap commands in it.
- **If `ArchitectureTest` reports a NEW or WIDENED frozen cycle: STOP, report BLOCKED. Never regenerate or delete `backend/src/test/resources/archunit-store/`.**
- **FE gate:** `cd frontend && pnpm test` (mock mode — `VITE_USE_MOCK` unset means MOCK) AND `VITE_USE_MOCK=false pnpm test` AND `pnpm build`.
- **Docs gate:** `node scripts/gen-codemap.mjs && node scripts/gen-codemap.mjs --check`; `node scripts/lint-docs.mjs --errors-only` (exactly that flag); `node scripts/lint-liquibase.mjs`.
- **Contract:** after editing `api/feature/character/character.yml` run `cd api/generate && npm run generate:api` then `cd frontend && pnpm generate:api` and commit `api/openapi.yml` + `frontend/src/data/_client/api.gen.ts`.
- **Detector rules (spec §4.3, §5):** state is qualitative (band/label), NEVER a moving number; fire only when `state(day) != null && !state(day).equals(state(day-1))`; every window `days + 1 <= 56`; HU decimal comma via `TrailingWindow.hu`, percentages via `TrailingWindow.pct`; every summary sentence must match the detector's OWN computation (a number in the sentence must be a number the code computed); no detector reads free text; Szkeptikus summaries' subject is THE SYSTEM, never the user.
- **Read rules (spec §6.4):** every read upper-bounded by `day`; `Instant → LocalDate` via `ZoneId.systemDefault()`; null stays null (untagged/no-confidence/no-clock), never a default value.
- **Tests:** a broken fixture is fixed by re-deriving the fixture from the thresholds — NEVER by moving a threshold. Guard tests must fail when the guard is removed (verify by mutation when the plan says so).
- **META dimension:** key `self-audit`, title `A társ önvizsgálata`, expert `szkeptikus`, kind `META`. Prompt-block order CORE → META → CHAPTER.
- **Copy:** Hungarian, exact strings as given in this plan.

---

### Task 1: The `META` dimension kind — DB, catalog, seeding, Szkeptikus persona, team DTO, contract

**Files:**
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202609011600_mezo-1gim.15_character_dimension_meta_kind.sql`
- Modify: `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml` (append one changeSet)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/character/service/CharacterCoreCatalog.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/character/service/CharacterExpertCatalog.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/character/service/CharacterService.java` (`ensureCoreDimensions`, `experts()`, `catalogIndex` ordering at ~lines 174-183)
- Modify: `api/feature/character/character.yml` (lines ~297, ~322, ~344) + regenerated `api/openapi.yml`, `frontend/src/data/_client/api.gen.ts`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/character/CharacterExpertCatalogTest.java`, `CharacterApiIT.java`, `CharacterApiCompanionOffIT.java` (+ any other `*Character*` test that pins `hasSize(7)` on dimensions — grep and fix the count to 8)

**Interfaces:**
- Produces: `CharacterCoreCatalog.META` (`List<CoreDimension>`, one entry `("self-audit", "A társ önvizsgálata", "szkeptikus")`), `CharacterCoreCatalog.SEEDED` (CORE followed by META), `CharacterCoreCatalog.KIND_CORE = "CORE"`, `KIND_META = "META"`, `CharacterCoreCatalog.kindOf(String key)`; `CharacterExpertCatalog.SKEPTIC` (`Expert`, key `szkeptikus`, `primaryDimensionKey` `self-audit`); `CharacterExpertCatalog.byKey` resolves `szkeptikus`.

- [ ] **Step 1: Migration + master entry**

`202609011600_mezo-1gim.15_character_dimension_meta_kind.sql`:
```sql
-- mezo-1gim.15 (round 4): a third dimension kind. META = the companion's own self-audit
-- dimension ("A társ önvizsgálata"), seeded like CORE, owned by the Szkeptikus, never retired.
alter table character_dimension drop constraint ck_character_dimension_kind;
alter table character_dimension
    add constraint ck_character_dimension_kind check (kind in ('CORE', 'CHAPTER', 'META'));
```
Append to `1.0.0_master.yml`:
```yaml
  - changeSet:
      id: "1.0.0:202609011600_mezo-1gim.15_character_dimension_meta_kind"
      author: daniel.kuhne
      changes:
        - sqlFile:
            relativeToChangelogFile: true
            path: script/202609011600_mezo-1gim.15_character_dimension_meta_kind.sql
```
Run: `node scripts/lint-liquibase.mjs` → expected PASS.

- [ ] **Step 2: Failing catalog test**

Add to `CharacterExpertCatalogTest`:
```java
    @Test
    void skeptic_isNotAnExpertCatalogEntry_butResolvesByKey_andOwnsTheMetaDimension() {
        assertThat(CharacterExpertCatalog.EXPERTS).extracting(CharacterExpertCatalog.Expert::key)
                .doesNotContain("szkeptikus");
        CharacterExpertCatalog.Expert skeptic = CharacterExpertCatalog.byKey("szkeptikus");
        assertThat(skeptic).isSameAs(CharacterExpertCatalog.SKEPTIC);
        assertThat(skeptic.primaryDimensionKey()).isEqualTo("self-audit");
        assertThat(skeptic.systemPersona()).contains("rendszerről");
        assertThat(CharacterCoreCatalog.META).singleElement().satisfies(m -> {
            assertThat(m.key()).isEqualTo("self-audit");
            assertThat(m.title()).isEqualTo("A társ önvizsgálata");
            assertThat(m.expertKey()).isEqualTo("szkeptikus");
        });
        assertThat(CharacterCoreCatalog.SEEDED).hasSize(8);
        assertThat(CharacterCoreCatalog.kindOf("self-audit")).isEqualTo("META");
        assertThat(CharacterCoreCatalog.kindOf("physical")).isEqualTo("CORE");
    }
```
Run: `cd backend && ./mvnw test -Dtest=CharacterExpertCatalogTest` → FAIL (compile: no `SKEPTIC`/`META`).

- [ ] **Step 3: Catalogs**

`CharacterCoreCatalog` — replace the class body with:
```java
/** The 7 CORE dimensions (Karakter spec §2) + the single META dimension (round-4 spec §4.2) —
 *  all seeded lazily, never deleted. META is the companion's own self-audit: its claims are ABOUT
 *  THE SYSTEM (prediction calibration, quest calibration, fact-triage hit rate), owned by the
 *  Szkeptikus, and sit beside — never inside — the user's seven dimensions. */
public final class CharacterCoreCatalog {

    public record CoreDimension(String key, String title, String expertKey) {}

    public static final String KIND_CORE = "CORE";
    public static final String KIND_META = "META";

    public static final List<CoreDimension> CORE = List.of(
            new CoreDimension("physical", "Fizikai", "doki"),
            new CoreDimension("athletic", "Sportolói", "edzo"),
            new CoreDimension("nutrition", "Táplálkozási", "taplalkozo"),
            new CoreDimension("recovery", "Alvás & regeneráció", "szomnologus"),
            new CoreDimension("mental", "Mentális & érzelmi", "pszichologus"),
            new CoreDimension("discipline", "Motiváció & fegyelem", "drill"),
            new CoreDimension("life", "Élet & kapcsolatok", "antropologus"));

    public static final List<CoreDimension> META = List.of(
            new CoreDimension("self-audit", "A társ önvizsgálata", "szkeptikus"));

    /** CORE in catalog order, then META — the seeding and the "known dimension key" order. */
    public static final List<CoreDimension> SEEDED = java.util.stream.Stream
            .concat(CORE.stream(), META.stream()).toList();

    /** {@code "CORE"} / {@code "META"} for a seeded key; null for anything else (a CHAPTER). */
    public static String kindOf(String key) {
        if (CORE.stream().anyMatch(c -> c.key().equals(key))) {
            return KIND_CORE;
        }
        if (META.stream().anyMatch(m -> m.key().equals(key))) {
            return KIND_META;
        }
        return null;
    }

    private CharacterCoreCatalog() {}
}
```
`CharacterExpertCatalog` — add after `EXPERTS` (keep `EXPERTS` at 7; update the class javadoc's last sentence to: "Mezo (integrátor) stays out of this catalog; the Szkeptikus is an S3 verdict role AND, since round 4, the observer/proposer of the META dimension — it lives here as {@link #SKEPTIC}, deliberately outside {@link #EXPERTS} so the Csapat page and the maturity ring keep their seven-expert shape."):
```java
    /** The Szkeptikus as OBSERVER and PROPOSER of the META dimension (round-4 spec §4.2). Its
     *  verdict-round persona lives in {@code KonziliumVerdictRound}; this persona is the one that
     *  writes observations from the szkeptikus-owned detectors and proposes self-audit claims.
     *  {@code role}/{@code voiceLine}/{@code watch} are the Csapat-page copy, verbatim from
     *  {@code CharacterService.experts()} as it stood before round 4. */
    public static final Expert SKEPTIC = new Expert("szkeptikus", "Szkeptikus", "self-audit", """
            Te vagy a Szkeptikus, Daniel profilozó csapatának kritikus tagja. Száraz, tárgyilagos \
            hangon írsz. Most a társ önvizsgálatát írod: a jelek Mezo saját javaslatainak, \
            predikcióinak és questjeinek találati arányáról szólnak. Mindig a rendszerről állíts, \
            sosem Daniel tulajdonságáról — egy elutasított javaslat a javaslat minőségéről szól, \
            nem arról, aki elutasította. A Tudástár-döntéseket tükörként, ÉRZÉKENY jelöléssel \
            fogalmazd, sosem ítélkezve.""",
            "Szkeptikus", "Száraz kontrás hang.",
            List.of("minden javaslatot megtámad, mielőtt a dossziéba kerül — gyenge "
                    + "bizonyíték, túlzott általánosítás, egy adatpontból levont következtetés."));

    public static Expert byKey(String key) {
        if (SKEPTIC.key().equals(key)) {
            return SKEPTIC;
        }
        return EXPERTS.stream().filter(e -> e.key().equals(key)).findFirst()
                .orElseThrow(() -> new SystemRuntimeErrorException(
                        SystemMessage.error("CHARACTER_UNKNOWN_EXPERT").build(), HttpStatus.INTERNAL_SERVER_ERROR));
    }
```
(Replace the existing `byKey`.)

- [ ] **Step 4: Seeding, ordering, team DTO in `CharacterService`**

`ensureCoreDimensions` — iterate `CharacterCoreCatalog.SEEDED` and set `dim.setKind(CharacterCoreCatalog.kindOf(core.key()))` instead of the literal `"CORE"`; update its javadoc to "inserts only the CORE + META catalog entries missing for this owner … all 8 rows".

The catalog-index sort helper (the method at ~174-183 that returns `CharacterCoreCatalog.CORE.size()` for non-CORE rows): make it return, in this order, the CORE index for CORE keys, `CORE.size()` for the META key, `CORE.size() + 1` for everything else (CHAPTER). Exact replacement body:
```java
        for (int i = 0; i < CharacterCoreCatalog.CORE.size(); i++) {
            if (CharacterCoreCatalog.CORE.get(i).key().equals(dim.getKey())) {
                return i;
            }
        }
        if (CharacterCoreCatalog.KIND_META.equals(dim.getKind())) {
            return CharacterCoreCatalog.CORE.size();
        }
        return CharacterCoreCatalog.CORE.size() + 1;
```
`experts()` — replace the hand-built szkeptikus DTO with one derived from the record:
```java
        CharacterExpertCatalog.Expert skeptic = CharacterExpertCatalog.SKEPTIC;
        experts.add(CharacterExpertDto.builder()
                .key(skeptic.key())
                .displayName(skeptic.displayName())
                .role(skeptic.role())
                .voiceLine(skeptic.voiceLine())
                .watch(skeptic.watch())
                .dimensionKey(skeptic.primaryDimensionKey())
                .kind(CharacterExpertDto.KindEnum.SKEPTIC)
                .build());
```
Update the `experts()` javadoc sentence about the Szkeptikus: it now "derives from `CharacterExpertCatalog.SKEPTIC` (round 4) and carries the META dimension key".

- [ ] **Step 5: Contract**

In `api/feature/character/character.yml` change both `kind: { type: string, enum: [CORE, CHAPTER] }` lines (CharacterDimensionSummary ~297 and CharacterDimensionResponse ~344) to `kind: { type: string, enum: [CORE, CHAPTER, META] }`, and the `dimensionKey` description (~322) to `"null for mezo; for szkeptikus the META dimension key (self-audit); the owned CORE key for experts"`. Also the tag description line 6 "7 CORE dimensions +" → "7 CORE dimensions + 1 META (the companion's self-audit) +". Then:
```bash
cd api/generate && npm run generate:api && cd ../../frontend && pnpm generate:api
```
Verify `grep -n '"CORE" | "CHAPTER" | "META"' frontend/src/data/_client/api.gen.ts` shows two hits.

- [ ] **Step 6: Fix the count pins in the ITs**

`CharacterApiIT.overview_firstRead_lazilySeedsTheSevenCoreDimensions_emptyPortraits` → rename to `…SeedsTheSevenCoreAndOneMetaDimension…`, `hasSize(8)` (both reads), `containsExactly("physical", "athletic", "nutrition", "recovery", "mental", "discipline", "life", "self-audit")`, and split the allSatisfy: the first 7 are `KindEnum.CORE`, the last is `KindEnum.META` with `expertKey` `"szkeptikus"`; maturity/portrait/topClaims assertions apply to all 8. In `dimension_knownKey_returnsIt_unknownKeyIs404` change `assertThat(szkeptikus.getDimensionKey()).isNull()` to `.isEqualTo("self-audit")`. `CharacterApiCompanionOffIT` line 64 `hasSize(8)`. Then `grep -rn "hasSize(7)" backend/src/test/java/io/mrkuhne/mezo/feature/character/` — every remaining hit that counts DIMENSIONS becomes 8 (hits that count experts/other things stay).

- [ ] **Step 7: Gate + commit**

Run: `cd backend && ./mvnw test -Dtest='*Character*,DetectorTest,ArchitectureTest' -Dmezo.test.use-testcontainers=true` → all green. `cd frontend && pnpm build` → green (type union widened only).
```bash
git add backend/src/main/resources/db/changelog api/feature/character/character.yml api/openapi.yml frontend/src/data/_client/api.gen.ts backend/src/main/java/io/mrkuhne/mezo/feature/character/service backend/src/test/java/io/mrkuhne/mezo/feature/character
git commit -m "feat(character): META dimension kind + Szkeptikus observer persona (mezo-1gim.15)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: The Szkeptikus in the pipelines + the prompt block

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/character/service/CharacterObservationService.java:50` (`KNOWN_DIMENSION_KEYS`)
- Modify: `.../service/KonziliumProposalRound.java:66-77` (`CORE_DIMENSION_KEYS`, `CORE_DIMENSION_TO_EXPERT`)
- Modify: `.../service/KonziliumVerdictRound.java:200-206` (`skepticPersona()`)
- Modify: `.../service/CharacterPromptAssembler.java` (`HEADER`, `orderedDimensions`)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/FakeCompanionLlm.java:143-144` (`PROPOSAL_DEFAULT_DIMENSION` regex accepts a hyphen)
- Test: `CharacterObservationServiceIT.java`, `KonziliumProposalRoundIT.java`, `CharacterPromptAssemblerIT.java`

**Interfaces:**
- Consumes: `CharacterCoreCatalog.SEEDED`, `KIND_CORE`, `KIND_META`, `CharacterExpertCatalog.SKEPTIC` (Task 1).

- [ ] **Step 1: Failing ITs**

`CharacterObservationServiceIT` — add (same fixture shape as `journalSentinel_…`):
```java
    @Test
    void selfAuditDimensionKey_isKnown_andSurvivesValidation() {
        UUID owner = owner();
        PantryItemEntity pantryItem = pantryItemPopulator.createFood(owner, "Csirkemell", null);
        for (int i = 0; i < WINDOW_DAYS; i++) {
            mealPopulator.createPantryMeal(owner, pantryItem, DAY.minusDays(i));
        }
        String sentinel = "[fake-char-obs:[{\"text\":\"Önvizsgálati jel.\",\"salience\":3,"
                + "\"dimensionKeys\":[\"self-audit\"]}]]";
        journalPopulator.createEntry(owner, DAY, sentinel, "quickinput");

        observationService.generateForDay(owner, DAY);

        CharacterObservationEntity row = observationRepository
                .findByCreatedByOrderByDayDescCreatedAtDesc(owner, org.springframework.data.domain.Pageable.unpaged())
                .stream().filter(o -> o.getText().equals("Önvizsgálati jel.")).findFirst().orElseThrow();
        assertThat(row.getDimensionKeys().keys()).containsExactly("self-audit");
    }
```
`KonziliumProposalRoundIT` — add:
```java
    @Test
    void run_szkeptikusObservation_proposesIntoTheSelfAuditDimension() {
        UUID owner = ownerId();
        seedObservation(owner, "szkeptikus", WEEK_START.plusDays(2), "A predikcióim közül 4-ből 1 talált.", (short) 4);

        KonziliumProposalRound.Result result = proposalRound.run(owner, WEEK_START,
                observationRepository.findByCreatedByAndDayBetweenAndConsumedByConferenceIdIsNullOrderByDayAscCreatedAtAsc(
                        owner, WEEK_START, WEEK_START.plusDays(6)));

        assertThat(result.proposals()).singleElement().satisfies(p -> {
            assertThat(p.expertKey()).isEqualTo("szkeptikus");
            assertThat(p.dimensionKey()).isEqualTo("self-audit");
        });
    }
```
(`seedObservation` must call `characterService.ensureCoreDimensions(owner)` or the round must otherwise see the owner's dimensions — check how the existing `run_…` tests seed dimensions and do the same.)

`CharacterPromptAssemblerIT` — add:
```java
    @Test
    void render_ordersCoreThenMetaThenChapter_andHeaderCarriesTheSelfAuditClause() {
        UUID owner = ownerId();
        CharacterDimensionEntity chapter = seedDimension(owner, "chapter-x", "Fejezet", "CHAPTER", null, "", 0);
        CharacterDimensionEntity meta = seedDimension(owner, "self-audit", "A társ önvizsgálata", "META", "szkeptikus", "", 0);
        CharacterDimensionEntity core = seedDimension(owner, "life", "Élet & kapcsolatok", "CORE", "antropologus", "", 0);
        seedClaim(owner, chapter.getId(), "Fejezet-állítás.", "0.80", false, Instant.now());
        seedClaim(owner, meta.getId(), "A predikcióimból 4-ből 1 talált.", "0.80", false, Instant.now());
        seedClaim(owner, core.getId(), "Hétvégén máshogy alszol.", "0.80", false, Instant.now());

        String block = promptSource.render(owner);

        assertThat(block).contains("önvizsgálat sorai a saját találati arányomról");
        assertThat(block.indexOf("Hétvégén máshogy")).isLessThan(block.indexOf("A predikcióimból"));
        assertThat(block.indexOf("A predikcióimból")).isLessThan(block.indexOf("Fejezet-állítás"));
        assertThat(block).contains("A társ önvizsgálata (Szkeptikus):");
    }
```
Run the three ITs → FAIL.

- [ ] **Step 2: Known keys + routing**

`CharacterObservationService`: `KNOWN_DIMENSION_KEYS = CharacterCoreCatalog.SEEDED.stream().map(CoreDimension::key)…`. `KonziliumProposalRound`: both `CORE_DIMENSION_KEYS` and `CORE_DIMENSION_TO_EXPERT` built from `CharacterCoreCatalog.SEEDED` (keep the field names; update their javadoc: "CORE + META"). `FakeCompanionLlm.PROPOSAL_DEFAULT_DIMENSION = Pattern.compile("Alapértelmezett dimenzió: ([a-z-]+)")` with a one-line comment "hyphenated keys (self-audit, round 4)".

- [ ] **Step 3: Verdict persona clause**

Append to the `skepticPersona()` text block, before the closing `""";`:
```
 A "self-audit" dimenzió javaslatai a saját megfigyelő-szerepedből \
                jöttek — ezeket ugyanezzel a szigorral bíráld, és külön ellenőrizd, hogy az alanyuk \
                valóban a rendszer (Mezo teljesítménye), nem Daniel tulajdonsága.
```

- [ ] **Step 4: Prompt assembler**

`HEADER` becomes:
```java
    private static final String HEADER = "\n\n[Karakter — amit eddig megtudtam Danielről] (értelmezések,"
            + " nem tények; az ÉRZÉKENY jelöléssel ellátott állításokat tükörként vagy kérdésként"
            + " hozd fel, sosem ítélkezve; az önvizsgálat sorai a saját találati arányomról szólnak —"
            + " ezekhez tartsd magad, ne ígérj magabiztosabban, mint amit igazolnak):\n";
```
`orderedDimensions`: replace the first comparator key with a rank — `CORE` → 0, `META` → 1, else 2:
```java
                .sorted(Comparator
                        .comparing((CharacterDimensionEntity d) -> kindRank(d.getKind()))
                        .thenComparing(d -> CORE_KIND.equals(d.getKind())
                                ? CORE_ORDER.getOrDefault(d.getKey(), Integer.MAX_VALUE) : 0)
                        .thenComparing(CharacterDimensionEntity::getCreatedAt))
```
```java
    /** CORE (catalog order) → META (the self-audit) → CHAPTER (createdAt), round-4 spec §4.2. */
    private static int kindRank(String kind) {
        if (CORE_KIND.equals(kind)) {
            return 0;
        }
        return CharacterCoreCatalog.KIND_META.equals(kind) ? 1 : 2;
    }
```
Update the class javadoc's first sentence: "CORE dimensions in catalog order, then the META self-audit dimension, then CHAPTER dimensions by createdAt".

- [ ] **Step 5: Gate + commit**

Run the focused backend gate → green. Any existing `CharacterPromptAssemblerIT` test asserting the exact old HEADER text: update to the new text.
```bash
git add backend/src/main/java backend/src/test/java
git commit -m "feat(character): route the Szkeptikus through observation/proposal, META in the prompt block (mezo-1gim.15)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Read layer, part 1 — `DetectorInput` records, `TrendWindow` widening, mentions / chat tool calls / sleep clock reads

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/character/detector/DetectorInput.java` (`SleepPoint`, new records, `TrendWindow`)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/character/service/CharacterSignalReads.java` (deps, `gather`, `toSleepPoint`, new `gatherMentions`, `gatherChatToolCalls`, `parseClock`)
- Modify: `backend/src/test/java/io/mrkuhne/mezo/feature/character/detector/DetectorTest.java` (`emptyTrend`, `TrendBuilder`, the 4 `TrendWindow` literals at ~560/570/578/591, every `new DetectorInput.SleepPoint(` call gets two trailing `null`s)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/character/CharacterSignalReadsIT.java`

**Interfaces:**
- Produces (all nested in `DetectorInput`):
```java
    /** date = the night leading into that day (companion "last night" convention); bedtime/wakeup are the
     *  row's HH:mm clock strings parsed to LocalTime, null when absent or malformed (round 4). */
    public record SleepPoint(LocalDate date, Integer quality, BigDecimal durationH, Integer awakenings,
                             LocalTime bedtime, LocalTime wakeup) {}
    /** One people mention. {@code contextLabel} is the people feature's nightly classifier output
     *  (closed DB-CHECK set) or null = unlabelled — never "egyeb". tone/intensity are deliberately
     *  NOT carried (round-4 spec §4.4): the mood side is the user's own check-in scale. */
    public record MentionPoint(LocalDate date, UUID personId, String contextLabel, boolean flagged) {}
    /** One executed companion tool call (assistant row). {@code titlePreview} is the conversation
     *  title (= the first user message, truncated) for EVIDENCE only — never parsed. */
    public record ChatToolCallPoint(LocalDate date, UUID conversationId, String toolName, String titlePreview) {}
    /** One Tudástár triage decision. source = "fact" (LearnedFact, date = the candidate's createdAt —
     *  a PROXY, there is no decidedAt) or "pattern" (PatternEvent confirmed|rejected, date = occurredAt).
     *  decision = "kept" | "rejected"; refined = the fact was accepted with an edit. */
    public record TriageDecisionPoint(LocalDate date, String source, String category, String decision,
                                      boolean refined) {}
    public record PredictionPoint(LocalDate validFrom, LocalDate validTo, String status,
                                  BigDecimal confidence, String metricKey) {}
    public record QuestPoint(LocalDate questDate, String slot, String status) {}
    /** kind = "experiment" (date = generatedAt) | "challenge" (date = workoutDate); status is the
     *  source row's own status string; outcomeGood null = no verdict recorded. */
    public record ProposalOutcomePoint(LocalDate date, String kind, String status, Boolean outcomeGood) {}
    /** The system-side (AI-meta) series, gathered by {@code CharacterMetaReads}. */
    public record MetaWindow(List<TriageDecisionPoint> triageDecisions, List<PredictionPoint> predictions,
                             List<QuestPoint> quests, List<ProposalOutcomePoint> proposalOutcomes) {
        public static MetaWindow empty() {
            return new MetaWindow(List.of(), List.of(), List.of(), List.of());
        }
    }
```
- `TrendWindow` gains three trailing components: `List<MentionPoint> mentions, List<ChatToolCallPoint> chatToolCalls, MetaWindow meta` (18 components total).
- `CharacterSignalReads` gains constructor deps `MentionRepository mentionRepository` and `CharacterMetaReads metaReads` (Task 4 creates it — in THIS task add a minimal `CharacterMetaReads` stub? NO: to keep Task 3 compiling on its own, this task wires `mentions` and `chatToolCalls` and passes `DetectorInput.MetaWindow.empty()` for `meta`; Task 4 replaces that literal with the real read).

- [ ] **Step 1: Failing ITs** (append to `CharacterSignalReadsIT`; add `@Autowired private PersonPopulator personPopulator; @Autowired private MentionPopulator mentionPopulator; @Autowired private MentionRepository mentionRepository; @Autowired private AiMessageRepository aiMessageRepository;`)

```java
    private MentionEntity saveMention(UUID personId, LocalDateTime at, String contextLabel) {
        MentionEntity m = mentionPopulator.createMention(owner, personId,
                at.atZone(ZoneId.systemDefault()).toInstant(), null);
        m.setContextLabel(contextLabel);
        return mentionRepository.saveAndFlush(m);
    }

    /** An assistant row carrying one executed tool call, created_at backdated (the saveFocus idiom). */
    private AiMessageEntity saveToolCallRow(AiConversationEntity conversation, LocalDateTime at, String toolName) {
        AiMessageEntity m = aiMessagePopulator.message(conversation, "assistant", "…");
        m.setToolCalls(new ToolCallsEnvelope(List.of(new ToolCallsEnvelope.ToolCall("tool", toolName, "days=7"))));
        AiMessageEntity saved = aiMessageRepository.saveAndFlush(m);
        jdbcTemplate.update("update ai_message set created_at = ? where id = ?",
                Timestamp.from(at.atZone(ZoneId.systemDefault()).toInstant()), saved.getId());
        return saved;
    }

    @Test
    void gather_readsMentionsWithContextLabel_boundedAboveByDay() {
        LocalDate day = LocalDate.of(2026, 5, 20);
        UUID person = personPopulator.createPerson(owner, "Petra").getId();
        saveMention(person, day.atTime(18, 0), "munka");
        saveMention(person, day.minusDays(30).atTime(9, 0), null);
        saveMention(person, day.plusDays(1).atTime(8, 0), "csalad");

        List<DetectorInput.MentionPoint> mentions = signalReads.gather(owner, day).trend().mentions();

        assertThat(mentions).extracting(DetectorInput.MentionPoint::date)
                .containsExactly(day.minusDays(30), day);
        assertThat(mentions).extracting(DetectorInput.MentionPoint::contextLabel).containsExactly(null, "munka");
        assertThat(mentions).allSatisfy(m -> assertThat(m.personId()).isEqualTo(person));
    }

    @Test
    void gather_readsAssistantToolCallsWithConversationTitle_boundedAboveByDay() {
        LocalDate day = LocalDate.of(2026, 5, 20);
        AiConversationEntity conv = aiConversationPopulator.conversation(owner,
                "Mennyit aludtam a héten, és mit mond a súlytrend?", day.atStartOfDay(ZoneId.systemDefault()).toInstant());
        saveToolCallRow(conv, day.atTime(21, 0), "get_recovery");
        saveToolCallRow(conv, day.plusDays(1).atTime(1, 0), "get_weight_trend");
        saveUserMessage(day.atTime(20, 59)); // a user row: never a tool-call point

        List<DetectorInput.ChatToolCallPoint> calls = signalReads.gather(owner, day).trend().chatToolCalls();

        assertThat(calls).singleElement().satisfies(c -> {
            assertThat(c.date()).isEqualTo(day);
            assertThat(c.conversationId()).isEqualTo(conv.getId());
            assertThat(c.toolName()).isEqualTo("get_recovery");
            assertThat(c.titlePreview()).isEqualTo("Mennyit aludtam a héten, és mit mond a súlytrend?");
        });
    }

    @Test
    void gather_sleepPointCarriesParsedClocks_nullWhenAbsentOrMalformed() {
        LocalDate day = LocalDate.of(2026, 5, 20);
        sleepLogPopulator.createSleepLog(owner, day, "23:30", "07:15", new BigDecimal("7.5"));
        sleepLogPopulator.createSleepLog(owner, day.minusDays(1), new BigDecimal("7.0"), 7);
        SleepLogEntity bad = sleepLogPopulator.createSleepLog(owner, day.minusDays(2), "late", "07:00", new BigDecimal("7.0"));

        List<DetectorInput.SleepPoint> sleep = signalReads.gather(owner, day).trend().sleepEightWeeks();

        DetectorInput.SleepPoint parsed = sleep.stream().filter(s -> s.date().equals(day)).findFirst().orElseThrow();
        assertThat(parsed.bedtime()).isEqualTo(java.time.LocalTime.of(23, 30));
        assertThat(parsed.wakeup()).isEqualTo(java.time.LocalTime.of(7, 15));
        assertThat(sleep.stream().filter(s -> s.date().equals(day.minusDays(1))).findFirst().orElseThrow().bedtime()).isNull();
        DetectorInput.SleepPoint malformed = sleep.stream().filter(s -> s.date().equals(bad.getDate())).findFirst().orElseThrow();
        assertThat(malformed.bedtime()).isNull();
        assertThat(malformed.wakeup()).isEqualTo(java.time.LocalTime.of(7, 0));
    }
```
Imports needed: `io.mrkuhne.mezo.feature.people.entity.MentionEntity`, `...people.repository.MentionRepository`, `...support.populator.PersonPopulator`, `...support.populator.MentionPopulator`, `...companion.entity.ToolCallsEnvelope`, `...companion.repository.AiMessageRepository`. Run `-Dtest=CharacterSignalReadsIT` → FAIL (compile).

- [ ] **Step 2: `DetectorInput`** — replace `SleepPoint`, add the records above (after `LogLatencyPoint`), widen `TrendWindow`:
```java
    public record TrendWindow(List<RunPoint> runsEightWeeks, List<GymDay> gymEightWeeks,
                              List<MealDayPoint> mealDays, List<WaterDayPoint> waterDays,
                              StackContext stack, List<CheckinDayPoint> checkinDays,
                              MedContext med,
                              List<SleepPoint> sleepEightWeeks,
                              List<IntentionDayPoint> intentionDays,
                              List<DecisionPoint> decisions,
                              List<GratitudePoint> gratitudes,
                              NeedsContext needs,
                              List<CheckinSlotPoint> checkinSlots,
                              List<LocalDateTime> userChatTimes,
                              List<LogLatencyPoint> logLatencies,
                              List<MentionPoint> mentions,
                              List<ChatToolCallPoint> chatToolCalls,
                              MetaWindow meta) {}
```
Extend the `TrendWindow` javadoc with one paragraph: "Round 4 adds the people mentions, the assistant tool-call series and the nested `MetaWindow` (system-side sources, gathered by `CharacterMetaReads`)."

- [ ] **Step 3: `CharacterSignalReads`**

Add fields `private final MentionRepository mentionRepository;` (import `io.mrkuhne.mezo.feature.people.repository.MentionRepository`, `...people.entity.MentionEntity`) and constant `private static final String CHAT_ROLE_ASSISTANT = "assistant";`. In `gather`, after `logLatencies`:
```java
        List<DetectorInput.MentionPoint> mentions = gatherMentions(owner, trendStart, day);
        List<DetectorInput.ChatToolCallPoint> chatToolCalls = gatherChatToolCalls(owner, trendStart, day);
```
and pass `…, logLatencies, mentions, chatToolCalls, DetectorInput.MetaWindow.empty())` to the constructor (Task 4 swaps the last argument). New methods:
```java
    /** People mentions in the window, {@code ts} → local date; bounded above by the end of {@code to}. */
    private List<DetectorInput.MentionPoint> gatherMentions(UUID owner, LocalDate from, LocalDate to) {
        Instant fromInstant = from.atStartOfDay(ZoneId.systemDefault()).toInstant();
        Instant toExclusive = to.plusDays(1).atStartOfDay(ZoneId.systemDefault()).toInstant();
        return mentionRepository
                .findByCreatedByAndTsGreaterThanEqualAndTsLessThanAndDeletedFalse(owner, fromInstant, toExclusive)
                .stream()
                .map(m -> new DetectorInput.MentionPoint(localDate(m.getTs()), m.getPersonId(),
                        m.getContextLabel(), m.isFlagged()))
                .sorted(Comparator.comparing(DetectorInput.MentionPoint::date))
                .toList();
    }

    /** Every executed tool call on the assistant rows in the window — the deterministic topic
     *  proxy (round-4 spec §5.4). One point per call; the conversation title rides along as
     *  bounded evidence. Rows without tool calls contribute nothing. */
    private List<DetectorInput.ChatToolCallPoint> gatherChatToolCalls(UUID owner, LocalDate from, LocalDate to) {
        Instant fromInstant = from.atStartOfDay(ZoneId.systemDefault()).toInstant();
        Instant toExclusive = to.plusDays(1).atStartOfDay(ZoneId.systemDefault()).toInstant();
        List<DetectorInput.ChatToolCallPoint> out = new ArrayList<>();
        for (AiMessageEntity m : aiMessageRepository
                .findByCreatedByAndRoleAndDeletedFalseAndCreatedAtGreaterThanEqualAndCreatedAtLessThanOrderByCreatedAtAsc(
                        owner, CHAT_ROLE_ASSISTANT, fromInstant, toExclusive)) {
            if (m.getToolCalls() == null || m.getToolCalls().calls() == null) {
                continue;
            }
            String title = m.getConversation() == null ? null : preview(m.getConversation().getTitle());
            UUID conversationId = m.getConversation() == null ? null : m.getConversation().getId();
            for (ToolCallsEnvelope.ToolCall call : m.getToolCalls().calls()) {
                if (call.name() == null || call.name().isBlank()) {
                    continue;
                }
                out.add(new DetectorInput.ChatToolCallPoint(localDate(m.getCreatedAt()), conversationId,
                        call.name(), title));
            }
        }
        return out;
    }

    private DetectorInput.SleepPoint toSleepPoint(SleepLogEntity s) {
        return new DetectorInput.SleepPoint(s.getDate(), s.getQuality(), s.getDurationH(), s.getAwakenings(),
                parseClock(s.getBedtime()), parseClock(s.getWakeup()));
    }

    /** "HH:mm" → LocalTime; null (never a default) when absent or malformed. */
    private static java.time.LocalTime parseClock(String hhmm) {
        if (hhmm == null || hhmm.isBlank()) {
            return null;
        }
        try {
            return java.time.LocalTime.parse(hhmm.strip());
        } catch (java.time.format.DateTimeParseException e) {
            return null;
        }
    }
```
Imports: `io.mrkuhne.mezo.feature.companion.entity.AiMessageEntity`, `io.mrkuhne.mezo.feature.companion.entity.ToolCallsEnvelope`. Verify the mention finder's exact name/parameter order in `MentionRepository.java:24-25` and use that.

- [ ] **Step 4: `DetectorTest` compiles again**

`emptyTrend()` → append `List.of(), List.of(), DetectorInput.MetaWindow.empty()`. `TrendBuilder`: add fields `private List<DetectorInput.MentionPoint> mentions = List.of(); private List<DetectorInput.ChatToolCallPoint> toolCalls = List.of(); private DetectorInput.MetaWindow meta = DetectorInput.MetaWindow.empty();` with setters `mentions(...)`, `toolCalls(...)`, `meta(...)`, and pass them in `build()`. The four literals at ~560/570/578/591: append `, List.of(), List.of(), DetectorInput.MetaWindow.empty()`. Every `new DetectorInput.SleepPoint(a, b, c, d)` (lines ~600, 601, 619, 620, 903, 1050) → append `, null, null`. Run `-Dtest=DetectorTest` → green (no behaviour change).

- [ ] **Step 5: Gate + commit** — focused backend gate green (the three new ITs pass; `ArchitectureTest` green — `character → people` is a new one-way edge, not a cycle).
```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/character backend/src/test/java/io/mrkuhne/mezo/feature/character
git commit -m "feat(character): round-4 reads — mentions, chat tool calls, sleep clocks; TrendWindow widened (mezo-1gim.15)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Read layer, part 2 — `CharacterMetaReads` + repository finders + IT

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/character/service/CharacterMetaReads.java`
- Modify: `.../companion/repository/LearnedFactRepository.java`, `.../companion/repository/PatternEventRepository.java`, `.../proactive/repository/PredictionRepository.java`, `.../proactive/repository/ExperimentRepository.java`, `.../proactive/repository/ChallengeRepository.java` (one finder each)
- Modify: `.../character/service/CharacterSignalReads.java` (inject `CharacterMetaReads`, replace `MetaWindow.empty()`)
- Create: `backend/src/test/java/io/mrkuhne/mezo/feature/character/CharacterMetaReadsIT.java`

**Interfaces:**
- Produces: `CharacterMetaReads.gather(UUID owner, LocalDate from, LocalDate to) → DetectorInput.MetaWindow`.
- New finders (exact names):
  - `LearnedFactRepository.findByCreatedByAndUserDecisionIsNotNullAndCreatedAtGreaterThanEqualAndCreatedAtLessThanAndDeletedFalse(UUID createdBy, Instant from, Instant toExclusive)`
  - `PatternEventRepository.findByCreatedByAndKindInAndOccurredAtGreaterThanEqualAndOccurredAtLessThanAndDeletedFalse(UUID createdBy, Collection<String> kinds, Instant from, Instant toExclusive)`
  - `PredictionRepository.findByCreatedByAndValidToBetweenAndDeletedFalse(UUID createdBy, LocalDate from, LocalDate to)`
  - `ExperimentRepository.findByCreatedByAndGeneratedAtGreaterThanEqualAndGeneratedAtLessThanAndDeletedFalse(UUID createdBy, Instant from, Instant toExclusive)`
  - `ChallengeRepository.findByCreatedByAndWorkoutDateBetweenAndDeletedFalse(UUID createdBy, LocalDate from, LocalDate to)`
  - Quests reuse `DailyQuestRepository.findByCreatedByAndQuestDateBetweenOrderByQuestDateDesc`.

- [ ] **Step 1: Failing IT** — `CharacterMetaReadsIT` (`@ActiveProfiles("companion-fake")`, extends `ApiIntegrationTest`):
```java
class CharacterMetaReadsIT extends ApiIntegrationTest {

    private static final LocalDate DAY = LocalDate.of(2026, 8, 26);

    @Autowired private CharacterMetaReads metaReads;
    @Autowired private OwnerProperties ownerProperties;
    @Autowired private LearnedFactPopulator learnedFactPopulator;
    @Autowired private PatternPopulator patternPopulator;
    @Autowired private PatternEventPopulator patternEventPopulator;
    @Autowired private PatternEventRepository patternEventRepository;
    @Autowired private PredictionPopulator predictionPopulator;
    @Autowired private QuestPopulator questPopulator;
    @Autowired private ExperimentPopulator experimentPopulator;
    @Autowired private ExperimentRepository experimentRepository;
    @Autowired private ChallengePopulator challengePopulator;
    @Autowired private TrainPopulator trainPopulator;
    @Autowired private JdbcTemplate jdbcTemplate;

    private UUID owner;

    @BeforeEach
    void owner() { owner = databasePopulator.populateUser(ownerProperties.ownerEmail()); }

    private LocalDate from() { return DAY.minusWeeks(8).plusDays(1); }

    private static Timestamp at(LocalDate d) {
        return Timestamp.from(d.atStartOfDay(ZoneId.systemDefault()).toInstant().plusSeconds(3600));
    }

    private void factDecision(LocalDate createdOn, String category, String decision) {
        LearnedFactEntity f = learnedFactPopulator.weeklyCandidate(owner, createdOn, "t", category, "e", decision);
        jdbcTemplate.update("update learned_fact set created_at = ? where id = ?", at(createdOn), f.getId());
    }

    private void patternEvent(LocalDate on, String kind) {
        UUID patternId = patternPopulator.statistical(owner).getId();
        PatternEventEntity e = patternEventPopulator.snapshot(owner, patternId, -0.5, 12, 0.05,
                on.atStartOfDay(ZoneId.systemDefault()).toInstant().plusSeconds(3600));
        e.setKind(kind);
        patternEventRepository.saveAndFlush(e);
    }

    @Test
    void gather_triageDecisions_factsByCreatedAtProxy_patternsByOccurredAt_boundedByDay() {
        factDecision(DAY, "fuel", LearnedFactEntity.DECISION_REJECT);
        factDecision(DAY.minusDays(3), "life", LearnedFactEntity.DECISION_REFINE);
        factDecision(DAY.plusDays(1), "train", LearnedFactEntity.DECISION_ACCEPT);   // after day: out
        LearnedFactEntity pending = learnedFactPopulator.candidate(owner, "pending", "health", null); // undecided: out
        patternEvent(DAY.minusDays(1), PatternEventEntity.KIND_REJECTED);
        patternEvent(DAY.minusDays(1), PatternEventEntity.KIND_SNAPSHOT);            // not a decision: out

        List<DetectorInput.TriageDecisionPoint> t = metaReads.gather(owner, from(), DAY).triageDecisions();

        assertThat(t).hasSize(3);
        assertThat(t).filteredOn(p -> p.source().equals("fact")).extracting(DetectorInput.TriageDecisionPoint::decision)
                .containsExactlyInAnyOrder("rejected", "kept");
        assertThat(t).filteredOn(DetectorInput.TriageDecisionPoint::refined).singleElement()
                .satisfies(p -> assertThat(p.category()).isEqualTo("life"));
        assertThat(t).filteredOn(p -> p.source().equals("pattern")).singleElement().satisfies(p -> {
            assertThat(p.category()).isEqualTo("minta");
            assertThat(p.decision()).isEqualTo("rejected");
            assertThat(p.date()).isEqualTo(DAY.minusDays(1));
        });
        assertThat(pending).isNotNull();
    }

    @Test
    void gather_predictions_byValidToWindow_carriesStatusAndConfidence() {
        PredictionEntity p = predictionPopulator.prediction(owner, DAY.minusDays(10), "sleep_avg", "up",
                PredictionEntity.STATUS_VALIDATED);          // validTo = DAY-4
        p.setConfidence(new BigDecimal("0.80"));
        predictionPopulator.prediction(owner, DAY.minusDays(70), "sleep_avg", "up", PredictionEntity.STATUS_MISSED); // out
        predictionPopulator.prediction(owner, DAY.plusDays(1), "sleep_avg", "up", PredictionEntity.STATUS_PENDING);   // validTo after day: out

        List<DetectorInput.PredictionPoint> preds = metaReads.gather(owner, from(), DAY).predictions();

        assertThat(preds).singleElement().satisfies(x -> {
            assertThat(x.validTo()).isEqualTo(DAY.minusDays(4));
            assertThat(x.status()).isEqualTo("validated");
        });
    }

    @Test
    void gather_quests_inWindow_includingRerolled_boundedByDay() {
        questPopulator.activityQuest(owner, DAY, "reading", 10, DailyQuestEntity.STATUS_OFFERED);
        questPopulator.activityQuest(owner, DAY.minusDays(1), "reading", 10, DailyQuestEntity.STATUS_REROLLED);
        questPopulator.activityQuest(owner, DAY.plusDays(1), "reading", 10, DailyQuestEntity.STATUS_OFFERED);

        List<DetectorInput.QuestPoint> q = metaReads.gather(owner, from(), DAY).quests();

        assertThat(q).extracting(DetectorInput.QuestPoint::status).containsExactlyInAnyOrder("offered", "rerolled");
        assertThat(q).allSatisfy(x -> assertThat(x.slot()).isEqualTo("GROWTH"));
    }

    @Test
    void gather_proposalOutcomes_experimentsByGeneratedAt_challengesByWorkoutDate() {
        ExperimentEntity done = experimentPopulator.experiment(owner, ExperimentEntity.STATUS_COMPLETED, "sleep_avg", "up");
        done.setOutcomeGood(Boolean.TRUE);
        experimentRepository.saveAndFlush(done);
        jdbcTemplate.update("update experiment set generated_at = ? where id = ?", at(DAY.minusDays(5)), done.getId());
        ExperimentEntity late = experimentPopulator.experiment(owner, ExperimentEntity.STATUS_DISMISSED, "sleep_avg", "up");
        jdbcTemplate.update("update experiment set generated_at = ? where id = ?", at(DAY.plusDays(2)), late.getId());
        // A challenge needs a real template session + exercise (FKs): build them the way
        // backend/src/test/java/io/mrkuhne/mezo/feature/proactive/ChallengeOutcomeIT.java does
        // (its `plan` helper) — copy that helper here verbatim.
        ChallengePlan plan = challengePlan(owner);
        challengePopulator.challenge(owner, plan.templateSessionId(), DAY.minusDays(2), plan.exerciseId(),
                ChallengeEntity.TYPE_PR, ChallengeEntity.STATUS_HIT);

        List<DetectorInput.ProposalOutcomePoint> out = metaReads.gather(owner, from(), DAY).proposalOutcomes();

        assertThat(out).hasSize(2);
        assertThat(out).filteredOn(p -> p.kind().equals("experiment")).singleElement().satisfies(p -> {
            assertThat(p.status()).isEqualTo("completed");
            assertThat(p.outcomeGood()).isTrue();
            assertThat(p.date()).isEqualTo(DAY.minusDays(5));
        });
        assertThat(out).filteredOn(p -> p.kind().equals("challenge")).singleElement().satisfies(p -> {
            assertThat(p.status()).isEqualTo("hit");
            assertThat(p.date()).isEqualTo(DAY.minusDays(2));
        });
    }

    @Test
    void gather_freshOwner_isHonestlyEmpty() {
        DetectorInput.MetaWindow w = metaReads.gather(owner, from(), DAY);
        assertThat(w.triageDecisions()).isEmpty();
        assertThat(w.predictions()).isEmpty();
        assertThat(w.quests()).isEmpty();
        assertThat(w.proposalOutcomes()).isEmpty();
    }
}
```
(`ChallengePlan`/`challengePlan(owner)`: copy the equivalent helper record + method from `ChallengeOutcomeIT` — it creates a template `WorkoutSessionEntity` and an `ExerciseEntity` via `TrainPopulator`.) Run → FAIL (compile).

- [ ] **Step 2: Finders** — add the five derived queries listed under Interfaces, each with a one-line javadoc "Karakter round-4 read layer (CharacterMetaReads): window read, bounded above for catch-up honesty."

- [ ] **Step 3: `CharacterMetaReads`**
```java
package io.mrkuhne.mezo.feature.character.service;

/**
 * The system-side (AI-meta) read composer for the detector framework (round-4 spec §6.2): what the
 * companion proposed and how it went — fact/pattern triage decisions, predictions, quests,
 * experiment and challenge outcomes. Split from {@link CharacterSignalReads} (already 28
 * dependencies) because these sources describe THE SYSTEM, and the detectors reading them
 * (szkeptikus-owned, META dimension) make claims about the system, never about the user.
 *
 * <p>Catch-up honesty holds on the DATE columns (every read is bounded above by {@code to});
 * two sources mutate STATUS in place without a timestamp (prediction status, experiment/challenge
 * status + outcomeGood), so a catch-up run sees today's status for a past day — an accepted,
 * documented limitation (spec §6.4). Fact decisions are dated by the candidate's {@code createdAt}
 * because {@code learned_fact} has no decidedAt — a proxy the detector's summary names.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.CHARACTER_SWITCH, havingValue = "true")
public class CharacterMetaReads {

    static final String SOURCE_FACT = "fact";
    static final String SOURCE_PATTERN = "pattern";
    static final String CATEGORY_PATTERN = "minta";
    static final String DECISION_KEPT = "kept";
    static final String DECISION_REJECTED = "rejected";
    static final String KIND_EXPERIMENT = "experiment";
    static final String KIND_CHALLENGE = "challenge";

    private final LearnedFactRepository learnedFactRepository;
    private final PatternEventRepository patternEventRepository;
    private final PredictionRepository predictionRepository;
    private final DailyQuestRepository dailyQuestRepository;
    private final ExperimentRepository experimentRepository;
    private final ChallengeRepository challengeRepository;

    public DetectorInput.MetaWindow gather(UUID owner, LocalDate from, LocalDate to) {
        Instant fromInstant = from.atStartOfDay(ZoneId.systemDefault()).toInstant();
        Instant toExclusive = to.plusDays(1).atStartOfDay(ZoneId.systemDefault()).toInstant();
        return new DetectorInput.MetaWindow(
                gatherTriage(owner, fromInstant, toExclusive),
                gatherPredictions(owner, from, to),
                gatherQuests(owner, from, to),
                gatherProposalOutcomes(owner, from, to, fromInstant, toExclusive));
    }

    private List<DetectorInput.TriageDecisionPoint> gatherTriage(UUID owner, Instant from, Instant toExclusive) {
        List<DetectorInput.TriageDecisionPoint> out = new ArrayList<>();
        for (LearnedFactEntity f : learnedFactRepository
                .findByCreatedByAndUserDecisionIsNotNullAndCreatedAtGreaterThanEqualAndCreatedAtLessThanAndDeletedFalse(
                        owner, from, toExclusive)) {
            boolean rejected = LearnedFactEntity.DECISION_REJECT.equals(f.getUserDecision());
            boolean refined = LearnedFactEntity.DECISION_REFINE.equals(f.getUserDecision());
            out.add(new DetectorInput.TriageDecisionPoint(localDate(f.getCreatedAt()), SOURCE_FACT,
                    f.getCategory(), rejected ? DECISION_REJECTED : DECISION_KEPT, refined));
        }
        for (PatternEventEntity e : patternEventRepository
                .findByCreatedByAndKindInAndOccurredAtGreaterThanEqualAndOccurredAtLessThanAndDeletedFalse(
                        owner, List.of(PatternEventEntity.KIND_CONFIRMED, PatternEventEntity.KIND_REJECTED),
                        from, toExclusive)) {
            boolean rejected = PatternEventEntity.KIND_REJECTED.equals(e.getKind());
            out.add(new DetectorInput.TriageDecisionPoint(localDate(e.getOccurredAt()), SOURCE_PATTERN,
                    CATEGORY_PATTERN, rejected ? DECISION_REJECTED : DECISION_KEPT, false));
        }
        out.sort(Comparator.comparing(DetectorInput.TriageDecisionPoint::date));
        return out;
    }

    private List<DetectorInput.PredictionPoint> gatherPredictions(UUID owner, LocalDate from, LocalDate to) {
        return predictionRepository.findByCreatedByAndValidToBetweenAndDeletedFalse(owner, from, to).stream()
                .map(p -> new DetectorInput.PredictionPoint(p.getValidFrom(), p.getValidTo(), p.getStatus(),
                        p.getConfidence(), p.getMetricKey()))
                .sorted(Comparator.comparing(DetectorInput.PredictionPoint::validTo))
                .toList();
    }

    private List<DetectorInput.QuestPoint> gatherQuests(UUID owner, LocalDate from, LocalDate to) {
        return dailyQuestRepository.findByCreatedByAndQuestDateBetweenOrderByQuestDateDesc(owner, from, to).stream()
                .map(q -> new DetectorInput.QuestPoint(q.getQuestDate(), q.getSlot(), q.getStatus()))
                .sorted(Comparator.comparing(DetectorInput.QuestPoint::questDate))
                .toList();
    }

    private List<DetectorInput.ProposalOutcomePoint> gatherProposalOutcomes(UUID owner, LocalDate from, LocalDate to,
                                                                            Instant fromInstant, Instant toExclusive) {
        List<DetectorInput.ProposalOutcomePoint> out = new ArrayList<>();
        for (ExperimentEntity e : experimentRepository
                .findByCreatedByAndGeneratedAtGreaterThanEqualAndGeneratedAtLessThanAndDeletedFalse(
                        owner, fromInstant, toExclusive)) {
            out.add(new DetectorInput.ProposalOutcomePoint(localDate(e.getGeneratedAt()), KIND_EXPERIMENT,
                    e.getStatus(), e.getOutcomeGood()));
        }
        for (ChallengeEntity c : challengeRepository.findByCreatedByAndWorkoutDateBetweenAndDeletedFalse(owner, from, to)) {
            out.add(new DetectorInput.ProposalOutcomePoint(c.getWorkoutDate(), KIND_CHALLENGE,
                    c.getStatus(), c.getOutcomeGood()));
        }
        out.sort(Comparator.comparing(DetectorInput.ProposalOutcomePoint::date));
        return out;
    }

    private static LocalDate localDate(Instant at) {
        return at == null ? null : at.atZone(ZoneId.systemDefault()).toLocalDate();
    }
}
```
Wire it: `CharacterSignalReads` gets `private final CharacterMetaReads metaReads;` and passes `metaReads.gather(owner, trendStart, day)` as the last `TrendWindow` argument.

- [ ] **Step 4: Gate + commit** — focused gate green; `ArchitectureTest` green (`character → quest` new one-way edge; `character → companion`/`proactive` already exist).
```bash
git add backend/src/main/java backend/src/test/java
git commit -m "feat(character): CharacterMetaReads — triage, prediction, quest, experiment/challenge series (mezo-1gim.15)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: The three antropologus detectors — `people-mood-link`, `mention-context-shift`, `weekend-gap`

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/character/detector/PeopleMoodLinkDetector.java`, `MentionContextShiftDetector.java`, `WeekendGapDetector.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/character/detector/DetectorTest.java`

**Interfaces:**
- Consumes: `DetectorInput.MentionPoint`, `SleepPoint.bedtime/wakeup`, `CheckinDayPoint`, `MealDayPoint`, `WaterDayPoint`, `TrailingWindow.inWindow(date, asOf, days)`, `hu`, `pct`; `TrendBuilder.mentions(...)`, `.sleep(...)`, `.checkins(...)`, `.meals(...)`, `.water(...)`, `trendOnly(day, trend)`, `checkin(d, energy, stress, mental)` (Task 3).
- Produces: detector keys `people-mood-link`, `mention-context-shift`, `weekend-gap`, all `expertKey = "antropologus"`; `WeekendGapDetector.midsleepMinutes(LocalTime, LocalTime)` (package-private static).

All three: `@Component`, `@ConditionalOnProperty(name = FeaturesConfiguration.CHARACTER_SWITCH, havingValue = "true")`, implement `CharacterDetector`, NO new-data pre-filter (spec §4.3).

- [ ] **Step 1: Failing tests** — append to `DetectorTest` (helpers first):
```java
    private static DetectorInput.MentionPoint mention(LocalDate d, String contextLabel) {
        return new DetectorInput.MentionPoint(d, UUID.fromString("00000000-0000-0000-0000-000000000001"), contextLabel, false);
    }

    private static DetectorInput.SleepPoint sleepClock(LocalDate d, String bed, String wake) {
        return new DetectorInput.SleepPoint(d, 7, new BigDecimal("7.5"), 1,
                java.time.LocalTime.parse(bed), java.time.LocalTime.parse(wake));
    }

    private static DetectorInput.CheckinDayPoint mentalOnly(LocalDate d, String mental) {
        return new DetectorInput.CheckinDayPoint(d, 1, null, null, null, new BigDecimal(mental));
    }

    // ── people-mood-link ────────────────────────────────────────────────────────

    @Test
    void peopleMoodLink_firesWhenMentionDaysRunHigher_firstTimeThePairedFloorIsMet() {
        // 7 mention days (incl. DAY) at mental 8 + 7 other days at mental 5 → paired = 14 as of DAY
        // (gate met, Δ = +3,0 → "magasabb", tier "gyenge" since |M| = 7); as of DAY-1 paired = 13 → null.
        List<DetectorInput.MentionPoint> mentions = new ArrayList<>();
        List<DetectorInput.CheckinDayPoint> checkins = new ArrayList<>();
        for (int i = 0; i < 14; i++) {
            LocalDate d = DAY.minusDays(i);
            boolean mentionDay = i % 2 == 0;           // i=0 is DAY → a mention day
            if (mentionDay) {
                mentions.add(mention(d, "munka"));
            }
            checkins.add(mentalOnly(d, mentionDay ? "8" : "5"));
        }
        DetectorInput in = trendOnly(DAY, new TrendBuilder().mentions(mentions).checkins(checkins).build());

        List<DetectorSignal> fired = new PeopleMoodLinkDetector().detect(in);

        assertThat(fired).singleElement().satisfies(s -> {
            assertThat(s.detectorKey()).isEqualTo("people-mood-link");
            assertThat(s.expertKey()).isEqualTo("antropologus");
            assertThat(s.summary()).contains("7 napján").contains("8,0").contains("7 említés nélküli napon")
                    .contains("5,0").contains("magasabb").contains("gyenge").contains("nem irány");
            assertThat(s.salience()).isEqualTo(3);
        });
    }

    @Test
    void peopleMoodLink_silentBelowTheOnePointDelta() {
        List<DetectorInput.MentionPoint> mentions = new ArrayList<>();
        List<DetectorInput.CheckinDayPoint> checkins = new ArrayList<>();
        for (int i = 0; i < 14; i++) {
            LocalDate d = DAY.minusDays(i);
            if (i % 2 == 0) {
                mentions.add(mention(d, null));
            }
            checkins.add(mentalOnly(d, i % 2 == 0 ? "6" : "5.5"));
        }
        DetectorInput in = trendOnly(DAY, new TrendBuilder().mentions(mentions).checkins(checkins).build());

        assertThat(new PeopleMoodLinkDetector().detect(in)).isEmpty();
    }

    @Test
    void peopleMoodLink_silentWhenTheBandIsUnchangedSinceYesterday() {
        // nothing on DAY: both evaluations see the same 16 paired days → same band → no signal
        List<DetectorInput.MentionPoint> mentions = new ArrayList<>();
        List<DetectorInput.CheckinDayPoint> checkins = new ArrayList<>();
        for (int i = 1; i <= 16; i++) {
            LocalDate d = DAY.minusDays(i);
            if (i % 2 == 0) {
                mentions.add(mention(d, "munka"));
            }
            checkins.add(mentalOnly(d, i % 2 == 0 ? "8" : "5"));
        }
        DetectorInput in = trendOnly(DAY, new TrendBuilder().mentions(mentions).checkins(checkins).build());

        assertThat(new PeopleMoodLinkDetector().detect(in)).isEmpty();
    }

    // ── mention-context-shift ───────────────────────────────────────────────────

    @Test
    void mentionContextShift_firesWhenADominantContextFirstAppears() {
        // 6 labelled mentions, all on DAY: munka×3, csalad×2, konfliktus×1 → dominant munka (50%),
        // konfliktus share 17% → "jelen". As of DAY-1: 0 labelled → null.
        List<DetectorInput.MentionPoint> mentions = List.of(
                mention(DAY, "munka"), mention(DAY, "munka"), mention(DAY, "munka"),
                mention(DAY, "csalad"), mention(DAY, "csalad"), mention(DAY, "konfliktus"),
                mention(DAY, null));
        DetectorInput in = trendOnly(DAY, new TrendBuilder().mentions(mentions).build());

        List<DetectorSignal> fired = new MentionContextShiftDetector().detect(in);

        assertThat(fired).singleElement().satisfies(s -> {
            assertThat(s.detectorKey()).isEqualTo("mention-context-shift");
            assertThat(s.expertKey()).isEqualTo("antropologus");
            assertThat(s.summary()).contains("6 címkézett").contains("munka").contains("50%")
                    .contains("17%").contains("jelen").contains("még kevés volt").contains("1 említés még címkézetlen")
                    .contains("éjszakai osztályozója");
            assertThat(s.salience()).isEqualTo(3);
        });
    }

    @Test
    void mentionContextShift_firesWithSalience4WhenTheKonfliktusBandRisesToMagas() {
        List<DetectorInput.MentionPoint> mentions = new ArrayList<>();
        for (int i = 1; i <= 4; i++) {
            mentions.add(mention(DAY.minusDays(i), "munka"));
        }
        mentions.add(mention(DAY.minusDays(5), "csalad"));
        mentions.add(mention(DAY.minusDays(6), "csalad"));          // as of DAY-1: munka|nincs (0% konfliktus)
        for (int i = 0; i < 3; i++) {
            mentions.add(mention(DAY, "konfliktus"));               // as of DAY: 3/9 = 33% → magas
        }
        DetectorInput in = trendOnly(DAY, new TrendBuilder().mentions(mentions).build());

        List<DetectorSignal> fired = new MentionContextShiftDetector().detect(in);

        assertThat(fired).singleElement().satisfies(s -> {
            assertThat(s.summary()).contains("33%").contains("magas").contains("korábban munka/nincs");
            assertThat(s.salience()).isEqualTo(4);
        });
    }

    @Test
    void mentionContextShift_silentWhenUnchanged() {
        List<DetectorInput.MentionPoint> mentions = new ArrayList<>();
        for (int i = 1; i <= 8; i++) {
            mentions.add(mention(DAY.minusDays(i), i <= 5 ? "edzes" : "baratok"));
        }
        DetectorInput in = trendOnly(DAY, new TrendBuilder().mentions(mentions).build());

        assertThat(new MentionContextShiftDetector().detect(in)).isEmpty();
    }

    // ── weekend-gap ─────────────────────────────────────────────────────────────

    @Test
    void weekendGap_midsleepMinutes_handlesMidnightCrossing() {
        assertThat(WeekendGapDetector.midsleepMinutes(java.time.LocalTime.of(0, 30), java.time.LocalTime.of(8, 30)))
                .isEqualTo(270);   // 04:30
        assertThat(WeekendGapDetector.midsleepMinutes(java.time.LocalTime.of(23, 30), java.time.LocalTime.of(7, 30)))
                .isEqualTo(210);   // 03:30
    }

    @Test
    void weekendGap_firesWhenTheJetlagBandBecomesComputable() {
        // DAY = 2026-08-27 (Thursday). Work nights: 14 weekday dates before DAY + DAY itself = 15
        // (as of DAY-1 only 14 → "keves"; as of DAY → computable). Free nights: 6 (three weekends).
        // Work midsleep 23:00→07:00 = 03:00 = 180; free 01:00→10:00 = 05:30 = 330; Δ = +150 → "jelentos".
        List<DetectorInput.SleepPoint> sleep = new ArrayList<>();
        for (LocalDate d : List.of(LocalDate.of(2026, 8, 26), LocalDate.of(2026, 8, 25), LocalDate.of(2026, 8, 24),
                LocalDate.of(2026, 8, 21), LocalDate.of(2026, 8, 20), LocalDate.of(2026, 8, 19), LocalDate.of(2026, 8, 18),
                LocalDate.of(2026, 8, 17), LocalDate.of(2026, 8, 14), LocalDate.of(2026, 8, 13), LocalDate.of(2026, 8, 12),
                LocalDate.of(2026, 8, 11), LocalDate.of(2026, 8, 10), LocalDate.of(2026, 8, 7), DAY)) {
            sleep.add(sleepClock(d, "23:00", "07:00"));
        }
        for (LocalDate d : List.of(LocalDate.of(2026, 8, 22), LocalDate.of(2026, 8, 23), LocalDate.of(2026, 8, 15),
                LocalDate.of(2026, 8, 16), LocalDate.of(2026, 8, 8), LocalDate.of(2026, 8, 9))) {
            sleep.add(sleepClock(d, "01:00", "10:00"));
        }
        DetectorInput in = trendOnly(DAY, new TrendBuilder().sleep(sleep).build());

        List<DetectorSignal> fired = new WeekendGapDetector().detect(in);

        assertThat(fired).singleElement().satisfies(s -> {
            assertThat(s.detectorKey()).isEqualTo("weekend-gap");
            assertThat(s.expertKey()).isEqualTo("antropologus");
            assertThat(s.summary()).contains("150 perccel később").contains("jelentős social jetlag")
                    .contains("6 szabad- és 15 munkaéjszakából").contains("nincs érdemi rés")
                    .contains("Hétvége itt szombat–vasárnap");
            assertThat(s.salience()).isEqualTo(4);
        });
    }

    @Test
    void weekendGap_firesWhenTheLoggingGapCrossesTheQuarterLine() {
        // 49-day window as of DAY (2026-08-27): Jul 10 .. Aug 27 → 35 weekdays, 14 weekend days.
        // Check-ins on every weekday except Aug 24 (34/35 = 97%) and on 10 of 14 weekend days
        // (skip Aug 15, 16, 22, 23 → 71%) → gap 26% ≥ 25% → "res". As of DAY-1 the window is
        // Jul 9 .. Aug 26: Jul 9 unlogged too → 33/35 = 94% − 71% = 23% → "nincs-res". Change → fires.
        List<DetectorInput.CheckinDayPoint> checkins = new ArrayList<>();
        Set<LocalDate> skip = Set.of(LocalDate.of(2026, 8, 24), LocalDate.of(2026, 8, 15), LocalDate.of(2026, 8, 16),
                LocalDate.of(2026, 8, 22), LocalDate.of(2026, 8, 23));
        for (LocalDate d = LocalDate.of(2026, 7, 10); !d.isAfter(DAY); d = d.plusDays(1)) {
            if (!skip.contains(d)) {
                checkins.add(mentalOnly(d, "6"));
            }
        }
        DetectorInput in = trendOnly(DAY, new TrendBuilder().checkins(checkins).build());

        List<DetectorSignal> fired = new WeekendGapDetector().detect(in);

        assertThat(fired).singleElement().satisfies(s -> {
            assertThat(s.summary()).contains("még kevés a hétvégi alvásnapló")
                    .contains("hétvégén a napok 71%-án").contains("hétköznap 97%-án").contains("hétvégi rés");
            assertThat(s.salience()).isEqualTo(4);
        });
    }

    @Test
    void weekendGap_silentWhenNothingChanged() {
        List<DetectorInput.CheckinDayPoint> checkins = new ArrayList<>();
        for (int i = 1; i <= 20; i++) {
            checkins.add(mentalOnly(DAY.minusDays(i), "6"));
        }
        DetectorInput in = trendOnly(DAY, new TrendBuilder().checkins(checkins).build());

        assertThat(new WeekendGapDetector().detect(in)).isEmpty();
    }
```
Run `-Dtest=DetectorTest` → FAIL (compile).

- [ ] **Step 2: `PeopleMoodLinkDetector`**
```java
package io.mrkuhne.mezo.feature.character.detector;

import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * People × mood link (round 4, spec §5.1) — a WITHIN-PERSON covariance in the comfort-eating
 * shape: is the user's own MENTAL check-in scale different on days with a people mention than on
 * days without one? Mention presence is the tag (any person, any context); the mood side is the
 * user's own scale, never the mention's LLM-filled tone. Exist.io's discipline: the sentence names
 * the difference AND an N-driven confidence tier separately, states co-occurrence, never
 * direction, and names no person.
 *
 * <p>No new-data pre-filter (spec §4.3): the state-change gate alone. State = the band or null,
 * so the signal fires when a band first appears or flips sign — a fading band is silent, exactly
 * like {@code ComfortEatingDetector}.
 */
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.CHARACTER_SWITCH, havingValue = "true")
public class PeopleMoodLinkDetector implements CharacterDetector {

    static final int WINDOW_DAYS = 42;
    static final int MIN_PAIRED_DAYS = 14;
    static final int MIN_DAYS_PER_GROUP = 3;
    static final double BAND_DELTA = 1.0;
    static final int TIER_MEDIUM_MIN = 8;
    static final int TIER_STRONG_MIN = 16;

    @Override
    public String key() {
        return "people-mood-link";
    }

    @Override
    public List<DetectorSignal> detect(DetectorInput in) {
        State today = state(in, in.day());
        State yesterday = state(in, in.day().minusDays(1));
        if (today == null || today.band().equals(yesterday == null ? "" : yesterday.band())) {
            return List.of();
        }
        String summary = "Az elmúlt 6 hét " + today.mentionDays() + " napján, amikor embert említettél, a mentális "
                + "check-in átlaga " + TrailingWindow.hu(today.mentionMean(), 1) + " volt, a " + today.otherDays()
                + " említés nélküli napon " + TrailingWindow.hu(today.otherMean(), 1) + " — " + today.band()
                + " együttjárás, " + today.tier() + " bizonyossággal (" + today.mentionDays()
                + " nap). Együttjárás, nem irány; embert nem nevez.";
        return List.of(new DetectorSignal(key(), "antropologus", summary, "erős".equals(today.tier()) ? 4 : 3));
    }

    record State(String band, int mentionDays, int otherDays, BigDecimal mentionMean, BigDecimal otherMean,
                 String tier) {}

    static State state(DetectorInput in, LocalDate asOf) {
        Set<LocalDate> mentionDates = new HashSet<>();
        for (DetectorInput.MentionPoint m : in.trend().mentions()) {
            if (TrailingWindow.inWindow(m.date(), asOf, WINDOW_DAYS)) {
                mentionDates.add(m.date());
            }
        }
        BigDecimal mentionSum = BigDecimal.ZERO;
        BigDecimal otherSum = BigDecimal.ZERO;
        int mentionDays = 0;
        int otherDays = 0;
        for (DetectorInput.CheckinDayPoint c : in.trend().checkinDays()) {
            if (c.mental() == null || !TrailingWindow.inWindow(c.date(), asOf, WINDOW_DAYS)) {
                continue;
            }
            if (mentionDates.contains(c.date())) {
                mentionDays++;
                mentionSum = mentionSum.add(c.mental());
            } else {
                otherDays++;
                otherSum = otherSum.add(c.mental());
            }
        }
        if (mentionDays + otherDays < MIN_PAIRED_DAYS || mentionDays < MIN_DAYS_PER_GROUP
                || otherDays < MIN_DAYS_PER_GROUP) {
            return null;
        }
        BigDecimal mentionMean = mentionSum.divide(BigDecimal.valueOf(mentionDays), 2, RoundingMode.HALF_UP);
        BigDecimal otherMean = otherSum.divide(BigDecimal.valueOf(otherDays), 2, RoundingMode.HALF_UP);
        double delta = mentionMean.doubleValue() - otherMean.doubleValue();
        String band;
        if (delta >= BAND_DELTA) {
            band = "magasabb";
        } else if (delta <= -BAND_DELTA) {
            band = "alacsonyabb";
        } else {
            return null;
        }
        String tier = mentionDays >= TIER_STRONG_MIN ? "erős" : mentionDays >= TIER_MEDIUM_MIN ? "közepes" : "gyenge";
        return new State(band, mentionDays, otherDays, mentionMean, otherMean, tier);
    }
}
```

- [ ] **Step 3: `MentionContextShiftDetector`**
```java
package io.mrkuhne.mezo.feature.character.detector;

import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Mention context shift (round 4, spec §5.2): which context the people mentions cluster in over
 * the trailing 28 days, and how large the conflict share is. Runs entirely on
 * {@code contextLabel} — the people feature's nightly classifier output, a closed DB-CHECK set —
 * never on the mention excerpt. The label is the SYSTEM's, so the sentence says so.
 *
 * <p>No new-data pre-filter (spec §4.3): a context can fade out of the window on a quiet day.
 * State = {@code <dominant>|<konfliktus band>}, both label-valued.
 */
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.CHARACTER_SWITCH, havingValue = "true")
public class MentionContextShiftDetector implements CharacterDetector {

    static final int WINDOW_DAYS = 28;
    static final int MIN_LABELLED = 6;
    static final double KONFLIKTUS_PRESENT_MIN = 0.10;
    static final double KONFLIKTUS_HIGH_MIN = 0.30;   // strictly above → "magas"
    static final String KONFLIKTUS = "konfliktus";

    private static final Map<String, String> LABEL_HU = Map.of(
            "munka", "munka", "csalad", "család", "baratok", "barátok", "edzes", "edzés",
            "konfliktus", "konfliktus", "kozos_program", "közös program", "segitseg", "segítség", "egyeb", "egyéb");

    @Override
    public String key() {
        return "mention-context-shift";
    }

    @Override
    public List<DetectorSignal> detect(DetectorInput in) {
        State today = state(in, in.day());
        State yesterday = state(in, in.day().minusDays(1));
        if (today == null || today.key().equals(yesterday == null ? "" : yesterday.key())) {
            return List.of();
        }
        String previous = yesterday == null
                ? "korábban ehhez még kevés volt a címkézett említés"
                : "korábban " + hu(yesterday.dominant()) + "/" + yesterday.band() + " volt";
        String summary = "Az elmúlt 4 hét " + today.labelled() + " címkézett említéséből a legtöbb " + hu(today.dominant())
                + "-kontextusú (" + TrailingWindow.pct(today.dominantShare()) + "%), a konfliktus-részarány "
                + TrailingWindow.pct(today.konfliktusShare()) + "% (" + today.band() + "); " + previous + ". "
                + today.unlabelled() + " említés még címkézetlen — a címkét a rendszer éjszakai osztályozója adja, nem te.";
        boolean roseToHigh = "magas".equals(today.band()) && (yesterday == null || !"magas".equals(yesterday.band()));
        return List.of(new DetectorSignal(key(), "antropologus", summary, roseToHigh ? 4 : 3));
    }

    private static String hu(String label) {
        return LABEL_HU.getOrDefault(label, label);
    }

    record State(String key, String dominant, double dominantShare, double konfliktusShare, String band,
                 int labelled, int unlabelled) {}

    static State state(DetectorInput in, LocalDate asOf) {
        Map<String, Integer> counts = new LinkedHashMap<>();
        int labelled = 0;
        int unlabelled = 0;
        for (DetectorInput.MentionPoint m : in.trend().mentions()) {
            if (!TrailingWindow.inWindow(m.date(), asOf, WINDOW_DAYS)) {
                continue;
            }
            if (m.contextLabel() == null) {
                unlabelled++;
            } else {
                labelled++;
                counts.merge(m.contextLabel(), 1, Integer::sum);
            }
        }
        if (labelled < MIN_LABELLED) {
            return null;
        }
        String dominant = null;
        int best = 0;
        for (Map.Entry<String, Integer> e : counts.entrySet()) {
            // Ties resolve to the alphabetically first label so the state is stable across runs.
            if (e.getValue() > best || (e.getValue() == best && dominant != null && e.getKey().compareTo(dominant) < 0)) {
                best = e.getValue();
                dominant = e.getKey();
            }
        }
        double konfliktusShare = (double) counts.getOrDefault(KONFLIKTUS, 0) / labelled;
        String band = konfliktusShare > KONFLIKTUS_HIGH_MIN ? "magas"
                : konfliktusShare >= KONFLIKTUS_PRESENT_MIN ? "jelen" : "nincs";
        return new State(dominant + "|" + band, dominant, (double) best / labelled, konfliktusShare, band,
                labelled, unlabelled);
    }
}
```

- [ ] **Step 4: `WeekendGapDetector`**
```java
package io.mrkuhne.mezo.feature.character.detector;

import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Weekend gap (round 4, spec §5.3): two deterministic halves of "how much does the week split in
 * two". (a) Social jetlag in Roenneberg's definition — |midsleep on free nights − midsleep on work
 * nights| from the sleep log's own bedtime/wakeup clocks, 1 h / 2 h bands; free night = a sleep
 * row dated Saturday or Sunday (the row's date is the wake-up day). (b) A logging-coverage gap:
 * the share of weekend days with ANY log (meal, check-in, water) vs. the weekday share.
 *
 * <p>Weekend is Saturday/Sunday in the server zone — the system holds no obligation schedule and
 * no timezone (an accepted, stated limitation). No new-data pre-filter (spec §4.3). State =
 * {@code <jetlag band>|<gap flag>}, never null: the coverage half is always computable.
 */
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.CHARACTER_SWITCH, havingValue = "true")
public class WeekendGapDetector implements CharacterDetector {

    static final int WINDOW_DAYS = 49;
    static final int MIN_FREE_NIGHTS = 6;
    static final int MIN_WORK_NIGHTS = 15;
    static final int JETLAG_MODERATE_MIN = 60;
    static final int JETLAG_HIGH_MIN = 120;
    static final double COVERAGE_GAP_MIN = 0.25;
    private static final int MINUTES_PER_DAY = 1440;

    @Override
    public String key() {
        return "weekend-gap";
    }

    @Override
    public List<DetectorSignal> detect(DetectorInput in) {
        State today = state(in, in.day());
        State yesterday = state(in, in.day().minusDays(1));
        if (today.key().equals(yesterday.key())) {
            return List.of();
        }
        String sleepPart;
        if ("keves".equals(today.jetlagBand())) {
            sleepPart = "Az alvásközép-eltoláshoz még kevés a hétvégi alvásnapló (" + today.freeNights()
                    + " szabad-éjszaka; legalább " + MIN_FREE_NIGHTS + " szabad és " + MIN_WORK_NIGHTS
                    + " munkaéjszaka kell).";
        } else {
            String bandHu = switch (today.jetlagBand()) {
                case "jelentos" -> "jelentős";
                case "mersekelt" -> "mérsékelt";
                default -> "nincs érdemi";
            };
            sleepPart = "Hétvégén az alvásközéped átlag " + Math.abs(today.jetlagMinutes()) + " perccel "
                    + (today.jetlagMinutes() >= 0 ? "később" : "korábban") + " esik, mint hétköznap — " + bandHu
                    + " social jetlag a Roenneberg-sávok szerint, " + today.freeNights() + " szabad- és "
                    + today.workNights() + " munkaéjszakából.";
        }
        String gapPart = " A logolás hétvégén a napok " + TrailingWindow.pct(today.weekendCoverage()) + "%-án történt, hétköznap "
                + TrailingWindow.pct(today.weekdayCoverage()) + "%-án"
                + ("res".equals(today.gapFlag()) ? " — hétvégi rés." : ", nincs érdemi rés.")
                + " Hétvége itt szombat–vasárnap.";
        boolean loud = "jelentos".equals(today.jetlagBand()) || "res".equals(today.gapFlag());
        return List.of(new DetectorSignal(key(), "antropologus", sleepPart + gapPart, loud ? 4 : 3));
    }

    /** Midsleep as minutes after midnight, wrapping a wake-up on the next calendar day. */
    static int midsleepMinutes(LocalTime bedtime, LocalTime wakeup) {
        int bed = bedtime.toSecondOfDay() / 60;
        int wake = wakeup.toSecondOfDay() / 60;
        if (wake <= bed) {
            wake += MINUTES_PER_DAY;
        }
        return ((bed + wake) / 2) % MINUTES_PER_DAY;
    }

    private static boolean weekend(LocalDate d) {
        return d.getDayOfWeek() == DayOfWeek.SATURDAY || d.getDayOfWeek() == DayOfWeek.SUNDAY;
    }

    record State(String key, String jetlagBand, int jetlagMinutes, int freeNights, int workNights,
                 String gapFlag, double weekendCoverage, double weekdayCoverage) {}

    static State state(DetectorInput in, LocalDate asOf) {
        List<Integer> free = new ArrayList<>();
        List<Integer> work = new ArrayList<>();
        for (DetectorInput.SleepPoint s : in.trend().sleepEightWeeks()) {
            if (s.bedtime() == null || s.wakeup() == null || !TrailingWindow.inWindow(s.date(), asOf, WINDOW_DAYS)) {
                continue;
            }
            (weekend(s.date()) ? free : work).add(midsleepMinutes(s.bedtime(), s.wakeup()));
        }
        String jetlagBand = "keves";
        int jetlagMinutes = 0;
        if (free.size() >= MIN_FREE_NIGHTS && work.size() >= MIN_WORK_NIGHTS) {
            jetlagMinutes = (int) Math.round(mean(free) - mean(work));
            int abs = Math.abs(jetlagMinutes);
            jetlagBand = abs >= JETLAG_HIGH_MIN ? "jelentos" : abs >= JETLAG_MODERATE_MIN ? "mersekelt" : "nincs";
        }

        Set<LocalDate> logged = new HashSet<>();
        in.trend().mealDays().forEach(m -> logged.add(m.date()));
        in.trend().checkinDays().forEach(c -> logged.add(c.date()));
        in.trend().waterDays().forEach(w -> logged.add(w.date()));
        int weekendDays = 0;
        int weekendLogged = 0;
        int weekdayDays = 0;
        int weekdayLogged = 0;
        for (LocalDate d = asOf.minusDays(WINDOW_DAYS - 1L); !d.isAfter(asOf); d = d.plusDays(1)) {
            boolean isLogged = logged.contains(d);
            if (weekend(d)) {
                weekendDays++;
                weekendLogged += isLogged ? 1 : 0;
            } else {
                weekdayDays++;
                weekdayLogged += isLogged ? 1 : 0;
            }
        }
        double weekendCoverage = weekendDays == 0 ? 0 : (double) weekendLogged / weekendDays;
        double weekdayCoverage = weekdayDays == 0 ? 0 : (double) weekdayLogged / weekdayDays;
        String gapFlag = weekdayCoverage - weekendCoverage >= COVERAGE_GAP_MIN ? "res" : "nincs-res";
        return new State(jetlagBand + "|" + gapFlag, jetlagBand, jetlagMinutes, free.size(), work.size(),
                gapFlag, weekendCoverage, weekdayCoverage);
    }

    private static double mean(List<Integer> values) {
        double sum = 0;
        for (int v : values) {
            sum += v;
        }
        return sum / values.size();
    }
}
```

- [ ] **Step 5: Run `-Dtest=DetectorTest`** → all green. If a fixture fails, re-derive the fixture from the thresholds above (never change a threshold) and write the corrected arithmetic in the test comment.

- [ ] **Step 6: Commit**
```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/character/detector backend/src/test/java/io/mrkuhne/mezo/feature/character/detector
git commit -m "feat(character): people-mood-link, mention-context-shift, weekend-gap detectors (mezo-1gim.15)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: `chat-topic-shift` + `ChatToolDomains`

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/character/detector/ChatToolDomains.java`, `ChatTopicShiftDetector.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/character/detector/DetectorTest.java`

**Interfaces:**
- Consumes: `DetectorInput.ChatToolCallPoint`, `TrendBuilder.toolCalls(...)` (Task 3).
- Produces: `ChatToolDomains.domainOf(String toolName)` (null for unknown), `ChatToolDomains.hu(String domain)`; detector key `chat-topic-shift`, `expertKey = "pszichologus"`.

- [ ] **Step 1: Failing tests**
```java
    private static DetectorInput.ChatToolCallPoint toolCall(LocalDate d, String conv, String tool, String title) {
        return new DetectorInput.ChatToolCallPoint(d, UUID.nameUUIDFromBytes(conv.getBytes()), tool, title);
    }

    @Test
    void chatToolDomains_mapsBakedArgsAndUnknownsHonestly() {
        assertThat(ChatToolDomains.domainOf("get_recovery(days=7)")).isEqualTo("alvas");
        assertThat(ChatToolDomains.domainOf("get_training_log")).isEqualTo("edzes");
        assertThat(ChatToolDomains.domainOf("compare_periods")).isEqualTo("mintak");
        assertThat(ChatToolDomains.domainOf("get_medication")).isEqualTo("gyogyszer");
        assertThat(ChatToolDomains.domainOf("something_new")).isNull();
        assertThat(ChatToolDomains.hu("cel")).isEqualTo("cél és growth");
    }

    @Test
    void chatTopicShift_firesWhenADominantDomainFirstAppears_withTwoTitlesAsEvidence() {
        List<DetectorInput.ChatToolCallPoint> calls = new ArrayList<>();
        for (int i = 0; i < 7; i++) {
            calls.add(toolCall(DAY, i < 4 ? "c1" : "c2", "get_training_log(days=14)",
                    i < 4 ? "Hogy ment a heti edzés?" : "Mit mutat a mellnyomás rekordom?"));
        }
        for (int i = 0; i < 3; i++) {
            calls.add(toolCall(DAY, "c3", "get_fuel_log", "Ettem eleget fehérjét?"));
        }
        DetectorInput in = trendOnly(DAY, new TrendBuilder().toolCalls(calls).build());

        List<DetectorSignal> fired = new ChatTopicShiftDetector().detect(in);

        assertThat(fired).singleElement().satisfies(s -> {
            assertThat(s.detectorKey()).isEqualTo("chat-topic-shift");
            assertThat(s.expertKey()).isEqualTo("pszichologus");
            assertThat(s.summary()).contains("70%").contains("edzés").contains("7 eszközhívás")
                    .contains("nem volt kirajzolódó fő téma").contains("„Hogy ment a heti edzés?”")
                    .contains("„Mit mutat a mellnyomás rekordom?”").doesNotContain("fehérjét");
            assertThat(s.salience()).isEqualTo(3);
        });
    }

    @Test
    void chatTopicShift_silentBelowTheDominantShare_andBelowTenCalls() {
        List<DetectorInput.ChatToolCallPoint> spread = new ArrayList<>();
        String[] tools = {"get_training_log", "get_training_log", "get_training_log",
                "get_fuel_log", "get_fuel_log", "get_fuel_log", "get_recovery", "get_recovery", "get_goal", "get_goal"};
        for (String t : tools) {
            spread.add(toolCall(DAY, "c", t, "t"));    // best share 3/10 = 30% < 40%
        }
        assertThat(new ChatTopicShiftDetector().detect(trendOnly(DAY, new TrendBuilder().toolCalls(spread).build())))
                .isEmpty();

        List<DetectorInput.ChatToolCallPoint> few = new ArrayList<>();
        for (int i = 0; i < 9; i++) {
            few.add(toolCall(DAY, "c", "get_training_log", "t"));
        }
        assertThat(new ChatTopicShiftDetector().detect(trendOnly(DAY, new TrendBuilder().toolCalls(few).build())))
                .isEmpty();
    }

    @Test
    void chatTopicShift_evidencePicksTheTwoMostRecentConversationsDeterministically() {
        List<DetectorInput.ChatToolCallPoint> calls = new ArrayList<>();
        for (int i = 0; i < 4; i++) {
            calls.add(toolCall(DAY.minusDays(2), "old", "get_recovery", "Régi alvás-kérdés"));
            calls.add(toolCall(DAY.minusDays(1), "mid", "get_recovery", "Középső alvás-kérdés"));
            calls.add(toolCall(DAY, "new", "get_recovery", "Friss alvás-kérdés"));
        }
        DetectorInput in = trendOnly(DAY, new TrendBuilder().toolCalls(calls).build());

        // as of DAY-1: 8 calls (< 10) → null; as of DAY: 12 → alvas 100% → fires
        List<DetectorSignal> fired = new ChatTopicShiftDetector().detect(in);

        assertThat(fired).singleElement().satisfies(s -> assertThat(s.summary())
                .contains("„Friss alvás-kérdés”, „Középső alvás-kérdés”").doesNotContain("Régi"));
    }
```
Run → FAIL (compile).

- [ ] **Step 2: `ChatToolDomains`**
```java
package io.mrkuhne.mezo.feature.character.detector;

import java.util.Map;

/**
 * The companion's 17 read tools → 7 topic domains (round-4 spec §5.4). A deterministic topic
 * proxy: what the assistant had to LOOK UP says what the conversation was about, without any
 * detector-side reading of the message text. Mirrors {@code frontend/src/features/insights/logic/
 * toolDomains.ts}; keep the two in step when a tool is added. The wire bakes args into the name
 * ({@code get_recovery(days=3)}) — the name is cut at the first '('.
 */
final class ChatToolDomains {
    private ChatToolDomains() {}

    private static final Map<String, String> DOMAIN_OF = Map.ofEntries(
            Map.entry("get_weight_log", "suly"), Map.entry("get_weight_trend", "suly"),
            Map.entry("get_recovery", "alvas"),
            Map.entry("get_fuel_log", "fuel"), Map.entry("get_pantry", "fuel"),
            Map.entry("get_recipes", "fuel"), Map.entry("get_protocol", "fuel"),
            Map.entry("get_training_log", "edzes"), Map.entry("get_training_plan", "edzes"),
            Map.entry("get_exercise_records", "edzes"),
            Map.entry("get_goal", "cel"), Map.entry("get_growth", "cel"), Map.entry("get_daily_practice", "cel"),
            Map.entry("get_insights", "mintak"), Map.entry("find_similar_past_days", "mintak"),
            Map.entry("compare_periods", "mintak"),
            Map.entry("get_medication", "gyogyszer"));

    private static final Map<String, String> HU = Map.of(
            "suly", "súly", "alvas", "alvás", "fuel", "fuel", "edzes", "edzés",
            "cel", "cél és growth", "mintak", "minták és emlékek", "gyogyszer", "gyógyszer");

    /** The domain key, or null for a tool this map does not know (never a guess). */
    static String domainOf(String toolName) {
        if (toolName == null) {
            return null;
        }
        int paren = toolName.indexOf('(');
        String base = (paren == -1 ? toolName : toolName.substring(0, paren)).strip();
        return DOMAIN_OF.get(base);
    }

    static String hu(String domain) {
        return HU.getOrDefault(domain, domain);
    }
}
```

- [ ] **Step 3: `ChatTopicShiftDetector`**
```java
package io.mrkuhne.mezo.feature.character.detector;

import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Chat topic shift (round 4, spec §5.4): which domain the user's conversations with the companion
 * revolve around, from the assistant's executed tool calls over the trailing 28 days. The state is
 * the dominant domain; the "shift" IS the state change (yesterday's dominant domain is the
 * "korábban" clause). Two conversation titles ride along as bounded evidence — never parsed.
 * No new-data pre-filter (spec §4.3): a domain can fall out of the window on a quiet day.
 */
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.CHARACTER_SWITCH, havingValue = "true")
public class ChatTopicShiftDetector implements CharacterDetector {

    static final int WINDOW_DAYS = 28;
    static final int MIN_CALLS = 10;
    static final double DOMINANT_MIN_SHARE = 0.40;
    static final int EVIDENCE_MAX = 2;

    @Override
    public String key() {
        return "chat-topic-shift";
    }

    @Override
    public List<DetectorSignal> detect(DetectorInput in) {
        State today = state(in, in.day());
        State yesterday = state(in, in.day().minusDays(1));
        if (today == null || today.domain().equals(yesterday == null ? "" : yesterday.domain())) {
            return List.of();
        }
        StringBuilder sb = new StringBuilder("Az elmúlt 4 hétben a társsal folytatott beszélgetéseid ")
                .append(TrailingWindow.pct(today.share())).append("%-a a(z) ").append(ChatToolDomains.hu(today.domain()))
                .append(" körül forgott (").append(today.calls()).append(" eszközhívás a ").append(today.total())
                .append("-ból); korábban ")
                .append(yesterday == null ? "nem volt kirajzolódó fő téma." : "a(z) " + ChatToolDomains.hu(yesterday.domain()) + " volt az első.");
        if (today.evidence().size() == 2) {
            sb.append(" Két friss beszélgetés: „").append(today.evidence().get(0)).append("”, „")
                    .append(today.evidence().get(1)).append("”.");
        } else if (today.evidence().size() == 1) {
            sb.append(" Egy friss beszélgetés: „").append(today.evidence().get(0)).append("”.");
        }
        return List.of(new DetectorSignal(key(), "pszichologus", sb.toString(), 3));
    }

    record State(String domain, int calls, int total, double share, List<String> evidence) {}

    private record ConversationHit(UUID id, LocalDate latest, String title) {}

    static State state(DetectorInput in, LocalDate asOf) {
        Map<String, Integer> counts = new LinkedHashMap<>();
        List<DetectorInput.ChatToolCallPoint> mapped = new ArrayList<>();
        for (DetectorInput.ChatToolCallPoint c : in.trend().chatToolCalls()) {
            String domain = ChatToolDomains.domainOf(c.toolName());
            if (domain == null || !TrailingWindow.inWindow(c.date(), asOf, WINDOW_DAYS)) {
                continue;
            }
            counts.merge(domain, 1, Integer::sum);
            mapped.add(c);
        }
        int total = mapped.size();
        if (total < MIN_CALLS) {
            return null;
        }
        String dominant = null;
        int best = 0;
        for (Map.Entry<String, Integer> e : counts.entrySet()) {
            if (e.getValue() > best || (e.getValue() == best && dominant != null && e.getKey().compareTo(dominant) < 0)) {
                best = e.getValue();
                dominant = e.getKey();
            }
        }
        double share = (double) best / total;
        if (share < DOMINANT_MIN_SHARE) {
            return null;
        }
        Map<UUID, ConversationHit> byConversation = new LinkedHashMap<>();
        for (DetectorInput.ChatToolCallPoint c : mapped) {
            if (!dominant.equals(ChatToolDomains.domainOf(c.toolName())) || c.conversationId() == null) {
                continue;
            }
            ConversationHit prev = byConversation.get(c.conversationId());
            if (prev == null || c.date().isAfter(prev.latest())) {
                byConversation.put(c.conversationId(), new ConversationHit(c.conversationId(), c.date(), c.titlePreview()));
            }
        }
        List<String> evidence = byConversation.values().stream()
                .sorted(Comparator.comparing(ConversationHit::latest).reversed()
                        .thenComparing(h -> h.id().toString()))
                .map(ConversationHit::title)
                .filter(t -> t != null && !t.isBlank())
                .limit(EVIDENCE_MAX)
                .toList();
        return new State(dominant, best, total, share, evidence);
    }
}
```

- [ ] **Step 4: Run `-Dtest=DetectorTest`** → green; commit:
```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/character/detector backend/src/test/java/io/mrkuhne/mezo/feature/character/detector
git commit -m "feat(character): chat-topic-shift detector over the assistant's tool-call domains (mezo-1gim.15)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: The four Szkeptikus detectors (META) + the switch-off bean pin

**Files:**
- Create: `.../character/detector/KnowledgeRejectionPatternDetector.java`, `PredictionCalibrationDetector.java`, `QuestCompletionCalibrationDetector.java`, `ExperimentOutcomeLedgerDetector.java`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/feature/character/CharacterApiSwitchOffIT.java` (add `getBeanProvider(X.class).getIfAvailable()).isNull()` lines for all EIGHT round-4 detectors)
- Test: `DetectorTest.java`

**Interfaces:**
- Consumes: `DetectorInput.MetaWindow` + its four point records (Task 3), `TrendBuilder.meta(...)`.
- Produces: keys `knowledge-rejection-pattern`, `prediction-calibration`, `quest-completion-calibration`, `experiment-outcome-ledger`, all `expertKey = "szkeptikus"`.

Every summary's grammatical subject is the SYSTEM ("javaslatom", "predikcióm", "kínálatom"); each ends with the honesty clause given below. No pre-filter.

- [ ] **Step 1: Failing tests** (helpers + cases):
```java
    private static DetectorInput.MetaWindow meta(List<DetectorInput.TriageDecisionPoint> t,
            List<DetectorInput.PredictionPoint> p, List<DetectorInput.QuestPoint> q,
            List<DetectorInput.ProposalOutcomePoint> o) {
        return new DetectorInput.MetaWindow(t, p, q, o);
    }

    private static DetectorInput.TriageDecisionPoint triage(LocalDate d, String category, String decision, boolean refined) {
        return new DetectorInput.TriageDecisionPoint(d, "fact", category, decision, refined);
    }

    private static DetectorInput.PredictionPoint prediction(LocalDate validTo, String status, String confidence) {
        return new DetectorInput.PredictionPoint(validTo.minusDays(6), validTo, status,
                confidence == null ? null : new BigDecimal(confidence), "sleep_avg");
    }

    private static DetectorInput.QuestPoint quest(LocalDate d, String slot, String status) {
        return new DetectorInput.QuestPoint(d, slot, status);
    }

    private static DetectorInput.ProposalOutcomePoint outcome(LocalDate d, String kind, String status, Boolean good) {
        return new DetectorInput.ProposalOutcomePoint(d, kind, status, good);
    }

    // ── knowledge-rejection-pattern ─────────────────────────────────────────────

    @Test
    void knowledgeRejection_firesOnTheRejectingBand_namingTheDominantCategory() {
        List<DetectorInput.TriageDecisionPoint> t = List.of(
                triage(DAY, "life", "kept", true),
                triage(DAY, "fuel", "rejected", false), triage(DAY, "fuel", "rejected", false),
                triage(DAY, "fuel", "rejected", false), triage(DAY, "fuel", "rejected", false),
                triage(DAY, "life", "rejected", false));
        DetectorInput in = trendOnly(DAY, new TrendBuilder().meta(meta(t, List.of(), List.of(), List.of())).build());

        List<DetectorSignal> fired = new KnowledgeRejectionPatternDetector().detect(in);

        assertThat(fired).singleElement().satisfies(s -> {
            assertThat(s.detectorKey()).isEqualTo("knowledge-rejection-pattern");
            assertThat(s.expertKey()).isEqualTo("szkeptikus");
            assertThat(s.summary()).contains("6 javaslatomról").contains("1 megtartva (1 finomítva)")
                    .contains("5 elutasítva").contains("17%").contains("főleg fuel")
                    .contains("nem a te tulajdonságodról").contains("keletkezési napjával közelítem");
            assertThat(s.salience()).isEqualTo(4);
        });
    }

    @Test
    void knowledgeRejection_silentBelowFiveDecisions() {
        List<DetectorInput.TriageDecisionPoint> t = List.of(
                triage(DAY, "fuel", "rejected", false), triage(DAY, "fuel", "rejected", false),
                triage(DAY, "fuel", "rejected", false), triage(DAY, "fuel", "rejected", false));
        DetectorInput in = trendOnly(DAY, new TrendBuilder().meta(meta(t, List.of(), List.of(), List.of())).build());

        assertThat(new KnowledgeRejectionPatternDetector().detect(in)).isEmpty();
    }

    @Test
    void knowledgeRejection_firesOnABandShift_fromMegtartoToVegyes() {
        List<DetectorInput.TriageDecisionPoint> t = new ArrayList<>();
        for (int i = 1; i <= 5; i++) {
            t.add(triage(DAY.minusDays(i), "train", "kept", false));        // as of DAY-1: 5/5 → megtarto|-
        }
        t.add(triage(DAY, "fuel", "rejected", false));
        t.add(triage(DAY, "fuel", "rejected", false));
        t.add(triage(DAY, "fuel", "rejected", false));
        t.add(triage(DAY, "life", "rejected", false));                       // as of DAY: 5/9 = 56% → vegyes|fuel
        DetectorInput in = trendOnly(DAY, new TrendBuilder().meta(meta(t, List.of(), List.of(), List.of())).build());

        List<DetectorSignal> fired = new KnowledgeRejectionPatternDetector().detect(in);

        assertThat(fired).singleElement().satisfies(s -> {
            assertThat(s.summary()).contains("9 javaslatomról").contains("56%").contains("főleg fuel");
            assertThat(s.salience()).isEqualTo(3);
        });
    }

    // ── prediction-calibration ──────────────────────────────────────────────────

    @Test
    void predictionCalibration_firesOverconfident() {
        // validTo = DAY-1: closed as of DAY (validTo < DAY), still open as of DAY-1 → null → fires.
        List<DetectorInput.PredictionPoint> p = List.of(
                prediction(DAY.minusDays(1), "validated", "0.80"), prediction(DAY.minusDays(1), "validated", "0.80"),
                prediction(DAY.minusDays(1), "missed", "0.80"), prediction(DAY.minusDays(1), "missed", "0.80"),
                prediction(DAY.minusDays(1), "missed", "0.80"),
                prediction(DAY.minusDays(1), "pending", "0.80"), prediction(DAY.minusDays(1), "pending", null));
        DetectorInput in = trendOnly(DAY, new TrendBuilder().meta(meta(List.of(), p, List.of(), List.of())).build());

        List<DetectorSignal> fired = new PredictionCalibrationDetector().detect(in);

        assertThat(fired).singleElement().satisfies(s -> {
            assertThat(s.detectorKey()).isEqualTo("prediction-calibration");
            assertThat(s.expertKey()).isEqualTo("szkeptikus");
            assertThat(s.summary()).contains("5 predikcióm zárult").contains("2 talált, 3 nem (40%)")
                    .contains("80% magabiztosságot").contains("túlbiztos voltam")
                    .contains("2 további lejárt adat nélkül").contains("érvényesség vége utáni nap");
            assertThat(s.salience()).isEqualTo(4);
        });
    }

    @Test
    void predictionCalibration_reportsMissingConfidenceHonestly() {
        List<DetectorInput.PredictionPoint> p = List.of(
                prediction(DAY.minusDays(1), "validated", null), prediction(DAY.minusDays(1), "validated", "0.60"),
                prediction(DAY.minusDays(1), "missed", null), prediction(DAY.minusDays(1), "missed", null));
        DetectorInput in = trendOnly(DAY, new TrendBuilder().meta(meta(List.of(), p, List.of(), List.of())).build());

        List<DetectorSignal> fired = new PredictionCalibrationDetector().detect(in);

        assertThat(fired).singleElement().satisfies(s -> {
            assertThat(s.summary()).contains("4 predikcióm zárult").contains("(50%)")
                    .contains("nem mondtam magabiztosságot").contains("kalibrációt nem tudok mérni");
            assertThat(s.salience()).isEqualTo(3);
        });
    }

    @Test
    void predictionCalibration_silentBelowFourResolved_andWhileStillOpen() {
        List<DetectorInput.PredictionPoint> few = List.of(
                prediction(DAY.minusDays(1), "validated", "0.8"), prediction(DAY.minusDays(1), "missed", "0.8"),
                prediction(DAY.minusDays(1), "missed", "0.8"));
        assertThat(new PredictionCalibrationDetector().detect(
                trendOnly(DAY, new TrendBuilder().meta(meta(List.of(), few, List.of(), List.of())).build()))).isEmpty();

        List<DetectorInput.PredictionPoint> open = List.of(
                prediction(DAY, "validated", "0.8"), prediction(DAY, "validated", "0.8"),
                prediction(DAY, "missed", "0.8"), prediction(DAY, "missed", "0.8"));
        assertThat(new PredictionCalibrationDetector().detect(
                trendOnly(DAY, new TrendBuilder().meta(meta(List.of(), open, List.of(), List.of())).build()))).isEmpty();
    }

    // ── quest-completion-calibration ────────────────────────────────────────────

    @Test
    void questCalibration_firesWhenASlotLandsLow() {
        List<DetectorInput.QuestPoint> q = new ArrayList<>();
        for (int i = 0; i < 6; i++) {
            q.add(quest(DAY.minusDays(1), "GROWTH", i < 2 ? "completed" : "expired"));   // 2/6 = 33% → alacsony
        }
        DetectorInput in = trendOnly(DAY, new TrendBuilder().meta(meta(List.of(), List.of(), q, List.of())).build());

        List<DetectorSignal> fired = new QuestCompletionCalibrationDetector().detect(in);

        assertThat(fired).singleElement().satisfies(s -> {
            assertThat(s.detectorKey()).isEqualTo("quest-completion-calibration");
            assertThat(s.expertKey()).isEqualTo("szkeptikus");
            assertThat(s.summary()).contains("BODY: kevés quest (0)").contains("FUELBIO: kevés quest (0)")
                    .contains("GROWTH 2/6 (33%)").contains("GROWTH slotban a nehézség-kalibrációm túllőtt")
                    .contains("85% / 50%").contains("szövegét nem olvasom");
            assertThat(s.salience()).isEqualTo(4);
        });
    }

    @Test
    void questCalibration_todayAndRerolledAreExcluded_thinSlotsStaySilent() {
        List<DetectorInput.QuestPoint> today = new ArrayList<>();
        for (int i = 0; i < 6; i++) {
            today.add(quest(DAY, "GROWTH", "expired"));
        }
        assertThat(new QuestCompletionCalibrationDetector().detect(
                trendOnly(DAY, new TrendBuilder().meta(meta(List.of(), List.of(), today, List.of())).build()))).isEmpty();

        List<DetectorInput.QuestPoint> rerolled = new ArrayList<>();
        for (int i = 0; i < 6; i++) {
            rerolled.add(quest(DAY.minusDays(1), "BODY", i < 2 ? "completed" : i < 4 ? "expired" : "rerolled"));  // n = 4 → kevés
        }
        assertThat(new QuestCompletionCalibrationDetector().detect(
                trendOnly(DAY, new TrendBuilder().meta(meta(List.of(), List.of(), rerolled, List.of())).build()))).isEmpty();
    }

    @Test
    void questCalibration_bandShiftFires_highBandWorded() {
        List<DetectorInput.QuestPoint> q = new ArrayList<>();
        for (int i = 1; i <= 5; i++) {
            q.add(quest(DAY.minusDays(i + 1), "BODY", "completed"));        // as of DAY-1: 5/5 → magas
        }
        q.add(quest(DAY.minusDays(1), "BODY", "expired"));                   // as of DAY: 5/6 = 83% → közép
        DetectorInput in = trendOnly(DAY, new TrendBuilder().meta(meta(List.of(), List.of(), q, List.of())).build());

        List<DetectorSignal> fired = new QuestCompletionCalibrationDetector().detect(in);

        assertThat(fired).singleElement().satisfies(s -> {
            assertThat(s.summary()).contains("BODY 5/6 (83%)").doesNotContain("túllőtt");
            assertThat(s.salience()).isEqualTo(3);
        });
    }

    // ── experiment-outcome-ledger ───────────────────────────────────────────────

    @Test
    void experimentLedger_firesWeak() {
        List<DetectorInput.ProposalOutcomePoint> o = List.of(
                outcome(DAY, "challenge", "hit", true), outcome(DAY, "challenge", "miss", false),
                outcome(DAY, "challenge", "miss", false), outcome(DAY, "experiment", "completed", null));
        DetectorInput in = trendOnly(DAY, new TrendBuilder().meta(meta(List.of(), List.of(), List.of(), o)).build());

        List<DetectorSignal> fired = new ExperimentOutcomeLedgerDetector().detect(in);

        assertThat(fired).singleElement().satisfies(s -> {
            assertThat(s.detectorKey()).isEqualTo("experiment-outcome-ledger");
            assertThat(s.expertKey()).isEqualTo("szkeptikus");
            assertThat(s.summary()).contains("4 lezárt javaslatomból (1 kísérlet, 3 kihívás) 1 járt jó kimenettel")
                    .contains("1 eldönthetetlen").contains("0 javaslatot elvetettél")
                    .contains("nem a te vállalkozó kedved");
            assertThat(s.salience()).isEqualTo(4);
        });
    }

    @Test
    void experimentLedger_firesOnADismissedMajority_evenWhenJudgedIsThin() {
        List<DetectorInput.ProposalOutcomePoint> o = List.of(
                outcome(DAY, "experiment", "dismissed", null), outcome(DAY, "experiment", "dismissed", null),
                outcome(DAY, "experiment", "dismissed", null), outcome(DAY, "experiment", "completed", true));
        DetectorInput in = trendOnly(DAY, new TrendBuilder().meta(meta(List.of(), List.of(), List.of(), o)).build());

        List<DetectorSignal> fired = new ExperimentOutcomeLedgerDetector().detect(in);

        assertThat(fired).singleElement().satisfies(s -> {
            assertThat(s.summary()).contains("1 javaslatom zárult").contains("1 jó kimenettel")
                    .contains("még kevés az ítélethez").contains("3 javaslatot elvetettél indulás előtt");
            assertThat(s.salience()).isEqualTo(4);
        });
    }

    @Test
    void experimentLedger_silentWhenThin_andWhenUnchanged() {
        List<DetectorInput.ProposalOutcomePoint> thin = List.of(
                outcome(DAY, "challenge", "hit", true), outcome(DAY, "challenge", "miss", false));
        assertThat(new ExperimentOutcomeLedgerDetector().detect(
                trendOnly(DAY, new TrendBuilder().meta(meta(List.of(), List.of(), List.of(), thin)).build()))).isEmpty();

        List<DetectorInput.ProposalOutcomePoint> old = List.of(
                outcome(DAY.minusDays(3), "challenge", "hit", true), outcome(DAY.minusDays(3), "challenge", "hit", true),
                outcome(DAY.minusDays(3), "challenge", "miss", false));
        assertThat(new ExperimentOutcomeLedgerDetector().detect(
                trendOnly(DAY, new TrendBuilder().meta(meta(List.of(), List.of(), List.of(), old)).build()))).isEmpty();
    }
```
Run → FAIL (compile).

- [ ] **Step 2: `KnowledgeRejectionPatternDetector`**
```java
package io.mrkuhne.mezo.feature.character.detector;

import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Knowledge rejection pattern (round 4, spec §5.5) — SENSITIVE, and a claim ABOUT THE SYSTEM: what
 * share of the companion's proposed facts and patterns the user kept over the trailing 28 days.
 * Acceptance rate is a weak trust proxy (a rejection can mean "wrong", "redundant" or "not
 * needed"), so the sentence reads as the system's hit rate, never as a trait of the user, and
 * names the proxy it uses for the fact decision date. Owned by the Szkeptikus (META dimension).
 * No new-data pre-filter (spec §4.3).
 */
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.CHARACTER_SWITCH, havingValue = "true")
public class KnowledgeRejectionPatternDetector implements CharacterDetector {

    static final int WINDOW_DAYS = 28;
    static final int MIN_DECISIONS = 5;
    static final double KEPT_HIGH_MIN = 0.70;
    static final double KEPT_LOW_MIN = 0.40;
    static final int MIN_REJECTS_FOR_CATEGORY = 3;
    static final double CATEGORY_SHARE_MIN = 0.50;

    private static final Map<String, String> CATEGORY_HU = Map.of(
            "train", "edzés", "fuel", "fuel", "health", "egészség", "life", "élet", "minta", "minta");

    @Override
    public String key() {
        return "knowledge-rejection-pattern";
    }

    @Override
    public List<DetectorSignal> detect(DetectorInput in) {
        State today = state(in, in.day());
        State yesterday = state(in, in.day().minusDays(1));
        if (today == null || today.key().equals(yesterday == null ? "" : yesterday.key())) {
            return List.of();
        }
        String summary = "Az elmúlt 4 hétben " + today.n() + " javaslatomról döntöttél: " + today.kept() + " megtartva ("
                + today.refined() + " finomítva), " + today.rejected() + " elutasítva — "
                + TrailingWindow.pct((double) today.kept() / today.n()) + "% találati arány"
                + ("-".equals(today.category()) ? "" : ", az elutasítások főleg "
                        + CATEGORY_HU.getOrDefault(today.category(), today.category()) + " kategóriából")
                + ". Ez az én javaslataim minőségéről szól, nem a te tulajdonságodról. A tény-jelöltek döntésnapját "
                + "a jelölt keletkezési napjával közelítem.";
        return List.of(new DetectorSignal(key(), "szkeptikus", summary, "elutasito".equals(today.band()) ? 4 : 3));
    }

    record State(String key, String band, String category, int n, int kept, int refined, int rejected) {}

    static State state(DetectorInput in, LocalDate asOf) {
        int kept = 0;
        int refined = 0;
        int rejected = 0;
        Map<String, Integer> rejectedByCategory = new LinkedHashMap<>();
        for (DetectorInput.TriageDecisionPoint t : in.trend().meta().triageDecisions()) {
            if (!TrailingWindow.inWindow(t.date(), asOf, WINDOW_DAYS)) {
                continue;
            }
            if ("rejected".equals(t.decision())) {
                rejected++;
                rejectedByCategory.merge(t.category() == null ? "-" : t.category(), 1, Integer::sum);
            } else {
                kept++;
                if (t.refined()) {
                    refined++;
                }
            }
        }
        int n = kept + rejected;
        if (n < MIN_DECISIONS) {
            return null;
        }
        double keptShare = (double) kept / n;
        String band = keptShare >= KEPT_HIGH_MIN ? "megtarto" : keptShare >= KEPT_LOW_MIN ? "vegyes" : "elutasito";
        String category = "-";
        if (rejected >= MIN_REJECTS_FOR_CATEGORY) {
            String best = null;
            int bestCount = 0;
            for (Map.Entry<String, Integer> e : rejectedByCategory.entrySet()) {
                if (e.getValue() > bestCount || (e.getValue() == bestCount && best != null && e.getKey().compareTo(best) < 0)) {
                    bestCount = e.getValue();
                    best = e.getKey();
                }
            }
            if (best != null && (double) bestCount / rejected >= CATEGORY_SHARE_MIN) {
                category = best;
            }
        }
        return new State(band + "|" + category, band, category, n, kept, refined, rejected);
    }
}
```

- [ ] **Step 3: `PredictionCalibrationDetector`**
```java
package io.mrkuhne.mezo.feature.character.detector;

import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.List;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Prediction calibration (round 4, spec §5.6) — a claim ABOUT THE SYSTEM: of the companion's
 * predictions that closed in the trailing 49 days, how many were right, against the confidence
 * it stated. Small-N calibration in the Brier tradition without the decomposition: hit rate vs.
 * mean stated confidence, three bands. A prediction closes on {@code validTo + 1} (there is no
 * resolvedAt); an expired {@code pending} row is "no data" and counted separately, never as a
 * miss. Owned by the Szkeptikus. No new-data pre-filter (spec §4.3).
 */
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.CHARACTER_SWITCH, havingValue = "true")
public class PredictionCalibrationDetector implements CharacterDetector {

    static final int WINDOW_DAYS = 49;
    static final int MIN_RESOLVED = 4;
    static final double CALIBRATION_DELTA = 0.20;

    @Override
    public String key() {
        return "prediction-calibration";
    }

    @Override
    public List<DetectorSignal> detect(DetectorInput in) {
        State today = state(in, in.day());
        State yesterday = state(in, in.day().minusDays(1));
        if (today == null || today.band().equals(yesterday == null ? "" : yesterday.band())) {
            return List.of();
        }
        String head = "Az elmúlt 7 hétben " + today.resolved() + " predikcióm zárult: " + today.hits() + " talált, "
                + today.misses() + " nem (" + TrailingWindow.pct((double) today.hits() / today.resolved()) + "%)";
        String body;
        if ("nincs-konfidencia".equals(today.band())) {
            body = ", de a többségükhöz nem mondtam magabiztosságot, így kalibrációt nem tudok mérni.";
        } else {
            String bandHu = switch (today.band()) {
                case "tulbiztos" -> "túlbiztos voltam";
                case "alulbiztos" -> "alulbiztos voltam";
                default -> "nagyjából kalibrált voltam";
            };
            body = ", miközben átlagosan " + TrailingWindow.pct(today.meanConfidence().doubleValue())
                    + "% magabiztosságot mondtam — " + bandHu + ".";
        }
        String tail = " " + today.expiredNoData() + " további lejárt adat nélkül, azokat nem számolom. Zárás napja az "
                + "érvényesség vége utáni nap.";
        return List.of(new DetectorSignal(key(), "szkeptikus", head + body + tail, "tulbiztos".equals(today.band()) ? 4 : 3));
    }

    record State(String band, int resolved, int hits, int misses, int expiredNoData, BigDecimal meanConfidence) {}

    static State state(DetectorInput in, LocalDate asOf) {
        int hits = 0;
        int misses = 0;
        int expired = 0;
        BigDecimal confidenceSum = BigDecimal.ZERO;
        int withConfidence = 0;
        for (DetectorInput.PredictionPoint p : in.trend().meta().predictions()) {
            if (p.validTo() == null || !TrailingWindow.inWindow(p.validTo(), asOf, WINDOW_DAYS)
                    || !p.validTo().isBefore(asOf)) {
                continue;   // outside the window, or still open as of asOf (closes on validTo + 1)
            }
            switch (p.status()) {
                case "validated" -> hits++;
                case "missed" -> misses++;
                default -> {
                    expired++;
                    continue;
                }
            }
            if (p.confidence() != null) {
                withConfidence++;
                confidenceSum = confidenceSum.add(p.confidence());
            }
        }
        int resolved = hits + misses;
        if (resolved < MIN_RESOLVED) {
            return null;
        }
        if (withConfidence * 2 < resolved) {
            return new State("nincs-konfidencia", resolved, hits, misses, expired, null);
        }
        BigDecimal meanConfidence = confidenceSum.divide(BigDecimal.valueOf(withConfidence), 4, RoundingMode.HALF_UP);
        double delta = meanConfidence.doubleValue() - (double) hits / resolved;
        String band = delta >= CALIBRATION_DELTA ? "tulbiztos" : delta <= -CALIBRATION_DELTA ? "alulbiztos" : "kalibralt";
        return new State(band, resolved, hits, misses, expired, meanConfidence);
    }
}
```

- [ ] **Step 4: `QuestCompletionCalibrationDetector`**
```java
package io.mrkuhne.mezo.feature.character.detector;

import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Quest completion calibration (round 4, spec §5.7) — a claim ABOUT THE SYSTEM: per slot, what
 * share of the companion's offered quests completed over the trailing 28 days, read against the
 * quest engine's OWN adaptive bands (0,85 / 0,50, min sample 5 — {@code QuestProperties.Adaptive}).
 * A low band is the engine's difficulty miscalibration, not the user's diligence. Only
 * status/slot/date are read — the quest text never (it is LLM-rewritten in place). The observed
 * day's quests are still open (the finalize cron closes yesterday at 00:05) and are excluded;
 * rerolled quests are excluded. Owned by the Szkeptikus. No new-data pre-filter (spec §4.3).
 */
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.CHARACTER_SWITCH, havingValue = "true")
public class QuestCompletionCalibrationDetector implements CharacterDetector {

    static final int WINDOW_DAYS = 28;
    static final int MIN_PER_SLOT = 5;
    static final double HIGH_MIN = 0.85;
    static final double MID_MIN = 0.50;
    static final List<String> SLOTS = List.of("BODY", "FUELBIO", "GROWTH");

    @Override
    public String key() {
        return "quest-completion-calibration";
    }

    @Override
    public List<DetectorSignal> detect(DetectorInput in) {
        State today = state(in, in.day());
        State yesterday = state(in, in.day().minusDays(1));
        if (today == null || today.key().equals(yesterday == null ? "" : yesterday.key())) {
            return List.of();
        }
        List<String> parts = new ArrayList<>();
        List<String> low = new ArrayList<>();
        for (String slot : SLOTS) {
            SlotStat s = today.slots().get(slot);
            if ("keves".equals(s.band())) {
                parts.add(slot + ": kevés quest (" + s.n() + ")");
            } else {
                parts.add(slot + " " + s.completed() + "/" + s.n() + " (" + TrailingWindow.pct((double) s.completed() / s.n()) + "%)");
                if ("alacsony".equals(s.band())) {
                    low.add(slot);
                }
            }
        }
        String summary = "A questkínálatom 4 heti mérlege: " + String.join(", ", parts)
                + (low.isEmpty() ? "" : " — a(z) " + String.join(" és ", low) + " slotban a nehézség-kalibrációm túllőtt")
                + ". A motor saját sávjai (85% / 50%) szerint; a quest szövegét nem olvasom.";
        return List.of(new DetectorSignal(key(), "szkeptikus", summary, low.isEmpty() ? 3 : 4));
    }

    record SlotStat(int n, int completed, String band) {}

    record State(String key, Map<String, SlotStat> slots) {}

    static State state(DetectorInput in, LocalDate asOf) {
        Map<String, int[]> counts = new LinkedHashMap<>();
        for (String slot : SLOTS) {
            counts.put(slot, new int[2]);
        }
        for (DetectorInput.QuestPoint q : in.trend().meta().quests()) {
            if (!TrailingWindow.inWindow(q.questDate(), asOf, WINDOW_DAYS) || !q.questDate().isBefore(asOf)
                    || "rerolled".equals(q.status()) || !counts.containsKey(q.slot())) {
                continue;
            }
            int[] c = counts.get(q.slot());
            c[0]++;
            if ("completed".equals(q.status())) {
                c[1]++;
            }
        }
        Map<String, SlotStat> slots = new LinkedHashMap<>();
        StringBuilder key = new StringBuilder();
        boolean any = false;
        for (String slot : SLOTS) {
            int[] c = counts.get(slot);
            String band;
            if (c[0] < MIN_PER_SLOT) {
                band = "keves";
            } else {
                any = true;
                double ratio = (double) c[1] / c[0];
                band = ratio >= HIGH_MIN ? "magas" : ratio >= MID_MIN ? "kozep" : "alacsony";
            }
            slots.put(slot, new SlotStat(c[0], c[1], band));
            if (key.length() > 0) {
                key.append('|');
            }
            key.append(slot).append(':').append(band);
        }
        return any ? new State(key.toString(), slots) : null;
    }
}
```

- [ ] **Step 5: `ExperimentOutcomeLedgerDetector`**
```java
package io.mrkuhne.mezo.feature.character.detector;

import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.List;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Experiment outcome ledger (round 4, spec §5.8) — a claim ABOUT THE SYSTEM: of the experiments
 * and workout challenges the companion proposed in the trailing 49 days, how many closed with a
 * good outcome, and how many the user dismissed before they started. An inconclusive challenge
 * counts as closed but not judged. Owned by the Szkeptikus. No new-data pre-filter (spec §4.3).
 */
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.CHARACTER_SWITCH, havingValue = "true")
public class ExperimentOutcomeLedgerDetector implements CharacterDetector {

    static final int WINDOW_DAYS = 49;
    static final int MIN_JUDGED = 3;
    static final double GOOD_HIGH_MIN = 0.67;
    static final double GOOD_MID_MIN = 0.34;
    static final int MIN_DISMISSED = 3;
    static final double DISMISSED_SHARE_MIN = 0.5;

    @Override
    public String key() {
        return "experiment-outcome-ledger";
    }

    @Override
    public List<DetectorSignal> detect(DetectorInput in) {
        State today = state(in, in.day());
        State yesterday = state(in, in.day().minusDays(1));
        if (today == null || today.key().equals(yesterday == null ? "" : yesterday.key())) {
            return List.of();
        }
        int closed = today.good() + today.bad() + today.inconclusive();
        String summary;
        if ("keves".equals(today.band())) {
            summary = "Az elmúlt 7 hétben " + closed + " javaslatom zárult, ebből " + today.good()
                    + " jó kimenettel — még kevés az ítélethez; " + today.dismissed()
                    + " javaslatot elvetettél indulás előtt. Ez a javaslataim minősége, nem a te vállalkozó kedved.";
        } else {
            summary = "Az elmúlt 7 hét " + closed + " lezárt javaslatomból (" + today.experiments() + " kísérlet, "
                    + today.challenges() + " kihívás) " + today.good() + " járt jó kimenettel"
                    + (today.inconclusive() > 0 ? ", " + today.inconclusive() + " eldönthetetlen" : "") + "; "
                    + today.dismissed() + " javaslatot elvetettél indulás előtt. Ez a javaslataim minősége, nem a te "
                    + "vállalkozó kedved.";
        }
        boolean loud = "gyenge".equals(today.band()) || "tobbseg-elvetve".equals(today.flag());
        return List.of(new DetectorSignal(key(), "szkeptikus", summary, loud ? 4 : 3));
    }

    record State(String key, String band, String flag, int good, int bad, int inconclusive, int dismissed,
                 int experiments, int challenges) {}

    static State state(DetectorInput in, LocalDate asOf) {
        int good = 0;
        int bad = 0;
        int inconclusive = 0;
        int dismissed = 0;
        int experiments = 0;
        int challenges = 0;
        for (DetectorInput.ProposalOutcomePoint p : in.trend().meta().proposalOutcomes()) {
            if (!TrailingWindow.inWindow(p.date(), asOf, WINDOW_DAYS)) {
                continue;
            }
            String verdict = classify(p);
            if (verdict == null) {
                continue;
            }
            switch (verdict) {
                case "good" -> good++;
                case "bad" -> bad++;
                case "inconclusive" -> inconclusive++;
                default -> dismissed++;
            }
            if (!"dismissed".equals(verdict)) {
                if ("experiment".equals(p.kind())) {
                    experiments++;
                } else {
                    challenges++;
                }
            }
        }
        int judged = good + bad;
        String band = judged < MIN_JUDGED ? "keves"
                : (double) good / judged >= GOOD_HIGH_MIN ? "jo"
                : (double) good / judged >= GOOD_MID_MIN ? "vegyes" : "gyenge";
        int considered = dismissed + judged + inconclusive;
        String flag = dismissed >= MIN_DISMISSED && considered > 0 && (double) dismissed / considered >= DISMISSED_SHARE_MIN
                ? "tobbseg-elvetve" : "-";
        if ("keves".equals(band) && "-".equals(flag)) {
            return null;
        }
        return new State(band + "|" + flag, band, flag, good, bad, inconclusive, dismissed, experiments, challenges);
    }

    /** "good" | "bad" | "inconclusive" | "dismissed", or null for a still-open row. */
    private static String classify(DetectorInput.ProposalOutcomePoint p) {
        if ("dismissed".equals(p.status())) {
            return "dismissed";
        }
        if ("experiment".equals(p.kind())) {
            if (!"completed".equals(p.status())) {
                return null;
            }
            return p.outcomeGood() == null ? "inconclusive" : p.outcomeGood() ? "good" : "bad";
        }
        return switch (p.status()) {
            case "hit" -> "good";
            case "miss" -> "bad";
            case "inconclusive" -> "inconclusive";
            default -> null;
        };
    }
}
```

- [ ] **Step 6: `CharacterApiSwitchOffIT`** — import the eight new detector classes and add one `assertThat(context.getBeanProvider(X.class).getIfAvailable()).isNull();` line each (`PeopleMoodLinkDetector`, `MentionContextShiftDetector`, `WeekendGapDetector`, `ChatTopicShiftDetector`, `KnowledgeRejectionPatternDetector`, `PredictionCalibrationDetector`, `QuestCompletionCalibrationDetector`, `ExperimentOutcomeLedgerDetector`), plus `assertThat(context.getBeanProvider(CharacterMetaReads.class).getIfAvailable()).isNull();`.

- [ ] **Step 7: Full focused gate** → green (expect `DetectorTest` ≈ 71 + 24 = 95 tests). Commit:
```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/character backend/src/test/java/io/mrkuhne/mezo/feature/character
git commit -m "feat(character): the four Szkeptikus self-audit detectors (mezo-1gim.15)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: Frontend — inventory flip, honest-empty Tervezett, 40-detector catalog, META dimension in the mock and the pages

**Files:**
- Modify: `frontend/src/features/character/inventory.ts`
- Modify: `frontend/src/features/character/pages/AdatforrasokPage.tsx`, `AdatforrasokPage.test.tsx`
- Modify: `frontend/src/features/character/pages/DetektorokPage.tsx`
- Modify: `frontend/src/data/character/characterMock.ts` (`DimSeed.kind`, `DIM_SEEDS`, `MOCK_EXPERTS` szkeptikus `dimensionKey`, `CHAIN_POOL`)
- Modify: `frontend/src/features/character/pages/DimensionsPage.tsx`, `DimensionsPage.test.tsx`, `DimensionPage.tsx`, `KarakterHubPage.tsx`, `character.css`
- Modify: `frontend/src/data/character/characterHooks.test.tsx:239` (observationCount 23 → 25)

**Interfaces:**
- Consumes: the regenerated `api.gen.ts` union `"CORE" | "CHAPTER" | "META"` (Task 1); the eight detector keys + owners (Tasks 5–7).

- [ ] **Step 1: `inventory.ts`**

`INVENTORY_ROUNDS` becomes `export const INVENTORY_ROUNDS: InventoryRound[] = []` with the doc comment: "Tervezett — EMPTY since round 4 ("Kapcsolatok & AI-meta") landed via mezo-1gim.15: every MINDENT-be round is wired. The type stays so a future round can be planned here again; AdatforrasokPage renders an honest 'all landed' line when this is empty." Append seven `INVENTORY_READS` rows:
```ts
  { w: 'Emberek-említések (időpont, kontextus-címke)', chips: ['8 hét'] },
  { w: 'Alvás lefekvés/ébredés (alvásközép)', chips: ['8 hét'] },
  { w: 'Chat-eszközhívások (téma-domén, beszélgetés-cím)', chips: ['8 hét'] },
  { w: 'Tudástár-döntések + minta-események', chips: ['8 hét'] },
  { w: 'Predikciók (státusz, magabiztosság)', chips: ['8 hét'] },
  { w: 'Questek (slot, státusz)', chips: ['8 hét'] },
  { w: 'Kísérlet- és kihívás-kimenetek', chips: ['8 hét'] },
```
`INVENTORY_LATER`:
```ts
export const INVENTORY_LATER: string[] = [
  'Súly-naplózási rés (WeightGapDetector — még nem létezik).',
  'Szezonalitás — 8 hét egy éves ciklus töredéke; két év azonos naptári ablaka kell hozzá.',
  'Memoár — nincs strukturált mezője, csak próza; szövegbányászat nélkül nem olvasható.',
  'Ami a négy kör lezárása után még felmerül.',
]
```
Extend the header comment with one paragraph: "Round 4 ("Kapcsolatok & AI-meta") landed the same way: its seven items are gone (Szezonalitás and Memoár moved to `INVENTORY_LATER` with their reasons), its seven data sources are the last seven `reads` rows, and its eight detectors bring `DetektorokPage.tsx`'s catalog to 40. `rounds` is now empty."

- [ ] **Step 2: `AdatforrasokPage` honest-empty** — inside the `seg === 'tervezett'` fragment, before the `INVENTORY_ROUNDS.map`:
```tsx
            {INVENTORY_ROUNDS.length === 0 && (
              <div className="kr-laterline">Mind a négy kör bekötve.</div>
            )}
```
Rewrite the two Tervezett tests:
```tsx
  test('switching to Tervezett shows the honest all-landed line + the later tail', async () => {
    render(<AdatforrasokPage />)
    await userEvent.click(screen.getByRole('tab', { name: 'Tervezett' }))
    // Rounds 1-4 all landed for real via mezo-1gim.15 — INVENTORY_ROUNDS is empty, so the
    // segment says so instead of rendering a phantom round index.
    expect(screen.getByText('Mind a négy kör bekötve.')).toBeInTheDocument()
    expect(screen.queryByText(/\. KÖR/)).not.toBeInTheDocument()
    expect(screen.getByText('+ még 4 terület később')).toBeInTheDocument()
  })
```
and move the "clicking a round navigates" test into a new `describe('AdatforrasokPage — with a planned round', …)` block that mocks the inventory module the way `KorPage.test.tsx` does (`vi.mock('@/features/character/inventory', () => ({ INVENTORY_READS: [], INVENTORY_LATER: [], INVENTORY_ROUNDS: [{ n: 7, title: 'Teszt kör', items: [{ t: 'x' }] }] }))` — a separate test file `AdatforrasokPage.rounds.test.tsx` is the cleanest since `vi.mock` is file-scoped), asserting the click navigates to `/me/karakter/gepterem/adatforrasok/kor/7` and that the all-landed line is absent.

- [ ] **Step 3: `DetektorokPage`** — append eight entries (header comment: "Round 4 (mezo-1gim.15): the eight round-4 detectors … The catalog is now 40 detectors."; update the `/** The 32 real detectors` doc to 40):
```ts
  { key: 'people-mood-link', who: 'antropologus', line: 'A mentális check-in máshol áll-e azokon a napokon, amikor embert említesz — együttjárás, nem irány, és sosem nevez embert.' },
  { key: 'mention-context-shift', who: 'antropologus', line: 'Milyen kontextusban kerülnek elő az emberek (a rendszer éjszakai címkéi), és nő-e a konfliktus-részarány.' },
  { key: 'weekend-gap', who: 'antropologus', line: 'Hétvégi alvásközép-eltolás (Roenneberg social jetlag, 1 h / 2 h sávok) és hétvégi logolás-rés. Hétvége = szombat–vasárnap.' },
  { key: 'chat-topic-shift', who: 'pszichologus', line: 'Melyik domén körül forognak a beszélgetéseid a társsal — a lekért eszközökből, a szöveg olvasása nélkül.' },
  { key: 'knowledge-rejection-pattern', who: 'szkeptikus', line: 'A javasolt tények és minták mekkora részét tartottad meg — a rendszer találati aránya, nem a te tulajdonságod. ÉRZÉKENY.' },
  { key: 'prediction-calibration', who: 'szkeptikus', line: 'A zárult predikciók találati aránya a kimondott magabiztossághoz képest: túlbiztos, alulbiztos vagy kalibrált volt a társ.' },
  { key: 'quest-completion-calibration', who: 'szkeptikus', line: 'Slotonkénti quest-teljesítés a motor saját sávjaihoz (85% / 50%) képest — a nehézség-kalibráció, a szöveg soha.' },
  { key: 'experiment-outcome-ledger', who: 'szkeptikus', line: 'Hány javasolt kísérlet és kihívás zárult jó kimenettel, és hányat vetettél el indulás előtt.' },
```
`DetektorokPage.test.tsx` derives its counts from `DETECTORS` — it needs no literal change, but check any per-expert assertion list includes `szkeptikus` if the test enumerates experts.

- [ ] **Step 4: `characterMock.ts`**

`DimSeed.kind: 'CORE' | 'CHAPTER' | 'META'`. Insert into `DIM_SEEDS` between the `life` entry and `chapter-work` (mirrors the backend order CORE → META → CHAPTER):
```ts
  {
    key: 'self-audit',
    title: 'A társ önvizsgálata',
    kind: 'META',
    expertKey: 'szkeptikus',
    maturity: 34,
    portrait:
      'A társ saját mérlege: mennyire volt igaza, és mit kezdtél a javaslataival. Ezek a sorok a ' +
      'rendszerről szólnak — a Szkeptikus vezeti, hogy a társ ne ígérjen magabiztosabban, mint amit igazol.',
    claims: [
      claim('self-audit', 0, 'A javasolt tényeimből az elmúlt 4 hétben 9-ből 6-ot megtartottál (2 finomítva), 3-at elutasítottál — ez az én találati arányom, nem a te tulajdonságod.', VALOSZINU, { proposedBy: 'szkeptikus', sensitive: true }),
      claim('self-audit', 1, 'Az elmúlt 7 hét 7 zárult predikciójából 4 talált, miközben átlagosan 78% magabiztosságot mondtam — túlbiztos voltam.', VALOSZINU, { proposedBy: 'szkeptikus' }),
    ],
  },
```
Update the `DIM_SEEDS` comment to "7 CORE + 1 META + 1 CHAPTER". `MOCK_EXPERTS` szkeptikus: `dimensionKey: 'self-audit'` (comment: "the META dimension since round 4"). `characterHooks.test.tsx:239` → `toBe(25) // 7 CORE dims * 3 claims + 1 META dim * 2 claims + 1 CHAPTER dim * 2 claims` (and its comment above). Add eight `CHAIN_POOL` chains (one per detector; put `people-mood-link` + `knowledge-rejection-pattern` on day 13, `mention-context-shift` + `prediction-calibration` on 20, `weekend-gap` + `quest-completion-calibration` on 24, `chat-topic-shift` on 27, `experiment-outcome-ledger` on 30; day 15 untouched; `refs: []`; `code` paraphrases the real summary with numbers that satisfy the real thresholds):
```ts
    { detector: 'people-mood-link', code: '9 említés-napon a mentális átlag 7,4, 12 említés nélküli napon 5,9 — magasabb együttjárás, közepes bizonyosság', refs: [], who: 'antropologus',
      obs: 'Azokon a napokon, amikor ember kerül a naplóba, a mentális skála egy ponttal följebb áll — együttjárás, nem irány.' },
    { detector: 'knowledge-rejection-pattern', code: '9 döntés: 6 megtartva (2 finomítva), 3 elutasítva — 67%, az elutasítások főleg fuel', refs: [], who: 'szkeptikus',
      obs: 'A javasolt tényeim kétharmadát megtartottad; ami kiesett, az a fuel kategóriából jött — ez az én találati arányom, nem a te tulajdonságod.' },
    { detector: 'mention-context-shift', code: '8 címkézett említés: munka 50%, konfliktus 25% (jelen); korábban edzés/nincs', refs: [], who: 'antropologus',
      obs: 'Az emberek most a munka felől kerülnek szóba, és megjelent a konfliktus-címke is — a címkét a rendszer adja, nem te.' },
    { detector: 'prediction-calibration', code: '7 zárult predikció: 4 talált (57%), átlag 78% magabiztosság — túlbiztos', refs: [], who: 'szkeptikus',
      obs: 'Hét zárult predikcióból négy talált, miközben 78% magabiztosságot mondtam — túlbiztos voltam.' },
    { detector: 'weekend-gap', code: 'alvásközép hétvégén +95 perc (mérsékelt, 7 szabad / 18 munkaéjszaka); logolás hétvégén 57%, hétköznap 91% — rés', refs: [], who: 'antropologus',
      obs: 'Hétvégén másfél órával később esik az alvásközéped, és a logolás is megritkul — a hét kettészakad.' },
    { detector: 'quest-completion-calibration', code: 'BODY 12/14 (86%), FUELBIO 9/13 (69%), GROWTH 5/15 (33%) — GROWTH túllőtt', refs: [], who: 'szkeptikus',
      obs: 'A GROWTH slot kínálatát túl nehézre lőttem be — ez a motor kalibrációja, nem a te szorgalmad.' },
    { detector: 'chat-topic-shift', code: 'beszélgetések 62%-a az alvás körül (13 eszközhívás a 21-ből); korábban edzés', refs: [], who: 'pszichologus',
      obs: 'Az elmúlt hetekben az alvás lett a fő téma a társsal, az edzés helyett.' },
    { detector: 'experiment-outcome-ledger', code: '5 lezárt javaslat (2 kísérlet, 3 kihívás): 3 jó kimenet; 1 elvetve indulás előtt', refs: [], who: 'szkeptikus',
      obs: 'Öt lezárt javaslatomból három vezetett jó kimenethez — a javaslataim minősége, nem a te vállalkozó kedved.' },
```
Add a "Round 4 (mezo-1gim.15, Task 8)" paragraph to the `CHAIN_POOL` header comment in the established form.

- [ ] **Step 5: Pages + CSS**

`DimensionsPage.tsx`: `const isMeta = d.kind === 'META'`; className `` `kr-dimtile rise${isChapter ? ' chapter' : isMeta ? ' meta' : ''}` `` (the orb branch already renders `PersonaOrb expertKey="szkeptikus"` because `expertKey` is set). `character.css` after `.kr-dimtile.chapter { … }`:
```css
/* META (round 4): the companion's self-audit — solid hairline in the Szkeptikus ink, never the
   dashed CHAPTER treatment: it is fixed and seeded, not an AI-opened chapter. */
.kr-dimtile.meta { border: 1.2px solid var(--dc); background: var(--surface-card); }
```
`DimensionPage.tsx` `sub`:
```tsx
  const sub = dimension.kind === 'CHAPTER'
    ? 'közös AI-fejezet · érettség'
    : dimension.kind === 'META'
      ? 'a társ önvizsgálata · Szkeptikus'
      : `${expertName ?? 'a csapat'} · érettség`
```
`KarakterHubPage.tsx` `dimLine`:
```tsx
  const chapterDims = overview.dimensions.filter((d) => d.kind === 'CHAPTER')
  const hasMeta = overview.dimensions.some((d) => d.kind === 'META')
  const dimLine = `${coreDims.length} dimenzió`
    + (hasMeta ? ' + önvizsgálat' : '')
    + (chapterDims.length > 0 ? ` + ${chapterDims.length} fejezet` : '')
```
(update the I3 comment: "… plus the META self-audit since round 4"). `DimensionsPage.test.tsx`: rename the first test to `'renders all 9 dimension tiles (7 CORE + 1 META + 1 CHAPTER)'`; add:
```tsx
  test('the META dimension gets the solid meta styling, not the dashed chapter one', () => {
    const { container } = render(<DimensionsPage />)
    const metaTile = screen.getByRole('button', { name: 'A társ önvizsgálata' })
    expect(metaTile).toHaveClass('meta')
    expect(metaTile).not.toHaveClass('chapter')
    expect(container.querySelectorAll('.kr-dimtile.chapter')).toHaveLength(1)
  })
```
`DimensionPage.test.tsx`: add `test('a META dimension shows the Szkeptikus sub-line', …)` setting `hoisted.key = 'self-audit'` / `hoisted.dimension = MOCK_DIMENSIONS['self-audit']` and asserting `screen.getByText('a társ önvizsgálata · Szkeptikus')`.

- [ ] **Step 6: Gate + commit** — `cd frontend && pnpm test && VITE_USE_MOCK=false pnpm test && pnpm build` → green in both modes. Fix any test that pinned "8 dimensions" / "23" / `dimensionKey: null` for szkeptikus.
```bash
git add frontend/src
git commit -m "feat(character-fe): round 4 inventory flip, 40-detector catalog, META dimension in mock and pages (mezo-1gim.15)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 9: Docs — `character.md`, ADR, CODEMAP, lint

**Files:**
- Modify: `docs/features/character.md` (§1, §5, §7, §9, §10)
- Create: `docs/decisions/00NN-meta-dimension-companion-self-audit.md` (NN = the next free number on `origin/main`'s `docs/decisions/` at the moment of writing — check with `git ls-tree --name-only origin/main docs/decisions | sort | tail -1`; today that is 0034)
- Regenerate: `docs/CODEMAP.md`

- [ ] **Step 1: `character.md`**

  1. §1 "Structure" bullet → "7 fixed CORE dimensions (seeded, never deleted) + **1 fixed META dimension** (`self-audit`, "A társ önvizsgálata", owned by the Szkeptikus — claims ABOUT THE SYSTEM: prediction calibration, quest calibration, fact-triage hit rate, experiment outcomes; round 4, `mezo-1gim.15`) + AI-opened CHAPTER dimensions …". The team bullet: "… + a cross-cutting Szkeptikus (devil's advocate in the konzílium AND, since round 4, the observer/proposer of the META dimension) …".
  2. §1 catalog paragraph: after the round-3 clause add "and round 4 ("Kapcsolatok & AI-meta") landed the last eight (`people-mood-link`, `mention-context-shift`, `weekend-gap`, `chat-topic-shift`, `knowledge-rejection-pattern`, `prediction-calibration`, `quest-completion-calibration`, `experiment-outcome-ledger`), **40 of them are implemented** — the `MINDENT be` inventory is exhausted; only the `weight-gap` variant remains (`mezo-1gim.12`)". Replace "32 of them are implemented (`mezo-1gim.15`'s remaining round and `mezo-1gim.12` track the rest)" accordingly. Add one sentence: "Round 4 reads seven more sources — people mentions (context label), sleep bedtime/wakeup clocks, the assistant's executed tool calls (+ conversation title as evidence), Tudástár fact decisions + pattern events, predictions, quests, experiment/challenge outcomes — the last four through a second read composer, `CharacterMetaReads`, nested into `TrendWindow.meta`."
  3. §5 Integrations: add the two new one-way slice edges `character → people` (`MentionRepository`) and `character → quest` (`DailyQuestRepository`), and the widened `character → companion` (`LearnedFactRepository`, `PatternEventRepository`) / `character → proactive` (`PredictionRepository`, `ExperimentRepository`, `ChallengeRepository`) edges.
  4. §7 How to extend: one bullet "Adding a system-side (AI-meta) read: extend `CharacterMetaReads`, not `CharacterSignalReads`; the detector reading it is szkeptikus-owned and its summary's subject is the system."
  5. §9: add a **round-4 rules** block: (a) the META kind and the subject rule ("the claim's subject decides the dimension, not the data's source"); (b) "**Round 4 uses no new-data pre-filter at all** — the pre-filter and the state-change gate combined can swallow a transition that happened on a quiet day (state moved by window ageing, gate closed; next data day both sides already equal). The five round-3 detectors that still carry a pre-filter (`self-calibration`, `promise-vs-delivery`, `decision-profile`, `gratitude-focus`, `checkin-latency`) inherit this flaw — tracked in a follow-up bd, see the spec §9."; (c) the three honesty proxies (fact decision date = candidate `createdAt`; prediction close = `validTo + 1`; status mutation in place for predictions/experiments/challenges); (d) `contextLabel` is the people classifier's output — structured, closed set, never the excerpt; `tone`/`intensity` deliberately unused; (e) weekend = Sat/Sun server zone. Replace the §9 ledger paragraph that lists `people-mood-link`, `weekend-gap`, `chat-topic-shift`, `knowledge-rejection-pattern` as "not implemented" with: only the `weight-gap` variant is not implemented; every expert now receives nightly-detector-sourced observations, including the Szkeptikus.
  6. Normalise the two stale counts the round-3 doc pass left: "all 5 concrete detectors follow this" (~line 442) → "all 40 detectors follow this"; "Each of the 20 detectors carries `@ConditionalOnProperty`" (~line 623) → "Each of the 40 detectors …".
  7. §10 Key files: add `service/CharacterMetaReads.java`, `detector/ChatToolDomains.java`, and the eight round-4 detector classes in a "round 4's (`mezo-1gim.15`) 8" clause; the migration file; `CharacterMetaReadsIT`.

- [ ] **Step 2: ADR** — `docs/decisions/00NN-meta-dimension-companion-self-audit.md`, same shape as `0033-mozaik-2-tile-language.md` (Status / Context / Decision / Consequences). Decision: a third `character_dimension.kind`, `META`, one seeded row `self-audit`, owned by the Szkeptikus, holding claims about the SYSTEM; rendered CORE → META → CHAPTER in the `[Karakter]` block with the header clause; never retired by the monthly pass; the subject rule. Rejected alternatives: a seeded CHAPTER with an owner (breaks CHAPTER semantics), an 8th CORE (the seven are about the user; the Csapat page's SKEPTIC role would collide with EXPERT). Consequences: `CharacterExpertCatalog.SKEPTIC` lives outside `EXPERTS`; contract enum widened; the FE `MaturityRing` stays CORE-only.

- [ ] **Step 3: CODEMAP + lint + commit**
```bash
node scripts/gen-codemap.mjs && node scripts/gen-codemap.mjs --check && node scripts/lint-docs.mjs --errors-only && node scripts/lint-liquibase.mjs
git add docs
git commit -m "docs(character): round 4 — META dimension ADR, character.md, CODEMAP (mezo-1gim.15)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Self-review (done while writing)

- **Spec coverage:** §4.1/§4.2 → Tasks 1–2; §4.3 (no pre-filter) → every detector task; §4.4 (evidence only) → Task 6 (`titlePreview`), Task 7 (no text); §5.1–5.3 → Task 5; §5.4 → Task 6; §5.5–5.8 → Task 7; §6.1–6.3 → Tasks 3–4; §6.5 (ArchUnit) → Tasks 3–4 gates; §7 → Task 8; §8 → each task's tests + Task 7's switch-off pin; §9 (LATER rows, follow-up bd) → Task 8 inventory + the controller files the bd after merge.
- **Type consistency:** `TrendWindow` = 15 old + `mentions, chatToolCalls, meta` (Task 3) — `TrendBuilder.mentions/toolCalls/meta` (Task 3) used by Tasks 5–7; `MetaWindow.empty()` (Task 3) used by Tasks 3–4; `CharacterCoreCatalog.SEEDED/KIND_META/kindOf` (Task 1) used by Tasks 1–2; `CharacterExpertCatalog.SKEPTIC` (Task 1) used by Tasks 1–2; detector keys/owners (Tasks 5–7) match the `DETECTORS` entries and `CHAIN_POOL` `who` values (Task 8).
- **Fixture arithmetic** was derived in each test's comment; if an implementer finds one wrong, the fixture moves, never the threshold.

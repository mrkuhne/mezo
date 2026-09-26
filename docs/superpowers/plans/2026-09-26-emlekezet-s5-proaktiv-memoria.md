# S5 · Proaktív memóriahasználat — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Confirmed knowledge (effect links + person facts + knowledge facts) fires proactively: a code-matched "apropó" (same-day mention / planned workout / yesterday's event) weaves ONE caring sentence into the existing morning/midday/evening feed messages, and effect insights become a csapatfal evening-edition candidate source.

**Architecture:** A new `ProactiveMemoryBlock` service in `feature/proactive` collects trigger candidates, matches them against double-gated `effect_link` rows, applies a 3-day cooldown persisted in a new `proactive_memory_use` table, deterministically selects at most ONE trigger per message, and renders an `[AKTUÁLIS APROPÓ]` prompt block (plus the trigger person's facts, sensitivity included, with a tact instruction). The block is injected at all four composer seams (morning/window × legacy/contextual). A new `effect` edition candidate source (via `TeamEditionReads`) lets Derű narrate the strongest effect row on the wall.

**Tech Stack:** Spring Boot backend (Liquibase, JPA, ArchUnit), existing `FakeCompanionLlm` IT idiom, React FE (one `RefTag` icon-map entry only).

**Spec:** `docs/superpowers/specs/2026-09-24-mezo-emlekezete-design.md` §"S5 delta" (owner-approved 2026-09-26).

## Global Constraints

- Code decides, the LLM only phrases. Hedged non-causal Hungarian: "általában", "hajlamos", never "mert".
- At most ONE memory-grounded insert per message; fired (subject, metric) pairs cool down 3 days.
- Sensitivity person facts ARE included (owner decision 2026-09-26, reverses S3's stance) — always with the tact instruction ("tapintatosan, kérdező formában, sose kijelentve").
- No new LLM slug, no new message kind, no new notification channel, no OpenAPI change.
- Every optional collaborator via `ObjectProvider` + fail-open try/catch — a broken garnish never costs the user a message (the `reflectionDigest` template at `CompanionMessageGenerator.java:368-380`).
- ArchUnit: proactive→companion and character→companion are the legal directions (both already exercised); `companion.service` never imports `companion.reflection`.
- Test fixtures anchor timestamps to the queried day, never now-minus-N-hours.
- Backend gates: focused tests via `./mvnw test -Dtest=...`. FE gates: both modes with `CI=true`, `pnpm build`.
- Commits: conventional subject + ` (mezo-d6ivw.5)` + `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

### Task 1: `proactive_memory_use` table + entity + repository

The cooldown ledger: one row per fired apropó. Path-independent (works under both composer paths, unlike message-envelope refs, which the contextual path composes elsewhere).

**Files:**
- Create: `backend/src/main/resources/db/changelog/1.1.0/script/202609261600_mezo-d6ivw.5_proactive_memory_use.sql`
- Modify: `backend/src/main/resources/db/changelog/1.1.0/1.1.0_master.yml` (append changeSet)
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/entity/ProactiveMemoryUseEntity.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/repository/ProactiveMemoryUseRepository.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/ProactiveMemoryUsePersistenceIT.java`

**Interfaces:**
- Produces: `ProactiveMemoryUseEntity` (fields: `id`, `createdBy`, `usedOn` LocalDate, `topicKey` String, `kind` String — extends `OwnedEntity` like `CompanionMessageEntity`), and `ProactiveMemoryUseRepository extends JpaRepository<ProactiveMemoryUseEntity, UUID>` with:
  - `List<ProactiveMemoryUseEntity> findByCreatedByAndUsedOnGreaterThanEqual(UUID createdBy, LocalDate from);`

- [ ] **Step 1: Migration SQL** (mirror the `effect_link` script's shape exactly — same header column idiom):

```sql
create table proactive_memory_use (
 id uuid not null default gen_random_uuid(),
 created_by uuid not null,
 created_at timestamptz not null default now(),
 is_deleted boolean not null default false,
 used_on date not null,
 topic_key varchar(64) not null,
 kind varchar(16) not null,
 constraint pk_proactive_memory_use_id primary key(id),
 constraint fk_proactive_memory_use_created_by foreign key(created_by) references app_user(id) on delete cascade,
 constraint ck_proactive_memory_use_kind check(kind in ('morning','midday','evening'))
);
create index ix_proactive_memory_use_lookup on proactive_memory_use(created_by, used_on);
```

Append to `1.1.0_master.yml` (copy the previous changeSet block, id `"1.1.0:202609261600_mezo-d6ivw.5_proactive_memory_use"`, author `daniel.kuhne`).

- [ ] **Step 2: Entity + repository** — copy the field/annotation style of `CompanionMessageEntity` (same package's `OwnedEntity` base, `@Table(name = "proactive_memory_use")`). No envelope/JSON columns.

- [ ] **Step 3: Failing persistence IT** — mirror the smallest existing persistence IT in the package (`CompanionMessagePersistenceIT`): save a row, read it back via `findByCreatedByAndUsedOnGreaterThanEqual(user, today.minusDays(3))`, assert present; save a 4-day-old row, assert absent from the same query.

- [ ] **Step 4: Run** `./mvnw test -Dtest=ProactiveMemoryUsePersistenceIT` → PASS (migration applies, entity maps).

- [ ] **Step 5: Commit** `feat(proactive): proactive_memory_use cooldown ledger (mezo-d6ivw.5)`

---

### Task 2: `EffectLinkService.gatedEffects` — reusable read model

`promptBlock` renders a string; the S5 matcher and the edition source both need structured rows with resolved labels. Extract the shared read into one public method next to `promptBlock` so label/gating logic stays in ONE place.

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/reflection/service/EffectLinkService.java`
- Test: extend `backend/src/test/java/io/mrkuhne/mezo/feature/companion/reflection/EffectLinkServiceIT.java` (or the existing service test file found by `grep -rl "promptBlock" backend/src/test`)

**Interfaces:**
- Produces (public, on `EffectLinkService`):

```java
/** One double-gated effect row with its labels resolved — the S5 apropó matcher's and the
 *  edition source's shared read model. Same gate and order as {@link #promptBlock}. */
public record GatedEffect(String subjectKind, String subjectKey, String metric,
        String subjectLabel, String metricLabel, boolean higher,
        String strengthBand, int subjectDays, String topicKey) {}

@Transactional(readOnly = true)
public List<GatedEffect> gatedEffects(UUID userId) { ... }
```

- [ ] **Step 1: Failing test** — seed (via the existing test's fixture idiom) one strong+confident person row for an active person, one weak row, one row for an inactive person; assert `gatedEffects` returns exactly the first, with `subjectLabel` = person name, `metricLabel` = "stresszszint" (for metric `stress`), `higher` matching the delta sign, `topicKey` = `EffectLinkService.topicKey(...)` of the row.

- [ ] **Step 2: Run** the test → FAIL (method missing).

- [ ] **Step 3: Implement** — body reuses the exact `promptBlock` pipeline (`PROMPT_STRENGTHS`/`PROMPT_CONFIDENCES` filters, `byStrength()` sort, `activePersonNames` + `EVENT_LABELS_HU` + `oneLine` label resolution, skip unresolvable labels, NO cap — callers cap). Then refactor `promptBlock` to build its lines FROM `gatedEffects` (plus delta/day formatting it alone needs — keep `cliffsDelta` formatting by re-reading? No: add `String promptLine` is NOT needed; instead keep `promptBlock`'s existing private `line()` path but have both share the gating stream via a private `gatedRows()` helper if reusing the record loses precision. Simplest compliant shape: private `List<EffectLinkEntity> gatedRows(UUID)` used by BOTH `promptBlock` and `gatedEffects`).

- [ ] **Step 4: Run** the test + the existing `promptBlock` tests in the same file → PASS.

- [ ] **Step 5: Commit** `feat(companion): EffectLinkService.gatedEffects shared read model (mezo-d6ivw.5)`

---

### Task 3: `ProactiveMemoryBlock` — trigger match, cooldown, selection, rendering

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/ProactiveMemoryBlock.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/ProactiveMemoryBlockIT.java`

**Interfaces:**
- Consumes: `EffectLinkService.gatedEffects` (Task 2), `ProactiveMemoryUseRepository` (Task 1), `MentionRepository.findContextSignals`/`findSignals` (existing), `WorkoutService.findPlannedTemplateForDate` (existing, see `ContextSnapshotAssembler.java:398`), `PersonFactService.promptFacts` (existing).
- Produces:

```java
public record Apropo(String block, String topicKey, CompanionMessageEnvelope.Ref ref) {}

/** Empty when nothing fires — the normal case. NEVER throws. */
public Optional<Apropo> apropo(UUID userId, LocalDate date, String kind);

/** Call AFTER the message row persisted. Fail-open (log-and-swallow). */
public void recordUse(UUID userId, LocalDate date, String kind, Apropo apropo);
```

**Service skeleton** (`@Service`, NOT switch-gated — its gated inputs arrive via `ObjectProvider`, absent ⇒ `Optional.empty()`):

```java
@Slf4j
@Service
@RequiredArgsConstructor
public class ProactiveMemoryBlock {
    static final int COOLDOWN_DAYS = 3;
    static final String REF_KIND = "Effect";

    private final ObjectProvider<EffectLinkService> effectLinkService;   // COMPANION+REFLECTION-gated
    private final ObjectProvider<PersonFactService> personFactService;   // PEOPLE-gated
    private final MentionRepository mentionRepository;
    private final WorkoutService workoutService;
    private final ProactiveMemoryUseRepository useRepository;
```

**Behavior (all inside one try/catch in `apropo`, returning empty on any failure):**

1. `EffectLinkService svc = effectLinkService.getIfAvailable(); if (svc == null) return Optional.empty();`
2. Candidate day-signals:
   - kind `midday`/`evening` → SAME_DAY: today's `findContextSignals` labels (mapped exactly like `EffectLinkService.subjects`: `edzes/munka/csalad→` same event key, `kozos_program|baratok→kozos_program`, `konfliktus→konfliktus`) + today's `findSignals` person ids.
   - kind `morning` → PLANNED_WORKOUT: `workoutService.findPlannedTemplateForDate(userId, date).isPresent()` ⇒ event key `edzes`; YESTERDAY: the same two mention reads filtered to `date.minusDays(1)`.
   - Mention `Instant → LocalDate` via `ZoneId.systemDefault()` (the `EffectLinkService.day()` idiom).
3. Match each candidate subject against `svc.gatedEffects(userId)` (person by `subjectKey.equals(personId.toString())`, event by key equality — the effect table's own keys, no normalization needed here because both sides are the taxonomy constants / person UUIDs; the normalized form only matters for pattern-evidence comparison, which this task does not do).
4. Cooldown: drop matches whose `topicKey` appears in `useRepository.findByCreatedByAndUsedOnGreaterThanEqual(userId, date.minusDays(COOLDOWN_DAYS))`.
5. Select ONE: priority SAME_DAY > PLANNED_WORKOUT > YESTERDAY; ties by list order of `gatedEffects` (already strongest-first).
6. Render the block (exact strings — tests assert on the header and instruction lines):

```java
StringBuilder b = new StringBuilder("\n\nAKTUÁLIS APROPÓ (kód választotta; együttjárás, nem ok-okozat):\n");
b.append("- ").append(temporalWord).append(": ").append(e.subjectLabel())
 .append(" — az ilyen napokon a ").append(e.metricLabel()).append(" általában ")
 .append(e.higher() ? "magasabb" : "alacsonyabb")
 .append(" (").append(e.strengthBand()).append(" együttjárás, ").append(e.subjectDays()).append(" nap).\n");
b.append("- Ha természetesen belefér, EGY gondoskodó, ")
 .append(forwardLooking ? "előre néző" : "visszakérdező")
 .append(" mondatban utalj rá — ha nem fér bele, hagyd ki teljesen.\n");
b.append("- Óvatos, nem ok-okozati fogalmazás: \"általában\", \"hajlamos\" — soha \"mert\".\n");
```

   where `temporalWord` = "Ma" (SAME_DAY), "Ma (terv szerint)" (PLANNED_WORKOUT), "Tegnap" (YESTERDAY); `forwardLooking` = trigger != YESTERDAY.
7. Person trigger extras: `personFactService.getIfAvailable()` → `promptFacts(userId, List.of(personId))`, ALL kinds (owner decision — no `PROACTIVE_EXCLUDED_KINDS` filter), cap 3 newest:

```java
b.append("SZEMÉLYES TÉNYEK ehhez az apropóhoz:\n");
facts.forEach(f -> b.append("- ").append(f.getText()).append('\n'));
b.append("- Az érzékeny témát tapintatosan, kérdező formában hozd szóba, sose kijelentve.\n");
```

8. `ref` = `new CompanionMessageEnvelope.Ref(REF_KIND, e.subjectLabel() + " · " + e.metricLabel())`.
9. `recordUse` saves one `ProactiveMemoryUseEntity` (usedOn=date, topicKey, kind) in its own try/catch.

- [ ] **Step 1: Failing IT** — `ProactiveMemoryBlockIT` (Spring IT, the package's house style; enable companion+reflection+people switches like `CompanionMessageGeneratorIT` does). Cases:
  1. same-day context mention `kozos_program` today + seeded strong+confident `kozos_program`/`stress` effect row → `apropo(user, today, "evening")` present, block contains "AKTUÁLIS APROPÓ", "magasabb"/"alacsonyabb" per seeded sign, "előre néző".
  2. `apropo(user, today, "morning")` with yesterday person mention + person effect row + one sensitivity person fact → block contains "Tegnap", "visszakérdező", the fact text, and the tact line.
  3. cooldown: after `recordUse`, the same trigger returns empty for `date`, `date+1`, `date+2`, present again at `date+3`.
  4. nothing matches → empty; weak-row-only → empty.
  5. priority: same-day event AND yesterday person both present (kind evening only sees same-day; use morning with planned workout + yesterday match → planned wins).
  - Seed effect rows directly via `EffectLinkRepository` (strength/confidence `eros`/`kozepes` etc.); mentions via the mention table's fixture idiom used in `EffectLinkServiceIT`; anchor mention timestamps to `date.atStartOfDay(ZoneId.systemDefault())` +hours, never `Instant.now()`-relative.

- [ ] **Step 2: Run** `./mvnw test -Dtest=ProactiveMemoryBlockIT` → FAIL (class missing).

- [ ] **Step 3: Implement** per the skeleton above.

- [ ] **Step 4: Run** → PASS.

- [ ] **Step 5: Commit** `feat(proactive): ProactiveMemoryBlock — apropó match, cooldown, block render (mezo-d6ivw.5)`

---

### Task 4: Wire the block into `CompanionMessageGenerator` (all four seams)

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/CompanionMessageGenerator.java`
- Test: extend `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/CompanionMessageGeneratorIT.java` (legacy path) and the contextual-path IT (find via `grep -rl "CONTEXTUAL_FEED" backend/src/test/java/io/mrkuhne/mezo/feature/proactive`)

**Interfaces:**
- Consumes: `ProactiveMemoryBlock.apropo/recordUse` (Task 3).

- [ ] **Step 1: Failing ITs**
  - Legacy morning: seed the Task-3 fixture (yesterday person mention + effect row), script `FakeCompanionLlm`; assert the payload the fake captured contains "AKTUÁLIS APROPÓ" (the `hydrationBlock`/`missedWorkoutsBlock` assertion idiom), the persisted envelope refs contain kind `Effect`, and a `proactive_memory_use` row exists for the day.
  - Legacy evening (`generateWindow`): same-day fixture → payload contains the block.
  - Contextual morning (switch on): the `facts` string handed to `FeedGenerationService` contains "AKTUÁLIS APROPÓ" and a use-row is written (no envelope-ref assertion — refs are the contextual service's own).
  - No-trigger day: payload does NOT contain "AKTUÁLIS APROPÓ", no use-row, message still generates.

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement.** Add field `private final ProactiveMemoryBlock proactiveMemoryBlock;` (plain — the bean is ungated). In each of the four seams compute once per call `Optional<Apropo> apropo = proactiveMemoryBlock.apropo(userId, date, kind)`:
  - `generateMorning` contextual (`:297`): append `apropo.map(Apropo::block).orElse("")` to the `facts` argument.
  - `generateMorning` legacy: `payload.append(...)` right after the knowledge-fact block (`:312`); `apropo.ifPresent(a -> candidates.add(a.ref()))`.
  - `generateWindow` contextual (`:565`) and legacy (`:580`+): same two moves (`kind` is midday/evening; skip sleep/weight/people/hydration kinds — they never get an apropó; guard `KIND_MORNING|KIND_MIDDAY|KIND_EVENING` inside `apropo` callers or early-return inside `ProactiveMemoryBlock.apropo` for other kinds — choose the block-internal guard so callers stay dumb).
  - After each successful `saveAndFlush` on these kinds: `apropo.ifPresent(a -> proactiveMemoryBlock.recordUse(userId, date, kind, a));` — legacy morning's ref lands on the row via the candidates list only if the model cites it; ADD it unconditionally instead: after `resolveRefs(...)` build, append `a.ref()` to the resolved list when absent (code decides provenance, not the model). For `generateWindow` legacy, add to `refs` before entity build.

- [ ] **Step 4: Run** the extended ITs + the file's existing ITs → PASS.

- [ ] **Step 5: Commit** `feat(proactive): apropó block a reggeli/déli/esti üzenetben, mindkét úton (mezo-d6ivw.5)`

---

### Task 5: Knowledge facts on the contextual path + the S3 stance reversal

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/FeedContextAssembler.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/people/service/PersonFactService.java` (javadoc + constant)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/PeopleSnapshotBlock.java` (javadoc `:31-32`)
- Test: extend the FeedContextAssembler test (find via `grep -rl "FeedContextAssembler" backend/src/test`)

**Interfaces:**
- Consumes: `KnowledgeFactService.renderPromptBlock(UUID)` (existing).

- [ ] **Step 1: Failing test** — seed an `includeInPrompt` knowledge fact, call `assemble(...)`, assert the returned `FeedContext` text contains the fact block's header (assert on the exact header string `KnowledgeFactService` renders — read it from that class when writing the test).

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement** — inject `private final ObjectProvider<KnowledgeFactService> knowledgeFacts;` into `FeedContextAssembler`; append `Optional.ofNullable(knowledgeFacts.getIfAvailable()).map(s -> s.renderPromptBlock(userId)).orElse("")` into the assembled context string (after `personal.render`, fail-open try/catch).

- [ ] **Step 4: Javadoc reversals** (no behavior change):
  - `PersonFactService`: replace the `PROACTIVE_EXCLUDED_KINDS` javadoc + class-javadoc bullet with: owner decision 2026-09-26 (spec §S5 delta) — sensitivity facts ARE consumed proactively, with a mandatory tact instruction; the constant is retained for consumers that still want the conservative filter, but S5 deliberately does not apply it.
  - `PeopleSnapshotBlock.java:31-32`: note that S5's `ProactiveMemoryBlock` now brings trigger-scoped person facts into proactive messages by design; the full `[Emberek]` block still stays chat-only.

- [ ] **Step 5: Run** the touched tests → PASS. **Commit** `feat(proactive): knowledge-fact blokk a kontextuális úton + S3 érzékenységi álláspont frissítés (mezo-d6ivw.5)`

---

### Task 6: Edition `effect` candidate source (csapatfal)

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/character/service/edition/TeamEditionReads.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/character/service/edition/EditionCandidateCollector.java`
- Test: extend the collector's test (find via `grep -rl "EditionCandidateCollector" backend/src/test`)

**Interfaces:**
- Consumes: `EffectLinkService.gatedEffects` (Task 2).
- Produces: `TeamEditionReads.gatedEffects(UUID owner)` → `List<EffectLinkService.GatedEffect>` (empty when the reflection beans are off — `ObjectProvider` inside the reads facade).

- [ ] **Step 1: Failing test** — seed one strong+confident effect row; `collect(...)` output contains a candidate with `sourceKind="effect"`, `sourceId=<subjectKind>:<subjectKey>:<metric>`, character `DERU`, genre `MEGFIGYELES`, `recordText` containing "általában" and NOT containing "mert ", route `/me/people/<id>` for a person subject (`/nap/mezo` for an event subject), no guests. Second case: two qualifying rows → exactly ONE effect candidate (the strongest). Third: no qualifying rows → none.

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement.**
  - `TeamEditionReads`: add `private final ObjectProvider<EffectLinkService> effectLinks;` and `public List<EffectLinkService.GatedEffect> gatedEffects(UUID owner)` returning `List.of()` when absent (matches the class's Mockito-double role — keep it a plain public method).
  - Collector: `static final String SOURCE_EFFECT = "effect";` and, in `collect`, `effectCandidate(owner).ifPresent(out::add);` with:

```java
private Optional<EditionCandidate> effectCandidate(UUID owner) {
    List<EffectLinkService.GatedEffect> rows = reads.gatedEffects(owner);
    if (rows.isEmpty()) return Optional.empty();
    var e = rows.getFirst(); // strongest — gatedEffects is strongest-first
    String body = e.subjectLabel() + " és a " + e.metricLabel() + ": az ilyen napokon általában "
            + (e.higher() ? "magasabb" : "alacsonyabb") + " (" + e.strengthBand()
            + " együttjárás, " + e.subjectDays() + " nap — együttjárás, nem ok-okozat).";
    String route = "person".equals(e.subjectKind()) ? "/me/people/" + e.subjectKey() : "/nap/mezo";
    return Optional.of(new EditionCandidate(SOURCE_EFFECT,
            e.subjectKind() + ":" + e.subjectKey() + ":" + e.metric(),
            TeamCharacter.DERU, EditionGenre.MEGFIGYELES,
            "Együttjárás", body, List.of(), List.of(), false, false, null, route, List.of()));
}
```

  (Match the real `EditionCandidate` constructor argument order from the record; the existing 7-day `PriorShowing` no-repeat + per-sourceKey cap in `EditionSelector` provide the spam guard — no extra state.)

- [ ] **Step 4: Run** the collector tests + `TeamEditionService` tests → PASS.

- [ ] **Step 5: Commit** `feat(character): hatás-meglátás mint esti kiadás forrás (mezo-d6ivw.5)`

---

### Task 7: FE `RefTag` icon for the `Effect` ref kind + FE gates

**Files:**
- Modify: `frontend/src/shared/ui/RefTag.tsx` (the `REF_KIND` map — add key `effect`; pick the icon the üveg sprite sheet already has for the S4 Hatás card — grep `effrow`/Hatás usage in `frontend/src` for its icon name; accessible word: `hatás`)
- Test: extend the co-located RefTag test if one exists (`frontend/src/shared/ui/RefTag.test.tsx`); otherwise the fallback behavior is already covered — add one assertion that kind `Effect` resolves to the chosen icon.

- [ ] **Step 1:** Add the map entry + test assertion.
- [ ] **Step 2: Run FE gates:** `CI=true pnpm test` (mock mode), `CI=true VITE_USE_MOCK=false pnpm test`, `pnpm build` — from `frontend/`.
- [ ] **Step 3: Commit** `feat(ui): Effect ref-chip ikon (mezo-d6ivw.5)`

---

### Task 8: Docs + codemap

**Files:**
- Modify: `docs/features/proactive.md` (the apropó block: trigger sources, cooldown table, both-seam injection; key_files + `ProactiveMemoryBlock`)
- Modify: `docs/features/companion.md` (`gatedEffects` read model)
- Modify: `docs/features/character.md` (the `effect` edition source)
- Modify: `docs/features/me.md` (the sensitivity-stance reversal note; also fix the stale `me.md:425` + `PersonEntity.knownFacts` comment flags if still open)

- [ ] **Step 1:** Update the four docs per the knowledge-base skill's 10-section shape (only the sections that changed).
- [ ] **Step 2:** `node scripts/gen-codemap.mjs` and `node scripts/lint-docs.mjs` — the four touched docs come back clean.
- [ ] **Step 3: Commit** `docs: S5 proaktív memóriahasználat dokumentálása (mezo-d6ivw.5)`

---

## Self-review notes

- Spec coverage: apropó-only triggers (T3), no-calendar sources (T3), both seams (T4), ≤1/message (T3 selection), cooldown (T1+T3), sensitivity inclusion + tact (T3+T5), hedged phrasing (T3/T6 copy), knowledge facts on contextual path (T5), edition source (T6), ref provenance (T4), no new slug/kind/contract (none introduced).
- The `pihenes` event has no same-day/yesterday signal source (topics are nightly) — deliberately not a trigger; effect rows for it still reach the edition source. Recorded here so the gap is a decision, not an oversight.
- Deferred: none.

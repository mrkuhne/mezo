# Window-Kind Tool-Calling Generation — Implementation Plan

**Goal:** the `midday`/`evening` companion-feed notes stop being generic 2–3-sentence
blurbs: `generateWindow` goes tool-calling (the full 14-tool `CompanionToolRegistry`
roster on the existing chat budget), gets the new concrete 2–4-paragraph prompt, and the
tool-audit refs land in `CompanionMessageEnvelope.refs`. The `morning`/`sleep`/`weight`
kinds stay untouched. No FE, config, API-contract, or push change.

**Architecture:** `CompanionMessageGenerator` injects the existing `CompanionToolRegistry`
(proactive→companion is an established dependency — the generator already imports
`ContextSnapshotAssembler`, `KnowledgeFactService`, and `ToolText` from there).
`generateWindow` switches from the 2-string `CompanionLlm.complete` to the 4-arg tool
overload with a per-turn `ToolCallAudit`, exactly like `ChatService`; after the call,
`audit.toRefsEnvelope()` is converted to `CompanionMessageEnvelope.Ref(kind, label=id)`
and stored via the 3-arg envelope constructor. The deterministic scaffold (snapshot +
facts + latest daily summary + „ne ismételd" block + ABLAK block), the code-set eyebrow,
the summary emptiness gate, and the idempotency check are all unchanged — the tools
supplement the scaffold, never replace it.

**Spec:** [2026-08-25-window-tool-calling-design.md](../specs/2026-08-25-window-tool-calling-design.md)
**Driving bd:** `mezo-106s` (no dependencies)
**Branch:** `feat/window-tool-calling` (worktree `mezo-window-tool-calling`)

## Global Constraints

- **Scope:** ONLY the `midday` + `evening` kinds. `generateMorning` /
  `generateSleepReaction` / `generateWeightReaction` keep the 2-string tool-free
  overload; the `MORNING_CANDIDATES` / `SLEEP_CANDIDATES` / `WEIGHT_CANDIDATES`
  index-ref mechanics are untouched.
- **Tools:** the full existing roster via `CompanionToolRegistry.callbacks(audit)` —
  **no new tools**. **Budget:** the existing chat budget, `mezo.companion.tools` in
  `backend/src/main/resources/application.yml:396-401` — `max-calls-per-turn: 15`,
  `max-refs-per-turn: 10`. **No new config.**
- **Marker unchanged:** `WINDOW_MARKER = "NAPKOZBENI-JEGYZET-FELADAT"`
  (`CompanionMessageGenerator.java:118`) stays the FIRST line of `WINDOW_PROMPT`, and
  `FakeCompanionLlm.HEARTBEAT_MARKER_MIRROR` (`FakeCompanionLlm.java:193`) stays its
  literal mirror.
- **Refs:** `audit.toRefsEnvelope()` → `RefsEnvelope.Ref(kind, id)` →
  `new CompanionMessageEnvelope.Ref(kind, label=id)` — label is the id verbatim (Locked
  decision 1). The 3-arg `CompanionMessageEnvelope(eyebrow, body, refs)` constructor;
  `interventionKey` stays null (window kind is not an intervention).
- **Error handling unchanged:** LLM/tool failure or blank answer ⇒ `null` (honest
  absence, warn-log); the idempotency check (existing row returned) and the summary
  emptiness gate (`mezo.proactive.feed.past-days: 7`) are unchanged.
- **No FE change** — `mezoMessages.ts` passes `m.refs` through to the
  `MezoMessageItem` and `MezoMessagesSheet.tsx` renders `RefTag kind label` generically
  (the `morning` kind already ships refs). **No API-contract change** — the
  `companion_message.content` jsonb shape and `GET /api/proactive/feed` are unchanged.
- **Tests:** `@ActiveProfiles("companion-fake")`, extend `AbstractIntegrationTest`,
  AssertJ only, data via `*Populator` factories, no mocks. Focused command:
  `cd backend && docker compose up -d && ./mvnw clean test -Dtest=CompanionMessageGeneratorIT`
  (always `clean` — Lombok+MapStruct incremental compile is flaky).
- **Gates:** backend `./mvnw clean test` (CI is the authoritative full-suite gate — if
  the local machine cannot run the heavy IT suite, run the focused set locally and let
  CI run the rest, per `docs/infrastructure/local-dev-testing.md`); FE both modes
  (`cd frontend && pnpm test && VITE_USE_MOCK=true pnpm test`); `node scripts/lint-docs.mjs`.
- **Conventions:** `docs/references/spring_patterns.md` (constructor DI via
  `@RequiredArgsConstructor`); `docs/references/companion_tool_conventions.md` — the
  window prompt's tool routing rides on each tool's own `Használd, amikor …`
  description, so `ChatService.SYSTEM_PROMPT`'s `[Eszköz-útmutató]` block is NOT touched
  (the window prompt is its own system prompt, not the chat's).

## Locked design decisions (assumptions the spec left open)

1. **Ref label = id verbatim.** Spec §5 asked to verify the tool ref-identifier shape.
   Verified in `feature/companion/tools/`: every `addRef` call passes a human-readable
   id — ISO dates (`addRef("Sleep", r.getDate().toString())`), names
   (`addRef("Goal", goal.getTitle())`, `addRef("Recipe", r.getName())`), tags
   (`addRef("Growth", "skills")`, `addRef("Protocol", "v" + version)`). No UUIDs
   anywhere. `new Ref(kind, label=id)` renders correctly on the `RefTag` chip
   (`[Kind] label`) — no humanization layer needed.
2. **Fake-LLM heartbeat branch: side effect, not echo.** `FakeCompanionLlm`'s
   `HEARTBEAT_MARKER_MIRROR` branch currently returns the scripted answer BEFORE
   `toolEchoes` runs, so window ITs cannot exercise the tool path. The fix runs
   `toolEchoes(userMessage, tools, toolContext)` for its audit side effect (the real
   `RecordingToolCallback` records the call, the real tools add their refs to the
   audit) but does NOT append the echo to the returned answer — the persisted body
   stays the clean scripted text and the existing `body()` assertions keep passing.
3. **Sentinel placement in the test note.** `HEARTBEAT_SENTINEL` =
   `\[fake-heartbeat:([^\]]*)]` stops at the first `]`, so the `[fake-tool:…]`
   sentinel must sit OUTSIDE the heartbeat bracket:
   `"[fake-heartbeat:Napközi teszt.] [fake-tool:get_goal]"`. `toolEchoes` scans the
   WHOLE userMessage (the check-in note rides into the snapshot's `[Regeneráció]`
   block), so it still finds and executes the tool sentinel.

## Tasks

### Task 1: RED — window kinds persist tool-audit refs (new ITs)

**Files:**
- Modify: `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/CompanionMessageGeneratorIT.java`

**Interfaces:**
- Consumes: `GoalPopulator.createGoal(UUID owner, String status)` →
  `GoalEntity` (title is the constant `"Nyári cut"`, status `"active"` —
  `GoalPopulator.java:42-44`); `CompanionMessageGenerator.generateWindow(UUID,
  LocalDate, String)` → `CompanionMessageEntity`;
  `CompanionMessageEnvelope.Ref(kind, label)`; `CompanionMessageEntity.KIND_MIDDAY` /
  `KIND_EVENING`.
- Produces: two new IT methods asserting `refs` is non-empty with the exact
  `(kind, label)` pair — the oracle for Task 2.

Steps:

- [ ] Add the import to `CompanionMessageGeneratorIT.java` (the file currently
  imports `CheckInPopulator`, `DailySummaryPopulator`, etc. — add in the same
  `io.mrkuhne.mezo.support.populator` group, alphabetically):
  ```java
  import io.mrkuhne.mezo.support.populator.GoalPopulator;
  ```
  and the field next to the other `@Autowired` populators (after
  `companionMessagePopulator`):
  ```java
  @Autowired private GoalPopulator goalPopulator;
  ```
- [ ] Add the two failing tests at the end of the class (before the closing
  brace), after `testGenerateWindow_shouldReturnExistingRow_whenCalledTwice`:
  ```java
  @Test
  void testGenerateWindow_shouldPersistToolRefs_whenMiddayRunsGetGoal() {
      UUID user = userPopulator.createUser("midday-refs@test.local").getId();
      dailySummaryPopulator.summary(user, DAY.minusDays(1), "Tegnap pihenőnap volt.");
      goalPopulator.createGoal(user, "active");
      // the [fake-tool:…] sentinel sits OUTSIDE the heartbeat bracket (Locked decision 3)
      checkInPopulator.createCheckIn(user, DAY, "12:00", 3, 2,
              "[fake-heartbeat:Napközi teszt.] [fake-tool:get_goal]");

      CompanionMessageEntity message =
              companionMessageGenerator.generateWindow(user, DAY, CompanionMessageEntity.KIND_MIDDAY);

      assertThat(message).isNotNull();
      assertThat(message.getContent().body()).containsExactly("Napközi teszt.");
      assertThat(message.getContent().refs())
              .extracting("kind", "label")
              .containsExactly(tuple("Goal", "Nyári cut"));
  }

  @Test
  void testGenerateWindow_shouldPersistToolRefs_whenEveningRunsGetGoal() {
      UUID user = userPopulator.createUser("evening-refs@test.local").getId();
      dailySummaryPopulator.summary(user, DAY.minusDays(1), "Tegnap pihenőnap volt.");
      goalPopulator.createGoal(user, "active");
      checkInPopulator.createCheckIn(user, DAY, "20:00", 3, 2,
              "[fake-heartbeat:Esti teszt.] [fake-tool:get_goal]");

      CompanionMessageEntity message =
              companionMessageGenerator.generateWindow(user, DAY, CompanionMessageEntity.KIND_EVENING);

      assertThat(message).isNotNull();
      assertThat(message.getContent().body()).containsExactly("Esti teszt.");
      assertThat(message.getContent().refs())
              .extracting("kind", "label")
              .containsExactly(tuple("Goal", "Nyári cut"));
  }
  ```
  (The file already has `import static org.assertj.core.api.Assertions.assertThat;` —
  add `import static org.assertj.core.api.Assertions.tuple;` to the same static group
  and use `tuple("Goal", "Nyári cut")` unqualified in both tests.)
- [ ] Run the focused IT — expect the two NEW tests to FAIL (refs are `[]` today),
  the existing tests to pass:
  ```bash
  cd backend && docker compose up -d && ./mvnw clean test -Dtest=CompanionMessageGeneratorIT
  ```
- [ ] Commit:
  ```bash
  git add backend/src/test/java/io/mrkuhne/mezo/feature/proactive/CompanionMessageGeneratorIT.java
  git commit -m "test(proactive): window kinds should persist tool-audit refs (mezo-106s)"
  ```

### Task 2: GREEN — tool-calling `generateWindow` + fake-LLM heartbeat side effect

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/CompanionMessageGenerator.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/FakeCompanionLlm.java`

**Interfaces:**
- Consumes: `CompanionToolRegistry.newTurnAudit()` → `ToolCallAudit`;
  `CompanionToolRegistry.callbacks(ToolCallAudit)` → `List<ToolCallback>`;
  `CompanionToolRegistry.toolContext(UUID, ToolCallAudit)` → `Map<String, Object>`;
  `CompanionLlm.complete(String systemPrompt, String userMessage, List<ToolCallback>
  tools, Map<String, Object> toolContext)` (the 4-arg default overload —
  `CompanionLlm.java:38-41`, same one `ChatService` uses);
  `ToolCallAudit.toRefsEnvelope()` → `RefsEnvelope` (null when no tool ran);
  `RefsEnvelope.getRefs()` → `List<RefsEnvelope.Ref>` where `Ref(kind, id)`;
  `CompanionMessageEnvelope(eyebrow, List<String> body, List<Ref> refs)` 3-arg
  constructor.
- Produces: `generateWindow` unchanged signature
  `(UUID userId, LocalDate date, String kind)` → `CompanionMessageEntity`, but the
  persisted envelope now carries the tool-audit refs.

Steps:

- [ ] In `CompanionMessageGenerator.java`, add the two imports to the existing
  `io.mrkuhne.mezo.feature.companion.*` group (next to the `ToolText` import at
  line 20):
  ```java
  import io.mrkuhne.mezo.feature.companion.entity.RefsEnvelope;
  import io.mrkuhne.mezo.feature.companion.tools.CompanionToolRegistry;
  import io.mrkuhne.mezo.feature.companion.tools.ToolCallAudit;
  ```
- [ ] Add the registry field to the `@RequiredArgsConstructor` field block (after
  `private final CompanionLlm companionLlm;` at line 136):
  ```java
  private final CompanionToolRegistry toolRegistry;
  ```
- [ ] In `generateWindow` (lines 339-350), replace the 2-string call and the
  empty-refs envelope with the tool-calling call + audit-ref conversion:
  ```java
  // ELŐTT (delete):
  String answer = llmCallContextHolder.runWith(
          new LlmCallContext("proactive_feed", kind, null, null),
          () -> companionLlm.complete(WINDOW_PROMPT, payload));
  if (answer == null || answer.isBlank()) {
      log.warn("Unusable {} answer for {} on {} — no row persisted", kind, userId, date);
      return null;
  }
  CompanionMessageEntity message = new CompanionMessageEntity();
  message.setCreatedBy(userId);
  message.setMessageDate(date);
  message.setKind(kind);
  message.setContent(new CompanionMessageEnvelope(eyebrow, List.of(answer.strip()), List.of()));
  ```
  ```java
  // UTÁNT (insert):
  ToolCallAudit audit = toolRegistry.newTurnAudit();
  String answer = llmCallContextHolder.runWith(
          new LlmCallContext("proactive_feed", kind, null, null),
          () -> companionLlm.complete(WINDOW_PROMPT, payload,
                  toolRegistry.callbacks(audit), toolRegistry.toolContext(userId, audit)));
  if (answer == null || answer.isBlank()) {
      log.warn("Unusable {} answer for {} on {} — no row persisted", kind, userId, date);
      return null;
  }
  RefsEnvelope toolRefs = audit.toRefsEnvelope();
  List<CompanionMessageEnvelope.Ref> refs = toolRefs == null
          ? List.of()
          : toolRefs.getRefs().stream()
                  .map(r -> new CompanionMessageEnvelope.Ref(r.kind(), r.id()))
                  .toList();
  CompanionMessageEntity message = new CompanionMessageEntity();
  message.setCreatedBy(userId);
  message.setMessageDate(date);
  message.setKind(kind);
  message.setContent(new CompanionMessageEnvelope(eyebrow, List.of(answer.strip()), refs));
  ```
  (The `LlmCallContext` call is byte-identical to before — only the `complete`
  arguments change. The other three `generate*` methods keep the 2-string overload
  untouched.)
- [ ] In `FakeCompanionLlm.java`, patch the heartbeat branch (lines 389-391) so the
  scripted answer is returned UNCHANGED but the tool sentinels in the user message
  still execute for their audit side effect (Locked decision 2):
  ```java
  // ELŐTT (delete):
  if (systemPrompt.startsWith(HEARTBEAT_MARKER_MIRROR)) {
      Matcher m = HEARTBEAT_SENTINEL.matcher(userMessage);
      return m.find() ? m.group(1) : "FAKE-NAPKOZBENI-JEGYZET";
  }
  ```
  ```java
  // UTÁNT (insert):
  if (systemPrompt.startsWith(HEARTBEAT_MARKER_MIRROR)) {
      // mezo-106s: run the scripted [fake-tool:…] sentinels for their audit side
      // effect (real RecordingToolCallback + real tool refs), but do NOT echo the
      // results into the answer — the window body stays the clean scripted text.
      toolEchoes(userMessage, tools, toolContext);
      Matcher m = HEARTBEAT_SENTINEL.matcher(userMessage);
      return m.find() ? m.group(1) : "FAKE-NAPKOZBENI-JEGYZET";
  }
  ```
  (`toolEchoes` is the existing private helper at line 666 — it executes every
  `[fake-tool:name]` sentinel against the passed callbacks and returns the echo
  strings, which are discarded here on purpose.)
- [ ] Run the focused IT — expect ALL tests in `CompanionMessageGeneratorIT` to pass
  (the two new ref tests green, the existing `body()`/eyebrow/blank/idempotency
  tests still green):
  ```bash
  cd backend && ./mvnw clean test -Dtest=CompanionMessageGeneratorIT
  ```
- [ ] Commit:
  ```bash
  git add backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/CompanionMessageGenerator.java \
          backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/FakeCompanionLlm.java
  git commit -m "feat(proactive): window kinds go tool-calling; tool-audit refs land in the envelope (mezo-106s)"
  ```

### Task 3: New concrete `WINDOW_PROMPT` (spec §4 verbatim)

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/CompanionMessageGenerator.java`

**Interfaces:**
- Consumes: nothing new — `WINDOW_PROMPT` is a `private static final String`
  constant; the fake LLM dispatches on `WINDOW_MARKER` (unchanged first line), so
  no `FakeCompanionLlm` change.
- Produces: the new system prompt text (spec §4, verbatim). No test asserts on
  prompt text — the gate is the focused IT (behavior unchanged) + the gate suite.

Steps:

- [ ] In `CompanionMessageGenerator.java` (lines 120-127), replace the entire
  `WINDOW_PROMPT` constant. The `WINDOW_MARKER` line (line 118) and its javadoc
  (lines 115-117) stay; only the constant body changes:
  ```java
  // ELŐTT (delete, lines 120-127):
  private static final String WINDOW_PROMPT = WINDOW_MARKER + "\n"
          + "Írj rövid (2-3 mondatos), magyar napközbeni jegyzetet Danielnek társ-szemszögből, "
          + "kizárólag a megadott mai állapotból. Az ABLAK blokk mondja meg a jegyzet fajtáját: "
          + "déli (nudge) esetén a nap hátralévő részére adj egy konkrét, gyengéd fókuszt; esti "
          + "(closing) esetén zárd a napot egy konkrét megfigyeléssel. Ha van MAI KORÁBBI "
          + "ÜZENETEK blokk, annak tartalmát NE ismételd. Számot vagy adatot kitalálni tilos; gyógyszer "
          + "adagolására vonatkozó változtatást SOHA ne javasolj — az orvosi "
          + "döntés. Sima folyószöveggel válaszolj, markdown és felsorolás nélkül.";
  ```
  ```java
  // UTÁNT (insert) — spec §4 verbatim, marker stays the first line:
  private static final String WINDOW_PROMPT = WINDOW_MARKER + "\n"
          + "Írj magyar napközbeni jegyzetet Danielnek társ-szemszögből, 2-4 rövid bekezdésben, "
          + "kizárólag a megadott tényadatokból és a te eszközeidből (tool-hívások) származó "
          + "adatokból. Az ABLAK blokk mondja meg a jegyzet fajtáját: "
          + "- déli (nudge): (1) a nap EDDIGI állapota konkrét számokkal (ami már történt: edzés, "
          + "bevitel a célhoz képest, alvás ha van); (2) mi JÖN MÉG MA (edzés, étkezési keret); "
          + "(3) 1-2 konkrét, cselekvési szintű fókuszpont a hátralévő időre. "
          + "- esti (closing): zárd a napot 1-2 konkrét megfigyeléssel a mai tényleges adataiból "
          + "(mit sikerült, miben maradt el a célhoz képest) + egy rövid tanulság a holnapi napra. "
          + "Szabályok: "
          + "- Konkrét számot CSAK akkor idézhetsz, ha az a megadott pillanatképből vagy egy "
          + "tool-válaszból származik; kitalálni tilos. "
          + "- Ha a pillanatkép egy adatpontot nem ad meg pontosan (pl. mai edzésterv, "
          + "makró-maradék, alvási fázisok), hívd meg a megfelelő eszközt, mielőtt írsz. "
          + "- Ha van MAI KORÁBBI ÜZENETEK blokk, annak tartalmát NE ismételd. "
          + "- Gyógyszer adagolására vonatkozó változtatást SOHA ne javasolj — az orvosi döntés. "
          + "- Sima folyószöveg, markdown és felsorolás nélkül.";
  ```
  (The prompt's tool routing rides on each tool's own `Használd, amikor …`
  description — `ChatService.SYSTEM_PROMPT`'s `[Eszköz-útmutató]` block is NOT
  touched, per spec §4.)
- [ ] Run the focused IT — all `CompanionMessageGeneratorIT` tests still pass
  (the fake dispatches on the marker, not the body):
  ```bash
  cd backend && ./mvnw clean test -Dtest=CompanionMessageGeneratorIT
  ```
- [ ] Commit:
  ```bash
  git add backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/CompanionMessageGenerator.java
  git commit -m "feat(proactive): concrete 2-4-paragraph window prompt with mandatory tool grounding (mezo-106s)"
  ```

### Task 4: Docs — `docs/features/proactive.md` + lint

**Files:**
- Modify: `docs/features/proactive.md`

**Interfaces:**
- Consumes: the shipped behavior from Tasks 2–3.
- Produces: the living feature doc current with the change (AGENTS.md: a behavior/
  contract change updates its `docs/features/<domain>.md` in the same change).

Steps:

- [ ] In `docs/features/proactive.md`, update the `generateWindow` bullet in §3
  (the bullet starting "**`generateWindow`** (midday/evening) — the heartbeat
  generator ported near-verbatim", around line 129). Replace the trailing
  "Flat prose answer (no JSON), code-set eyebrow (`Napközi jegyzet`/`Napzárás`),
  no refs." with:
  ```
  Flat prose answer (no JSON), code-set eyebrow (`Napközi jegyzet`/`Napzárás`).
  Since mezo-106s the LLM call is tool-calling — the full `CompanionToolRegistry`
  roster (14 tools) on the chat budget, the concrete 2–4-paragraph prompt, and the
  tool-audit refs land in the envelope (`refs` no longer `[]`); the `morning`/
  `sleep`/`weight` kinds keep the tool-free overload.
  ```
- [ ] In §7 "How to extend it", update the `midday`/`evening` carry-no-refs note
  (the bullet listing `MORNING_CANDIDATES` — around line 1516): replace
  "`midday`/`evening` carry no refs (the retired-heartbeat precedent)" with
  "`midday`/`evening` carry the tool-audit refs (mezo-106s — the retired-heartbeat
  no-refs precedent is superseded)".
- [ ] Bump the frontmatter: `updated: 2026-08-25` → `updated: 2026-08-26`.
- [ ] Run the doc lint — expect no new errors and no staleness flag on
  `proactive.md`:
  ```bash
  node scripts/lint-docs.mjs
  ```
- [ ] Commit:
  ```bash
  git add docs/features/proactive.md
  git commit -m "docs(proactive): window kinds are tool-calling with envelope refs (mezo-106s)"
  ```

### Task 5: Full gates

**Files:** none (verification only).

Steps:

- [ ] Backend full suite (compose up first; CI is the authoritative full-suite
  gate — if this machine cannot run the heavy IT suite, run the focused
  `CompanionMessageGeneratorIT` + the companion ITs locally and let CI run the
  rest, per `docs/infrastructure/local-dev-testing.md`):
  ```bash
  cd backend && docker compose up -d && ./mvnw clean test
  ```
- [ ] Frontend both modes (no FE change expected — the gate is mandatory
  anyway):
  ```bash
  cd frontend && pnpm test && VITE_USE_MOCK=true pnpm test
  ```
- [ ] Doc lint (already green after Task 4 — re-run to be safe):
  ```bash
  node scripts/lint-docs.mjs
  ```
- [ ] If any gate fails: fix, re-run the failed gate, and add the fix to the
  relevant task's commit (amend) or a follow-up commit with the `(mezo-106s)`
  id. Do not push a red gate.

## Notes for the implementer

- **Do not touch the other three kinds.** `generateMorning` /
  `generateSleepReaction` / `generateWeightReaction` keep the 2-string
  `complete` overload and their `*_CANDIDATES` index-ref mechanics — a diff that
  touches them is out of scope (spec §8).
- **The fake-LLM heartbeat patch is side-effect-only on purpose.** The echo
  strings from `toolEchoes` are discarded; if a future test starts asserting
  `tool:get_goal=[…]` inside a window body, that test is wrong — the body stays
  the clean scripted text.
- **Ref order is insertion order.** `ToolCallAudit` dedupes via
  `LinkedHashSet` and caps at `max-refs-per-turn` (10); the ITs assert the exact
  single-ref pair, so they are order-stable by construction.
- **The `LlmCallContext` is unchanged** — `"proactive_feed"` / `kind` / null /
  null; the llmlog rows for window generations keep their shape.
- **CI runs the full backend IT suite + FE both modes + lint + contract-drift**
  on `ubuntu-latest` — the self-PR is the gate, not the local run.

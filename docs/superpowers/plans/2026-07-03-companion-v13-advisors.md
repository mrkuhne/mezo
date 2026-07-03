# Companion V1.3 — Never-ask-twice + advisor chain v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** the companion stops re-asking known things and starts self-checking its answers — a post-response advisor chain (deterministic clinical Rx-dose guard + one cheap-tier LLM verdict for redundancy & grounding-lite) with the old docs' §4.5 retry semantics (reject → one corrective re-prompt → `degraded` flag on second failure), plus the reinforcement loop's first increment (extraction dedupe-hit against a confirmed fact reinforces it).

**Architecture:** a new `feature/companion/advisor/` subpackage. `CompanionAdvisorChain.review(...)` runs after every LLM answer: `ClinicalOutputCheck` (accent-folded regex — Rx term + dose-change verb in one sentence) then `TurnVerdictCheck` (one flash-tier call through the existing two-string `CompanionLlm` port; strict-JSON verdict `{redundantQuestion, ungroundedClaim, reason}`, defensively parsed, **fail-open**). On violation the chain re-prompts once with the violation summary appended to the system prompt (same tools + same `ToolCallAudit`); a still-violating retry ships with `ai_message.degraded = true`. The sync path (`ChatService.sendMessage`) retries before the answer is delivered; the streamed path (`ChatStreamService`) streams attempt-1 as deltas and reviews before `completeTurn` — the terminal `done` row is authoritative, so the FE's existing done-swap silently carries a corrected answer. `FactExtractionService` dedupe-hits against **confirmed** facts now increment `reinforcement_count` + `last_reinforced_at` instead of silently dropping.

**Tech Stack:** Spring Boot 4 (`ObjectProvider` bean-boundary gating, multi-name `@ConditionalOnProperty`), Spring AI 2 port (two-string `complete` for the verdict call), Liquibase (additive `ai_message.degraded`), Jackson 3 (`tools.jackson`), TanStack Query dual-mode FE, Vitest/MSW.

**Driver:** bd `mezo-fnnq.8` · roadmap §V1.3 · old docs arch §4.5 (retry semantics) + §4.11 (clinical check) · spec §6 · living doc `docs/features/companion.md`.

## Global Constraints

- Branch `feat/companion-v13`; conventional commits carrying `(mezo-fnnq.8)`.
- Backend gate: `cd backend && ./mvnw clean test` (ALWAYS `clean`; compose Postgres up).
- FE gate: `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test` — both modes green.
- Contract-first: `api/feature/companion/companion.yml` BEFORE code; merge `cd api/generate && npm run generate:api`; FE regen `cd frontend && pnpm generate:api`.
- Every new advisor bean gated `@ConditionalOnProperty(name = {COMPANION_SWITCH, COMPANION_ADVISORS_SWITCH}, havingValue = "true")` (the `FactExtractionListener` multi-name idiom); advisors off ⇒ V1.2 behavior byte-for-byte (callers use `ObjectProvider.getIfAvailable()`).
- No LLM in tests — `companion-fake`; the fake answers verdict calls deterministically via content sentinels keyed on the verdict prompt marker (the `[fake-facts:…]` precedent).
- Config under `mezo.companion.advisors.*` on `CompanionProperties`; switch key constant in `FeaturesConfiguration`; never `@Value`.
- An advisor failure must NEVER break a chat turn: verdict LLM/parse failure → fail-open (clean verdict) + `log.warn`; only a *detected violation surviving the retry budget* sets `degraded`.
- Migration: additive changeset only (`ai_message.degraded boolean not null default false`); never modify released changesets; entity mirrored.
- FE: hooks from `@/data/hooks` only; `ChatMessage` FE type stays additive (`degraded?: boolean`); mock mode never shows the badge (mock seed has no degraded answers).
- AssertJ only; ITs extend the shared bases; naming `test{Method}_should{Result}_when{Condition}`.

## Decisions locked (V1.3)

1. **Advisor chain = post-LLM review, not a Spring AI ChatClient advisor.** The codebase talks to the model through the hand-rolled `CompanionLlm` port (ADR 0008), not a shared `ChatClient` — so the "Spring AI Advisor" of the roadmap materializes as a port-level chain (`CompanionAdvisorChain`) the two chat paths call explicitly. Same semantics, no new framework surface.
2. **Chain depth v1 = 2 checks** (the "which advisors are worth their latency" decision): **clinical** (deterministic regex, ~0 ms, runs first; if it violates, the verdict LLM call is skipped for that round) and **one combined LLM verdict** for redundancy + grounding-lite (single flash-tier call — NOT one call per check; the deferred EvidenceCheck/numericGroundingCheck stay deferred per roadmap). Old-docs ContinuityGate/MultiHorizonLoader: not carried (snapshot injection already covers their intent).
3. **Retry semantics per old docs §4.5:** violation → re-prompt once with the violation summary embedded (`RETRY_HEADER` block appended to the system prompt; same user message, same tools, same shared `ToolCallAudit` — chips honestly reflect all calls of the turn); second failure → deliver the retry answer with `degraded = true` + `log.warn`. Retry budget is config `max-retries` (default 1, `@Min(0) @Max(2)`; 0 = check-only flagging). `SelfHealthCheck` persistence table: deferred (log-only) — bd follow-up.
4. **Streamed path reviews post-hoc:** deltas stream attempt-1 unchecked (no server-side buffering — TTFB stays); the chain reviews between the last delta and `done`; `done` carries the final (possibly retried) answer and the FE's existing done-swap replaces the streamed text. Known v1 limitation (noted in living doc §9): a violating attempt-1 is briefly visible while streaming.
5. **Verdict = strict-JSON judge on the chat tier** (`{"redundantQuestion":bool,"ungroundedClaim":bool,"reason":"…"}`), defensive parse (first `{`…last `}`), **fail-open** on call/parse failure (availability over strictness — a broken judge must not degrade every message). Judge context = the turn's full system prompt (voice+snapshot+facts+history) + tool-call name list + user message + answer.
6. **Redundancy scope = the injected fact block** (top-N `include_in_prompt` facts — exactly what the answering model could know; a fact Daniel excluded from the prompt can't be "re-asked" culpably). Grounding-lite: tool results are NOT captured/shown to the judge in v1 — the judge is told claims may derive from the listed tool calls (conservative; the high-value catch is the no-tool fabrication case). Tool-result capture for the judge: bd follow-up.
7. **Clinical check = accent-folded, sentence-scoped co-occurrence**: an Rx term (config list `rx-terms`, default `[retatrutid, reta, tirzepatid, mounjaro, szemaglutid, ozempic, wegovy]`) AND a dose-change verb (imperative/we-form: `emeld|emeljük|növeld|növeljük|csökkentsd|csökkentsük|duplázd|duplázzuk|felezd|felezzük|hagyd el|hagyd ki|hagyjuk el|hagyjuk ki|módosítsd|módosítsuk|állítsd át|állítsuk át`) in the SAME sentence. Precision over recall — statements like "Ma Reta-nap: 4 mg a szokásos adagod" pass; the system-prompt hard rule stays as the first line of defense. Accent folding (NFD + strip marks) so `reta` matches `Retát`.
8. **`degraded` is a persisted, wire-visible message attribute**: `ai_message.degraded boolean not null default false` (additive migration), `MessageResponse.degraded` **required** boolean (backend always emits), FE `ChatMessage.degraded?: boolean` (optional — mock seed unaffected), subtle badge on the assistant bubble (`nem ellenőrzött`, `--color-warning`, tooltip).
9. **Reinforcement v1 = extraction dedupe-hit**: when a freshly extracted candidate normalizes-equal to a **confirmed** `knowledge_fact`, that fact gets `reinforcement_count++` + `last_reinforced_at = now()` (the chat re-learned it — that IS reinforcement); pending-candidate and same-batch duplicates still just skip. The old `reinforce_knowledge_fact` TOOL stays deferred (v3).
10. **Latency measurement built in** (the roadmap's "measure!"): the chain `log.info`s per-turn advisor timing (verdict ms + retry count + verdicts). Review after real-key usage; classifier-tier revisit stays a roadmap note.
11. **Fake-LLM verdict scripting is stateless**: verdict calls are keyed on `VERDICT_MARKER` prompt prefix; the verdict payload embeds the checked ANSWER, and the fake echo embeds the prompts in the answer — so sentinels compose deterministically: `[fake-violate]` = violate only while the answer does NOT contain the retry header (echo of the retry prompt marks attempt-2 → retry succeeds); `[fake-violate-always]` = always violate (degraded path); `[fake-verdict-broken]` = non-JSON verdict (fail-open path). Clinical scenarios need no fake logic at all — the echo copies the user's Rx phrase into the "answer".

## File map

**Backend main:** `feature/companion/advisor/` → `AdvisorViolation.java`, `AdvisedAnswer.java`, `ClinicalOutputCheck.java`, `TurnVerdictCheck.java`, `CompanionAdvisorChain.java` (all new); `service/ChatService.java` (chain wiring + degraded threading), `service/ChatStreamService.java` (post-hoc review), `service/FactExtractionService.java` (reinforcement), `entity/AiMessageEntity.java` (+degraded), `mapper/CompanionMapper.java` (+degraded), `config/CompanionProperties.java` (+Advisors), `llm/FakeCompanionLlm.java` (verdict branch); `techcore/configuration/FeaturesConfiguration.java` (+switch const); `resources/application.yml` (+advisors block), migration `1.0.0/script/202607031900_mezo-fnnq.8_ai_message_degraded.sql` + master registration.

**Backend test:** `advisor/ClinicalOutputCheckTest` (new unit), `CompanionAdvisorChainIT`, `ChatStreamAdvisorIT`, `CompanionAdvisorsSwitchOffIT` (new); `CompanionPropertiesIT`, `FactExtractionServiceIT`, `ChatServiceIT` (extended).

**Frontend:** `data/types.ts` (ChatMessage +degraded?), `data/insights/chatApi.ts` (map), `features/insights/components/ChatMessage.tsx` (badge), `src/test/msw/handlers.ts` (degraded on fixtures + a degraded-done override helper); tests: `chatApi.test.ts`, `ChatPage.test.tsx` (extended).

**Docs:** `docs/features/companion.md` (§1,2,3,4,8,9,10), `docs/milestones/roadmap.md` (milestone row + phase line), this plan. Follow-up bd issues: tool-result capture for the judge · SelfHealthCheck persistence · advisor-latency review after real-key usage.

---

### Task 1: Contract — `MessageResponse.degraded` + regen

**Files:** Modify `api/feature/companion/companion.yml`; regenerate `api/openapi.yml` + `frontend/src/data/_client/api.gen.ts`.

**Interfaces produced:** generated `MessageResponse` (BE + FE) with required `degraded: boolean`.

- [ ] In `MessageResponse`: `required: [id, role, content, createdAt, tools, refs, degraded]` and property:

```yaml
        degraded:
          type: boolean
          description: >-
            True when the answer failed the V1.3 advisor self-check (redundancy / grounding /
            clinical) even after the corrective retry — render it flagged, honest (old docs §4.5
            [degraded] semantics). Always false on user rows.
```

- [ ] `cd api/generate && npm run generate:api && cd ../frontend && pnpm generate:api`.
- [ ] Commit: `feat(api): MessageResponse.degraded — V1.3 advisor flag (mezo-fnnq.8)`.

### Task 2: Migration + entity + mapper — degraded persisted and on the wire

**Files:** Create `backend/src/main/resources/db/changelog/1.0.0/script/202607031900_mezo-fnnq.8_ai_message_degraded.sql`; modify the master changelog (same registration pattern as `…fnnq.7_learned_fact_category`), `entity/AiMessageEntity.java`, `mapper/CompanionMapper.java`, `service/ChatService.java` (thread the flag), test `ChatServiceIT`.

**Interfaces produced:** `AiMessageEntity.isDegraded()/setDegraded(boolean)`; `ChatService.persistMessage(..., boolean degraded)` (private); `ChatService.completeTurn(userId, conversationId, userMessageId, userContent, answer, audit, boolean degraded)` — **signature change** consumed by Task 7.

- [ ] RED: extend `ChatServiceIT` — in the send-message persistence test assert `assistantRow.isDegraded()` is false and the returned `MessageResponse.getDegraded()` is false. Compile fails (no field).
- [ ] GREEN — migration SQL:

```sql
-- V1.3 (bd mezo-fnnq.8): the advisor chain marks answers that failed the post-response
-- self-check twice (old docs §4.5 [degraded] delivery). Additive; existing rows are clean.
alter table ai_message add column degraded boolean not null default false;
```

Register the changeset in the master changelog (author daniel.kuhne, same block shape as the neighboring fnnq entries). Entity field:

```java
    /** V1.3: true when the advisor chain rejected the answer even after the corrective retry. */
    @Column(nullable = false)
    private boolean degraded;
```

Mapper: `.degraded(entity.isDegraded())` in `toMessageResponse`. `ChatService.persistMessage` gains a `boolean degraded` parameter (user rows and pre-V1.3 call sites pass `false`); `completeTurn` gains the trailing `boolean degraded` parameter and passes it through (its current caller passes `false` until Task 7).
- [ ] Run: `cd backend && ./mvnw clean test -Dtest='Chat*IT'` → green (full suite at the gate).
- [ ] Commit: `feat(companion): ai_message.degraded column + wire mapping (mezo-fnnq.8)`.

### Task 3: Config — `Advisors` properties + switch constant

**Files:** Modify `config/CompanionProperties.java`, `resources/application.yml`, `techcore/configuration/FeaturesConfiguration.java`, test `CompanionPropertiesIT`.

**Interfaces produced:** `properties.advisors().enabled()/maxRetries()/rxTerms()`; `FeaturesConfiguration.COMPANION_ADVISORS_SWITCH`.

- [ ] RED: `CompanionPropertiesIT` gains `testAdvisorsConfig_shouldBindFromYaml_whenContextStarts` asserting `enabled()` true, `maxRetries()` 1, `rxTerms()` contains `"retatrutid"` and `"reta"`.
- [ ] GREEN: record component `@NotNull @Valid Advisors advisors`:

```java
    /** V1.3 post-response advisor chain — clinical output check + LLM verdict (redundancy/grounding-lite). */
    public record Advisors(
        /** Master toggle — off removes the chain beans entirely (COMPANION_ADVISORS_SWITCH). */
        boolean enabled,
        /** Corrective re-prompts a violating answer gets before shipping degraded (old docs §4.5: 1). */
        @Min(0) @Max(2) int maxRetries,
        /** Prescription-med terms the clinical check guards (accent-folded contains-match). */
        @NotEmpty List<String> rxTerms
    ) {}
```

YAML under `mezo.companion` (after `extraction:`):

```yaml
    advisors:
      # V1.3 post-response advisor chain — deterministic clinical Rx-dose guard + one cheap-tier
      # LLM verdict (never-ask-twice redundancy + grounding-lite); reject -> one corrective
      # re-prompt -> degraded flag. Off = the chain beans do not exist (V1.2 behavior).
      enabled: true
      # Corrective re-prompts before an answer ships degraded (0 = check-only flagging)
      max-retries: 1
      # Prescription-med terms the clinical check guards (accent-folded match; dose-CHANGE verbs only)
      rx-terms: [retatrutid, reta, tirzepatid, mounjaro, szemaglutid, ozempic, wegovy]
```

Constant: `public static final String COMPANION_ADVISORS_SWITCH = "mezo.companion.advisors.enabled";`.
- [ ] Run `CompanionPropertiesIT` → green. Commit: `feat(companion): advisors config block + switch (mezo-fnnq.8)`.

### Task 4: `ClinicalOutputCheck` (TDD, pure unit)

**Files:** Create `feature/companion/advisor/AdvisorViolation.java`, `feature/companion/advisor/ClinicalOutputCheck.java`; test `backend/src/test/java/io/mrkuhne/mezo/feature/companion/advisor/ClinicalOutputCheckTest.java` (plain JUnit — pure logic, no Spring).

**Interfaces produced:** `record AdvisorViolation(String check, String reason)` (check ∈ `"clinical" | "redundancy" | "grounding"`); `ClinicalOutputCheck.check(String answer) → Optional<AdvisorViolation>`; constructor takes `List<String> rxTerms`.

- [ ] RED — `ClinicalOutputCheckTest` (construct with the default term list):

```java
class ClinicalOutputCheckTest {

    private final ClinicalOutputCheck check = new ClinicalOutputCheck(
            List.of("retatrutid", "reta", "tirzepatid", "mounjaro", "szemaglutid", "ozempic", "wegovy"));

    @Test
    void testCheck_shouldViolate_whenDoseChangeVerbAndRxTermShareASentence() {
        assertThat(check.check("Emeljük a retatrutid adagot 4 mg-ra a jövő héttől.")).isPresent();
    }

    @Test
    void testCheck_shouldViolate_whenRxTermIsAccentedInflection() {
        assertThat(check.check("Szerintem hagyd el a Retát erre a hétre.")).isPresent();
    }

    @Test
    void testCheck_shouldPass_whenRxTermWithoutDoseChangeVerb() {
        assertThat(check.check("A Reta D3 ablakban az étvágy leesik — tervezz 30g fehérjét délutánra.")).isEmpty();
    }

    @Test
    void testCheck_shouldPass_whenDoseChangeVerbWithoutRxTerm() {
        assertThat(check.check("Emeljük a fehérjebevitelt 180 g-ra.")).isEmpty();
    }

    @Test
    void testCheck_shouldPass_whenVerbAndTermInDifferentSentences() {
        assertThat(check.check("Emeljük a tempót az edzésen. A retatrutid mellett ez belefér.")).isEmpty();
    }
}
```

- [ ] GREEN — `ClinicalOutputCheck` (Spring bean, but logic constructor-testable):

```java
/**
 * V1.3 clinical output check (old docs §4.11, "lite"): reject an answer that suggests changing a
 * prescription-drug dose — an Rx term AND a dose-change verb in the SAME sentence. Deterministic
 * (regex, no LLM), accent-folded so "reta" matches "Retát". Precision over recall: statements
 * ("4 mg a szokásos adagod") pass; the system-prompt hard rule remains the first defense.
 */
@Component
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.COMPANION_ADVISORS_SWITCH},
        havingValue = "true")
public class ClinicalOutputCheck {

    static final String CHECK_NAME = "clinical";

    private static final Pattern SENTENCE_SPLIT = Pattern.compile("[.!?\\n]+");
    private static final Pattern DOSE_CHANGE_VERB = Pattern.compile(
            "emeld|emeljuk|noveld|noveljuk|csokkentsd|csokkentsuk|duplazd|duplazzuk|felezd|felezzuk"
                    + "|hagyd el|hagyd ki|hagyjuk el|hagyjuk ki|modositsd|modositsuk|allitsd at|allitsuk at");

    private final List<String> rxTerms;

    public ClinicalOutputCheck(CompanionProperties properties) {
        this(properties.advisors().rxTerms());
    }

    ClinicalOutputCheck(List<String> rxTerms) {
        this.rxTerms = rxTerms.stream().map(ClinicalOutputCheck::fold).toList();
    }

    public Optional<AdvisorViolation> check(String answer) {
        for (String sentence : SENTENCE_SPLIT.split(fold(answer))) {
            if (DOSE_CHANGE_VERB.matcher(sentence).find()
                    && rxTerms.stream().anyMatch(sentence::contains)) {
                return Optional.of(new AdvisorViolation(CHECK_NAME,
                        "Rx gyógyszer adagolásának módosítását javasolja — ez orvosi döntés."));
            }
        }
        return Optional.empty();
    }

    /** Lowercase + NFD accent-strip — "Retát" -> "retat", verb forms match without diacritics. */
    private static String fold(String text) {
        return Normalizer.normalize(text.toLowerCase(), Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "");
    }
}
```

Dual constructor: Spring uses the `CompanionProperties` one; the test uses the package-private list one. NOTE: the verb pattern is written accent-FOLDED (novel/csokkent/modosit/allitsd) because it matches the folded text.
- [ ] Run `./mvnw clean test -Dtest=ClinicalOutputCheckTest` → green. Commit: `feat(companion): clinical Rx-dose output check (mezo-fnnq.8)`.

### Task 5: `TurnVerdictCheck` + fake-LLM verdict branch (TDD)

**Files:** Create `feature/companion/advisor/TurnVerdictCheck.java`; modify `llm/FakeCompanionLlm.java`; test `backend/src/test/java/io/mrkuhne/mezo/feature/companion/advisor/TurnVerdictCheckIT.java`.

**Interfaces produced:** `TurnVerdictCheck.check(String turnSystemPrompt, String userMessage, String answer, List<String> toolCallNames) → List<AdvisorViolation>`; constants `TurnVerdictCheck.VERDICT_MARKER = "VÁLASZ-ELLENŐRZÉS"`; fake sentinels `FakeCompanionLlm.VIOLATE_ONCE = "[fake-violate]"`, `VIOLATE_ALWAYS = "[fake-violate-always]"`, `VERDICT_BROKEN = "[fake-verdict-broken]"`.

- [ ] RED — `TurnVerdictCheckIT` (`@ActiveProfiles("companion-fake")`, extends `AbstractIntegrationTest`, `@Autowired TurnVerdictCheck`):

```java
    @Test
    void testCheck_shouldReturnNoViolations_whenAnswerIsClean() {
        assertThat(verdictCheck.check("PROMPT", "kérdés", "tiszta válasz", List.of())).isEmpty();
    }

    @Test
    void testCheck_shouldReturnViolation_whenFakeScriptsRedundancy() {
        List<AdvisorViolation> violations =
                verdictCheck.check("PROMPT", "kérdés", "válasz [fake-violate]", List.of());
        assertThat(violations).extracting(AdvisorViolation::check).containsExactly("redundancy");
    }

    @Test
    void testCheck_shouldFailOpen_whenVerdictIsNotJson() {
        assertThat(verdictCheck.check("PROMPT", "kérdés", "válasz [fake-verdict-broken]", List.of())).isEmpty();
    }
```

- [ ] GREEN — `TurnVerdictCheck`:

```java
/**
 * V1.3 combined LLM verdict — ONE cheap-tier call judging the answer for (1) never-ask-twice
 * redundancy against the injected fact block and (2) grounding-lite (specific past claims with
 * no source in the provided context). Strict JSON, defensively parsed, FAIL-OPEN: a broken or
 * unreachable judge yields zero violations (availability over strictness) + a warn log.
 * Tool results are not captured in v1 — the judge is told claims may derive from the listed
 * tool calls (conservative; the high-value catch is the no-tool fabrication case).
 */
@Slf4j
@Component
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.COMPANION_ADVISORS_SWITCH},
        havingValue = "true")
@RequiredArgsConstructor
public class TurnVerdictCheck {

    /** The verdict prompt's first word — the fake LLM keys its deterministic verdict on it. */
    public static final String VERDICT_MARKER = "VÁLASZ-ELLENŐRZÉS";

    static final String VERDICT_PROMPT = VERDICT_MARKER + """
            . Bíráld el a Mezo asszisztens válaszát az alábbi szempontok szerint.
            1) redundantQuestion: rákérdez-e a válasz olyasmire, amire a kontextus MEGERŐSÍTETT TÉNYEK blokkja már választ ad?
            2) ungroundedClaim: állít-e a válasz konkrét múltbeli adatot vagy számot, amit sem a kontextus, sem a felsorolt eszközhívások, sem Daniel üzenete nem támaszt alá? A kontextusban szereplő adatokból számolt/becsült érték alátámasztottnak számít.
            Válaszolj KIZÁRÓLAG ezzel a JSON objektummal, magyarázat nélkül:
            {"redundantQuestion":true|false,"ungroundedClaim":true|false,"reason":"rövid indoklás"}""";

    private final CompanionLlm companionLlm;
    private final ObjectMapper objectMapper;

    record TurnVerdict(boolean redundantQuestion, boolean ungroundedClaim, String reason) {}

    public List<AdvisorViolation> check(
            String turnSystemPrompt, String userMessage, String answer, List<String> toolCallNames) {
        String payload = "KONTEXTUS:\n" + turnSystemPrompt
                + "\n\nESZKÖZHÍVÁSOK: " + (toolCallNames.isEmpty() ? "nincs" : String.join(", ", toolCallNames))
                + "\n\nDaniel üzenete: " + userMessage
                + "\n\nMEZO VÁLASZA:\n" + answer;
        String raw;
        try {
            raw = companionLlm.complete(VERDICT_PROMPT, payload);
        } catch (Exception e) {
            log.warn("Advisor verdict LLM call failed — failing open", e);
            return List.of();
        }
        TurnVerdict verdict = parse(raw);
        List<AdvisorViolation> violations = new ArrayList<>();
        if (verdict.redundantQuestion()) {
            violations.add(new AdvisorViolation("redundancy", verdict.reason()));
        }
        if (verdict.ungroundedClaim()) {
            violations.add(new AdvisorViolation("grounding", verdict.reason()));
        }
        return violations;
    }

    /** Defensive: first '{'..last '}' substring; anything unparseable is a CLEAN verdict (fail-open). */
    private TurnVerdict parse(String raw) {
        int start = raw.indexOf('{');
        int end = raw.lastIndexOf('}');
        if (start < 0 || end <= start) {
            log.warn("Advisor verdict was not JSON — failing open: {}", raw);
            return new TurnVerdict(false, false, "");
        }
        try {
            return objectMapper.readValue(raw.substring(start, end + 1), TurnVerdict.class);
        } catch (Exception e) {
            log.warn("Advisor verdict JSON unparseable — failing open: {}", raw, e);
            return new TurnVerdict(false, false, "");
        }
    }
}
```

`FakeCompanionLlm` — sentinels + verdict branch (BEFORE the echo, after the extraction branch); import `TurnVerdictCheck` and `CompanionAdvisorChain` constants:

```java
    /** Scripted verdicts (V1.3): violate only until the retry header appears in the checked answer. */
    public static final String VIOLATE_ONCE = "[fake-violate]";
    /** Scripted verdicts (V1.3): violate every round — exercises the degraded path. */
    public static final String VIOLATE_ALWAYS = "[fake-violate-always]";
    /** Scripted verdicts (V1.3): answer with non-JSON — exercises the fail-open path. */
    public static final String VERDICT_BROKEN = "[fake-verdict-broken]";
```

```java
        if (systemPrompt.startsWith(TurnVerdictCheck.VERDICT_MARKER)) {
            return verdictAnswer(userMessage);
        }
```

```java
    /**
     * Deterministic, STATELESS verdict scripting: the payload embeds the checked answer, and the
     * echo embeds the prompts in every answer — so attempt-2 answers contain the retry header,
     * which is how [fake-violate] "passes" the retry without the fake keeping state.
     */
    private String verdictAnswer(String userMessage) {
        if (userMessage.contains(VERDICT_BROKEN)) {
            return "ez nem json";
        }
        boolean retryRound = userMessage.contains(CompanionAdvisorChain.RETRY_MARKER);
        if (userMessage.contains(VIOLATE_ALWAYS) || (userMessage.contains(VIOLATE_ONCE) && !retryRound)) {
            return "{\"redundantQuestion\":true,\"ungroundedClaim\":false,\"reason\":\"ismert tényre kérdez rá\"}";
        }
        return "{\"redundantQuestion\":false,\"ungroundedClaim\":false,\"reason\":\"\"}";
    }
```

NOTE: `CompanionAdvisorChain.RETRY_MARKER` is produced in Task 6; to keep THIS task compiling standalone, create `CompanionAdvisorChain` is not needed — instead reference the constant from a small holder: put `RETRY_MARKER` on `TurnVerdictCheck` is wrong ownership; simplest: define the public constant in this task inside a new `CompanionAdvisorChain` skeleton? NO — keep tasks self-contained: define `public static final String RETRY_MARKER = "AZ ELŐZŐ VÁLASZ ELUTASÍTVA"` in `AdvisorViolation`'s file? Also wrong. **Resolution:** create `feature/companion/advisor/AdvisorRetry.java` in THIS task:

```java
/** The corrective re-prompt block (old docs §4.5) — shared by the chain (producer) and the fake LLM (detector). */
public final class AdvisorRetry {

    /** Header marker — also how the stateless fake verdict recognizes a retry round. */
    public static final String RETRY_MARKER = "AZ ELŐZŐ VÁLASZ ELUTASÍTVA";

    private AdvisorRetry() {}

    public static String block(List<AdvisorViolation> violations) {
        StringBuilder block = new StringBuilder("\n\n").append(RETRY_MARKER)
                .append(" — javítsd és válaszolj újra. Okok:\n");
        for (AdvisorViolation violation : violations) {
            block.append("- ").append(violation.check()).append(": ").append(violation.reason()).append('\n');
        }
        return block.append("""
                Szabályok: ne kérdezz rá már megerősített tényre; csak a kontextus, az eszközhívások \
                vagy Daniel üzenete által alátámasztott adatot állíts; Rx gyógyszer adagolásának \
                módosítását soha ne javasold.""").toString();
    }
}
```

The fake references `AdvisorRetry.RETRY_MARKER`.
- [ ] Run `./mvnw clean test -Dtest=TurnVerdictCheckIT` → green. Commit: `feat(companion): LLM turn-verdict check + fake verdict scripting (mezo-fnnq.8)`.

### Task 6: `CompanionAdvisorChain` + sync-path wiring (TDD)

**Files:** Create `feature/companion/advisor/AdvisedAnswer.java`, `feature/companion/advisor/CompanionAdvisorChain.java`; modify `service/ChatService.java`; test `backend/src/test/java/io/mrkuhne/mezo/feature/companion/CompanionAdvisorChainIT.java`.

**Interfaces produced:** `record AdvisedAnswer(String answer, boolean degraded)`; `CompanionAdvisorChain.complete(systemPrompt, userMessage, tools, toolContext, audit) → AdvisedAnswer` and `.review(systemPrompt, userMessage, answer, tools, toolContext, audit) → AdvisedAnswer` (Task 7 consumes `review`).

- [ ] RED — `CompanionAdvisorChainIT` (`@ActiveProfiles("companion-fake")`, extends `AbstractIntegrationTest`; drive through `ChatService.sendMessage` so persistence is asserted too; owner user from the base class populator idiom, conversation via `ConversationService.create`):

```java
    @Test
    void testSendMessage_shouldKeepAnswerClean_whenNoViolation() {
        MessageResponse response = chatService.sendMessage(ownerId, conversationId, request("szia mezo"));
        assertThat(response.getDegraded()).isFalse();
        assertThat(response.getContent()).doesNotContain(AdvisorRetry.RETRY_MARKER);
    }

    @Test
    void testSendMessage_shouldRetryAndRecover_whenFirstAnswerViolates() {
        MessageResponse response = chatService.sendMessage(
                ownerId, conversationId, request("kérdés " + FakeCompanionLlm.VIOLATE_ONCE));
        // the retry echo carries the corrective block -> proves the second LLM round happened
        assertThat(response.getContent()).contains(AdvisorRetry.RETRY_MARKER);
        assertThat(response.getDegraded()).isFalse();
    }

    @Test
    void testSendMessage_shouldShipDegraded_whenRetryStillViolates() {
        MessageResponse response = chatService.sendMessage(
                ownerId, conversationId, request("kérdés " + FakeCompanionLlm.VIOLATE_ALWAYS));
        assertThat(response.getDegraded()).isTrue();
        AiMessageEntity row = messageRepository.findById(response.getId()).orElseThrow();
        assertThat(row.isDegraded()).isTrue();
    }

    @Test
    void testSendMessage_shouldShipDegraded_whenClinicalPhrasePersists() {
        // the echo copies the phrase into every "answer": attempt-1 and the retry both violate
        MessageResponse response = chatService.sendMessage(
                ownerId, conversationId, request("Emeljük a retatrutid adagot 4 mg-ra?"));
        assertThat(response.getDegraded()).isTrue();
    }

    @Test
    void testSendMessage_shouldFailOpen_whenVerdictIsBroken() {
        MessageResponse response = chatService.sendMessage(
                ownerId, conversationId, request("kérdés " + FakeCompanionLlm.VERDICT_BROKEN));
        assertThat(response.getDegraded()).isFalse();
        assertThat(response.getContent()).doesNotContain(AdvisorRetry.RETRY_MARKER);
    }
```

- [ ] GREEN — `CompanionAdvisorChain`:

```java
/**
 * V1.3 post-response advisor chain (old docs §4.5 retry semantics on the CompanionLlm port):
 * clinical check first (deterministic, ~0 ms; a hit skips the LLM verdict for that round), then
 * the combined LLM verdict. Violation -> corrective re-prompt (same user message, same tools,
 * SAME audit — chips honestly reflect the whole turn) up to advisors.max-retries times; a final
 * violating answer ships degraded=true. Timing + verdicts are logged (the roadmap's "measure!").
 */
@Slf4j
@Component
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.COMPANION_ADVISORS_SWITCH},
        havingValue = "true")
@RequiredArgsConstructor
public class CompanionAdvisorChain {

    private final CompanionLlm companionLlm;
    private final ClinicalOutputCheck clinicalOutputCheck;
    private final TurnVerdictCheck turnVerdictCheck;
    private final CompanionProperties properties;

    /** Sync path: first attempt + review in one call. */
    public AdvisedAnswer complete(String systemPrompt, String userMessage,
            List<ToolCallback> tools, Map<String, Object> toolContext, ToolCallAudit audit) {
        String answer = companionLlm.complete(systemPrompt, userMessage, tools, toolContext);
        return review(systemPrompt, userMessage, answer, tools, toolContext, audit);
    }

    /** Streamed path: attempt-1 already delivered as deltas — review it, retry non-streamed if needed. */
    public AdvisedAnswer review(String systemPrompt, String userMessage, String answer,
            List<ToolCallback> tools, Map<String, Object> toolContext, ToolCallAudit audit) {
        long startedAt = System.currentTimeMillis();
        List<AdvisorViolation> violations = runChecks(systemPrompt, userMessage, answer, audit);
        int retries = 0;
        while (!violations.isEmpty() && retries < properties.advisors().maxRetries()) {
            retries++;
            answer = companionLlm.complete(
                    systemPrompt + AdvisorRetry.block(violations), userMessage, tools, toolContext);
            violations = runChecks(systemPrompt, userMessage, answer, audit);
        }
        boolean degraded = !violations.isEmpty();
        if (degraded) {
            log.warn("Advisor chain degraded an answer after {} retries: {}", retries, violations);
        }
        log.info("Advisor chain took {} ms (retries={}, degraded={})",
                System.currentTimeMillis() - startedAt, retries, degraded);
        return new AdvisedAnswer(answer, degraded);
    }

    /** Clinical first; a clinical hit skips the verdict LLM call this round (the retry re-checks all). */
    private List<AdvisorViolation> runChecks(
            String systemPrompt, String userMessage, String answer, ToolCallAudit audit) {
        Optional<AdvisorViolation> clinical = clinicalOutputCheck.check(answer);
        if (clinical.isPresent()) {
            return List.of(clinical.get());
        }
        return turnVerdictCheck.check(systemPrompt, userMessage, answer, audit.callNames());
    }
}
```

`ToolCallAudit` gains the read accessor (one-liner):

```java
    /** Names of the calls recorded so far — the V1.3 verdict payload's tool-call list. */
    public List<String> callNames() {
        return calls.stream().map(ToolCallsEnvelope.ToolCall::name).toList();
    }
```

`ChatService` wiring — replace the direct LLM call in `sendMessage`:

```java
    private final ObjectProvider<CompanionAdvisorChain> advisorChain;
```

```java
        ToolCallAudit audit = toolRegistry.newTurnAudit();
        String answer;
        boolean degraded = false;
        CompanionAdvisorChain chain = advisorChain.getIfAvailable();
        if (chain != null) {
            // V1.3: the advisor chain owns the LLM round(s) — retry-once, degraded on 2nd failure
            AdvisedAnswer advised = chain.complete(systemPrompt, request.getContent(),
                    toolRegistry.callbacks(audit), toolRegistry.toolContext(userId, audit), audit);
            answer = advised.answer();
            degraded = advised.degraded();
        } else {
            answer = companionLlm.complete(systemPrompt, request.getContent(),
                    toolRegistry.callbacks(audit), toolRegistry.toolContext(userId, audit));
        }
        AiMessageEntity assistant = persistMessage(conversation, userId, AiMessageEntity.ROLE_ASSISTANT,
                answer, audit.toToolCallsEnvelope(), audit.toRefsEnvelope(), degraded);
```

- [ ] Run `./mvnw clean test -Dtest='CompanionAdvisorChainIT,ChatServiceIT,CompanionApiIT'` → green (existing ChatServiceIT prompt-echo asserts must still pass — clean turns produce identical answers plus one verdict call).
- [ ] Commit: `feat(companion): advisor chain — retry-once + degraded, sync path (mezo-fnnq.8)`.

### Task 7: Streamed path — post-hoc review before `done`

**Files:** Modify `service/ChatStreamService.java`; test `backend/src/test/java/io/mrkuhne/mezo/feature/companion/ChatStreamAdvisorIT.java` (new; model after `ChatStreamServiceIT` — NOT `@Transactional`).

**Interfaces consumed:** `CompanionAdvisorChain.review(...)` (Task 6), `ChatService.completeTurn(..., boolean degraded)` (Task 2).

- [ ] RED — `ChatStreamAdvisorIT`:

```java
    @Test
    void testStreamMessage_shouldCarryRetriedAnswerInDone_whenFirstAnswerViolates() {
        List<ServerSentEvent<Object>> events = streamService.streamMessage(
                ownerId, conversationId, request("kérdés " + FakeCompanionLlm.VIOLATE_ONCE))
                .collectList().block();
        String streamed = joinDeltas(events); // attempt-1: no retry marker in the deltas
        assertThat(streamed).doesNotContain(AdvisorRetry.RETRY_MARKER);
        MessageResponse done = doneOf(events);
        assertThat(done.getContent()).contains(AdvisorRetry.RETRY_MARKER); // done = retried answer
        assertThat(done.getDegraded()).isFalse();
    }

    @Test
    void testStreamMessage_shouldFlagDoneDegraded_whenRetryStillViolates() {
        List<ServerSentEvent<Object>> events = streamService.streamMessage(
                ownerId, conversationId, request("kérdés " + FakeCompanionLlm.VIOLATE_ALWAYS))
                .collectList().block();
        MessageResponse done = doneOf(events);
        assertThat(done.getDegraded()).isTrue();
        assertThat(messageRepository.findById(done.getId()).orElseThrow().isDegraded()).isTrue();
    }
```

(`joinDeltas`/`doneOf` helpers as in `ChatStreamServiceIT` — copy the local idiom.)
- [ ] GREEN — `ChatStreamService`: inject `ObjectProvider<CompanionAdvisorChain> advisorChain`; the `concatWith` callable becomes:

```java
                .concatWith(Mono.fromCallable(() -> {
                    // V1.3: post-hoc review — deltas already delivered attempt-1; the done row is
                    // authoritative (the FE swaps it in), so a corrective retry lands silently here.
                    String finalAnswer = answer.toString();
                    boolean degraded = false;
                    CompanionAdvisorChain chain = advisorChain.getIfAvailable();
                    if (chain != null) {
                        AdvisedAnswer advised = chain.review(turn.systemPrompt(), turn.userContent(),
                                finalAnswer, toolRegistry.callbacks(audit),
                                toolRegistry.toolContext(userId, audit), audit);
                        finalAnswer = advised.answer();
                        degraded = advised.degraded();
                    }
                    return ServerSentEvent.<Object>builder(
                                    chatService.completeTurn(userId, conversationId, turn.userMessageId(),
                                            turn.userContent(), finalAnswer, audit, degraded))
                            .event(EVENT_DONE).build();
                }))
```

- [ ] Run `./mvnw clean test -Dtest='ChatStream*IT,CompanionStreamApiIT'` → green (existing stream ITs stay green: clean turns get a clean review).
- [ ] Commit: `feat(companion): streamed turn reviews post-hoc — done row authoritative (mezo-fnnq.8)`.

### Task 8: Switch-off boundary

**Files:** Create `backend/src/test/java/io/mrkuhne/mezo/feature/companion/CompanionAdvisorsSwitchOffIT.java`.

- [ ] Model on `ChatExtractionSwitchOffIT`:

```java
/** Advisors off ⇒ the chain beans do not exist and a scripted violation changes nothing (V1.2 behavior). */
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = "mezo.companion.advisors.enabled=false")
class CompanionAdvisorsSwitchOffIT extends AbstractIntegrationTest {

    @Autowired private ApplicationContext context;
    @Autowired private ChatService chatService;
    // owner/conversation setup as in CompanionAdvisorChainIT

    @Test
    void testChainBean_shouldNotExist_whenAdvisorsDisabled() {
        assertThat(context.getBeanProvider(CompanionAdvisorChain.class).getIfAvailable()).isNull();
    }

    @Test
    void testSendMessage_shouldIgnoreViolationSentinels_whenAdvisorsDisabled() {
        MessageResponse response = chatService.sendMessage(
                ownerId, conversationId, request("kérdés " + FakeCompanionLlm.VIOLATE_ALWAYS));
        assertThat(response.getDegraded()).isFalse();
        assertThat(response.getContent()).doesNotContain(AdvisorRetry.RETRY_MARKER);
    }
}
```

- [ ] Run it → green. Commit: `test(companion): advisors switch-off boundary (mezo-fnnq.8)`.

### Task 9: Reinforcement — extraction dedupe-hit reinforces the confirmed fact (TDD)

**Files:** Modify `service/FactExtractionService.java`; test `FactExtractionServiceIT` (extend).

**Interfaces produced:** none new — behavior change inside `extractFromTurn`.

- [ ] RED — extend `FactExtractionServiceIT` (populate a confirmed fact via `KnowledgeFactPopulator`, then script the extractor to return the same text):

```java
    @Test
    void testExtractFromTurn_shouldReinforceConfirmedFact_whenDuplicateExtracted() {
        KnowledgeFactEntity fact = knowledgeFactPopulator.fact(ownerId, "Reggel edzik szívesebben", "train");
        int persisted = extractionService.extractFromTurn(ownerId, messageId, userContent(
                "[fake-facts:[{\"fact\":\"reggel   edzik szívesebben\",\"category\":\"train\"}]]"), "válasz");
        assertThat(persisted).isZero(); // no new candidate
        KnowledgeFactEntity reloaded = knowledgeFactRepository.findById(fact.getId()).orElseThrow();
        assertThat(reloaded.getReinforcementCount()).isEqualTo(1);
        assertThat(reloaded.getLastReinforcedAt()).isNotNull();
    }

    @Test
    void testExtractFromTurn_shouldNotReinforce_whenDuplicateOfPendingCandidate() {
        learnedFactPopulator.candidate(ownerId, "esti kávé rontja az alvását", "health", messageId);
        int persisted = extractionService.extractFromTurn(ownerId, messageId, userContent(
                "[fake-facts:[{\"fact\":\"Esti kávé rontja az alvását\",\"category\":\"health\"}]]"), "válasz");
        assertThat(persisted).isZero();
        // no confirmed fact existed -> nothing to reinforce; still exactly one pending candidate
    }
```

(Match the existing IT's populator/`userContent` idioms; adjust helper names to what the file already uses.)
- [ ] GREEN — in `FactExtractionService`, split the known-set so confirmed facts keep their entity:

```java
        Map<String, KnowledgeFactEntity> confirmed = confirmedByNormalizedText(userId);
        Set<String> known = new HashSet<>(confirmed.keySet());
        learnedFactRepository
                .findByCreatedByAndUserDecisionIsNullAndDeletedFalseOrderByCreatedAtDesc(userId)
                .forEach(c -> known.add(normalize(c.getCandidateText())));
```

and inside the loop, the dedupe branch reinforces confirmed hits (V1.3):

```java
            String normalized = normalize(fact.fact());
            if (!known.add(normalized)) {
                KnowledgeFactEntity hit = confirmed.get(normalized);
                if (hit != null) {
                    // V1.3 reinforcement: the chat re-learned a confirmed fact — that IS a re-confirmation
                    hit.setReinforcementCount(hit.getReinforcementCount() + 1);
                    hit.setLastReinforcedAt(Instant.now());
                    knowledgeFactRepository.save(hit);
                }
                continue;
            }
```

with

```java
    private Map<String, KnowledgeFactEntity> confirmedByNormalizedText(UUID userId) {
        return knowledgeFactRepository
                .findByCreatedByAndDeletedFalseOrderByReinforcementCountDescCreatedAtDesc(userId)
                .stream()
                .collect(Collectors.toMap(f -> normalize(f.getFactText()), f -> f, (a, b) -> a));
    }
```

- [ ] Run `./mvnw clean test -Dtest='FactExtraction*IT,ChatExtraction*IT'` → green. Commit: `feat(companion): extraction dedupe-hit reinforces confirmed facts (mezo-fnnq.8)`.

### Task 10: FE — degraded badge on the assistant bubble (dual-mode)

**Files:** Modify `frontend/src/data/types.ts` (ChatMessage), `frontend/src/data/insights/chatApi.ts` (map), `frontend/src/features/insights/components/ChatMessage.tsx` (badge), `frontend/src/test/msw/handlers.ts` (fixtures); tests `chatApi.test.ts`, `ChatPage.test.tsx`.

**Interfaces produced:** `ChatMessage.degraded?: boolean`.

- [ ] RED — `chatApi.test.ts`: `toChatMessage` maps `degraded: true → true` and `degraded: false → undefined`. `ChatPage.test.tsx` (real mode): a per-test MSW override (`server.use`, the file's existing idiom) whose `done` event carries `degraded: true` → after send, the badge text `nem ellenőrzött` is visible; default handlers (degraded false) → badge absent. Mock mode: assert the badge never renders with the seed.
- [ ] GREEN:
  - `types.ts`: add `degraded?: boolean` to `ChatMessage` (comment: `/** V1.3: answer failed the backend self-check even after retry — render flagged. */`).
  - `chatApi.ts` `toChatMessage`: `degraded: m.degraded || undefined,`.
  - `ChatMessage.tsx` — in the assistant header row (after the timestamp span):

```tsx
        {m.degraded && (
          <span
            className="eyebrow"
            style={{ fontSize: 9, color: 'var(--color-warning)' }}
            title="Ez a válasz nem ment át az önellenőrzésen — kezeld fenntartással."
          >
            nem ellenőrzött
          </span>
        )}
```

  - `handlers.ts`: add `degraded: false` to every `MessageResponse`-shaped fixture (list + stream `done`).
- [ ] Run: `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test` → all green.
- [ ] Commit: `feat(fe): degraded-answer badge on chat messages (mezo-fnnq.8)`.

### Task 11: Docs + follow-ups

**Files:** Modify `docs/features/companion.md`, `docs/milestones/roadmap.md`; create bd follow-up issues.

- [ ] `companion.md`: §1 status (+V1.3 line, phase table row Advisors → ✅ V1.3), §2 (degraded badge behavior), §3 (advisor chain flow — sync retry-before-deliver vs streamed post-hoc review + done-swap), §4 (migration, `MessageResponse.degraded`, `mezo.companion.advisors.*` keys), §7 (drop the V1.3 plug-in note; describe the chain as the place V2.3 recall checks plug into), §8 (new ITs + the stateless fake-verdict sentinel trick), §9 (decisions 1–11 from this plan, incl. the streamed-visibility limitation + fail-open rationale), §10 (new files). Run `node scripts/lint-docs.mjs` → clean.
- [ ] `roadmap.md`: Phase-3 line gains ✅ V1.3 (**v1 „megjegyez" complete**); new milestone-log row (backend chain, retry semantics, degraded wire+FE badge, reinforcement, gates).
- [ ] bd follow-ups: `bd create` — (1) "Companion: capture tool results into ToolCallAudit for the verdict judge (V1.3 deferred)", (2) "Companion: SelfHealthCheck persistence for advisor violations (log-only in V1.3)", (3) "Companion: review advisor latency/cost after real-key usage — classifier tier decision" (P3, notes reference mezo-fnnq.8).
- [ ] Commit: `docs(companion): V1.3 living docs — advisor chain, degraded flag, reinforcement (mezo-fnnq.8)`.

### Task 12: Gates + merge + close

- [ ] `cd backend && ./mvnw clean test` → full green.
- [ ] `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test` → green ×2.
- [ ] `node scripts/lint-docs.mjs` → clean.
- [ ] Merge: `git checkout main && git merge --no-ff feat/companion-v13 -m "Merge feat/companion-v13: never-ask-twice + advisor chain v1 (mezo-fnnq.8)"` then `git branch -d feat/companion-v13`. (Memory: do NOT `git pull --rebase` after the merge — push directly; resolve a rejected push with a fresh pull *before* re-merging.)
- [ ] `bd close mezo-fnnq.8` then `bd update mezo-fnnq.8 --notes "..."` (the close-reason CLI quirk); `bd dolt push`.
- [ ] `git push && git status` → "up to date with origin".

## Self-review notes

- **Spec coverage:** redundancy guard ✅ (T5/T6 verdict `redundantQuestion`), grounding-lite ✅ (T5 `ungroundedClaim`, conservative tool handling per Decision 6), clinical graduation ✅ (T4 deterministic check in the chain), retry-once → degraded ✅ (T6 chain, old §4.5), FE degraded rendering ✅ (T10), reinforcement start ✅ (T9, per living-doc §7 V1.3 note), "measure!" open decision ✅ (Decision 10 logging), retry budget ✅ (config `max-retries`).
- **Type consistency:** `AdvisedAnswer(answer, degraded)` produced T6, consumed T6/T7; `completeTurn(..., degraded)` changed T2, consumer updated T7 (its only caller); `ToolCallAudit.callNames()` produced T6, used by chain→verdict; `AdvisorRetry.RETRY_MARKER` produced T5, used T5 (fake), T6–T8 (tests); fake sentinels produced T5, used T6–T8.
- **Compile-order check:** T5 references `AdvisorRetry` (created in T5) — self-contained; T6's chain uses T5's classes; ChatServiceIT keeps passing from T6 because clean verdicts don't alter the answer.
- **Placeholder scan:** clean — every code step carries the actual code; test helpers explicitly deferred to local idioms where the file already defines them (`joinDeltas`, populator helpers).

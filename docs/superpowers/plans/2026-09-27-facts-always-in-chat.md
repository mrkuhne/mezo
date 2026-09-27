# Facts Always In Chat (mezo-d6ivw.8) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every enabled knowledge fact is always injected into the conversation-first chat context (and stays injected on every other channel); the top-10 selection is replaced by a 200-fact safety cap, and the Tények view stops showing a "bekapcsolva, de most kimarad" state that no longer exists.

**Architecture:** One backend config-semantics change (`top-n: 10` → `prompt-cap: 200` in `CompanionProperties.Facts`, cap = safety brake with WARN, ordering unchanged), one injection-point edit (`ChatService.conversationContext` appends `renderPromptBlock` as a sibling block — NOT inside `PersonalContextAssembler`, which also feeds the settings preview), one prompt-header addition (passive-use preamble), and an FE collapse of the three fact buckets to two. Docs (companion.md, insights.md, ADR 0043) updated to the new reality.

**Tech Stack:** Spring Boot (backend/), React+Vite (frontend/), JUnit ITs with the fixed dev DB (focused runs) or Testcontainers, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-24-mezo-emlekezete-design.md` § "Facts-always delta" (2026-09-27).

## Global Constraints

- Cap value is exactly **200**, validation range **1..500** (owner decision 2026-09-27).
- The facts block stays in the **volatile half** (delivered by `completeSmart`'s context argument); NEVER touch `stableSystemPrompt` (prompt-cache discipline, `ChatService.java` javadoc around :443-460).
- Do NOT put facts inside `PersonalContextAssembler` — it feeds the GET `/api/companion/personal-context` preview and `FeedContextAssembler`.
- `renderNewPatternFactsBlock` (ÚJ FELISMERÉSEK) and the whole legacy path (`turnContext`, `chatGearContext`) stay untouched.
- `include_in_prompt=false` remains the user kill-switch on every channel (already honored by the repository query — do not weaken).
- Conventional commit subjects carry the bead id `(mezo-d6ivw.8)`.
- Backend tests: run focused (`./mvnw test -Dtest=...`); if the shared dev DB misbehaves, first retry is `-Dmezo.test.use-testcontainers=true` (slice lesson 27).
- FE tests in BOTH modes with `CI=true` (mock: `VITE_USE_MOCK` unset; real: `VITE_USE_MOCK=false`), plus `pnpm build`.
- No API contract changes (no new OpenAPI fields) — FE no longer needs the number.
- All work in this worktree on branch `feat/emlekezet-facts-always`.

---

### Task 1: Backend config — `top-n` → `prompt-cap: 200` with WARN-on-trim

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/config/CompanionProperties.java:174-180` (record `Facts`)
- Modify: `backend/src/main/resources/application.yml:911-914`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/KnowledgeFactService.java:185-204` (`topFactsForPrompt`)
- Modify: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/CompanionPropertiesIT.java:59`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/KnowledgeFactServiceIT.java:167-183`
- Create: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/KnowledgeFactPromptCapIT.java`

**Interfaces:**
- Consumes: existing `CompanionProperties.facts()`, `KnowledgeFactRepository` finders.
- Produces: `properties.facts().promptCap()` (int, default 200) — Task 3's javadoc references it; `renderPromptBlock(UUID)` semantics become "all enabled facts, strongest first, hard-capped at promptCap".

- [ ] **Step 1: Update the two existing test expectations to the NEW reality (failing first)**

In `CompanionPropertiesIT.java` replace the facts assertion:

```java
    @Test
    void testFactsConfig_shouldBindPromptCapFromYaml_whenContextStarts() {
        assertThat(properties.facts().promptCap()).isEqualTo(200);
        assertThat(properties.facts().patternAckDays()).isEqualTo(3);
    }
```

In `KnowledgeFactServiceIT.java` replace `testRenderPromptBlock_shouldKeepTopNByReinforcement_whenMoreFactsThanBudget` with the no-cutoff proof (12 facts — more than the old 10 — ALL present):

```java
    @Test
    void testRenderPromptBlock_shouldIncludeEveryEnabledFact_whenMoreThanTheOldTopTen() {
        UUID userId = databasePopulator.populateUser("fact-topn@test.local");
        // facts-always delta (mezo-d6ivw.8): 12 facts, reinforcement 1..12 — no top-10 cutoff,
        // every enabled fact rides; ordering stays strongest-first
        for (int i = 1; i <= 12; i++) {
            factPopulator.fact(userId, "tény-%02d".formatted(i), "train", i);
        }

        String block = knowledgeFactService.renderPromptBlock(userId);

        assertThat(block).startsWith(KnowledgeFactService.FACTS_HEADER
                .replace(PromptPersona.NAME_TOKEN, "fact-topn@test.local"));
        assertThat(block).contains("tény-12").contains("tény-02").contains("tény-01");
        assertThat(block.indexOf("tény-12")).isLessThan(block.indexOf("tény-11"));
    }
```

- [ ] **Step 2: Run both to verify they fail**

Run: `cd backend && ../mvnw test -Dtest='CompanionPropertiesIT,KnowledgeFactServiceIT#testRenderPromptBlock_shouldIncludeEveryEnabledFact_whenMoreThanTheOldTopTen'`
Expected: FAIL — `promptCap()` does not compile / `tény-01` missing from block.

- [ ] **Step 3: Rename the record component and the yml key**

`CompanionProperties.java` — replace the `Facts` record:

```java
    /** V1.1→facts-always (mezo-d6ivw.8): EVERY enabled fact rides in every prompt; the cap is a
     *  safety brake only (owner set 200, 2026-09-27) — trimming is logged, never silent. */
    public record Facts(
        /** Safety ceiling on the injected block — strongest facts survive a trim (never a working limit). */
        @Min(1) @Max(500) int promptCap,
        /** V3.3: freshly promoted pattern-facts younger than this many days get an in-chat acknowledgment block (0 = off). */
        @Min(0) @Max(30) int patternAckDays
    ) {}
```

`application.yml` — replace the `facts:` block (the key rename deliberately fail-fasts any stale `top-n` override at startup):

```yaml
    facts:
      # facts-always (mezo-d6ivw.8): EVERY enabled confirmed fact is injected into every chat
      # turn and generator prompt; this is a safety ceiling only (WARN when it ever trims)
      prompt-cap: 200
      # V3.3: pattern-facts promoted within this many days get an in-chat acknowledgment
      # block ("ezt megtanultam rólad"); 0 = off
      pattern-ack-days: 3
```

- [ ] **Step 4: Re-point `topFactsForPrompt` at the cap and add the WARN**

In `KnowledgeFactService.java`, replace `topFactsForPrompt` (class already has `@Slf4j`? — check; if not, add `@Slf4j` to the class annotations, import `lombok.extern.slf4j.Slf4j`):

```java
    /**
     * Facts-always (mezo-d6ivw.8): every enabled fact, strongest first; {@code promptCap} is a
     * safety brake, not a working limit — a trim is WARN-logged so the day the list outgrows the
     * cap is visible (the answer then is consolidation, tracked separately, not rank-and-drop).
     * The citation tie-breaker still orders equal-reinforcement groups when it is measurable.
     */
    private List<KnowledgeFactEntity> topFactsForPrompt(UUID userId) {
        Map<UUID, Integer> cited = citedWeeks(userId);
        Comparator<KnowledgeFactEntity> order = Comparator
                .comparingInt(KnowledgeFactEntity::getReinforcementCount).reversed()
                .thenComparing(Comparator.comparingInt(
                        (KnowledgeFactEntity fact) -> cited == null ? 0 : cited.getOrDefault(fact.getId(), 0)).reversed())
                .thenComparing(Comparator.comparing(
                        KnowledgeFactEntity::getCreatedAt, Comparator.reverseOrder()));
        List<KnowledgeFactEntity> all = repository
                .findByCreatedByAndIncludeInPromptTrueAndDeletedFalseOrderByReinforcementCountDescCreatedAtDesc(
                        userId, Pageable.unpaged())
                .stream()
                .sorted(order)
                .toList();
        int cap = properties.facts().promptCap();
        if (all.size() > cap) {
            log.warn("knowledge_fact prompt-cap trimmed the block: {} enabled facts, cap {} — "
                    + "consolidation is due (facts-always delta, mezo-d6ivw.8)", all.size(), cap);
            return all.subList(0, cap);
        }
        return all;
    }
```

(The old paged/citation split disappears: the list endpoint already reads all facts unpaged, so a single unpaged read is the established cost profile. Keep `citedWeeks` and its javadoc as-is.)

- [ ] **Step 5: Grep for other `topN()` readers**

Run: `grep -rn "facts().topN()" backend/src`
Expected: no hits besides the one just edited (recon found only this read site). If any other hit appears, change it to `promptCap()` with the same semantics and note it in the commit body.

- [ ] **Step 6: Run the two updated tests to verify they pass**

Run: `cd backend && ../mvnw test -Dtest='CompanionPropertiesIT,KnowledgeFactServiceIT'`
Expected: PASS (all methods, including the untouched empty/toggle/label tests).

- [ ] **Step 7: Write the cap-trim IT (failing check is the assertion itself)**

Create `backend/src/test/java/io/mrkuhne/mezo/feature/companion/KnowledgeFactPromptCapIT.java` — mirror the class skeleton of `KnowledgeFactServiceIT` (same base class/annotations/populators — copy its header verbatim, then the property override):

```java
@TestPropertySource(properties = "mezo.companion.facts.prompt-cap=3")
class KnowledgeFactPromptCapIT extends /* same base as KnowledgeFactServiceIT */ {

    @Test
    void testRenderPromptBlock_shouldKeepStrongestAndTrim_whenOverPromptCap() {
        UUID userId = databasePopulator.populateUser("fact-cap@test.local");
        for (int i = 1; i <= 5; i++) {
            factPopulator.fact(userId, "tény-%02d".formatted(i), "train", i);
        }

        String block = knowledgeFactService.renderPromptBlock(userId);

        assertThat(block).contains("tény-05").contains("tény-04").contains("tény-03");
        assertThat(block).doesNotContain("tény-02").doesNotContain("tény-01");
    }
}
```

(If `@TestPropertySource` on a subclass of the shared IT base forks a new Spring context that the suite disallows, follow the `PersonalContextConversationIT` precedent — it flips `mezo.companion.conversation.enabled` the same way, so the pattern is house-approved.)

- [ ] **Step 8: Run it**

Run: `cd backend && ../mvnw test -Dtest=KnowledgeFactPromptCapIT`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/config/CompanionProperties.java backend/src/main/resources/application.yml backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/KnowledgeFactService.java backend/src/test/java/io/mrkuhne/mezo/feature/companion/
git commit -m "feat(companion): facts prompt-cap 200 — minden bekapcsolt tény megy, a plafon csak fék (mezo-d6ivw.8)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Passive-use preamble in `FACTS_HEADER`

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/KnowledgeFactService.java:45`
- Test: existing `KnowledgeFactServiceIT` (asserts via the constant, so it follows automatically)

**Interfaces:**
- Consumes: nothing new.
- Produces: `KnowledgeFactService.FACTS_HEADER` (public constant) — every existing consumer (legacy chat, 8+ generators, the `get_personal_context` tool) picks the preamble up for free; ITs that `startsWith(FACTS_HEADER…)` keep passing because they reference the constant.

- [ ] **Step 1: Replace the constant**

```java
    /** The injection block header — appended as a sibling block on every channel (facts-always,
     *  mezo-d6ivw.8). The second line is the passive-use rule (Claude-memory pattern, spec delta
     *  2026-09-27): use naturally when relevant, never enumerate, never cite the remembering. */
    public static final String FACTS_HEADER =
            "\n\nMEGERŐSÍTETT TÉNYEK {{NÉV}} személyéről (legfontosabb elöl):\n"
            + "Ezeket tudod róla korábbról. Használd természetesen, amikor releváns — "
            + "ne sorold fel, és ne hivatkozz arra, hogy \"megjegyezted\".\n";
```

- [ ] **Step 2: Run the fact-block tests**

Run: `cd backend && ../mvnw test -Dtest='KnowledgeFactServiceIT,KnowledgeFactPromptCapIT'`
Expected: PASS. If any test asserts an EXACT block string (not via the constant), update it to build its expectation from `FACTS_HEADER`.

- [ ] **Step 3: Grep for literal copies of the old header**

Run: `grep -rn "MEGERŐSÍTETT TÉNYEK" backend/src frontend/src docs/features | grep -v KnowledgeFactService.java`
Expected: doc mentions only (handled in Task 5). Any backend/FE literal duplicate must be switched to the constant / updated.

- [ ] **Step 4: Commit**

```bash
git add backend/src
git commit -m "feat(companion): halk-használat preambulum a tényblokk fejlécében (mezo-d6ivw.8)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Inject the facts block into the conversation-first context

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ChatService.java:503-508` (`conversationContext`) and the canonical prompt-order javadoc (~:443-452)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/tools/ConversationContextTools.java:47-51` (tool description)
- Create: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/service/ConversationFactsIT.java`

**Interfaces:**
- Consumes: `knowledgeFactService.renderPromptBlock(userId)` from Task 1 (ChatService already holds the `KnowledgeFactService` field for the legacy path — verify with `grep -n "knowledgeFactService" backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ChatService.java`; it is used in `turnContext`).
- Produces: conversation-first volatile context ends with the facts block; sync `sendMessage`, SSE `prepareTurn`, and `openingTurn` all inherit it through `routeAndAssemble`/`conversationContext`.

- [ ] **Step 1: Write the failing IT**

Create `ConversationFactsIT.java` next to `ConversationFirstIT.java`, copying its class-level setup (it runs with `mezo.companion.conversation.enabled=true` and the deterministic `FakeCompanionLlm`, which echoes the system halves into the answer — `docs/features/companion.md:7481`). Model the send call on an existing `ConversationFirstIT` test method (same populators/helpers):

```java
class ConversationFactsIT extends /* same base + property setup as ConversationFirstIT */ {

    @Test
    void testConversationTurn_shouldCarryEveryEnabledFact_inVolatileContext() {
        UUID userId = databasePopulator.populateUser("conv-facts@test.local");
        // 11 facts — one more than the retired top-10 — plus one toggled off
        for (int i = 1; i <= 11; i++) {
            factPopulator.fact(userId, "konv-tény-%02d".formatted(i), "train", i);
        }
        factPopulator.fact(userId, "kikapcsolt konv-tény", "fuel", 99, false, KnowledgeFactEntity.SOURCE_MANUAL);

        String answer = /* the same send-turn helper ConversationFirstIT uses */;

        assertThat(answer).contains("MEGERŐSÍTETT TÉNYEK");
        assertThat(answer).contains("konv-tény-01").contains("konv-tény-11");
        assertThat(answer).doesNotContain("kikapcsolt konv-tény");
    }
}
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd backend && ../mvnw test -Dtest=ConversationFactsIT`
Expected: FAIL — the echoed context has no `MEGERŐSÍTETT TÉNYEK` block.

- [ ] **Step 3: Append the block in `conversationContext`**

```java
    private String conversationContext(UUID userId, AiConversationEntity conversation, LocalDate today) {
        return promptPersona.render(userId, "\n\n[Beszélgetés]\nMa: " + today + "\n"
                + "A beszélgetési előzmény korlátozott ablak; régebbi részlet kérésre lekérhető.\n"
                + anchoredBlock(userId, conversation.getContextKind(), conversation.getContextDate()))
                + personalContextAssembler.render(userId, today)
                // facts-always (mezo-d6ivw.8): confirmed facts are identity, not data lookup —
                // they join date/preferences as initial background (ADR 0043 amendment); the
                // model uses them passively (preamble in FACTS_HEADER), tools stay for the rest
                + knowledgeFactService.renderPromptBlock(userId);
    }
```

Also extend the canonical prompt-order javadoc (~:443-452): after the sentence describing the conversation path, note that on the conversation-first path the volatile half now ends with the facts block (facts-always, mezo-d6ivw.8).

- [ ] **Step 4: Run the new IT + the conversation-first family to verify nothing regressed**

Run: `cd backend && ../mvnw test -Dtest='ConversationFactsIT,ConversationFirstIT,PersonalContextConversationIT,PersonalContextAssemblerIT,AnchoredConversationIT'`
Expected: PASS. If `PersonalContextConversationIT` asserts the FULL context equals the preview (not just contains it), adjust its assertion to `contains` — the preview endpoint's contract is "assembler output identical", not "assembler is the whole context" (the `[Beszélgetés]` header already precedes it).

- [ ] **Step 5: Note the duplication away in the tool description**

In `ConversationContextTools.java`, extend the `get_personal_context` description's facts sentence so the planner stops re-reading what it already has:

```java
    @Tool(name = "get_personal_context", description = "Személyes háttér rövid, korlátozott összefoglalója; nem a teljes adattár. "
            + "scope=facts (alapértelmezés): megerősített tények — ezek MÁR a kontextusodban vannak "
            + "(MEGERŐSÍTETT TÉNYEK blokk), csak akkor kérd le, ha a blokkot nem látod; people: ismert emberek és kapcsolatuk; "
            + "character: tárolt karakterleírás; reflections: nyitott észrevételek; today: aktuális "
            + "egészség/nap állapotösszesítő. Használd, amikor a kérdéshez ez a személyes háttér kell. "
            + "Teljes tények/emberek/részletek: read_personal_records(source=knowledge_fact|person|mention|character_dimension). A többi forrás: list_personal_sources.")
```

- [ ] **Step 6: Run the tool/flow ITs touching the description**

Run: `cd backend && ../mvnw test -Dtest='ConversationFirstIT,ConversationContinuationIT,ConversationLimitsIT'`
Expected: PASS (descriptions are not asserted verbatim anywhere per recon; if one is, update the literal).

- [ ] **Step 7: Commit**

```bash
git add backend/src
git commit -m "feat(companion): a conversation-first chat mindig megkapja a tényblokkot (mezo-d6ivw.8)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: FE — two buckets, honest copy

**Files:**
- Modify: `frontend/src/data/insights/knowledge.ts:2-18` (drop `PROMPT_TOP_N`, keep `PATTERN_ACK_DAYS`)
- Modify: `frontend/src/features/insights/logic/factCopy.ts` (bucket collapse, labels)
- Modify: `frontend/src/features/insights/components/FactsView.tsx` (drop waiting section, copy)
- Modify: `frontend/src/features/insights/components/HowItWorksView.tsx` (FAQ rewrite)
- Modify: `frontend/src/features/insights/pages/KnowledgeListPage.tsx:130` (call site)
- Modify: `frontend/src/features/insights/components/KnowledgeFactRow.tsx` (only if it types `FactBucket` exhaustively — compiler will say)
- Test: `frontend/src/features/insights/logic/factCopy.test.ts`

**Interfaces:**
- Consumes: nothing from backend (no API change; the FE mirrors the new semantics, cap=200 is deliberately NOT mirrored — unreachable in UI terms).
- Produces: `bucketFacts(facts: KnowledgeFact[]): { inPrompt: KnowledgeFact[]; off: KnowledgeFact[] }` (no `topN`/`now` params, no `waiting`); `type FactBucket = 'in-prompt' | 'off'`; `promptStatusLabel('in-prompt') === 'A társ tudja — minden beszélgetésben ott van'`.

- [ ] **Step 1: Rewrite the bucketing tests first**

In `factCopy.test.ts`, replace the `bucketFacts` describe block and the label expectation:

```ts
describe('bucketFacts', () => {
  it('minden bekapcsolt tény a chatben van — nincs várólista (facts-always, mezo-d6ivw.8)', () => {
    const { inPrompt, off } = bucketFacts(facts)
    expect(inPrompt.map((f) => f.id)).toEqual(sortFacts(facts.filter((f) => f.active)).map((f) => f.id))
    expect(off.every((f) => !f.active)).toBe(true)
  })

  it('minden tény pontosan egy vödörben van', () => {
    const { inPrompt, off } = bucketFacts(facts)
    expect(inPrompt.length + off.length).toBe(facts.length)
  })
})
```

and

```ts
expect(promptStatusLabel('in-prompt')).toBe('A társ tudja — minden beszélgetésben ott van')
expect(promptStatusLabel('off')).toBe('Kikapcsolva — a társ nem látja')
```

Delete the fresh-pattern/waiting test cases (`p-fresh`, `p-old`, `c-fresh`, the two-channel cases).

- [ ] **Step 2: Run to verify they fail**

Run: `cd frontend && CI=true pnpm test src/features/insights/logic/factCopy.test.ts`
(Reminder: file args scope correctly only via vitest's path filter — this invocation runs the whole suite in this repo; that is acceptable here, just read the factCopy results.)
Expected: FAIL — `waiting` still exists / labels differ.

- [ ] **Step 3: Collapse the buckets in `factCopy.ts`**

```ts
type FactBucket = 'in-prompt' | 'off'

const STATUS_LABEL: Record<FactBucket, string> = {
  'in-prompt': 'A társ tudja — minden beszélgetésben ott van',
  off: 'Kikapcsolva — a társ nem látja',
}
```

```ts
/**
 * Két vödör (facts-always, mezo-d6ivw.8): MINDEN bekapcsolt tény megy a chatbe és minden
 * generált üzenetbe — a kapcsoló az egyetlen szűrő. A backend 200-as prompt-plafonja
 * biztonsági fék, nem munkalimit; a UI szándékosan nem tükrözi.
 */
export function bucketFacts(facts: KnowledgeFact[]) {
  return {
    inPrompt: sortFacts(facts.filter((f) => f.active)),
    off: sortFacts(facts.filter((f) => !f.active)),
  }
}
```

Remove the `PROMPT_TOP_N` import; keep `sortFacts` (order still communicates "legfontosabb elöl").

- [ ] **Step 4: `knowledge.ts` — delete `PROMPT_TOP_N`, re-comment `PATTERN_ACK_DAYS`**

Delete the `PROMPT_TOP_N` export and its comment. Replace the `PATTERN_ACK_DAYS` comment (the second channel is now legacy-only):

```ts
/**
 * A backend `mezo.companion.facts.pattern-ack-days` kézzel szinkronban tartott tükre — a
 * KnowledgeFactRow "friss minta" eredet-mondata használja. (A külön ÚJ FELISMERÉSEK injektálási
 * csatorna a facts-always delta óta csak a legacy chat-úton él; a vödrözésnek már nem tényezője.)
 */
export const PATTERN_ACK_DAYS = 3
```

(If `PATTERN_ACK_DAYS` turns out to be used ONLY by the deleted bucketing — check with `grep -rn PATTERN_ACK_DAYS frontend/src` — delete it too and drop this comment.)

- [ ] **Step 5: `FactsView.tsx` — remove the waiting section, fix the copy**

- Change the buckets prop type to `{ inPrompt: KnowledgeFact[]; off: KnowledgeFact[] }`.
- Delete `const waiting = visible(buckets.waiting)`, `highlightInWaiting`, and the whole `LifecycleSection title="Bekapcsolva, de most kimarad"` block; `nothingMatches` sums only `inPrompt.length + off.length`.
- Section header + footnote:

```tsx
<h2 className="tud9-sech">Ezeket tudja rólad · {inPrompt.length}</h2>
...
<p className="tud9-fn">
  Ami itt be van kapcsolva, azt a társ minden beszélgetésben és minden magától küldött
  üzenetében tudja rólad — a legmegerősítettebb áll elöl.
</p>
```

The `Kikapcsolva` section stays as-is.

- [ ] **Step 6: `KnowledgeListPage.tsx` + `HowItWorksView.tsx`**

- `KnowledgeListPage.tsx:130`: `const buckets = useMemo(() => bucketFacts(facts), [facts])`; drop the stale comment above it and the `PROMPT_TOP_N` import. The hero copy at :201 (`${buckets.inPrompt.length} megy a chatbe`) now truthfully counts all enabled facts — leave it.
- `HowItWorksView.tsx`: drop the `PROMPT_TOP_N` import (keep `PATTERN_ACK_DAYS` only if it survived Step 4) and replace the two stale FAQ entries:

```tsx
  ['Mit csinál a kapcsoló?', 'Bekapcsolva a tény ott van a társ fejében minden beszélgetésben és minden magától küldött üzenetben. Kikapcsolva a társ soha nem látja — sem a válaszaiban, sem a felismeréseiben.'],
```

```tsx
  ['Mindet tudja egyszerre?', 'Igen: ami be van kapcsolva, azt a társ mindig tudja — nem válogat közülük. Van egy magas biztonsági határ (200 tény), de az a mindennapokban elérhetetlen; ha egyszer közelítenéd, összevonjuk a hasonlókat.'],
```

(The second replaces "Miért marad ki néhány?".)

- [ ] **Step 7: Typecheck + targeted test run**

Run: `cd frontend && pnpm tsc --noEmit && CI=true pnpm test`
Expected: clean compile (the compiler flags every leftover `waiting`/`PROMPT_TOP_N` reference — fix each), suite PASS in mock mode.

- [ ] **Step 8: Real-mode + build gate**

Run: `cd frontend && CI=true VITE_USE_MOCK=false pnpm test && pnpm build`
Expected: PASS + build clean.

- [ ] **Step 9: Commit**

```bash
git add frontend/src
git commit -m "feat(insights): Tények nézet — két vödör, őszinte felirat: minden bekapcsolt tény megy (mezo-d6ivw.8)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Docs — companion.md, insights.md, ADR 0043 amendment

**Files:**
- Modify: `docs/decisions/0043-conversation-first-companion.md`
- Modify: `docs/features/companion.md` (≈:924, :1943-1945, :2319, config table ≈:6239)
- Modify: `docs/features/insights.md` §2.4 (≈:396-427)

**Interfaces:** none — prose only, but the lint gate applies.

- [ ] **Step 1: ADR 0043 amendment**

Append at the end of `0043-conversation-first-companion.md`:

```markdown
## Amendment (2026-09-27, mezo-d6ivw.8 — facts-always)

Confirmed personal facts (`knowledge_fact`, enabled ones) are initial background again:
they join the date, preferences and explicit anchors in the volatile context half, because
they are identity, not data lookup — the model must never contradict what the user confirmed
about themselves. Everything else this ADR moved behind tools stays behind tools (snapshots,
memory search, character, history). The block carries a passive-use preamble; the model is
not asked to mention it.
```

- [ ] **Step 2: companion.md**

- ≈:924 ("top-N injection block in every system prompt"): rewrite to "every enabled fact (safety cap 200, `prompt-cap`) is injected into every system prompt — chat (both paths) and generators".
- :1943-1945 ("no automatic … memory search"): amend the list — the confirmed-facts block IS automatic since facts-always (mezo-d6ivw.8); snapshot/character/memory search remain tool-only; note the legacy CHAT gear stays factless by spec 2026-09-16 §6.5 as the rollback exception.
- :2319 canonical prompt-order diagram: add the facts block to the conversation-first description (volatile half, after the personal context).
- Config table ≈:6239: `mezo.companion.facts.top-n` → `mezo.companion.facts.prompt-cap`, default 200, "safety ceiling, WARN on trim".
- Search for other stale claims: `grep -n "top-n\|top-N\|topN" docs/features/companion.md` and fix each hit that describes injection semantics.

- [ ] **Step 3: insights.md §2.4**

Rewrite the bucket description: two sections (enabled = injected everywhere, disabled), the "waiting" state is gone; the hero's "M megy a chatbe" counts all enabled facts; `PROMPT_TOP_N` mirror constant removed.

- [ ] **Step 4: Lint gate**

Run: `node scripts/lint-docs.mjs`
Expected: the three touched docs are NOT among stale/error findings (pre-existing findings elsewhere are not this task's to fix).

- [ ] **Step 5: Commit**

```bash
git add docs
git commit -m "docs(companion): facts-always valóság — ADR 0043 kiegészítés, prompt-cap, vödör-összevonás (mezo-d6ivw.8)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Gates, merge to main, close out

**Files:** none new (verification + git only).

- [ ] **Step 1: Focused backend gate**

Run: `cd backend && ../mvnw test -Dtest='KnowledgeFactServiceIT,KnowledgeFactPromptCapIT,CompanionPropertiesIT,ConversationFactsIT,ConversationFirstIT,PersonalContextConversationIT,PersonalContextAssemblerIT,ChatServiceIT,ChatStreamServiceIT'`
Expected: PASS. On shared-DB flakiness, retry with `-Dmezo.test.use-testcontainers=true`.

- [ ] **Step 2: FE gate (both modes) + build**

Run: `cd frontend && CI=true pnpm test && CI=true VITE_USE_MOCK=false pnpm test && pnpm build`
Expected: PASS ×2 + clean build.

- [ ] **Step 3: Codemap freshness**

Run: `node scripts/gen-codemap.mjs && git diff --stat docs/CODEMAP.md`
Commit the regenerated codemap if it changed (`docs: codemap refresh (mezo-d6ivw.8)`).

- [ ] **Step 4: Rebase + merge to main (worktree detached-HEAD pattern)**

```bash
git pull --rebase origin main
git checkout --detach origin/main
git merge --no-ff feat/emlekezet-facts-always -m "Merge branch 'feat/emlekezet-facts-always' — minden bekapcsolt tény mindig a társ fejében (mezo-d6ivw.8)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
node scripts/gen-codemap.mjs   # merge silently drops CODEMAP entries — regenerate, commit if dirty
git push origin HEAD:main
git branch -D feat/emlekezet-facts-always
```

Watch the `deploy` workflow for the pushed commit (`gh run list --branch main --limit 2`) until success; a red `ci` outranks everything.

- [ ] **Step 5: Close the bead + session close protocol**

```bash
bd close mezo-d6ivw.8 --reason "Minden bekapcsolt tény minden csatornán; prompt-cap 200 (WARN féknek); halk-használat preambulum; FE két vödör + őszinte copy; ADR 0043 amendment. Konszolidációs sweep külön beaden."
node scripts/check-beads-backup.mjs --fix
git add .beads/issues.jsonl && git commit -m "chore(beads): tracker backup after mezo-d6ivw.8 [skip ci]" && git pull --rebase && bd dolt push && git push origin HEAD:main
```

Then append any newly-paid-for lessons to the spec's "Slice lessons" appendix, and report to the owner in Hungarian (what he can now see in the app, what was deferred to mezo-d6ivw.6 / the consolidation bead).

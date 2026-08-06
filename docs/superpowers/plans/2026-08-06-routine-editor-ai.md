# Routine Editor AI Suggester (mezo-n5e9.3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `POST /api/habit/ai/suggest` — the companion's SMART model proposes habits (grounded in skills + active goal + current chains, strict-JSON, propose-only, MANUAL-only) — surfaced as an „AI javaslat" sheet in the routine editor whose accept-cards go through the normal `createDef`.

**Architecture:** Port-in-habit / adapter-in-companion (the `SlotPlanLlmAdapter` idiom — keeps `feature_slices_are_cycle_free` happy since companion→habit is the established direction): `feature/habit/service/HabitSuggestPort` consumed via `ObjectProvider` (absent port ⇒ clean 503), `feature/companion/llm/HabitSuggestLlmAdapter` implements it on `CompanionLlm.completeSmart` with the `HypothesisPipelineService.propose` strict-JSON pattern (prose-schema Hungarian prompt, bracket-substring parse, degrade-to-empty). Audit rides `llm_log` automatically via the port; tagged `LlmCallContext("habit_ai_suggest", "propose", …)`. FE: `useHabitAiSuggest` + `AiSuggestSheet` in the editor, ChatPage's honest-degraded pattern on 503.

**Spec:** `docs/superpowers/specs/2026-08-05-routine-editor-design.md` §6 + D7 · **bd:** `mezo-n5e9.3` · **Branch:** `feat/routine-editor-ai`

## Global Constraints

- Worktree `…/parallel-session-2`, branch `feat/routine-editor-ai`. Contract-first (`api/feature/habit/habit.yml` → `cd api/generate && npm run generate:api` → `cd frontend && pnpm generate:api`).
- **NEVER the full backend suite locally.** Focused: `cd backend && ./mvnw clean test -Dtest='HabitAiSuggestApiIT' -DargLine=-Xmx3g` while iterating; task gates name their sets; final backend gate `-Dtest='Habit*IT,ProgressionHabitIT,QuestApiIT,CompanionApiIT' -DargLine=-Xmx3g`. ALWAYS `clean`. Compose PG runs on :15432.
- Suggestions are **propose-only and MANUAL-only** (spec D7): the model never writes; the endpoint returns candidates; accepting calls the existing create endpoint with `mode: MANUAL` (server forces `metric: manual`).
- Switch: new `HABIT_AI_SUGGEST_SWITCH = "mezo.feature.habit-ai-suggest.enabled"` in `FeaturesConfiguration`; the ADAPTER bean is gated on the three-way array `{HABIT_AI_SUGGEST_SWITCH, COMPANION_SWITCH, HABIT_SWITCH}` (the `SlotPlanLlmAdapter` template at `feature/companion/llm/SlotPlanLlmAdapter.java:19-21`); any switch off ⇒ no adapter bean ⇒ `ObjectProvider` empty ⇒ 503, no manual flag reads.
- Tunables: new `CompanionProperties.HabitSuggest(@Min(1) @Max(8) int maxSuggestions)` record bound at `mezo.companion.habit-suggest.max-suggestions: 5` (the `Hypotheses` record precedent, `CompanionProperties.java:19-32`).
- Errors via SystemMessage; Hungarian user copy; English code. Commits `(mezo-n5e9.3)`, explicit `git add` + `--no-verify`. archunit_store check after backend runs.
- FE house conventions binding (frontend_conventions.md); FE gates both modes.

---

### Task 1: Contract + port + endpoint (503 path, no adapter yet)

**Files:**
- Modify: `api/feature/habit/habit.yml` (+ regenerate `api/openapi.yml`, `frontend/src/data/_client/api.gen.ts` — commit all three)
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/habit/service/HabitSuggestPort.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/habit/service/HabitAiService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/habit/controller/HabitController.java` (implement the new generated method)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/techcore/configuration/FeaturesConfiguration.java` (the switch constant)
- Modify: `backend/src/main/resources/application.yml` (`mezo.feature.habit-ai-suggest.enabled: true` next to the other feature switches; `mezo.companion.habit-suggest.max-suggestions: 5` in the companion block)
- Modify: `backend/src/main/resources/messages.properties` (`HABIT_AI_UNAVAILABLE=Az AI-javaslo most nem elérhető.` — with proper accents matching the file's encoding)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/habit/HabitAiSuggestApiIT.java` (the 503 branch only in this task)

**Contract addition** (paths + schemas, tag `Habit`):

```yaml
  /api/habit/ai/suggest:
    post:
      tags: [Habit]
      operationId: suggestHabits
      summary: Propose-only AI habit suggestions (smart model; the model never writes)
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: "#/components/schemas/HabitSuggestRequest" }
      responses:
        "200":
          description: Suggestions (possibly empty when the model output was unusable)
          content:
            application/json:
              schema: { $ref: "#/components/schemas/HabitSuggestResponse" }
        "503": { description: Suggester unavailable (switch off / companion off) }
```

```yaml
    HabitSuggestRequest:
      type: object
      properties:
        chainKey: { type: string, nullable: true, description: "Preselected chain to suggest for" }
        hint: { type: string, nullable: true, maxLength: 200, description: "Optional user intent (szándék)" }
    HabitSuggestion:
      type: object
      required: [title, why, anchorCopy, skillKey, xp, chainKey]
      properties:
        title: { type: string }
        why: { type: string }
        anchorCopy: { type: string }
        skillKey: { type: string }
        xp: { type: integer, minimum: 5, maximum: 15 }
        chainKey: { type: string }
    HabitSuggestResponse:
      type: object
      required: [suggestions]
      properties:
        suggestions:
          type: array
          items: { $ref: "#/components/schemas/HabitSuggestion" }
```

**Port** (in habit — the suggestion record lives here; companion will import it):

```java
package io.mrkuhne.mezo.feature.habit.service;

import java.util.List;
import java.util.UUID;

/**
 * Propose-only habit suggestions (mezo-n5e9.3, ADR 0019): implemented by the companion's
 * smart-model adapter; absent bean (any gating switch off) means the endpoint 503s cleanly.
 * The model never writes — accepting a suggestion goes through the normal createDef path.
 */
public interface HabitSuggestPort {

    record Suggestion(String title, String why, String anchorCopy, String skillKey, int xp,
        String chainKey) {}

    List<Suggestion> suggest(UUID userId, String chainKey, String hint);
}
```

**`HabitAiService`**: `@Service @RequiredArgsConstructor @ConditionalOnProperty(HABIT_SWITCH)`; injects `ObjectProvider<HabitSuggestPort>`; method `suggest(UUID userId, HabitSuggestRequest request)`:
- port absent → `throw new SystemRuntimeErrorException(SystemMessage.error("HABIT_AI_UNAVAILABLE").build(), HttpStatus.SERVICE_UNAVAILABLE)`;
- else map `port.suggest(userId, request.getChainKey(), request.getHint())` → `HabitSuggestResponse` (sanitize: drop suggestions whose `xp` is out of 5–15 or whose `chainKey`/`skillKey` is blank — defensive; the adapter also filters, but the service is the API's last line).
Controller: one-liner `@Override` delegate (the house pattern).

**Steps:**
- [ ] **Step 1**: contract edit + both regens; verify `./mvnw clean compile -q` shows `HabitController` missing the new method (RED form).
- [ ] **Step 2**: write `HabitAiSuggestApiIT` 503 test FIRST — the adapter doesn't exist yet, so with all switches at their defaults the port is absent in THIS task:

```java
@Test
void testSuggest_should503_whenAdapterAbsent() {
    String err = postForBody("/api/habit/ai/suggest",
        HabitSuggestRequest.builder().build(),
        ownerAuthHeaders(), HttpStatus.SERVICE_UNAVAILABLE, String.class);
    assertHasRequestError(err, "HABIT_AI_UNAVAILABLE");
}
```

(Adjust helper names to `ApiIntegrationTest`'s actual signatures, as always.)
- [ ] **Step 3**: implement port + service + controller + switch constant + yml + message key; run `-Dtest='HabitAiSuggestApiIT'` green.
- [ ] **Step 4**: FE regen sanity: `cd frontend && pnpm build` (types only, no FE source change yet).
- [ ] **Step 5**: Commit — `feat(habit): AI-suggest contract + port + 503-clean endpoint (mezo-n5e9.3)` (list every touched path explicitly).

---

### Task 2: The adapter — smart-model grounding + strict-JSON propose + fake sentinel

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/HabitSuggestLlmAdapter.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/config/CompanionProperties.java` (+ yml already carries the key from Task 1)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/FakeCompanionLlm.java` (sentinel branch)
- Test: extend `backend/src/test/java/io/mrkuhne/mezo/feature/habit/HabitAiSuggestApiIT.java` (happy path etc. under `@ActiveProfiles` merge — see below; if the class-level profile conflicts with Task 1's 503 test, split the 503 test into its own IT class `HabitAiSuggestSwitchOffIT` using `@TestPropertySource(properties = "mezo.feature.habit-ai-suggest.enabled=false")` — NOTE the known trap: `@TestPropertySource` forks its own Testcontainers context; keep that class tiny)

**Adapter shape** (the `SlotPlanLlmAdapter` + `HypothesisPipelineService.propose` fusion):

```java
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
    name = {FeaturesConfiguration.HABIT_AI_SUGGEST_SWITCH, FeaturesConfiguration.COMPANION_SWITCH,
        FeaturesConfiguration.HABIT_SWITCH},
    havingValue = "true")
public class HabitSuggestLlmAdapter implements HabitSuggestPort {

    public static final String SUGGEST_MARKER = "[habit-suggest]";
    // SYSTEM_PROMPT: Hungarian, starts with SUGGEST_MARKER, identity-vote tone; instructs:
    // suggest at most %d NEW habits complementing the existing chains (never duplicates),
    // each anchored to an existing routine (anchorCopy cue), skillKey STRICTLY from the
    // provided list, xp 5..15, chainKey STRICTLY from the provided chain keys;
    // "Válaszolj KIZÁRÓLAG JSON tömbbel, pontosan ebben a formában:
    //  [{"title":"...","why":"...","anchorCopy":"...","skillKey":"...","xp":10,"chainKey":"..."}]"
    ...
}
```

- `suggest(...)`: build the grounding context (Hungarian, deterministic — the `ContextSnapshotAssembler` block style):
  - `[Skillek]` from `progressionService.getProfile(userId)` LIFE skills (key + name + level; skip 0-XP ghosts — the `topSkills` filter precedent at `ContextSnapshotAssembler.java:350-361`),
  - `[Cél]` from `goalRepository.findByCreatedByAndStatusAndDeletedFalse(userId, "active")` (title/trajectory or `nincs adat`),
  - `[Rutinok]` from `habitCatalogService.chains(userId)` + `activeOrderedWithoutBootstrap(userId)` (per chain: key, title, daypart, def titles — the model must NOT re-suggest existing titles),
  - the optional `hint` appended as `[Szándék] …`.
  Inject habit beans via `ObjectProvider<HabitCatalogService>` (the companion↔habit switch-independence idiom; the three-way gate makes them present in practice — `getObject()` is fine after a null-check-throw).
- LLM call: `llmCallContextHolder.runWith(new LlmCallContext("habit_ai_suggest", "propose", null, null), () -> companionLlm.completeSmart(prompt, context))` — llm_log auditing is automatic.
- Parse: bracket-substring → `List<Suggestion>` via ObjectMapper `TypeReference` (the `HypothesisPipelineService.propose` lines 176-199 pattern VERBATIM including the degrade-to-empty catches); then filter: blank title/skillKey → drop; `skillKey` not in the grounded LIFE set → drop; `chainKey` not in the user's chain keys → drop; xp clamp-reject outside 5..15 → drop; cap at `properties.habitSuggest().maxSuggestions()`.
- `FakeCompanionLlm`: add `SUGGEST_SENTINEL = Pattern.compile("\\[fake-habit-suggest:(\\[.*?\\])]")` + an `if (systemPrompt.startsWith(HabitSuggestLlmAdapter.SUGGEST_MARKER))` branch returning the sentinel-supplied array (or a default valid one-item array when no sentinel present) — the existing sentinel idiom at `FakeCompanionLlm.java:93-94/277-280`.

**IT cases (fake profile, the `CompanionApiIT` `@ActiveProfiles("companion-fake")` pattern):**
- happy path: sentinel supplies 2 valid suggestions grounded on seeded skills/chains → 200, both returned, order kept;
- over-cap: sentinel supplies 7 → capped at 5;
- dirty rows: unknown skillKey / unknown chainKey / xp 20 → dropped, valid remainder returned;
- unparseable sentinel (`[fake-habit-suggest:not-json]`) → 200 with empty suggestions (degrade-to-empty, never 5xx);
- llm_log row exists with feature `habit_ai_suggest` (query the llm_log repository — see how `LlmLogApiIT`/`llmlog` tests assert rows).

**Steps:** write the ITs first (RED: adapter bean missing → 503 in the fake-profile class), implement, run `-Dtest='HabitAiSuggest*IT'` green, then the focused gate `-Dtest='Habit*IT,ProgressionHabitIT,QuestApiIT,CompanionApiIT'`. Commit — `feat(companion): habit-suggest smart-model adapter — grounded, strict-JSON, propose-only (mezo-n5e9.3)`.

---

### Task 3: FE — hook + AiSuggestSheet + editor CTA

**Files:**
- Modify: `frontend/src/data/habit/habitAdminApi.ts` (suggest call) + `habitAdminHooks.ts` (`useHabitAiSuggest`)
- Modify: `frontend/src/data/hooks.ts` (barrel line)
- Create: `frontend/src/features/me/sheets/AiSuggestSheet.tsx` (+ test)
- Modify: `frontend/src/features/me/pages/RoutineEditorPage.tsx` (CTA + sheet mount)
- Modify: `frontend/src/test/msw/handlers.ts` (default suggest handler)
- Test: hook cases in `frontend/src/data/habit/habitAdminHooks.test.tsx`

**`useHabitAiSuggest`** — mutation-shaped (suggestions are fetched on demand, not cached): `{ suggest(input: {chainKey?, hint?}): Promise<HabitSuggestion[]>, pending, unavailable }`. Real mode: POST via apiFetch; an `ApiError` with status 503 (or 404 when the whole habit surface is off) sets a local `unavailable` state instead of throwing to the global toast (the ChatPage degraded-mapping precedent at `data/insights/chatHooks.ts:44-46` — catch, don't toast). Mock mode: return 2 canned suggestions after `Promise.resolve` (stable fixture in `habitMock.ts` — palette-consistent, seed chainKeys, LIFE skillKeys).

**`AiSuggestSheet({ chainKey?, onClose })`** — the editor's existing sheet idiom (`RoutineEditorPage` state shape `const [suggestSheet, setSuggestSheet] = useState<{ chainKey?: string } | null>(null)`):
- top: optional „Szándék" text input (maxLength 200) + „Javasolj" CTA (disabled while pending);
- results: suggestion cards — title, why, anchor cue, skill chip, XP chip, target chain title; per-card „Elfogadom" (calls the existing `createDef({chainKey, title, why, anchorCopy, mode: 'MANUAL', skillKey, xp})` then removes the card; the server forces `metric: manual`) and „Elvetem" (removes the card);
- `unavailable` → the honest inline card („Az AI-javasló most nem elérhető…" — the ChatPage degraded-card style), CTA disabled;
- empty result after a run → quiet ghost („Nincs javaslat — próbáld pontosabb szándékkal").
- Editor CTA: „✨ AI javaslat" button next to „+ Új rutin" at page level (opens with no chainKey) — per-chain preselect can ride the same sheet later; keep v1 to the one entry.

**Tests:** hook (real: POST body + 503→unavailable, mock: canned list); sheet (suggest→cards render; accept calls createDef with MANUAL + the card's fields; unavailable card on 503). Gates: `pnpm test src/features/me src/data/habit` both modes → FULL `pnpm test && VITE_USE_MOCK=true pnpm test && pnpm build`. today-* goldens untouched (no Today change). Commit — `feat(me): AI suggestion sheet in the routine editor (mezo-n5e9.3)`.

---

### Task 4: Living docs

- [ ] `docs/features/habit.md`: §2 (editor gains the AI sheet), §4 (the suggest endpoint row), §5 (→ Companion: the port/adapter seam, propose-only, llm_log tag `habit_ai_suggest`), §10 (new files). `docs/features/companion.md`: one pointer sentence (the suggester lives in the habit domain; adapter in companion.llm — the SlotPlanLlmAdapter family). ADR 0019 already records the propose-only decision — reference it, don't rewrite.
- [ ] `node scripts/lint-docs.mjs` — touched docs clean. Commit — `docs(habit): AI suggester in living docs (mezo-n5e9.3)`.

---

### Task 5: Ship (maintainer/main-loop — NOT for a subagent)

- [ ] Final gates on the final tree (backend focused incl. CompanionApiIT; FE full both modes + build)
- [ ] fetch/back-merge if main moved (bd union: import theirs → re-apply own closes → export → verify both sides + 53 memories); push; PR; MERGEABLE; CI table; worktree-safe `--no-ff` merge; verify main; `bd close mezo-n5e9.3` (+ epic `mezo-n5e9` if all children closed); delete branches; detach at origin/main

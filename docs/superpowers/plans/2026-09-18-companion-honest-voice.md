# Companion honest voice (S9.8) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The companion stops hedging by instruction and stops claiming actions it cannot perform — and the 0.60-precision LLM judge that punished commitment leaves the live path for good.

**Architecture:** Two decisions from the spec (§7 D1, D2), re-scoped against what actually shipped since the spec was written. `TurnVerdictCheck` comes out of `CompanionAdvisorChain`'s checks (the class survives as an offline instrument), which collapses `review` and `reviewChat` into one clinical-only path and deletes the commitment-punishing retry class. On the prompt side the live voice gains the one rule it is missing — never claim an action — backed by a deterministic check rather than prose alone, because prose alone already failed once in production. The rollback prompt sheds its hedge vocabulary and its hedging few-shot so the two paths teach the same thing.

**Tech Stack:** Spring Boot, `@ConditionalOnProperty`-gated advisor beans, accent-folded regex checks, Hungarian prompt text as Java text blocks, JUnit + Testcontainers ITs, opt-in `@Tag("eval")` harnesses.

**Driving issues:** `mezo-rj214.7` (this epic's S9.8), closing `mezo-rj214.5` (advisor) and `mezo-q0p5a` (the fabricated "Felírtam" claim); coordinates with `mezo-rj214.3` (prompt rewrite).

---

## Global Constraints

- **Branch:** `feat/companion-honest-voice` (already cut from main). Conventional commits carrying `(mezo-rj214.7)`.
- **THE ARCHITECTURE MOVED UNDER THE SPEC — read this before touching any prompt.** There are now TWO system prompts:
  - `ConversationTurnService.VOICE` — **what production uses** (`mezo.companion.conversation.enabled: true` is the shipped default, `application.yml:793-795`). It already has no hedge vocabulary, no few-shot, no `[Két mód]`/`[Eszközhasználat]` blocks, and its uncertainty sentence already says what D2 wants. It is missing exactly one thing: the never-claim-an-action rule.
  - `ChatService.SYSTEM_PROMPT` — **rollback only** now, but it is what nearly every IT exercises, because the test default is `conversation.enabled=false` (`backend/src/test/resources/application.properties:28`). It still carries the hedge vocabulary (`~:92-93`) and the hedging few-shot (`~:105-111`).
  The spec's D2 text and bd `mezo-rj214.3`/`mezo-q0p5a` describe only the second one; they predate the first. Both paths are in scope here — production correctness lives in VOICE, and the rollback prompt must not teach the opposite.
- **The caching seam is a hard constraint.** `stableSystemPrompt(userId)` (persona only) is the provider-cached prefix; per-turn state belongs in the volatile half. `stableSystemPrompt(..) + turnContext(..)` must stay character-identical to the single string they used to be — pinned by `CompanionLlmJoinInstructionsTest`, and depended on by `llm_log_history.system_prompt` and `FakeCompanionLlm`'s `startsWith` marker dispatch. Adding prose to a persona text block is fine; that IS the cached prefix.
- **`FakeCompanionLlm` dispatches on prompt PREFIX** through a long `startsWith(...)` chain shared with memory rewrite, reranker, extraction and character subsystems. Never change the leading text of a prompt without checking it cannot start matching another subsystem's marker.
- **Every new advisor bean carries the same gate the existing ones do** — `@ConditionalOnProperty({COMPANION_SWITCH, COMPANION_ADVISORS_SWITCH})` — or the `*SwitchOffIT` contexts break (standing rule since S9.1).
- **`degraded` is NOT being removed.** It stays, driven by the checks that remain. The FE renders a `nem ellenőrzött` badge off the boolean alone and needs no change.
- **Backend gate:** `./mvnw test -Dtest='io.mrkuhne.mezo.feature.companion.**' -Dmezo.test.use-testcontainers=true` (Testcontainers flag MANDATORY — the fixed-DB mode races and fakes failures) plus `-Dtest=ArchitectureTest`. Wrapper is `backend/mvnw`, run from the worktree's backend dir.
- **Frontend is untouched by this slice.** If a change forces an FE edit, stop and report — that is a sign the scope drifted.
- **Docs mandate:** `docs/features/companion.md` in the same change; `node scripts/lint-docs.mjs` clean; `node scripts/gen-codemap.mjs` + `--check`. ADR 0028 (marked speculation in chat) IS the policy being rewritten and needs an amendment or superseding note.
- **Never bare `git stash`.**

---

## File structure

**Backend — new**
- `advisor/ActionClaimCheck.java` — the deterministic backstop for "never claim an action", mirroring `ClinicalOutputCheck` exactly (accent-folded matching, same gate, same `AdvisorViolation` shape).

**Backend — modified**
- `service/ConversationTurnService.java` — `VOICE` gains the action rule.
- `service/ChatService.java` — `SYSTEM_PROMPT`: hedge vocabulary out, few-shot replaced, `[Két mód]`/`[Eszközhasználat]` contradiction resolved, action rule added.
- `advisor/CompanionAdvisorChain.java` — `runChecks` loses `turnVerdictCheck` and gains `actionClaimCheck`; `review`/`reviewChat` collapse.
- `advisor/AdvisorRetry.java` — the corrective block stops re-teaching hedge permission.
- `advisor/TurnVerdictCheck.java` — kept as a bean, javadoc rewritten to say it is an offline instrument, no longer on the live path.
- `config/CompanionProperties.java` + `application.yml` — the judge-only config keys and the `reasoning-effort.chat: high` justification comment.

**Tests — adapted, not deleted**
- `CompanionAdvisorChainIT`, `ChatStreamAdvisorIT`, `advisor/TurnVerdictCheckIT`, `CompanionAdvisorsSwitchOffIT`, the prompt-order ITs (`ChatServiceIT` and friends), `llm/FakeCompanionLlm`.

---

### Task 1: The live voice stops claiming actions

The bug that started this epic: the companion answered "Felírtam: taco…" though it has no write tool at all, so the user believed the food was logged (`mezo-q0p5a`). The live voice has no rule against it.

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ConversationTurnService.java` (`VOICE`, ~:32-51)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/service/ConversationFirstIT.java` (extend — it is the conversation-first IT and already runs with `conversation.enabled=true`)

**Interfaces:**
- Produces: `ConversationTurnService.VOICE` carrying an action-honesty sentence.

- [ ] **Step 1: Write the failing assertion.** In `ConversationFirstIT`, assert the rendered system prompt (via the `FakeCompanionLlm` echo this IT already reads) contains the action rule. Check how that IT reads the prompt before writing the assertion — if it cannot see the system prompt, pin the constant directly in a small unit test instead and say so in the report.

- [ ] **Step 2: Run it, watch it fail.**

- [ ] **Step 3: Add the rule.** Append to `VOICE`, in its voice (short declarative sentences, tegeződő, no bullet list — match the block's existing rhythm):

```
Nem tudsz naplózni, menteni, módosítani vagy bármit elvégezni a felhasználó helyett;
csak beszélgetni és lekérdezni tudsz. Ha ilyet kérnek, mondd meg őszintén, és mondd el,
hol tudja ő maga megtenni. Soha ne állítsd, hogy elvégeztél valamit.
```

Place it next to the existing grounding rules (the "ne találd ki" sentence), not at the very start — the leading text feeds `FakeCompanionLlm`'s prefix dispatch.

- [ ] **Step 4: Green.** Then `-Dtest=ConversationFirstIT,ConversationQualityEvalIT` — the latter is `@Tag("eval")` and will be skipped by default; that is expected, do not force it.

- [ ] **Step 5: Commit** — `feat(companion): the live voice never claims an action it cannot perform (mezo-rj214.7, mezo-q0p5a)`

---

### Task 2: The deterministic backstop

Prose alone already failed for this exact bug once. `ClinicalOutputCheck` is the precedent: a deterministic, accent-folded check that costs no LLM call and cannot be talked out of.

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/advisor/ActionClaimCheck.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/advisor/CompanionAdvisorChain.java` (`runChecks`)
- Modify: `config/CompanionProperties.java` + `application.yml` (the term list, beside `rx-terms`)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/advisor/ActionClaimCheckTest.java` (new)

**Interfaces:**
- Produces: `ActionClaimCheck.check(String answer) -> Optional<AdvisorViolation>` — same signature and violation shape as `ClinicalOutputCheck.check`.

- [ ] **Step 1: Write `ActionClaimCheckTest` first.** Read `ClinicalOutputCheck` and its test for the accent-folding idiom and copy it. Cases:
  1. `"Felírtam: taco, fehérjeszelet, banán."` → violation (the production bug, verbatim).
  2. `"Elmentettem a súlyodat."`, `"Naplóztam a reggelit."`, `"Rögzítettem."` → violation.
  3. **Must NOT fire** on an offer or an instruction: `"Ezt te tudod felírni a Napló fülön."`, `"Ha szeretnéd, felírhatod."`, `"Nem tudom naplózni helyetted."` — a first-person PAST-tense claim is the target, not the verb itself. This is the whole difficulty; if a bounded term list cannot separate these, say so in the report rather than shipping a check that cries wolf.
  4. Accent-stripped and mixed-case input behaves identically (`"felirtam"`).
  5. An empty/blank answer → no violation.

- [ ] **Step 2: Run, watch fail.**

- [ ] **Step 3: Implement**, mirroring `ClinicalOutputCheck`: same `@ConditionalOnProperty({COMPANION_SWITCH, COMPANION_ADVISORS_SWITCH})`, same accent folding, a configured term list (`mezo.companion.advisors.action-claim-terms`) rather than hardcoded strings, and a Hungarian `reason` that tells the retry what to fix. Default terms should cover the first-person past-tense forms of: felír, elment, naplóz, rögzít, hozzáad, beír, módosít, töröl, beállít — with the negative-form and second-person exclusions the tests demand.

- [ ] **Step 4: Wire into `runChecks`** alongside the clinical check. Order: clinical first (it is the safety-critical one), then action-claim. Keep the existing short-circuit semantics and comment them.

- [ ] **Step 5: Green** — `-Dtest=ActionClaimCheckTest,CompanionAdvisorChainIT,CompanionAdvisorsSwitchOffIT -Dmezo.test.use-testcontainers=true`.

- [ ] **Step 6: Commit** — `feat(companion): a fabricated action claim is caught, not just discouraged (mezo-rj214.7, mezo-q0p5a)`

---

### Task 3: The judge leaves the live path

Its own config comment documents `unmarkedClaim` precision at **0.60 at best** — roughly four false positives in ten, each costing a full extra turn and each rewriting a committed answer into a hedged one. In the current architecture the answering model already has the raw tool data in front of it.

**Files:**
- Modify: `advisor/CompanionAdvisorChain.java` — `runChecks` drops `turnVerdictCheck`; `review`/`reviewChat` become identical and collapse into one method (keep whichever name the call sites make cleaner; update both call sites in `ChatService` and `ChatStreamService`)
- Modify: `advisor/TurnVerdictCheck.java` — javadoc says what it now is
- Modify: `config/CompanionProperties.java`, `application.yml` — see Step 4
- Test: adapt `CompanionAdvisorChainIT`, `ChatStreamAdvisorIT`, `advisor/TurnVerdictCheckIT`

**Interfaces:**
- Produces: one clinical+action review method on the chain; `TurnVerdictCheck` remains an injectable `@Component` with no production caller.

- [ ] **Step 1: Inventory what the ITs pin, THEN change code.** `CompanionAdvisorChainIT` and `ChatStreamAdvisorIT` pin verdict-driven retry, `degraded`-on-repeat-violation and (in the streamed one) `lastVerdictCheckActor`. Decide per test: a case that pins *the retry machinery* keeps its value if re-pointed at a clinical or action violation; a case that pins *the judge's own behaviour* belongs in `TurnVerdictCheckIT`. **Adapt, never delete** — and if a test's premise genuinely no longer exists, say so in the report rather than quietly removing it. The actor-rebinding assertion (`lastVerdictCheckActor`) protects a real S9.6 invariant: keep it by re-pointing it at whichever LLM call the chain still makes, or explicitly state why it cannot be kept.

- [ ] **Step 2: Remove the judge from `runChecks`** and collapse the two review methods. `reviewChat`'s javadoc explains it exists precisely because it skips the judge — once the judge is gone from both, that distinction is dead and the duplication should go with it.

- [ ] **Step 3: Rewrite `TurnVerdictCheck`'s class javadoc** to state plainly: no longer on the live path (S9.8), kept as an offline regression instrument, precision 0.60 at best, and where the eval harness lives.

- [ ] **Step 4: Config.** `mezo.companion.advisors.tool-result-max-chars` / `tool-results-total-max-chars` are consumed only by the judge — keep them (the class still reads them) but note in the yaml comment that they now only bind the offline instrument. Separately, the `reasoning-effort.chat: high` justification comment (`application.yml` ~:754-761) argues for `high` **on the judge's behalf**. Do NOT change the effort value in this task — that knob is scoped to the whole cheap chat tier and other callers may depend on it. Instead correct the comment so it no longer justifies a live-path behaviour that no longer exists, and file a follow-up to re-measure the tier.

- [ ] **Step 5: Green** — `-Dtest=CompanionAdvisorChainIT,ChatStreamAdvisorIT,TurnVerdictCheckIT,CompanionAdvisorsSwitchOffIT,ChatServiceIT -Dmezo.test.use-testcontainers=true`.

- [ ] **Step 6: Commit** — `feat(companion): the 0.60-precision judge leaves the live answer path (mezo-rj214.7, mezo-rj214.5)`

---

### Task 4: The retry stops re-teaching hedging

`AdvisorRetry.block` appends *"jelöletlen, magabiztos állítás kitalált adatról nem megy (jelölt sejtés viszont igen)"* — it re-teaches, at the exact moment the model is being corrected, that a hedge is the safe move. After Task 3 this block is only ever appended after a clinical or action-claim hit, so its text should say what those actually are.

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/advisor/AdvisorRetry.java` (~:13-26)
- Test: whichever IT asserts the retry text (find it; `CompanionAdvisorChainIT` is the likely home)

- [ ] **Step 1: Failing assertion** on the new rule text (and on the ABSENCE of the hedge-permission clause).

- [ ] **Step 2: Rewrite the rules sentence.** Keep: the Rx dose-change prohibition, and the tone-preservation closer (`A hangnem NE változzon…`) — that closer is load-bearing and stays verbatim. Replace the rest with the two rules that can now actually fire: never claim an action you cannot perform, and never state a personal number that did not come from the context, a tool or the user's own message. Drop the redundant-question rule (it was the judge's) and drop the parenthetical that licenses marked guessing.

- [ ] **Step 3: Green**, then **Commit** — `fix(companion): the corrective retry no longer re-teaches hedging (mezo-rj214.7)`

---

### Task 5: The rollback prompt teaches the same thing

`SYSTEM_PROMPT` is no longer what production sends, but it is the fallback and it is what the whole IT suite exercises. Leaving the hedge vocabulary in it means the two paths teach opposite lessons.

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ChatService.java` — `SYSTEM_PROMPT` (~:75-154)
- Test: adapt the prompt-order ITs (`ChatServiceIT`, `ChatServiceAmbientRecallIT`, `ChatStreamServiceIT`, `graph/ChatServiceGraphBlock*IT`, `ContextSnapshotAssembler*IT`, `CompanionLlmFakeIT`)

- [ ] **Step 1: Inventory the pins first.** These ITs assert ordered substrings of the joined prompt. Establish exactly which block NAMES and which ordinal positions are pinned before editing a single line — then keep the block skeleton and change only what D2 requires. A rewrite that renames or reorders blocks turns a focused change into a suite-wide rewrite; do not do that.

- [ ] **Step 2: Remove the hedge vocabulary** (`Sejtésed, hipotézised lehet … „tippelek", „erős a gyanúm", „lehet, hogy", „ezt csak sejtem"`). Replace with a sentence that permits a hypothesis without prescribing the words for it and without making the hedge the safe default — mark uncertainty where it is real, do not weaken a supported answer. **Keep verbatim** the next sentence — the one forbidding invented numbers, dates and past data — it is explicitly what D2 preserves.

- [ ] **Step 3: Replace the few-shot** (`[Példa a hangnemre]`). Today's "JÓ" example ends in a double hedge-and-retract (`Tippelem, hogy az alvás a különbség, de ezt tényleg csak sejtem.`) — the single strongest behavioural signal in the whole prompt, teaching exactly the shape the owner complained about. Write a COMMITTED replacement: the same warm, specific voice, the same number-first shape, but the closing observation stated plainly. Keep the ROSSZ/JÓ pair structure.

- [ ] **Step 4: Resolve the `[Két mód]` / `[Eszközhasználat]` contradiction.** `[Két mód]`'s free-conversation branch says a chat turn needs no tool; `[Eszközhasználat]` says never guess without one. The turn gear decides this in code now, so the prompt should not adjudicate it: cut the contradicting instruction rather than trying to word it more carefully. Keep `[Eszköz-útmutató]` (it is cross-checked against `docs/references/companion_tool_conventions.md`) and keep `[Tiltás]` untouched.

- [ ] **Step 5: Add the action rule** here too, so a rollback turn behaves like a live one.

- [ ] **Step 6: Green** — the full companion package, because these ITs are spread across it.

- [ ] **Step 7: Commit** — `feat(companion): the rollback prompt stops teaching hedging (mezo-rj214.7, mezo-rj214.3)`

---

### Task 6: Docs, ADRs, gates

**Files:**
- Modify: `docs/features/companion.md` — the advisor-chain section, the "V1.3 decisions locked" list items describing the judge as live, and the prompt sections
- Modify: `docs/decisions/0028-marked-speculation-in-chat.md` — this ADR *is* the hedge policy being rewritten
- Modify: `docs/CODEMAP.md` (regenerated)

- [ ] **Step 1: Backend full gate** — `./mvnw clean test -Dtest='io.mrkuhne.mezo.feature.companion.**' -Dmezo.test.use-testcontainers=true` plus `-Dtest=ArchitectureTest`. Run it in the background and WAIT for it.

- [ ] **Step 2: Docs.** companion.md must now say: the live chain is clinical + action-claim, both deterministic, no LLM judge; the judge survives as an offline instrument and where; the action rule and why it is enforced in code as well as prose (prose alone failed in production — cite `mezo-q0p5a`); and the honest limitation that after the judge's removal nothing mechanically audits an invented number on the live path — that rule now rests on the voice plus the answering model having the raw data. Do not oversell.

- [ ] **Step 3: ADR 0028.** It currently documents "marked speculation is acceptable, here is the vocabulary". Amend it (or supersede it with a new ADR) to record what changed and why: the vocabulary prescription taught hedging as the safe default, and the judge enforcing it had 0.60 precision. Follow the repo's ADR conventions — check how a superseded ADR is marked here before choosing amend vs supersede.

- [ ] **Step 4: Gates** — `node scripts/lint-docs.mjs` (companion.md clean), `node scripts/gen-codemap.mjs` then `--check` (the new `ActionClaimCheck` must appear).

- [ ] **Step 5: Commit** — `docs(companion): the honest voice — no judge, no prescribed hedging, no fabricated actions (mezo-rj214.7)`

*(Controller close-out, NOT the implementer's: bd notes on mezo-rj214.7, close mezo-rj214.5 and mezo-q0p5a, tracker backup, PR → CI → premerge → `--no-ff` merge.)*

---

## Done criteria

1. A production (conversation-first) turn asked to log something says it cannot and points at the right surface — and if the model claims it anyway, a deterministic check catches it rather than the claim reaching the user.
2. No LLM judge runs on any live answer path; the chain is clinical + action-claim, both deterministic. `TurnVerdictCheck` still exists, documented as an offline instrument.
3. The corrective retry no longer licenses marked guessing.
4. Neither prompt prescribes hedge vocabulary; neither few-shot ends in a retract; the `[Két mód]`/`[Eszközhasználat]` contradiction is gone rather than reworded.
5. `degraded`, the clinical Rx guard, the prompt cache seam and the stable/volatile join identity are all untouched.
6. Companion package + ArchUnit green; docs and ADR 0028 tell the truth; CODEMAP regenerated.

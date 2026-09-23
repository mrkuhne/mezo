# Contextual Mezo feed implementation plan

**Goal:** Immediate, grounded, personal messages that follow the user's history across chat
and every active daily feed kind.

**Architecture:** A proactive feed orchestrator composes existing personal context, bounded
dated history and fresh event evidence. It uses the shared companion read-tool registry and
LLM port, then stores the existing message envelope with optional internal provenance.

**Spec:** [Approved direction](../specs/2026-09-23-contextual-mezo-feed-design.md)
· **Driver:** `mezo-7nron` · **Decision:** [ADR 0050](../../decisions/0050-contextual-mezo-feed.md)

## Global constraints

Beads is the sole task-status authority; the numbered recipes below are executable instructions,
not a second markdown task tracker. Claim the named issue before each slice. Each slice gets a
`feat/` branch and its own conventional commit; use the AGENTS.md local-gates/no-wait merge flow.
Read the mezo-backend, mezo-testing and tdd skills before implementation. Consult configuration,
Spring, security, testing and companion-tool references before touching the respective code.

No REST or frontend changes, no new tables, no global trend-math change, no live LLM judge,
no production transcript fixtures, no fake conversation IDs, no mutation tools. Existing event
freshness, one-row/day/kind, push timing, advice ranking/actions/cooldowns remain authoritative.
Config defaults: switch off; history 14 days/12 messages/6 same-kind reserved/8000 total chars/
800 chars per excerpt; weight 28 days; sleep 7 days; 6 tool calls and 12 references.

Paths below are repository-relative and exact. For compact file maps:
`P=backend/src/main/java/io/mrkuhne/mezo/feature/proactive`,
`C=backend/src/main/java/io/mrkuhne/mezo/feature/companion`,
`PT=backend/src/test/java/io/mrkuhne/mezo/feature/proactive`,
`CT=backend/src/test/java/io/mrkuhne/mezo/feature/companion`.
Expand these aliases literally; they are not Java package names.

Existing foundations are already in code: midday/evening tool calls (`mezo-106s`, despite its
stale tracker status), `PersonalContextAssembler.render(UUID, LocalDate)`, source readers for
`companion_message`/`ai_message`, and `MemoryContextBlock.render(...)`. None is an unmerged
dependency. The Boop social-wall design is independent; do not wait for or implement its UI.

## Slice 1 — Bounded dated continuity (`mezo-7nron.2`)

**Files:** create `P/config/ContextualFeedProperties.java`,
`P/service/FeedContinuityService.java`, `P/service/FeedContextAssembler.java`,
`P/service/FeedContext.java`; modify `P/repository/CompanionMessageRepository.java`,
`backend/src/main/java/io/mrkuhne/mezo/techcore/configuration/FeaturesConfiguration.java`,
`backend/src/main/resources/application.yml`; create `PT/FeedContinuityIT.java`,
`PT/FeedContextAssemblerIT.java`, `PT/ContextualFeedPropertiesIT.java`.

**Interfaces:**

```java
public record FeedContext(String text, List<UUID> priorMessageIds,
                          List<UUID> retrievalRunIds, List<RefsEnvelope.Ref> refs) {}
// FeedContinuityService
public FeedContext render(UUID userId, LocalDate date, Instant asOf, String kind);
// FeedContextAssembler (eventEvidence is supplied by Slice 2)
public FeedContext assemble(UUID userId, LocalDate date, Instant asOf,
                            String kind, String eventEvidence);
```

1. Write failing ITs with existing companion-message/user populators: yesterday's same-kind
   message and today's other-kind message included; B-user/deleted/future messages absent;
   deterministic timestamp/ID tie ordering; six same-kind reservations; truncation labels and
   source IDs retained; shared user preferences included. Cold start returns empty history.
2. Run `cd backend && ./mvnw clean test -Dmezo.test.use-testcontainers=true -Dtest=FeedContinuityIT,FeedContextAssemblerIT,ContextualFeedPropertiesIT`;
   record the expected failure before adding classes.
3. Implement bounded pageable owned repository reads. Select same-kind and all-kind pages
   independently, deduplicate and render in chronological order, constrained by `asOf` and
   business-date window. Compose existing personal/snapshot/memory services. Remove no old
   generator paths yet. Render historical memory with dates rather than undated fact assertions.
4. Bind the validated properties and feature constant; test invalid reservation/limit values.
   Re-run the same test command and existing `CompanionMessagePersistenceIT`.
5. Update proactive §7/§10 with the disabled new seam; run doc lint and regenerate CODEMAP.
   Commit: `git commit -m 'feat(proactive): add dated feed continuity (mezo-7nron.2)'`.

## Slice 2 — Longitudinal event evidence (`mezo-7nron.3`)

**Files:** create `P/service/FeedEvidenceAssembler.java`,
`PT/FeedEvidenceAssemblerIT.java`; consume existing weight/sleep repositories and
`backend/src/main/java/io/mrkuhne/mezo/feature/biometrics/weight/service/WeightTrendService.java`
without modifying its calculation.

**Interface:** `public String render(UUID userId, LocalDate date, String kind);` returns the
mandatory weight/sleep evidence block; other kinds return an empty block.

1. Write failing real-DB cases for a synthetic rising 7-day raw sequence with a still-negative
   whole-history slope, a goal switch, duplicate same-day measurements, gaps and one observation.
   Assert dated raw values and actual rate window labels, not a hard-coded generated sentence.
   Sleep fixtures include missing nights and planned versus completed load. Add B-user exclusion.
2. Run `cd backend && ./mvnw clean test -Dmezo.test.use-testcontainers=true -Dtest=FeedEvidenceAssemblerIT` and capture RED.
3. Implement raw-series rendering with `ToolText` quantity-specific formatting. Compute previous
   distinct-day difference from dated observations; distinguish that from latest raw minus EWMA.
   Display existing whole-history and trailing-28-day rates with explicit dates. Never relabel
   either as a trailing-week slope. Include measurement counts and current goal dates.
4. Repeat the command for GREEN. Verify event evidence is placed before optional memory and is
   not clipped by history budgets in `FeedContextAssemblerIT`.
5. Update proactive §3/§10 and CODEMAP. Commit:
   `git commit -m 'feat(proactive): ground reactions in recent evidence (mezo-7nron.3)'`.

## Slice 3 — Shared tool generation, actor and provenance (`mezo-7nron.4`)

**Files:** create `C/service/PersonalMemorySearchService.java`,
`C/tools/FeedContextTools.java`, `P/service/FeedGenerationService.java`,
`P/service/GeneratedFeedMessage.java`, `P/entity/FeedGenerationTrace.java`;
modify `C/tools/ConversationContextTools.java`, `C/tools/CompanionToolRegistry.java`,
`P/entity/CompanionMessageEnvelope.java`, `P/service/CompanionMessageEventListener.java`,
`C/llm/FakeCompanionLlm.java`; tests `CT/FeedReadToolsIT.java`,
`PT/FeedGenerationServiceIT.java`, `PT/FeedGenerationTraceIT.java`,
`PT/CompanionMessageEventIT.java`.

**Interfaces:**

```java
// CompanionToolRegistry: reuse existing RecordingToolCallback and source tools
public List<ToolCallback> feedCallbacks(ToolCallAudit audit);
// Shared memory service: keep ChatMemoryContextAdapter payload type at the extraction seam
public ChatMemoryPayload search(UUID userId, UUID conversationId, String query,
    List<CompanionLlm.Turn> history, LocalDate asOf, String feature, String operation);
public record GeneratedFeedMessage(String eyebrow, List<String> body,
    List<CompanionMessageEnvelope.Ref> refs, FeedGenerationTrace trace) {}
// FeedGenerationService: taskFacts contains deterministic candidate/probe evidence if present
public GeneratedFeedMessage generate(UUID userId, LocalDate date, String kind, String taskFacts);
```

Trace fields are `int schemaVersion`, `Instant asOf`, `List<UUID> priorMessageIds`,
`List<UUID> retrievalRunIds`, `ToolCallsEnvelope toolCalls`, `RefsEnvelope sourceRefs`,
`String degradedReason`. Add nullable trace to the JSONB envelope and retain the old canonical
arity as a delegating constructor, plus every convenience factory. No REST mapping change.

1. Write failing tests that invoke callbacks, not just list their names: owned full-source
   feed/chat read, memory recall under feed operation, foreign/deleted source exclusion,
   six-call cap, reference deduplication, no current-conversation tool, and actor attribution
   inside the real async event path. Old JSON fixtures deserialize with null trace.
2. Run `cd backend && ./mvnw clean test -Dmezo.test.use-testcontainers=true -Dtest=FeedReadToolsIT,FeedGenerationServiceIT,FeedGenerationTraceIT,CompanionMessageEventIT` for RED.
3. Extract memory search from the conversation tool into the shared service; preserve chat's
   existing method and callback names. Feed tools receive server-owned date/user/audit context.
   Use the existing tool-capable `complete` overload and audit wrapper:

```java
var audit = new ToolCallAudit(properties.maxToolCalls(), properties.maxRefs());
var answer = companionLlm.complete(systemPrompt, context.text(),
    registry.feedCallbacks(audit), toolContext);
```

4. Resolve body citation indexes only against collected context/tool references. Build trace
   from actual execution; permit null label-only IDs. A failed source contributes no citation.
   Bind `LlmActorContext.runAs(event.userId(), ...)` around the listener's generation call.
   Preserve exception handling, thread-local restoration and all log freshness guards.
5. Extend the fake with explicit feed tool-call/failed-tool scenarios using existing marker
   conventions. Assert saved tool traces and degraded behavior. Re-run the focused command plus
   conversation-context tool and JSONB compatibility tests, update companion/proactive docs and
   CODEMAP. Commit: `git commit -m 'feat(companion): share feed tools and audit (mezo-7nron.4)'`.

## Slice 4 — Every active feed kind (`mezo-7nron.5`)

**Files:** modify `P/service/CompanionMessageGenerator.java`,
`P/service/AdviceProseGenerator.java`, `P/service/AdviceCardService.java`,
`P/service/AdviceApplyService.java`, `P/service/FeedGenerationService.java`,
`P/service/FeedContextAssembler.java`, `C/llm/FakeCompanionLlm.java`;
create `P/service/FeedMessagePrompts.java`, `PT/ContextualFeedKindsIT.java`,
`PT/ContextualFeedFallbackIT.java`; extend `PT/CompanionMessageGeneratorMemoryIT.java`,
`PT/AdviceApplyServiceIT.java`, `PT/CompanionMessageHydrationIT.java`.

**Interfaces:** preserve existing public generator signatures. Add
`AdviceProseGenerator.writeContextual(UUID userId, LocalDate date, AdviceCandidate candidate)`
returning `GeneratedFeedMessage`; retain `write(UUID, AdviceCandidate)` for disabled-path
compatibility. AdviceCardService chooses the new method when enabled and retains candidate
keys/facts/actions; AdviceApplyService copies provenance when recording an applied action.

1. Parameterize integration cases across all eight active kinds. Assert shared context, callable
   tools and persisted trace; assert disabled switch invokes old behavior. Seed prior messages
   and verify previous-day/same-day evidence reaches the model. Add a no-summary cold start
   with a genuine current event. Only the old summary-availability gate may be relaxed on the
   enabled path; deterministic eligibility and daily uniqueness remain.
2. Run `cd backend && ./mvnw clean test -Dmezo.test.use-testcontainers=true -Dtest=ContextualFeedKindsIT,ContextualFeedFallbackIT,AdviceApplyServiceIT,CompanionMessageHydrationIT` for RED.
3. Route all eligible generators through the service behind the single switch. Extract the
   persona-compatible common brief and per-kind tasks from spec §7. Return structured
   eyebrow/body/citation indexes for every enabled-path kind. Remove obligatory caution,
   irrelevant no-data medication and undated “confirmed” narratives from that path.
4. For advice pass the selected candidate's exact deterministic evidence and offered actions;
   generated prose cannot modify eligibility/rank/actions. For hydration pass the successful
   probe numbers; for people pass the eligible observation. Retain deterministic fallback copy
   for advice/hydration on generation failure. Other malformed responses keep existing absence
   handling. Verify no duplicate inserts/pushes and trace survives action application.
5. Re-run GREEN and relevant existing generator, advice, event and job ITs. Update proactive
   and companion living docs only for behavior now implemented (still switch-gated).
   Commit: `git commit -m 'feat(proactive): contextualize all daily messages (mezo-7nron.5)'`.

## Slice 5 — Evaluation and activation (`mezo-7nron.6`)

**Files:** create `backend/src/test/resources/eval/contextual-feed/cases.json`,
`PT/ContextualFeedEvaluationIT.java`, `PT/ContextualFeedProviderEvalIT.java`,
`docs/features/contextual-feed-evaluation.md`; modify `docs/features/proactive.md`,
`docs/features/companion.md`, `docs/milestones/roadmap.md`,
`backend/src/main/resources/application.yml`.

1. Implement the 12 synthetic cases from spec §8 with frozen input dates, prior generated
   messages and source evidence. Normal fake ITs test data/provenance/delivery behavior;
   explicit opt-in `-Dmezo.eval.contextual-feed=true` enables provider replay with ordinary
   audit/cost caps. Replay calls assembly/generation only, never repository message saves or
   push dispatch. A missing opt-in must skip provider calls.
2. Run the evaluation ITs RED then GREEN. Capture baseline and new outputs under the same
   provider/model settings. Manually score the five rubric dimensions and each case's explicit
   expectation. Use a synthetic-only evidence table in the evaluation doc (standard feature-doc
   frontmatter/sections). Keep the switch off if any case is below 8/10 or invents facts/causes.
3. Run the full backend gate: `cd backend && ./mvnw clean test -Dmezo.test.use-testcontainers=true`.
   Run `node scripts/lint-docs.mjs` and `node scripts/gen-codemap.mjs --check`. No frontend code
   or contract changed; existing API compatibility is covered by backend contract ITs.
4. Record output samples, scores, per-kind model/cost/latency and degraded counts. Commit evidence:
   `git commit -m 'test(proactive): verify contextual feed quality (mezo-7nron.6)'`.
5. Only after the quality gate, flip the declared feature-switch default true in a separate
   commit and verify switch-on/off ITs again. Follow normal local merge/push flow; the pipeline
   handles rollout. Document rollback as setting the same switch false. Read-only post-rollout
   checks compare new per-kind actor attribution, tool use, failures and repetition to baseline.
   No automatic monitor is scheduled. Close the epic only after all slices and activation pass.

## Completion protocol

For each slice update/close its Bead, refresh `node scripts/check-beads-backup.mjs --fix`, commit
the backup, fetch main and merge locally with `--no-ff` from a detached `origin/main` worktree
head, then `git push origin HEAD:main`. If origin advanced, rebuild the merge against the new
head; never rebase away a completed merge. Run `bd dolt push`; report failures honestly.
Do not wait for cloud CI before merging; if main is observed red, fix it first per AGENTS.md.

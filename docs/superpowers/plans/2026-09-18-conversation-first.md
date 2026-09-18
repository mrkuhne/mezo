# Conversation-first implementation

Goal: open-ended, continuous chat with optional owner-scoped data access.
Architecture: bounded smart retrieval decisions followed by native streamed prose; existing
gear pipeline retained as rollback. Driver: `mezo-rj214.9`.
Spec: [approved design](../specs/2026-09-18-conversation-first-design.md).
Task status lives exclusively in Beads (AGENTS.md), not markdown checkboxes.

## 1. Capture regressions

Add `ConversationFirstIT` under the companion service tests. Drive real `ChatService`,
`ChatStreamService`, repositories and audited tools through the deterministic fake. Assert
irrelevant context absent, follow-up tools available, no health-only prompt, and analytical
delta streaming. Run the new class and confirm the pre-change failures.

## 2. Implement the shared flow

Add `ConversationProperties`, `ConversationTurnService`, `ConversationContextTools` and
`ConversationHistory`. Extend `TurnPlanner.plan` and `PlanExecutor.execute` with explicit
context/callback overloads; preserve legacy entry points. Register conversation callbacks
centrally. Route sync and SSE through the same preparation while enabled. All LLM calls retain
actor/budget attribution. Add result persistence to `ToolCallsEnvelope` compatibly.

Limits: three retrieval batches, existing 15 total reads, 80 recent messages, 8,000 characters
per stored result, 40,000 total evidence characters, 20 messages per older-history page.
Configuration under `mezo.companion.conversation`; no new endpoint or schema migration.

## 3. Verify and document

Run focused `./mvnw clean test -Dtest=ConversationFirstIT,... -Dmezo.test.use-testcontainers=true`
with bounded heap. Include legacy pipeline/gear, audit/JSONB, ownership and switch-off tests.
Add a multi-turn evaluation corpus; distinguish scripted structural assertions from live model
quality evidence. Update docs/features/companion.md and tool conventions plus a decision record.
Run `node scripts/gen-codemap.mjs`, `node scripts/lint-docs.mjs`, and the tracker backup script.
Commit with `(mezo-rj214.9)`, push `feat/free-companion-conversation`, open a self-PR, inspect CI.

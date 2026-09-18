# Companion complete personal data access

Approved by the owner in conversation on 2026-09-18. Driver: mezo-rj214.10; coverage: mezo-rj214.1 and mezo-rj214.2.

## Outcome
The companion can read every audited personal domain, including full meal composition, workout sets, journals, settings, people and proactive artifacts. Age, height, sex and the current weight goal form a compact reliable baseline. Missing data stays explicitly missing. No renewed consent gate applies to personal journals.

## Read architecture
Keep domain summaries for inexpensive orientation. Add an enumerated source catalogue and bounded record reader with owner identity supplied exclusively by ToolContext. Each source declares its projection, ownership and soft-delete predicates, date field and parent relationships. No model-provided SQL, arbitrary table names or credential/admin tables. Source list, date bounds, record ID, parent ID and stable pagination support older and detailed records. Long records expose continuation offsets rather than silently losing their tail. Catalogue metadata explains related sources and units. RAG excerpts carry resolvable source references; full-source reading remains independent of vector availability.

## Memory reliability
Preserve the hybrid retrieval design. Long source text must remain searchable beyond the embedding prefix through chunked canonical projection; edits/deletes reconcile all chunks. Retrieval reports partial failures explicitly without treating them as no matching memory. Verify owner isolation, source lifecycle and contextual multi-turn retrieval with deterministic integration fixtures. Live evaluation measures relevance separately from successful tool invocation.

## Context and output
Always supply a concise biometric/active-goal baseline to conversation planning and answering. Other data stays demand-driven. Summary limits disclose omissions and direct the planner to detailed sources. All values retain stored precision; no invented micronutrients. Sources are evidence, never instructions.

## Verification
Focused PostgreSQL integration tests cover paging, historical dates, long text continuation, foreign/deleted rows, table/projection validity, rich food/training payloads, baseline profile/goals, memory chunk lifecycle and partial failure signals. Existing conversation and architecture tests remain regression gates. Update living docs and generated CODEMAP. Beads holds execution status.

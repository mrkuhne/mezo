# 0044 — Complete personal source access alongside bounded memory

- **Status:** Accepted
- **Date:** 2026-09-18
- **Driver:** mezo-rj214.10 (S4/S5: mezo-rj214.1, mezo-rj214.2)

## Context
The app stores detailed personal evidence that summary tools discard. Memory search is bounded and previously indexed only source prefixes. The owner explicitly approved access to all audited personal details, including journals, and reliable baseline biometric/weight-goal context.

## Decision
Keep efficient domain summaries and add reviewed, enumerated full-source projections with owner/soft-delete predicates, fixed SQL identifiers, parameterized filters and explicit record/text continuation. No arbitrary SQL or model-controlled identity. Always supply compact stored profile/current-goal context; fetch other evidence when relevant. Use native PostgreSQL JSON projections for heterogeneous typed records, with explicit column lists and schema/ownership tests, rather than exposing ORM graphs or credentials.

Canonical memory uses ordered source chunks with original source identity and individual vectors. Preserve legacy prefix behavior for OLD rollback. Reconcile missed and changed source projections in bounded nightly work, suppress obsolete/deleted chunks, and expose partial retrieval failure. Search results link back to full source reads.

## Consequences
Older and detailed personal data is reachable without inflating every prompt. Source catalogue maintenance is explicit, and newly introduced columns do not leak automatically. Very large evidence requires multiple reads; retrieval budgets remain finite and must be disclosed. Historical memory coverage converges after rollout. Retrieval relevance still requires quality evaluation beyond deterministic correctness tests.

## Alternatives considered
Injecting the entire database every turn would exceed context and crowd out conversation. Arbitrary SQL gives the model an unnecessarily broad security surface. Treating RAG excerpts as full source records silently loses exact details and older content.

## Validation
Focused PostgreSQL integration tests cover source projections, ownership and deleted parents, complete pagination under small budgets, Unicode text continuation, chunk repair, retrieval errors and source-wide forgetting. An opt-in synthetic live-provider test (`CompletePersonalContextEvalIT`) uses gpt-5.6-terra plus real Gemini embeddings: a 75-day-old journal contains the relevant sentence after character 4,200. Both standalone and contextual hybrid probes retrieved the tail; four chat turns correctly returned profile/goal facts, recalled the event, read the original in two pages and quoted its final sentence, then switched to a creative task without tools. The observed turn durations were 4.1 / 6.2 / 8.6 / 4.4 seconds. This is a targeted regression scenario, not a general quality or latency benchmark.

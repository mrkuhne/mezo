---
title: "Memory retrieval OLD vs NEW — real Gemini release evaluation (324 HU holdout queries)"
type: measurement
source_url: local measurement — ./mvnw test -Dtest=MemoryRetrievalGeminiEvalIT -Dgroups=eval -Dmezo.excludedTestGroups= -Dmezo.memory.eval.real=true -Dmezo.test.use-testcontainers=true
ingested: 2026-09-17
sha256: b6577d42c17daf46c47dfbcb77625e0e5988bb8c69ea42e9b065c4283ab52838  # body below this frontmatter
---

# Memory retrieval OLD vs NEW — real Gemini release evaluation

Run on 2026-09-17 against the human-approved Hungarian holdout corpus with the real
`gemini-embedding-001` embedder. Both engines saw identical data. Raw report:
[`2026-09-17-memory-retrieval-gemini-eval.json`](2026-09-17-memory-retrieval-gemini-eval.json).

**This run was only meaningful after `mezo-iddo`.** Before that fix the NEW path's dense retriever
timed out on 55 of 55 production runs, so any earlier measurement would have scored an engine whose
semantic half never executed.

## Overall

| Metric | OLD (baseline) | NEW (candidate) | Delta |
|---|---|---|---|
| recall@5 | 0.155 | **0.837** | +0.682 |
| nDCG@5 | 0.130 | **0.709** | +0.579 |
| MRR | 0.120 | **0.659** | +0.539 |
| context precision | 0.074 | 0.053 | **−0.021** |
| empty-query false-positive rate | 0.833 | **0.000** | −0.833 |
| ownership leaks | 0 | 0 | 0 |
| p95 latency (no rewrite, no rerank) | 367 ms | 375 ms | +8 ms |

The single most consequential row is the empty-query false-positive rate: the OLD engine produced
"memories" for 83% of the questions that should have returned none. The NEW engine never does.

## Hard gates

| Gate | Result | Reading |
|---|---|---|
| nDCG@5 > baseline | PASS | the head-to-head comparison |
| MRR > baseline | PASS | the head-to-head comparison |
| ownership leaks = 0 | PASS | |
| empty-query FP rate ≤ 0.05 | PASS | 0.000 |
| embedding / reranking budget | PASS | |
| all query executions completed | PASS | 0 failed query ids |
| recall@5 ≥ 0.85 | FAIL | 0.837 — short by 0.013 while being 5.4× the baseline |
| context precision ≥ baseline + 0.10 | FAIL | a real trade-off: NEW returns far more of the right memories and more chaff with them; the baseline it must beat is itself near-noise (recall 0.155) |
| p95 ≤ 250 ms | FAIL | **mis-specified.** The OLD engine cannot meet it either (367 ms). Both must make a ~300 ms network embedding call. Same error class as `mezo-iddo`'s 200 ms retriever deadline: a database-shaped budget placed around a network hop. |
| terminal usage and cost audit | FAIL | 655 embedding calls, **all unpriced**, `costUsd: null`, `billableCharacters: 0` — no pricing entry exists for this embedding model, so the run's cost was never booked. A bookkeeping gap, not a quality signal. |

## Decision

Product owner, 2026-09-17: **flip chat to `NEW`** (`mezo-i7x5v`), deliberately overriding the
aggregate FAIL. The gates that compare the two engines both pass decisively; of the four that fail,
two are demonstrably mis-specified, one is missed by 1.3 percentage points, and one is a cost-
accounting gap. Rollback is deleting one env entry, and `ChatMemoryContextAdapter` independently
falls back to the legacy path on any runtime failure.

## Caveat

Synthetic corpus, not the owner's own data. 324 reviewed queries across three personas — good
evidence about ranking behaviour, not a measurement of lived usage.

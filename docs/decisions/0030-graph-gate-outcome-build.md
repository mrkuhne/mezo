# 0030 — W2 graph gate: proceed with the knowledge graph (Outcome A)

- **Status:** Accepted
- **Date:** 2026-08-22
- **Driver:** mezo-b3pp.21 (W2 graph gate decision task)

## Context

Phase 5 §10 (`docs/superpowers/specs/2026-08-18-phase5-deep-memory-personalization-design.md`)
deliberately gated the knowledge-graph workstream (W2, slices `.6`–`.11`) behind a lived-experience
decision, taken only after W3.1 (always-on recall, `mezo-b3pp.12`) had shipped and been used for a
while. The graph is the heaviest and most speculative third of the phase; the spec's own framing
asks two questions before committing to it:

1. Does recall + journal already give the "ismer engem" (it knows me) feeling on its own?
2. Is the flatness of the current `knowledge_fact` list — independent sentences with no represented
   chains between them (e.g. "late eating hurts sleep" and "poor sleep hurts training" existing as
   two unrelated rows) — actually felt as a limitation in daily use?

Outcome A (build) unblocks `mezo-b3pp.6`–`.11` plus the W4.2 reinforcement layer; outcome B (defer)
would have left the W2 slices open in bd, with every graph hook elsewhere (prompt block,
reinforcement, RECOVERY profile input) staying switch-guarded off, and execution continuing straight
to W3.2.

## Decision

Outcome A — build. Daniel judged the flat fact list's lack of connective structure as a real,
felt gap worth the graph's implementation cost, having lived with W3.1's always-on recall.

## Consequences

- `mezo-b3pp.6` (W2.1 graph tables + skeleton + ADR) becomes the next slice in execution order,
  per §10's step 5: `W2.1 → W2.2 → {W2.3, W2.4, W2.5} → W2.6 + W4.2 reinforcement layer`.
- The W4.2 reinforcement layer (currently switch-guarded off per its own slice) gets activated once
  the graph traversal (W2.4) and maintenance job (W2.5) land.
- Every graph-dependent hook built during W3.1 (the `[Összefüggések]` prompt block wiring point,
  RECOVERY profile input) now has a real backing feature to switch on, rather than staying
  permanently off.

## Alternatives considered

- **Outcome B (defer):** keep W2 slices open, continue straight to W3.2 (consolidation ladder) and
  the rest of the roadmap without the graph. Rejected — the flatness of `knowledge_fact` was judged
  to already be a felt limit, not merely a theoretical one, so deferring would trade a known-valuable
  feature for schedule speed without a strong reason to wait longer.

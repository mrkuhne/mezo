# 0036 — Shared memory platform with gradual consumer adoption

- **Status:** Accepted
- **Date:** 2026-09-04
- **Driver:** mezo-6dii

## Context

Mezo already stores narrative embeddings, confirmed facts and a PostgreSQL-native knowledge graph,
while deterministic snapshots and SQL tools expose current health state. Retrieval quality is not
benchmarked, however, and the memory paths lack hybrid search, shared ranking, embedding versioning
and consumer-specific selection policies.

The immediate need is better chat recall, but morning briefing, memoir, prediction and later
summaries need the same long-term-memory capability. Building a chat-only path would create another
silo. Introducing LangGraph would add a second runtime and orchestration model before Mezo has a
stateful agent workflow that needs it.

## Decision

Build one Spring/Java memory platform inside `feature/companion` and adopt it gradually. A Mezo-owned
`MemoryContextService` accepts consumer policies and coordinates query preparation, parallel dense,
lexical, fact and graph retrieval, deterministic RRF fusion, optional reranking, diversity/token
selection and audit.

Chat is the first serving consumer and rolls through `OLD`, `SHADOW` and `NEW` modes. Briefing,
memoir and prediction may integrate only after the chat pilot passes the explicit synthetic
Hungarian holdout gate in the approved design spec. Deterministic snapshots and SQL tools remain
outside RAG, and source domain tables remain authoritative.

Spring AI components may be used behind Mezo ports. The platform does not require migration to a
generic `VectorStore`. LangGraph is deferred until a concrete requirement exists for resumable,
interruptible or human-approved multi-step agent workflows.

Full design: [`2026-09-04-shared-rag-memory-platform-design.md`](../superpowers/specs/2026-09-04-shared-rag-memory-platform-design.md).

## Consequences

- Chat, briefing, memoir and prediction can share retrieval behavior without sharing identical
  policy settings.
- Versioned projections and vectors permit safe backfill, shadow comparison and model migration.
- Hybrid retrieval and deterministic fusion remain available when an LLM reranker is slow or down.
- The first delivery is larger than a chat-local query tweak because it establishes shared data,
  audit and policy contracts.
- The platform must maintain projections in sync with authoritative sources and operate retrieval
  traces under explicit privacy and retention rules.
- LangGraph remains a future decision; adding it later requires evidence that workflow durability
  or control justifies the extra runtime and operational surface.

## Alternatives considered

- **Chat-specific hybrid retrieval** — quickest initial change, but duplicates policy, audit and
  migration work when briefing and memoir arrive.
- **Immediate LangGraph service** — powerful for long-running agent graphs, but retrieval itself is
  a bounded pipeline and the extra Python/service boundary has no current requirement.
- **Replace the custom stores with Spring AI `VectorStore`** — reduces some adapter code but loses
  important Mezo-specific provenance, validity, fact and graph semantics; framework primitives are
  used selectively instead.

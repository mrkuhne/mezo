# 0031 — Knowledge graph is Postgres-native

- **Status:** Accepted
- **Date:** 2026-08-22
- **Driver:** mezo-b3pp.6 (W2.1 Graph tables + skeleton + ADR)

## Context

Phase 5 W2 (design spec §4.2/§6.1, `docs/superpowers/specs/2026-08-18-phase5-deep-memory-personalization-design.md`)
introduces a knowledge graph — nodes (patterns, preferences, goals, life events, seasons, insights)
connected by typed, weighted edges (triggers, precedes, supports, conflicts, relates-to) — to
represent that facts *chain* ("late eating hurts sleep" → "poor sleep hurts training"), not just
exist as a flat list. This needs: node/edge storage, a small-hop neighborhood traversal (W2.4,
≤2 hops from seed nodes), and periodic maintenance (decay/prune/reinforce, W2.5).

The system is single-user (`mezo` is a personal companion app, ADR 0001's k3s/ArgoCD self-managed
deployment), and the graph's expected scale is hundreds of nodes and low-thousands of edges over
years of use — not the millions-of-nodes regime graph databases are built for. Every other Phase 5
table (journal, decision, gratitude, feedback, period_summary) lives in the same Postgres instance
behind the same backup/consistency domain as the rest of the app's data.

## Decision

The knowledge graph is Postgres-native: `knowledge_node`/`knowledge_edge` as plain tables
(§4.2 DDL), neighborhood traversal via a recursive CTE (`GraphTraversalService`, W2.4) bounded to
`maxHops` (default 2) and ordered by edge weight. No graph database, no `pgRouting` extension.

## Consequences

- One backup/consistency domain — the graph never drifts out of sync with the tables it derives
  from (`pattern`, `knowledge_fact`, `goal`, `journal_entry`) because everything is one Postgres
  transaction away.
- No new infrastructure component to operate, monitor, or back up separately (k3s deployment stays
  as-is — no Neo4j/AGE StatefulSet, no second connection pool, no second migration tool).
- Traversal is bounded by design (`maxHops` 1..3) — a recursive CTE over a table with hundreds of
  rows and an indexed `(from_node_id)`/`(to_node_id)` pair stays fast without specialized graph
  indexing; this would not hold at graph-database scale, which is exactly the scale this app will
  never reach (single user).
- If usage ever crosses into the tens-of-thousands-of-nodes range (would require the app to serve
  many independent large-graph users, a different product), this decision would need revisiting —
  explicitly out of scope for a single-user companion.

## Alternatives considered

- **Neo4j:** purpose-built graph database with native traversal (Cypher). Rejected — a whole new
  deployment (StatefulSet, backup strategy, driver dependency, second data-consistency domain) for
  a graph that will hold hundreds of rows is infrastructure weight with no corresponding benefit at
  this scale.
- **Postgres AGE (Apache AGE graph extension):** graph queries inside Postgres via Cypher. Rejected
  — still a non-trivial extension to install/maintain on the k3s Postgres instance, and a recursive
  CTE already does everything a 2-hop bounded traversal over a small table needs; AGE's benefit
  (expressive graph query language) doesn't offset its operational cost here.

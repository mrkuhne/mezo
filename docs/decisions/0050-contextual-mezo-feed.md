# 0050 — Shared personal context and tools for contextual Mezo messages

- **Status:** Accepted (implementation pending)
- **Date:** 2026-09-23
- **Driver:** mezo-7nron

## Context

Production weight reactions repeated the same interpretation across many measurements despite
having relevant chat memory available. Same-day-only repetition avoidance and an undated,
whole-history slope presented as a weekly direction prevented useful continuity. Other feed
kinds repeated irrelevant absences and stale personal narratives. The owner explicitly wants
immediate responses, relevant cross-domain connections and respectful proactive challenge.

## Decision

Reuse chat's personal context, memory, read tools and provider infrastructure behind a dedicated
feed orchestrator. Supply dated event evidence and bounded prior feed statements; allow tools
to inspect missing cross-domain evidence. Preserve each message kind's delivery and action
rules. Prior AI statements are interpretations to revisit, not independent facts. Keep ADR
0045's direct, honest voice and absence of a live LLM judge.

The [design spec](../superpowers/specs/2026-09-23-contextual-mezo-feed-design.md) defines the
limits, provenance, per-kind behavior, failure handling and quality gate. No UI/API redesign
or weight-engine algorithm change is included.

## Consequences

Personalization improvements become reusable across chat and feed. Bounded context and tool
calls add cost and latency, requiring measured rollout. All active feed kinds must be integrated;
a weight-only prompt edit would leave the approved goal incomplete. Synthetic multi-day tests
plus a prose-quality review distinguish correct wiring from useful generated messages.

## Alternatives considered

- Prompt-only cleanup: cheap but cannot supply temporal evidence or durable continuity.
- Copy the entire chat workflow into each generator: diverges quickly and duplicates policy.
- Mandatory deep planner and judge for every message: adds calls regardless of need and conflicts
  with ADR 0045. A shared bounded tool-capable completion is the starting point.

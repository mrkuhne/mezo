# 0039 — Lean screen-event telemetry: one table, default off

- **Status:** Accepted
- **Date:** 2026-09-07
- **Driver:** mezo-o5cz (part 4 of the admin/observability series)
- **Spec:** docs/superpowers/specs/2026-09-07-feature-telemetry-design.md

## Context

The admin hub's *Feature-használat* page derives usage from domain tables
(`mezo.admin.feature-map`) and `llm_log_history`. That answers *"did they log meals?"* — it cannot
answer *"which screens do people actually open, and which shipped surfaces are dead?"*. Several
surfaces have shipped whose real usage nobody can see, and the only current alternative is
guessing from the domain rows a screen happens to write (a read-only screen writes none).

The admin-hub spec (ADR 0038) explicitly deferred this: a general event log "may never be
needed". Part 4 exists because the screen-level question turned out to be real — so the decision
is not *whether* to answer it but how little machinery it may cost.

## Decision

**One table, one event kind, default off.**

- `screen_event` — `created_by`, `screen`, `event`, `occurred_at`, `meta jsonb`. No soft delete:
  rows are disposable and a nightly job hard-DELETEs past `mezo.telemetry.retention-days` (90).
- **One event kind (`view`)**, emitted on route change. No clicks, no dwell time, no funnels,
  no sessions, no third-party analytics.
- **`screen` is the matched route PATTERN**, resolved client-side (`/admin/users/:id`, never
  `/admin/users/42`), and query strings are never sent — no PII-bearing path param can leave the
  client even by accident.
- **Default OFF end to end** (`mezo.feature.screen-telemetry.enabled`): ingest 404s, no ingest,
  retention or controller bean exists. `k8s/backend/deployment.yaml` is the only place it is
  turned on. The frontend client swallows every failure — telemetry must never degrade the app.
- **Owner-only reads, self-writes.** A client writes only its own events (`created_by` from the
  JWT, never the payload); the read side is `GET /api/admin/usage/screens` behind
  `requireOwner()`, under ADR 0038's beta consent scope.

## Alternatives rejected

**No telemetry at all.** The status quo, and the admin-hub spec's default. Rejected because the
question it leaves unanswered — which shipped screens are dead — is exactly the one driving the
next round of product decisions, and no domain table can answer it for a read-only surface.

**A generic event pipeline** (arbitrary event types, properties, a dispatcher, an aggregation
layer — or an off-the-shelf analytics SDK). Rejected as YAGNI and as a privacy regression: a
generic pipeline invites arbitrary payloads, and a third-party SDK would ship user behaviour off
this installation entirely, which the beta consent does not cover. The `meta jsonb` column is the
deliberate hedge: a second event kind can ride the same table later without a migration, while
the CONTRACT accepts only `view` today.

## Consequences

- Having the feature costs one switch and one table. Off, the cost is the table.
- Retention is hard deletion — there is no screen-view history to mine after 90 days, by design.
- The rate limiter is a per-user in-memory token bucket: correct for the current single-replica
  deployment, and the first thing to revisit if the backend is ever scaled out.
- The admin read side is gated by `ADMIN_INSIGHTS_SWITCH`, not the telemetry switch, so with
  telemetry off the panel shows an honest zero rather than a 404 the UI must special-case.

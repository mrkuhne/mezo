# 0038 — Admin hub: cross-user reads under the existing OWNER role

- **Status:** Accepted
- **Date:** 2026-09-07
- **Driver:** mezo-d5iy (the owner needed per-user activity, footprint and cost visibility
  without opening pgAdmin)
- **Spec:** docs/superpowers/specs/2026-09-06-admin-hub-design.md

## Context

Every existing owned table filters reads to `created_by = currentUser` — mezo is single-tenant
per row, and until now the only sanctioned exception was the two shared catalogs documented as
the *Ownership exception* in [`docs/features/_platform-auth-security.md`](../features/_platform-auth-security.md)
§4 (`exercise_catalog`, `pantry_catalog`: master content with `created_by IS NULL`, readable by
everyone). Beta testers have given signed consent to admin visibility of their own data for the
duration of the beta, so a second, much broader exception — the owner reading *any* account's
rows — needed its own explicit decision rather than sliding in as an implementation detail of
whichever slice happened to need it first.

During the beta the owner needs, without opening pgAdmin: how many users there are, who they
are, what they do and how often, how much data each of them holds, which features they use, and
how much LLM cost they generate. The pre-existing owner surfaces (`me/beallitasok/admin`,
`me/ai-usage`) covered only invites/accounts and aggregate LLM cost — no per-user activity or
data-volume view, and no way to browse a user's rows.

## Decision

An in-app `/admin/*` route family, gated by the **existing `OWNER` role** via
`CurrentUser.requireOwner()` — no new `ADMIN` role. **Read-only in v1**: the admin writes nothing
on another user's behalf; the pre-existing account actions (status toggle, password reset,
invites) are the only writes and are unchanged. The data browser is a **generic,
`information_schema`-driven row browser** — an allowlist of owned tables and columns built once
from the schema, not a bespoke per-feature view — so a new owned table becomes browsable for free
instead of costing a manual admin slice. **No export.**

## Consequences

- The browser and the footprint counters run **native SQL**, which bypasses JPA's
  `@SQLRestriction` soft-delete filter — every query therefore carries an explicit
  `is_deleted = false` predicate unless `includeDeleted=true` is requested.
- Table and column identifiers **never come from the request into SQL** — a request-supplied
  name is resolved through the `information_schema` allowlist and the *catalog's own* string is
  what gets quoted and emitted, never the request's.
- Columns whose name matches `password|secret|token|hash`, and `USER-DEFINED`/pgvector-typed
  columns, are **dropped from the catalog entirely** — they cannot be selected, sorted, or
  filtered on, whatever table they sit on.
- **The consent is time-boxed to the beta.** This ADR authorizes cross-user reads for the beta
  period on the strength of the testers' current consent; it must be **revisited before general
  availability** — either re-confirmed under a durable consent/ToS mechanism or narrowed before
  the user base grows past people who explicitly opted in.

## Alternatives rejected

- **Per-feature admin aggregator services** — typed and clean, but ten feature slices to touch
  and every new owned table is manual work thereafter.
- **Liquibase `admin_*` views** — pushes logic into migrations that are hard to test in this
  codebase's harness and cannot power a generic, parameterized row browser.
- **A separate admin SPA** — a second deploy unit and a second auth path for no real isolation
  benefit, since the admin route already shares the same JWT bearer client and backend.

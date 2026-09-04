# 0035 — Multi-user account model: invite-gated beta, shared catalogs, app-level ownership

- **Status:** Accepted
- **Date:** 2026-09-02
- **Driver:** mezo-qw37 (slices mezo-qw37.1 … mezo-qw37.6)
- **Spec:** docs/superpowers/specs/2026-09-02-multi-user-accounts-design.md

## Context
mezo was a single-owner PWA with the owner's credentials baked into the frontend build, every
`@Scheduled` job iterating all `app_user` rows, "Daniel" hard-wired into ~20 prompt files, and
device storage keyed without a user. The data layer was already multi-user shaped (every domain
table `created_by NOT NULL`, every unique constraint led by `created_by`). Goal: a closed beta of
5–20 invited users, each with their own data, sharing the exercise and pantry catalogs.

## Decision
| Code | Decision | Rejected |
|---|---|---|
| A / A1 | Invite code + email + password; codes handed over by the owner; reset = admin temporary password | Magic link (SMTP + PWA link issues), open registration, OAuth |
| Q3a | Minimal in-app admin UI (`role=OWNER`): invites, users, reset, disable | psql/CLI only |
| M1 | Keep HS256 JWT + `CurrentUserId`; token in localStorage; disable via per-request status check | Session cookie + CSRF SPA rewrite, Keycloak/Authentik |
| K1 | Community pantry catalog: `pantry_catalog` global (seed + user-added, author marked), `pantry_item` per-user state — **BUILT (S4, `mezo-qw37.4`)**: `pantry_catalog` (master `created_by NULL` + user-authored rows, visible to everyone) and per-user `pantry_item` (`catalog_id NOT NULL`) now exist per this decision; see [`pantry.md`](../features/pantry.md) | K2 private additions, K3 copy at registration |
| E1 | Community exercise catalog: user-added exercises visible to all; media/edit by author or OWNER | E2 private exercises |
| O2-lite | Onboarding wizard: name, birth date, sex, weight, height | O1 empty app, full wizard with meso |
| T1 | HU-only beta: `app_user.timezone` column stored, not yet used | Per-user timezone now (47+ `LocalDate.now()` sites) |
| L1 | Cron fan-out only over ACTIVE + onboarded users, per-job fresh-data guard before any LLM call, per-user LLM cost on the admin page | Monthly quota (L2), nothing (L3) |
| S6 | Prompts get `app_user.name` via one `{{NÉV}}` token (no inflection); transcript labels and the konzílium marker are user-neutral (`Felhasználó`) so stored rows never depend on a display name | Full Hungarian case inflection; name-bearing stored labels |
| S6 | Device storage keys namespaced `mezo.<userId>.…`; theme stays device-level; pre-S6 keys orphaned | Migrating old keys |
| S6 | One browser = one account for push: subscribe re-binds the endpoint | Allowing an endpoint under two accounts |
| S6 (build finding) | Cron presence guard reads `app_user.last_seen_at` (stamped only by `CurrentUser` on an authenticated request) | A `DailyQuestRepository` "quest row exists in the window" finder — REJECTED after landing: it latches on its own output (the cron's own writes count as "recent activity"), so a dormant account keeps re-proving presence and the daily flavor-LLM spend never stops. Ruled out by the human partner mid-slice; the finder was deleted. |

## Consequences
Easy: adding a user is an invite; every owned endpoint keeps working unchanged; catalogs grow
communally. Harder: no revocation until token expiry (30 d) beyond the status check; T1 leaves
"today" server-global; old conference transcripts carry the legacy `DANIEL VÁLASZA —` marker and the
FE parses both; L2 (a monthly per-account cost cap) is not adopted — only cost *visibility* shipped
(owner `byUser` split + per-user Memória/Audit panel). To maintain: the B-user isolation test on
every new endpoint, `UserFanOut` in every new job (reading presence off `last_seen_at`, never off a
job's own output table), `{{NÉV}}` in every new prompt.

## Alternatives considered
Hibernate `@TenantId` (does not cover `findById`/native paths, not applicable to global catalogs);
Postgres RLS (two DB roles + datasource proxy + silent-empty failure mode — disproportionate under 20
users); session cookie + one-time-token magic link (SMTP infra and a full auth-stack rewrite for zero
beta value); a quest-row-existence cron presence check (see S6 build-finding row above — rejected
after implementation for self-latching). Sources: spec §13.

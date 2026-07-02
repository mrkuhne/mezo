# 0007 — Machine enforcement of the house conventions (phased CI gates)

- **Status:** Accepted
- **Date:** 2026-07-02
- **Driver:** mezo-ah18 (audit epic), first slice mezo-ah18.4

## Context

The 2026-07 full-app audit (epic `mezo-ah18`) found that while code discipline is strong, the
house standards under `docs/references/` were enforced almost entirely by **prose** — CLAUDE.md
instructing agents to read the reference docs. The only automatic checks between a convention
violation and `main` were `tsc` and `javac`:

- `deploy.yml` deliberately runs **no tests** (mezo-oa3: tests are a local pre-push gate; the
  deploy path goes straight to build).
- The frontend had **no ESLint** at all; the backend has no ArchUnit/Checkstyle.
- `scripts/lint-docs.mjs` existed and was CI-shaped (exit 1) but nothing invoked it.
- The generated contract artifacts (`api/openapi.yml`, `frontend/src/data/_client/api.gen.ts`)
  could silently drift from the `api/feature/*` fragments — only the backend regenerates on
  every build.

Single-dev + agent-driven development makes prose rules workable but not durable: every rule
that is only prose must be re-read, re-remembered, and re-honored on every session.

## Decision

Introduce machine enforcement **in phases**, each phase a separate bd issue, all gates living
in a new **`ci.yml`** workflow that is separate from `deploy.yml` (deploy stays fast per
mezo-oa3; `ci.yml` gates quality, not releases):

1. **Phase 1 — this ADR (mezo-ah18.4):** cheap static gates on push/PR:
   - `node scripts/lint-docs.mjs --errors-only` — hard doc errors block; 🔶 staleness stays
     advisory (git-drift staleness has known false positives).
   - `node scripts/lint-liquibase.mjs` (new) — migration filename pattern
     (`{YYYYMMDDHHMM}_{bd-id}_{desc}.sql`), explicit constraint-name prefixes
     (`pk_/fk_/uq_/ck_/idx_`), seed-SQL ban (`INSERT INTO` fails; explicit
     `-- lint-liquibase: allow-insert` marker for genuine backfills), master-yml cross-check.
     The two v1.0.0 unnamed PKs are grandfathered (released changesets are immutable).
   - **contract-drift job** — regenerates the fragment merge + FE types and fails on
     `git diff` against the committed artifacts.
2. **Phase 2 (mezo-ah18.5):** the test job — both frontend modes + backend ITs on
   Testcontainers — turning every existing local gate into a blocking one.
3. **Phase 3 (mezo-ah18.6 / .7):** ESLint flat config (import/layer/naming rules) and an
   ArchUnit test class (package structure, DI, `@Value` ban, exception rules).

## Consequences

- Convention violations in migrations, docs and the API contract now fail visibly on `main`
  pushes and PRs instead of rotting silently; agents get a red check instead of a prose rule.
- `deploy.yml` is untouched — a failing `ci.yml` does **not** block a deploy. **Decided with
  mezo-ah18.5:** deploys stay independent of `ci`. Gating would delay every release by the IT
  suite (~5+ min) and require rebuilding `deploy.yml` around `workflow_run` semantics; for a
  single-user app with trivial ArgoCD rollback and a mandated local pre-push gate, fix-forward
  on a red `ci` run is cheaper than slowing every deploy. Revisit if a second user or a real
  outage cost appears.
- Two more scripts to maintain (`lint-liquibase.mjs`; `lint-docs.mjs` gained `--errors-only`),
  both dependency-free Node.
- Grandfathered exemptions live as an explicit allowlist inside `lint-liquibase.mjs` — never
  extended for new work.

## Alternatives considered

- **Git pre-commit/pre-push hooks only** — bypassable (`--no-verify`), single-machine, and the
  bd hook chain already owns `core.hooksPath`; rejected as the primary mechanism.
- **Putting the gates into `deploy.yml`** — couples quality gates to the release path that
  mezo-oa3 explicitly keeps fast; rejected.
- **One big phase (lint + tests + ESLint + ArchUnit at once)** — too much surface at once;
  phased issues keep each gate reviewable and revertable.
- **Marketplace lint actions** instead of repo-local scripts — external dependency + config
  drift for checks that are ~200 lines of dependency-free Node; rejected.

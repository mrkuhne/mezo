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

---

## Amendment — 2026-09-06: what the gates do *not* say (mezo-z3ll, mezo-82m6, mezo-x57b)

An audit of the gates themselves (round 2 of the "lying developer gates" program) found three
things this ADR left unstated. Two are now enforced by machine; the third is written down here
because it is a deliberate trade whose price nobody had ever put a number on.

### 1. The deploy builds a commit that CI never tested (mezo-z3ll) — recorded, not changed

`ci.yml` on a pull request checks out **`refs/pull/N/merge`** — an ephemeral merge commit that
never exists on `main`. Measured on run 34048116823:

```
HEAD is now at b7fd214 Merge f90b82cea… into cd955849…
```

`deploy.yml` builds **`github.sha`** — the merge commit that actually landed on `main`. Two
different commits, always. The honest reading is narrower than "untested code ships", and both
halves matter:

- **Usually the *tree* is identical.** When main has not moved between the CI run and the
  merge, the tested merge ref and the landed `--no-ff` merge share the same tree; only the
  commit metadata differs. Nothing untested ships.
- **But main often *has* moved.** Measured over the six most recently merged PRs by comparing
  the base CI actually tested (from the checkout log line above) with `merge_commit_sha^1`:

  | PR | base CI tested | base it landed on | |
  |---|---|---|---|
  | #514 | `cd955849` | `cd955849` | same |
  | #511 | `bd5ffd32` | `bd5ffd32` | same |
  | #510 | `9ff77769` | `9ff77769` | same |
  | #509 | `bd5ffd32` | `1a7a524d` | **moved** |
  | #508 | `bd5ffd32` | `92316f43` | **moved** |
  | #512 | *(CI never finished — merged while `test-backend` and `test-frontend` were still `in_progress`)* | `33bbe044` | **untested** |

  So **3 of 6** recent releases deployed a tree no CI run had ever evaluated as such. The
  push-triggered `ci.yml` on `main` does cover that tree — but it runs *after* the deploy and
  the deploy does not wait for it, so the image is in GHCR and ArgoCD has rolled it out before
  the answer arrives.

**Therefore: the green tick on a PR is never about the byte sequence that goes into the
container.** `premerge.yml` narrows this (it re-checks the *current* merge ref) but only for
the cheap gates — not the backend or frontend suites, which are exactly the
ones that would catch a semantic conflict between two branches.

**Decision: unchanged — the deploy stays independent of `ci` (mezo-oa3, and the original
consequence note above).** What would close it, and what it costs:

| Option | What it buys | What it costs |
|---|---|---|
| Gate `deploy.yml`'s `release` job on the main `ci.yml` run for the same SHA (`workflow_run` or a wait-for-check step) | no image is ever tagged from a tree that main-CI has not passed | **every release waits for the full main CI (~21.5 min wall clock)** instead of ~4 min; deploy.yml has to be rebuilt around `workflow_run` semantics, which also breaks the `[skip ci]` loop-breaker and the `concurrency: deploy-main` queue |
| Gate only the *tag bump* (build + push the image immediately, bump the k8s manifest only after main CI is green) | ArgoCD never rolls out an untested tree; the image build stays fast | same ~21.5 min before anything is user-visible, plus a second workflow to maintain |
| Alert only: post a comment/issue when main CI goes red on an already-deployed SHA | zero slowdown | high false-alarm rate if evaluated at deploy time — deploy finishes in ~4 min and main CI takes ~21.5, so "CI not green yet" would be the normal state and the alert would be noise within a week |
| Do nothing (status quo) | fastest possible release | the table above: ~half of releases ship a tree only main-CI-after-the-fact ever sees |

This is a real speed/risk trade, not an oversight, and it is now **written down** rather than
implicit. Filed as **mezo-2bme** for the owner to decide; nothing was changed unilaterally.

### 2. A failed deploy is no longer silent (mezo-82m6) — new gate

Measured 2026-09-05: **20 consecutive main deploys failed over roughly a day** (runs
`33955077824` … `33969595641`, plus `34003265197` the next morning) while `ci.yml` was green
throughout. Nothing surfaced it — deploy failure produced no check on `main` and no
notification. The bug (mezo-0j9n, a SIGPIPE in `compute-release.sh`) took 20 minutes to fix;
the *delay before anyone looked* was a day.

`deploy-watch.yml` + `.github/scripts/deploy-alert.sh` now watch `deploy.yml` via
`workflow_run` and, on failure, post a `deploy` **commit status** on the deployed SHA and open
**one deduplicated `deploy-failure` issue**; a later successful deploy posts a green status and
closes it. This does **not** gate anything — ADR 0007's original decision stands untouched.

*False-alarm budget, asserted in `deploy-alert.test.sh`:* it fires only on a run conclusion of
`failure`/`timed_out`/`startup_failure`/`action_required`. `cancelled` and `skipped` are
ignored, because deploy.yml's concurrency queue cancels superseded runs and the `[skip ci]`
release commit skips every job. Replayed over the last 60 real deploy runs: 32 alerts, 25
clears, 3 ignores — **0 false alarms**.

### 3. "Zero checks ran" no longer reads as green (mezo-x57b) — new gate

A head with **no check runs at all** is displayed by the PR page and by `gh pr checks` exactly
like a head where nothing failed. Measured on PR #504's head `28c33c23b`:

```
$ gh api repos/mrkuhne/mezo/commits/28c33c23b/check-runs -q .total_count   ->  0
$ gh api repos/mrkuhne/mezo/commits/28c33c23b/status      -q .state        ->  pending   (0 statuses)
```

Three distinct causes are known — a bot push made with `GITHUB_TOKEN` (GitHub deliberately
starts no workflow, and `ci.yml` has no `workflow_dispatch` arm; the original instance was
`update-visual-baselines.yml`, retired with the golden gate in `mezo-ryb6`), GitHub simply not
creating a run for a `MERGEABLE`/`CLEAN` PR, and a **CONFLICTING** PR, for which GitHub can
build no merge ref and so runs no `pull_request` checks at all (PR #547 was merged in that
state and put stale goldens on `main` — the incident that retired the gate). So this is not one
bounded case, and the only protection was human discipline.

`premerge.yml` now runs `.github/scripts/require-checks.sh`, which parses the expected job set
**out of `ci.yml`** (so a new job extends the gate for free) and requires each one to have a
successful check run on the PR head. It distinguishes *absent* / *still running* / *failed*,
and treats a `cancelled`+`success` pair for the same job as a pass, because `ci.yml`'s
`cancel-in-progress` concurrency produces exactly that.

*False-alarm budget:* replayed over the ten most recent PR heads — nine pass, and the one
flagged is a **true** positive: PR #512 was merged on 2026-09-06 while `test-frontend` and
`test-backend` were still `in_progress`. No `ci.yml` job carries an `if:`, so "missing" is
never ambiguous. The gate's only "not yet" mode is being asked before CI has finished, which it
reports as *still running*, not as a failure of the code.

# Local dev: running the test suites (resource constraints)

How to run mezo's tests on a resource-constrained local machine, why the **backend** suite
can fail there for non-code reasons, and how to get a reliable green signal anyway.

> **TL;DR** — The **backend integration suite is heavy**
> (Spring Boot + Testcontainers Postgres) and OOM-dies under memory pressure on a 16 GB box.
> **The authoritative full-backend gate is CI** (`.github/workflows/ci.yml`, `test-backend` on a
> clean `ubuntu-latest` runner). Locally, run **focused foreground gates**; run the full suite
> only when the machine is quiet.

## Why the backend suite dies locally (it's memory, not code)

Every backend test is a `@SpringBootTest` integration test that boots a Spring context and talks to
a real Postgres (a Testcontainers container, or the docker-compose DB). This is RAM-hungry.

- **The machine:** 16 GB RAM. In a busy session it runs ~18 GB of **swap** (`sysctl vm.swapusage`) —
  memory is oversubscribed and thrashing. Contributors seen: Docker Desktop's VM, IntelliJ IDEA,
  browsers, and a second parallel dev process.
- **Surefire runs one reused fork** (pom has no `forkCount`/`reuseForks`/`argLine` → defaults
  `forkCount=1, reuseForks=true`). All ~800 tests run in **one** JVM, and Spring's **context cache
  accumulates** across the run — so memory peaks near the END of the suite. That's exactly where the
  OS OOM-kills the fork: `The forked VM terminated without properly saying goodbye`. It is never a
  test failure — always a compile-phase kill, a forked-VM OOM, or a >10-min timeout.
- **Tell-tale signs:** `vm.swapusage` used ≫ physical RAM; `docker info` hangs (Docker itself is
  memory-starved); the surefire log shows a high `Tests run:` count then the VM-terminated error.

## Retired: the web frontend gates (2026-11-19, #52)

The web app (`frontend/`) was switched off and deleted (`mezo-r36n9.97.3`). Its gates went with it:
the dual-mode vitest suite (`test-frontend`), the Playwright layout harness (`test-layout`), the
pnpm/Node pin notes and the frontend half of contract-drift. Their history — why the mode had to be
pinned explicitly, why the layout harness used a per-worktree port — is in git history of this file.

## The gate model

- **Full backend suite → CI.** `ci.yml`'s `test-backend` job runs `./mvnw -B clean test
  -Dmezo.test.use-testcontainers=true` on a fresh `ubuntu-latest` runner (no IDE, no browser, no
  swap). Push the branch and let CI be the authoritative green. **Do not change the pom's
  `reuseForks` default** — CI relies on it for speed, and CI has the RAM headroom the laptop lacks.
- **How the CI suite is kept short (mezo-dubmh, 2026-11-18).** Three mechanisms, none of which
  removes a test:
  1. *One Postgres per JVM, one database per Spring context.* The suite builds ~235 distinct
     contexts (each `@TestPropertySource` combination is its own cache key). The container used
     to be a per-context bean, so every context started its own Postgres and replayed the whole
     changelog (235 container starts, 58 250 changeset executions per run). Now
     `TestcontainersConfiguration` starts one server per JVM (durability off), runs the changelog
     once into a template database and hands each context a `CREATE DATABASE … TEMPLATE` clone,
     dropped when the context closes. Isolation is unchanged — no two contexts share a database.
  2. *Parallel test JVMs:* `-Dmezo.test.forks=N` (default 1). **Only with
     `-Dmezo.test.use-testcontainers=true`** — each fork then owns a private Postgres; against the
     shared fixed `mezo_test` DB forks would truncate each other's rows. CI uses 2 (a fork peaks
     at ~3.5 GB RSS + ~1 GB Postgres on a 4 vCPU / 16 GB runner); the 128 GB machine runs 3+.
  3. *Scoped job:* `test-backend` runs its suite only when the push/PR touches `backend/`,
     `api/` or `.github/` (`.github/scripts/ci-scope.sh`). The job still starts and ends green otherwise, so
     `require-checks.sh` keeps seeing a successful check run. Fail-safe: on a push the
     diff base is the newest ancestor with a finished **green** `ci` run, not the previous commit — cancelled and red runs in between
     fall inside the diffed range, so a red main cannot be painted green by a docs-only commit.
     On `main` every push keeps its own run (the concurrency group carries the sha); only PR
     runs are superseded by a newer push.
- **Local = focused foreground gates.** For the blast radius of a change, run a handful of classes:
  ```bash
  cd backend
  ./mvnw clean test -Dtest='CatalogWriteContractIT,WorkoutContractIT' \
     -Dmezo.test.use-testcontainers=true -DargLine="-Xmx3g"
  ```
  Foreground focused runs complete; long **background full-suite** runs are the ones that get killed.

## The pre-merge re-check (`premerge.yml`) — why a green PR can still redden main

`ci.yml` **does** test the merge result, not the PR head. Measured on a real run:

```
[command] git checkout --progress --force refs/remotes/pull/475/merge
HEAD is now at 348e818 Merge af0c2a5e8… into 1975c50af…
```

(so mezo-mxrc's premise — "the visual gate measures the PR head" — is false, and its
proposed fix (a) would have been a no-op.)

The real gap is **time**. GitHub recomputes `refs/pull/<n>/merge` when the base moves, but it
does **not** re-run the workflow. A green tick can therefore describe a merge into a `main` that
no longer exists. Two incidents came from exactly that:

- the mezo-atry `AppHeader` wave merged green and broke main's visual goldens; main stayed red
  and PR #279 inherited a byte-identical 32-screenshot failure (mezo-mxrc). That gate has since
  been retired (mezo-ryb6, see below), but the timing hole it exposed is unchanged;
- PR #393 merged green and left `docs/CODEMAP.md` stale on main for three commits, because two
  branches had each regenerated it correctly against their own base (mezo-l4am).

Closing this by construction (branch protection's *"Require branches to be up to date"*, or a
merge queue) costs a **full CI cycle immediately before every merge**. Measured cost of one
`ci.yml` run (before the web app was retired; `test-frontend` and `test-layout` are gone since
2026-11-19, #52):

| job | duration |
|---|---|
| `test-backend` | 21m30s |
| `test-frontend` | 14m31s |
| `test-layout` | ~1m |
| `contract-drift` | 24s |
| `lint` | 21s |
| **wall clock** | **~21m30s** (≈42 runner-minutes) |

At this repo's merge cadence that is hours of added wall clock a day, and it serialises merges —
for a class of failure the two expensive suites are the *least* likely to cause.

So the chosen trade-off is `premerge.yml`: run **only the merge-sensitive gates** against the
merge ref as it is right now, on demand, in **~2 minutes**.

```bash
gh workflow run premerge.yml -f pr=<number>    # then merge once it is green
```

It runs `.github/scripts/cheap-gates.sh` (the same script `ci.yml`'s `lint` job runs, so the two
cannot drift) and contract-drift. It also refuses to proceed when

- the PR **conflicts** with main — the state in which GitHub builds no merge ref and therefore
  runs **no** `pull_request` checks at all, so `gh pr checks` reports none, which reads as
  "nothing failed"; or
- GitHub has not yet recomputed the merge ref against the current `main` — a result against an
  older main is the very thing this workflow exists to avoid.

This is a *narrowing*, not a proof: main can still move between the green premerge run and the
merge. It shrinks the window from "whenever CI last happened to run" to "the last few minutes".

## Retired: the two-platform screenshot-golden gate (mezo-ryb6)

Until 2026-09-07 the repo also ran `test-visual` (ubuntu) and `test-visual-darwin` (macOS):
**118 screens × 2 themes**, pixel-compared against **236 committed PNGs**, regenerated through a
dispatchable `update-visual-baselines.yml` workflow. All of it is gone — jobs, workflow, goldens,
`visual.spec.ts`.

**Why.** In its whole lifetime the gate never caught a UI regression — only its own churn. Every
red it produced was golden rot: the mezo-atry `AppHeader` wave (mezo-mxrc), the `feat/orb-seed`
darwin set drifting ~39 000 px because only the linux half was refreshed (mezo-in3h), and finally
mezo-ryb6, where **one mock-seed change** — the notification badge going `3` → `4` after PR #547
added an unread row — invalidated **all 118 goldens on both platforms at once**, because the badge
renders in the global `AppHeader` on every screen. Each incident cost a full re-baseline of a
236-file binary set, and the last one landed on `main` because PR #547 was merged with **zero CI
checks** (the conflicted-PR trap, see `require-checks.sh`).

The cost was structural, not incidental: any global chrome element makes every golden a hostage of
every mock fixture. What survived it was `test-layout`, which asserted *behaviour* (reachability)
rather than pixels — itself retired with the web app (2026-11-19, #52).

If a pixel-level gate is ever wanted again, the lesson to carry over is to **mask volatile chrome**
(the harness already had a `mask:` mechanism for OS-rendered date/time controls) rather than
baseline it.


## Running the FULL suite locally without a RAM upgrade

RAM upgrade is not an option, so reduce the footprint instead. In rough order of effectiveness:

1. **Prefer the compose DB over Testcontainers when running solo.** The default (no
   `-Dmezo.test.use-testcontainers=true`) reuses ONE long-lived container from `docker compose up -d`
   (`:15432`), which is **lighter** than Testcontainers spinning up fresh containers. Use
   Testcontainers only when you need isolation from a *second* session or from CI's shared DB.
   ```bash
   docker compose up -d          # one persistent mezo_test PG
   cd backend && ./mvnw clean test -DargLine="-Xmx2g"   # no testcontainers flag
   ```
2. **Free RAM first:** quit IntelliJ IDEA and the browser, and pause any parallel dev process, before
   a full local run. This alone often clears the swap thrash.
3. **Bound the context cache with fresh forks** — `-DreuseForks=false` gives each test class a fresh
   JVM, so the Spring context cache resets between classes and a modest heap suffices (slower, but
   memory-safe):
   ```bash
   ./mvnw clean test -Dmezo.test.use-testcontainers=true -DreuseForks=false -DargLine="-Xmx1500m"
   ```
4. **Or split into package batches** (each a separate JVM, so peak memory is per-batch):
   ```bash
   ./mvnw clean test -Dtest='io.mrkuhne.mezo.feature.train.**' -Dmezo.test.use-testcontainers=true -DargLine="-Xmx2g"
   ./mvnw clean test -Dtest='io.mrkuhne.mezo.feature.companion.**,io.mrkuhne.mezo.feature.proactive.**' -Dmezo.test.use-testcontainers=true -DargLine="-Xmx2g"
   # …remaining feature packages…
   ```
5. **Incremental (no `clean`)** — only right after a `clean` build already compiled `main`
   (`target/classes` is fresh): `./mvnw test -Dtest=… ` skips the slow recompile. CLAUDE.md warns
   Lombok+MapStruct incremental is flaky, so use sparingly.

## Environment-only switches

Some rollout switches deliberately live in the deployment environment rather than in
`application.yml`, so a code review can never flip production behaviour by accident.

### Chat serving mode (mezo-eq85, product-owner decision 2026-09-06)

Chat serves from the unified memory platform when the environment sets
`MEZO_MEMORY_SERVING_MODE=NEW` (the yml default stays `SHADOW`). `NEW` falls back to the legacy
context on a total retriever outage (audited as `MEMORY_RETRIEVAL_ALL_FAILED_FALLBACK_OLD`).
Set it in the deployment environment, not in `application.yml`.

## Reaching this dev environment from another machine (remote guide)

If a second, more capable machine is available, run the heavy work there instead of the 16 GB
laptop. The transport is **Tailscale** — the project already uses it for production admin access
(see [runbook.md](runbook.md) §private admin access), and it gives every machine a stable private
IP + built-in SSH that works across networks (no port-forwarding).

### 0. One-time: put both machines on the tailnet
On each machine: `brew install --cask tailscale` (or the pkg), sign in to the same tailnet, and
`sudo tailscale up --ssh` (the `--ssh` flag lets you SSH between them with tailnet identity, no key
juggling). Find a machine's address with `tailscale ip -4` or its MagicDNS name (`<host>.<tailnet>.ts.net`).

### A. Offload the heavy backend suite to the beefier machine *(recommended — solves the OOM)*
The memory hog is the **JVM/Maven** run, not just the container, so run **Maven itself** on the beefy
box, not only its Docker:
1. Get the branch there: `git clone` once, then `git fetch && git checkout <branch>` (or push your
   branch and pull it). A bare git remote over Tailscale SSH works: `git remote add beefy
   <you>@<beefy-host>:~/mezo` then `git push beefy <branch>`.
2. Run the suite on the beefy box over Tailscale SSH:
   `ssh <you>@<beefy-host> 'cd mezo/backend && ./mvnw -B clean test -Dmezo.test.use-testcontainers=true'`
   (or open a `tmux`/`ssh` session and run it interactively). Docker + Testcontainers run there.
3. **Just want the gate, not a second machine?** Push the branch → **CI runs the full suite** already
   (see §The gate model). That's the zero-setup offload.

*Marginal alternative — remote Docker only:* point Testcontainers at the beefy machine's Docker with
`export DOCKER_HOST=ssh://<you>@<beefy-host>` before `./mvnw … -Dmezo.test.use-testcontainers=true`.
This runs the **containers** remotely but the **JVMs stay local**, so it offloads little of the RAM
pressure — prefer running Maven remotely (A.2).

### B. Remote development from another machine
Edit/run the project on the beefy box from a lightweight laptop:
- **VS Code Remote-SSH** or **JetBrains Gateway** → connect over Tailscale SSH (`<you>@<beefy-host>`);
  the toolchain (JDK, Maven, Docker) runs remotely, the UI is local.

### C. Reach the running backend from another device
The backend already listens on `:8090`; from another machine on the tailnet use
`http://<dev-host>.<tailnet>.ts.net:8090`. Tailscale handles the private routing; no LAN/firewall
fiddling. (The web dev server this section used to describe was retired with the web app,
2026-11-19, #52.)

> Which of A/B/C fits depends on your exact setup (a 2nd Mac? a cloud VM? just CI?) — this covers the
> common paths; narrow it down and I'll tighten the relevant one.

---

Related: personal-memory `mezo-backend-tests-oom-16gb`; build/test commands in the root `CLAUDE.md`.

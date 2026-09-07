# Local dev: running the test suites (resource constraints)

How to run mezo's tests on a resource-constrained local machine, why the **backend** suite
can fail there for non-code reasons, and how to get a reliable green signal anyway.

> **TL;DR** — The frontend suite runs fine locally. The **backend integration suite is heavy**
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

The **frontend** vitest suite has none of this (no Docker, light JVM-less runtime) — it stays green.

## pnpm is pinned by `packageManager`, not by a CI input (mezo-q8oy)

`frontend/package.json` carries `"packageManager": "pnpm@11.25.0"`, and `pnpm/action-setup`
reads it (`package_json_file: frontend/package.json`, no `version:` input). One pin, so CI and
every local shell resolve the same pnpm instead of two numbers that must be kept equal by hand.

Two pnpm-10/11 behaviours are load-bearing here:

- **Settings moved out of `package.json`.** The `pnpm` field is ignored (with a warning); the
  settings root is `frontend/pnpm-workspace.yaml`. Its `packages: ['.']` marks frontend/ as that
  root — it is *not* declaring a monorepo.
- **Dependency build scripts are blocked by default, and pnpm 11 makes an ignored build an
  error** (`ERR_PNPM_IGNORED_BUILDS`). `allowBuilds: {msw: true, sharp: true}` is therefore
  required for `pnpm install` to succeed at all. (pnpm 11 renamed pnpm 10's
  `onlyBuiltDependencies` to `allowBuilds` — it rewrites the file for you if you use the old
  name.) Under an older pnpm the same gap would install "successfully" with no msw service
  worker and no sharp binary.

**pnpm 11 needs Node ≥ 22.13**, and the workflows pinned `node-version: 20` — so the first CI
run failed inside `actions/setup-node`'s own pnpm cache probe:

```
Error [ERR_UNKNOWN_BUILTIN_MODULE]: No such built-in module: node:sqlite
##[error]warn: This version of pnpm requires at least Node.js v22.13
```

That exposed a second, older divergence: the dev machine has been on **Node 22** while CI ran
**Node 20**, and nothing declared or checked it. Both are now **22**, and
`frontend/package.json` carries `"engines": { "node": ">=22.13" }` so the requirement is stated
in the repo rather than discovered from a CI stack trace.

The upgrade left `pnpm-lock.yaml` **byte-identical** (still `lockfileVersion: '9.0'`, same
resolutions), so it does not churn every open branch.

## The gate model

- **Full backend suite → CI.** `ci.yml`'s `test-backend` job runs `./mvnw -B clean test
  -Dmezo.test.use-testcontainers=true` on a fresh `ubuntu-latest` runner (no IDE, no browser, no
  swap). Push the branch and let CI be the authoritative green. **Do not change the pom's
  `reuseForks` default** — CI relies on it for speed, and CI has the RAM headroom the laptop lacks.
- **Local = focused foreground gates.** For the blast radius of a change, run a handful of classes:
  ```bash
  cd backend
  ./mvnw clean test -Dtest='CatalogWriteContractIT,WorkoutContractIT' \
     -Dmezo.test.use-testcontainers=true -DargLine="-Xmx3g"
  ```
  Foreground focused runs complete; long **background full-suite** runs are the ones that get killed.

### The frontend dual-mode gate: which mode am I actually in? (mezo-h4wp.6.3)

`isMockMode()` (`frontend/src/data/_client/mode.ts`) is `import.meta.env.VITE_USE_MOCK !== 'false'`
— **anything other than the literal string `false`, including UNSET, means MOCK mode.** What makes a
bare `pnpm test` run in real mode is not a default but the **gitignored `frontend/.env`**
(`VITE_USE_MOCK=false`), which Vite loads into `import.meta.env` for vitest too.

Consequences, each of which has already burned us:

- **A `git worktree` / fresh clone has no `.env`** → its `pnpm test` silently runs **mock mode**.
  Comparing a branch (main checkout, real mode) against `origin/main` (a scratch worktree, mock
  mode) compares two *different modes* and manufactures phantom "merge regressions". When you
  bisect or A/B across checkouts, **always pass the mode explicitly**:
  `VITE_USE_MOCK=false pnpm test` / `VITE_USE_MOCK=true pnpm test`.
- **CI checkouts have no `.env` either.** `ci.yml`'s `test-frontend` step used to run bare
  `pnpm test` for its "real mode" leg, so it was running **mock mode twice** and the real-mode half
  of the CLAUDE.md gate was vacuous. Both legs now set `VITE_USE_MOCK` explicitly — keep it that
  way, and never "simplify" the `false` leg back to a bare `pnpm test`.
- **Real mode has no synchronous first frame.** `useDualQuery` only seeds `initialData` in mock
  mode; in real mode the first render is `isPending` with the `realEmpty` ghost. Any test that
  renders a page gated on a pending read (e.g. Today's `sleepGoalPending` skeleton) must use
  `findBy*`, not `getBy*` — a `getBy*` there passes in mock mode and fails in real mode.

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
`ci.yml` run:

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

## Layout-invariant gate (`test-layout`)

The frontend carries a small **non-screenshot** Playwright harness at `frontend/tests/layout/`
(`layout.spec.ts` + `playwright.config.ts`). It boots the app in **mock mode** on a
**per-worktree port** (no backend needed) and asserts **layout invariants at real phone
viewports** — that content is *reachable*: either it fits, or the page scrolls to it, never
clipped into nothing by an `overflow: hidden` ancestor.

```bash
cd frontend && pnpm test:layout      # ~36s locally, 38 tests
```

**Why it exists as its own gate.** This bug class is invisible to both other suites:

- **jsdom (`test-frontend`/vitest) computes no layout at all** — a clipped island measures fine;
- the retired screenshot goldens ran at **440×956**, taller than a real phone (iPhone 15 Pro ≈
  852 CSS px). The keret-hero regression cleared 956 by 1.5 px and clipped **66 px at 852** —
  green goldens, broken phone (mezo-gllr).

> **The port is derived from the worktree path** (`43000 + sha1(worktree) % 1000`; override with
> `VISUAL_PORT`), and `reuseExistingServer` is **off**. It used to be a hardcoded `4318` with reuse
> **on**, which meant a vite dev server left running by *another* worktree or agent session was
> adopted in silence — Playwright then drove the other tree's UI with no warning. It bit twice in
> the mezo-iizd.9 round (mezo-sdbm). With the fix, an occupied port fails loudly. Starting our own
> server costs ~2s.

**On failure:** the CI `test-layout` job uploads a **`layout-failures`** artifact (retention 7
days) with the Playwright output for each failing test; locally the same lands in
`frontend/test-results/`.

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
every mock fixture. What survives is `test-layout` above, which asserts *behaviour* (reachability)
rather than pixels, and so cannot rot this way.

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
  the toolchain (JDK, Maven, Docker, pnpm) runs remotely, the UI is local.

### C. Reach the running dev servers from another device (e.g. the PWA on a phone)
Bind the dev servers to all interfaces and hit them over the tailnet:
- Frontend: `pnpm dev --host` (Vite serves on `0.0.0.0:5180`); backend already listens on `:8090`.
- From the phone/other machine (also on the tailnet): `http://<dev-host>.<tailnet>.ts.net:5180`
  (point `VITE_API_URL` at `http://<dev-host>...:8090`). Tailscale handles the private routing;
  no LAN/firewall fiddling.

> Which of A/B/C fits depends on your exact setup (a 2nd Mac? a cloud VM? just CI?) — this covers the
> common paths; narrow it down and I'll tighten the relevant one.

---

Related: personal-memory `mezo-backend-tests-oom-16gb`; build/test commands in the root `CLAUDE.md`.

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

## Visual regression gate (two-platform Playwright goldens)

The frontend has a **self-baselined visual harness** at `frontend/tests/visual/` (`visual.spec.ts` +
`playwright.config.ts`) — **14 key screens × 2 themes = 28 `toHaveScreenshot` goldens**. It boots the
app in **mock mode** on a dedicated port (4318, no backend needed) so the seeds are static, and
pixel-compares each screen against a committed golden. This is a fast, JVM-less gate (unlike the
backend suite above) — it runs fine locally.

**Two-platform golden model.** Playwright names goldens per-platform, and darwin vs linux font
rendering differs by a few sub-pixels, so the harness commits **both** sets under
`visual.spec.ts-snapshots/`:

- **darwin goldens** (`*-darwin.png`) — read by **local** runs on the Mac.
- **linux goldens** (`*-linux.png`) — read by the **CI** `test-visual` job (`ci.yml`), which runs on
  `ubuntu-latest`.

Each platform only ever reads its own goldens, so the two sets never collide; you regenerate whichever
platform a change affects.

**Commands:**

| What | Command | Regenerates |
|---|---|---|
| Compare (local) | `cd frontend && pnpm test:visual` | — (read-only) |
| Re-baseline (local) | `cd frontend && pnpm test:visual:update` | darwin goldens |
| Re-baseline (CI/linux) | `gh workflow run update-visual-baselines.yml -r <branch>` | linux goldens |

The **`update-visual-baselines.yml`** workflow (`workflow_dispatch`) regenerates the linux goldens on
the dispatched ref on a clean `ubuntu-latest`, then pushes them back as a bot commit — so you never
hand-generate linux PNGs on a non-linux box.

**When to re-baseline:** whenever a change **intentionally moves pixels** (a redesign, a token tweak, a
new/changed screen). Update **both** platforms in the same change — `pnpm test:visual:update` locally
for darwin, then `gh workflow run update-visual-baselines.yml -r <branch>` for linux (or let CI's red
`test-visual` remind you to). An *unintended* diff is a real regression — investigate, don't
re-baseline it away.

**Determinism levers** (all must hold or the shots flake — identical on both platforms):

- **Frozen clock** `2026-05-21T13:42` (délután), set *before* `goto` — pins the daypart-derived sky
  tint + greeting and matches the StatusBar's hardcoded 13:42.
- **Theme** via a `localStorage['mezo-theme']` init script *before* `goto` — the pre-paint
  `index.html` script then stamps `data-theme`.
- **Reduced motion** via `contextOptions.reducedMotion: 'reduce'` + Playwright's default
  `animations: 'disabled'` — no in-flight transitions.
- **Self-hosted fonts** (Bricolage + Jakarta, no network) + a `document.fonts.ready` wait — the pixel
  compare runs on real font metrics, not fallbacks.
- **Pinned timezone** `timezoneId: 'Europe/Budapest'` — a UTC runner would otherwise shift the
  frozen-clock daypart derivation away from the goldens.

**On failure:** the CI `test-visual` job uploads a **`visual-diffs`** artifact (retention 7 days)
containing the `actual` / `expected` / `diff` PNG trio per failing screen — download it from the run's
Summary to see exactly what moved. Locally, the same trio lands in
`frontend/tests/visual/test-results/`.

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

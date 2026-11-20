# Project Instructions for AI Agents

This file provides Claude-specific instructions for this project.

> **Core house rules live in [`AGENTS.md`](AGENTS.md)** — beads, git workflow, session
> completion, non-interactive shell discipline, docs mandate, architecture, build & test,
> backend conventions. Reading it is MANDATORY at session start; everything there
> applies to Claude sessions in full.

<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:ca08a54f -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

## Git Workflow

**"No-wait, net stays"** (owner decision 2026-09-18) — canonical rules in [`AGENTS.md`](AGENTS.md) §Git Workflow:

- One bd issue + one `feat/<topic>` branch per change. Run the **local gates** for what you changed (backend focused tests and/or iOS `xcodebuild test` — the 128 GB machine can run the full suite with `-Dmezo.test.use-testcontainers=true` when warranted) → `git pull --rebase` main → merge **locally with `--no-ff`** → `git push` main → delete the branch. **No self-PR, no waiting for CI before merge.** From a worktree: `git checkout --detach origin/main && git merge --no-ff <branch> && git push origin HEAD:main`.
- **The safety net:** `ci.yml` still runs on every push to main. Don't wait for it — but **a red main outranks everything**: fix it before any new work. Check `gh run list --branch main --limit 1` at session start.
- **Optional pre-merge cloud check** for risky changes (migrations, API contract, cross-cutting refactors): the old self-PR + `gh workflow run premerge.yml -f pr=<n>` flow remains available.
- Conventional commit subjects carrying the driving bd id: `feat(api): ... (mezo-ej0)`.

## Session Completion

**Work is NOT complete until `git push` succeeds — never leave work stranded locally.** Before ending a session:

1. File bd issues for remaining work; close/update finished ones
2. Run quality gates if code changed (backend: `./mvnw clean test`; iOS: `xcodebuild test` per `ios/README.md`)
3. **Refresh the off-machine tracker backup** — `.beads/issues.jsonl` is the ONLY copy of the
   tracker outside this machine (the Dolt DB is gitignored), and **nothing maintains it
   automatically**: the beads pre-commit hook leaves it byte-identical. It silently drifted 429
   records / 115 open issues behind the DB (mezo-m2au).
   ```bash
   node scripts/check-beads-backup.mjs --fix   # then commit the result
   ```
   It cannot be a CI gate — the runner has no Dolt DB — so it belongs here.
4. **Sync the owner's Notion "Boop" space** if you changed anything about the product (see
   §The owner's Notion "Boop" space): `node scripts/boop-notion-sync.mjs check` must exit 0.
5. Push everything (if push fails, resolve and retry until it succeeds):
   ```bash
   git pull --rebase && bd dolt push && git push
   git status  # MUST show "up to date with origin"
   ```
6. Hand off: short context for the next session
<!-- END BEADS INTEGRATION -->

## Communication with the user (MANDATORY, every session)

The repo owner is a **non-engineer product owner**. He decides *what* the product should do,
not *how* the code does it. Technically-phrased questions repeatedly forced him to ask
"explain it like I'm a child" — so this is the default, not a fallback.

**Whenever you ask him to decide something, or explain a trade-off, a blocker, a plan or a
result:**

- **Write in Hungarian.** He writes in Hungarian; answer and ask in Hungarian.
- **Business language, zero jargon.** No identifiers, file paths, config keys, class names,
  API names, or version strings in the question itself. Say "hangfelismerés" instead of
  `SpeechRecognitionAdapter`, "olcsó modell" instead of `chat-model`. If a technical term is
  genuinely unavoidable, translate it in the same sentence.
- **Structure every decision the same way:**
  1. **A helyzet** — one or two sentences of plain context.
  2. **A gond** — what is actually wrong, in consequence terms ("ez nem fog működni, mert…").
  3. **A lehetőségek** — a small table: option name in everyday words · *Amit csinálunk* ·
     *Mi az ára* (cost/risk in user-visible terms: money, speed, effort, what breaks).
  4. **Az ajánlásom** — say which one you would pick and why, in one sentence. Always
     recommend; never leave him to weigh raw options alone.
- **Two or three options maximum.** Cost must be expressed as impact he can feel (a feature
  stops working, it takes longer, it costs more), not as "4 call sites must change".
- **Short.** A decision fits on one screen. Detail belongs in the plan/spec, not in the question.
- Keep full technical precision in **code, commits, PRs, bd issues and docs** — this rule
  governs what you say *to him*, not what you write for the machine.

## The owner's Notion "Boop" space — his single source of truth (MANDATORY, every session)

> Owner decision 2026-11-12 (`mezo-r36n9.29`): **the Notion "Boop" space is the owner's single source of truth**
> for the product — what is being built, what is done, what is planned, how and why every feature works, every
> decision, every release. He reads only that. It applies to **every session**, not only `/boop` ones.

The space (root page id in `docs/boop-handbook/_notion-state.json`) has five parts, all in Hungarian business
language: **Jegyek** (Jira-like board of every work item), **Kézikönyv** (every section / feature / small feature:
what it does, how, why, settings, data tables, what comes next, what is left out), **Döntések**, **Kiadások**, and
**Szerverfunkciók** (the rebuild tracker: every backend feature per domain with its iPhone-app status, source
`docs/boop-handbook/_funkciok.json` — when a slice brings a server feature into the app, flip its `app` there).

**How it stays true.** Notion is written by the machine from the repo, one way: tickets from **bd** (+ Hungarian
overlay `docs/boop-handbook/_jegyek.json`, state via `allapot:<slug>` labels), everything else from
`docs/boop-handbook/` (handbook pages, `_dontesek.json`, `_kiadasok.json`), pushed with
`scripts/boop-notion-sync.mjs` through the Notion tools. Procedure: the **`boop-notion` skill**. Never hand-edit
Notion rows — edit the source, then sync (a manual edit is overwritten by the next sync).

**The rule — any session that changes the product** (iPhone/Watch app, the backend or AI it uses, its data, its
plan, its look) keeps the space true **in the same session**:
1. **Start:** `node scripts/boop-notion-sync.mjs check`. A lagging Notion is a debt you pay first (sync it before
   your own work), like a red main.
2. **Every work item is a bd issue under epic `mezo-r36n9`** with a row in `_jegyek.json` (Hungarian title,
   *mit kapsz*, your session name) — so it is on the board. Claim → *Épül*; review / waiting for deploy / waiting
   on the owner → `bd label add <id> allapot:ellenorzes|elesitesre-var|var-rad`.
3. **Owner decision** → a row in `_dontesek.json` (and, for Boop, `docs/superpowers/research/boop-standalone/14-decisions.md`).
4. **A feature added, changed or cut** → its page under `docs/boop-handbook/NN-terulet/` (format in that folder's
   README) — the handbook must describe the product as it is on `main`.
5. **Merge to main the owner can feel** → a row in `_kiadasok.json` (key = merge commit short sha).
   A server feature reaching the app (or a new backend feature) → update its row in `_funkciok.json`.
6. **Before you report:** sync (`plan` → apply → `check` exits 0) and commit `_notion-state.json` with your change.
   No Notion tools in the session → say so in the report and file a `notion-sync` bd issue under the epic; never
   skip silently.

Privacy: no personal health values in Notion, ever (examples are invented and marked „például”).

## What we build: the server and the iPhone app only (owner decision 2026-11-19, #52)

> **The web app is retired** (decision #52, 2026-11-19; frozen since #48, 2026-11-17). Only the
> iPhone app (**Boop**, `ios/`) and the server (`backend/`) are built. The old web code is
> recoverable from git history.

The retired web canon (Folyadék bible, `docs/design_2.0/prototypes/**`, the living-prototype
Artifacts and `_link-status.mjs`) is history — read it only to recover what a web screen did.

### Boop — the native iOS app (epic `mezo-r36n9`, driver skill `/boop`)

**Boop** follows the **Napkelte** canon (owner, 2026-11-10) — dark glass, a painted sky per page,
colour only in the sky and the orbs, the orb rising as the morning sun, the selected orb as a lens:
spec `docs/superpowers/specs/2026-11-10-boop-napkelte-design.md`, executable look
`docs/design_2.0/prototypes/boop-ios-spike/BoopSpike/Aura*.swift`, kit `ios/BoopKit/Sources/BoopDesign/Napkelte/`.
The companion is **Boop** (not Mezo). Visual iteration happens **in Xcode + the iOS Simulator** (a
throwaway spike, the owner's OK before it is built), never in HTML artifacts. Product spec
`docs/superpowers/specs/2026-11-11-boop-standalone-design.md`; data/backend background
`docs/superpowers/specs/2026-11-09-boop-ios-v1-design.md`; the slice map, parallel-session rules and
environment facts live in the `boop` skill.

## Owner gates for a change he will see

1. **Brainstorm → spec → owner OK.** `superpowers:brainstorming` with `brainstorm-recon`; questions
   one at a time, in Hungarian business language (§Communication). The spec lands in
   `docs/superpowers/specs/`.
2. **Simulator spike → owner OK** (Boop) — the only place for visual iteration.
3. **Plan → owner OK.** `superpowers:writing-plans`, in `docs/superpowers/plans/`, with the
   *Kész, ha…* checklist below.

After the third OK the owner does **not** want to iterate again: build → gates → review → merge →
push → deploy (backend) → install on the phone → live check → Hungarian report. Stop and ask only
if a blocker would change what he sees. A small change may fold spec + plan into one OK; an
invisible server fix skips the spike.

### *Kész, ha…* — the done-checklist (agentic loop)

Before writing code, write the checklist into the bd issue (`bd update <id> --acceptance "..."`) and
the plan; every item is checkable with evidence. It always covers:

- **What the owner sees:** each screen of the approved spike, empty / loading / error / offline
  states, smallest iPhone width, reduced motion; never emoji, never "Mezo" in a visible string.
- **Parity:** every control and data field of each touched screen still present; no behaviour
  change outside the spec.
- **Gates:** backend focused ITs + `ArchitectureTest` (`-Dmezo.test.use-testcontainers=true`) if
  the backend changed; `xcodebuild test` for BoopKit and Boop if iOS changed;
  `node scripts/gen-codemap.mjs`; `node scripts/lint-docs.mjs` 0 errors / 0 stale.
- **Docs:** `docs/features/boop-ios.md` and the touched backend feature doc; the feature-index row;
  a dated milestone entry when a slice ships; the Boop handbook page (§Notion).
- **Shipped:** merged to main, `deploy` green for that commit and the version live (backend), the
  production DB showing the expected rows when data is involved, the app installed on the phone
  and walked through.

Then loop: build → check every item → fix → re-check. Tick only with evidence
(`superpowers:verification-before-completion`); never report done with an unticked item.

## Production database access (standing permission)

You can query the live database yourself at any time — no need for the owner to remind you or
to fetch data for you. Use it to understand real data before designing, to check a bug against
reality, and to verify a deploy. Details: [`docs/infrastructure/deployment-k3s-argocd.md`](docs/infrastructure/deployment-k3s-argocd.md)
§Current deployment and [`docs/infrastructure/runbook.md`](docs/infrastructure/runbook.md) §Inspect the database.

```bash
export KUBECONFIG=~/.kube/mezo-k3s.yaml   # context `mezo`, over Tailscale
kubectl exec -n mezo postgres-0 -- psql -U mezo -d mezo -c "SELECT ..."
```

- No `-it` (non-interactive shell). pgAdmin is at `https://pgadmin.tail8ce56d.ts.net`; the app
  itself at `https://46.225.112.172.sslip.io/`.
- **Reads are free; writes are not.** `SELECT` needs no permission. Any `INSERT`/`UPDATE`/
  `DELETE`/DDL against production needs the owner's explicit OK for that specific change
  (explain it per §Communication); schema changes go through Liquibase, never by hand.
- It is the owner's real personal data: pull only what the task needs, and never copy it into
  commits, docs, prototypes or artifacts — prototypes use real-*looking* content.

## Claude-specific notes

- Superpowers process skills (brainstorming → writing-plans → executing-plans, TDD,
  verification-before-completion) drive the workflow; the `knowledge-base` skill is the
  operating manual for `docs/features/` + `docs/research/`.
- In this repo, brainstorming's step 1 ("Explore project context") means invoking the
  `brainstorm-recon` skill: it dispatches the `researcher` and `investigator` sub-agents
  in parallel and feeds the mandatory *Prior art* / *Codebase terrain* spec sections.
- The Hermes local-LLM flow mirrors this workflow via `agents/hermes/skills/`
  (see `AGENTS.md` §Hermes Agent Specifics and
  [`docs/infrastructure/local-llm-hermes-lmstudio.md`](docs/infrastructure/local-llm-hermes-lmstudio.md)).
  Slices escalated from Hermes arrive as bd comments on the driving issue.

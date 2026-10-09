# Project Instructions for AI Agents

This file provides Claude-specific instructions for this project.

> **Core house rules live in [`AGENTS.md`](AGENTS.md)** — beads, git workflow, session
> completion, non-interactive shell discipline, docs mandate, architecture, build & test,
> frontend/backend conventions. Reading it is MANDATORY at session start; everything there
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

- One bd issue + one `feat/<topic>` branch per change. Run the **local gates** for what you changed (FE tests both modes; backend focused tests — the 128 GB machine can run the full suite with `-Dmezo.test.use-testcontainers=true` when warranted) → `git pull --rebase` main → merge **locally with `--no-ff`** → `git push` main → delete the branch. **No self-PR, no waiting for CI before merge.** From a worktree: `git checkout --detach origin/main && git merge --no-ff <branch> && git push origin HEAD:main`.
- **The safety net:** `ci.yml` still runs on every push to main. Don't wait for it — but **a red main outranks everything**: fix it before any new work. Check `gh run list --branch main --limit 1` at session start.
- **Optional pre-merge cloud check** for risky changes (migrations, API contract, cross-cutting refactors): the old self-PR + `gh workflow run premerge.yml -f pr=<n>` flow remains available.
- Conventional commit subjects carrying the driving bd id: `feat(api): ... (mezo-ej0)`.

## Session Completion

**Work is NOT complete until `git push` succeeds — never leave work stranded locally.** Before ending a session:

1. File bd issues for remaining work; close/update finished ones
2. Run quality gates if code changed (backend: `./mvnw clean test`; frontend: tests in both modes + build)
3. **Refresh the off-machine tracker backup** — `.beads/issues.jsonl` is the ONLY copy of the
   tracker outside this machine (the Dolt DB is gitignored), and **nothing maintains it
   automatically**: the beads pre-commit hook leaves it byte-identical. It silently drifted 429
   records / 115 open issues behind the DB (mezo-m2au).
   ```bash
   node scripts/check-beads-backup.mjs --fix   # then commit the result
   ```
   It cannot be a CI gate — the runner has no Dolt DB — so it belongs here.
4. Push everything (if push fails, resolve and retry until it succeeds):
   ```bash
   git pull --rebase && bd dolt push && git push
   git status  # MUST show "up to date with origin"
   ```
5. Hand off: short context for the next session
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

## Design direction (MANDATORY for any UI design/mockup work)

> **Direction change, 2026-10-09 (owner decision, epic `mezo-n4wf5`, driver skill `/folyadek`):**
> the Üveg world (warm dark glass, 3D icons, Boop creatures) read playful and niche to the owner.
> The living direction is **"Folyadék"**: **light only**, a structure-first page skeleton, and
> one idea for the look — **everything is a level that fills**. The app is **mixed-look while
> the programme runs**: surfaces not yet converted still wear Üveg; that is not a licence to
> add more of it.

Every UI design, mockup and prototype MUST follow the **Folyadék** language. Canon, in order:

1. **[`docs/design_2.0/2026-10-09-folyadek-style-bible.md`](docs/design_2.0/2026-10-09-folyadek-style-bible.md)**
   — the styling reference: skeleton, tokens, liquid primitives, icons, the team, copy rules,
   traps, slice lessons.
2. **The Folyadék prototype** — the owner-approved look in executable form:
   [`docs/design_2.0/prototypes/klinikai-iranyok.html`](docs/design_2.0/prototypes/klinikai-iranyok.html)
   + `prototypes/vilagos/*.js`; state and journey in `prototypes/vilagos/HANDOFF.md`.
3. The üveg and restored-world bibles only for structural traps that survive a re-skin (scroll
   locks, sheet portals, sprite hiding) and the **ceremony pattern**
   (`docs/design_2.0/2026-09-15-ceremony-pattern.md`); their materials are superseded.

That means: every screen is title bar → the domain's pages as top tabs → one hero (a vessel
with a verdict sentence and one primary button on a waving liquid row) → 3–5 numbered white
card sections → deeper things behind rows; the bottom bar is always the five domains. Numbers
are levels (tank, vials, capsules, filled silhouettes), time series are liquid surfaces with a
target waterline, relations are communicating vessels, and a comparison always shows the days
behind its averages. Icons are the **Folyadék-jel** family (outlined glyph half-filled with the
domain liquid; NEVER emojis, never the old 3D sprite on a converted surface). The team is named
by field (Alvás, Mozgás, Étkezés, Közérzet, Mezo) and shown as glyph badges; no Boop, no
nicknames. Do NOT use progress rings (a circle is a real clock only), dark surfaces, glass
cards, or a second recipe for something the kit has. In-app work reuses the shared kit built in
slice F1 (`frontend/src/shared/ui/folyadek`); until a surface is converted it keeps the
`mozaik`/`clay` kit it has.

Any new screen still gets a clickable prototype and the owner's OK before code.

## Frontend change workflow (MANDATORY for every change the owner will see)

The owner's working rhythm (set 2026-09-23 in the Üvegesítés programme and `/csapatfal`, made the default
for all frontend work 2026-09-27, `mezo-u75pt`). Follow it without being asked:

**The three owner gates — and nothing after them.**

1. **Brainstorm → spec → owner OK.** `superpowers:brainstorming` with `brainstorm-recon`.
   Questions one at a time, in Hungarian business language (§Communication). The spec lands in
   `docs/superpowers/specs/`.
2. **Clickable prototype → owner OK.** The approved look is the build target (see *Living
   prototypes* below). Iterate here as often as the owner wants — **this is the only place for
   visual iteration.**
3. **Plan → owner OK.** `superpowers:writing-plans`, in `docs/superpowers/plans/`, with the
   *Kész, ha…* checklist (below) included.

After the third OK the owner does **not** want to iterate again. Build to match the approved
prototype exactly, then run straight through: **build → gates → merge → push → deploy → verify
live → report.** No "does this look right?" round after the build. Stop and ask only if a
blocker would change what the owner sees; then use the §Communication decision format.

Scaling: a small change may fold spec + plan into one short doc with one OK (the prototype OK
still stands on its own). A pure bug fix with no visible change skips the prototype. When in
doubt, prototype.

**Prototype rules** (the full recipe is [`docs/design_2.0/prototype-recipe.md`](docs/design_2.0/prototype-recipe.md)):
- Realistic: built on the app's real chrome (title bar with the top tabs, the five-drop bottom bar, copied from
  the Folyadék prototype's frame), real-looking Hungarian content of the real record types (read the page
  components; never invent features), clickable with a hash router, sheets and back buttons.
- **Custom icons, always.** Every icon on the screen maps to the Folyadék-jel sprite; where
  nothing fits, draw a new one in the Folyadék bible §5 recipe — never an emoji, never a near-miss
  glyph. New icons go on an **"Új ikonok"** sheet in the prototype for the owner's OK; after the
  OK they go into the shared sprite.
- Verify it yourself before handing it over: serve over HTTP
  (`python3 -m http.server <port> --bind 127.0.0.1`, background; `file://` renders
  script-less), click every route in the in-app browser, console clean, `?v=N` cache-bust,
  320px width, the reduced-motion branch.
- Hand-off in Hungarian: the link, what to click, what changed in everyday words, 1–2 genuine
  questions. Then **stop and wait**.

### Living prototypes — one per domain, never rebuilt from zero

> **During the Folyadék programme (2026-10-09 →):** the living prototype of **every** domain is
> the Folyadék prototype — `docs/design_2.0/prototypes/klinikai-iranyok.html` +
> `vilagos/<domain>.js`, one fixed Artifact for all five domains
> (https://claude.ai/artifact/Ax6faqjyEd6Xxw2J7MN45M, routes `#w-<domain>-<route>`). A frontend
> change edits **that** domain file. The `elo/<domain>.html` files below are frozen snapshots of
> the Üveg look: parity sources for what a screen must do, retired in slice F9. A change to a
> surface that is not converted yet still updates the Folyadék prototype (the build target),
> and ships in the look the surface currently has.

Each bottom-menu domain has **one living prototype** that always shows that domain as it is
now (all four tabs, their sheets), in the approved Üveg look:

| Domain | File | Seed it from (first use only) |
|---|---|---|
| Nap | `docs/design_2.0/prototypes/elo/nap.html` | `uveg-nap.html`, `uveg-napod.html` |
| Edzés | `docs/design_2.0/prototypes/elo/edzes.html` | `uveg-edzes.html`, `uveg-edzes2.html` |
| Fuel | `docs/design_2.0/prototypes/elo/fuel.html` | `fuel-uveg.html`, `uveg-fuel-tobbi.html` |
| Mezo | `docs/design_2.0/prototypes/elo/mezo.html` | `uveg-mezo-teljes.html` |
| Én | `docs/design_2.0/prototypes/elo/en.html` | `uveg-en.html`, `uveg-en2.html` |

- A frontend change **edits the living prototype of its domain** (a new hash route, or the
  changed page in place) instead of starting a new file. A change spanning domains edits each.
  The first time a domain is touched, seed its file from the listed sources, matched against
  the live screens, and commit that seed before the change itself.
- **Only what is really new is marked new.** Each living prototype has one "Legutóbb változott"
  block at the top of its side panel; every change rewrites it (date, title, one sentence, links
  to the changed routes). Nothing else in the panel says "új". New routes go into their tab's
  group. The frame itself is shared (`_panel-kit.html` + `_inject-panel-kit.mjs`); see the recipe.
- **Publish it as an Artifact** (`Artifact` tool, `artifact-design` loaded first) and keep
  **one fixed URL per domain**, recorded in
  [`docs/design_2.0/prototypes/elo/README.md`](docs/design_2.0/prototypes/elo/README.md).
  Later sessions republish to that URL (`read` it first, then publish with `url`), so the owner
  always opens the same link. The in-app browser cannot open artifact URLs — verify over the
  local HTTP server, publish for the owner.
- **A lagging link is a debt the next session pays first** (owner, 2026-10-07). At session start
  run `node docs/design_2.0/prototypes/elo/_link-status.mjs` and
  `bd list --label publish-debt --status open`; publish what lags and close the debt before your
  own work. After changing a prototype: `--stamp <domain>` (the "Állapot" date on the page) →
  commit → publish → `--published <domain>` → commit. If you cannot publish, file a
  `publish-debt` issue. Full rule: `docs/design_2.0/prototypes/elo/README.md`.
- After the change ships, the living prototype must match production. If the build had to
  deviate, update the prototype in the same merge.

### *Kész, ha…* — the done-checklist (agentic loop)

Before writing code, write the checklist the work must satisfy into the bd issue
(`bd update <id> --acceptance "..."`) and into the plan. Derive it from the spec and the
approved prototype; every item is checkable with evidence. It always covers:

- **What the owner sees:** each route/screen/sheet of the prototype, matching it; every new
  icon from the sprite; empty / loading / error states; 320px; reduced motion.
- **Parity:** every control, state and data field of each touched screen still present
  (reverse parity list), no behaviour change outside the spec.
- **Gates:** FE tests in both modes (`CI=true`, mock + `VITE_USE_MOCK=false`), affected
  `frontend/tests/layout` specs, `pnpm build`; backend focused tests if backend changed;
  `node scripts/gen-codemap.mjs`; `node scripts/lint-docs.mjs` 0 errors / 0 stale.
- **Docs (no lint catches these — they drifted three weeks once, `mezo-iwmsw`):** the feature's
  `docs/features/*.md` updated; its row in the **feature index** (`docs/features/README.md` §2–§3:
  status + route) true; a dated entry in the **milestone log** (`docs/milestones/roadmap.md`) when
  an epic or a user-visible feature ships, and the *Epics in flight* table moved with it.
- **Shipped:** merged to main, `deploy` workflow green for that commit, the new version live on
  the production URL (checked in the browser), and — when data is involved — the production DB
  shows the expected rows (see §Production database access).
- **Living prototype** in sync and republished.

Then loop: build → check every item → fix what fails → re-check. Tick an item only with
evidence (command output, screenshot, query result — `superpowers:verification-before-completion`).
**Never report done with an unticked item**; if one cannot be met, say so plainly in the report.
The final Hungarian report to the owner walks the checklist in everyday words.

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

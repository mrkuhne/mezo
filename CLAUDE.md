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

- One bd issue + one `feat/<topic>` branch per change. Flow: `git push` the branch → open a **self-PR** → wait for **CI green** → merge **locally with `--no-ff`** → `git push` main (the PR auto-closes when its commits land on main) → delete the branch. Single dev, but the PR exists purely as the **CI trigger + pre-merge green light**, not for review.
- **Why the self-PR (the CI gate):** the 16 GB dev machine can't run the heavy backend integration suite locally (SpringBoot + Testcontainers OOM-dies under swap thrash). CI (`ci.yml`: full backend IT suite + FE both modes + lint + contract-drift, on a clean `ubuntu-latest`) is the **authoritative full-suite gate**; locally run only the **focused** tests for what you changed. Details + local recipes: [`docs/infrastructure/local-dev-testing.md`](docs/infrastructure/local-dev-testing.md).
- Conventional commit subjects carrying the driving bd id: `feat(api): ... (mezo-ej0)`.
- **Before merging, re-check the merge result against the CURRENT main:** `gh workflow run premerge.yml -f pr=<number>` (~7 min). The PR's own green tick can predate the base it will actually merge into — GitHub recomputes `refs/pull/<n>/merge` when main moves but does **not** re-run the workflow, so a green PR can land red on main and block every other open PR (mezo-mxrc, mezo-l4am). `premerge.yml` re-runs only what a merge can actually break — the convention/generator gates, contract-drift and the visual goldens — instead of the full ~21.5-minute `ci.yml`. It also fails loudly in the two other states that LOOK like "nothing failed": when the PR conflicts with main (GitHub then silently runs **no** checks at all), and when the head simply has no successful run for every `ci.yml` job — zero checks, a job that never started, or one still in progress (`require-checks.sh`, mezo-x57b).
- `git pull --rebase` on main **before** merging the feature branch — rebasing *after* the merge flattens the `--no-ff` merge commit; push directly after merging.

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

Every UI design, mockup, and prototype MUST follow the **design 2.0 / "Mozaik 2.0"** visual
language (`docs/design_2.0/` — handoff doc + `prototypes/`): the living, breathing, colorful
Huawei-Health-inspired direction. That means: tile mosaic with domain-color washes,
poster-anatomy cards (eyebrow + spot graphic + one big numeral), data drawn as graphics
(rings, gauges, sparklines), clay 3D SVG icons (NEVER emojis), two-layer colored shadows,
one-shot entrance choreography, tile → full-page Huawei slide-in pattern. Do NOT produce
flat/minimal/list-style designs. Start from the existing prototypes in
`docs/design_2.0/prototypes/` and the shared `mozaik`/`clay` UI kit
(`frontend/src/shared/ui/mozaik`, `frontend/src/shared/ui/clay`) rather than inventing a look.

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

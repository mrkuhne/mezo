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

> **Direction reversal, 2026-09-17 (owner decision, epic `mezo-ju4j6`):** the design 2.0
> **"Titanium"** skin (dark liquid metal, ~2026-09-09 → 2026-09-17) is **REJECTED**. The living
> visual direction is the **restored pre-Titanium design 2.0 world — Mozaik 2.0 / Clay**.
> Titanium docs and prototypes are **history and parity sources only**: cite them to check that
> no *feature* is lost, never to copy a *look*. Functionality shipped during the Titanium period
> is kept in full; only the skin is rolled back (forward-fix, never revert).

Every UI design, mockup, and prototype MUST follow the **restored Mozaik 2.0 / Clay** visual
language. Orient via the index **[`docs/design_2.0/README.md`](docs/design_2.0/README.md)**
(living vs superseded docs). Canon, in order:

1. **[`docs/design_2.0/2026-09-17-restored-world-style-bible.md`](docs/design_2.0/2026-09-17-restored-world-style-bible.md)**
   — the single styling reference for all re-dress and new UI work: ground tokens, palette &
   materials per domain, card anatomy, data-as-graphics, ceremony material, the clay icon recipe,
   and the old-world treatment of GlassBox / BodyMap / the in-workout list / the docked TabBar.
2. The **ceremony (reward screen) pattern** (`docs/design_2.0/2026-09-15-ceremony-pattern.md`) —
   the *pattern* (triggers, anatomy, motion, copy rules) stays canon; its Titanium skin does not,
   celebratory surfaces return to polished-stone/gold material.
3. The Mozaik-era prototypes in `docs/design_2.0/prototypes/` (the `*-tab.html`, `*-mely.html`
   and flow pages) — **not** `prototypes/companion-titanium/`.

That means: Mozaik tile language — washed two-column tiles with domain-color washes, poster-style
card anatomy (eyebrow + spot graphic + one big numeral), data drawn as graphics (rings, gauges,
sparklines, story-curves), **clay 3D SVG icons** (NEVER emojis), polished-stone (gold "Ritmus")
materials for celebratory surfaces, one-shot rAF-driven choreography with a reduced-motion branch,
tile → full-page slide-in pattern. Do NOT produce flat/minimal/list-style designs, and do **NOT**
start new visual work from the Titanium docs/prototypes marked superseded in the index. In-app work
reuses the shared `mozaik`/`clay` UI kit (`frontend/src/shared/ui/mozaik`,
`frontend/src/shared/ui/clay`) rather than inventing a look.

While the rollback epic `mezo-ju4j6` is in flight the app is deliberately mixed-look: some screens
still wear Titanium. That is **not** a licence to add more of it — re-dress what you touch per the
style bible, and run re-dress work through `/visszaoltoztetes`.

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

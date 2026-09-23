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

> **Direction change, 2026-09-23 (owner decision, epic `mezo-me75u`, skill `/uvegesites`):**
> the restored Mozaik/Clay world read flat to the owner. The living direction is now **"Üveg"**:
> the **Mozaik colors** (`--dv-*`, `--macro-*`) on the app's **warm-graphite dark** ground,
> wearing the **Titanium material**: the 3D icon sprite, glass cards with a colored gradient
> frame, the periodic light sweep and a soft color glow. **Dark only**; light mode is parked,
> not deleted. **The header keeps its content and wears glass** (the "boop" wordmark, ?,
> settings, messages, notifications, the filling day orb; no day-part switcher). **The bottom
> menu is unchanged:** it stays the live docked bar with the living Boop, in its dark set. See
> bible §7.

Every UI design, mockup, and prototype MUST follow the **Üveg** language. Canon, in order:

1. **[`docs/design_2.0/2026-09-23-uveg-style-bible.md`](docs/design_2.0/2026-09-23-uveg-style-bible.md)**
   is the styling reference: ground, palette, the `.glass` recipe, icons, data graphics, motion,
   what stays untouched, and the slice-lesson appendix.
2. **[`docs/design_2.0/prototypes/fuel-uveg.html`](docs/design_2.0/prototypes/fuel-uveg.html)**
   (Sötét) is the owner-approved look in executable form.
3. **[`docs/design_2.0/2026-09-17-restored-world-style-bible.md`](docs/design_2.0/2026-09-17-restored-world-style-bible.md)**
   stays canon for everything the üveg bible does not override: card anatomy, **§3.4 ranking**
   (not everything is glass), data graphics, and the Appendix A–E traps.
4. The **ceremony pattern** (`docs/design_2.0/2026-09-15-ceremony-pattern.md`): the *pattern*
   is canon, and its material is glass with a gold glow.

That means: glass cards (one accent per card via `--c`), frameless radial halos for heroes,
big numerals, rings and bars with an accent glow, **Titanium 3D sprite icons** (NEVER emojis),
a blurred color aurora behind the content, and one-shot rAF-driven choreography with a
reduced-motion branch. Do NOT use cold Titanium graphite or neon nav accents, and do NOT put
glass inside glass. In-app work reuses the shared `mozaik`/`clay` UI kit
(`frontend/src/shared/ui/mozaik`, `frontend/src/shared/ui/clay`), extended in slice U1, rather
than inventing a look.

While `mezo-me75u` is in flight the app is deliberately mixed-look. Re-dress what you touch per
the üveg bible, and run the programme's work through `/uvegesites` (one slice per fresh session:
prototype → owner OK → build → merge → deploy).

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

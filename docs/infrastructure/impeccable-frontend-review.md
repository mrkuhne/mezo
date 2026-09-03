# Impeccable — frontend review playbook

> **Driver:** mezo-c0tb · **Tool:** [impeccable](https://impeccable.style) (Apache-2.0, Paul Bakaus) —
> a design skill + deterministic UI-antipattern detector for AI coding agents.
> **Scope:** how to review and refine the mezo frontend with it *without* flattening
> the Mozaik 2.0 design language.

---

## 1. What the tool is

Two independent halves. Keep them apart in your head — they fail in different ways.

| Half | What it is | Cost | Trust level |
|---|---|---|---|
| **Detector** | 61 regex/AST rules over CSS/TSX. No LLM, no API call. `npx impeccable detect <path>` | free, ~seconds | Deterministic but **context-blind** — it flags patterns, not mistakes. Every finding needs a human verdict. |
| **Skill** | One Claude Code skill routing 23 commands (`/impeccable <command> <target>`), each a design-review prompt with a checklist | LLM tokens | Opinionated design coaching. Its default taste is *restrained/editorial*, ours is not (see §4). |

The skill descends from Anthropic's `frontend-design` skill, extended with product
context files (`PRODUCT.md` / `DESIGN.md`), a bigger command vocabulary and the detector.

## 2. What is installed here, and what is not committed

Installed into this repo's `.claude/` by `npx impeccable install` (Node ≥ 22.12):

- `.claude/skills/impeccable/` — SKILL.md + 23 `reference/*.md` command playbooks + `scripts/` (detector, live mode, hooks). ~5 MB, 164 files.
- `.claude/agents/impeccable-*.md` — 4 helper subagents (documenter, finish-reviewer, asset-producer, manual-edit-applier).
- Hooks appended to `.claude/settings.local.json`: a fast detector tier on `PostToolUse(Edit|Write)` and a full pass on `Stop`.

**None of it is committed.** `.gitignore` excludes the vendored payload, the generated
agents, `.impeccable/config.local.json` and `.impeccable/live/`. Only this doc and the
(future) shared `.impeccable/config.json` live in git.

```bash
npx impeccable install     # per machine, and per fresh worktree (settings.local.json is worktree-local!)
```

```bash
npx impeccable update      # refresh the vendored skill
```

**Worktree trap:** the hooks live in `.claude/settings.local.json`, which every worktree
owns separately. A new worktree has the skill (if `.claude/skills` is shared — it is not,
each worktree is a full checkout) neither vendored nor hooked. Re-run `install` there, or
just use the CLI detector, which needs no install (`npx impeccable detect …`).

## 3. Baseline: what the detector says about our frontend today

`npx impeccable detect frontend/src` — **80 findings, 2026-09-03**, exit code 2:

| Rule | Hits | Where | Our verdict |
|---|---|---|---|
| `bounce-easing` | 39 | mostly `styles/prototype.css` | **Mostly intentional.** Mozaik 2.0's one-shot entrance choreography is spring-flavoured on purpose. Review case by case: overshoot on *entrances* stays, overshoot on *hover/press feedback* is genuinely dated. |
| `side-tab` | 15 | `character.css`, `prototype.css`, `ExerciseAccordionRow`, `MuscleWeekSheet`, `RecipeDetailPage` | **Worth a real look.** The 3–5px domain-colour left rail is our family-colour signal, but the detector is right that it is the single most recognisable AI-UI tell. Ask per surface: is the rail carrying information the wash/eyebrow doesn't already carry? |
| `overused-font` | 15 | `styles/fonts.css`, `prototype.css` | **Rejected.** Fraunces + Geist are deliberate Mozaik 2.0 brand faces, chosen in `docs/design_2.0/`. Not a finding for us — mute it (§4). |
| `layout-transition` | 11 | progress bars / rails | **Mostly real.** `transition: width` on bars does thrash layout; `transform: scaleX()` is the fix where the bar is a solid fill. Skip where the fill is a gradient that must not stretch. |

Re-run the baseline before you claim a surface improved. Exit codes: `0` clean, `2` findings, `1` error.

## 4. Reconciling with Mozaik 2.0 — read this before running any command

Impeccable's built-in taste is **quiet, editorial, restrained**. `docs/design_2.0/` mandates the
opposite: living, breathing, colourful, Huawei-Health-inspired — tile mosaic with domain-colour
washes, poster-anatomy cards, big numerals, rings/gauges/sparklines, clay 3D SVG icons,
two-layer coloured shadows, one-shot entrance choreography.

Consequences, non-negotiable:

- **Never run `/impeccable quieter` or `/impeccable distill` on a whole screen.** Both are
  desaturate-and-flatten passes ("reduce saturation to 70–85%", "remove gradients, shadows,
  glows", "flatten visual hierarchy"). Applied broadly they delete the design language. Use them
  **scoped to one over-loud element** ("the streak tile's badge stack"), never `frontend/src`.
- **`bolder` / `colorize` / `delight` / `overdrive` are the aligned ones.** They push in the
  direction the handoff already asks for. Still review the diff — `overdrive` will happily add
  shaders.
- **Always give the command our context.** Every command reads `PRODUCT.md` / `DESIGN.md` if
  present. Until those exist (§7), say it in the prompt: *"follow docs/design_2.0/ — Mozaik 2.0,
  colourful tile mosaic, clay icons, never emojis, never flat/minimal/list-style."*
- **Emojis are banned here.** Clay 3D SVG icons only (`frontend/src/shared/ui/clay`). Impeccable
  won't enforce that; you must.

Mute the rules we have consciously rejected, with a reason, in the **shared** config
(`.impeccable/config.json`, committed):

```bash
npx impeccable ignores add-value overused-font Fraunces --reason "Mozaik 2.0 brand serif (docs/design_2.0)"
```

```bash
npx impeccable ignores add-value overused-font Geist --reason "Mozaik 2.0 brand sans/mono (docs/design_2.0)"
```

Do **not** blanket-mute `side-tab` or `bounce-easing` — those deserve a per-surface decision.
`npx impeccable ignores list` shows the merged set.

## 5. The review loop

One surface at a time. "Surface" = a screen or a sheet, e.g. Today, Heti, Karakter, Fuel
Recipe Detail, Active Workout. Not `frontend/src`.

**Step 0 — scope + baseline.** Pick the surface, find its files via
[`docs/CODEMAP.md`](../CODEMAP.md), and record the starting numbers:

```bash
npx impeccable detect frontend/src/features/<surface>
```

**Step 1 — deterministic sweep.** Fix only the findings you agree with. For each one you
reject, either leave it (and note why in the PR) or add a scoped ignore with `--reason`.
Do not fix a finding you don't understand; the detector has no idea what the code means.

**Step 2 — UX read.** `/impeccable critique <surface>` — scored evaluation of hierarchy, IA,
cognitive load, persona walkthroughs. This is the *diagnostic* step: it tells you which
refinement command the surface actually needs. Don't skip to a refinement command on a hunch.

**Step 3 — one refinement command, scoped.** Pick from the critique's verdict:

| Symptom | Command |
|---|---|
| Type hierarchy mushy, sizes arbitrary | `typeset` |
| Spacing/rhythm/alignment off, tiles don't sit on a grid | `layout` |
| Bland, safe, under-designed for Mozaik 2.0 | `bolder`, `colorize` |
| One element screaming over everything else | `quieter` (**scoped to that element**) |
| Too many competing elements, unclear job | `distill` (**scoped**) |
| Static, no life; entrance choreography missing | `animate`, `delight` |
| Breaks on long Hungarian strings / empty data / errors | `harden` |
| Mobile/tablet/viewport problems | `adapt` |
| Confusing labels, error copy, microcopy | `clarify` |
| Slow render, jank, heavy bundle | `optimize` |
| First-run / empty states | `onboard` |
| Technically ambitious hero moment | `overdrive` |

**Step 4 — technical audit.** `/impeccable audit <surface>` — a11y, performance, theming,
responsive, anti-patterns, with P0–P3 severities. Treat P0/P1 as blocking, P2/P3 as bd issues.

**Step 5 — polish.** `/impeccable polish <surface>` — final alignment/spacing/consistency pass.
Explicitly the "preserve the existing design system" command; safe to run last on any surface.

**Step 6 — verify like any other frontend change.** Impeccable proves nothing on its own:

- `/verify` (repo skill) — build, launch, drive the mock-mode PWA and *look at it*.
- `pnpm test` in both modes — remember bare `pnpm test` is mock-only; run the real-mode gate explicitly.
- `pnpm test:visual` — Playwright snapshots will catch what the eye misses (and will need
  `--update-snapshots` for intended changes; review the diffs, that's the actual design review).
- Re-run the Step 0 detector command and compare.

**Step 7 — ship it the house way.** bd issue → `feat/<topic>` branch → push → self-PR → CI green
→ local `--no-ff` merge. A design refactor with no test-visible behaviour change still goes
through the gate.

## 6. Live mode (optional, highest-leverage for visual work)

`/impeccable live` hot-swaps AI-generated HTML+CSS variants into a *running* app so you pick
by eye instead of by diff. Our stack is a plain Vite SPA, so the setup is the baseline one —
create `.impeccable/live/config.json` (gitignored, per machine):

```json
{ "files": ["frontend/index.html"], "insertBefore": "</body>", "commentSyntax": "html", "cspChecked": true }
```

Run the dev server in **mock mode** (`VITE_USE_MOCK=true pnpm dev` from `frontend/`) so variants
render against deterministic data. Live mode injects a dev-only script into `index.html`; it
removes itself on stop, and `.impeccable/live/inject-journal.json` heals a crashed session — but
check `git status` on `frontend/index.html` before committing after a live session.

## 7. Optional: teach it our design system once

`/impeccable init` runs a discovery interview and writes `PRODUCT.md` + `DESIGN.md`, which every
other command then reads. `/impeccable document` generates `DESIGN.md` alone by extracting colours,
type, spacing and radii from the code.

Worth doing **once**, because it is the mechanism that stops the tool defaulting to its own quiet
taste. Seed it from `docs/design_2.0/` rather than letting it infer from `prototype.css`, and
review the result hard — a `DESIGN.md` that misdescribes Mozaik 2.0 makes every later command
worse. File it as its own bd issue; do not let an `init` interview hijack a review session.

## 8. Guardrails

- **The detector is advisory, not a gate.** Do not wire `npx impeccable detect` into `ci.yml`
  at exit-code-2-fails until the baseline is triaged to zero — otherwise every PR goes red on
  39 intentional easing curves.
- **`prototype.css` is a 9000-line shared surface.** Never point a refinement command at it
  wholesale; a single command run can rewrite unrelated screens. Scope to selectors.
- **Review every diff.** These commands edit code. The `Stop` hook runs a full detector pass
  automatically — that is a *report*, not permission to have changed anything.
- **Hungarian copy.** `clarify` will happily rewrite our UI copy into English. Tell it the
  product language is Hungarian, or don't run it on copy.

## 9. Suggested first pass over the app

Ordered by expected payoff, one bd issue each:

1. **Progress bars / rails** — `layout-transition` (11 hits) is a real perf finding with a
   mechanical fix, and it spans Today/Heti/Karakter at once.
2. **Karakter** — highest `side-tab` + font density; good place to settle the left-rail question
   once and propagate the answer.
3. **Fuel Recipe Detail** and **Active Workout** — the two densest information surfaces;
   `critique` → `layout`/`harden` will find the most.
4. **Today** — the flagship mosaic: `critique` → `bolder`/`delight`, never `quieter` wholesale.

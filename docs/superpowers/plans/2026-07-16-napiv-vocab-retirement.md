# Napív Vocabulary Retirement Implementation Plan (mezo-x3x0 + mezo-23uf)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retire the last pre-Napív vocabulary from the frontend: the inert/radius-bearing `notch-*` class tokens (396 occurrences), every `var(--brand-*)` reference (215 + tests) so the brand alias layer itself can be deleted, and the 136 inline `--ff-mono` JSX usages that today render an ugly system-mono fallback (spec §3.2: JetBrains Mono is retired; numbers use tabular-nums) — plus the mezo-23uf primitive decision, executed.

**Architecture:** Mechanical, visually-controlled sweeps on top of the S8 foundation. Brand refs substitute their exact alias target (visually neutral by construction — the aliases at `prototype.css:12-26` define the mapping); notch tokens split by companion class (paired with `card` → drop, radius unifies to the spec's 20px; paired with a pill primitive → drop, already inert; bare → swap to new `.rad-12/-16` no-op utilities); ff-mono inline styles migrate to inherited Jakarta + `tabular-nums` on numeric content (a REAL visual change everywhere — heavy visual QA + full baseline regen at the end). **mezo-23uf decision (bound here):** the re-skinned CSS classes (`.eyebrow`, `.label-mono`, `.h-display`, `.page-title`, `.chip`, `.cta-*`) ARE the permanent Napív idiom under their historical names — renaming would churn 100+ files for zero user value; the live wrapper components (Eyebrow/Display/PageTitle/Chip/Cta/StatCell/ScoreRing/ToolChip/RefTag) stay; the DEAD components (`NotchCard.tsx`, `LabelMono.tsx` — zero importers) are deleted; `--ff-mono` survives as a debug-surface token (`.toolchip`/`.reftag` keep mono deliberately, spec §3.6). The `brand` word survives only as the `.eyebrow.brand`/`.chip.brand` accent/selected-state class names (documented) — the teal-era brand TOKENS die.

**Tech Stack:** React 19, plain CSS in `frontend/src/styles/prototype.css`, Vitest + RTL both modes, Playwright visual baselines (`pnpm test:visual`). Branch `feat/napiv-vocab-retirement` (from v0.86.0 main) in worktree `.worktrees/frontend-design-rethink`. bd: **mezo-x3x0** (sweeps) + **mezo-23uf** (primitive decision).

## Global Constraints

- Worktree `/Users/daniel.kuhne/MrKuhne/mezo/.worktrees/frontend-design-rethink`, branch `feat/napiv-vocab-retirement`. Verify `git rev-parse --abbrev-ref HEAD` before every commit; NEVER touch the main checkout; NEVER `git stash`; **NEVER run `bd` commands** (controller-only; bd from a worktree corrupts state).
- Commit with hooks disabled: `git -c core.hooksPath=/dev/null commit -m "... (mezo-x3x0)"`. Explicit paths only; `git show --stat HEAD` after every commit; strip stray `issues.jsonl`.
- Gate after EVERY task: `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test` (both modes). Visual baselines (`pnpm test:visual`) are checked ONLY at the designated tasks (T2, T5) — mid-sweep radius/font changes are EXPECTED to move goldens; never `--update-snapshots` outside those tasks.
- **Brand substitution table (binding, from `prototype.css:12-26` — substitute the alias target verbatim, zero visual change):** `--brand-deep`→`--coral-deep` · `--brand-core`→`--coral-deep` · `--brand-primary`→`--coral` · `--brand-glow`→`--coral` · `--brand-tint`→`--wash-gym` · `--border-brand`→`--line`. Domain-accent corrections (e.g. a fuel surface arguably wanting sage instead of coral) are OUT of scope — file-map notes only; this sweep is visually neutral by contract.
- **Notch rules (binding):** R1 same-className contains `card` → drop the token (radius unifies to `.card`'s 20px — intended, spec §3.3). R2 companion is a pill primitive (`chip`, `cta-primary`, `cta-ghost`, `toolchip`) → drop the token (pill radius already wins the cascade). R3 bare token (no radius-bearing companion) → swap to the matching no-op utility: `notch-4`→`rad-12`, `notch-8`→`rad-16`, `notch-12`→`rad-20`, `notch-16`→`rad-24` (utilities defined in T1). R4 the `.notch-*` CSS rules are deleted only in T5, after the JSX count reaches zero.
- **ff-mono rules (binding):** inline `fontFamily: 'var(--ff-mono)'` (or `"var(--ff-mono)"`) in JSX → DELETE the fontFamily property (Jakarta inherits); if the element's content is primarily numeric/tabular (numbers, times, counts, kg/g values), ADD `fontVariantNumeric: 'tabular-nums'`; keep every other style prop (uppercase/letterSpacing/size) untouched. Debug/tool surfaces keep mono: `.toolchip`, `.reftag` CSS untouched; any JSX site that is a tool/ref/debug chip look-alike stays mono — judge + disclose per site. CSS rules in prototype.css using `--ff-mono` outside `.toolchip`/`.reftag`: migrate to `var(--ff-body)` with weight/tracking preserved (audit lists them in T4; known: `.pagerbar .k`).
- Hungarian copy untouched. No functionality/handler changes anywhere — these are style-vocabulary sweeps.
- jsdom hazard: presence-only assertions for `.np-anim`; tests pinning swept tokens update to the new reality (each edit listed + justified).
- Docs: living-doc touches ride along in the same task that invalidates them; `node scripts/lint-docs.mjs` PASS at T6.

---

### Task 1: Dead primitives + central token emission stop + rad utilities

**Files:**
- Delete: `frontend/src/shared/ui/NotchCard.tsx`, `frontend/src/shared/ui/LabelMono.tsx` (+ colocated tests if any) — grep-verify zero importers first (`from '@/shared/ui/NotchCard'`, `from '@/shared/ui/LabelMono'`).
- Modify: `frontend/src/shared/ui/Chip.tsx` (drop the emitted `'notch-4'` token), `frontend/src/shared/ui/Cta.tsx` (drop `'notch-8'` from CtaPrimary + `'notch-4'`/whatever CtaGhost emits — read the file), `frontend/src/shared/ui/ToolChip.tsx:9` (drop `'notch-4'`).
- Modify: `frontend/src/styles/prototype.css` — add after the `.notch-*` block: `.rad-12 { border-radius: 12px; } .rad-16 { border-radius: 16px; } .rad-20 { border-radius: 20px; } .rad-24 { border-radius: 24px; }` with a one-line comment (Napív inset radii — successors of the retired notch-* tokens for non-card elements).
- Tests: `shared/ui/*.test.tsx` pinning `notch` in Chip/Cta/ToolChip output → update assertions (the class list shrinks; keep the behavioral assertions).

**Interfaces:** Produces: pill primitives emit no notch tokens; `rad-*` utilities exist for T2/T3. Chip/Cta/ToolChip signatures unchanged.

- [ ] Grep-verify orphans → delete → central emission drops → CSS utilities → run `pnpm vitest run src/shared/ui` → full gate → commit `refactor(fe): drop notch emission from pill primitives, delete dead NotchCard/LabelMono, add rad-* utilities (mezo-x3x0, mezo-23uf)`.

### Task 2: Notch JSX sweep — Train + Fuel

**Files:** every `*.tsx` under `frontend/src/features/train/` and `frontend/src/features/fuel/` containing `notch-` (~22+17+12+11+10+9 files per the dir counts; enumerate with grep at start). Colocated tests pinning notch in these domains.

**Interfaces:** Consumes T1's rules + `rad-*` utilities. Produces: zero `notch-` matches under `features/train/` + `features/fuel/` (reviewer grep).

- [ ] Apply R1/R2/R3 site-by-site (the companion-class decides; when a className is built with `cn(...)`, the same rules apply per token argument). Keep a per-site tally (R1/R2/R3 counts) in the report. → focused domain tests → full gate → run `pnpm test:visual` WITHOUT updating: expect train/fuel goldens to shift ONLY where R1 changed a 12/16/24px card to 20px — list which of the 28 goldens fail and why; do NOT regenerate (T5 does). → commit `refactor(fe/train,fuel): retire notch-* tokens per R1-R3 (mezo-x3x0)`.

### Task 3: Notch JSX sweep — Me + Today + shared remnants + tests

**Files:** every remaining `notch-` site: `features/me/`, `features/today/`, any residue in `features/insights/`, `shared/ui/` (non-primitive leftovers), `app/`; the 9 test-file notch references repo-wide.

**Interfaces:** Produces: zero `notch-` matches under `frontend/src/**/*.tsx` (including tests). The `.notch-*` CSS rules still exist (T5 deletes).

- [ ] Same R1/R2/R3 recipe + test-assertion updates (each listed) → full gate → commit `refactor(fe/me,today): retire notch-* tokens per R1-R3, test pins updated (mezo-x3x0)`.

### Task 4: Brand-token sweep + alias layer deletion

**Files:**
- Modify: every `var(--brand-*)`/`var(--border-brand)` site under `frontend/src` (215 non-test + 8 test refs; enumerate by grep) — the binding substitution table; includes `data/fuel/*` and `data/*` hits. `features/train/pages/MesocyclePlannerPage.tsx:31-32` `BRAND_TINT`/`BRAND_TINT_STRONG` consts → rename `CORAL_TINT`/`CORAL_TINT_STRONG` with the substituted token inside.
- Modify: `frontend/src/styles/prototype.css` — after the JSX sweep reaches zero: delete the 5 `--brand-*` alias lines + `--border-brand` alias (L12-26 region) AND every remaining `var(--brand-*)`/`var(--border-brand)` inside CSS rules (grep the file; substitute the same table). Keep `--cat-*`/`--info`/`--success`/`--warning`/`--tool-*`/`--reta-*` aliases — they are live semantic tokens (Insights categories, semantic states), NOT in scope.
- Modify: `frontend/src/index.css` — delete the `--color-brand-{deep,core,primary,glow,tint}` Tailwind bridge entries (grep first for `text-brand`/`bg-brand`/`border-brand` Tailwind-class usages in JSX — if any exist, substitute them with the coral equivalents first and list them).
- Modify: `frontend/src/styles/tokens.test.tsx` — refresh the self-injected fixture: drop `--brand-glow` from both injected blocks (or swap to `--coral`), update dark fixture hexes `#0A0F14`/`#121A22` → the Pulse `#191614`/`#221E1B` (the final-review nit), keep the mechanism assertions.
- Modify: `frontend/src/styles/prototype.css` — delete the three dead sage dark overrides (`:root[data-theme="dark"]` rules for `.beat.done`, `.dayrow .done-chip`, `.setdots .sd.don` whose `rgba(127,164,138,.16)` equals dark `--wash-sage` — S8 final-review accepted nit).

**Interfaces:** Produces: `grep -rn "brand" frontend/src --include="*.ts" --include="*.tsx" --include="*.css" | grep -v "\.eyebrow.brand\|chip.*brand\|'brand'\|\"brand\"" `-style contract — concretely: zero `var(--brand` and zero `--brand-` DECLARATIONS anywhere; the only surviving "brand" occurrences are the `.eyebrow.brand`/`.chip.brand` class selectors + their JSX class/prop usages (Eyebrow's `brand` prop, `chip brand` classNames, `cn(..., 'brand')` toggles). Reviewer verifies with `grep -rn "\-\-brand" frontend/src` → EMPTY.

- [ ] JSX/data sweep (visually neutral by the table) → CSS rules + alias deletion + bridge cleanup + tokens.test + dead overrides → full gate → `pnpm test:visual` must be GREEN untouched (this task changes no pixels — a failing golden here is a substitution error, fix it) → commit `refactor(fe): brand token vocabulary retired — alias-target substitution + alias layer deletion (mezo-x3x0)`.

### Task 5: ff-mono retirement + baseline regen + visual QA

**Files:**
- Modify: all ~136 inline `var(--ff-mono)` JSX sites (enumerate by grep; includes `shared/ui/StatCell.tsx`) per the binding ff-mono rules; disclose kept-mono sites.
- Modify: `frontend/src/styles/prototype.css` — CSS rules using `--ff-mono` outside `.toolchip`/`.reftag`: audit + migrate (known: `.pagerbar .k` → `font-family: var(--ff-body); font-weight: 800;` keep size/tracking/uppercase). The `--ff-mono` token definition STAYS (debug surfaces). ALSO: delete the five `.notch-*` rules (R4 — T3 brought the JSX count to zero; grep `notch` under frontend/src must be empty after this except the rad-* comment).
- Modify: any test pinning a fontFamily style (list + justify).
- Regen: `pnpm test:visual:update` (fonts change → most goldens shift; this is the intended final look) → `pnpm test:visual` green twice.
- Docs ride-along: `docs/features/_platform-design-system.md` typography § (mono fully retired from user surfaces; --ff-mono = debug-only token; rad-* utilities; notch tokens gone; brand tokens gone — fold T1-T4's doc debt in here as ONE coherent edit).

**Interfaces:** Produces: `grep -rn "ff-mono" frontend/src --include="*.tsx"` → only disclosed keep-mono sites (target: zero, judge per site); baselines re-baselined to the Jakarta-everywhere look.

- [ ] Sweep per rules → gate → regen + determinism (green twice) → **controller visual QA checkpoint (dark+light, browser)** before commit → commit `feat(fe): retire ff-mono from user surfaces — Jakarta + tabular-nums everywhere (mezo-x3x0, mezo-23uf)` (goldens included).

### Task 6: Docs close-out + contract verification

**Files:**
- Verify-only greps (the four contracts): notch zero · `--brand` zero · ff-mono only-disclosed · `label-mono brand` still zero.
- Modify: `docs/features/train.md`/`fuel.md`/`me.md`/`today.md`/`insights.md` — ONLY where T2-T5 invalidated a claim (e.g. train.md's "un-re-skinned Builder body content still runs on --brand-glow" is now false — update; fold-in any file-map changes from the two deletions). `docs/features/_platform-design-system.md` already updated in T5.
- `node scripts/lint-docs.mjs` → 17/17 PASS.

- [ ] Doc pass → lint → full gate one last time → commit `docs: vocab-retirement close — brand/notch/mono claims updated (mezo-x3x0, mezo-23uf)`.

---

## Execution order & review protocol

T1 → T2 → T3 → T4 → T5 → T6, strictly sequential (each sweep's contract feeds the next). Per-task: fresh implementer subagent + reviewer gate (diff package), controller visual QA at T2 (failure-list triage) and T5 (full checkpoint). Ledger: append a new `# Napiv vocab-retirement SDD progress` section to `.superpowers/sdd/progress.md`. Final whole-branch review (fable) before merge; PR → CI green → detached-worktree `--no-ff` merge; bd ops controller-only from the MAIN checkout.

**Present to human at close:** (1) small-card radius unification 12/16/24→20px (R1, spec-aligned); (2) the ff-mono→Jakarta flip — the single most visible change (every numeric label/stat/timestamp loses the mono look); (3) NotchCard/LabelMono component deletions; (4) the mezo-23uf resolution (classes keep historical names; components live on; brand survives only as accent class names).

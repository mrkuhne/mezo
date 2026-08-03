# Active workout context + visual refresh — Implementation Plan (mezo-8xmf)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render the plan's rich context (failure/volume style, rep range, target RIR, warm-up %) on the active-workout execution surface and re-theme it with muscle-family colors — per the two binding mockups.

**Architecture:** Render-only. New pure helpers in `features/train/logic/workoutCardMeta.ts`; markup/CSS restructure of the execution card and the logged-set list inside `ActiveWorkoutPage.tsx` + `prototype.css`. No data/hook/API change.

**Spec:** `docs/superpowers/specs/2026-08-03-active-workout-context-design.md` (mockup assets binding).

## Global Constraints

- **Read `docs/references/frontend_conventions.md` first.** FE-only; NEVER `./mvnw`.
- Style rule: `setStyle(targetRIR)` from `@/features/train/logic/setBudget` (≤1 failure 🔥 coral-deep, ≥2 volume 🌿 sage-deep). Muscle families via `muscleColor(muscle)` (`rail/wash/deep` css-var refs — use directly in inline styles).
- Hungarian copy; tokens only (no raw hex; `var(--text-inverse)` on fills).
- Tests FOREGROUND, plain substring vitest filters, `timeout: 600000` (full gates 900000), both modes; verify Test-Files count vs patterns. No `pnpm test:visual` locally.
- Commits: explicit `git add` + `--no-verify` + bd id (mezo-8xmf) + `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`; no issues.jsonl in `git show --stat HEAD`.
- `ActiveWorkoutPage.tsx` is 1429 lines — edit surgically, never rewrite wholesale; adapt existing tests (mutation evidence stays: log-a-set flows must still be asserted).

---

### Task 1: workoutCardMeta helpers (pure logic)

**Files:** Create `frontend/src/features/train/logic/workoutCardMeta.ts` + `workoutCardMeta.test.ts`.

**Produces (exact):**
- `warmupPctLabel(ex: LoggedWorkoutExercise, warmupIdx: number): string | null` — `` `B{i+1} = {pct}% · {kg}` `` where pct = round(warmupTarget/firstWorkingTarget×100); null when either target weight missing.
- `setStatus(ex, logged: { reps: number; kind: 'warmup' | 'working' }): 'ok' | 'below' | 'above'` — working reps vs `[repMin, repMax]`; warmups always 'ok'.
- `exerciseTonnage(sets: { weightKg: number | null; reps: number; skipped?: boolean }[]): number` — Σ weight×reps over non-skipped logged sets with weight.
- `topSetDeltaPct(sets, lastWeekWeightKg: number | null | undefined): number | null` — (max logged working weight − lastWeek)/lastWeek ×100 rounded; null without lastWeek or no logged working set.
- `avgWorkingRir(sets: { rir: number | null; kind: string }[]): number | null` — mean to 1 decimal.
- `sessionProgressSegments(exercises: LoggedWorkoutExercise[], currentIdx: number, doneMap: (exId: string) => boolean): { colorMuscle: string; weight: number; state: 'done' | 'current' | 'upcoming' }[]`.

TDD: tests first (boundary reps repMin/repMax exact = 'ok'; pct rounding; tonnage skips skipped/null-weight; delta null paths), fail → implement → both modes green (`pnpm test workoutCardMeta`). Commit `feat(train): workout card meta helpers (mezo-8xmf)`.

---

### Task 2: Execution card v2 (theming + zones + compact controls)

**Files:** Modify `frontend/src/features/train/pages/ActiveWorkoutPage.tsx` (+test), `frontend/src/styles/prototype.css`, optionally `frontend/src/features/train/components/SetStepper.tsx` (+test, sizing only).

**Binding:** mockup `assets/2026-08-03-workout-card-mockup.html` + spec "Execution card (v2)". Implement zones ①–⑥ exactly (eyebrow `{idx}/{n} · {muscleLabel} · {type}`; stat-strip 3 labeled cells Stílus/Rep-cél/Szett; múlt+javaslat subrow; set-dots + last-warmup `warmupPctLabel` note; steppers value ≈21px buttons ≈29px; RIR pills fixed ~34px + inline hint 🔥 `bukásig!` / 🌿 `hagyj 2 rep tartalékot`), muscle-family card gradient + rail + glow + family CTA/RIR-active/current-dot, and the session progress bar (from `sessionProgressSegments`). Keep `.excard` class names where possible; new classes get `wkx-` prefix in prototype.css. Existing behaviors (pager, dots, skip, note, plyo weight-hide, warmup RIR-hide) unchanged.

Tests: update `ActiveWorkoutPage.test.tsx` — new assertions: stat-strip renders style+rep-range (`🔥 Failure` fixture / `6–8`), hint text per style, progress bar present; keep/adapt all logging-flow assertions. Both modes: `pnpm test ActiveWorkoutPage SetStepper`. Commit `feat(train): muscle-themed execution card with context zones (mezo-8xmf)`.

---

### Task 3: Set list v4 (table) + docs + full gates

**Files:** Modify `ActiveWorkoutPage.tsx` (+test), `prototype.css`; `docs/features/train.md`.

**Binding:** mockup `assets/2026-08-03-workout-setlist-mockup.html` + spec "Set list (v4)". Replace the read-only set list block with: header (eyebrow `Szettek` + family target pill `cél: {repMin}–{repMax} rep · RIR {t} {🔥|🌿}`), the strict table (SZETT/KG/ISM/RIR/status columns, fixed widths, right-aligned mono, marker circles, warmup amber wash, current family wash, pending ghost rows with target values), status column via `setStatus` (`✓`/`▼ cél alatt`/`▲ cél felett`/`MOST ↑`), and the 3-cell footer (`exerciseTonnage` kg · `topSetDeltaPct` ±% or `–` · `avgWorkingRir`). Row tap keeps opening `SetEditSheet` (unchanged handler).

Tests: table renders logged+pending rows with statuses; deviation case asserted; footer numbers computed from fixture; row tap still opens sheet. Then docs (`train.md` §2 active-workout description + file map; bump updated) + `node scripts/lint-docs.mjs` clean; then FULL gates (own calls, 900000): `pnpm build`, `pnpm test`, `VITE_USE_MOCK=true pnpm test` — fix only own breakage. Commit `feat(train): tabular logged-set list + docs (mezo-8xmf)`.

---

## Ship checklist (controller)

Push → self-PR → CI (test-visual WILL be red: regenerate linux goldens via `gh workflow run update-visual-baselines.yml -r <branch>`, approve the `action_required` run via `gh api --method POST repos/mrkuhne/mezo/actions/runs/<id>/approve`, pull the bot commit, re-check) → `--no-ff` merge → push main (auto-deploy) → close mezo-8xmf → bd sync.

---
name: kihagyas
description: Session driver for the Kihagyás + kímélő mód programme (epic mezo-q4xt2, 2026-09-28) — one-tap skipping of a planned workout, sport session or meal with an optional reason (quick chips + "Egyéb"), a multi-day recovery state (kímélő mód) for illness / stomach bug / injury / travel with a gradual comeback, and AI that understands the reason without judging it. One slice per fresh session (S1 → S4), each opening with a short brainstorm and a prototype OK. Use when the user invokes /kihagyas or asks to continue the kihagyás / kímélő mód / skip-with-reason work.
---

# Kihagyás + kímélő mód session driver

**One fresh session = one slice.** The flow per slice is the house frontend change workflow
(CLAUDE.md §Frontend change workflow): **short brainstorm (recon + owner) → spec delta OK →
clickable prototype OK → plan OK → build → gates → merge → deploy → verify live → report.**
After the third OK run straight through; no "does this look right?" round after the build.

## Owner decisions (2026-09-28): do not re-litigate

The full list is §2 of the base spec. In one breath:
- **AI understands and adapts, never judges.** It maps "Egyéb" text to a fixed category +
  duration guess and shows its reading for confirmation; **code decides the effect**. Its
  only "validation" is the illness safety question (fever / chest-level symptoms → no
  training until it passes).
- **Reason input:** chips *Beteg vagyok · Gyomorrontás · Sérülés/fájdalom · Úton vagyok ·
  Fáradt vagyok · Nincs időm · Nincs kedvem · Egyéb*; skippable ("Most nem mondom").
- **Serious** (illness, stomach, injury, travel) → **kímélő mód**; **soft** (tired, no time,
  no mood) → that one occurrence only, **1 free pass per week**.
- **Kímélő mód duration:** estimate chip (*Csak ma · 2–3 nap · Kb. egy hét · Nem tudom*) +
  daily "Hogy vagy? Jobban / Még nem"; never switches back silently.
- **Gym programme:** 1–2 days → continue; ≈1 week → resume where stopped (end shifts);
  >1 week → step back a week; **always** a 1–2 session lightened comeback.
- **Sport:** auto-skipped in kímélő mód, never counted missed.
- **Meals:** skipped meal leaves the day, **no redistribution**; kímélő mód → guidance
  instead of a kcal target; adherence-neutral copy.
- **Memory:** episodes are remembered for the coach and recaps. **Everything undoable.**

## Canon (read every session, in this order)

1. **`docs/superpowers/specs/2026-09-28-kihagyas-kimelo-mod-design.md`** — decisions,
   slices, architecture sketch, prior art, codebase terrain with anchors, traps, and the
   **Slice lessons** appendix.
2. `bd show mezo-q4xt2` and the slice bead — scope, deps, comments from earlier sessions.
3. `docs/features/{train,fuel,today,companion,proactive,character}.md` — parity sources.
4. UI: the üveg bible + `docs/design_2.0/prototype-recipe.md`; the **living prototypes**
   (`docs/design_2.0/prototypes/elo/` — Edzés for S1/S2, Nap for the morning card, Fuel for
   S3) and their fixed Artifact URLs in `elo/README.md`. Edit the living prototype of the
   domain; never start a new file.

## Procedure (one slice)

### 0. Pick the slice
1. `gh run list --branch main --limit 3`. **A red main outranks everything.**
2. `bd list -l epic:mezo-kihagyas` is the authority. Take the lowest open
   `mezo-q4xt2.N` whose blockers are closed (S1 → S2 → S3/S4), unless the owner named one.
3. If all closed: say so in two sentences and stop. Do not invent a slice.
4. `bd update <id> --claim`; work in the worktree on `feat/kihagyas-s<N>`.

### 1. Brainstorm (short; the big decisions are already made)
- **superpowers:brainstorming** with **brainstorm-recon** (researcher + investigator in
  parallel, background). The investigator prompt names the slice scope and the spec §6
  anchors so it verifies rather than rediscovers.
- Ask only what the slice genuinely leaves open, **in Hungarian business language**
  (CLAUDE.md §Communication: A helyzet / A gond / A lehetőségek / Az ajánlásom), one
  question per message.
- Outcome: a dated **spec delta** section appended to the base spec, committed. Wait for OK.

### 2. Prototype → plan
- Extend the domain's living prototype (new hash route / sheet), verify it over HTTP in the
  in-app browser (console clean, 320px, reduced motion, `?v=N`), republish to the fixed
  Artifact URL, hand off in Hungarian, **stop and wait** for the OK. New icons go on an
  "Új ikonok" sheet — never emoji.
- **superpowers:writing-plans** → `docs/superpowers/plans/`, with the *Kész, ha…*
  checklist also written to the bead (`bd update <id> --acceptance "..."`). Owner OK.

### 3. Build
- superpowers:subagent-driven-development or executing-plans; TDD for all logic.
- House patterns: per-date overlay rows with soft-delete undo (`ReadinessChoiceEntity`,
  `WorkoutDayAdjustmentEntity`, `SportSlotSkipEntity`); **LLM classifies, code decides**
  (`TeamChatReplyDecision`); ADR 0012 consumer-owned LLM ports + companion adapter +
  `LlmCallContext` slug, cheap tier, deterministic fallback; feature switch per new bean with
  `*SwitchOffApiIT` / `*LlmUnavailableApiIT`; dual-mode FE hooks under `frontend/src/data/`.

### 4. Gates (non-negotiable)
- Backend focused ITs (`./mvnw test -Dtest=...`); full suite only with
  `-Dmezo.test.use-testcontainers=true` when warranted (migrations, cross-cutting).
- FE tests in **both** modes with `CI=true` (`VITE_USE_MOCK` unset AND `=false`);
  `pnpm build`; affected `frontend/tests/layout` specs; runtime pass with the `verify` skill.
- Contract drift gate; `node scripts/gen-codemap.mjs`; `node scripts/lint-docs.mjs` 0/0.
- Docs: `docs/features/*.md`, the feature index row, the milestone log entry.

### 5. Merge + deploy (AGENTS.md §Git Workflow, "no-wait, net stays")
1. `git pull --rebase` origin main; re-run quick gates if anything came in.
2. `git checkout --detach origin/main && git merge --no-ff feat/kihagyas-s<N>`, regenerate
   the codemap, `git push origin HEAD:main`. Subject: `feat(train): ... (mezo-q4xt2.N)`.
3. Watch `deploy` for that commit; verify on the production URL (and the prod DB rows, read
   only). A red `ci` comes before anything else. Delete the branch.

### 6. Close
- Append numbered **Slice lessons** to the base spec — only what a later slice would pay
  for again. Close the bead with a result summary. Living prototype in sync + republished.
- Session close per CLAUDE.md: `node scripts/check-beads-backup.mjs --fix` + commit,
  `bd dolt push`, `git push`, `git status` clean.
- Report **in Hungarian**, walking the *Kész, ha…* list in everyday words: what the owner can
  now do in the app, what the next slice is, what was not done and why.

## Traps (from recon 2026-09-28; extend via Slice lessons)

- **Never model a skip as a `workout_session` row with `status='skipped'`**: it collides with
  the D5/D6 guards and `getToday` resume, and `TrainingStreakCalculator` reads
  status-agnostic `findInstanceDates` (a separate fix task was spun off 2026-09-28 — check
  its outcome first).
- **No central "is this date skipped / protected?" read exists** — ~8 FE readers and several
  backend ones filter sport skips by hand (`mezo-cq06`, `train.md`). S1 builds the central
  read; later slices extend it, never re-sweep.
- `POST /api/train/workouts/{id}/skip` skips **one exercise**, not a workout.
- `sport_schedule_slot` rows are re-created on save → sport skips key on
  `(day_of_week 0=Hét..6=Vas, time, date)`, not slot id. Non-ISO weekday numbering.
- `sport_slot_skip`'s only writer runs under the advice advisory lock; a new writer must
  respect it (or take it).
- `MissedWorkoutsRule`, `MesocycleReportService` adherence, QuestEvaluator, insights,
  habit, `PlanFeasibilityCalculator` all count "missed" — each must become skip/reason-aware.
- Fuel shame-vocabulary tests apply to every skip / kímélő string.
- ArchUnit: train/meal never import companion; layer subpackages; focused ITs skip ArchUnit.
- New tables join `ResetDatabase` TRUNCATE; jsonb `?` in Liquibase → `jsonb_exists()`.
- `VITE_USE_MOCK` unset = mock; relative-time fixtures break after midnight; merges drop
  CODEMAP entries — regenerate after every merge.
- Budget ≥70% forces the cheap tier — the classifier must be designed for it.

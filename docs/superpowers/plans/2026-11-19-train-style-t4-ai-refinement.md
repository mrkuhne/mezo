# Train style & techniques — T4: AI refinement — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In a run that opts in to the technique planner (training style + techniques on), the weekly review's
technique and challenge lines are no longer the code default alone: an AI looks at the planner's week together with
what the code cannot weigh (last week's logged sets, joint pain, soreness, stalled muscles, which techniques he
actually finished) and may **move or swap** techniques and the day's challenge **inside the planner's eligible set**,
with a one-line Hungarian reason per change. A pure merger validates every change; anything invalid is dropped.
AI off, unavailable, slow or fully rejected → the code default stands, unchanged. The owner decides every line.

**Architecture:** ADR 0012 port pattern, mirroring `MesoPlanLlm` / `MesoPlanMerger`:
train-owned port `TechniqueLlm` (adapter `feature/companion/llm/TechniqueLlmAdapter`, own switch
`mezo.feature.technique-ai.enabled` + the companion switch), pure `TechniqueMerger`, and a `TechniqueAiRefiner`
service that runs **after the weekly proposal is committed** (async, never inside `getToday`'s locked transaction)
and rewrites only that proposal's still-undecided technique lines.

**Spec:** `docs/superpowers/specs/2026-11-17-train-style-and-techniques-design.md` §6.5 "AI refinement", §7 slice T4.
bd `mezo-r36n9.82`. Builds on T3 (`2026-11-19-train-style-t3-planner-and-challenge.md`).

## Decisions this plan makes

| Question | Decision |
|---|---|
| When the AI runs | Only for the **weekly review in manual mode** (the proposal waits for him), from week 2, outside a deload week, when the planner step ran. Never in the block builder (the evaluator is called on every edit; it stays fast and free) and never at run start. In **auto mode** the code default is applied as today (no AI) — the app never auto-applies an AI change he has not seen. |
| How it runs | After the build's transaction commits (`@TransactionalEventListener(AFTER_COMMIT)` + `@Async`). `getToday` never waits on a model. The refiner re-reads the proposal in its own transaction and writes only if it is still `pending` **and none of its technique lines is decided** (else the AI result is dropped). Hard time limit on the model call (`mezo.train.technique.ai.timeout`, 20 s). |
| What the AI may do | Per **eligible** row (rule 1 of the planner, the same `TechniquePlanner.eligible`): set the technique to `rest_drop`, `myo`, `drop` or `none`. Per day: move the challenge to another row that is a valid challenge candidate (counts, stable, lengthened-friendly, not a sport-loaded group on a sport day) or keep it. Nothing else: no sets, reps, weights, styles, new exercises, `partials` outside the challenge. |
| What the merger enforces | Row exists and is eligible; owner picks (source `owner` / null-source carried picks) untouched; day allowance (`maxPerDay`, reduced in a deficit / sport day) and `maxPerMuscleWeek` re-counted on the result; one challenge per day, never on a row that carries a technique (the challenge wins, §11 Q6 — a technique on the new challenge row is cleared); techniques only from week `startWeek`; unknown ids / days / technique values dropped. Each accepted change needs a non-blank reason (≤ 160 chars, trimmed); a change without one is dropped. |
| Where an AI pick lives (**owner decision, see below**) | Accepted AI line → row source **`ai`**. An `ai` pick is kept by the planner like the owner's own while it is still valid (eligible, within the allowance, a loading week); when the rules no longer allow it (a deficit or sport day shrinks the allowance, the exercise stops being eligible) the planner's line removes it, reason as T3. The AI may move it again in a later week. If the AI is off later, nothing flips back to the default. He can always overwrite it (source → `owner`). |
| How it shows | Lines of the AI-changed rows carry reason `ai_suggested` (already in the contract; the phone already labels it "Boop javaslata") and a new optional **`note`** (the AI's one-line reason). Additive contract change; the phone shows the label today, the note when the review screen is taught to (follow-up issue, Boop review screen). Untouched planner lines stay exactly as T3 made them. |
| Model context | Week, phase, deficit, sport days; per day the rows (name, group, tier, sets, rep range, effective style, current technique + source, challenge, eligible yes/no); the planner's week; per group last week's signals (grind, joint pain, soreness high, stalled); per exercise last week's logged top set vs. target and whether the prescribed technique legs were logged. No personal health values beyond these training signals; nothing leaves the backend except to the configured model. |
| Cost | One SMART-tier call per run per week, only when there is a technique-relevant review. Logged in `llm_log_history` as feature `train_technique`, operation `refine`. |

## Owner decision (2026-11-19) — answered: A, "Marad, amíg szabályos"; plan approved

**Where an AI pick lives** — (A, recommended) kept while the rules allow, removed by the rules, never flipped back
when the AI is off; (B) re-decided every week by the code + AI (if the AI fails, its picks go back to the code
default → back-and-forth lines); (C) treated exactly like his own pick (never removed automatically, only warned).

## Production fact (2026-11-19)

Every AI call in production fails since 2026-11-17 01:50 UTC (`llm_log_history`: all ERROR, embeddings HTTP 429 —
the provider account has no credits). Until the owner tops it up, T4 ships dark in effect: the code default stands
every week (that is exactly the fallback path, and it is tested). Told to the owner.

## Tasks

### Task 1 — contract: `note` on a proposal line
- [ ] `api/feature/train/train-week-proposal.yml` `WeekProposalLine.note: { type: string, nullable: true, description: AI one-line reason (ai_suggested lines) }`; bundle into `api/openapi.yml` (repo's bundle script), regenerate DTOs + `frontend/src/data/_client/api.gen.ts`.
- [ ] `WeekProposalLineJson` gains `String note` (last component; stored rows read null); every constructor call updated; `withDecision` carries it; the read mapper sets it.

### Task 2 — `ai` source semantics in the planner and the lines
- [ ] `TechniquePlanner`: an `ai` row is kept (consumes allowance) only while `eligible` and within the day / muscle allowance; otherwise it is not kept and the planner may place its own pick there or elsewhere. An `ai` challenge is kept while it is a valid challenge candidate. Owner picks unchanged.
- [ ] `TechniqueLines.plannerMay` / `WeekProposalService.plannerMayWrite`: `ai` rows may get lines (removal, or the AI's own move); owner rows never.
- [ ] `writeTechnique`: a line with reason `ai_suggested` writes source `ai`; otherwise `planner` (as T3).
- [ ] `ExerciseStyler` swap: keep `ai` like `planner`. `ExerciseTechniqueService`: an owner clear of an `ai` technique gives the set back like a planner one.
- [ ] Unit tests: `TechniquePlannerTest` (ai kept / dropped on deficit / ineligible), `TechniqueLinesTest` (removal line on an ai row; owner row still never).

### Task 3 — the port, the merger
- [ ] `feature/train/service/TechniqueLlm` (records `Request`, `RowView`, `GroupSignal`, `ExerciseLog`, `Change(UUID exerciseId, String technique, String reason)`, `ChallengeMove(int dayIndex, UUID exerciseId, String reason)`, `Suggestion(List<Change>, List<ChallengeMove>)`; `Optional<Suggestion> refine(Request)`).
- [ ] `TechniqueMerger.merge(Input, Week planned, Suggestion) → Merged(Week week, Map<UUID,String> notes)` — pure; AI-changed picks get source `ai`, reason `ai_suggested`; rules per the table above.
- [ ] `TechniqueMergerTest`: valid move; swap kinds; ineligible row dropped; owner row untouched; over day allowance dropped; over muscle-week dropped; challenge moved (technique on target cleared); invalid challenge target dropped; unknown id / technique dropped; missing reason dropped; empty suggestion = planner week identical.

### Task 4 — the adapter and the switch
- [ ] `FeaturesConfiguration.TECHNIQUE_AI_SWITCH = "mezo.feature.technique-ai.enabled"`; `application.yml` `mezo.feature.technique-ai.enabled: true` (test profile: as the meso-plan-ai switch is set there); `mezo.train.technique.ai.timeout: 20s` in `TrainTechniqueProperties`.
- [ ] `TechniqueLlmAdapter` (companion/llm, conditional on both switches): `HabitSuggestLlmAdapter`/`MesoPlanLlmAdapter` idiom — SMART one-shot, `LlmCallContext("train_technique","refine",…)`, Hungarian system prompt with marker `[technique-refine]`, brace-substring extraction, degrade to empty on any error.
- [ ] `FakeCompanionLlm`: the marker returns `{"changes":[],"challenges":[]}` (deterministic, companion-fake profile).
- [ ] `TechniqueLlmAdapterTest`: payload contains the rows / signals; parse OK; garbage → empty; exception → empty.

### Task 5 — the refiner
- [ ] `WeekProposalService` publishes `TechniqueRefineRequested(createdBy, proposalId)` when a manual-mode weekly proposal is left pending and the planner step ran for it.
- [ ] `TechniqueAiRefiner` (`@Async` + `@TransactionalEventListener(AFTER_COMMIT)`, `ObjectProvider<TechniqueLlm>`): no port → return. Builds the request (snapshot via `TechniquePlanService.snapshotRun` with the proposal's working sets, planner week, `WeeklySignalReader`, stalled groups, last week's logs), calls the port with the timeout, merges; if the merged week equals the planner week → nothing. Else in a new transaction: re-read the proposal, still pending and no technique line decided → drop its technique lines, regenerate them with `TechniqueLines.lines` on the merged week (set lines and rep-range lines untouched; the rep-range / reduction lines of StallOffers are kept), attach notes to the AI rows' lines, save. Every failure logged, swallowed.
- [ ] IT `TechniqueAiRefinerIT` (`feature/train/service/`, `@MockitoBean TechniqueLlm`): AI swap → proposal lines carry `ai_suggested` + note, accepting writes source `ai`; AI throws / empty → lines identical to T3's; a technique line decided before the refiner commits → AI result dropped; next week in a deficit → removal line for the ai row; auto mode → refiner never called; run that does not opt in → never called.

### Task 6 — gates, docs, ship
- [ ] Focused ITs + unit tests + `ArchitectureTest` with `-Dmezo.test.use-testcontainers=true` (one Maven process); full backend suite once.
- [ ] Frontend: generated client only — `pnpm typecheck` / build sanity.
- [ ] `node scripts/gen-codemap.mjs`, `node scripts/lint-docs.mjs` (0 errors / 0 stale).
- [ ] Docs: `docs/features/train.md` (§4 T4, §9 traps: async, `ai` source), spec status line, the Boop handbook technique page, `_dontesek.json` row (the owner's answer), `_kiadasok.json` row, milestone entry.
- [ ] bd follow-up: Boop review screen shows the line `note` (under `mezo-r36n9`).
- [ ] Merge `--no-ff` via detached HEAD, push, deploy green, pod on the new version, prod checks; Notion sync (`fetch` + rebase + `plan` → apply → `check` 0); tracker backup.

## Kész, ha…

- Kézi heti átnézésnél, ha a gép mesterséges intelligenciája elérhető, a technika- és kihívássorokat az AI
  finomíthatja: csak olyan gyakorlatra tehet technikát, amit a szabályok amúgy is engednek, a napi és heti kereten
  belül; a tulaj saját választását soha nem írja át; minden változtatásnál egy mondatos magyar indok van, és a sor
  „Boop javaslata” jelölést kap.
- Ha az AI ki van kapcsolva, nem válaszol, hibázik vagy minden javaslata szabálytalan: a heti javaslat pontosan
  olyan, mint T3 után (teszttel igazolva).
- A Ma képernyő soha nem vár az AI-ra (a finomítás a javaslat elkészülte után, a háttérben fut); ha a tulaj közben
  már döntött egy technikasorról, az AI eredménye elvész, semmit nem ír felül.
- Automatikus módban, a blokképítőben és a blokk indulásakor nincs AI — ott a gépi alapterv marad.
- Az elfogadott AI-választás megmarad, amíg a szabályok engedik; ha már nem (fogyás, sportnap, alkalmatlan
  gyakorlat), a gép javasolja a levételét; kikapcsolt AI mellett nem ugrál vissza.
- A blokk, aminek nincs stílusa vagy nincs bekapcsolva a technika, pontosan úgy működik, mint eddig.
- Backend fókuszált tesztek + `ArchitectureTest` zöld (Testcontainers), teljes készlet zöld; kódtérkép és
  dokumentum-ellenőrzés hibátlan; a webes app csak a generált klienst kapta.
- Élesítve: `deploy` zöld, a pod az új verziót futtatja; éles lekérdezés: a futó blokk adatai nem változtak a
  telepítéstől.
- `train.md`, a kézikönyv technika-oldala, a döntésnapló, a kiadásnapló és a Notion tükör a kiadott állapotot írja le.

## As built (2026-11-19) — differences from the tasks above

- **No `mezo.train.technique.ai.timeout`.** The refinement runs after the commit on its own thread, so a slow model
  delays nothing the owner waits for; the provider client's own timeout bounds the call.
- **No `FakeCompanionLlm` branch.** The fake's canned non-JSON answer parses to empty, which is already the
  "no change" path; a dedicated branch would add nothing.
- **The refine rebuilds the review's week from its own lines** (`TechniqueAiRefiner.proposedWeek`) instead of
  re-running the planner, so the stall offers' picks and reasons survive unchanged.

# Companion Tool & Context Expansion — Design Spec

- **Date:** 2026-07-26
- **Driving bd:** `mezo-xixu`
- **Status:** design (frozen artifact — do not rewrite; a new effort gets a new dated spec)
- **Scope:** backend-only (Spring Boot 4 + Spring AI 2 / Gemini). No API-contract change, no frontend change.
- **Related:** [`docs/features/companion.md`](../../features/companion.md), [`docs/decisions/0008-companion-llm-spring-ai-2-gemini.md`](../../decisions/0008-companion-llm-spring-ai-2-gemini.md)

## 1. Problem & goal

The companion AI chat (prod, k3s) is only shallowly aware of the app. Two concrete failures observed in a live conversation:

1. **Upcoming training was wrong/hallucinated.** Asked "what movement is tomorrow?", the chat answered from the deterministic context snapshot's *recurring weekly* `gym-rend`/`sport-rend` strings only. It had **no forward, dated resolution** of "what's actually on for date X", and **no tool** to verify. When pushed ("no gym?"), it fabricated a gym session; the advisor chain flagged the answer `degraded` ("nem ellenőrzött").
2. **Recipes and pantry were invisible.** `FuelTools` exposes only `get_recent_meals` + `get_protocol_adherence`. There is **no recipe tool and no pantry tool**, so the chat honestly said it "cannot see the recipes".

Root cause (code-level, DB-independent): the companion's read-surface is (a) terse recurring-schedule strings in the snapshot and (b) **backward-looking tools only**; whole domains have no tool or snapshot presence at all.

**Goal:** make the chat aware of the *whole app at entity depth* — both high-level ("where am I") and deep ("which exercise comes next, is there a PR I'd break, suggest food accordingly") — without wrecking tool-selection accuracy or latency.

## 2. Organizing principle

> **"Now + next" → context snapshot** (always in the system prompt, 0 tool calls).
> **"Historical / entity-deep / browse" → parameterized hub-tools** (focused, 1–2 calls).

The best tool call is the one you don't need: the snapshot answers the common "who am I + today + tomorrow" questions with zero round-trips; the tools exist for depth, history, and browsing. Each snapshot line stays terse (high signal); the 1M Gemini context window means tokens are not the binding constraint — clarity and selection accuracy are.

## 3. Constraints & the real bottleneck

- **Not the context window.** Gemini's 1M window governs how much *fits*, not how many tool *rounds* run.
- **Per-turn tool-call budget** (`mezo.companion.tools.max-calls-per-turn`, `application.yml:280`, currently **6**, hard `@Max(20)`): every call is an LLM round-trip → latency (fights the ~30s SSE window, `application.yml:16`) and cost (each round re-bills the whole context). **Raise 6 → 15.**
- **Tool-selection accuracy degrades past ~15–20 active tools** (2026 research, §7). Target **≤15 active tools**, hub-consolidated, with disciplined descriptions.
- **Read-only.** No write/log/close-from-chat tools this phase (deliberate — writes need confirmation UX + safety + idempotence; a later phase).

## 4. Component A — Enriched context snapshot

Edited in `feature/companion/service/ContextSnapshotAssembler.java` (`render()` composes the blocks). Existing blocks: `[Profil]`, `[Cél]`, `[Edzés]`, `[Mai üzemanyag]`, `[Gyógyszer]`, `[Regeneráció]`.

Changes:

- **`[Edzés]` — the flagship fix (forward, dated resolution).** Replace the reliance on recurring strings with a resolved agenda:
  - **Ma:** `WorkoutService.getToday` → gym day-label + exercises (name + working sets × rep-range), or "pihenőnap".
  - **Holnap:** `WorkoutService.findPlannedTemplateForDate(tomorrow)` → gym day + exercises; **+** tomorrow's weekday sport slots (kind/duration) via `SportService.getSchedule`; **+** the active running block's prescribed session for tomorrow (`RunningBlockStructure.weeks[currentWeek].sessions[]` matched on `dayOfWeek`).
  - **Meso-pozíció:** current/total week, phase (`phaseCurve[week]`, incl. Deload), split.
  - Keep the recurring `gym-rend`/`sport-rend` + backward digest as secondary context.
- **`[Növekedés]` (new, one line):** account level + top skill levels + this week's XP rollup (`GamificationService.getProfile` + `ProgressionService.getProfile` + `GrowthWeekService.growthWeek`).
- **`[Napi gyakorlat]` (new, one line):** today's quest completion summary, habit-chain/streak, intention creed + today's foci + evening reflection, and whether the **day is closed** (`RitualService.getDay`). Detail lives in the tool; this is only the "where am I today" signal.
- **`[Regeneráció]`/`[Cél]`:** ensure the sleep/wake **target anchor + last night's sleep** are unambiguously present (largely already there).

All snapshot reads are LLM-free, honest-absence (`nincs adat`), and window-bounded by `mezo.companion.snapshot.*`.

## 5. Component B — The 15 hub-tools

Tools live in `feature/companion/tools/`, registered in `CompanionToolRegistry.callbacks(audit)` via `ToolCallbacks.from(...)`, each wrapped in `RecordingToolCallback`. Three **new beans** (`GrowthTools`, `PracticeTools`, `InsightsTools`); the rest extend existing beans. Every tool is read-only, calls existing domain services, returns a formatted `ToolText` string, and records a `RefsEnvelope.Ref(kind, id)` per surfaced entity.

| # | Tool | `scope` enum / param | Backing service(s) | Returns |
|---|---|---|---|---|
| 1 | `get_training_plan` | today · tomorrow · week · meso · date | `WorkoutService.getToday`/`findPlannedTemplateForDate`, `TrainService.listMesocycles`, `RunningBlockStructure` | Forward, dated plan: gym day + exercises, sport, run; `meso` = full current cycle (weeks, phases, day templates) |
| 2 | `get_training_log` | gym · sport · run (+ days) | `WorkoutService.listWorkouts`, `TrainService.listSportSessions`, `RunningService.listSessions` | Backward log (merges old `get_recent_workouts` + `get_sport_sessions`) |
| 3 | `get_exercise_records` | (exercise?) | `ExerciseRecordService.list` | PR/e1RM (Epley): `bestE1rm`, `bestSet`, `repRecords`, `recentTopSets` — the "would I break a PR" basis |
| 4 | `get_fuel_log` | day · week (+ date) | `FuelDayService.getDay`/`getWeek`, `WaterLogService`, `MealService` | Consumed vs targets, water, meals (merges old `get_recent_meals`) |
| 5 | `get_recipes` | (filter: slot/category/tag/starred/fitsFor?) | `RecipeService.list`/`get` | Recipes: name, macros, `fitScore`, ingredients (on detail) |
| 6 | `get_pantry` | food · supplement · stim · med | `PantryService.getPantry` (+ `PantrySuggestionService`) | In-stock items + qty/expiry; "what can I make" |
| 7 | `get_protocol` | adherence · intake · supplements | `ProtocolService.getView`, `IntakeService.listForDay` | Supplement/protocol adherence + intake detail |
| 8 | `get_weight_trend` | (weeks?) | `WeightTrendService.computeTrend` | EWMA trend, weekly rate (unchanged) |
| 9 | `get_recovery` | sleep · sleep-goal · checkins (+ days?) | `SleepLogService.list`, `SleepGoalService.getGoal`, `SleepAnchorResolver`, `CheckInService.listForDay` | Sleep log + **sleep goal/anchor/regularity** (the flagged gap) + check-in states. Supersedes old `get_sleep` |
| 10 | `get_goal` | progress · recept · timeline · guards · feasibility | `GoalService`, `GoalTimelineService`, `GoalFeasibilityService`, `GuardEvaluationService`, prescription/TDEE json | Merges old `get_goal_progress` + full engine detail |
| 11 | `get_growth` | skills · week · achievements · titles | `GamificationService`, `ProgressionService`, `GrowthWeekService`, `AchievementService` | XP, skill levels, perks, coins, streak, titles |
| 12 | `get_daily_practice` | (date?) | `QuestService`, `HabitService`, `IntentionService`, `RitualService`, `ChallengeService`, `ActivityService` | One day's discipline: quests + habits + intention + day-close + active challenge + activity log |
| 13 | `get_medication` | reta · all | `MedicationService.getDay` (+ reta cycle) | General meds/doses (merges old `get_reta_cycle`) |
| 14 | `get_insights` | patterns · predictions · experiments | companion `PatternService`, proactive `getPredictions`/`getExperiments` | The AI's own detected insights (the "Minták") — answers "what have you noticed about me" |
| 15 | `find_similar_past_days` | (description, k?) | `MemoryRecallService` | Episodic recall over daily summaries (unchanged) |

**Explicitly out of scope (documented, not silently dropped):** People (`person`/`mention` — social feature, not coaching-relevant); re-reading the companion's own proactive prose (briefing/weekly/memoir/heartbeat — the chat *is* the companion). Companion **knowledge facts** need no tool: the top-N confirmed facts are already injected into every system prompt (V1.1). Add either if a real need appears.

## 6. Component C — Config & registry

- `application.yml`: `mezo.companion.tools.max-calls-per-turn: 6 → 15`. No validation change (`@Max(20)`).
- Register `GrowthTools`, `PracticeTools`, `InsightsTools` in `CompanionToolRegistry.from(...)`; extend `TrainTools`, `FuelTools`, `GoalTools`, `BiometricsTools`, `MedicationTools`. ArchUnit `companion_tools_are_internal_sphere_only` still guards the boundary.
- **No FE change:** `RefsEnvelope.Ref.kind` is a free string; `RefTag.tsx` renders `[{kind}] {label}` and `ToolChip.tsx` renders `name(args)` generically — new tools/kinds render with zero frontend work.

## 7. Component D — Tool-selection hardening (2026 research)

Findings (sources in §10): degradation begins ~15–20 active tools; **description quality is the #1 cheap lever**; keep active set ≤ 10–20 (Gemini docs); Tool-RAG helps only at *large* scale (its headline 13%→43% gain is a large-toolset phenomenon — the baseline there was already collapsed; it does not transfer to 15 tools) and adds a pre-turn retrieval round-trip + a vocabulary-mismatch failure mode that can drop the correct tool entirely.

Measures, cheap → heavy:

1. **Description discipline (house rule).** Every `@Tool` description states a narrow responsibility + an explicit *"Használd, amikor…"* clause (not "Adatot ad"), with a distinct name and **enum** `scope` params. Add the rule to `docs/references/` (companion/tool conventions).
2. **Tool-routing hint** — a short question-type → tool block in the system prompt.
3. **Snapshot-first** (Component A) — removes most calls entirely.
4. **Measurement phase** (this is what "let's see how it performs" means): a ~30–50 representative Hungarian-question eval set with expected tool(s); compute selection-accuracy from the existing `RecordingToolCallback` audit. Ship the 15-tool version, measure, then decide.
5. **Escape hatch — Tool-RAG on the existing pgvector/`EmbeddingPort`** (prepared, **inactive**). Trigger to activate: eval selection-accuracy **< ~85%** and (1)+(2) don't lift it, **or** the toolset grows **> ~20–25** (e.g. when write-tools land). mezo is uniquely positioned — the embedding pipeline already exists; the spec reserves its seam but does not build it now (YAGNI).

## 8. Testing

Integration-first, per `docs/references/testing_standards.md` + `integration_test_framework.md`.

- **Per new/extended tool:** an IT following the existing `CompanionToolsRenderIT` idiom — seed the domain via its `*Populator`, invoke the tool, assert the rendered `ToolText` + the recorded refs. All tools read **existing** tables → no new `ResetDatabase` entries, no new aggregates/populators (reuse the domains' populators).
- **Snapshot:** an IT asserting `[Edzés]` resolves *today* and *tomorrow* (gym day + exercises, sport, run) against seeded meso + schedules — the regression guard for the observed bug; plus `[Növekedés]`/`[Napi gyakorlat]` render with honest absence.
- **Budget:** an IT/assert that `max-calls-per-turn` reads 15.
- **Fakes:** extend the `companion-fake` scripted-tool idiom (`[fake-tool:…]`) as needed; no real LLM in ITs.
- **Frontend:** unchanged; the existing both-modes gate must stay green (no FE edits expected).

## 9. Hero-chain validation

"Holnap vasárnap mi az edzés, van-e PR amit megdöntök, és mit egyek?" resolves as:
1. **Tomorrow's gym + exercises** — from the enriched `[Edzés]` snapshot (**0 calls**).
2. **PR check** — `get_exercise_records(<exercise>)` → `bestE1rm`/`bestSet` (**1 call**).
3. **Food suggestion** — `get_recipes(fitsFor=…)` and/or `get_pantry(food)` cross-referenced with the `[Mai üzemanyag]` targets (**1–2 calls**).

Total 2–3 calls — well within the 15 budget, and the previously-hallucinated part (tomorrow's session) is now deterministic snapshot data.

## 10. Sources (tool-selection research)

- [arXiv — How Many Tools Should an LLM Agent See? A Chance-Corrected Answer](https://arxiv.org/html/2605.24660)
- [TianPan — The Tool Selection Problem: agent tool routing at scale](https://tianpan.co/blog/2026-04-09-tool-selection-problem-agent-tool-routing-at-scale)
- [Google AI — Function calling with the Gemini API (best practices)](https://ai.google.dev/gemini-api/docs/function-calling)
- [Composio — Tool Calling guide with Google Gemini](https://composio.dev/content/tool-calling-guide-with-google-gemini)
- [Red Hat Emerging Tech — Tool RAG](https://next.redhat.com/2025/11/26/tool-rag-the-next-breakthrough-in-scalable-ai-agents/)
- [arXiv — MCP-Zero: Active Tool Discovery for Autonomous LLM Agents](https://arxiv.org/pdf/2506.01056)

## 11. Out of scope / deferred

- Write/action tools (log meal/weight, close day, complete quest) — a later phase (confirmation UX + safety).
- Tool-RAG activation (prepared seam only).
- People domain; proactive-prose re-reads.
- Hungarian labels for ref-chip kinds (cosmetic nicety).

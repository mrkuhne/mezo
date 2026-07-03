# Companion V3.2 — AI hypothesis loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** the engine goes beyond pairwise stats — a weekly LLM pipeline proposes mechanism-level hypotheses about Daniel's data, critiques them with the old docs' 4-factor scoring, revises the borderline ones once, and persists only the survivors as `pattern` rows (`kind=ai_hypothesis`, critique jsonb attached, `confidence` = the weighted score) — straight into the V3.1 Inbox the PatternsPage already renders.

**Architecture:** `HypothesisPipelineService` — every stage is a pure function around AT MOST one LLM call (NFR-M-4: a node is pure-compute or pure-LLM, never both). (1) **gather** (compute): weekly context = last-7 `daily_summary` narratives + the confirmed-facts block + the live statistical patterns' r/n/p lines (the critic's "statistical support" input). (2) **propose** (LLM, smart tier — `gemini-2.5-pro` debuts): strict-JSON hypothesis array, capped. (3) **critique** (LLM per hypothesis): `{statistical, confounders, l3align, actionability, reasoning}` 0..1 each. (4) **score** (compute): `0.35·stat + 0.25·conf + 0.20·l3align + 0.20·act` (arch §4.7). (5) **route** (compute): keep ≥ 0.75 → persist · 0.50–0.75 → **revise once** (LLM) then re-critique, keep iff ≥ 0.75 · else discard. Persisted rows dedupe by `pair_key = "hyp-" + hash(normalized title)` against EVERY existing row (a user-rejected hypothesis is never re-proposed). Weekly cron `HypothesisJob` (the V2.2/V3.1 idiom).

**Tech Stack:** `CompanionLlm` port grows a **smart-tier** two-string call (`completeSmart` — Gemini adapter builds a second ChatClient on `llm.smart-model`; the fake dispatches on prompt markers). No migration (the `pattern` table + critique jsonb envelope already fit; `thinking` rides the envelope's new `reasoning` field). Contract: additive `PatternResponse.thinking` (nullable) + `PatternCritique.reasoning` NOT exposed (reasoning maps to `thinking`). FE: zero component work — PatternCard already renders confidence/critique/thinking.

**Driver:** bd `mezo-fnnq.13` · roadmap §V3.2 · spec §8 · old docs arch §4.7 · living doc `companion.md`.

## Global Constraints

- Branch `feat/companion-v32`; commits carry `(mezo-fnnq.13)`.
- Gates: BE `./mvnw clean test`; FE `pnpm build + test both modes` (types regen + tiny mapper only).
- No LLM in tests — `companion-fake` marker dispatch (`HYPOTHESIS_MARKER`, `CRITIQUE_MARKER`, `REVISE_MARKER`) + scripting sentinels (`[fake-hypotheses:…]` planted in a populator-seeded daily-summary narrative; per-hypothesis `[fake-critique:…]`/`[fake-revise:…]` markers embedded in the scripted hypothesis titles — the V1.2/V2.2 precedent).
- Config under `mezo.companion.hypotheses.*` (cron, max-per-run, keep/revise thresholds as values with the §4.7 defaults); job switch `mezo.techcore.cron.hypothesis-job.enabled`; weights are CODE constants (they define the score's meaning, not tuning).
- A pipeline failure must never break anything user-facing: per-stage defensive parsing (zero survivors on broken JSON), per-user isolation in the job.
- Everything companion-gated; `confidence` on hypotheses IS the score (never null); `n/r/p` stay null on hypothesis rows.

## Decisions locked (V3.2)

1. **Both LLM stages on the smart tier** (weekly cadence ⇒ negligible cost; judgement quality dominates). The roadmap's "Pro vs cheap for critique" open decision → smart for propose AND critique/revise; revisit with real cost data.
2. **Hypothesis identity** = `pair_key = "hyp-" + 8-hex SHA-256 of the normalized title`; dedupe checks ANY status (rejected = never re-proposed, confirmed = never duplicated). Title changes = new hypothesis (accepted trade-off).
3. **`thinking` = the critic's reasoning** — stored in `PatternCritiqueEnvelope.reasoning` (jsonb grows a field, no migration), exposed as additive nullable `PatternResponse.thinking`, mapped to the FE's existing `Pattern.thinking` ("AI gondolatmenete" disclosure).
4. **Statistical support is grounded**: the critic sees the V3.1 statistical patterns (r/n/p) + the weekly digest — its `statistical` sub-score must cite them or score low; no fabricated numbers (spec §6).
5. **Revise-once is a single extra (LLM revise + LLM re-critique) pass** for the 0.50–0.75 band (arch §4.7); a revised hypothesis keeps its ORIGINAL identity hash? NO — revised title ⇒ new content; identity computed from the FINAL persisted title (dedupe runs at persist time).
6. **Cadence**: Sunday 03:00 (`"0 0 3 * * SUN"`) — after the nightly jobs; config.

## File map

**Backend main:** `CompanionLlm.java` (+`completeSmart` default+abstract?), `llm/GeminiCompanionLlm.java` (second ChatClient), `llm/FakeCompanionLlm.java` (3 new marker branches + sentinels), `service/HypothesisPipelineService.java` (new), `service/HypothesisJob.java` (new), `entity/PatternCritiqueEnvelope.java` (+reasoning), `mapper/CompanionMapper.java` (+thinking), `config/CompanionProperties.java` (+Hypotheses), `FeaturesConfiguration` (+switch), `application.yml`; contract `companion.yml` (+thinking) + regen.

**Backend test:** `HypothesisPipelineServiceIT` (survivor/discard/revise/dedupe/rejected-skip/broken-JSON), `HypothesisJobSwitchOffIT`, `CompanionPropertiesIT` (+bindings), `CompanionRealWiringIT` (smart client constructs).

**Frontend:** `patternsApi.ts` (map thinking), regen types; tests touch-up.

**Docs:** `companion.md` (V3.2 block/status/config/§4), roadmap, this plan.

---

### Task 1: smart-tier port + fake markers
- [ ] `CompanionLlm.completeSmart(system, user)`; Gemini adapter second ChatClient (`llm.smartModel`); fake routes smart calls through the same marker dispatch.
### Task 2: pipeline + job + config
- [ ] `HypothesisPipelineService.run(userId)` stages (gather/propose/critique/score/route/persist+dedupe) + `HypothesisJob` cron; `Hypotheses(cron, maxPerRun 3, keepThreshold 0.75, reviseThreshold 0.50)`.
### Task 3: contract + envelope + mapper + FE map
- [ ] `PatternCritiqueEnvelope.reasoning`; `PatternResponse.thinking` additive; regen; FE `toPattern` maps thinking.
### Task 4: tests + gates + docs + close
- [ ] ITs per file map; both gates; docs; review workflow → merge → live verify → `bd close mezo-fnnq.13`.

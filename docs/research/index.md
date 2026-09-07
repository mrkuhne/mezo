---
title: Research Wiki — Catalog
type: summary
updated: 2026-09-06
tags: [tooling]
related: [SCHEMA.md, log.md, README.md]
---

# Research Wiki — Catalog

The catalog of every page in `docs/research/`, by section. Read this (with [`SCHEMA.md`](SCHEMA.md)
and the tail of [`log.md`](log.md)) before any INGEST / QUERY / LINT. Pages are filed here on first
ingest.

## Entities

- [Matthew Walker](entities/matthew-walker.md) — *Why We Sleep* / UC Berkeley; the DOAC interview source behind mezo's Sleep cluster (QQRT, regularity, debunks). `confidence: medium`.
- [Jeremy Ethier](entities/jeremy-ethier.md) — kinesiology-based fitness educator; the morning-routine video that seeded the habit engine. `confidence: medium`.
- [Hermes Agent](entities/hermes-agent.md) — Nous Research terminal agent; mezo's local-LLM harness (ADR 0029); capabilities + verified v0.20.4 quirks. `confidence: high`.
- [LM Studio](entities/lm-studio.md) — local model host/server; MLX KV-checkpointing engine, agent-relevant settings + CLI limits. `confidence: high`.
- [Qwen 3.x model line](entities/qwen3-model-line.md) — 3.6/3.8/Coder-Next; hybrid-attention cheap KV, benchmark standing, mezo roles. `confidence: high`.
- [Exist.io](entities/exist-io.md) — personal-analytics aggregator with no goal object, only a rolling median baseline; the source behind mezo's life-goal `baseline` pillar kind, and the one entry with a debunked citation. `confidence: medium`.

## Concepts

- [Sleep Regularity](concepts/sleep-regularity.md) — "regularity is king"; UK Biobank −49/−57/−39, beats quantity; drives the ±15 min regularity score. `confidence: medium`.
- [QQRT](concepts/qqrt.md) — Quantity·Quality·Regularity·Timing; the four legs and how each maps to a mezo surface. `confidence: medium`.
- [Sleep Debunks](concepts/sleep-debunks.md) — the myth list (smart-wake, blue light, magnesium, melatonin, Z-drugs) mezo deliberately builds nothing on. `confidence: medium`.
- [Morning Routine (Ethier six recs)](concepts/morning-routine.md) — the six morning recs → their mezo habits; the Walker/Ethier division of labor. `confidence: medium`.
- [Program-Design Rules (RP·Helms·Nippard·Ethier)](concepts/program-design-rules.md) — 1-3 gyakorlat/izom/edzés, 2-4 szett/gyakorlat, heti 2-5 variancia, rep-zóna 25/50/25, MEV/MAV/MRV tábla; a guided-building epic (mezo-oyhy) szabálybázisa. `confidence: medium`.
- [Set-Volume Landmarks](concepts/set-volume-landmarks.md) — failure (5–12 set/hét) vs volume (12–20) styles, ~11 set/session cap, frequency fix; the source numbers behind the Train set-budget layer (mezo-7rdg). `confidence: medium`.
- [LLM quantization for agentic use](concepts/llm-quantization-for-agents.md) — why 4-bit specifically hurts tool-calling; the 6–8-bit policy behind ADR 0029. `confidence: medium`.
- [Goal-Type Taxonomies](concepts/goal-type-taxonomies.md) — Strides' four tracker archetypes (Habit/Target/Average/Milestone) plus Exist's baseline; mezo's five life-goal pillar kinds, and a naming correction on the project's own spec. `confidence: medium`.
- [PERMA and Wellbeing Taxonomies](concepts/perma-and-wellbeing-taxonomies.md) — PERMA-Profiler adopted as mezo's PERMAH life-area split; Gallup Wellbeing 5 and Ryff rejected as UI taxonomies, not as science. `confidence: low`.
- [Goal Conflict](concepts/goal-conflict.md) — Gorges & Grund 2017 is a narrative review with no pooled effect size, not the effect-size study mezo's own spec cites it as; still the source for surfacing conflict as a companion warning, not a gate. `confidence: medium`.
- [Goal-Pursuit Evidence](concepts/goal-pursuit-evidence.md) — Harkin et al. 2016 (progress monitoring), Gollwitzer & Sheeran 2006 (implementation intentions), Niemiec/Ryan/Deci 2009 (intrinsic vs extrinsic aspirations); feeds decisions D1 and D8 of the life-goal spec. `confidence: low`.
- [Trend Arrows and Baselines](concepts/trend-arrows-and-baselines.md) — Apple Fitness Trends, Exist, and others behind mezo's 7-vs-21-day trend arrow; corrects the spec's own description of Apple's 90-vs-365/6-month shape. `confidence: medium`.
- [Idempotent Daily Recompute](concepts/idempotent-daily-recompute.md) — uhabits' smoothing + Habitica's double-cron failure mode behind mezo's `(pillar, day)` upsert guard; the real justification for the resync window Exist.io was wrongly cited for. `confidence: medium`.

## Comparisons

- [Plan-builder guidance UX](comparisons/plan-builder-guidance-ux.md) — RP app vs Alpha Progression vs Hevy vs Juggernaut vs Fitbod terv-építési guidance; a piaci rés, amit a mezo befoglalhat. `confidence: medium`.
- [Hermes memory providers](comparisons/hermes-memory-providers.md) — Hindsight vs Honcho vs ByteRover vs Holographic vs Mem0/OpenViking/cloud-only; why Hindsight local embedded. `confidence: medium`.
- [Local coding models on 128 GB M5 Max](comparisons/local-coding-models-128gb-m5max.md) — the mid-2026 field (Qwen line, Coder-Next, MiniMax, gpt-oss, Gemma 4, Hermes 4) behind ADR 0029's choice. `confidence: medium`.
- [Companion chat-model re-baseline (2026-09)](comparisons/companion-chat-model-rebaseline-2026-09.md) — a 42 magyar esetes tool-selection mérés gemini-2.5-flash / gpt-5.6-luna / gpt-5.6-terra hármason; a default chat-modell go/no-go kapuja (mezo-ozri.3). `confidence: medium`.

## Queries

- [Goal engine — grounded numbers (TDEE, activity energy, muscle/strength retention)](queries/2026-06-18-goal-engine-numbers.md) — sport-science constants for the goal engine; consumed by the goal-system spec §6. `confidence: high`.
- [Warm-up protocol for near-failure sets](queries/2026-08-03-warmup-protocol.md) — 50/70/90% ladder az első gyakorlathoz, feeder/none utána; evidence + app-scheme sweep; feeds the warm-up feature. `confidence: high`.
- [Free exercise image/video APIs](queries/2026-08-05-exercise-media-apis.md) — free-exercise-db (public domain stills) vs wger (CC-BY-SA) vs ExerciseDB (AGPL/paid GIFs) vs YouTube embeds; why motion stays on YouTube and what an image layer would cost. `confidence: high`.

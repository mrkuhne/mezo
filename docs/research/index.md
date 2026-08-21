---
title: Research Wiki — Catalog
type: summary
updated: 2026-08-21
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

## Concepts

- [Sleep Regularity](concepts/sleep-regularity.md) — "regularity is king"; UK Biobank −49/−57/−39, beats quantity; drives the ±15 min regularity score. `confidence: medium`.
- [QQRT](concepts/qqrt.md) — Quantity·Quality·Regularity·Timing; the four legs and how each maps to a mezo surface. `confidence: medium`.
- [Sleep Debunks](concepts/sleep-debunks.md) — the myth list (smart-wake, blue light, magnesium, melatonin, Z-drugs) mezo deliberately builds nothing on. `confidence: medium`.
- [Morning Routine (Ethier six recs)](concepts/morning-routine.md) — the six morning recs → their mezo habits; the Walker/Ethier division of labor. `confidence: medium`.
- [Program-Design Rules (RP·Helms·Nippard·Ethier)](concepts/program-design-rules.md) — 1-3 gyakorlat/izom/edzés, 2-4 szett/gyakorlat, heti 2-5 variancia, rep-zóna 25/50/25, MEV/MAV/MRV tábla; a guided-building epic (mezo-oyhy) szabálybázisa. `confidence: medium`.
- [Set-Volume Landmarks](concepts/set-volume-landmarks.md) — failure (5–12 set/hét) vs volume (12–20) styles, ~11 set/session cap, frequency fix; the source numbers behind the Train set-budget layer (mezo-7rdg). `confidence: medium`.
- [LLM quantization for agentic use](concepts/llm-quantization-for-agents.md) — why 4-bit specifically hurts tool-calling; the 6–8-bit policy behind ADR 0029. `confidence: medium`.

## Comparisons

- [Plan-builder guidance UX](comparisons/plan-builder-guidance-ux.md) — RP app vs Alpha Progression vs Hevy vs Juggernaut vs Fitbod terv-építési guidance; a piaci rés, amit a mezo befoglalhat. `confidence: medium`.
- [Hermes memory providers](comparisons/hermes-memory-providers.md) — Hindsight vs Honcho vs ByteRover vs Holographic vs Mem0/OpenViking/cloud-only; why Hindsight local embedded. `confidence: medium`.
- [Local coding models on 128 GB M5 Max](comparisons/local-coding-models-128gb-m5max.md) — the mid-2026 field (Qwen line, Coder-Next, MiniMax, gpt-oss, Gemma 4, Hermes 4) behind ADR 0029's choice. `confidence: medium`.

## Queries

- [Goal engine — grounded numbers (TDEE, activity energy, muscle/strength retention)](queries/2026-06-18-goal-engine-numbers.md) — sport-science constants for the goal engine; consumed by the goal-system spec §6. `confidence: high`.
- [Warm-up protocol for near-failure sets](queries/2026-08-03-warmup-protocol.md) — 50/70/90% ladder az első gyakorlathoz, feeder/none utána; evidence + app-scheme sweep; feeds the warm-up feature. `confidence: high`.
- [Free exercise image/video APIs](queries/2026-08-05-exercise-media-apis.md) — free-exercise-db (public domain stills) vs wger (CC-BY-SA) vs ExerciseDB (AGPL/paid GIFs) vs YouTube embeds; why motion stays on YouTube and what an image layer would cost. `confidence: high`.

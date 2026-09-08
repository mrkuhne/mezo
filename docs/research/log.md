---
title: Research Wiki — Action Log
type: summary
updated: 2026-06-14
tags: [tooling]
related: [SCHEMA.md, index.md]
---

# Research Wiki — Action Log

Append-only log of INGEST / QUERY / LINT actions against `docs/research/`. Newest entries at the
bottom. Rotate (archive the head) when this passes ~500 lines. Format: `YYYY-MM-DD · OP · summary`.

- 2026-06-14 · INIT · research wiki scaffolded (SCHEMA, index, README, `raw/` + page-type dirs).
- 2026-06-18 · QUERY · goal-engine grounded numbers (TDEE/activity-energy/muscle+strength guards) filed in `queries/`; sourced via workflow wf_4ac5f005-710 (13 agents, web, adversarially verified). Consumed by goal-system spec §6. Follow-up: full entity/concept ingestion (mezo-2hp child).
- 2026-07-24 · INGEST · Walker DOAC interview + Ethier morning-routine video (extraction notes → raw/transcripts) distilled into 2 entities + 4 concepts; tag 'sleep' added to taxonomy. Consumed by slice C3 stat deck (mezo-hd8k).
- 2026-08-02 · INGEST · Ethier 'fastest 20 lb muscle' video (ehQ_5TThkRI, extraction notes → raw/transcripts) distilled into concepts/set-volume-landmarks + jeremy-ethier entity update; drives the Train set-budget layer (mezo-7rdg).
- 2026-08-03 · QUERY · warm-up protocol for RIR 0-2 sets filed in queries/ (3-agent web sweep: coaches + literature + app schemes); feeds the warm-up prescription feature.
- 2026-08-03 · INGEST · program-design rules concept + plan-builder guidance UX comparison filed (3-agent sweep: RP guides, Helms/Nippard/Ethier templates, app UX); seeds the guided-meso-building epic mezo-oyhy.
- 2026-08-05 · QUERY · free exercise image/video API scan filed in queries/ (free-exercise-db · wger · ExerciseDB · WorkoutX · YouTube embeds; endpoints verified live with curl). Context: the kettlebell catalog block mezo-18g3 — media layer is additive, not blocking.
- 2026-08-21 · INGEST · two agent web-research reports (Hermes agent capabilities; local-LLM landscape on 128 GB M5 Max) → raw/articles, distilled into 3 entities (hermes-agent, lm-studio, qwen3-model-line) + 1 concept (llm-quantization-for-agents) + 1 comparison (local-coding-models-128gb-m5max). Drives ADR 0029 + the Hermes local-LLM workflow (mezo-zjtm).
- 2026-08-21 · INGEST · Hermes docs digest (kanban/worker lanes/tools/delegation/goals/tips) + memory-providers & SOUL/USER research → raw/articles; hermes-agent entity extended (orchestration subsystems, prompt assembly), new comparison hermes-memory-providers. Drives infra doc §7 + mezo-zjtm.4/.5/.6/.7.
- 2026-09-06 · INGEST · two agent web-research reports (life-goal prior art; life-goal engine prior art) → raw/articles/2026-09-06-lifegoal-prior-art-research.md + raw/articles/2026-09-06-lifegoal-engine-prior-art-research.md, distilled into 1 entity (exist-io) + 6 concepts (goal-type-taxonomies, perma-and-wellbeing-taxonomies, goal-conflict, goal-pursuit-evidence, trend-arrows-and-baselines, idempotent-daily-recompute); tag 'goals' added to taxonomy. Feeds the source citations behind specs `2026-09-02-lifegoal-system-design.md` §2 and `2026-09-03-lifegoal-slice2-motor-design.md` §2. Drives mezo-iizd.13. Surfaced four spec-vs-source corrections worth a re-read: Strides' fourth archetype is Milestone not "Project", Apple Trends is 90-vs-365-day/6-month-minimum (mezo's 7-vs-21 is a deliberate shortening, not a mirror), the `kb.exist.io/article/55` citation for Exist's "rolling re-sync window" claim does not support it at all, and Gorges & Grund 2017 is a narrative review with no pooled effect size.
- 2026-09-07 · MEASURE · tool-selection eval re-baseline indult (mezo-ozri.3): az incumbent gemini-2.5-flash 42 esetes futása raw/measurements alá mentve, comparison lap nyitva a három modellre. Mindhárom modell lemérve (a 429 no-credits blokkoló ugyanaznap elhárult). Mellékleletek: a mérőpad kapuja provider-tudatos lett, és a padot futtatva kiderült, hogy a `Mi vár még ma a teremben?` eset COMPANION_EMPTY_ANSWER-t dob az incumbenten is.
- 2026-09-07 · MEASURE · a re-baseline lezárva: gpt-5.6-luna (90,5% exact / 0 hiba / p95 5591 ms / $0,00047 per sikeres akció) és gpt-5.6-terra (95,2% / 0 kritikus / p95 8092 ms / $0,0047) raw captures + vak hangnem A/B (2 bíró x 2 jelölt, 42 pár). Döntés: luna a default chat, terra a smart tier. Közben kiderült egy éles hiba: a GPT-5.6 a /v1/chat/completions-ön elutasítja a function toolt reasoning_efforttal együtt — mind a 42 eset elbukott rajta, javítva (reasoning_effort=none csak a tool-úton). Ez kiüti a spec Q1 minőség-karját a chat-úton; S4 (mezo-ozri.4) dolga.

- 2026-09-08 · INGEST / QUERY · Nine short primary-source excerpts captured; queries/mezo-ux-direction.md records reference transfer, local mock UI observations, navigation audit limits and three proposed directions. mezo-88jw.1; no design selected, no product code changed.

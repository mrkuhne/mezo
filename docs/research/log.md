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

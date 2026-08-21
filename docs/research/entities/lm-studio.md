---
title: LM Studio
type: entity
updated: 2026-08-21
tags: [tooling]
related: [hermes-agent, qwen3-model-line]
sources: [raw/articles/2026-08-21-hermes-agent-deep-research.md, raw/articles/2026-08-21-local-llm-landscape-m5max-deep-research.md]
confidence: high
---

# LM Studio

Desktop local-LLM runner + OpenAI-compatible server; mezo's model host for the
[Hermes agent](hermes-agent.md) flow ([setup doc](../../infrastructure/local-llm-hermes-lmstudio.md)).

## Load-bearing facts

- Dual engine (llama.cpp/GGUF + **MLX**), auto-switching; `lms` CLI for models/server/runtimes.
- **mlx-engine ≥1.8.5 (2026-06)** is the agentic milestone: disk-backed **KV-cache
  checkpointing** at 256-token boundaries + continuous batching — built for agent loops
  that rewind/extend prompts (2.2× throughput at 4 concurrent, −82% extra RAM on 33K
  prompts, benchmarked on Qwen3.6-27B). Our install: 1.11.0 "nax" (M5 Neural Accelerators).
- **Context length is a load-time model setting** and defaults far below model max — must
  be raised (mezo: 262144) *before* loading, or Hermes rejects the model.
- JIT loading: first API request loads the selected variant; idle TTL unloads (60 min).
- CLI limitation (2026-08): `lms load` loads the *selected* variant only — variant
  selection (GGUF vs MLX, quant) is a GUI action.
- ≥0.3.6 for reliable function calling; ≥0.3.31 for MiniMax tool-call format.

## Settings that matter for agent use (verified on our machine)

Reasoning effort Medium default; thinking + preserve-thinking on (Qwen); sampling per model
card; **system-prompt field empty** (the harness sends its own); unified KV cache +
context checkpoints on. See the [quantization concept](../concepts/llm-quantization-for-agents.md)
for why weights stay at 6–8-bit.

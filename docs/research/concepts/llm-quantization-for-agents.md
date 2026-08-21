---
title: LLM quantization for agentic use
type: concept
updated: 2026-08-21
tags: [tooling, technique]
related: [../entities/qwen3-model-line.md, ../entities/lm-studio.md]
sources: [raw/articles/2026-08-21-local-llm-landscape-m5max-deep-research.md]
confidence: medium
---

# LLM quantization for agentic use

Why mezo's local stack runs **6–8-bit weights and never 4-bit for tool-calling work**
(when RAM allows — 128 GB does).

## The mechanism

Benchmark deltas understate agentic damage: Q4_K_M loses only ~1.5–3% on benchmarks, but
the loss concentrates in **structured output, multi-step reasoning, and long agent loops** —
exactly the tool-calling path. Q6_K ≈ 0.5–1.5% (rarely observable); Q8_0 ≈ negligible.

- Direct evidence: a documented Qwen3.6 agent deployment saw recurring tool-call/format
  errors at Q4_K_M drop to multi-day intervals after switching to Q6.
- Unsloth recommends Q4_K_XL/Q6_K_XL "for frequent tool calls" — these keep **attention
  layers at higher precision**; small-active-parameter MoEs (3B active) are the most
  quant-sensitive (router/attention precision matters).
- 4-bit RTN MLX ≈ GGUF Q4 in quality; calibrated variants (imatrix GGUF, MLX DWQ) beat
  naive RTN at 4-bit. On Apple Silicon, AWQ/GPTQ are irrelevant (GPU-server formats).
- **KV cache**: 8-bit is the agent-safe compression; 4-bit KV has anecdotal tool-call
  degradation (unverified quantitatively).

## mezo application

27B-class → MLX 8-bit (~30 GB). 80B-A3B MoE (Coder-Next) → 6-bit (~66 GB), not the 4-bit
copy on disk. Only a 100 GB+ model (MiniMax-M2.7 class) justifies accepting 4-bit — see the
[128 GB model comparison](../comparisons/local-coding-models-128gb-m5max.md). Enforced via
the [LM Studio](../entities/lm-studio.md) load settings in the
[setup doc](../../infrastructure/local-llm-hermes-lmstudio.md).

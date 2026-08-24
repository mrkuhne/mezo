---
title: Local coding models on a 128 GB M5 Max (mid-2026)
type: comparison
updated: 2026-08-21
tags: [tooling]
related: [../entities/qwen3-model-line.md, ../entities/lm-studio.md, ../concepts/llm-quantization-for-agents.md]
sources: [raw/articles/2026-08-21-local-llm-landscape-m5max-deep-research.md]
confidence: medium
---

# Local coding models on a 128 GB M5 Max (mid-2026)

The field behind [ADR 0029](../../decisions/0029-local-llm-hermes-agent-stack.md)'s model
choice. Decode is bandwidth-bound (M5 Max ≈ +28% vs M4 Max, ~600 GB/s); prefill is
compute-bound and M5's GPU Neural Accelerators give 3.3–4.1× faster TTFT under MLX.

| Model | Fit @ 128 GB | Speed (est.) | Agentic coding | Verdict for mezo |
|---|---|---|---|---|
| [Qwen3.8-27B / 3.6-27B](../entities/qwen3-model-line.md) 8-bit | ~30 GB, huge ctx headroom | ~25–35 tok/s (extrapolated) | SWE-V 77.2 (3.6) — best per-token | **chosen** (spec/plan + chat) |
| Qwen3-Coder-Next 80B-A3B 6-bit | ~66 GB | ~40–50 tok/s | SWE-V 70.6, agent-harness favorite | **Phase-2 implementation** |
| MiniMax-M2.7 (230B-A10B) UD-IQ4_XS | 108 GB — tight | ~15 tok/s | SWE-Pro 56.2 — local quality ceiling | rejected for now (slow, forces 4-bit) |
| gpt-oss-120b (117B MoE) | ~60–65 GB | good | strong reasoning; tool-call flakiness reports in coding harnesses | reasoning alternate, unused |
| GLM-4.7-Flash (30B-A3B) | ~20 GB | very fast | SWE-V 59.2 — budget tier | outclassed at this RAM |
| Gemma 4 31B | ~31 GB @ 8-bit | ok | τ²-bench 86.4 (best tool-use generalist), not a SWE leader | possible later reviewer role |
| Hermes 4 70B (dense Llama-3.1) | ~58 GB @ Q6 | **~18 tok/s** decode, multi-minute cold prefill | weak (2025 model) | rejected |
| GLM-4.7 full / GLM-5.1 / Kimi K3 | do not fit | — | — | API-only territory |

Unverified/flagged: dense-27B M5 Max tok/s (extrapolated); Gemma 4 SWE-bench (no
first-party number); throughput thread's chip label ("M4 Ultra"). Format choice
(MLX over GGUF on M5) and quant policy: see [LM Studio](../entities/lm-studio.md) and
[quantization for agents](../concepts/llm-quantization-for-agents.md).

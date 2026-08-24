---
title: Qwen 3.x model line (3.6 / 3.8 / Coder-Next)
type: entity
updated: 2026-08-21
tags: [tooling]
related: [hermes-agent, lm-studio]
sources: [raw/articles/2026-08-21-local-llm-landscape-m5max-deep-research.md]
confidence: high
---

# Qwen 3.x model line (3.6 / 3.8 / Coder-Next)

Alibaba's Apache-2.0 open-weight line — the backbone of mezo's local-LLM stack
([ADR 0029](../../decisions/0029-local-llm-hermes-agent-stack.md)). Shared architecture
trait: **hybrid attention** (3:1 Gated DeltaNet linear layers : full Gated Attention),
which makes long context cheap — **~3–7 GB KV at 128–260K tokens** (~4× less than a pure
transformer). All: **262,144 native context** (YaRN → ~1M, not worth it for coding).

| Model | Type | Released | Agentic-coding standing | mezo role |
|---|---|---|---|---|
| **Qwen3.8-27B** | dense 27B, thinking (effort levels), vision | 2026-08-14 | SWE-bench Pro 61.7 · Terminal-Bench 2.1 73.0 · LCB v6 90.3 | **primary** (passed smoke gate 2026-08-21) |
| **Qwen3.6-27B** | dense 27B, thinking | 2026-04-22 | **SWE-bench V 77.2** — best open dense coder | fallback, downloaded |
| **Qwen3-Coder-Next** | MoE 80B-A3B, non-thinking | 2026-02-03 | SWE-V 70.6; RL-trained on 800K executable tasks; community-favorite agent backbone; fast decode (3B active) | Phase-2 implementation model (6-bit) |
| Qwen3.6-35B-A3B | MoE 35B-A3B, thinking, vision | 2026-04-16 | SWE-V 73.4 | not used (27B dense fits and scores higher) |

## Operating notes

- Sampling (model cards): thinking temp 1.0 / top-p 0.95 / top-k 20 (3.8); coding
  temp 0.6 (3.6); Coder-Next temp 1.0 / top-k 40.
- "Thinking Preservation" (3.6+) keeps reasoning across turns — built for agent sessions;
  pairs with [LM Studio](lm-studio.md) KV checkpointing.
- Quant sensitivity: small-active-parameter MoEs (3B active) degrade more at 4-bit than
  dense — see [quantization for agents](../concepts/llm-quantization-for-agents.md).
- Watch item: Qwen3.8 was 1 week old at adoption — runtime/template fixes may still land
  in LM Studio updates.

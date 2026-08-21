# 0029 — Local-LLM development flow on Hermes agent + LM Studio

- **Status:** Accepted
- **Date:** 2026-08-21
- **Driver:** mezo-zjtm

## Context

Daniel wants to shift as much mezo development as possible to locally run LLMs on the
M5 Max / 128 GB MacBook Pro (LM Studio installed), keeping Claude as the fallback for work
the local model cannot handle. The Claude workflow to mirror is the superpowers process:
brainstorming → spec → plan → sliced execution, under the full house rules (bd, docs/,
self-PR + CI gate). Design spec:
[`2026-08-21-hermes-local-llm-workflow-design.md`](../superpowers/specs/2026-08-21-hermes-local-llm-workflow-design.md);
research base: two ingested reports (Hermes agent capabilities; 2026 local-model landscape)
under [`docs/research/raw/articles/`](../research/raw/articles/).

## Decision

- **Harness:** NousResearch **Hermes agent** (v0.20.x), native install, single default
  profile. It reads `AGENTS.md` natively, supports repo-local skills (agentskills.io,
  trust-gated under `.agents/skills/`), subagents, worktree mode, and automatic context
  compression.
- **Serving:** **LM Studio** with the **MLX** engine (mlx-engine ≥1.8.5; installed 1.11.0
  "nax" — uses the M5 GPU Neural Accelerators), server on `:1234`, context **262144**,
  KV-cache checkpointing on.
- **Models:** primary **Qwen3.8-27B MLX 8-bit** (passed the smoke gate: stable tool calls,
  no reasoning leakage, good spec-dialogue output); fallback **Qwen3.6-27B MLX 8-bit** kept
  downloaded; **Qwen3-Coder-Next 80B-A3B** (already on disk at 4-bit; re-download at 6-bit
  before use) planned as the Phase-2 implementation model. Weights 6–8-bit — never 4-bit
  for tool-calling work; reasoning effort default Medium.
- **Roles as skills, not agents:** 5 process skills (superpowers ports) + 5 thin domain
  skills in `.agents/skills/`; one agent at a time.
- **Full house rules apply** to local-agent output — bd, docs/ obligations, feat-branch +
  self-PR + CI gate (the CI gate doubles as the safety net for local-model mistakes).
- **Staged rollout with A/B gates:** Phase 1 chat + spec/plan (accept when local output is
  ≤ one editing pass from Claude's); Phase 2 low-risk implementation; Phase 3 test/review.
  **Escalation rule:** 2 stalls on a slice or 2 same-cause CI reds → the slice goes to
  Claude; escalations logged as bd comments (the dataset for what stays local).

## Consequences

- Easy: swapping models under an unchanged flow (LM Studio reload); porting skills (the
  agentskills.io format is Claude-Code-compatible); auditing local-agent work (same bd/PR
  trail as Claude's).
- Harder: two harness-specific instruction surfaces to keep coherent (`CLAUDE.md` pointer +
  `AGENTS.md` core — mitigated by making `AGENTS.md` the single source); LM Studio model
  switching is manual; `hermes -z` one-shot mode starts its shell in `$HOME` (v0.20.4), so
  agent work must run via the interactive TUI started from the repo.
- We now maintain: `.agents/skills/` (bd-tracked), the Hermes config
  (`~/.hermes/config.yaml`), and the setup doc
  [`local-llm-hermes-lmstudio.md`](../infrastructure/local-llm-hermes-lmstudio.md).

## Alternatives considered

- **Hermes 4 70B as the model** — a year old, weak at coding, dense-70B ≈ 18 tok/s on
  Apple Silicon; the Hermes *agent* does not need a Hermes *model*.
- **MiniMax-M2.7 (quality ceiling)** — forces 4-bit (108 GB), ~15 tok/s; rejected for now.
- **Per-role model matrix (spec/impl/review each with own model+profile)** — maintenance
  cost; process quality dominates model choice at this scale; revisit after Phase 2.
- **Docker-first Hermes** — needless friction; the pluggable `terminal backend: docker`
  remains available for sandboxing later.
- **GGUF/llama.cpp as engine** — M5 Neural Accelerators favor MLX (3.3–4.1× prefill);
  llama.cpp Metal support lagged on M5.

## Amendment 2026-08-21 — planner model after the Phase-1 A/B

The Phase-1 A/B (`mezo-zjtm.3`, W1.3 plan) reversed the primary/chat split: **Qwen3.8-27B**
failed twice to produce a plan — root cause measured afterwards: LM Studio does **not stream
tool-call arguments** (a 120-line `write_file` = 167 s of silence; a 1 700-line plan at the
27B's ~20 tok/s ≈ 40 min), so Hermes's 900 s stale-stream watchdog killed and retried the
write; the 35B-A3B only survived because it writes 2–3× faster. Mitigations: chunked writes
(≤150 lines per tool call, in the skills) + `agent.local_stream_stale_timeout: 2400`, while **Qwen3.6-35B-A3B** delivered a full plan in
12 minutes with zero hallucinated files and defects fixable in one editing pass. Decision:
35B-A3B is the work model (plan + implementation + chat); 3.8-27B is kept for short-context
review. Phase 2 (low-risk implementation slices) is **GO** on 35B-A3B behind the CI gate.
Evidence: [`2026-08-21-w13-gratitude-LOCAL.md`](../superpowers/plans/2026-08-21-w13-gratitude-LOCAL.md)
vs [`2026-08-21-w13-gratitude.md`](../superpowers/plans/2026-08-21-w13-gratitude.md).

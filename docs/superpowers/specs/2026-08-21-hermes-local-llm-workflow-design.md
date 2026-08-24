# Hermes agent + local LLM development workflow (design)

- **Date:** 2026-08-21
- **Driver:** epic `mezo-zjtm`
- **Status:** approved design, pre-implementation
- **Hardware:** MacBook Pro M5 Max, 128 GB unified memory, LM Studio installed

## 1. Goal

Build a local-LLM development flow for mezo that mirrors the Claude + superpowers workflow
(spec → plan → sliced implementation → review, under the full house rules), running through the
**Hermes agent** (NousResearch) with models served by **LM Studio**.

**Ambition level:** hand over as much work as possible to the local flow; Claude remains the
fallback for work the local model cannot handle. Rollout is staged (§8) — first chat/rubber-duck
and spec/plan writing, implementation and test/review later — with an explicit A/B measurement
gate before each expansion.

**Integration rule (decided):** the local flow operates under the **full house rules** — bd
issues, `docs/` obligations, `feat/` branch + self-PR + CI gate, worktree isolation. The CI gate
matters *more* here, not less: it is the safety net against local-model mistakes.

**Parallelism (decided):** one agent at a time. The whole 128 GB serves a single loaded model;
Hermes profiles / parallel agents are a later evolution, not part of this design.

## 2. Research findings the design rests on (2026-08-21)

Two web-research passes (Hermes agent capabilities; local-model landscape) produced these
load-bearing facts. Full reports to be ingested into `docs/research/` (§9).

**Hermes agent** (github.com/NousResearch/hermes-agent, MIT, v0.20.x, weekly releases):

- Terminal CLI agent in the Claude Code category; connects to **any OpenAI-compatible endpoint**;
  LM Studio is a first-class documented provider (`http://localhost:1234/v1`).
- Reads `AGENTS.md` and `CLAUDE.md` natively (subdirectory `AGENTS.md` discovered lazily).
- **Skills** follow the agentskills.io open standard — portable with Claude Code skills; the agent
  can also self-create/improve skills.
- Subagent delegation (`delegate_task`, isolated context), profiles (`hermes -p <name>`, isolated
  state), built-in **git-worktree mode**, MCP support (stdio + HTTP).
- Automatic context **compression** via an auxiliary model (`threshold`, `protect_last_n`, …);
  tool-output caps; FTS5 search over past sessions.
- **Hard requirement: model must report ≥64K context** — the #1 documented setup failure is
  LM Studio's default 4K context metadata; context length must be raised *before* loading.
- Docker image exists, but the idiomatic split is: Hermes native, optionally sandbox only the
  *shell execution* via `terminal backend: docker`.

**Model landscape** (verified against HF model cards / LM Studio / Unsloth, Aug 2026):

| Model | Type | Agentic-coding standing | Verdict for us |
|---|---|---|---|
| Qwen3.8-27B (2026-08-14) | dense hybrid (DeltaNet 3:1), 262K ctx, thinking, vision | SWE-bench Pro 61.7, Terminal-Bench 2.1 73.0 | **primary candidate** — 1 week old, needs smoke test |
| Qwen3.6-27B (2026-04) | dense hybrid, 262K ctx, thinking | **SWE-bench Verified 77.2** — best open dense coder | **proven fallback** |
| Qwen3-Coder-Next 80B-A3B (2026-02) | MoE, 3B active, 262K ctx, non-thinking | SWE-V 70.6; community favorite agent backbone; fast decode | **phase-2 implementation model** |
| Qwen3.6-35B-A3B | MoE, 3B active | SWE-V 73.4 | not needed (27B fits fine) |
| Gemma 4 31B / 26B-A4B | dense / MoE | strong tool-use generalist, not a SWE leader | optional later reviewer role |
| Hermes 4 70B (2025-08) | dense Llama-3.1 | outdated, weak coding, ~18 tok/s | **rejected** — the Hermes *agent* needs no Hermes *model* |
| MiniMax-M2.7 | 230B-A10B, 108 GB at 4-bit | local quality ceiling, ~15 tok/s | rejected for now (slow, forces 4-bit) |

**Format & quantization:**

- **MLX over GGUF on M5**: the M5 GPU Neural Accelerators give 3.3–4.1× faster prefill under MLX
  (llama.cpp lagged); LM Studio's mlx-engine ≥1.8.5 (2026-06) adds disk-backed KV-cache
  checkpointing + continuous batching built for agent loops (warm-cache re-prompt of 60K tokens
  ≈ 1 s).
- **Quantization: 6–8-bit, never 4-bit for tool-calling work** when RAM allows. Documented case:
  Qwen3.6 agent tool-call format errors at Q4_K_M nearly vanished at Q6. 27B-class → 8-bit
  (~30 GB); 80B-A3B MoE → 6-bit (~66 GB). KV cache 8-bit (4-bit KV has anecdotal tool-call
  degradation).
- **Context economics:** the Qwen hybrid architecture makes 128–260K context cost only ~3–7 GB of
  KV — 262K native context is genuinely affordable on this machine.

## 3. Model stack (LM Studio)

- **Primary:** `Qwen3.8-27B` **MLX 8-bit** — behind a smoke-test gate (§3a).
- **Fallback (kept downloaded):** `Qwen3.6-27B` MLX 8-bit. Both ~30 GB; switching is a 1-minute
  LM Studio reload.
- **Phase-2 implementation model (optional, later):** `Qwen3-Coder-Next` 80B-A3B MLX 6-bit.
- **No separate chat model.** The 27B at 8-bit is interactive enough (~30–40 tok/s class) to serve
  both task work and rubber-duck chat; one loaded model at a time.
- **LM Studio settings (before loading the model):** context length **262144**; KV cache 8-bit;
  mlx-engine ≥1.8.5; local server on `:1234`. Sampling per model card (Qwen3.8 thinking:
  temp 1.0 / top_p 0.95 / top_k 20).

### 3a. Smoke-test gate (Qwen3.8 vs fallback)

Run `hermes ping`, then one small multi-tool task (read files + edit + shell) and one spec-writing
dialogue. Watch for: (1) tool-call format stability over many turns, (2) thinking blocks leaking
into output, (3) LM Studio parsing the 3.8 chat template correctly, (4) context reported ≥64K to
Hermes. Any persistent failure → switch to Qwen3.6-27B and file the finding.

## 4. Hermes agent setup

- **Native install** (official installer), no Docker for the agent itself. Revisit
  `terminal backend: docker` later if shell sandboxing becomes desirable.
- **One profile** (default). No parallel agents in this design.
- `~/.hermes/config.yaml` essentials:
  - LM Studio provider (`type: openai`, `base_url: http://localhost:1234/v1`), model ID exactly as
    `GET /v1/models` reports it;
  - **explicit `context_length: 262144`** (name-based estimation is unreliable for local models);
  - compression on: `threshold: 0.50`, `protect_last_n: 20`, auxiliary summarizer pointed at the
    same local endpoint;
  - tool-output caps at defaults initially.

## 5. House-rules integration (mezo repo)

- **New `AGENTS.md` at repo root** — the agent-agnostic core of `CLAUDE.md` (bd workflow, git flow
  + CI gate, docs/ obligations, the backend/frontend convention trigger table), written for Hermes:
  no Claude-specific skill names; instead it names the Hermes skills of §6. `CLAUDE.md` keeps the
  Claude-specific parts and remains authoritative for Claude sessions. Shared content is
  maintained in `AGENTS.md`; `CLAUDE.md` references it rather than duplicating (exact split
  decided at implementation time — the rule is: **no drift-prone duplication**).
- **Unchanged:** bd for all tracking; `feat/<topic>` branch + self-PR + CI green + `--no-ff` local
  merge; `docs/` obligations (ADR / infrastructure / features / research); worktree isolation —
  using Hermes's built-in worktree mode.

## 6. Skills = the "roles"

The role list (spec writing, plan writing, API, backend, frontend, testing, deploy) is implemented
as **Hermes skills, not separate agents** (agentskills.io format, versioned in the repo so skill
development is itself bd-tracked work).

- **Process skills** — superpowers-inspired, simplified for a local model (shorter, more
  prescriptive, fewer degrees of freedom):
  - `brainstorming` — clarifying dialogue → spec in `docs/superpowers/specs/`, house format;
  - `writing-plans` — spec → sliced implementation plan in `docs/superpowers/plans/`;
  - `executing-plans` — slice-by-slice execution with per-slice checkpoints, fresh session per
    slice;
  - `tdd` — red/green/refactor discipline;
  - `verification-before-completion` — run the gates, evidence before claims.
- **Domain skills** — deliberately thin: each one points at the authoritative
  `docs/references/*.md` doc(s) and lists the non-negotiable gates:
  - `mezo-backend` (Java/Spring references table), `mezo-frontend` (frontend_conventions),
    `mezo-api-contract` (contract-first flow), `mezo-testing` (testing_standards +
    integration_test_framework), `mezo-deploy` (k3s/ArgoCD docs trigger).
- **Location:** wherever Hermes expects project-local skills (determined at implementation time);
  the repo is the source of truth.

## 7. Context management

The primary weapon is **process, not technology**: the existing superpowers discipline — small
slices, fresh session per slice, the plan lives in a file not in the conversation — is exactly
what makes a 262K local context sufficient. Reinforced by:

- Hermes automatic compression (safety net, §4 settings);
- subagent delegation for bulk file-reading research (isolated context);
- skills' progressive disclosure (knowledge loaded on demand);
- tool-output caps;
- cheap hybrid-architecture KV (§2) → no context anxiety at 262K.

## 8. Rollout phases + measurement

- **Phase 1 — chat + spec/plan writing (start here).** On a real upcoming `mezo-b3pp` slice the
  local flow writes the spec and plan; Claude writes the same independently; compare.
  **Acceptance bar:** the local output is at most "one editing pass" away from Claude's.
- **Phase 2 — low-risk implementation slices.** Well-specified, CI-protected slices, with
  Qwen3-Coder-Next as the implementation model.
- **Phase 3 — test + review work.**
- **Claude-fallback rule:** if the local agent stalls twice on a slice, or CI goes red twice from
  the same mistake, the slice escalates to Claude. Escalations are logged (bd notes) — they are
  the data for deciding what stays local.

## 9. Documentation obligations (house rules)

- **ADR** in `docs/decisions/`: local-LLM stack choice (Hermes agent + LM Studio + Qwen, MLX,
  6–8-bit, rejected alternatives).
- **`docs/infrastructure/`** doc: the full setup (LM Studio config, Hermes config, AGENTS.md
  split, skills layout, smoke-test procedure).
- **`docs/research/`**: ingest both research reports via the `knowledge-base` skill (Hermes agent
  capabilities; 2026 local-model landscape).

## 10. Risks & open questions

- **Qwen3.8 runtime immaturity** — mitigated by the smoke-test gate + kept fallback (§3a).
- **Skill-format drift** — agentskills.io compatibility is claimed, not yet verified hands-on;
  the superpowers skills may need real rewriting, not just copying. Planned as explicit work, not
  assumed free.
- **Local-model instruction-following ceiling** — a 27B may ignore parts of long house-rule
  documents; the thin-skill + prescriptive-process design (§6) exists precisely to shorten what it
  must hold; expect iteration.
- **LM Studio manual model switching** — acceptable at "one agent at a time"; revisit only if it
  becomes a felt friction.

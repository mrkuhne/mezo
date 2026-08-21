---
title: Hermes Agent
type: entity
updated: 2026-08-21
tags: [tooling]
related: [lm-studio, qwen3-model-line]
sources: [raw/articles/2026-08-21-hermes-agent-deep-research.md]
confidence: high
---

# Hermes Agent

Nous Research's open-source terminal AI agent (Claude Code category), MIT, Python 3.11+,
launched 2026-02; v0.20.4 as of 2026-08-18. **This is mezo's local-LLM harness** — see
[ADR 0029](../../decisions/0029-local-llm-hermes-agent-stack.md) and the
[setup doc](../../infrastructure/local-llm-hermes-lmstudio.md). Distinct from the (dated)
Hermes 4 *model* family — the agent runs on any OpenAI-compatible model.

## Load-bearing facts

- **Backends:** any OpenAI-compatible endpoint; [LM Studio](lm-studio.md) is first-class
  (`http://localhost:1234/v1`). Requires an instruct model with **native tool calling** and
  **≥64K reported context** (rejects less at startup — LM Studio's default context metadata
  is the #1 setup trap).
- **Instructions:** reads `AGENTS.md` + `CLAUDE.md` natively; `~/.hermes/SOUL.md` = persona;
  `.hermes.md` = workspace rules.
- **Skills:** agentskills.io standard (portable with Claude Code); repo-local skills load
  from `./.agents/skills` or `./.hermes/skills` after `hermes skills trust <repo>`; the
  agent can self-create/improve skills.
- **Structure:** subagents (`delegate_task`, isolated context, 3 concurrent default),
  profiles (`hermes -p`, isolated state), built-in git-worktree mode, MCP (stdio + HTTP),
  projects (`hermes project` — folder anchoring + kanban-bound worktree conventions).
- **Context:** auto-compression via auxiliary model (threshold 50%, protect_last 20 by
  default), tool-output caps, FTS5 session search.
- **Deploy:** native installer is idiomatic; Docker image exists; the *terminal backend* is
  separately pluggable (`local | docker | ssh | …`) for shell sandboxing.

## Verified quirks (v0.20.4, our install)

- `hermes -z` one-shot mode starts its shell in `$HOME` regardless of cwd/`--in`/active
  project — interactive TUI honors caller cwd. Agent work → TUI from the repo.
- `hermes doctor`'s "no API key for lmstudio" ✗ is cosmetic (placeholder auto-injected).
- No `hermes ping` subcommand despite third-party docs claiming it.

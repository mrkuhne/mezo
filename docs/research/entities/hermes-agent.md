---
title: Hermes Agent
type: entity
updated: 2026-08-21
tags: [tooling]
related: [lm-studio, qwen3-model-line, ../comparisons/hermes-memory-providers.md]
sources: [raw/articles/2026-08-21-hermes-agent-deep-research.md, raw/articles/2026-08-21-hermes-kanban-delegation-goals-tips-digest.md, raw/articles/2026-08-21-hermes-memory-providers-soul-user-research.md]
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

## Orchestration subsystems (docs digest, 2026-08-21)

- **Kanban** (`hermes kanban`, dashboard tab at `127.0.0.1:9119`): SQLite board, dispatcher
  inside the gateway, statuses `triage→todo→ready→running→blocked/review→done`; a `ready` card
  spawns a worker session in its workspace (`--workspace worktree --branch feat/x`), which must
  end with one terminator (`kanban_complete` / `kanban_request_review` / `kanban_block`).
  Config: `kanban.max_in_progress`, `review_dispatch`, `auto_decompose`. mezo stance:
  bd = system of record, kanban = dispatch queue (mezo-zjtm.4).
- **Delegation** (`delegate_task`): fresh-context children, `delegation.max_concurrent_children`
  (3), `worktree_isolation`, `base_url` may point at LM Studio (docs example).
- **Goals** (`/goal`, `/goal gate add <cmd>`): shell gates run before the judge; failing output
  becomes the continuation prompt — maps 1:1 onto verification-before-completion.
- **Prompt assembly order:** `SOUL.md` → tool/skills prompt → project files (`.hermes.md` →
  `AGENTS.override.md` → `AGENTS.md` → `CLAUDE.md`) → `MEMORY.md` → `USER.md` → provider block.
  SOUL = global identity (4–8 prescriptive lines); AGENTS.md = project; USER.md = user facts
  (1 375 ch); MEMORY.md = learned facts (2 200 ch); skills = procedures.

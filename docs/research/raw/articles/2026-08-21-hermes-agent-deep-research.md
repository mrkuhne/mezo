<!-- RAW SOURCE — immutable. Agent web-research report (Claude subagent, 2026-08-21),
     commissioned for the mezo local-LLM workflow design (epic mezo-zjtm).
     Ingest via the knowledge-base skill; do not edit content below. -->

# Hermes Agent — Research Report (as of 2026-08-21)

## 1. What it is

**Hermes Agent** is Nous Research's open-source, self-improving autonomous AI agent — same category as Claude Code / OpenAI Codex / OpenClaw. It runs as a terminal CLI/TUI on your machine, plus a native desktop app and messaging-platform gateways. Its differentiator is a built-in learning loop: it creates skills from experience, improves them during use, curates persistent memory, and searches its own past conversations.

- **Repo:** https://github.com/NousResearch/hermes-agent — maintainer Nous Research, **MIT license**, launched February 2026, written in Python (requires **Python 3.11+**; installer bundles it).
- **Current version:** **v0.20.4 (2026-08-18)**; v0.20.0 "The Herald Release" (2026-08-03) was the last major (added real-time voice, A2A v1.0 agent-to-agent protocol, desktop artifacts/plugin SDK). Release cadence is roughly weekly patches, monthly majors (https://github.com/NousResearch/hermes-agent/releases).
- Docs: https://hermes-agent.nousresearch.com/docs/. (A GitHub-star figure of "233.5k" appeared in one fetch — unverified, possibly a misread.)
- It is a **general autonomous agent**, not purely a coding agent — coding (file edit, shell, git) is a core toolset, but it also does messaging gateways, scheduling, voice, browser automation, image gen/TTS ("40+ tools").

## 2. Local LLM backends

Connects to **any OpenAI-compatible endpoint**. Officially documented providers (https://hermes-agent.nousresearch.com/docs/integrations/providers):

- **LM Studio** — first-class: `hermes setup` / `hermes model` has an explicit "LM Studio" provider option (since ~v0.14), endpoint `http://localhost:1234/v1`, API key blank/placeholder, model ID must match `GET /v1/models` exactly, context auto-detected from the server.
- **Ollama** (`http://localhost:11434/v1`) — caveat: Ollama's `/api/show` reports the model's *maximum* context, not the configured `num_ctx`, so set context explicitly in both places.
- **llama.cpp / llama-server** — needs `--jinja` for tool calling; recommended flags include `-fa on --cache-type-k q4_0 --cache-type-v q4_0` (quantized KV cache).
- **vLLM** — needs `--enable-auto-tool-choice --tool-call-parser hermes` (or `qwen`, `llama3_json`, `mistral`, `deepseek_v3`, …).
- **SGLang**, **MLX** (Mac guide covers an MLX server, "omlx"), **Unsloth's local server** (https://unsloth.ai/docs/integrations/hermes-agent), plus 20+ cloud providers (Nous Portal, OpenRouter, Anthropic, OpenAI, …).

**API expectations:** standard OpenAI chat-completions with **native tool/function calling** — must be an instruct/chat model; base models "output raw continuations without following tool-call schemas." Native tool-calling templates are listed for Qwen 2.5+, Llama 3.x, Mistral, DeepSeek, Functionary; other models fall back to generic handlers with reduced reliability. Hermes auto-detects local endpoints and relaxes streaming timeouts (read timeout 120s → 1800s, stale-stream detection off; env override `HERMES_STREAM_READ_TIMEOUT`). **Hard requirement: ≥64K context window** — Hermes rejects models reporting less at startup; in LM Studio you must raise Context Length (e.g. 65536) in the model settings before loading (default GGUF metadata often reports 2-4K — the docs call this the #1 failed-setup cause).

Config (`~/.hermes/config.yaml`):
```yaml
providers:
  my_local: { type: openai, base_url: "http://localhost:1234/v1", api_key: "" }
model: { provider: my_local, model: "<exact-id>", context_length: 131072 }
```

## 3. Customization: prompts, skills, agents, project files, MCP

- **System prompt / identity:** `~/.hermes/SOUL.md` (agent personality, slot #1 of the system prompt), `MEMORY.md` + `USER.md` (curated persistent memory), `.hermes.md` (workspace-local rules).
- **Project instruction files:** reads **`AGENTS.md`** and **`CLAUDE.md`** natively; subdirectory `AGENTS.md` files are discovered lazily during tool calls and injected into tool results (not front-loaded). Injection size governed by `context_file_max_chars`.
- **Skills:** on-demand knowledge documents with progressive disclosure, compatible with the **agentskills.io** open standard (portable across Hermes/Claude Code/Cursor/Codex). Unique bit: the agent **autonomously creates and improves skills** after complex tasks. Community directory: https://github.com/0xNyk/awesome-hermes-agent.
- **Subagents:** `delegate_task` tool spawns child agents with isolated context, restricted toolsets, own terminal sessions; default 3 concurrent (configurable); subagents share the parent's budget. v0.18 added Mixture-of-Agents; v0.20 added A2A v1.0.
- **MCP:** full support, stdio + HTTP transports, per-server tool filtering and sampling, configured under `mcp_servers:` in `config.yaml`.

## 4. Deployment & parallelism

- **Native:** `curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash` (Linux/macOS/WSL2/Termux); PowerShell installer for Windows.
- **Docker:** official image **`nousresearch/hermes-agent`** on Docker Hub (`latest` ~907 MB), plus repo `docker-compose.yml`. Separately, the agent's *terminal backend* (where commands execute) is pluggable: `local | docker | ssh | modal | daytona | vercel_sandbox | singularity` — i.e., you can run Hermes natively but sandbox its shell in a container.
- **Parallel instances:** `hermes -p <profile>` gives fully isolated `~/.hermes/<profile>/` state (config, skills, memory, sessions); built-in **git-worktree mode** (`worktree: true`) creates a fresh branch under `.worktrees/` per session for parallel agents on one repo; multiple gateway instances via `hermes -p X serve --port N`.

## 5. Context management

- **Automatic compression/summarization** via a separate auxiliary model: `compression:` block with `threshold: 0.50` (of context window), `target_ratio`, `protect_last_n: 20`, `protect_first_n: 3`, `tail_mode: legacy|lean`. The summarizer's context window must be ≥ the main model's. With a local main model you can point `auxiliary.compression` at the same local endpoint or a cheap cloud model.
- **Configurable `model.context_length`** (estimated from model name if unset — often wrong for local models; override explicitly).
- Long-session recall via FTS5 full-text search over past sessions + LLM summarization, Honcho user modeling, memory nudges/consolidation. Tool-output caps (`tool_output.max_bytes`, `file_read_max_chars`) limit context bloat. Iteration/budget controls: `agent.max_turns`, `run_budget_seconds`, `verify_on_stop`.

## 6. Built-in tools

File editing, terminal/shell execution (with command approval + container isolation), git integration, web search, browser automation (incl. cloud Browser Use), memory tools, `delegate_task`, `execute_code` (programmatic tool calling — collapses multi-step pipelines into one inference call, Python RPC access to tools), image generation, TTS, cron scheduler with delivery to any platform — "40+ tools", organized into per-platform toggleable toolsets. No dedicated "test runner" tool — tests run through the shell tool. Migration from OpenClaw: `hermes claw migrate`.

## 7. LM Studio on Apple Silicon — practices found

- Official Mac guide (https://hermes-agent.nousresearch.com/docs/guides/local-llm-on-mac) benchmarks llama.cpp (best TTFT, ~67ms) vs MLX (best generation, ~96 tok/s vs 70); recommends quantized KV cache (`q4_0` cuts 128K-context KV from ~16 GB to ~4 GB). It targets small RAM tiers (8/16/32 GB) — at 128 GB, 70B-class Q4 GGUF or large MLX models plus 128K context fit comfortably; the docs' "32 GB+: larger models or multiple parallel slots" is the applicable tier.
- LM Studio guides (https://www.aitooldiscovery.com/how-to/hermes-agent-lm-studio; https://hermes-agent.ai/features/local-llm-support): LM Studio ≥0.3.6 for reliable function calling; use `-mlx` model variants on M-series; set context ≥65536 in LM Studio's UI before loading; verify with `hermes ping`; expect 30-60s first-token prefill on big contexts ("a silent first turn is usually prefill, not a hang").
- Mid-2026 community model recommendations for Hermes Agent: Qwen3.5-27B / Qwen3.6 for coding-heavy sessions, Gemma 4 for general work, Qwen3-8B as budget option (https://lushbinary.com/blog/hermes-agent-qwen-3-6-setup-guide/, https://www.claudemarket.ai/blog/best-opensource-models-for-hermes). **Not verified:** any first-party doc recommending Hermes-branded models specifically; no specific community report of Hermes Agent + Hermes 4 70B + LM Studio on a 128 GB Mac was found.

## 8. Disambiguation

"Hermes agent" is unambiguous in mid-2026: it is **NousResearch/hermes-agent**, the agent harness (launched Feb 2026). It is *distinct from* the **Hermes 4 model family** (Nous's Aug-2025 open-weight reasoning/tool-calling models, incl. 70B) — the agent runs *on* any model; Hermes 4's tool-calling format is what vLLM's `--tool-call-parser hermes` implements, so Hermes 4 70B in LM Studio should satisfy the agent's native-tool-calling requirement, though no doc explicitly certifies that pairing. Other name collisions (an old "Hermes" HTML-to-Markdown lib, JS engine Hermes, etc.) are unrelated to agentic coding. Third-party docs sites (hermes-agent.ai, hermes-ai.net, hermesagents.net) are unofficial mirrors/fan docs — the authoritative sources are the GitHub repo and hermes-agent.nousresearch.com.

Sources: https://github.com/NousResearch/hermes-agent · https://github.com/NousResearch/hermes-agent/releases · https://hermes-agent.nousresearch.com/docs/user-guide/configuration · https://hermes-agent.nousresearch.com/docs/reference/faq · https://hermes-agent.nousresearch.com/docs/integrations/providers · https://hermes-agent.nousresearch.com/docs/user-guide/features/overview · https://hermes-agent.nousresearch.com/docs/guides/local-llm-on-mac · https://unsloth.ai/docs/integrations/hermes-agent · https://hub.docker.com/r/nousresearch/hermes-agent · https://www.aitooldiscovery.com/how-to/hermes-agent-lm-studio · https://github.com/0xNyk/awesome-hermes-agent

---
title: "Hermes Agent — memory providers and SOUL.md/USER.md best practices (agent web-research)"
type: article
source_url: https://hermes-agent.nousresearch.com/docs/user-guide/features/memory-providers (+ memory, personality, context-files, prompt-assembly, plugin READMEs, community posts) — agent research report
ingested: 2026-08-21
sha256: e3bd133fdfa87754b25de936f95eedd91262396293ce159a6fc5423913685f2a  # body below the frontmatter
---

<!-- RAW SOURCE — immutable. Agent web-research report (Claude subagent, 2026-08-21), commissioned for mezo-zjtm. Do not edit content below. -->

## A) Memory: built-in vs external providers

### Built-in (always on, local, free) — https://hermes-agent.nousresearch.com/docs/user-guide/features/memory
- Files: `~/.hermes/memories/MEMORY.md` (agent notes) and `USER.md` (user profile). Limits `memory_char_limit: 2200` (~800 tok), `user_char_limit: 1375` (~500 tok).
- Injected into the system prompt as a frozen snapshot at session start (volatile tier, after SOUL/skills/context files). Writes persist immediately but appear next session.
- `memory` tool: `add`, `replace` (old_text), `remove`; `target='user'` → USER.md. Write declarative facts, not imperatives.
- Over-limit writes return an error; agent must consolidate. Background review (`auxiliary.background_review.enabled`) can save memories / patch skills; `/refine` manual. `memory.write_approval: true` gates saves (`/memory pending|approve|reject`).
- `session_search`: FTS5 over `~/.hermes/state.db`, ~20 ms, on demand. Memory = always-present facts; session_search = recall.
- Query rewrite before provider recall via `auxiliary.memory_query_rewrite` (extra LLM call per turn when a provider is active).

### External providers — `memory.provider`, `hermes memory setup|status|off`; only one active; built-in stays active.
| Provider | Adds | Runs | Cost | Enable | Caveats |
|---|---|---|---|---|---|
| Honcho | dialectic user modeling, session summaries, semantic search | Cloud (app.honcho.dev) or self-hosted | paid cloud | `HONCHO_API_KEY`; `honcho.json` (cadences, recallMode, sessionStrategy per-directory recommended) | server runs its own LLM — undocumented which; privacy silent |
| OpenViking | tiered retrieval, `viking://` store | self-hosted server (AGPL) | free | `OPENVIKING_ENDPOINT` :1933 | needs own LLM/embedding config; LM Studio compat unverified |
| Mem0 | LLM fact extraction, semantic search | cloud / self-host / OSS in-process | platform paid | `hermes memory setup mem0 --mode oss --oss-llm openai|ollama …` | OSS backends only openai/ollama — no documented OpenAI-compatible base URL |
| **Hindsight** | knowledge-graph recall, entity resolution, `hindsight_reflect` synthesis | cloud **or local embedded** (daemon with built-in PostgreSQL, auto-stops idle) | cloud paid / local free | `hermes config set memory.provider hindsight`; local: `llm_provider: openai_compatible`, `llm_base_url` (**explicitly lists LM Studio**), `llm_model`; `hindsight/config.json`: `mode, bank_id, recall_budget low|mid|high, memory_mode hybrid|context|tools, auto_retain, auto_recall, retain_async, recall_sync`; UI `hindsight-embed -p hermes ui start` | local keeps embeddings + rerank local; extraction LLM is yours |
| Holographic | SQLite FTS5 facts, trust scoring, HRR queries | fully local, no LLM/embedder | free | `plugins.hermes-memory-store: db_path, auto_extract(false), default_trust, hrr_dim` | lexical only; recommended for local-only |
| RetainDB | hybrid search, 7 memory types | cloud only | $20/mo | `RETAINDB_API_KEY` | teams on RetainDB |
| ByteRover | pre-compression extraction, curated memory | local by default, optional cloud | free local | `npm i -g byterover-cli` → setup | extraction LLM undocumented |
| Supermemory | auto recall/capture, profiles | cloud or `npx supermemory local` | tiers | `SUPERMEMORY_API_KEY` | |
| Memori | structured LTM | cloud | tiers | pip plugin | |

Take for a privacy-first solo dev on LM Studio: built-in + session_search is primary; best local quality = **Hindsight local_embedded** (only provider documenting an OpenAI-compatible base URL); zero-dependency = Holographic; avoid cloud-only ones. Point `auxiliary.memory_query_rewrite` at a local model.

## B) SOUL.md / USER.md
Sources: personality, use-soul-with-hermes, context-files, prompt-assembly docs; LumaDock tutorial (https://lumadock.com/tutorials/hermes-soul-agents-user-memory-files).
- `~/.hermes/SOUL.md` only (cwd not searched; issue #5200). Injected slot #1 of the stable tier, verbatim. Order: SOUL → tool/model guidance → skills prompt → env hints → project context files (`.hermes.md` → `AGENTS.override.md` → `AGENTS.md` → `CLAUDE.md` → `.cursorrules`, first match) → MEMORY.md → USER.md → provider block → timestamp.
- `/personality <name>` overlays presets; `agent.system_prompt` override only when no personality selected. Known bugs: gateway and `hermes -z` ignoring SOUL.md (issues #26596, #34852).
- Official structure: Identity / Style / Avoid / Defaults; "4–8 lines defining tone and defaults is effective"; example: "You are a pragmatic senior engineer. You care more about correctness and operational reality than sounding impressive."
- Put in SOUL: tone, directness, uncertainty handling, stylistic boundaries, technical posture. NOT: repo conventions, paths, commands (→ AGENTS.md); procedures (→ skills); facts about the user (→ USER.md); learned facts (→ MEMORY.md).
- Community: short imperative lines ("You are direct and prefer short answers." "You explain your reasoning briefly before doing anything irreversible."); stacking caution rules yields a permission-asking agent — fix with tool scoping; small models may not follow nuanced persona text.
- USER.md: stable declarative facts about the user; can be authored up front; no official template found.
- Decision table: SOUL (global identity) · AGENTS.md (project) · USER.md (user facts, 1375 ch) · MEMORY.md (learned, 2200 ch) · skills (procedures, on demand) · session_search/provider (recall).

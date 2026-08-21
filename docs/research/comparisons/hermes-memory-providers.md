---
title: Hermes memory providers (mid-2026)
type: comparison
updated: 2026-08-21
tags: [tooling]
related: [../entities/hermes-agent.md, ../entities/lm-studio.md]
sources: [raw/articles/2026-08-21-hermes-memory-providers-soul-user-research.md]
confidence: medium
---

# Hermes memory providers (mid-2026)

The field behind mezo's choice of **Hindsight local_embedded** (ADR 0029, infra doc §7). Only
one external provider is active at a time; the built-in MEMORY.md/USER.md + `session_search`
(FTS5 over all sessions) stay on regardless.

| Provider | Adds | Runs | LM Studio-compatible extraction? | Verdict |
|---|---|---|---|---|
| **Hindsight** | knowledge-graph recall, entity resolution, `reflect` synthesis | cloud or **local embedded** (daemon + Postgres) | **yes — documented `openai_compatible` base URL** | **chosen**; embedded pg0 broken on macOS without Homebrew openssl → external pgvector container |
| Honcho | dialectic user modeling, session summaries | cloud (app.honcho.dev) or self-host | undocumented (server runs its own deriver LLM) | later experiment (mezo-zjtm.7); different focus (user model, not project graph) |
| ByteRover | pre-compression insight extraction, curated memory | local by default (Node CLI) | extraction LLM undocumented | fallback candidate |
| Holographic | SQLite FTS5 fact store, trust scoring, HRR queries | fully local, no LLM | n/a | zero-dependency option; lexical only |
| Mem0 | LLM fact extraction, semantic search | cloud / self-host / OSS | OSS documents only openai/ollama backends | not chosen |
| OpenViking | tiered retrieval, `viking://` store | self-hosted server (AGPL) | unverified | not chosen |
| RetainDB · Supermemory · Memori | hybrid search / auto-capture / structured LTM | cloud (RetainDB $20/mo) | — | excluded (privacy) |

Operational notes learned 2026-08-21: the `memory_query_rewrite` auxiliary runs every turn
when a provider is active — point it at a small local model (Gemma 4 E4B); keep
`background_review` (it patches skills/memories) on the main model; the Hindsight control-plane
web UI redirect-loops on all tested versions (upstream #1926 regressed).

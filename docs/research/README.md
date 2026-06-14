---
title: Research Wiki — README
type: summary
updated: 2026-06-14
tags: [tooling]
related: [SCHEMA.md, index.md, log.md, ../features/README.md]
---

# Research Wiki

`docs/research/` is mezo's **source-ingested** knowledge collection: a small, git-native wiki of
external articles, papers, and talks, distilled into linked `entity` / `concept` / `comparison` /
`query` pages. It is the second of the project's two doc collections — the other,
[`docs/features/`](../features/README.md), is **code-native**. Both share one set of conventions
(frontmatter, staleness, linking, lint); see [`SCHEMA.md`](SCHEMA.md) for the full governance.

## What it is

A trimmed, in-repo adaptation of the Karpathy / Nous **"LLM-wiki"** pattern: immutable sources in
[`raw/`](raw/) → agent-maintained wiki pages → [`SCHEMA.md`](SCHEMA.md) governance. No Obsidian, no
`.qmd`, no systemd — **git is the history**, pages stay under 200 lines, every page has ≥1 cross-link.

## When to use it (vs `docs/features/`)

| Use **`docs/research/`** when… | Use **[`docs/features/`](../features/README.md)** when… |
|---|---|
| capturing what the **outside world** knows — an article, paper, or talk worth keeping | documenting how **our own code/feature** works now |
| building up background for a decision (e.g. *which vector store?*, *RAG patterns*) | onboarding to / extending / debugging an existing mezo feature |
| the immutable layer is an **external source** under `raw/` | the immutable layer is the **code** (tracked via `key_files`) |

If it's about a thing the world wrote, it's research. If it's about a thing we built, it's a feature doc.

## How to ingest / query / lint

The three operations are defined in full in [`SCHEMA.md` §6](SCHEMA.md#6-operations). In short:

- **INGEST** — save the source verbatim into `raw/{articles,papers,transcripts,assets}/` with its
  provenance header (`source_url`, `ingested`, `sha256`); create/update the `entity`/`concept`/
  `comparison` pages it touches (≥2 mentions or central); add `sources` + cross-links + `confidence`;
  update [`index.md`](index.md) and append to [`log.md`](log.md).
- **QUERY** — read [`index.md`](index.md), search the pages, synthesize an answer **with citations**;
  optionally file it as a `query` page in [`queries/`](queries/).
- **LINT** — report orphans, broken links, **stale** pages (`updated` older than the newest git
  commit touching their `sources`), asymmetric/dangling `contradictions`, **source-drift** (SHA256
  mismatch), off-taxonomy tags, and >200-line pages. Report, don't auto-delete.

**Session-orient first:** always read [`SCHEMA.md`](SCHEMA.md) + [`index.md`](index.md) + the recent
tail of [`log.md`](log.md) before operating (see [`SCHEMA.md` §7](SCHEMA.md#7-session-orient-protocol)).

## Layout

```
docs/research/
├── SCHEMA.md        # governance: page types, taxonomy, frontmatter, operations
├── index.md         # catalog of all pages, by section
├── log.md           # append-only action log (rotate at ~500 lines)
├── README.md        # this file
├── raw/             # immutable ingested sources — NEVER edit
│   ├── articles/  papers/  transcripts/  assets/
├── entities/        # entity pages (tools, libs, products, models)
├── concepts/        # concept pages (techniques, patterns, ideas)
├── comparisons/     # head-to-head decision pages
└── queries/         # filed answers to real questions
```

## Pointers

- [`SCHEMA.md`](SCHEMA.md) — the governance doc (read before operating).
- The **knowledge-base skill** — the agent workflow that drives INGEST / QUERY / LINT here.
- [`../features/README.md`](../features/README.md) — the sibling code-native collection.
- [`../README.md`](../README.md) — the project documentation hub.

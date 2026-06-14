---
title: Research Wiki — Schema & Governance
type: summary
updated: 2026-06-14
tags: [tooling, technique]
related: [../features/README.md, ../README.md, index.md, log.md]
---

# Research Wiki — Schema & Governance

This is the governance doc for `docs/research/` — the **source-ingested** knowledge collection.
Read it (plus [`index.md`](index.md) and the tail of [`log.md`](log.md)) **before** ingesting,
querying, or linting. It defines the page types, the tag taxonomy, the per-page frontmatter, the
three operations (INGEST / QUERY / LINT), and the session-orient protocol.

This wiki adapts the proven Karpathy / Nous **"LLM-wiki"** three-layer pattern
(raw sources → agent-maintained wiki pages → schema/governance), **trimmed for our git-native,
in-repo, code-adjacent use**: no Obsidian, no `.qmd`, no systemd, no `$WIKI_PATH`. Git is the history.

---

## 1. Two collections, one machinery

mezo's durable knowledge lives in **two** collections under `docs/`, sharing **one** set of
conventions (YAML frontmatter, the staleness rule, the linking discipline, the lint pass):

| Collection | What it is | The immutable "raw" layer | Maintained by |
|---|---|---|---|
| [`docs/features/`](../features/README.md) | **Code-native** — curated, 10-section feature docs | the **code itself** (`key_files`) | edited in the same change as the code it tracks |
| `docs/research/` (this one) | **Source-ingested** — a wiki of external articles, papers, talks | files under [`raw/`](raw/) (external sources, never edited) | INGEST / QUERY / LINT operations |

Both collections key off the **same frontmatter** and the **same staleness idea**: a page is
*stale* when its immutable raw layer has moved on since the page was last reviewed. For features
that's a git-newer `key_files` path; for research that's a changed source SHA256 (see §4, §6).

> **Why two, not one:** feature docs answer *"how does our code work now?"* and are overwritten in
> place to track the code. Research pages answer *"what does the outside world know about X?"* and
> accrete as sources are ingested. Different lifecycles, identical plumbing.

---

## 2. Page types (research)

Every research page declares one `type`. Pages stay **under 200 lines** — split rather than sprawl.

| `type` | Lives in | What it captures |
|---|---|---|
| `entity` | [`entities/`](entities/) | A concrete named thing — a tool, library, product, model, company, person, dataset (e.g. *pgvector*, *NestJS*, *LangGraph*). One file per entity. |
| `concept` | [`concepts/`](concepts/) | A technique, pattern, or idea that spans entities (e.g. *RAG*, *HNSW indexing*, *hybrid search*, *re-ranking*). |
| `comparison` | [`comparisons/`](comparisons/) | A head-to-head of 2+ entities/approaches for a decision (e.g. *pgvector vs Pinecone*, *NestJS vs Spring for the AI brain*). Links the entities it weighs. |
| `query` | [`queries/`](queries/) | A filed answer to a real question — a synthesis with citations, kept because it's reusable. Output of the QUERY operation. |
| `summary` | (top level) | A governance/overview page (like this one) or a roll-up across pages. |

A page is **created** when a thing is either **central** to the project's research focus, or
**mentioned in 2+ ingested sources**. Below that bar, leave it as a mention/link inside an existing
page — don't spawn a stub.

---

## 3. Tag taxonomy

Tags are a **small, controlled, extensible** vocabulary — the shared spine across both collections.
Seed set relevant to mezo (Phase-3 AI brain + the platform around it):

`ai` · `rag` · `pgvector` · `nestjs` · `spring` · `deployment` · `market` · `tooling` · `technique`

The features collection adds its domain taxonomy (`train`, `fuel`, `today`, `insights`, `me`,
`platform`, `backend`, `frontend`, `auth`, `data-layer`, `design`, `running`, `sport`, `biometrics`).
A research page may reuse a feature tag when it's about the same area (e.g. a pgvector page tagged
`pgvector, backend`).

**Extending the taxonomy:** add a tag only when ≥2 pages need it; record the addition in
[`log.md`](log.md) and list it here. Don't coin one-off tags for a single page — LINT flags those.

---

## 4. Frontmatter spec (research pages)

Every research page opens with YAML frontmatter between `---` fences, before the H1. It extends the
**shared** feature frontmatter with three research-only fields (`sources`, `confidence`,
`contradictions`) and omits the feature-only fields (`status`, `key_files`):

```yaml
---
title: <Human Title>
type: entity | concept | comparison | query | summary
updated: 2026-06-14                 # ISO date of last meaningful content review; staleness ALSO uses git
tags: [<from the taxonomy in §3 — extensible>]
related: [<other research/feature slugs; >=1 cross-link>]
sources:                            # the raw/ files this page is built from (>=1 for non-summary pages)
  - raw/articles/<slug>.md
  - raw/papers/<slug>.pdf
confidence: high | medium | low     # how settled the claim set is (sources agreeing, primary vs hearsay)
contradictions: [<slug>, ...]       # pages/sources that disagree with this one (optional; [] if none)
---
```

- **`updated`** — the last *content* review date. The smart staleness signal (see §6) ALSO consults
  git, so a stale page surfaces even if someone forgot to bump this.
- **`sources`** — points into [`raw/`](raw/). Each raw file carries its own provenance header
  (`source_url`, `ingested`, `SHA256`) — see §5. **Source-drift** is detected when a raw file's
  current SHA256 differs from the one recorded at ingest: the upstream changed, so pages built on it
  need a re-read.
- **`confidence`** — `high` = multiple independent/primary sources agree; `medium` = one solid
  source or some disagreement; `low` = single weak/secondary source or actively contested.
- **`contradictions`** — when two pages (or a page and a source) disagree, link both ways. LINT
  surfaces dangling/asymmetric contradictions. Disagreement is *recorded*, not silently resolved.

Cross-links use plain relative Markdown links (e.g. `[pgvector](entities/pgvector.md)`) — and/or
wiki-style `[[pgvector]]` references in prose. **≥1 outbound link per page** (the Nous pattern's
≥2-per-page is the aspiration; ≥1 is the hard floor LINT enforces).

> **Git is the history.** Never keep an in-page changelog, version suffix, or dated snapshot. To see
> what a page said before, use `git log -p docs/research/<path>`. Overwrite in place.

---

## 5. The `raw/` layer (immutable sources)

`raw/` holds the ingested sources verbatim — **never edit a file under `raw/`**. Layout:

- [`raw/articles/`](raw/articles/) — blog posts, docs pages, web articles (as `.md`/`.html`).
- [`raw/papers/`](raw/papers/) — academic papers (`.pdf`/`.md`).
- [`raw/transcripts/`](raw/transcripts/) — talk/video/podcast transcripts.
- [`raw/assets/`](raw/assets/) — figures, diagrams, screenshots a source references.

Each ingested source carries a **provenance header** (front of the file, or a sidecar for binaries):

```yaml
source_url: https://...
ingested: 2026-06-14
sha256: <hex>        # hash of the captured content at ingest time — drives source-drift detection
```

The SHA256 is the anchor: re-hash on LINT; a mismatch means the upstream (or the captured copy)
changed, so every page listing this file in `sources` is flagged for re-review.

---

## 6. Operations

### INGEST — capture a source, then weave it in
1. Save the source verbatim into the right `raw/` subfolder with the provenance header
   (`source_url`, `ingested`, `sha256`). Never touch it again after this.
2. Decide what it's *about*. For each thing that is **central** or now has **≥2 source mentions**,
   create or update the matching `entity`/`concept`/`comparison` page (frontmatter per §4).
3. Add the raw file to each touched page's `sources`; add **≥1 cross-link** in/out of the page;
   set/adjust `confidence`; record any `contradictions` (both directions).
4. Update [`index.md`](index.md) (add the page under its section) and append an [`log.md`](log.md)
   entry (date · INGEST · what came in · pages touched).

### QUERY — answer a question from the wiki
1. Read [`index.md`](index.md); search the relevant pages and their `sources`.
2. Synthesize an answer **with citations** back to pages and `raw/` files; note `confidence` and any
   contradictions.
3. **Optionally file it** as a `query` page in [`queries/`](queries/) when the answer is reusable
   (cite sources, link entities/concepts, add to `index.md`, log it).

### LINT — keep the wiki honest (git-native, trimmed)
Run periodically; report, don't auto-delete. Checks:
- **Orphans** — pages with 0 outbound links (or unreachable from `index.md`).
- **Broken links** — relative links / `sources` paths that don't resolve.
- **Stale** — `updated` older than the newest commit touching the page's `sources`
  (`git log -1 --format=%cI -- <path>`), mirroring the features collection's `key_files` rule.
- **Contradictions** — `contradictions` that don't point back (asymmetric) or are dangling.
- **Source-drift** — a `raw/` file whose current SHA256 ≠ the one in its provenance header.
- **Taxonomy** — tags not in §3 (and not freshly added there + logged).
- **Length** — pages over ~200 lines (split candidates).

There is **no per-page changelog to lint** — git carries history. No Obsidian/qmd/systemd checks.

---

## 7. Session-orient protocol

Before any operation, **orient**:
1. Read this `SCHEMA.md` (page types, taxonomy, frontmatter, operations).
2. Read [`index.md`](index.md) (what pages exist, by section).
3. Read the **recent tail** of [`log.md`](log.md) (what changed lately; rotate the log at ~500 lines).

Then INGEST / QUERY / LINT as needed, and always close the loop by updating `index.md` + `log.md`.

---

## 8. Cross-links

- [`../features/README.md`](../features/README.md) — the **other** collection (code-native feature docs) and the shared 10-section template + frontmatter origin.
- [`../README.md`](../README.md) — the documentation hub taxonomy (`decisions/`, `infrastructure/`, `milestones/`, `references/`, `features/`, and this `research/`).
- [`README.md`](README.md) — this wiki's quick-start (what it is, when to use it vs `features/`, how to ingest/query/lint).
- The **knowledge-base skill** (the agent workflow that drives INGEST/QUERY/LINT against this wiki).

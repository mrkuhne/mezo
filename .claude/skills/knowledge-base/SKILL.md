---
name: knowledge-base
description: >-
  Maintain this repo's two-collection knowledge base under docs/ — docs/features/
  (curated, code-native 10-section feature docs) and docs/research/ (a source-ingested
  wiki of external articles/papers). Use when asked to document a feature, write or
  update the docs, capture how OUR code works, record an investigation ("how does X
  work"), research a topic, ingest a source/article/paper, build or extend the wiki,
  query the knowledge base, file a research/query page, or lint docs (orphans, broken
  links, staleness, source-drift). Triggers: "document a feature", "update the docs",
  "research X", "ingest a source", "lint docs", "wiki", "knowledge base", "how does X
  work investigation", "write up this feature", "feature doc", "find what we know about".
---

# Knowledge Base — operating manual

This repo carries a **two-collection knowledge base under `docs/`**, sharing **one frontmatter +
staleness machinery**. Your job is to keep both populated, current, and self-consistent. This is a
git-native, code-adjacent adaptation of the proven Karpathy / Nous "LLM-wiki" pattern (raw → wiki
pages → schema) — trimmed for in-repo use: **git is the history** (no per-page changelogs), no
Obsidian/systemd/`$WIKI_PATH` machinery.

## 1. The two collections — and which one to use

| | `docs/features/` | `docs/research/` |
|---|---|---|
| **What it is** | Curated docs of **how OUR code works** | A wiki of **external knowledge** (articles, papers, docs we read) |
| **The immutable "raw" layer** | the **code itself** (the doc tracks it via `key_files`) | `docs/research/raw/` — captured sources, **never edited** |
| **Shape** | one **10-section** doc per domain/platform feature | many small `entity`/`concept`/`comparison`/`query`/`summary` pages |
| **How it grows** | curated, overwritten in place to track the code | **ingest + accrete** — sources flow in, pages get created/updated |
| **Staleness signal** | a `key_files` path has a git commit **newer than the doc** | a `raw/` source's **SHA256 changed** since ingest (source-drift) |

**Decision rule:**
- Documenting / explaining **our own code** (a feature, a flow, a platform layer, a mock→real swap,
  a cross-feature integration) → **`docs/features/`**.
- Capturing **external knowledge** (an article, paper, a methodology, a "how does this domain/tool
  work" investigation drawing on outside sources) → **`docs/research/`**.
- An external source that **informs our code**: ingest it into `docs/research/`, then **cross-link
  into the relevant `docs/features/` doc** (`related:` / inline link). Both collections, one link.

## 2. Session orient — before ANY knowledge op

Never write blind. Read first, then reuse/extend — **do not duplicate**:

- **Features op** → read **`docs/features/README.md`** (the index + the 10-section template + the
  maintenance policy). Check whether a doc for this area already exists; extend it, don't fork it.
- **Research op** → read **`docs/research/SCHEMA.md`** (domain rules + tag taxonomy), then
  **`docs/research/index.md`** (the page catalog), then the tail of **`docs/research/log.md`**
  (recent actions). Search existing pages for the subject before creating a new one.
- If `docs/research/` does not exist yet, scaffold it on first ingest: `raw/` (with kind
  subdirs like `articles/`, `papers/`, `docs/`), `index.md`, `log.md`, `SCHEMA.md`.

## 3. Shared frontmatter + the staleness rule (the keystone)

Every doc in **both** collections opens with YAML frontmatter between `---` fences, **before the
H1**:

```yaml
---
title: <Human Title>
type: feature-domain | feature-platform        # research pages: entity | concept | comparison | query | summary
status: done | mock-only | mixed | planned     # FEATURES ONLY (research omits status)
updated: 2026-06-14                            # date of last meaningful content review (ISO)
tags: [<taxonomy>]                             # train, fuel, today, insights, me, platform, backend,
                                               # frontend, auth, data-layer, design, running, sport, biometrics
key_files:                                     # FEATURES ONLY — code paths this doc tracks; DRIVES staleness
  - frontend/src/features/<x>
  - backend/src/main/java/io/mrkuhne/mezo/feature/<x>
related: [<other slugs>]                        # cross-links, >=1 (e.g. _platform-data-layer, today)
---
```

Research pages additionally carry: `sources: [raw/<kind>/<file>]`, `confidence: high|medium|low`,
`contradictions: [<slug>]`. **`status`/`key_files` are features-only; `confidence`/`contradictions`
are research-only.**

**Staleness rule (the smart anti-rot mechanism):** a **feature** doc is STALE when **any path in its
`key_files` has a git commit newer than the doc file's own last git commit**. Compared with
`git log -1 --format=%cI -- <path>`. A flag means *"review this doc"* — false positives are fine;
the failure we prevent is silent rot. Pick **3–8 load-bearing paths** for `key_files` (prefer
**directories** over single files for stability), distilled from the doc's **§10 Key files** — the
paths whose change most likely means the doc needs updating.

For **research** pages the analogous signal is **source-drift**: a `raw/` source's SHA256 no longer
matches the value recorded at ingest → the page built on it needs review.

## 4. Write / update a FEATURE doc (`docs/features/<slug>.md`)

Platform docs are `_`-prefixed (`_platform-*.md`, no route of their own); domain docs are named by
area (`train.md`, `fuel.md`, …). The **canonical 10-section template** (keep numbers + headings
stable — cross-refs are mechanical):

1. **Summary** — what/why, status per layer (FE mock / FE real / backend), driving spec(s)/ADR.
2. **User-facing behavior** — routes/sub-tabs, flows, sheets, empty/ghost states. Quote HU labels verbatim.
3. **Architecture & data flow** — the `view → hook → mock/real → api → backend → db` path; the `isMockMode()` seam.
4. **Data model & API** — FE types, mock files; if backed: contract fragment, endpoints, entities, migrations, mappers.
5. **Integrations** — every seam to other features/platform, bidirectional, naming the crossing contract (feeds the index matrix).
6. **How to use it (consume)** — import-from-`@/data/hooks` examples, returned shape, ghost-guard/`*Pending` obligations.
7. **How to extend it** — the recipe: contract-first → backend (per `docs/references/*.md`) → migration → dual-mode hook → both test modes green.
8. **Testing** — FE (Vitest + RTL + MSW, both modes; parity) and, if backed, backend ITs; name representative tests + commands.
9. **Decisions, gotchas & deferred** — key decisions (link specs/ADRs), load-bearing gotchas, deferred/Phase-3 (with bd ids).
10. **Key files** — grouped, absolute-from-repo-root pointer list (FE / data / API / backend / tests / docs).

Open with the one-line `>` blockquote (route/tab + per-layer status badge ✅/🔶/🟣/mixed), and the
frontmatter above it.

**Rules while editing:**
- **Link, don't duplicate** — `file:line` pointers, not pasted code; link `specs/`/`references/`/
  `decisions/`/`roadmap.md`, never restate them. Maintain `related:` with ≥1 cross-link.
- **Overwrite in place — git is the history.** No in-doc changelog, version suffix, or dated
  snapshot. `git log -p docs/features/<x>.md` is the trail.
- **Edit only the sections the change touches** (new endpoint → §4 + §10; new integration → §5;
  mock→real swap → §3 + §4 + §8). Bump `updated:` to today. Add the area to the index table in
  `docs/features/README.md` if it's a new doc.
- **After writing**, run the lint (§6) and **clear any staleness flag for the doc you touched** —
  ensure its `key_files` are current and the doc's commit will land after the code's (it does, since
  you commit the doc with/after the change).

## 5. INGEST a research source (`docs/research/`)

When you read an external article/paper/doc worth keeping:

1. **Capture to raw** — write the source verbatim to `docs/research/raw/<kind>/<slug>.md`
   (`<kind>` = `articles` | `papers` | `docs`). Prepend frontmatter:
   ```yaml
   ---
   source_url: <url>
   ingested: 2026-06-14
   sha256: <sha256 of the captured body>
   ---
   ```
   Compute the hash with `shasum -a 256 <file>` (or `sha256sum`). **Never edit `raw/` afterward** —
   it is the immutable layer; re-ingest creates a new capture, never an in-place edit.
2. **Create/update wiki pages** — for each subject that is **mentioned in 2+ sources OR is central**
   to the topic, create or extend an `entity` / `concept` / `comparison` page under
   `docs/research/` (page < 200 lines, focused). Frontmatter per §3 incl. `sources: [raw/...]`,
   `confidence:`, and `contradictions:` if the source disagrees with an existing page.
3. **Cross-link** — ≥1 outbound link per page (to sibling research pages, and **into
   `docs/features/`** whenever the source informs our code). Note contradictions explicitly rather
   than silently overwriting.
4. **Update the catalog + log** — add/refresh the page in **`docs/research/index.md`**, and
   **append one line to `docs/research/log.md`** (action + date + page). Rotate `log.md` when it
   passes ~500 lines.

## 6. QUERY the knowledge base

To answer "what do we know about X / how does X work":

1. Read the right **index** first (`docs/features/README.md` and/or `docs/research/index.md`).
2. **Search** the pages (`grep -ri` across `docs/features/` and `docs/research/`); follow `related:`
   / cross-links.
3. **Synthesize with citations** — point to the feature doc section or the research page + its
   `raw/` source. Flag any `contradictions:` you encounter.
4. **Optionally file the result** — if the synthesis is reusable, save it as a `type: query` (or
   `summary`) page under `docs/research/`, link it, and log it (§5.4).

## 7. LINT — run it after every write

```bash
node scripts/lint-docs.mjs
```

It reports: **orphans** (no inbound link), **broken links** (dangling `related:`/wikilinks),
**stale feature docs** (the §3 rule — a `key_files` path has a git commit newer than the doc),
**source-drift** (a `raw/` SHA256 changed since ingest), and **contradictions** flagged on research
pages. A stale flag means **review**, not failure — false positives are acceptable.

**Clear a staleness flag** by reviewing the doc against the changed code, updating the affected
section(s) + `updated:`, fixing `key_files` if the tracked paths moved, and committing the doc — its
commit then post-dates the code's, so the flag clears. For source-drift, re-ingest (new `raw/`
capture + new SHA256) and reconcile the dependent pages. (If `scripts/lint-docs.mjs` does not yet
exist, it is the small git-native checker this convention assumes — implement it to the model above
before relying on it.)

## 8. Rules (non-negotiable)

- **Git is the history.** No per-page changelog, version suffix, or dated snapshot in any doc.
- **Every doc carries frontmatter** (between `---` fences, before the H1).
- **Pages stay focused.** Feature docs scale to the feature (the 10-section template); **research
  pages stay < 200 lines** — split rather than bloat.
- **Never modify `docs/research/raw/`** — it is the immutable source layer. Re-ingest, don't edit.
- **`status`/`key_files` are features-only; `confidence`/`contradictions` are research-only.**
- **Link, don't duplicate** — across docs, and out to `specs/`/`references/`/`decisions/`/roadmap.
- **Cross-link every page** (≥1 outbound; `related:` on features). Capture external knowledge that
  touches our code with a link **into** the matching `docs/features/` doc.
- **Orient before writing** (§2); **lint after writing** (§7); **clear staleness for the doc you
  touched**. Bump `updated:` whenever you make a meaningful content change.

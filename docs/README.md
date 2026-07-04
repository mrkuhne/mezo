# mezo — Documentation Hub

This folder is the **durable memory of the project**: every important decision, direction,
milestone, and standard lives here as a file, not only in chat or in `bd` issues.

> **Rule of thumb:** if a future contributor (human or AI) would ask *"why is it like this?"*,
> *"where does it run?"*, or *"what did we decide and when?"* — the answer belongs in `docs/`.

## Taxonomy — what goes where

| Folder | Question it answers | What lives here |
|---|---|---|
| `decisions/` | **WHY** (and what we rejected) | Architecture Decision Records (ADRs): every significant decision, direction change, tool/platform choice, or trade-off. One file per decision. |
| `infrastructure/` | **WHERE / HOW it runs** | Deployment topology, hosting, CI/CD, networking, secrets, ops runbooks, target architecture. |
| `milestones/` | **WHEN / WHAT shipped** | Roadmap, phase status, milestone log. The high-level "where are we" timeline. |
| `references/` | **HOW we build** | Coding house standards — Java/Spring/Liquibase/testing/API conventions. Non-negotiable rules (see root `CLAUDE.md`). |
| `superpowers/specs/` | **WHAT we decided to build** (point-in-time) | Per-feature design specs (dated) — the design as it stood when the feature was conceived. A historical artifact; not kept in sync with later changes. |
| `superpowers/plans/` | **step-by-step** | Per-feature implementation plans (dated). |
| `features/` | **HOW a feature works NOW** (living) | Durable, current per-feature reference: what it does, its data flow, data model/API, **integrations with other features**, how to **use** it, how to **extend** it, how it's tested. One doc per domain (`today`, `train`, `fuel`, `insights`, `me`) + platform docs (`_platform-*`). Kept in sync with the code — read this to understand or build on a feature. See [`features/README.md`](features/README.md). |
| `guides/` | **WHAT it does for the USER** | Non-technical, functional/business explainers of shipped capabilities — how a feature behaves, what runs automatically, what the user's role is. Written for reading, not for building; the technical living reference stays in `features/`. |
| `research/` | **WHAT we learned from OUTSIDE** (living wiki) | A source-ingested LLM-wiki (Karpathy/Nous pattern, trimmed & git-native): external articles/papers/transcripts captured immutably under `research/raw/`, distilled into interlinked `entities/` `concepts/` `comparisons/` `queries/` pages. For investigations, library/technique evaluations, market scans — knowledge whose "raw layer" is an external source, not our code. See [`research/SCHEMA.md`](research/SCHEMA.md). |

> **`features/` vs `research/` — same machinery, different raw layer.** Both are living markdown collections sharing one frontmatter + lint + cross-link convention. `features/` documents **our code** (the code is its immutable source → staleness is detected by git-drift against each doc's `key_files`); `research/` documents **external sources** (captured immutably in `research/raw/`). The [`knowledge-base` skill](../.claude/skills/knowledge-base/SKILL.md) is the operating manual for both; `node scripts/lint-docs.mjs` lints both.

## When you MUST write a doc here

Writing to `docs/` is **mandatory** — not optional housekeeping. Add or update a doc whenever you:

1. **Make or change a significant decision or direction** → new ADR in `decisions/`
   (e.g. "host on k3s instead of a managed PaaS", "switch state lib", "adopt event sourcing").
2. **Introduce or change infrastructure** → doc in `infrastructure/`
   (new deploy target, CI pipeline, secret strategy, DB hosting, ingress/proxy).
3. **Hit or move a milestone / change the roadmap** → entry in `milestones/`.
4. **Establish a reusable coding standard** → doc in `references/` (and link it from `CLAUDE.md`).
5. **Add or change a user-facing feature** (new view/flow, new domain, swap a mock hook to real, new sub-feature, a cross-feature integration) → add or update its doc in `features/`. The spec in `superpowers/specs/` records *why we designed it that way then*; the `features/` doc records *how it works now and how to build on it*. Both matter; the `features/` doc is the one that must stay current.
6. **Learn something from an external source** (evaluate a library/technique, investigate "how does X work", a market/tooling scan, a `/last30days` run worth keeping) → ingest it into the `research/` wiki (source → `research/raw/`, distilled into entity/concept pages). Use the [`knowledge-base` skill](../.claude/skills/knowledge-base/SKILL.md).

If you finish a piece of work and nothing in `docs/` reflects the decision behind it,
the work is **not done**. Capture it before closing the `bd` issue.

> **Keep it honest — run the lint.** `node scripts/lint-docs.mjs` flags feature docs whose `key_files` changed in git since the doc was last touched (git-drift staleness), plus broken links and missing sections. A 🔶 flag means *review that doc*. This is what keeps the living docs from silently rotting.

## File naming conventions

- **ADRs** (`decisions/`): `NNNN-kebab-title.md` — zero-padded sequential number, e.g. `0001-deploy-on-k3s-argocd-learning-track.md`. Numbers never get reused; superseded ADRs stay (mark `Status: Superseded by NNNN`).
- **Infrastructure** (`infrastructure/`): `kebab-topic.md`, e.g. `deployment-k3s-argocd.md`.
- **Milestones** (`milestones/`): keep the running log in `roadmap.md`; one-off retrospectives as `YYYY-MM-DD-title.md`.
- **Specs / plans** (`superpowers/`): `YYYY-MM-DD-title.md` (existing convention).
- **Features** (`features/`): `<domain>.md` for the five domains (`today.md`, `train.md`, `fuel.md`, `insights.md`, `me.md`) and `_platform-<topic>.md` for cross-cutting platform docs (`_platform-data-layer.md`, `_platform-api-backend.md`, `_platform-auth-security.md`, `_platform-design-system.md`). No date prefix — these are living, not dated artifacts. Every doc follows the 10-section template in [`features/README.md`](features/README.md) and carries YAML frontmatter (incl. `key_files`).
- **Research** (`research/`): `entities/`, `concepts/`, `comparisons/`, `queries/` pages as `kebab-slug.md` (lowercase, hyphens); immutable sources under `research/raw/{articles,papers,transcripts,assets}/`. Conventions in [`research/SCHEMA.md`](research/SCHEMA.md). No date prefix on pages (git is the history); `raw/` sources carry an `ingested` date + SHA256.

## ADR template (copy for new decisions)

```markdown
# NNNN — <short decision title>

- **Status:** Proposed | Accepted | Superseded by NNNN
- **Date:** YYYY-MM-DD
- **Driver:** <bd issue id, e.g. mezo-ht3>

## Context
<the situation and forces; what problem are we solving, what constraints>

## Decision
<what we chose, stated plainly>

## Consequences
<what this makes easy, what it makes harder, what we now have to maintain>

## Alternatives considered
<options we rejected and the one-line reason each was rejected>
```

## Index of key docs

- [`decisions/0001-deploy-on-k3s-argocd-learning-track.md`](decisions/0001-deploy-on-k3s-argocd-learning-track.md) — why we deploy on self-managed k3s + ArgoCD.
- [`infrastructure/deployment-k3s-argocd.md`](infrastructure/deployment-k3s-argocd.md) — deployment architecture + current live facts.
- [`infrastructure/runbook.md`](infrastructure/runbook.md) — **operational runbook**: access, logins, day-to-day ops, troubleshooting, recovery.
- [`milestones/roadmap.md`](milestones/roadmap.md) — phase & milestone status.
- [`features/README.md`](features/README.md) — **per-feature documentation index** (operation, usage, extension, integrations) for every domain + platform area.
- [`guides/companion-hogyan-mukodik.md`](guides/companion-hogyan-mukodik.md) — **felhasználói útmutató** a Phase-3 companionhöz (mit tud, mi fut magától, mi a te szereped).
- [`research/SCHEMA.md`](research/SCHEMA.md) — the **research wiki** conventions (source-ingested LLM-wiki). Lint both collections with `node scripts/lint-docs.mjs`; the [`knowledge-base` skill](../.claude/skills/knowledge-base/SKILL.md) is the operating manual.

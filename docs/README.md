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
| `superpowers/specs/` | **WHAT a feature does** | Per-feature design specs (dated). |
| `superpowers/plans/` | **step-by-step** | Per-feature implementation plans (dated). |

## When you MUST write a doc here

Writing to `docs/` is **mandatory** — not optional housekeeping. Add or update a doc whenever you:

1. **Make or change a significant decision or direction** → new ADR in `decisions/`
   (e.g. "host on k3s instead of a managed PaaS", "switch state lib", "adopt event sourcing").
2. **Introduce or change infrastructure** → doc in `infrastructure/`
   (new deploy target, CI pipeline, secret strategy, DB hosting, ingress/proxy).
3. **Hit or move a milestone / change the roadmap** → entry in `milestones/`.
4. **Establish a reusable coding standard** → doc in `references/` (and link it from `CLAUDE.md`).

If you finish a piece of work and nothing in `docs/` reflects the decision behind it,
the work is **not done**. Capture it before closing the `bd` issue.

## File naming conventions

- **ADRs** (`decisions/`): `NNNN-kebab-title.md` — zero-padded sequential number, e.g. `0001-deploy-on-k3s-argocd-learning-track.md`. Numbers never get reused; superseded ADRs stay (mark `Status: Superseded by NNNN`).
- **Infrastructure** (`infrastructure/`): `kebab-topic.md`, e.g. `deployment-k3s-argocd.md`.
- **Milestones** (`milestones/`): keep the running log in `roadmap.md`; one-off retrospectives as `YYYY-MM-DD-title.md`.
- **Specs / plans** (`superpowers/`): `YYYY-MM-DD-title.md` (existing convention).

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
- [`infrastructure/deployment-k3s-argocd.md`](infrastructure/deployment-k3s-argocd.md) — target deployment architecture.
- [`milestones/roadmap.md`](milestones/roadmap.md) — phase & milestone status.

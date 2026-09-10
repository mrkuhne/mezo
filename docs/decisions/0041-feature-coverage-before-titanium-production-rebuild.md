# 0041 — Require feature coverage before each Titanium production rebuild

- **Status:** Accepted
- **Date:** 2026-09-10
- **Driver:** mezo-of6i

## Context

The Titanium prototype established a promising visual and interaction direction, but it does not
contain every capability of the production app. Mezo has many visible, hidden, automatic and
cross-domain functions across roughly three dozen CODEMAP feature blocks. Rebuilding directly from
the prototype could silently remove behavior that was never represented there.

The owner wants to participate in product/design decisions and approve a realistic prototype, then
have the approved slice implemented, reviewed, merged and deployed autonomously through the
repository's existing quality gates.

## Decision

Every page-level Titanium production rebuild must use a CODEMAP-first workflow:

1. parallel prior-art and code-terrain reconnaissance;
2. superpowers brainstorm and conceptual design spec;
3. an evidence-backed backend, frontend and related-feature coverage audit;
4. explicit `KEEP`, `MERGE`, `MOVE`, `DEFER` or `DROP` decisions for every relevant capability;
5. an interactive mobile prototype that demonstrates the resulting hierarchy and dominant flow;
6. explicit owner approval of that prototype;
7. autonomous plan, subagent-driven TDD implementation, review/fix loops, PR, CI, current-main
   premerge, local `--no-ff` merge, push, deployment and production smoke verification.

No relevant `UNKNOWN` row may remain when prototyping begins. `DEFER` and `DROP` require explicit
owner decisions. Prototype approval authorizes all downstream delivery actions for the frozen
scope; repository defaults that ordinarily present an integration menu do not add another approval
gate. All test, review, documentation, security, migration, CI, premerge and deployment checks
remain mandatory.

The canonical operating documents are:

- `docs/design_2.0/2026-09-10-titanium-production-rebuild-handoff.md`;
- `docs/design_2.0/CLAUDE_TITANIUM_REBUILD_PROMPT.md`;
- `docs/design_2.0/TITANIUM_FEATURE_COVERAGE_REGISTER.md`.

## Consequences

The owner sees every existing function before approving a page direction, including backend-only,
hidden and automatic behavior. The prototype becomes an interaction contract grounded in the
current app instead of an incomplete visual reference. The preservation tests and frozen manifest
give implementation and review agents an objective completeness check.

Reconnaissance and feature discussion add time before implementation. The work is paid once per
slice and reduces late discovery, accidental feature loss and repeated owner involvement during
delivery. New code evidence can reopen a decision, but it must be surfaced rather than silently
changing the approved scope.

## Alternatives considered

- Rebuild directly from the existing prototype: faster initially, but unrepresented production
  capabilities could disappear without a conscious decision.
- Treat living feature docs as a sufficient inventory: useful for behavior, but CODEMAP also exposes
  code areas without their own feature doc and the exact backend/frontend terrain.
- Review feature coverage after implementation: detects omissions only after architecture and UI
  choices are expensive to change.
- Require separate approvals for plan, PR, merge and deploy: adds owner friction after the exact
  behavior and presentation have already been approved, without replacing any quality gate.


# Karakter social implementation

**Goal:** ship the approved social Karakter UI and durable contextual replies through production.
**Issue:** mezo-njcgs. **Spec:** [approved design](../specs/2026-09-20-character-social.md).
**Architecture:** extend the existing character source/lifecycle model with owned contextual reply persistence and a recoverable targeted evaluation worker. The frontend keeps the existing application shell and data boundary; primary navigation becomes feed/profile/team.
**Global constraints:** user cannot post; no fabricated peer reactions; immutable server-resolved source context; idempotent retries; saved reply survives failed evaluation; self-report distinguishable from inference; no underlying logs/plans changed; all owners isolated; actual Mezo Clay/GlassBox styling; reduced motion; backward-compatible routes. Task state lives in Beads.

## Task 1 — backend reply contract and processing

Files: `api/feature/character/character.yml`, generated contracts, `backend/src/main/java/io/mrkuhne/mezo/feature/character/{controller,entity,repository,service,config}/`, feature migrations, corresponding integration tests/populators, shared memory integration where required.
Expose durable source identity on feed items, and typed list/create/retry reply operations. Resolve owned OBSERVATION, CLAIM and CONFERENCE_CHANGE sources on the server; use a bounded index for conference change entries. DTO replies carry id, text, createdAt, status, outcome text and source linkage. Publish the exact contract before frontend integration.
Write failing ownership/idempotency/persistence tests, observe failure, implement persistence first. Then test and implement asynchronous evaluation, retry/recovery, contextual history and real claim/portrait/memory effects. Reuse audited CompanionLlm and existing lifecycle services. Run focused module integration tests with Maven clean and Testcontainers. Commit backend and contract with `(mezo-njcgs)`.

## Task 2 — app-faithful social UI

Files: `frontend/src/features/character/{pages,components,sheets,logic}/`, `character.css`, `frontend/src/data/character/`, `frontend/src/data/hooks.ts`, existing routes as necessary.
First test root feed navigation, evidence dialog and contextual reply/error/retry behavior. Use existing hooks and GlassBox; build author-led posts with honest comment/reaction history. Retain/bootstrap the empty state. Integrate typed reply API only after Task 1 contract is established. Poll processing with bounded React Query updates; keep draft on error; invalidate profile after successful outcome. Reorganize dimensions/team/conference details to match the accepted hierarchy without removing functionality.
Verify meaningful tests red then green; build and run all frontend tests with `CI=true VITE_USE_MOCK=true` and `CI=true VITE_USE_MOCK=false`. Inspect in browser. Commit with `(mezo-njcgs)`.

## Task 3 — review, documentation and release

Update `docs/features/character.md`, affected memory docs, ADR and generated CODEMAP. Run docs lint, relevant full local gates, review combined changes and repair findings. Refresh Beads backup using `node scripts/check-beads-backup.mjs --fix`. Fetch current main, merge with --no-ff, push main and tracker, then verify actual deployment health and running version. Close issue after successful production verification.

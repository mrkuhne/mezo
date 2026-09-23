# Relevant observations implementation

Driver: `mezo-hben1`. Approved [spec](../specs/2026-09-23-observations-relevant-hunches-design.md).
Goal: source-grounded questions survive low statistical scores and reach a persistent inbox.
Architecture: reuse personal-record catalogue, pattern/event storage and observation API.
Constraints: owner isolation, original source dates, 28-day direct context and 90-day memory
window, shared daily publication cap, no automatic user confirmation, no push on recovery.
Task status lives in Beads (house rule); this document specifies interfaces and gates.

## A. Broader evidence context

Create `reflection/service/ObservationContextService.java` with
`collect(UUID, LocalDate): Context`, where Context contains `text` and a reference-to-label
map, plus immutable `references()`. Reuse PersonalRecordService and existing memory gateway.
Create validated context properties and ITs covering notes/check-in/event joins, ownership,
deletion, absent yesterday signal and provenance. Do not change HypothesisPipelineService:
the publication task consumes this interface. Fail an IT first, implement, rerun and commit.

## B. Contract and frontend

Extend ObservationResponse with optional `kind` (statistical/reflection/ai_hypothesis).
Document today's persistent inbox vs historical day. Regenerate both generated contracts.
Update ObservationCard and team feed to use the same observations and reply state;
all fresh/return cards offer the three approved replies, acknowledgements do not promise
eight calendar days, statistical watching cards link to their own details without reflection
reply chips or fictitious evidence tally. Colocated tests first; both FE modes and build.

## C. Grounded publication and persistent inbox

Extend hypothesis JSON with observation/question/evidenceRefs/topicKey. Validate references
against A's actual source set. A grounded, noncontradictory, actionable question may survive
a low weighted critique score. Keep statistical confidence separate from user confirmation.
Deduplicate by validated test-plan key or semantic topic plus existing source overlap.
Persist unsurfaced events when daily cap is exhausted; publish later from the feed/service
without rewriting original evidence dates. Today's read includes older unanswered newest
events per pattern and statistical monitoring rows; historical reads remain day-bound.
Write ITs for low-score survival, missing/foreign sources, repeat run, next-day persistence,
reply lifecycle, pending publication and historical bounds before implementation.

## D. Recovery, docs and shipping

Implement an owner-only, dry-run/apply recovery path reusing the same grounded proposal
and publication service, based on owned hypothesis audit logs within the configured window.
Revalidate against current sources and preserve log dates in evidence. Idempotence by
source references/test-plan/topic, no fabricated user replies and no recovery pushes.
Test dry-run, repeated application and ownership. Apply to live data after deployment,
verify persisted cards and report counts. Record the design decision and update companion
living docs and generated CODEMAP. Refresh Beads backup.

## Verification and integration

Backend: `./mvnw clean test -Dmezo.test.use-testcontainers=true` (focused domain ITs during
red/green, full suite at final gate). Frontend: `pnpm build`, then `CI=true VITE_USE_MOCK=true
pnpm test` and `CI=true VITE_USE_MOCK=false pnpm test`. Docs: `node scripts/lint-docs.mjs`;
CODEMAP: `node scripts/gen-codemap.mjs --check`. Follow current AGENTS local no-ff merge and
push workflow. Existing working tree is isolated on `feat/observations-relevant-hunches`.

# Daily character council implementation

Driving issue: **mezo-zwy6v**. Task state lives in Beads, not checkboxes here.
Design: [approved direction](../specs/2026-09-21-daily-character-council-design.md).

## Approved visual amendment

The owner approved visual prototype `karakter-napi-csapat-v3.html` on 2026-09-21.
The morning bullet list is replaced by one editorial conversation teaser: original menu
Boop characters, a real excerpt, contextual headline and a link to the same feed thread.
Nine personas share the menu's five Boop hues and distinct role marks. Counts, excerpts,
participants and newness must derive from persisted data; the demo's statements are not seeds.
The prototype is in the task visualization directory
`/Users/mrkuhne/.codex/visualizations/2026/09/20/01a0be53-9065-7020-9e2b-5d4354867a21/`.

## Goal and architecture

Bring regular, evidence-backed multi-expert conversations into the existing social character
feed. Reuse conference deliberations and reply source identities rather than introduce a
parallel feed with incompatible replies. Add a durable daily processing lease, short atomic
publication, and audited reversible claim mutations around that shared domain.

Global constraints: daily preparation after nightly observations, 05:15 Budapest;
15-minute retry, two-day catch-up; no forced content on quiet days; at most six daily topics,
three debate rounds and four participants; cheaper model by default, explicit escalation;
no domain plan writes without review/approval. Foreign resources remain 404. Existing
bootstrap, weekly, monthly and reply data remains readable.

## 1. Contract and durable daily preparation

Files: `api/feature/character/character.yml`, generated contract/types;
`character/config/CharacterCouncilProperties.java`,
`character/entity/CharacterCouncilEditionEntity.java`, corresponding repository,
`service/CharacterCouncilProcessing.java`, `CharacterCouncilJob.java`,
`CharacterCouncilService.java`, `CharacterController.java`, migration and test reset.

Expose owned daily status and claim revision reads/undo. Extend conference kind with DAILY.
Test missing prerequisite, quiet day, duplicate/recovered lease, foreign status and successful
publication before implementation. Use `(created_by, day)` uniqueness and processing token;
only current lease can publish. Read/generate outside publication transaction. Leave failed
inputs unconsumed. Expired work retries from persisted state; daily status never invents success.
Preserve active-user fan-out and disable actual scheduling in tests.

## 2. Evidence-backed discussion

Files: `KonziliumCrossTalkRound.java`, new council evidence tools/config and focused tests;
root integration in `KonziliumVerdictRound`, monthly/bootstrap and reply evaluation.

Test that a single proposer invites a relevant other domain and follow-up sees earlier
arguments; invalid/failed responses never become synthetic comments. Register owner-bound
read-only tools, bounded output/calls, source context and evidence limits. Keep valid transcript
structures compatible. All entry points use the shared discussion. Preserve attributed
self-reports and never treat repeated summaries as independent confirmations.

## 3. Claim revisions and honest results

Files: new claim revision entity/repository/service, `ClaimLifecycle`, proposal contract,
revision migration; API mapping and frontend revision sheet.

Test actual text revision and dimension move, before/after history, conflict-safe undo,
idempotent undo, ownership, and no false success on skipped operations. Snapshot all
claim fields affected by a mutation; clear/invalidate affected portraits on compensation.
Route existing reply and conference mutations through the audit. Result labels describe
the persisted mutation, not merely the model's prose. Explicitly retain uncertainty when
time windows or sources cannot support stronger conclusions.

## 4. Approved frontend and real data integration

Files: `PersonaOrb`, morning teaser component, `CharacterFeedPage`, post/reply components,
character hooks/API client, evidence/revision sheets and character CSS.

First test avatar identities and factual teaser selection in both modes. Implement actual
Boop family with accessible role labels, reduced motion and responsive sizes. Connect stored
deliberations to posts and their reply targets; use real counts and source excerpts. Add daily
processing/quiet/failure states. Show revision details and undo outcomes. Unsupported plan
suggestions link to existing editors and never claim that approving prose executed a change.

## 5. Verification and release

Focused PostgreSQL integration tests first, then broad character regression suite; frontend
focused tests and full suite in both explicit modes; production build, contract drift,
generated CODEMAP, doc lint and migration lint. Update living character documentation and
deployment/milestone records to accurately reflect shipped behavior.

Commands: backend `./mvnw clean test -Dmezo.test.use-testcontainers=true -Dtest='*Character*,*Konzilium*,*ClaimLifecycle*'`;
frontend `CI=true VITE_USE_MOCK=true pnpm test`,
`CI=true VITE_USE_MOCK=false pnpm test`, `pnpm build`;
repo `node scripts/gen-codemap.mjs`, `node scripts/lint-docs.mjs`,
`node scripts/lint-liquibase.mjs`, `git diff --check`.

Backend build commands must run serially because `clean` shares `target/` in this worktree.
Frontend avatar/teaser work and backend evidence/revision components may run independently.
Commit verified units with the driving issue id. Refresh Beads backup, fetch main, merge locally
with `--no-ff`, push main and follow the repository release/deploy procedure. User explicitly
authorized implementation, merge, push and deployment; no further permission gate is needed.

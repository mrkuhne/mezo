# Companion complete data implementation

Driver: mezo-rj214.10. Approved design: ../specs/2026-09-18-companion-complete-data-design.md.
Task status lives in Beads, not this document. Builds on the existing conversation-first branch.

## Task 1 — Full source access and baseline
Files: new companion/service/PersonalRecordService.java, repository/PersonalRecordQuery.java, tools/PersonalRecordTools.java, source catalogue; existing CompanionToolRegistry, ConversationTurnService. Tests: PersonalRecordIT and baseline context regressions.
Implement list_sources and read_personal_records with enumerated source, date/id/parent filters, stable paging and bounded field continuation. Audit explicit projections and ownership against schema. Add compact profile/goal context and tests for known, missing and foreign profiles.
Run focused PostgreSQL tests red before implementation, green afterwards. Commit feat(companion): expose complete owned source reads (mezo-rj214.10).

## Task 2 — Domain summary gaps (independent)
Files: FuelTools, TrainTools, BiometricsTools, PracticeTools, GoalTools, MedicationTools, GrowthTools, InsightsTools, LifeGoalTools, ToolText and focused renderer tests. No shared registry/config/docs edits.
Add missing meal macros/times, workout set/feedback details, exact weights, checkin notes, daily quest/ritual details, life-goal frame; disclose every omitted result and route to full-source reader. Main task supplies complete historical/date/id access.
Run focused renderer tests red/green. Commit feat(companion): retain detailed domain evidence (mezo-rj214.1).

## Task 3 — RAG completeness (independent)
Files: companion/embedding and companion/memory packages, dedicated memory tests and migration if needed. Do not edit application.yml or shared conversation tools without coordination.
Implement searchable long-source coverage with canonical chunks and deletion/update reconciliation, source reference hydration metadata, explicit partial failure status and contextual retrieval regressions. Reuse existing properties where sound; propose any new configuration for integrator. Verify no owner leak and no stale chunks. Commit feat(companion): preserve memory source coverage (mezo-rj214.10).

## Integration
Run focused changed tests plus conversation, registry, memory and architecture regressions with ./mvnw clean test -Dmezo.test.use-testcontainers=true -DargLine=-Xmx2g. Regenerate CODEMAP, update companion feature/user docs and tool conventions. Review implementation and run doc/convention gates. Export Beads backup and push branch; use repository integration gates for this cross-cutting change.

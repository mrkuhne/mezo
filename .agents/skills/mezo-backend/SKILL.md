---
name: mezo-backend
description: Use before touching ANY backend code (Java, Spring, JPA, Liquibase, DTO, backend test) — routes you to the mandatory house references.
---

# mezo Backend Work

LOCATE FIRST: find the files via docs/CODEMAP.md (package, entities→tables, controllers→
<Tag>Api, contract fragment, ITs, populators), then read the matching docs/features/<x>.md
§10. Do NOT grep the tree for orientation.

READ FIRST (docs/references/): the row(s) of the table in AGENTS.md §Backend Development
Conventions that match what you touch — java_package_structure, spring_patterns,
error_handling, liquibase_conventions, configuration_conventions, api_contract_conventions,
companion_tool_conventions. Follow them exactly; they override instinct.

Hard gates: UUID PKs · constructor injection only · no @Value · SystemRuntimeErrorException
+ SystemMessage for errors · seed data in Java @Profile("demodata"), never SQL · soft delete
via @SQLRestriction · changeset naming {YYYYMMDDHHMM}_{bd-id}_{desc} · ALWAYS ./mvnw clean.
Contract-first: edit api/feature/<name>/<name>.yml BEFORE code; never hand-write boundary DTOs.

---
name: mezo-backend
description: Use before touching ANY backend code (Java, Spring, JPA, Liquibase, DTO, backend test) — routes you to the mandatory house references.
---

# mezo Backend Work

LOCATE FIRST: find the files via docs/CODEMAP.md (package, entities→tables, controllers→
<Tag>Api, contract fragment, ITs, populators), then read the matching docs/features/<x>.md
§10. Do NOT grep the tree for orientation.

READ FIRST (docs/references/): the row(s) of the table in the house-rules doc (AGENTS, repo root) §Backend Development
Conventions that match what you touch — java_package_structure, spring_patterns,
error_handling, liquibase_conventions, configuration_conventions, api_contract_conventions,
companion_tool_conventions. Follow them exactly; they override instinct.

Hard gates: UUID PKs · constructor injection only · no @Value · SystemRuntimeErrorException
+ SystemMessage for errors · seed data in Java @Profile("demodata"), never SQL · soft delete
via @SQLRestriction · changeset naming {YYYYMMDDHHMM}_{bd-id}_{desc} · ALWAYS ./mvnw clean.
Contract-first: edit api/feature/<name>/<name>.yml BEFORE code; never hand-write boundary DTOs.
SQL is PostgreSQL 16: date arithmetic is `col - (n) * interval '1 day'`, never MySQL `date_sub(...)`
/ `interval n day`. Soft delete goes through repository.delete(entity) + @SQLDelete — no custom
`@Modifying update … set deleted = true` queries.

## Pitfalls (learned by the Hermes agent on W1.3, 2026-08-21; reviewed)

### OpenAPI-generated DTOs use void setters, NOT builder
Generated DTOs (via OpenAPI generator) have `void`-returning setters — `.setText("x").setOccurredOn(d)` does NOT compile. Build them in two statements:
```java
var req = new CreateXxxRequest();
req.setText("x");
req.setOccurredOn(d);
```

### Adding a new kind to the embedding pipeline (Writer + AFTER_COMMIT Listener)
When a new entity kind needs memory embedding (e.g. `gratitude`):
1. Add `KIND_<NAME>` constant to `MemoryEmbeddingEntity` (next to existing KIND_*)
2. Add `write<Kind>(<Entity>)` and `delete<Kind>Embedding(UUID)` to `MemoryEmbeddingWriter`
   — `write<Kind>` is a one-liner over the shared private `upsert(createdBy, kind, refId,
   content, occurredOn)` (like `writeJournal`); never duplicate the re-embed logic
3. Create `<Kind>EmbeddingListener` — copy the journal listener, rename events/methods, keep
   `@Async @TransactionalEventListener(phase = AFTER_COMMIT)`, gate on BOTH `COMPANION_SWITCH`
   and the SOURCE feature's own switch (`JOURNAL_SWITCH` for journal/gratitude/decision,
   `RITUAL_SWITCH` for reflection)
4. Race guards: keep the create-then-delete liveness re-check; drop the create-then-fast-edit
   retry branch ONLY if the entity has no update endpoint (gratitude has none, journal does)
5. Always add a `KIND_*` constant BEFORE writing the listener — the listener references it at
   compile time.
6. API IT for the endpoint must use `exchangeForBody(HttpMethod.DELETE, ...)` — the `deleteAndExpect` helper requires `HttpHeaders`; the `exchangeForBody` variant works with any method.

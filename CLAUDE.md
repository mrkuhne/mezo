# Project Instructions for AI Agents

This file provides instructions and context for AI coding agents working on this project.

<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:ca08a54f -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

## Session Completion

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd dolt push
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
<!-- END BEADS INTEGRATION -->


## Architecture Overview

**mezo** is a mobile-first health & performance companion PWA, built in three phases (frontend-first — see `/Users/daniel.kuhne/Downloads/design_handoff_mezo/06-roadmap.md`):

- **Phase 1 — Frontend (mock data):** ✅ done. React 19 + Vite + Tailwind v4, Hungarian UI, 6 vertical slices (Foundation → Today → Me → Fuel → Insights → Train) on a mock data layer. The single frontend↔data boundary is `src/data/hooks.ts`.
- **Phase 2 — Core data backend:** 🔄 in progress. **Java / Spring Boot 4.0 + PostgreSQL**, swapping the mock hooks to a real REST API **without changing the hook signatures** (frontend untouched). Symmetric monorepo: `frontend/` + `backend/`. Slice A (foundation + thin auth + biometrics + TanStack Query wiring) ✅ done; slices B (Train) → C (Fuel) → D (Insights seed) → E (People) remain.
- **Phase 3 — AI brain:** later. Spring AI, pgvector, RAG, pattern/companion pipeline.

Design spec for Phase 2: `docs/superpowers/specs/` (latest `*-phase2-backend-design.md`).

## Build & Test

```bash
# Frontend (under frontend/)
cd frontend
pnpm dev          # vite dev server (VITE_USE_MOCK=true → mock data, no backend needed)
pnpm build        # tsc -b && vite build
pnpm test         # vitest run (also run VITE_USE_MOCK=false pnpm test — both modes must be green)
pnpm parity       # playwright parity screenshots (prototype path: MEZO_PROTOTYPE_DIR env var)

# Backend (under backend/)
cd backend
docker compose up -d            # local Postgres 16
./mvnw spring-boot:run -Dspring-boot.run.profiles=demodata   # run with owner seed (login needs this!)
./mvnw clean test               # JUnit + Testcontainers ITs — ALWAYS use `clean` (Lombok+MapStruct incremental compile is flaky)
```

## Backend Development Conventions (Phase 2+) — MANDATORY

> **Trigger — read the relevant doc(s) FIRST.** Whenever you write, review, refactor, or plan **any** backend code — Java, Spring Boot, JPA/Hibernate entity, repository, service, controller, REST endpoint, DTO/MapStruct mapper, Liquibase migration, exception handling, or backend test — you MUST consult the matching reference under `docs/references/` **before** writing code, and follow it exactly. These are non-negotiable house standards.

| Reference (`docs/references/`) | Read it when you touch… |
|---|---|
| `java_package_structure.md` | package layout, new class, naming — `feature/{name}/{controller,service,repository,entity,dto,mapper}` + `techcore/` |
| `spring_patterns.md` | DI (constructor + `@RequiredArgsConstructor`, never field), `@Transactional` (method-level only), controllers, repositories (derived→JPQL→native), MapStruct, Lombok |
| `error_handling.md` | any error/validation — `SystemRuntimeErrorException` + `SystemMessage` (code + `message.properties`), `exceptionTraceId`, no hardcoded user text, no stack traces to client |
| `liquibase_conventions.md` | any DB migration — versioned changelog, `{YYYYMMDDHHMM}_{id}_{desc}` script naming, never modify released changesets, explicit constraint names (`pk_/fk_/uq_/ck_/idx_`), entity↔DDL sync, **seed data in Java `@Profile("demodata")`, never SQL** |
| `testing_standards.md` | any backend test — integration-first (`@SpringBootTest` + Testcontainers Postgres), `test{Method}_should{Result}_when{Condition}`, AssertJ only, Java `DatabasePopulator` data, no mocks/`@MockBean`/H2 in integration tests |

### Project-specific adaptations (these override the generic references where noted)

- **Stack:** Spring Boot **4.x**, build tool **Maven** (not Gradle), **Java 21**.
- **Base package:** `io.mrkuhne.mezo` (the references' `io.mrkuhne.{project}`).
- **Primary keys: UUID** (`gen_random_uuid()`) across domain tables — matches the design handoff and the frontend (`crypto.randomUUID()`). Where a reference example shows `Long`/`BIGSERIAL`, use `UUID` here.
- **Liquibase feature ID:** the reference uses spec-kit `F{NNN}`; mezo uses **beads**, so the feature segment of a changeset name is the **driving bd issue ID** (e.g. `202606092230_mezo-a1_create_weight_log.sql`). Keep the 12-digit UTC timestamp prefix and the immutability rules unchanged.
- **Auth/ownership:** single-user. `created_by uuid` on every owned table, set server-side from the security principal (never from the client); app-level ownership filtering (`created_by = currentUser`). No login UI in Phase 2.
- **Soft delete:** `is_deleted` + Hibernate `@SQLRestriction` / `@SQLDelete`; never physically delete in normal paths.
- **jsonb** (provenance envelope, meal score, sleep factors): `@JdbcTypeCode(SqlTypes.JSON)` onto a typed embedded object — first-class, not `String`.

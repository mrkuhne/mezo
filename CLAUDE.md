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

## Git Workflow

- One bd issue + one `feat/<topic>` branch per change; merge locally into `main` with `--no-ff`, then delete the branch (single dev, no PRs).
- Conventional commit subjects carrying the driving bd id: `feat(api): ... (mezo-ej0)`.
- `git pull --rebase` on main **before** merging the feature branch — rebasing after the merge flattens the `--no-ff` merge commit.

## Session Completion

**Work is NOT complete until `git push` succeeds — never leave work stranded locally.** Before ending a session:

1. File bd issues for remaining work; close/update finished ones
2. Run quality gates if code changed (backend: `./mvnw clean test`; frontend: tests in both modes + build)
3. Push everything (if push fails, resolve and retry until it succeeds):
   ```bash
   git pull --rebase && bd dolt push && git push
   git status  # MUST show "up to date with origin"
   ```
4. Hand off: short context for the next session
<!-- END BEADS INTEGRATION -->


## Architecture Overview

**mezo** is a mobile-first health & performance companion PWA, built in three phases (frontend-first):

- **Phase 1 — Frontend (mock data):** ✅ done. React 19 + Vite + Tailwind v4, Hungarian UI, 6 vertical slices (Foundation → Today → Me → Fuel → Insights → Train) on a mock data layer. The single frontend↔data boundary is `src/data/hooks.ts`.
- **Phase 2 — Core data backend:** 🔄 in progress. **Java / Spring Boot 4.0 + PostgreSQL**, swapping the mock hooks to a real REST API **without changing the hook signatures** (frontend untouched). Monorepo: `frontend/` + `backend/` + `api/` (OpenAPI contract — single source of truth for the FE↔BE boundary). Slice A (foundation + thin auth + biometrics + TanStack Query wiring) ✅ done; Slice B (Train) ✅ done; slices C (Fuel) → D (Insights seed) → E (People) remain.
- **Phase 3 — AI brain:** later. Spring AI, pgvector, RAG, pattern/companion pipeline.

Design spec for Phase 2 (slice map, decisions): `docs/superpowers/specs/2026-06-10-phase2-backend-design.md`.

## Build & Test

```bash
# Frontend (under frontend/)
cd frontend
pnpm dev          # vite dev server on :5180 (VITE_USE_MOCK=true → mock data, no backend needed)
pnpm build        # tsc -b && vite build
pnpm test         # vitest run (also run VITE_USE_MOCK=false pnpm test — both modes must be green)
pnpm parity       # playwright parity screenshots (own port :4317; prototype path: MEZO_PROTOTYPE_DIR env var)

# Backend (under backend/)
cd backend
docker compose up -d            # local Postgres 16 on :15432 (mezo + mezo_test DBs via initdb/)
./mvnw spring-boot:run -Dspring-boot.run.profiles=demodata   # API on :8090, owner seed (login needs this!)
./mvnw clean test               # ITs against the FIXED mezo_test DB (compose must be up) — inspect tables 1:1
./mvnw clean test -Dmezo.test.use-testcontainers=true        # throwaway Testcontainers PG (CI / no compose)
# ALWAYS use `clean` (Lombok+MapStruct incremental compile is flaky)
```

```bash
# API contract (under api/ — see api_contract_conventions.md)
cd api/generate && npm run generate:api   # merge feature fragments -> api/openapi.yml
cd frontend && pnpm generate:api          # regenerate src/lib/api.gen.ts (FE types)
# backend Java types regenerate automatically in ./mvnw generate-sources/test
```

**Custom local ports** (standard ones are taken by other projects on this machine): Postgres **15432** (`DB_PORT`), backend HTTP **8090** (`MEZO_PORT`), Vite dev **5180**, parity **4317**. Frontend targets the API via `VITE_API_URL` (see `frontend/.env.example`). If the `mezo_pg` volume predates `backend/initdb/`, recreate it once: `docker compose down -v && docker compose up -d`.

## Backend Development Conventions (Phase 2+) — MANDATORY

> **Trigger — read the relevant doc(s) FIRST.** Whenever you write, review, refactor, or plan **any** backend code — Java, Spring Boot, JPA/Hibernate entity, repository, service, controller, REST endpoint, DTO/MapStruct mapper, Liquibase migration, exception handling, or backend test — you MUST consult the matching reference under `docs/references/` **before** writing code, and follow it exactly. These are non-negotiable house standards.

| Reference (`docs/references/`) | Read it when you touch… |
|---|---|
| `java_package_structure.md` | package layout, new class, naming — `feature/{name}/{controller,service,repository,entity,dto,mapper}` + `techcore/` |
| `spring_patterns.md` | DI (constructor + `@RequiredArgsConstructor`, never field), `@Transactional` (method-level only), controllers, repositories (derived→JPQL→native), MapStruct, Lombok |
| `error_handling.md` | any error/validation — `SystemRuntimeErrorException` + `SystemMessage` (code + `message.properties`), `exceptionTraceId`, no hardcoded user text, no stack traces to client |
| `liquibase_conventions.md` | any DB migration — versioned changelog, `{YYYYMMDDHHMM}_{id}_{desc}` script naming, never modify released changesets, explicit constraint names (`pk_/fk_/uq_/ck_/idx_`), entity↔DDL sync, **seed data in Java `@Profile("demodata")`, never SQL** |
| `testing_standards.md` | any backend test — integration-first (`@SpringBootTest` + Testcontainers Postgres), `test{Method}_should{Result}_when{Condition}`, AssertJ only, Java `DatabasePopulator` data, no mocks/`@MockBean`/H2 in integration tests |
| `integration_test_framework.md` | any integration test or test infrastructure — extend `AbstractIntegrationTest` (service-level) / `ApiIntegrationTest` (HTTP-level: verb helpers, `ownerAuthHeaders()`, SystemMessage asserts), data via `*Populator` factories, **new domain table → `ResetDatabase` TRUNCATE list, new aggregate → new populator** |
| `configuration_conventions.md` | any configurable value or feature toggle — everything in `application.yml` under the `mezo:` root (switches: `mezo.feature.<name>.enabled` + `FeaturesConfiguration` constants + `@ConditionalOnProperty`; values: `@Validated` `*Properties` records), **never `@Value`**, no hardcoded tunables |
| `api_contract_conventions.md` | any REST endpoint or FE↔BE DTO — **contract-first**: edit `api/feature/<name>/<name>.yml` BEFORE code, merge (`api/generate`), backend implements generated `<Tag>Api` + uses `api.dto` models, frontend types from `src/lib/api.gen.ts` (`satisfies` on request bodies); never hand-write boundary DTOs |

### Project-specific adaptations (these override the generic references where noted)

- **Stack:** Spring Boot **4.x**, build tool **Maven** (not Gradle), **Java 21**.
- **Base package:** `io.mrkuhne.mezo` (the references' `io.mrkuhne.{project}`).
- **Primary keys: UUID** (`gen_random_uuid()`) across domain tables — matches the design handoff and the frontend (`crypto.randomUUID()`). Where a reference example shows `Long`/`BIGSERIAL`, use `UUID` here.
- **Liquibase feature ID:** the reference uses spec-kit `F{NNN}`; mezo uses **beads**, so the feature segment of a changeset name is the **driving bd issue ID** (e.g. `202606092230_mezo-a1_create_weight_log.sql`). Keep the 12-digit UTC timestamp prefix and the immutability rules unchanged.
- **Auth/ownership:** single-user. `created_by uuid` on every owned table, set server-side from the security principal (never from the client); app-level ownership filtering (`created_by = currentUser`). No login UI in Phase 2.
- **Soft delete:** `is_deleted` + Hibernate `@SQLRestriction` / `@SQLDelete`; never physically delete in normal paths.
- **jsonb** (provenance envelope, meal score, sleep factors): `@JdbcTypeCode(SqlTypes.JSON)` onto a typed embedded object — first-class, not `String`.

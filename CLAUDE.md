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

- One bd issue + one `feat/<topic>` branch per change. Flow: `git push` the branch → open a **self-PR** → wait for **CI green** → merge **locally with `--no-ff`** → `git push` main (the PR auto-closes when its commits land on main) → delete the branch. Single dev, but the PR exists purely as the **CI trigger + pre-merge green light**, not for review.
- **Why the self-PR (the CI gate):** the 16 GB dev machine can't run the heavy backend integration suite locally (SpringBoot + Testcontainers OOM-dies under swap thrash). CI (`ci.yml`: full backend IT suite + FE both modes + lint + contract-drift, on a clean `ubuntu-latest`) is the **authoritative full-suite gate**; locally run only the **focused** tests for what you changed. Details + local recipes: [`docs/infrastructure/local-dev-testing.md`](docs/infrastructure/local-dev-testing.md).
- Conventional commit subjects carrying the driving bd id: `feat(api): ... (mezo-ej0)`.
- `git pull --rebase` on main **before** merging the feature branch — rebasing *after* the merge flattens the `--no-ff` merge commit; push directly after merging.

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


## Documentation (`docs/`) — MANDATORY

`docs/` is the project's **durable memory**. `bd` tracks tasks; `docs/` records the *why*, *where*, and *when* behind them. See **[`docs/README.md`](docs/README.md)** for the full taxonomy, naming conventions, and the ADR template — read it before adding docs.

Layout: `decisions/` (ADRs — the WHY), `infrastructure/` (HOW/WHERE it runs), `milestones/` (roadmap & milestone log), `references/` (coding house standards), `superpowers/specs|plans/` (per-feature design & plans — point-in-time), `features/` (per-feature **living** docs — how each feature works now, how to use/extend/integrate it), `research/` (source-ingested **research wiki** — external knowledge captured immutably & distilled; Karpathy/Nous llm-wiki pattern, git-native).

`features/` + `research/` form a **code-native LLM-wiki**: two living markdown collections sharing one frontmatter + lint + cross-link convention. `features/` documents OUR code (the code is its raw layer → staleness is auto-detected by git-drift against each doc's `key_files`); `research/` documents EXTERNAL sources (immutable in `research/raw/`). The **`knowledge-base`** skill is the operating manual for both; **`node scripts/lint-docs.mjs`** lints both (and flags stale feature docs).

**It is mandatory to keep `docs/` populated.** Whenever you:
- make or change a significant decision / direction / tool choice → write an **ADR** in `docs/decisions/`;
- add or change infrastructure (deploy, CI, secrets, hosting, proxy) → write/update a doc in `docs/infrastructure/`;
- hit or move a milestone / change the roadmap → update `docs/milestones/roadmap.md`;
- touch a **feature in any way that changes what its doc describes** — new feature/view/flow/domain/sub-feature, a behavior or contract change, a cross-feature integration, a refactor that moves files, a bugfix that changes behavior, or swapping a mock hook to a real backend → update its `docs/features/<domain>.md` (or `_platform-*.md`) **in the same change**. The `features/` docs are a **living** reference: keep them current so there's always an up-to-date description of every part of the app. After touching a doc, run `node scripts/lint-docs.mjs` to clear its staleness flag.
- learn something from an **external source** (evaluate a library/technique, an investigation, a market/tooling scan, a `/last30days` run worth keeping) → ingest it into `docs/research/` via the **`knowledge-base`** skill (source → `research/raw/`, distilled into entity/concept pages).

**`features/` maintenance policy (living docs, kept lean):**
- **Overwrite in place — git is the history.** Edit the affected sections directly; do NOT keep a changelog, version suffixes, or dated snapshots inside the doc. To see the past, use `git log -p docs/features/<x>.md`. This is what keeps the docs from bloating.
- **`features/` vs `superpowers/specs/`:** the `features/` doc is mutable and always-current ("how it works now + how to build on it"); a `specs/` doc is a frozen, dated design artifact ("why we designed it then") — never rewrite an old spec; a new design effort gets a new dated spec. The spec corpus grows by design; the feature docs stay one-per-feature and current.
- **Link, don't duplicate; edit only what changed.** Describe structure/intent/integration seams with `file:line` pointers rather than pasting code (code rots fastest). The 10-section template means a change maps to specific sections (e.g. new endpoint → §4 + §10; new integration → §5) — update those, leave the rest.
- **Threshold:** update when the change alters behavior, contract, data model, integrations, the file map, or status. A purely internal no-behavior-change refactor/typo only needs a doc touch if its `file:line` pointers went stale.

If a finished piece of work leaves no trace in `docs/` of the decision behind it, the work is **not done** — capture it before closing the `bd` issue.

> **Trigger — pull these in when relevant:** deployment / infra / hosting / k8s / ArgoCD work → read **[`docs/infrastructure/deployment-k3s-argocd.md`](docs/infrastructure/deployment-k3s-argocd.md)** and **[`docs/decisions/0001-deploy-on-k3s-argocd-learning-track.md`](docs/decisions/0001-deploy-on-k3s-argocd-learning-track.md)** FIRST. Understanding / extending / integrating an existing feature → read its **[`docs/features/<domain>.md`](docs/features/README.md)** FIRST. Documenting a feature, ingesting research, or running the doc-lint → use the **`knowledge-base`** skill (and `node scripts/lint-docs.mjs`). Project status / direction questions → **[`docs/milestones/roadmap.md`](docs/milestones/roadmap.md)**.

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
pnpm dev          # vite dev server on :5180 — REAL mode by default (backend on :8090 required); mock: VITE_USE_MOCK=true pnpm dev (no backend needed)
pnpm build        # tsc -b && vite build
pnpm test         # vitest run — REAL mode by default; also run VITE_USE_MOCK=true pnpm test (both modes must be green)
pnpm parity       # playwright parity screenshots (own port :4317; prototype path: MEZO_PROTOTYPE_DIR env var)

# Backend (under backend/)
cd backend
docker compose up -d            # local Postgres 16 on :15432 (mezo + mezo_test DBs via initdb/)
./mvnw spring-boot:run -Dspring-boot.run.profiles=demodata   # API on :8090, owner seed ONLY (login needs this!) — clean slate
./mvnw spring-boot:run -Dspring-boot.run.profiles=demodata,demofixtures  # + Train demo fixtures (opt-in)
./mvnw clean test               # ITs against the FIXED mezo_test DB (compose must be up) — inspect tables 1:1
./mvnw clean test -Dmezo.test.use-testcontainers=true        # throwaway Testcontainers PG (CI / no compose)
# ALWAYS use `clean` (Lombok+MapStruct incremental compile is flaky)
```

```bash
# API contract (under api/ — see api_contract_conventions.md)
cd api/generate && npm run generate:api   # merge feature fragments -> api/openapi.yml
cd frontend && pnpm generate:api          # regenerate src/data/_client/api.gen.ts (FE types)
# backend Java types regenerate automatically in ./mvnw generate-sources/test
```

**Custom local ports** (standard ones are taken by other projects on this machine): Postgres **15432** (`DB_PORT`), backend HTTP **8090** (`MEZO_PORT`), Vite dev **5180**, parity **4317**. Frontend targets the API via `VITE_API_URL` (see `frontend/.env.example`). If the `mezo_pg` volume predates `backend/initdb/`, recreate it once: `docker compose down -v && docker compose up -d`.

## Frontend Development Conventions (Phase 1+) — MANDATORY

> **Trigger — read the reference FIRST.** Whenever you write, review, refactor, or plan **any** `frontend/src` code — a React page, component, bottom-sheet, feature-local logic, a data hook or mock, a REST client, a shared UI primitive, routing, or a frontend test — you MUST read **[`docs/references/frontend_conventions.md`](docs/references/frontend_conventions.md)** **before** writing code, and follow it exactly. Non-negotiable house standard; the living structure is in [`docs/features/_platform-design-system.md` §1a](docs/features/_platform-design-system.md), the rationale in [ADR 0003](docs/decisions/0003-frontend-structure-conventions.md).

**The non-negotiables (the reference has the full rules + recipes):**
- **Four layers:** `app/` (shell + `router.tsx`) · `features/<domain>/{pages,components,sheets,logic}/` · `shared/{ui,lib,hooks}/` · `data/` (per-domain + `_client/` + the `data/hooks.ts` barrel).
- **Naming:** everything routed is a `*Section` (owns an `<Outlet>`) or a `*Page` (leaf). Modals → `*Sheet` in `sheets/`; presentational → `components/`; pure logic → `logic/`. **Never introduce a new `*Screen`/`*View`.**
- **Data:** every feature imports hooks from **`@/data/hooks` only** (a thin re-export barrel); implementations live in `data/<domain>/<name>Hooks.ts`. Dual-mode reads use `useDualQuery` — never the mock seed as a real-mode fallback.
- **Imports:** deep + absolute via the `@/*` alias; **no barrels** except `data/hooks.ts`; no relative `../`; tests colocated.
- **`shared/ui` is domain-free** — a UI file that imports `@/data/*` or serves one feature belongs in `features/<domain>/components/`.
- **Gate:** `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test` — both modes green; update the feature's `docs/features/<domain>.md` + run `node scripts/lint-docs.mjs`.

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
| `api_contract_conventions.md` | any REST endpoint or FE↔BE DTO — **contract-first**: edit `api/feature/<name>/<name>.yml` BEFORE code, merge (`api/generate`), backend implements generated `<Tag>Api` + uses `api.dto` models, frontend types from `src/data/_client/api.gen.ts` (`satisfies` on request bodies); never hand-write boundary DTOs |

### Project-specific adaptations (these override the generic references where noted)

- **Stack:** Spring Boot **4.x**, build tool **Maven** (not Gradle), **Java 21**.
- **Base package:** `io.mrkuhne.mezo` (the references' `io.mrkuhne.{project}`).
- **Primary keys: UUID** (`gen_random_uuid()`) across domain tables — matches the design handoff and the frontend (`crypto.randomUUID()`). Where a reference example shows `Long`/`BIGSERIAL`, use `UUID` here.
- **Liquibase feature ID:** the reference uses spec-kit `F{NNN}`; mezo uses **beads**, so the feature segment of a changeset name is the **driving bd issue ID** (e.g. `202606092230_mezo-a1_create_weight_log.sql`). Keep the 12-digit UTC timestamp prefix and the immutability rules unchanged.
- **Auth/ownership:** single-user. `created_by uuid` on every owned table, set server-side from the security principal (never from the client); app-level ownership filtering (`created_by = currentUser`). No login UI in Phase 2.
- **Soft delete:** `is_deleted` + Hibernate `@SQLRestriction` / `@SQLDelete`; never physically delete in normal paths.
- **jsonb** (provenance envelope, meal score, sleep factors): `@JdbcTypeCode(SqlTypes.JSON)` onto a typed embedded object — first-class, not `String`.

# Mezo — Phase 2 Core Data Backend — Design

> **Date:** 2026-06-10
> **Status:** Approved (brainstorming) → next: writing-plans for Slice A
> **Scope:** Phase 2 only — stand up a real backend for the data the UI already reads, **without
> changing any frontend component**. Phase 3 (AI brain) is explicitly out of scope.

## Source of truth

- **Product & data shapes (locked):** the design handoff — `/Users/daniel.kuhne/Downloads/design_handoff_mezo/`,
  in particular `04-data-model.md` (UI shapes) and `05-backend-supabase.md` (schema intent + DDL + build order).
- **Backend house standards (mandatory):** `docs/references/` — `java_package_structure.md`,
  `spring_patterns.md`, `error_handling.md`, `liquibase_conventions.md`, `testing_standards.md`.
  The `CLAUDE.md` "Backend Development Conventions" section is the trigger index for these. This spec
  **references** them; it does not restate them.
- **Frontend contract:** `src/data/hooks.ts` — the single frontend↔data boundary (~25 hooks).

The handoff backend doc assumes **Supabase-direct**. The schema *intent* is kept; the *infrastructure
layer* is re-derived onto Java/Spring Boot per the `mezo-gqi` decision (see below).

## Approved decisions

| Decision | Choice |
|---|---|
| Backend stack (`mezo-gqi`) | **Java / Spring Boot 4.x + PostgreSQL**, **Maven**, **Java 21** |
| Phase 2 shape | Overarching architecture design (this doc) + **vertical slices** implemented one at a time, Phase-1 style, with a parity checkpoint after each |
| Repo structure | **Symmetric monorepo**: existing frontend moves under `frontend/`, new `backend/` alongside; `.git`/`.beads` untouched at root |
| Auth / ownership | **Single-user thin auth**: seeded owner + minimal JWT login; `created_by uuid` on every owned table, set server-side; **app-level** ownership filtering; **no login UI** in Phase 2 |
| Frontend data layer | **TanStack Query** (`@tanstack/react-query`) — hook signatures unchanged, internals swap to `useQuery`/`useMutation` |
| First domain (Slice A) | **Biometrics trio**: `weight_log` + `sleep_log` + `check_in` (all three have existing write-path hooks) |

## 1. Architecture overview

Symmetric monorepo, three layers, `hooks.ts` as the one integration boundary.

```
mezo/  (git, .beads unchanged at root)
├── frontend/                  ← current root frontend moves here
│   ├── src/  (app, features, data/hooks.ts ← the swap happens here)
│   ├── package.json, vite.config.ts, tailwind, tsconfig
│   └── tests/parity/          (prototype path lifted to an env var — bd: mezo-ero)
├── backend/                   ← NEW Spring Boot (Maven)
│   ├── pom.xml, mvnw
│   ├── src/main/java/io/mrkuhne/mezo/...
│   ├── src/main/resources/db/changelog/  (Liquibase)
│   └── compose.yaml           (local Postgres)
└── docs/, README, CLAUDE.md, .gitignore   (merged at root)
```

**Data flow:** React component → `useGoals()/useSleep()/useCheckins()` (signature unchanged) →
TanStack Query `useQuery`/`useMutation` → `lib/api` fetch client (Bearer JWT) → Spring
`@RestController` → `@Service` → JPA `Repository` → Postgres.

**Key invariant:** the public shape of every hook (what it returns) is the contract. Parity tests and
feature tests stay green through the swap because **no component changes**.

## 2. Backend composition (Spring Boot)

Follow `docs/references/` exactly. Highlights and project bindings:

- **Build:** Maven (`./mvnw`), Spring Boot 4.x, Java 21.
- **Package layout** (`java_package_structure.md`): base `io.mrkuhne.mezo`, **feature-based**:
  ```
  io.mrkuhne.mezo
  ├── feature/biometrics/{controller,service,repository,entity,dto,mapper}
  ├── feature/auth/...
  └── techcore/{config,security,exception,util}
  ```
  Suffixes: `*Controller / *Service / *Repository / *Entity / *Dto / *Request / *Response / *Mapper`.
- **Spring patterns** (`spring_patterns.md`): constructor injection via `@RequiredArgsConstructor`
  (field injection forbidden); `@Transactional` **method-level only**, on writes only (no annotation on
  reads, never on controllers); controllers do request/response only (`@Valid`, `@ResponseStatus`);
  repository preference derived → JPQL → native; **MapStruct** (`componentModel = "spring"`); Lombok
  (`@RequiredArgsConstructor` / `@Slf4j` / `@Data` / `@Builder`). Public methods top, private bottom.
- **Error handling** (`error_handling.md`): every error is `SystemRuntimeErrorException` + `SystemMessage`
  (code `{DOMAIN}_{ACTION}_{REASON}` + `message.properties`, **no hardcoded user text**),
  `exceptionTraceId` (UUID) logged server-side and returned to the client, **stack traces never** leave
  the server. One `@RestControllerAdvice` in `techcore/exception`.
- **Auth (thin):** an `app_user` table; the **owner is seeded in Java `@Profile("demodata")`
  `CommandLineRunner`, idempotently (`count() == 0`) — NOT SQL** (`liquibase_conventions.md` §Seed).
  Minimal `POST /api/auth/login` (owner email + password → JWT); Spring Security resource server
  validates the JWT; principal → `userId`. **No login UI** — the frontend bootstraps the token silently.
- **Ownership (app-level):** `created_by uuid` set from the principal on every write (the client never
  sends it); reads filter `created_by = :currentUser` (shared base/`@Filter`). This realizes the
  handoff's RLS intent at the application layer. Multi-user can be switched on later.
- **Per-table conventions:** **UUID PK** (`gen_random_uuid()`); `is_deleted` soft-delete via Hibernate
  `@SQLRestriction` / `@SQLDelete`; `@CreationTimestamp` / `@UpdateTimestamp`; enums via
  `@Enumerated(STRING)`; **jsonb** (provenance envelope, meal `score`, sleep `factors`) via
  `@JdbcTypeCode(SqlTypes.JSON)` onto a typed object (first-class, not `String`); the entity mirrors
  every DB constraint (`@Column(nullable/length)` + Bean Validation).

## 3. Frontend integration (TanStack Query)

- `@tanstack/react-query` + `QueryClientProvider` in the app shell; PWA-friendly cache (offline-queue base later).
- `frontend/src/lib/api.ts` — thin fetch client: base URL from `VITE_API_URL`, Bearer JWT injection,
  maps backend `SystemMessage` errors to a typed client error.
- `frontend/src/lib/auth.ts` — owner-token bootstrap (login call + storage), no login UI.
- **Hook-swap pattern** — signature preserved. Example: `useGoals()` today returns
  `useState(initialWeightLog)`; tomorrow `useQuery(['weightLog'])` + `useMutation(postWeight)`, but the
  returned `{ goal, weightLog, …, logWeight }` shape is **identical** → UI untouched.
- **Mock fallback:** a `VITE_USE_MOCK` flag keeps not-yet-wired hooks on the old mock, so the app runs
  end-to-end between slices.

## 4. Schema strategy (incremental Liquibase)

Per `liquibase_conventions.md`. The `05` doc DDL is the source, translated to Spring/JPA. The schema
grows **per slice** — not all ~20 tables up front.

- **Structure:** `backend/src/main/resources/db/changelog/db.changelog-master.yaml` + versioned folders
  (`1.0.0/` …) each with a `_master.yml` + `script/`. One development = one SQL file (DDL + DML together).
- **Filename / id:** `{YYYYMMDDHHMM}_{bd-issue-id}_{description}.sql` — the spec-kit `F{NNN}` segment is
  replaced by the **driving bd issue ID** (e.g. `202606102230_mezo-a1_create_weight_log.sql`). 12-digit
  UTC timestamp prefix and immutability rules unchanged; released changesets are never modified.
- **Explicit constraint names:** `pk_ / fk_ / uq_ / ck_ / idx_` as `{type}_{table}_{column}` (≤ 63 chars).
- **Seed data:** Java `@Profile("demodata")`, never SQL.
- **Slice A tables:** `app_user` · `user_profiles` · `weight_log` · `sleep_log` · `check_in` — each with
  `created_by` + soft-delete + timestamps + indexes; the entity mirrors every constraint.

## 5. Slice map (full Phase 2)

| Slice | Contents | Hooks |
|---|---|---|
| **A · Foundation + Biometrics** | monorepo move, Spring Boot 4.x scaffold (Maven), Postgres + Liquibase, thin auth + owner seed, TanStack Query provider, `weight_log`/`sleep_log`/`check_in` end-to-end | `useGoals`(logWeight), `useSleep`(logSleep), `useCheckins`(saveCheckIn) |
| **B · Train** | `mesocycle`/`workout_session`/`exercise(_set)`/`sport_session` + **provenance envelope jsonb** | `useTrain` |
| **C · Fuel** | `food_item`/`meal`/`meal_item`/`recipe`/`supplement_intake`/`medication(_dose)`/`nutrition_targets` + fuel-timeline **view** | `useFuelDay/Timeline/Week`, `usePantry`, `useRecipes`, `useStack`, `useProtocol` |
| **D · Insights (seed-only)** | `pattern`/`knowledge_fact`/`ai_conversation` tables with **seed/mock rows** (no AI — Phase 3 populates) | `useInsights`, `useKnowledge`, `useChat` |
| **E · People** | `person_entry` + mention write | `usePeople`(logMention), `useProfile` |

**Ordering rationale — deliberate risk-forward:** after Slice A's simple flat biometrics tables, **Train**
comes next because it carries the hardest, load-bearing pattern — the provenance envelope `jsonb`
(`baseline → adjustments → confidence → override`). Proving `@JdbcTypeCode(SqlTypes.JSON)` typed-object
handling early de-risks **Fuel** (which reuses it for meal `score`). **People** is relatively isolated
(PERMA-R, mention counter), so it goes last. Parity screenshot + sign-off after each slice.

## 6. Hosting + local dev (leaning — does not block development)

`mezo-gqi` direction: **Vercel** (frontend) + **Spring Boot container on Cloud Run** (scale-to-zero) +
**managed Postgres** (Neon or Supabase-DB). Local dev: `backend/compose.yaml` Postgres. Finalized at the
deploy slice; recorded here as the default.

## 7. Testing

- **Backend** (`testing_standards.md`): **integration-first** — `@SpringBootTest` + `@Transactional`,
  **Testcontainers** real Postgres (not H2), Java **`DatabasePopulator`** test data (not SQL), **AssertJ**
  (`assertThat`), naming `test{Method}_should{Result}_when{Condition}`. No mocks / `@MockBean` in
  integration tests. **Ownership-isolation test per owned entity** (user B sees 0 of user A's rows).
- **Frontend** (unchanged): existing Vitest hook tests run against **MSW** (mocked HTTP); parity
  Playwright unchanged. Slice A: the three write-paths (`logWeight`/`logSleep`/`saveCheckIn`) tested as
  real DB round-trips.

## 8. Convention anchor

The five docs in `docs/references/` plus the `CLAUDE.md` "Backend Development Conventions" section are
the mandatory frame for all backend work. Any plan or implementation cites them and follows them
exactly; this spec does not duplicate their content.

## Open items (resolve at the relevant slice — not blockers)

- Hosting target finalization (Neon vs Supabase-DB) — at the deploy slice.
- Whether the owner token bootstrap uses an auto-login call vs a configured long-lived dev token — at Slice A.
- Within Slice A: exact order of the monorepo move vs scaffold (the writing-plans plan sequences this).
- `useProfile` data source split: `user_profiles` lands in Slice A (auth foundation); the profile screen's
  `areas`/`quickSettings`/`notifSettings` wiring is finalized in Slice E (People/Me).

---
title: Auth & Security
type: feature-platform
status: mixed
updated: 2026-07-24
tags: [platform, auth, backend, frontend]
key_files:
  - backend/src/main/java/io/mrkuhne/mezo/feature/auth
  - backend/src/main/java/io/mrkuhne/mezo/techcore/security
  - backend/src/main/java/io/mrkuhne/mezo/techcore/exception
  - api/feature/auth/auth.yml
  - backend/src/main/resources/application.yml
  - frontend/src/data/_client/auth.ts
  - frontend/src/data/_client/api.ts
related: [_platform-data-layer, _platform-api-backend, me]
---

# Auth & Security — Feature Documentation

> One-line: the single-owner authentication + ownership model (login → 30-day HS256 JWT → resource-server filter → server-side `created_by`). **Status: ✅ backend done (Phase 2, Slice A); ✅ FE token bootstrap real, 🔶 stubbed in mock mode.** This is a *platform* feature — no route/tab of its own; it sits under every authenticated screen, bootstrapped at app boot before any view renders.

---

## 1. Summary

mezo is a **single-user** PWA: there is exactly **one** account — "the owner" — seeded by Java code under the `demodata` Spring profile. The only auth surface is `POST /api/auth/login` (email + BCrypt password → JWT); every other API route is locked behind Spring Security's OAuth2 **resource-server** (JWT) filter. There is **no login UI**: the frontend silently logs in with build-time owner credentials at boot, keeps the token in a module variable, and attaches `Authorization: Bearer` on every request. Ownership of domain rows is enforced **server-side** — `created_by` is resolved from the JWT subject (never sent by the client) and reads are filtered `created_by = currentUser` (app-level, not DB row-level security).

- **Backend:** ✅ real — login, JWT issue/validate, CORS, owner seed, ownership base. (Phase 2, Slice A — done.)
- **FE real mode:** ✅ real — boot-time `bootstrapOwnerToken()` gates the whole app.
- **FE mock mode:** 🔶 bootstrap skipped entirely (no network); MSW returns a stub token for real-mode tests.

Driving design: [`docs/superpowers/specs/2026-06-10-phase2-backend-design.md`](../superpowers/specs/2026-06-10-phase2-backend-design.md) (auth/ownership row ~line 28; detail ~lines 79-84; Slice A ~line 123; ownership-isolation testing ~line 146; open questions ~lines 160-162). Deploy/secret backdrop: [`docs/decisions/0001-deploy-on-k3s-argocd-learning-track.md`](../decisions/0001-deploy-on-k3s-argocd-learning-track.md).

---

## 2. User-facing behavior

There is **no visible login screen, logout, or token-expiry UX.** Auth is invisible plumbing; the only thing the user perceives is "the app loads (or it doesn't)".

- **Cold load (real mode):** `QueryProvider` blocks render (`ready=false`) → `bootstrapOwnerToken()` → `POST /api/auth/login` with `VITE_OWNER_EMAIL`/`VITE_OWNER_PASSWORD` → token stored → `ready=true` → app renders, all queries authenticated.
- **Cold load (mock mode):** `QueryProvider` sees `isMockMode()` true → `ready` starts `true`, bootstrap skipped, no network. Hooks serve static mock data.
- **Owner credentials** are baked into the frontend build — `owner@mezo.local` / `owner` (per the runbook: "auto-login; baked into the frontend build, not a real secret").
- **Bootstrap failure (real mode):** caught, logged (`console.error('Owner token bootstrap failed', err)`), then `ready=true` *anyway* → app renders **tokenless** → every query 401s → empty / ghost-guarded screens. No banner, no retry (deferred — see §9, `mezo-aus`).

---

## 3. Architecture & data flow

Two paths: token **issuance** (login) and token **use** (every protected request).

**Login (token issuance):**
```
QueryProvider.useEffect (real mode only)        frontend/src/app/providers/QueryProvider.tsx:13
  → bootstrapOwnerToken()                       frontend/src/data/_client/auth.ts:7
  → apiFetch POST /api/auth/login               frontend/src/data/_client/api.ts:22  (no Bearer yet)
  → AuthController.login()                       backend …/feature/auth/controller/AuthController.java (implements generated AuthApi)
  → AuthService.login()                          backend …/feature/auth/service/AuthService.java:29
       findByEmail + passwordEncoder.matches  → else 401 AUTH_LOGIN_INVALID_CREDENTIALS
       JwtEncoder.encode(HS256 header + claims{sub=userId, email, iat, exp=+30d})   :36-45
  → TokenResponse{ token }
  → setToken(token)                              frontend/src/data/_client/api.ts:20  (module-level `let token`)
```

**Any protected request (token validation + ownership):**
```
view → useX hook (frontend/src/data/hooks.ts) → *Api.ts client → apiFetch (adds Bearer)   api.ts:27
  → Spring Security filter chain                 …/techcore/security/SecurityConfig.java:38-45
       oauth2ResourceServer().jwt()  → NimbusJwtDecoder validates HS256 signature + exp
       authorizeHttpRequests: anyRequest().authenticated()    (401 if missing/invalid)
  → FooController  (private final CurrentUserId currentUserId)
       service.method(currentUserId.get(), …)   ← resolves UUID from jwt.getSubject()
  → FooService → OwnedRepository.findAllOwned(createdBy) / sets entity.createdBy on write
  → Postgres  (created_by = currentUser, is_deleted = false)
```

**The load-bearing seam:** controllers never read the principal from a method argument. They inject the `CurrentUserId` component (`…/techcore/security/CurrentUserId.java`) and call `.get()`, which returns `UUID.fromString(jwt.getSubject())`. The same pattern is used by `WeightLogController`, `SleepLogController`, `CheckInController`, and `TrainController` — they call e.g. `service.list(currentUserId.get())` / `service.log(currentUserId.get(), req)`. The client *cannot* spoof ownership: the only thing it controls is the bearer token, whose subject is the owner UUID minted at login.

**Dual-mode note:** the data layer (`frontend/src/data/hooks.ts`) switches each hook between mock and real via `isMockMode()` (`@/data/_client/mode`). Auth only participates in the real branch — mock hooks never hit `apiFetch`, so the in-memory `token` stays `null` and nothing 401s because nothing is requested.

---

## 4. Data model & API

**Tables** — DDL: `backend/src/main/resources/db/changelog/1.0.0/script/202606101200_mezo-v67_create_auth.sql`.

`app_user` — the identity row. **Not** an `OwnedEntity` (it *is* the owner).
| Column | Type | Notes |
|---|---|---|
| `id` | `uuid PK` | `default gen_random_uuid()` |
| `email` | `varchar(255) NOT NULL` | `CONSTRAINT uq_app_user_email UNIQUE` |
| `password_hash` | `varchar(100) NOT NULL` | BCrypt |
| `name` | `varchar(120) NOT NULL` | display name |
| `created_at` | `timestamptz` | `@CreationTimestamp` |

Entity: `…/feature/auth/entity/AppUserEntity.java`. Repository: `AppUserRepository` (`findByEmail`, `existsByEmail`).

`user_profiles` — the profile-data side of the user (1:1 with the owner; PK *is* `created_by`).
| Column | Type | Notes |
|---|---|---|
| `created_by` | `uuid PK` | FK → `app_user.id` `ON DELETE CASCADE` (`fk_user_profiles_created_by_app_user_id`) |
| `handle` | `varchar(60)` | |
| `birth_date` | `date` | |
| `member_since` | `date default current_date` | |
| `streak_days` | `int default 0` | |
| `updated_at` | `timestamptz` | `@UpdateTimestamp` |

Entity: `…/feature/auth/entity/UserProfileEntity.java`. Repository: `UserProfileRepository` (plain `JpaRepository`). **Caveat:** `user_profiles` landed in Slice A but the full FE profile screen (`useProfile`) is still partly mock — its read/write API surface is minimal vs. biometrics/Train (design spec ~line 162).

**Ownership base** (every *owned* domain table — NOT `app_user`):
- `OwnedEntity` (`…/techcore/persistence/OwnedEntity.java`, `@MappedSuperclass`): `created_by uuid NOT NULL updatable=false`, `is_deleted boolean default false`, `created_at`. Extended by `WeightLogEntity`, Train entities, etc.
- `OwnedRepository<T>` (`…/techcore/persistence/OwnedRepository.java`, `@NoRepositoryBean`): `findAllOwned(UUID createdBy)` = JPQL `where e.createdBy = :createdBy and e.deleted = false order by e.date asc`. Belt-and-braces with each entity's `@SQLRestriction` — the in-repo comment says keep both.
- `OwnershipGuard` (`…/techcore/persistence/OwnershipGuard.java`, static utility): `ownedOrThrow(Optional<T extends OwnedEntity>, UUID createdBy)` + the canonical `notFound()` (`RESOURCE_NOT_FOUND`, HTTP 404) — the **foreign-row == 404 invariant in one tested place**. By-id reads gate through it (Train/Running/Workout services, the train-side signal calculators) instead of hand-rolling the filter + throw, so a row owned by someone else is indistinguishable from a missing one.

**Endpoints** (auth feature) — contract source: [`api/feature/auth/auth.yml`](../../api/feature/auth/auth.yml) (tag `Auth`, "Single-user thin auth (owner login)").
| Verb | Path | Auth | Body → Response | Errors |
|---|---|---|---|---|
| POST | `/api/auth/login` | `security: []` (public) | `LoginRequest{email, password}` → `TokenResponse{token}` | 400 field (`VALIDATION_INVALID_EMAIL`, `VALIDATION_INVALID_VALUE`), 401 `AUTH_LOGIN_INVALID_CREDENTIALS` |

`LoginRequest.email` is `format: email`; `password` `minLength: 1`. DTOs `LoginRequest`/`TokenResponse` are **generated** into `io.mrkuhne.mezo.api.dto` (BE) and `components['schemas']` in `frontend/src/data/_client/api.gen.ts` (FE) — never hand-written.

**Public allowlist** (`SecurityConfig.java:43`): `/api/auth/login`, `/actuator/health`. **Everything else** `authenticated()`.

### The JWT, in detail

**Issuance** (`AuthService.login`, `AuthService.java:36-45`):
- `JwtClaimsSet`: `subject = user.getId().toString()` (the owner UUID — the ownership anchor), `issuedAt = now`, `expiresAt = now + 30 days`, custom claim `email`.
- **Algorithm gotcha (load-bearing):** `NimbusJwtEncoder` over a symmetric `ImmutableSecret` cannot infer the JWS alg, so `JwsHeader.with(MacAlgorithm.HS256)` is set **explicitly**; the code comment warns it otherwise throws *"Failed to select a JWK signing key"*.

**Validation** (`SecurityConfig.java`):
- `jwtEncoder()` = `new NimbusJwtEncoder(new ImmutableSecret<>(secret))` (`:72-74`).
- `jwtDecoder()` = `NimbusJwtDecoder.withSecretKey(new SecretKeySpec(secret, "HmacSHA256")).macAlgorithm(HS256)` (`:66-69`).
- `secret = props.jwtSecret().getBytes(UTF_8)`, captured in the constructor (`:30-33`).
- Wired via `.oauth2ResourceServer(o -> o.jwt(jwt -> {}))`. Session `STATELESS`; CSRF disabled (Bearer, not cookies).

**Crypto:** `PasswordEncoder` = `BCryptPasswordEncoder` (`SecurityConfig.java:78`). Hashed on seed (`OwnerSeedData.java:31`), verified on login (`AuthService.java:31`).

### Owner seeding & config

`OwnerSeedData` (`…/feature/auth/OwnerSeedData.java`): `@Component @Profile("demodata") @Order(0)` `CommandLineRunner`. `@Order(0)` because later runners (e.g. `TrainSeedData`) depend on the owner existing. Idempotent (`if (existsByEmail(...)) return;`). Creates `AppUserEntity` (BCrypt-hashed) + a `UserProfileEntity` with `createdBy = owner.getId()`. **No owner exists without `demodata`** → login is impossible on a bare run (`./mvnw spring-boot:run -Dspring-boot.run.profiles=demodata` is the minimum to log in).

`OwnerProperties` (`…/feature/auth/OwnerProperties.java`) — `@Validated @ConfigurationProperties("mezo.auth")` record: `ownerEmail @NotBlank @Email`, `ownerPassword @NotBlank`, `ownerName @NotBlank`, `jwtSecret @NotBlank @Size(min = 32)` (HS256 needs ≥256 bits — a shorter secret fails **at bind/boot**, not at sign time). Bound in `application.yml` with env overrides + dev defaults: `MEZO_JWT_SECRET:dev-only-change-me-32-bytes-minimum-secret`, `MEZO_OWNER_EMAIL:owner@mezo.local`, `MEZO_OWNER_PASSWORD:owner`, `MEZO_OWNER_NAME:Owner`. (`application.yml` also carries unrelated `mezo:` sub-trees — `mezo.cors.*` here, since G5 `mezo.goal.*` for the goal engine, since Fuel P2 `mezo.fuel.protocol.*` (`FuelProtocolProperties`, protocol confidence default), the Phase-3 `mezo.companion.*` tree (`CompanionProperties` — llm/chat/snapshot/tools/facts/extraction/advisors/embedding/summary), since V2.2 the `mezo.techcore.cron.*` job-switch zone, and since Fuel P6 `mezo.pantry-import.*`/`mezo.pantry-suggestion.*` (the OpenFoodFacts client — its User-Agent reuses the `MEZO_OWNER_EMAIL` env var as the OFF-etiquette contact — plus the swap-heuristic knobs) with the `mezo.feature.pantry-import.enabled` switch, and since Fuel P8 (`mezo-8vum`) `mezo.pantry-scrape.*` (`PantryScrapeProperties` — the outbound page-fetch + LLM-extraction limits, incl. `allow-private-hosts: false`) with the `mezo.feature.pantry-scrape.enabled` switch (which additionally needs the companion switch on for the `CompanionLlm` bean, else the scrape endpoint 503s), and since the (now COMPLETE) proactive epic the `mezo.proactive.*` tree (`ProactiveProperties` — `briefing.*` + `weekly.cron` + `memoir.cron` + `heartbeat.*` + `prediction.*` + `experiment.{propose-cron,outcome-cron,max-open,min-days,max-days}`) with the `mezo.feature.proactive.enabled` switch plus the SIX `mezo.techcore.cron.{briefing,weekly-suggestion,memoir,heartbeat,prediction,experiment}-job.enabled` job switches, since Train `mezo-dhdr` the `mezo.hypertrophy.*` tree (`HypertrophyProperties`) with the `mezo.feature.hypertrophy-drive.enabled` switch, and since gamified growth (`mezo-df7q`/`mezo-jzca`/`mezo-6ng8`) the `mezo.quest.*` (`QuestProperties`, incl. the E3 `adaptive` band record) + `mezo.activity.*` (`ActivityProperties`) trees with the `mezo.feature.quest.enabled` + `mezo.feature.activity.enabled` switches plus the E3 `mezo.quest.flavor.enabled` sub-switch and the `mezo.techcore.cron.quest-job.enabled` job switch, and since the Fuel slot-timing slice (`mezo-53su`) the `mezo.fuel-settings.*` tree (`FuelSettingsProperties` — the ghost meal cadence + caffeine cutoff) with the `mezo.feature.fuel-settings.enabled` switch (this slice also **removed** the `mezo.habit.caffeine-cutoff` key from the `mezo.habit.*` subtree), and since the daily closing ritual (`mezo-hvmx`) the `mezo.ritual.*` tree (`RitualProperties` — `lead-min`/`prep-lead-min`) with the `mezo.feature.ritual.enabled` switch — all bound by their own `*Properties` records or consumed via `@ConditionalOnProperty`; auth binds only `mezo.auth.*`/`mezo.cors.*`.)

### CORS

`CorsProperties` (`…/techcore/security/CorsProperties.java`) — `@ConfigurationProperties("mezo.cors")`, `allowedOrigins @NotEmpty List<String>`; default `http://localhost:5180` (Vite dev). `SecurityConfig.corsConfigurationSource()` (`:54-63`): methods `GET/POST/PUT/DELETE/OPTIONS`, headers `Authorization, Content-Type`, **`allowCredentials = false`** (Bearer header, not cookies). Server-to-server callers send no `Origin` and bypass CORS entirely.

---

## 5. Integrations

Auth is the **substrate every other backend feature stands on**. The contract crossing each seam:

- **Every owned-domain feature ↔ ownership (`CurrentUserId` → `OwnedEntity.createdBy`).** *Contract:* the controller injects `CurrentUserId` and passes `currentUserId.get()` (a `UUID`) into the service as the owner key; the service sets `entity.setCreatedBy(uuid)` on write and reads via `OwnedRepository.findAllOwned(uuid)`. The DTO that crosses the FE↔BE boundary **never** carries `created_by`. Consumers today: **biometrics** (`WeightLogController`, `SleepLogController`, `CheckInController`), **Train** (`TrainController`), **goal**/**Fuel**/**progression**, and — Phase-3 — **companion** (`CompanionController`, whose `ai_conversation`/`ai_message` owned tables scope every finder `…AndCreatedByAndDeletedFalse`; since V0.3 its `ContextSnapshotAssembler` also composes OTHER features' reads with the same explicit-`userId` scoping, and since V0.5 the chat **tools** carry the same principal in the Spring AI `ToolContext` — `ToolContexts.userId(ctx)`, NEVER a model-provided arg, so an LLM cannot ask a tool about another user — see [`companion.md`](companion.md) §5.2/§5.5). Anything new (Insights, People when they land) plugs in here unchanged.
- **Frontend data layer ↔ token (`api.ts` `setToken` → `apiFetch`/`apiSse` Bearer).** *Contract:* `bootstrapOwnerToken()` is the **only** writer of the module-level `token`; every `*Api.ts` client crosses through `apiFetch` — or, for the companion V0.4 SSE turn, `apiSse` (same file, same Bearer injection) — the **only** readers. The hooks in `frontend/src/data/hooks.ts` are auth-unaware — they call API clients that are already authenticated. No feature imports the token directly.
- **App boot ↔ `QueryProvider` gate.** *Contract:* `QueryProvider` exposes a binary `ready` to the rest of the tree. In real mode `ready` flips only after bootstrap settles (success *or* failure); in mock mode it starts `true`. Every screen renders downstream of this gate, so they can assume "a login attempt has already happened" (but **not** that it succeeded — see the tokenless-failure path in §2/§9).
- **Error envelope ↔ `SystemMessage[]`.** *Contract:* `AuthService`/`CurrentUserId` throw `SystemRuntimeErrorException` → `GlobalExceptionHandler` (`…/techcore/exception/GlobalExceptionHandler.java`) → `SystemMessage[]` JSON (`code/message/fieldName/exceptionTraceId`). The FE `ApiError` (`api.ts:12`) parses exactly that array. **Since mezo-78rn** the same handler maps a method-mismatch (`HttpRequestMethodNotSupportedException` — e.g. a POST to a path that only survives as `/api/meal/{id}` once a `@ConditionalOnProperty` controller is gone) to a clean **405 `METHOD_NOT_ALLOWED`** SystemMessage instead of the generic 500 catch-all, and a multipart container-cap breach (`MaxUploadSizeExceededException` — `spring.servlet.multipart.max-file/request-size` in `application.yml`, kept above the 5 MB app-level photo cap so the service check stays the message-bearing limit) to a clean **400** rather than a 500. **Asymmetry to know:** Spring Security's *filter-level* 401 (missing/invalid token) uses `BearerTokenAuthenticationEntryPoint` → **empty body**, NOT the `SystemMessage[]` envelope (only `AuthService`/`CurrentUserId` 401s flow through `GlobalExceptionHandler`). Tracked in `mezo-aus`.
- **Config ↔ deploy.** *Contract:* `OwnerProperties` + `CorsProperties` bind `mezo.auth.*` / `mezo.cors.*`; in prod those env vars come from the `mezo-app` Kubernetes SealedSecret (see §9 / §10). Rotating the JWT secret invalidates all existing tokens — acceptable for a single user who re-bootstraps on next load.
- **Tests ↔ `ownerAuthHeaders()`.** *Contract:* every HTTP-level integration test obtains a real Bearer header by logging in as the `demodata` owner — see §8.

---

## 6. How to use it (consume)

**From the frontend — you usually consume auth *implicitly*.** Import a data hook from `@/data/hooks`; the request is already authenticated because `QueryProvider` bootstrapped the token before your view mounted. You do not touch `setToken`/`apiFetch` yourself.

```tsx
// A view consuming an authenticated domain hook — auth is invisible.
import { useWeightLog } from '@/data/hooks'

function WeightCard() {
  const { data } = useWeightLog()      // real mode: Bearer attached automatically; mock mode: static data
  return <Trend points={data ?? []} />  // ghost-guard the null/empty case (no static fallback in real mode)
}
```

**From the backend — consume the owner identity in a controller.** Inject `CurrentUserId` (a `@Component` in `techcore/security`) and pass `.get()` into the service:

```java
@RestController
@RequiredArgsConstructor
public class FooController implements FooApi {        // FooApi is generated from api/feature/foo/foo.yml
    private final FooService service;
    private final CurrentUserId currentUserId;

    @Override
    public ResponseEntity<List<FooResponse>> listFoo() {
        return ResponseEntity.ok(service.list(currentUserId.get()));   // UUID owner key — never from the request
    }
}
```

The returned `UUID` is the owner anchor: use it as `createdBy` on writes and as the filter key on reads (`OwnedRepository.findAllOwned(uuid)`).

---

## 7. How to extend it

**Recipe — add a new protected, owner-scoped backend endpoint** (the established pattern; consult the referenced house standards *before* writing code):

1. **Contract-first** — add the path + schemas to `api/feature/<name>/<name>.yml`. Protected paths simply **omit** `security: []` (that key marks a path public, as on login). Merge via `cd api/generate && npm run generate:api`, then `cd frontend && pnpm generate:api`. See [`docs/references/api_contract_conventions.md`](../references/api_contract_conventions.md).
2. **Controller** `implements <Tag>Api`, `@RequiredArgsConstructor`, inject `private final CurrentUserId currentUserId;`. Package layout per [`docs/references/java_package_structure.md`](../references/java_package_structure.md); DI/`@Transactional` rules per [`docs/references/spring_patterns.md`](../references/spring_patterns.md).
3. **Owner key** — pass `currentUserId.get()` into the service. **Never** accept `created_by` from a request DTO.
4. **Persistence** — entity extends `OwnedEntity`; repository extends `OwnedRepository<T>`; reads via `findAllOwned(currentUserId.get())`; writes set `entity.setCreatedBy(currentUserId.get())`. Migration named `{YYYYMMDDHHMM}_{bd-id}_{desc}.sql` per [`docs/references/liquibase_conventions.md`](../references/liquibase_conventions.md); add the new table to `support/ResetDatabase` TRUNCATE list + a populator per [`docs/references/integration_test_framework.md`](../references/integration_test_framework.md).
5. **Config** — any tunable goes under `mezo:` in `application.yml` via a `@Validated` `*Properties` record; **never `@Value`** — see [`docs/references/configuration_conventions.md`](../references/configuration_conventions.md).
6. **Errors** — throw `SystemRuntimeErrorException` with a `SystemMessage` code registered in `messages.properties`; never hardcode user text — see [`docs/references/error_handling.md`](../references/error_handling.md).

**Swapping a mock hook to real** (e.g. Fuel/Insights/People): edit the matching branch in `frontend/src/data/hooks.ts` so the real branch calls a new `*Api.ts` client over `apiFetch`. The token is already there — no auth wiring needed. Add an MSW handler in `frontend/src/test/msw/handlers.ts` for the new path so real-mode tests pass. **Both modes must stay green** (`pnpm test` and `VITE_USE_MOCK=true pnpm test`).

**Moving to multi-user / real login UI later:** the model is *forward-compatible* — `app_user` already allows N rows (UUID PK, UNIQUE email). The only single-user assumptions to undo: the seed (`@Order(0)`, idempotent single owner), the FE auto-bootstrap, and `allowCredentials=false`. You'd add (a) a registration/login screen, (b) per-request token persistence, (c) loosen CORS for cookie-based sessions if you switch off Bearer.

---

## 8. Testing

**Backend (integration-first, real Postgres):**
- `…/feature/auth/AuthControllerIT` (extends `ApiIntegrationTest`): valid login → non-blank token; wrong password → 401 `AUTH_LOGIN_INVALID_CREDENTIALS`; malformed email / empty password → 400 field errors (`VALIDATION_INVALID_EMAIL` + `VALIDATION_INVALID_VALUE`); **protected path w/o token → 401** ("security filter precedes routing — 401 even without a matching endpoint"); `ownerAuthHeaders()` → 200 on `/api/biometrics/weight`.
- `…/feature/auth/OwnerSeedDataIT` (extends `AbstractIntegrationTest`): exactly one owner under `demodata`; re-running `ownerSeedData.run()` stays single; `TrainSeedData` bean absent unless `demofixtures`.
- `…/techcore/security/CorsConfigIT`: preflight echoes ACAO for `:5180`; disallowed origin → 403 no ACAO; authenticated real request carries ACAO.
- **Test seam — `ApiIntegrationTest.ownerAuthHeaders()`**: logs in as the `demodata` owner via the real `/api/auth/login` and returns `Bearer` headers. Every HTTP-level IT authenticates through this (`@ActiveProfiles("demodata")` so the owner exists).
- `support/populator/UserPopulator`: find-or-create `AppUserEntity` by email (placeholder `password_hash = "x"`) — yields FK-valid `created_by` owners for ownership-isolation tests ("user B sees 0 of user A's rows", design spec ~line 146).
- `support/ResetDatabase`: between tests TRUNCATEs owned tables but **preserves master data** — `DELETE FROM app_user WHERE email <> :ownerEmail` (+ matching `user_profiles` delete) keep the seeded owner intact. `app_user`/`user_profiles` are master data — selective DELETE, *not* in the TRUNCATE list.
- Deps (`backend/pom.xml`): `spring-boot-starter-security`, `spring-boot-starter-oauth2-resource-server` (brings resource-server + Nimbus jose), `spring-boot-starter-security-test`.

**Frontend:** mock login handler at `frontend/src/test/msw/handlers.ts:8` — `POST /api/auth/login → { token: 'test-token' }` so real-mode hook tests run without a live backend.

**Commands:**
```bash
# Backend ITs (compose Postgres must be up)
cd backend && ./mvnw clean test
# Frontend — BOTH modes must pass
cd frontend && pnpm test                       # real mode (MSW)
cd frontend && VITE_USE_MOCK=true pnpm test    # mock mode
```

---

## 9. Decisions, gotchas & deferred

**Gotchas:**
- HS256 header must be set **explicitly** on encode (Nimbus + symmetric secret) — see §4.
- `OwnerProperties.jwtSecret` `@Size(min=32)` fails at **bind/boot**, not at sign time.
- Filter-level 401 → **empty body**, not the `SystemMessage[]` envelope (only `AuthService`/`CurrentUserId` 401s go through `GlobalExceptionHandler`). Tracked in `mezo-aus`.
- Token lives in a module-level `let` (`api.ts:19`) — **in-memory only**, no `localStorage`/cookie; lost on reload, re-bootstrapped each load. Intentional (single-user, build-time creds), but no offline token survival.
- `@Order(0)` on `OwnerSeedData` is load-bearing for `TrainSeedData` ordering.

**Deferred bd issues (all OPEN):**
- **`mezo-5h9` (P2) — fail-fast on default secrets.** Add a startup guard that refuses to boot under a non-dev profile when `dev-only-change-me…` / `owner` are still active; also revisit the 30-day JWT expiry + a revocation story at deploy time. **The single most important security follow-up.**
- **`mezo-aus` (P3) — degraded/offline banner** when bootstrap fails (today: silent `console.error` + empty screens); plus a custom `authenticationEntryPoint` so filter-level 401s emit the uniform `SystemMessage[]` envelope.
- **`mezo-8bq` (P4) — double bootstrap on cold load.** Two TanStack queries race the bootstrap → two parallel `POST /api/auth/login` (both 200). Harmless (idempotent) but doubles auth traffic. Fix: memoize the in-flight promise in `data/_client/api.ts`/`auth.ts`.

**Operational / secrets:** prod env (`MEZO_JWT_SECRET`, `MEZO_OWNER_EMAIL`, `MEZO_OWNER_PASSWORD`, `MEZO_OWNER_NAME`) comes from the `mezo-app` Kubernetes Secret, consumed in `k8s/backend/deployment.yaml` via `secretKeyRef`. It is committed as an **encrypted SealedSecret** (`k8s/backend/sealedsecret.yaml`, name `mezo-app`), decrypted in-cluster by the sealed-secrets controller; template `k8s/backend/secret.example.yaml`. See [`docs/infrastructure/deployment-k3s-argocd.md`](../infrastructure/deployment-k3s-argocd.md) (Secrets table, `mezo-app` = "JWT + owner"; Sealed Secrets DONE note) and [`docs/infrastructure/runbook.md`](../infrastructure/runbook.md) (logins table, rotate-a-secret recipe, **back up the sealing key** — lose it on rebuild and `mezo-app`/the JWT secret must be re-sealed, which invalidates all existing tokens).

---

## 10. Key files

**Backend — auth feature** (`backend/src/main/java/io/mrkuhne/mezo/feature/auth/`):
- `OwnerProperties.java` — `mezo.auth.*` config record (email/password/name/jwtSecret, validated).
- `OwnerSeedData.java` — `@Profile("demodata") @Order(0)` owner+profile seeder (idempotent).
- `controller/AuthController.java` — implements generated `AuthApi`, delegates to service.
- `service/AuthService.java` — credential check + JWT issuance (HS256, 30d, sub=userId).
- `entity/AppUserEntity.java` — `app_user` (UUID PK, unique email, BCrypt hash).
- `entity/UserProfileEntity.java` — `user_profiles` (PK = `created_by`, 1:1 owner).
- `repository/AppUserRepository.java` — `findByEmail`, `existsByEmail`.
- `repository/UserProfileRepository.java` — plain `JpaRepository`.

**Backend — security / ownership** (`backend/src/main/java/io/mrkuhne/mezo/techcore/`):
- `security/SecurityConfig.java` — filter chain, CORS, JwtEncoder/Decoder, PasswordEncoder, public allowlist.
- `security/CurrentUserId.java` — JWT-subject → owner `UUID` (the `created_by` source).
- `security/CorsProperties.java` — `mezo.cors.allowed-origins`.
- `persistence/OwnedEntity.java` / `persistence/OwnedRepository.java` — ownership base + owner-scoped finder.
- `exception/GlobalExceptionHandler.java` — maps `SystemRuntimeErrorException` (incl. 401s) + validation → `SystemMessage[]`.

**Contract & migration:**
- `api/feature/auth/auth.yml` — login endpoint + `LoginRequest`/`TokenResponse` schemas.
- `backend/src/main/resources/db/changelog/1.0.0/script/202606101200_mezo-v67_create_auth.sql` — `app_user` + `user_profiles` DDL.
- `backend/src/main/resources/messages.properties` — `AUTH_LOGIN_INVALID_CREDENTIALS`, `AUTH_TOKEN_MISSING`, validation codes.
- `backend/src/main/resources/application.yml` — `mezo.auth.*` + `mezo.cors.*` defaults/env overrides; `/actuator` health exposure.

**Frontend:**
- `frontend/src/data/_client/api.ts` — fetch client, `setToken`, Bearer injection, `ApiError`.
- `frontend/src/data/_client/auth.ts` — `bootstrapOwnerToken()`.
- `frontend/src/data/_client/mode.ts` — `isMockMode()`.
- `frontend/src/app/providers/QueryProvider.tsx` — boot gate + bootstrap trigger.
- `frontend/.env.example` — owner creds + API URL + mock flag.
- `frontend/src/test/msw/handlers.ts` — mock login handler.

**Tests:**
- `backend/…/feature/auth/AuthControllerIT.java`, `OwnerSeedDataIT.java`.
- `backend/…/techcore/security/CorsConfigIT.java`.
- `backend/…/support/ApiIntegrationTest.java` (`ownerAuthHeaders()`), `support/ResetDatabase.java` (owner preservation), `support/populator/UserPopulator.java`.

**Infra / secrets:** `k8s/backend/deployment.yaml`, `k8s/backend/sealedsecret.yaml`, `k8s/backend/secret.example.yaml`, `k8s/README.md`, `docs/infrastructure/deployment-k3s-argocd.md`, `docs/infrastructure/runbook.md`.

**Design source:** `docs/superpowers/specs/2026-06-10-phase2-backend-design.md` (auth/ownership; Slice A; ownership-isolation testing; open questions).


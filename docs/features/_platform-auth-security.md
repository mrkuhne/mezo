---
title: Auth & Security
type: feature-platform
status: done
updated: 2026-09-04
tags: [platform, auth, backend, frontend]
key_files:
  - backend/src/main/java/io/mrkuhne/mezo/feature/auth
  - backend/src/main/java/io/mrkuhne/mezo/feature/auth/service
  - backend/src/main/java/io/mrkuhne/mezo/techcore/security
  - backend/src/main/java/io/mrkuhne/mezo/techcore/exception
  - api/feature/auth/auth.yml
  - backend/src/main/resources/application.yml
  - frontend/src/app/auth
  - frontend/src/features/auth
  - frontend/src/shared/lib/userScope.ts
  - frontend/src/data/_client/api.ts
related: [_platform-data-layer, _platform-api-backend, _platform-notifications, me, beta-admin]
---

# Auth & Security — Feature Documentation

> One-line: the multi-user account model (S1, `mezo-qw37`) — invite-gated registration → 30-day HS256 JWT → resource-server filter → per-request `CurrentUser` status check → server-side `created_by`. **Status: ✅ backend done (S1); ✅ FE persisted token + `AuthGate` boot state machine.** This is a *platform* feature — no route/tab of its own; it sits under every authenticated screen, gating what renders before any view mounts.

---

## 1. Summary

mezo is a **multi-user** PWA. `app_user` carries a `role` (`OWNER` | `USER`) and a `status` (`ACTIVE` | `DISABLED`): the `OWNER` is the seeded founder account; every other account is `USER`, created through invite-gated self-registration (`POST /api/auth/register`, gated on a one-shot `invite` code minted by the owner). A `DISABLED` account is rejected with 403 `AUTH_ACCOUNT_DISABLED` on **every** request — login included — even though its JWT stays cryptographically valid for the full 30 days; the per-request status check in `CurrentUser` is the actual revocation mechanism. The frontend persists the bearer token in `localStorage` (`mezo.auth.token`, via `tokenStore`) rather than a module variable, and `AuthGate` — mounted inside `QueryProvider`, above the router — decides at boot whether to show the login/register screens, a forced change-password screen, or the app. Ownership of domain rows is still enforced **server-side and unchanged**: `created_by` is resolved from the JWT subject (never sent by the client) and reads are filtered `created_by = currentUser` (app-level, not DB row-level security) — S1 only changed *how many* accounts can hold that subject and *what gates* holding one.

- **Backend:** ✅ real — invite-gated register, login (incl. disabled-account 403), `me`, change-password, onboarding-complete, per-request `CurrentUser` status check, `mezo.auth.strict` startup guard.
- **FE:** ✅ real — persisted token (`localStorage`), `AuthGate` boot phases, `LoginPage`/`RegisterPage`/`ChangePasswordPage` on a chrome-free `AuthShell`, whole-cache clear on every sign-in and sign-out.
- **Mock mode:** 🔶 `AuthGate` short-circuits straight to `ready`; `useMe()` serves a static mock identity, no network.

Driving design: [`docs/superpowers/specs/2026-09-02-multi-user-accounts-design.md`](../superpowers/specs/2026-09-02-multi-user-accounts-design.md) §5 (schema, contract table, transaction/lock detail, FE boot state machine). Original Phase-2 single-owner design (superseded by this slice): [`docs/superpowers/specs/2026-06-10-phase2-backend-design.md`](../superpowers/specs/2026-06-10-phase2-backend-design.md). Deploy/secret backdrop: [`docs/decisions/0001-deploy-on-k3s-argocd-learning-track.md`](../decisions/0001-deploy-on-k3s-argocd-learning-track.md).

---

## 2. User-facing behavior

There **is** a login screen now — S1 replaces the invisible owner auto-login with a real boot state machine.

`AuthGate` (`frontend/src/app/auth/AuthGate.tsx`) drives a small state machine over `AuthPhase = 'pending' | 'signedOut' | 'mustChangePassword' | 'onboarding' | 'ready' | 'failed'` (`frontend/src/app/auth/authState.ts`):

- **`pending`** — real mode only, briefly at boot: renders nothing while the persisted token (if any) is checked against `GET /api/auth/me`. Mock mode skips straight to `ready`.
- **`signedOut`** — no token, or the last request came back 401 / 403 `AUTH_ACCOUNT_DISABLED`: renders `LoginPage` or `RegisterPage` (toggle in-component, no router). A sign-out carries a reason (`expired` | `disabled` | `manual`) that surfaces as a Hungarian notice on the login form for the two automatic paths.
- **`mustChangePassword`** — `me().mustChangePassword` is true (e.g. an owner-provisioned account with a temporary password): renders `ChangePasswordPage` in forced mode; nothing else is reachable until it succeeds.
- **`onboarding`** (S2, `mezo-qw37.2`) — `me.onboarded=false` and no forced password change: `AuthGate` renders `features/auth/pages/OnboardingPage.tsx` instead of the app: 1) name confirm (read-only — typed at registration) + születési dátum + nem, 2) magasság + jelenlegi súly (`StepField`, clamped to the contract bounds), 3) összefoglaló → `useOnboardingActions().complete` = `PUT /api/biometrics/profile` → `POST /api/biometrics/weight` (today) → `POST /api/auth/onboarding-complete`, then `me` is re-read and the phase becomes `ready`. No new contract or table; `activityLevel: 'MIXED'` is sent explicitly (the column is nullable and the server does **not** default it — a null is only *interpreted* as MIXED by `GoalEngineProperties.Neat.forLevel`). The owner row is backfilled `onboarded_at` by S1, so the founder never sees the wizard. Beállítások → **Fiók** shows name/e-mail, opens `ChangePasswordSheet` (which shares `ChangePasswordForm` with the forced page), and offers **Kijelentkezés** (real mode only — mock mode has no session).
- **`ready`** — renders the app (`{children}`), fully authenticated.
- **`failed`** — the boot `me()` call errored for a reason that is *not* a dead session (backend unreachable) after three retries (500ms/1.5s/4s backoff): renders a "Nem érem el a szervert" full-screen message with a retry button. No banner-and-degrade-tokenless fallback anymore — the app never renders half-authenticated.

**Sign-out is a first-class event**, not just "the token disappears": `login`/`register`/`logout` (`useAuthActions`) and the two automatic dead-session paths (`apiFetch`/`apiSse` 401/403-disabled detection) all clear the **entire TanStack Query cache**, not only the token — the account-isolation invariant for a shared device (S1's whole reason to exist): switching accounts must never let the next signed-in user see a query still holding the previous account's cached meals/weight/check-ins.

**No owner credentials in the build.** `bootstrapOwnerToken` and every `VITE_OWNER_EMAIL`/`VITE_OWNER_PASSWORD` build-time variable are gone; nothing in the frontend bundle can log anyone in silently.

---

## 3. Architecture & data flow

Three paths: token **issuance** (login or register), the **register**-specific invite consumption, and token **use** (every protected request).

**Login (token issuance):**
```
AuthGate.useEffect (real mode; token present) → authApi.me()   frontend/src/app/auth/AuthGate.tsx
  — OR, from signedOut phase —
LoginPage submit → useAuthActions().login()                    frontend/src/data/auth/authHooks.ts
  → client.clear()                                              (account-isolation boundary — BEFORE the request)
  → authApi.login(body)                                         frontend/src/data/auth/authApi.ts
  → apiFetch POST /api/auth/login                                frontend/src/data/_client/api.ts  (no Bearer yet)
  → AuthController.login()                                       backend …/feature/auth/controller/AuthController.java
  → AuthService.login()                                          backend …/feature/auth/service/AuthService.java
       findByEmail + passwordEncoder.matches  → else 401 AUTH_LOGIN_INVALID_CREDENTIALS
       status == DISABLED                     → 403 AUTH_ACCOUNT_DISABLED
       issueToken(): JwtEncoder.encode(HS256 header + claims{sub=userId, email, iat, exp=+30d})
  → TokenResponse{ token }
  → setToken(token) → tokenStore.set()                           frontend/src/data/_client/tokenStore.ts (localStorage)
  → seedMe(): authApi.me() → client.setQueryData(ME_QUERY_KEY, me)
  → AuthGate derives the next phase from the seeded `me` (deriveFromMe)
```

**Register (invite-gated, one transaction):**
```
RegisterPage submit → useAuthActions().register()
  → apiFetch POST /api/auth/register  { inviteCode, email, password, name }
  → AuthController.register() → AuthService.register()           @Transactional
       existsByEmail(email)  → else 409 AUTH_EMAIL_TAKEN (pre-check)
       assertBcryptSafe(password)  → 400 VALIDATION_INVALID_VALUE if >72 UTF-8 bytes
       appUserRepository.saveAndFlush(user)  → 409 AUTH_EMAIL_TAKEN on the DataIntegrityViolationException race
       InviteService.consume(inviteCode, user.id)
            findByCodeForUpdate(code)  ← row-level lock spans the user insert above
            !used && !expired  → else 409 AUTH_INVITE_INVALID
            mark used_by/used_at
       issueToken(user)
  → same TokenResponse / setToken / seedMe path as login
```
The `FOR UPDATE` lock on the invite row is what makes a race between two concurrent registrations with the *same* code deterministic: the second request blocks until the first commits, then sees `used_at` already set and 409s — the code cannot be consumed twice.

**Any protected request (token validation + status check + ownership):**
```
view → useX hook (frontend/src/data/hooks.ts) → *Api.ts client → apiFetch (adds Bearer)   api.ts
  → Spring Security filter chain                 …/techcore/security/SecurityConfig.java
       oauth2ResourceServer().jwt()  → NimbusJwtDecoder validates HS256 signature + exp
       authorizeHttpRequests: /api/auth/login, /api/auth/register permitAll(); everything else authenticated()
  → FooController  (private final CurrentUserId currentUserId)
       service.method(currentUserId.get(), …)
            → CurrentUserId.get() → CurrentUser.get()                …/feature/auth/service/CurrentUser.java
                 loads AppUserEntity by jwt subject, cached per-request (RequestAttributes)
                 status == DISABLED → 403 AUTH_ACCOUNT_DISABLED  (the actual revocation point — the JWT itself is still valid)
                 last_seen_at older than 5 min (or null) → bulk UPDATE touchLastSeen, else no write
            → .id()  ← the UUID every existing controller/service call already used
  → FooService → OwnedRepository.findAllOwned(createdBy) / sets entity.createdBy on write
  → Postgres  (created_by = currentUser, is_deleted = false)
```

**The load-bearing seam, updated for S1:** controllers still never read the principal from a method argument, and still inject `CurrentUserId` exactly as before — this is why ~40 existing controllers (`WeightLogController`, `SleepLogController`, `CheckInController`, `TrainController`, …) needed **zero code changes** to inherit the new DISABLED check. `CurrentUserId` is now a thin one-method delegate onto `CurrentUser` (`techcore/security/CurrentUserId.java`); `CurrentUser` is the real component, holding the entity load, the status check, and the `last_seen_at` stamp. New code that needs the full entity (not just the UUID) or `requireOwner()` injects `CurrentUser` directly.

**`CurrentUser`'s usage contract (Javadoc, load-bearing):** call `.get()`/`.id()` from the controller layer only — as the first thing a handler does, never from inside an already-open `@Transactional` method (especially `readOnly = true`). `CurrentUser.load()` issues a bulk `UPDATE` to stamp `last_seen_at`; nesting that write inside a transaction Spring opened read-only can fail at the JDBC/database level. Nothing in the type system enforces this — it is caller discipline, documented at the class.

**Dual-mode note (unchanged):** the data layer (`frontend/src/data/hooks.ts`) switches each hook between mock and real via `isMockMode()` (`@/data/_client/mode`). `AuthGate` itself also short-circuits on mock mode — the auth boot state machine never runs, `useMe()` serves a static identity, and nothing hits `apiFetch`.

---

## 4. Data model & API

**Tables** — base DDL: `backend/src/main/resources/db/changelog/1.0.0/script/202606101200_mezo-v67_create_auth.sql`; S1 migration: `backend/src/main/resources/db/changelog/1.0.0/script/202609021200_mezo-qw37.1_multi_user_accounts.sql`.

`app_user` — the identity row.
| Column | Type | Notes |
|---|---|---|
| `id` | `uuid PK` | `default gen_random_uuid()` |
| `email` | `varchar(255) NOT NULL` | `CONSTRAINT uq_app_user_email UNIQUE` |
| `password_hash` | `varchar(100) NOT NULL` | BCrypt |
| `name` | `varchar(120) NOT NULL` | display name |
| `role` | `varchar(16) NOT NULL default 'USER'` | `ck_app_user_role IN ('OWNER','USER')` |
| `status` | `varchar(16) NOT NULL default 'ACTIVE'` | `ck_app_user_status IN ('ACTIVE','DISABLED')` — checked on every request by `CurrentUser` |
| `timezone` | `varchar(64) NOT NULL default 'Europe/Budapest'` | T1 decision: stored for the future, not yet consulted by any "today" logic |
| `onboarded_at` | `timestamptz` | null = onboarding not done; the S1 backfill sets it to `created_at` for every pre-existing (owner) row |
| `must_change_password` | `boolean NOT NULL default false` | drives `AuthGate`'s `mustChangePassword` phase |
| `last_seen_at` | `timestamptz` | stamped by `CurrentUser`, at most once per 5 minutes per account |
| `tokens_valid_from` | `timestamptz` | null until the first password change; stamped by `AuthService.changePassword` to the **`iat` of the token that performed the change** (`CurrentUser.tokenIssuedAt()`), never to `Instant.now()` — a wall-clock stamp sits seconds-to-minutes after the token's actual mint (form-fill + two BCrypt rounds) and would sign the user themselves out on their very next request. `CurrentUser.load()` rejects a JWT whose `iat` is strictly before it, no grace window needed (both sides are JWT `iat` values, same clock/granularity) — the password-change revocation mechanism (mezo-qw37.1 review, Finding 4) |
| `created_at` | `timestamptz` | `@CreationTimestamp` |

Entity: `…/feature/auth/entity/AppUserEntity.java` (`UserRole`/`UserStatus` enums, `isOwner()`/`isOnboarded()` helpers). Repository: `AppUserRepository` (`findByEmail`, `existsByEmail`).

`invite` — one-shot registration gate, new in S1.
| Column | Type | Notes |
|---|---|---|
| `id` | `uuid PK` | `default gen_random_uuid()` |
| `code` | `varchar(32) NOT NULL` | `uq_invite_code UNIQUE`, format `MEZO-XXXX-XXXX` (readable alphabet — no 0/O/1/I) |
| `label` | `varchar(120)` | optional, set by the minting owner |
| `created_by` | `uuid NOT NULL` | FK → `app_user.id` `ON DELETE CASCADE` |
| `created_at` | `timestamptz NOT NULL default now()` | |
| `expires_at` | `timestamptz` | nullable = never expires |
| `used_by` | `uuid` | FK → `app_user.id` `ON DELETE SET NULL` |
| `used_at` | `timestamptz` | null = unused |

Entity: `…/feature/auth/entity/InviteEntity.java` (`isUsed()`/`isExpired(now)`). Repository: `InviteRepository` (`existsByCode`, `findByCodeForUpdate` — pessimistic row lock, see §3). Service: `InviteService` (`create`, `consume`) — minting an invite is an owner-only S1 building block; the admin API to actually issue one from the UI is **S3**, not yet built.

**`user_profiles` is gone.** The S1 migration `DROP TABLE user_profiles` — it was written only by `OwnerSeedData` and read by nobody (the display name already lives on `app_user.name`); carrying it forward as a 1:1-with-owner table made no sense once accounts could be plural. Anything that used to live there (handle, birth date, member-since, streak) either never had a real reader or is tracked elsewhere (gamification streak).

**Ownership base** (every *owned* domain table — NOT `app_user`, unchanged by S1):
- `OwnedEntity` (`…/techcore/persistence/OwnedEntity.java`, `@MappedSuperclass`): `created_by uuid NOT NULL updatable=false`, `is_deleted boolean default false`, `created_at`. Extended by `WeightLogEntity`, Train entities, etc.
- `OwnedRepository<T>` (`…/techcore/persistence/OwnedRepository.java`, `@NoRepositoryBean`): `findAllOwned(UUID createdBy)` = JPQL `where e.createdBy = :createdBy and e.deleted = false order by e.date asc`. Belt-and-braces with each entity's `@SQLRestriction` — the in-repo comment says keep both.
- `OwnershipGuard` (`…/techcore/persistence/OwnershipGuard.java`, static utility): `ownedOrThrow(Optional<T extends OwnedEntity>, UUID createdBy)` + the canonical `notFound()` (`RESOURCE_NOT_FOUND`, HTTP 404) — the **foreign-row == 404 invariant in one tested place**. By-id reads gate through it (Train/Running/Workout services, the train-side signal calculators) instead of hand-rolling the filter + throw, so a row owned by someone else is indistinguishable from a missing one.

**Endpoints** (auth feature) — contract source: [`api/feature/auth/auth.yml`](../../api/feature/auth/auth.yml) (tag `Auth`, "Multi-user auth — invite-code registration, login, current-user profile").
| Verb | Path | Auth | Body → Response | Errors |
|---|---|---|---|---|
| POST | `/api/auth/login` | `security: []` (public) | `LoginRequest{email, password}` → `TokenResponse{token}` | 400 field (`VALIDATION_INVALID_EMAIL`, `VALIDATION_INVALID_VALUE`), 401 `AUTH_LOGIN_INVALID_CREDENTIALS`, 403 `AUTH_ACCOUNT_DISABLED` |
| POST | `/api/auth/register` | `security: []` (public) | `RegisterRequest{inviteCode, email, password, name}` → `TokenResponse{token}` | 400 field, 409 `AUTH_INVITE_INVALID` \| `AUTH_EMAIL_TAKEN` |
| GET | `/api/auth/me` | Bearer | — → `MeResponse{id, email, name, role, onboarded, mustChangePassword, timezone}` | 401 `AUTH_TOKEN_MISSING`, 403 `AUTH_ACCOUNT_DISABLED` |
| POST | `/api/auth/change-password` | Bearer | `ChangePasswordRequest{currentPassword, newPassword}` → 204 | 400 field, 401 `AUTH_LOGIN_INVALID_CREDENTIALS` (wrong current password — **exempted from the session-death 401 handler**, see §5) |
| POST | `/api/auth/onboarding-complete` | Bearer | — → 204 | 401 `AUTH_TOKEN_MISSING` |

`RegisterRequest.password`/`ChangePasswordRequest.newPassword` are `minLength: 8, maxLength: 72` (chars) — enforced again server-side in bytes (`AuthService.assertBcryptSafe`, since BCrypt throws past 72 *bytes* and multi-byte Hungarian UTF-8 can blow the char-length check without blowing the byte one). DTOs are **generated** into `io.mrkuhne.mezo.api.dto` (BE) and `components['schemas']` in `frontend/src/data/_client/api.gen.ts` (FE) — never hand-written.

**Public allowlist** (`SecurityConfig.java`): `/api/auth/login`, `/api/auth/register`, `/actuator/health`. **Everything else** `authenticated()`.

**Admin endpoints** (S3, `mezo-qw37.3`) — contract source: [`api/feature/admin/admin.yml`](../../api/feature/admin/admin.yml). Every method on `AdminController` opens with `currentUser.requireOwner()` (403 `AUTH_FORBIDDEN` for a non-owner caller) before `AdminService` runs the domain rule.
| Verb | Path | Body → Response | Domain rule / errors |
|---|---|---|---|
| POST | `/api/admin/invites` | `CreateInviteRequest{label?, expiresInDays?}` → `InviteResponse` | mints via `InviteService.create` |
| GET | `/api/admin/invites` | — → `InviteResponse[]` | newest first, `usedByName` joined in |
| DELETE | `/api/admin/invites/{id}` | — → 204 | 404 `ADMIN_INVITE_NOT_FOUND`; 409 `ADMIN_INVITE_USED` — used codes are immutable history |
| GET | `/api/admin/users` | — → `AdminUserResponse[]` | oldest-first; carries `role/status/onboardedAt/lastSeenAt` |
| POST | `/api/admin/users/{id}/reset-password` | — → `ResetPasswordResponse{temporaryPassword}` | generates a 12-char temp password (readable alphabet), sets `mustChangePassword=true`, and stamps `tokensValidFrom = now()` (truncated to seconds — JWT `iat` has second granularity) so the target's *existing* sessions die immediately, the same revocation lever `AuthService.changePassword` uses (mezo-qw37.3 review, Finding 1) — the clear-text password exists only in this one response |
| PUT | `/api/admin/users/{id}/status` | `SetUserStatusRequest{status}` → 204 | 409 `ADMIN_SELF_STATUS` — the owner cannot disable their own account; otherwise sets `ACTIVE`/`DISABLED` (the `CurrentUser` per-request check on §3 does the rest) |

### PromptPersona, PersonaContext & UserFanOut (S6, `mezo-qw37.6`)

Two small services in `feature/auth/service` close out the multi-user epic on the LLM side — every prompt still says "Daniel" nowhere, and every `@Scheduled` job still walks `appUserRepository.findAll()` nowhere.

- **`PromptPersona`** (`@Service`) is the one place a prompt template gets the user's name. `PromptPersona.NAME_TOKEN = "{{NÉV}}"` is the literal every `static final String` prompt template carries; a call site invokes `promptPersona.render(userId, template)` once, right before the LLM call — `render` loads the account via `PromptPersona.forUser(userId)` → `PersonaContext` and does one `String.replace`. `PromptPersona.USER_TURN_LABEL = "Felhasználó: "` is the neutral transcript role label (chat history, embeddings, fact extraction) — the same precedent as `KonziliumProposalRound.USER_FEEDBACK_PREFIX = "FELHASZNÁLÓ VÁLASZA — "`, the konzílium wire marker. No case inflection: a name-bearing suffix (`Danielnek`, `Danielről`) is rewritten onto a following noun/pronoun (`{{NÉV}} számára`, `{{NÉV}} személyéről`) instead, because Hungarian and Western name order cannot be told apart from a plain display string.
- **The 26 prompt-site files rewritten to carry `{{NÉV}}` (S6, full inventory in the S6 plan's Table A, `grep -rn "Daniel" backend/src/main/java` at plan time):** `companion/service/{ChatService,FactExtractionService,KnowledgeFactService,DailySummaryService,HypothesisPipelineService,PeriodSummaryService,MesoReviewGenerator,PersonExtractionService}.java`, `companion/quarterly/service/QuarterlyReviewService.java`, `companion/profile/service/ProfileAssembler.java`, `companion/graph/service/LifeEventExtractionService.java`, `companion/llm/HabitSuggestLlmAdapter.java`, `companion/ChatHistory.java`, `companion/embedding/MemoryEmbeddingWriter.java`, `character/service/{CharacterPromptAssembler,PortraitWriter,KonziliumVerdictRound,KonziliumProposalRound,CharacterObservationService,CharacterExpertCatalog}.java`, `proactive/service/{CompanionMessageGenerator,WeeklyReviewGenerator,MemoirGenerator,PredictionGenerator,ExperimentProposalGenerator,ChallengeGenerator,WeeklySuggestionGenerator,DiagnosisRecipe}.java`, `recipe/service/RecipeWorkshopService.java`. Two sites were **not** in that inventory and needed the same treatment once found during implementation: `companion/llm/LifeGoalProposeLlmAdapter.java` (the lifegoal slice landed on `main` after the plan was written) and `CharacterExpertCatalog.SKEPTIC`/`KonziliumVerdictRound.skepticPersona()` (rewritten further than the plan's enumerated row, since round-4's self-audit dimension changed what the Szkeptikus persona says beyond a name substitution — see [`character.md`](character.md) §9/§10). `TurnVerdictCheck`/`AdvisorRetry`/`CompanionHelloRunner` keep a plain `"a felhasználó"` label with no `render` call — no `userId` reaches those call sites.
- **`PersonaContext`** (`record PersonaContext(String userName)`) is who a prompt speaks about — the account's `app_user.name` as typed at registration, or `PersonaContext.FALLBACK = "a felhasználó"` when the row cannot be loaded (`userId == null`, or deleted between token issuance and the call).
- **`UserFanOut`** (`@Service`) replaces `appUserRepository.findAll()` in every cron: `activeUsers()` returns `AppUserRepository.findByStatusAndOnboardedAtIsNotNull(ACTIVE)`, and `forEachActiveUser(jobName, body)` runs each user's `body` inside `LlmActorContext.runAs(user.getId(), …)` (so `llm_log_history.created_by` names the user the job ran for, not the `Háttér` bucket — see [`beta-admin.md`](beta-admin.md) §5) and catches **`Throwable`**, not `Exception` — a `Consumer<T>.accept()` cannot declare a checked exception, but a sneaky-throw can still make one escape the body, and it must not abort the fan-out either. It logs a warning naming the job and the user id and moves to the next user; jobs keep their own finer-grained try/catch inside the body on top of this outer one.
- **`LlmActorContext`** (`techcore/security`, added S3 `mezo-qw37.3`) is a plain `ThreadLocal<UUID>` for the acting account on a thread with no request principal (a cron's scheduler thread has an empty `SecurityContextHolder`). `runAs` sets it, runs the body, and restores the previous value in a `finally` — even when the body throws — so nesting is safe and nothing leaks across threads. The LLM-call audit recorder reads `LlmActorContext.current()` when the JWT principal is absent.
- **The cron presence guard is a deviation from the original plan, ruled on by the human partner mid-slice.** The design called for a `DailyQuestRepository` finder checking "any quest row created in the last N days" as the morning cron's backstop. That check LATCHES ON ITS OWN OUTPUT: the cron creates today's quest rows for a user, which the very same finder then reads back tomorrow as "recent activity", so a dormant account that never opens the app again keeps re-proving its own presence forever and the daily `QuestFlavor` LLM call never stops. The finder was deleted; `QuestJob.runGenerate` now reads `app_user.last_seen_at` directly — a signal `CurrentUser` stamps only on an authenticated request (§3) and the cron itself never writes — and skips a user unless `lastSeenAt` is non-null and newer than `Instant.now().minus(mezo.quest.cronPresenceDays, DAYS)` (`QuestProperties.cronPresenceDays`, default 7, name unchanged from the plan). See [ADR 0035](../decisions/0035-multi-user-account-model.md) for the full rejection rationale.

**Ownership exception — shared catalogs.** `exercise_catalog` and, since S4 (`mezo-qw37.4`, ADR 0035 decision K1), `pantry_catalog` are the deliberate departures from "every domain table `created_by NOT NULL`": each is a hybrid table (`ExerciseCatalogEntity` since `mezo-52zg`; `PantryCatalogEntity` since S4) where `createdBy == null` marks master content upserted by a startup loader from a JSON seed, and `createdBy` set marks a user-authored row. Every row — master or user-authored — is readable by everyone; a user-authored row is editable only by its author or an OWNER. Reads never filter `created_by = currentUser` on these tables; the composite index leads with the natural key (slug for exercises, `lower(trim(name)), lower(trim(coalesce(brand,'')))` for pantry), not `created_by`, per [`liquibase_conventions.md`](../references/liquibase_conventions.md). Per-user pantry state stays in `pantry_item` (`catalog_id NOT NULL`, fully owned) pointing at the catalog — see [`pantry.md`](pantry.md) §4.

### The JWT, in detail

**Issuance** (`AuthService.issueToken`):
- `JwtClaimsSet`: `subject = user.getId().toString()` (the account UUID — the ownership anchor), `issuedAt = now`, `expiresAt = now + 30 days`, custom claim `email`.
- **Algorithm gotcha (load-bearing):** `NimbusJwtEncoder` over a symmetric `ImmutableSecret` cannot infer the JWS alg, so `JwsHeader.with(MacAlgorithm.HS256)` is set **explicitly**; the code comment warns it otherwise throws *"Failed to select a JWK signing key"*.
- **The JWT itself carries no role/status claim** — those are re-read from the DB on every request by `CurrentUser`, which is exactly what makes disabling an account or promoting/demoting a role take effect immediately without waiting out the 30-day expiry.

**Validation** (`SecurityConfig.java`):
- `jwtEncoder()` = `new NimbusJwtEncoder(new ImmutableSecret<>(secret))`.
- `jwtDecoder()` = `NimbusJwtDecoder.withSecretKey(new SecretKeySpec(secret, "HmacSHA256")).macAlgorithm(HS256)`.
- `secret = props.jwtSecret().getBytes(UTF_8)`, captured in the constructor.
- Wired via `.oauth2ResourceServer(o -> o.jwt(jwt -> {}))`. Session `STATELESS`; CSRF disabled (Bearer, not cookies).

**Crypto:** `PasswordEncoder` = `BCryptPasswordEncoder` (`SecurityConfig.java`). Hashed on seed (`OwnerSeedData`) and on register, verified on login/change-password (`AuthService`).

### Owner seeding, invites & config

`OwnerSeedData` (`…/feature/auth/OwnerSeedData.java`): `@Component @Profile("demodata") @Order(0)` `CommandLineRunner`. `@Order(0)` because later runners (e.g. `TrainSeedData`) depend on the owner existing. Idempotent (`if (existsByEmail(...)) return;`). Creates the `OWNER`-role `AppUserEntity` (BCrypt-hashed, `status = ACTIVE`, `onboarded_at = now`). **No owner exists without `demodata`** → login is impossible on a bare run (`./mvnw spring-boot:run -Dspring-boot.run.profiles=demodata` is the minimum to log in).

`OwnerProperties` (`…/feature/auth/OwnerProperties.java`) — `@Validated @ConfigurationProperties("mezo.auth")` record: `ownerEmail @NotBlank @Email`, `ownerPassword @NotBlank`, `ownerName @NotBlank`, `jwtSecret @NotBlank @Size(min = 32)` (HS256 needs ≥256 bits — a shorter secret fails **at bind/boot**, not at sign time). Bound in `application.yml` with env overrides + dev defaults: `MEZO_JWT_SECRET:dev-only-change-me-32-bytes-minimum-secret`, `MEZO_OWNER_EMAIL:owner@mezo.local`, `MEZO_OWNER_PASSWORD:owner`, `MEZO_OWNER_NAME:Owner`.

`AuthProperties` (`…/feature/auth/AuthProperties.java`) — `@ConfigurationProperties("mezo.auth")`, `strict: boolean` (default `false`; `true` in the k8s Deployment env). Consumed only by `AuthStartupGuard`.

`AuthStartupGuard` (`…/feature/auth/AuthStartupGuard.java`, `@Order(-1)` — runs before every seed runner including `OwnerSeedData`): **mezo-5h9, CLOSED.** With `mezo.auth.strict=true` the app refuses to start while `mezo.auth.owner-password` is still the dev default `"owner"` or `mezo.auth.jwt-secret` is still `"dev-only-change-me-32-bytes-minimum-secret"` — throws `INTERNAL_ERROR` with the offending key names in the message. A deployment that forgets to override the owner password or JWT secret now fails loudly at boot instead of silently running production on dev credentials.

(`application.yml` also carries unrelated `mezo:` sub-trees — `mezo.cors.*` here, since G5 `mezo.goal.*` for the goal engine, since Fuel P2 `mezo.fuel.protocol.*` (`FuelProtocolProperties`, protocol confidence default), the Phase-3 `mezo.companion.*` tree (`CompanionProperties` — llm/chat/snapshot/tools/facts/extraction/advisors/embedding/summary), since V2.2 the `mezo.techcore.cron.*` job-switch zone, and since Fuel P6 `mezo.pantry-import.*`/`mezo.pantry-suggestion.*` (the OpenFoodFacts client — its User-Agent reuses the `MEZO_OWNER_EMAIL` env var as the OFF-etiquette contact — plus the swap-heuristic knobs) with the `mezo.feature.pantry-import.enabled` switch, and since Fuel P8 (`mezo-8vum`) `mezo.pantry-scrape.*` (`PantryScrapeProperties` — the outbound page-fetch + LLM-extraction limits, incl. `allow-private-hosts: false`) with the `mezo.feature.pantry-scrape.enabled` switch (which additionally needs the companion switch on for the `CompanionLlm` bean, else the scrape endpoint 503s), and since the (now COMPLETE) proactive epic the `mezo.proactive.*` tree (`ProactiveProperties` — `briefing.*` + `weekly.cron` + `memoir.cron` + `heartbeat.*` + `prediction.*` + `experiment.{propose-cron,outcome-cron,max-open,min-days,max-days}`) with the `mezo.feature.proactive.enabled` switch plus the SIX `mezo.techcore.cron.{briefing,weekly-suggestion,memoir,heartbeat,prediction,experiment}-job.enabled` job switches, since Train `mezo-dhdr` the `mezo.hypertrophy.*` tree (`HypertrophyProperties`) with the `mezo.feature.hypertrophy-drive.enabled` switch, and since gamified growth (`mezo-df7q`/`mezo-jzca`/`mezo-6ng8`) the `mezo.quest.*` (`QuestProperties`, incl. the E3 `adaptive` band record) + `mezo.activity.*` (`ActivityProperties`) trees with the `mezo.feature.quest.enabled` + `mezo.feature.activity.enabled` switches plus the E3 `mezo.quest.flavor.enabled` sub-switch and the `mezo.techcore.cron.quest-job.enabled` job switch, and since the Fuel slot-timing slice (`mezo-53su`) the `mezo.fuel-settings.*` tree (`FuelSettingsProperties` — the ghost meal cadence + caffeine cutoff) with the `mezo.feature.fuel-settings.enabled` switch (this slice also **removed** the `mezo.habit.caffeine-cutoff` key from the `mezo.habit.*` subtree), and since the daily closing ritual (`mezo-hvmx`) the `mezo.ritual.*` tree (`RitualProperties` — `lead-min`/`prep-lead-min`) with the `mezo.feature.ritual.enabled` switch, and since the gamification ledger backend (`mezo-huzd`) the `mezo.gamification.*` tree (`GamificationProperties` — `saver-price`/`max-savers`/`level-up-coins`/`quest-coins`/`all3-coins`/`milestone-coins`) with the `mezo.feature.gamification.enabled` switch (off ⇒ `/api/gamification/*` 404s AND the `AccountProgressPort` adapter bean is absent, so progression awards fire no coin/streak hook — see [`growth.md`](growth.md)), and since the push-notification delivery spine (`mezo-h4wp.6.1`) the `mezo.webpush.*` tree (`WebPushProperties` — `subject`/`public-key`/`private-key`/`default-ttl-seconds`/`timeout-ms`) + `mezo.notification.*` (`NotificationProperties` — `body-max-chars`) with the `mezo.feature.notification.enabled` switch (+ the reserved-but-currently-inert `mezo.techcore.cron.notification-dispatch-job.enabled` job switch — N1 registers no `@Scheduled` bean; see [`_platform-notifications.md`](_platform-notifications.md)) — all bound by their own `*Properties` records or consumed via `@ConditionalOnProperty`; auth binds `mezo.auth.*`/`mezo.cors.*`.)

### CORS

`CorsProperties` (`…/techcore/security/CorsProperties.java`) — `@ConfigurationProperties("mezo.cors")`, `allowedOrigins @NotEmpty List<String>`; default `http://localhost:5180` (Vite dev). `SecurityConfig.corsConfigurationSource()`: methods `GET/POST/PUT/DELETE/OPTIONS`, headers `Authorization, Content-Type`, **`allowCredentials = false`** (Bearer header, not cookies). Server-to-server callers send no `Origin` and bypass CORS entirely.

---

## 5. Integrations

Auth is the **substrate every other backend feature stands on**. The contract crossing each seam:

- **Every owned-domain feature ↔ ownership (`CurrentUserId` → `CurrentUser` → `OwnedEntity.createdBy`).** *Contract:* the controller injects `CurrentUserId` and passes `currentUserId.get()` (a `UUID`) into the service as the owner key exactly as before S1 — `CurrentUserId.get()` now delegates to `CurrentUser.id()`, which loads the account, rejects `DISABLED` with 403, and stamps `last_seen_at`, all transparently to the ~40 existing call sites. The service sets `entity.setCreatedBy(uuid)` on write and reads via `OwnedRepository.findAllOwned(uuid)`. The DTO that crosses the FE↔BE boundary **never** carries `created_by`. Consumers today: **biometrics** (`WeightLogController`, `SleepLogController`, `CheckInController`), **Train** (`TrainController`), **goal**/**Fuel**/**progression**, and — Phase-3 — **companion** (`CompanionController`, whose `ai_conversation`/`ai_message` owned tables scope every finder `…AndCreatedByAndDeletedFalse`; since V0.3 its `ContextSnapshotAssembler` also composes OTHER features' reads with the same explicit-`userId` scoping, and since V0.5 the chat **tools** carry the same principal in the Spring AI `ToolContext` — `ToolContexts.userId(ctx)`, NEVER a model-provided arg, so an LLM cannot ask a tool about another user — see [`companion.md`](companion.md) §5.2/§5.5). Anything new (Insights, People when they land) plugs in here unchanged.
- **Frontend data layer ↔ token (`tokenStore` → `apiFetch`/`apiSse` Bearer).** *Contract:* `authApi.login`/`register` are the only writers of `tokenStore` (via `setToken`); every `*Api.ts` client crosses through `apiFetch` — or, for the companion V0.4 SSE turn, `apiSse` (same file, same Bearer injection) — the only readers. `tokenStore.get()` re-reads `localStorage` on every call rather than caching, so a sign-out in another browser tab is visible here too. The hooks in `frontend/src/data/hooks.ts` are auth-unaware — they call API clients that are already authenticated. No feature imports the token directly.
- **Session-death detection ↔ `AuthGate`.** *Contract:* `apiFetch`/`apiSse`'s `handleAuthFailure` (`data/_client/api.ts`) treats a 401 anywhere protected, or a 403 carrying `AUTH_ACCOUNT_DISABLED`, as a dead session — it clears the token and emits `authEvents.emitSignedOut(reason)`. A 403 `AUTH_FORBIDDEN` (an owner-only endpoint hit by a non-owner) is a **permission** problem, not a session one, and does not sign the user out. Three paths are exempted from this altogether (`PUBLIC_AUTH_PATHS`): `/api/auth/login`, `/api/auth/register`, `/api/auth/change-password` — a 401 there means "wrong credentials"/"wrong current password", not "your session died". `AuthGate` is the sole subscriber (`authEvents.onSignedOut`) and reacts by clearing the whole query cache and returning to the `signedOut` phase.
- **App boot ↔ `AuthGate` gate.** *Contract:* `AuthGate` (mounted inside `QueryProvider`, above the router) exposes the boot phase to the rest of the tree — nothing downstream mounts until it resolves to `ready` (or `mustChangePassword`/`signedOut`/`failed`, each of which renders its own screen instead of `{children}`). Every screen inside `{children}` can assume "the current account is `ACTIVE` and its `me()` has already loaded" — see §2.
- **Error envelope ↔ `SystemMessage[]`.** *Contract:* `AuthService`/`CurrentUser`/`InviteService` throw `SystemRuntimeErrorException` → `GlobalExceptionHandler` (`…/techcore/exception/GlobalExceptionHandler.java`) → `SystemMessage[]` JSON (`code/message/fieldName/exceptionTraceId`). The FE `ApiError` (`api.ts`) parses exactly that array. **Since mezo-78rn** the same handler maps a method-mismatch (`HttpRequestMethodNotSupportedException` — e.g. a POST to a path that only survives as `/api/meal/{id}` once a `@ConditionalOnProperty` controller is gone) to a clean **405 `METHOD_NOT_ALLOWED`** SystemMessage instead of the generic 500 catch-all, and a multipart container-cap breach (`MaxUploadSizeExceededException` — `spring.servlet.multipart.max-file/request-size` in `application.yml`, kept above the 5 MB app-level photo cap so the service check stays the message-bearing limit) to a clean **400** rather than a 500. **Since `mezo-x0nb`** an unconvertible request parameter (`MethodArgumentTypeMismatchException` — a malformed UUID in a path, a non-numeric integer in a query, an unknown enum constant) likewise maps to a **400 FIELD `VALIDATION_INVALID_VALUE`** naming the parameter, instead of the 500 it used to produce; conversion runs before both the controller method and bean validation, so this is the only layer that can catch it (`…/techcore/exception/GlobalExceptionHandlerIT`). **Asymmetry to know:** Spring Security's *filter-level* 401 (missing/invalid token) uses `BearerTokenAuthenticationEntryPoint` → **empty body**, NOT the `SystemMessage[]` envelope (only `AuthService`/`CurrentUser` 401s flow through `GlobalExceptionHandler`). Tracked in `mezo-aus`.
- **Config ↔ deploy.** *Contract:* `OwnerProperties` + `AuthProperties` + `CorsProperties` bind `mezo.auth.*` / `mezo.cors.*`; in prod those env vars come from the `mezo-app` Kubernetes SealedSecret (see §9 / §10). `mezo.auth.strict=true` in the k8s Deployment means `AuthStartupGuard` refuses to boot on a dev-default owner password or JWT secret. Rotating the JWT secret invalidates all existing tokens for every account, not just one.
- **Tests ↔ `ownerAuthHeaders()` / `registerUser()`.** *Contract:* every HTTP-level integration test obtains a real Bearer header either by logging in as the `demodata` owner, or by minting and registering a second real `USER` account through the invite flow — see §8.
- **Cron ↔ `UserFanOut` + `LlmActorContext` (S6, `mezo-qw37.6`).** *Contract:* every `@Scheduled` job (23 of them across quest, proactive, companion, notification) fans out via `feature/auth/service/UserFanOut.forEachActiveUser(jobName, body)` instead of `appUserRepository.findAll()` — only `ACTIVE` + onboarded accounts, each `body` run under `techcore/security/LlmActorContext.runAs(userId, …)` so an LLM call made on the scheduler thread still gets `llm_log_history.created_by = userId` (see [`beta-admin.md`](beta-admin.md) §5). A `Throwable` from one user's body is logged and the fan-out continues; jobs add their own finer-grained try/catch on top. See §4.
- **Prompts ↔ `PromptPersona` (S6, `mezo-qw37.6`).** *Contract:* every prompt template that used to hardcode "Daniel" is now a `static final String` carrying the literal `{{NÉV}}`; the call site resolves it exactly once, right before the LLM call, via `promptPersona.render(userId, template)`. Transcript role labels and the konzílium wire marker are the neutral `PromptPersona.USER_TURN_LABEL`/`KonziliumProposalRound.USER_FEEDBACK_PREFIX` so stored rows (embeddings, audit history, conference transcripts) never depend on a display name. See §4.
- **Frontend storage ↔ `userScope` (S6, `mezo-qw37.6`).** *Contract:* `frontend/src/shared/lib/userScope.ts` holds a module-level `userId`, written ONLY by `AuthGate` (`setCurrentUserId`) — mirroring `tokenStore`'s single-writer pattern. Per-user storage keys go through `userScopedKey(base)` → `mezo.<userId>.<base>`; a signed-out state (or mock mode before the first render) scopes to `mezo.anon.…`. The device theme key (`mezo-theme`) deliberately does NOT go through this — theme stays device-level, not per-account. Real mode: `AuthGate` writes the id during the boot `me()` resolution and on every `onAuthenticated`/sign-out. Mock mode: `AuthGate` writes `mockMe.id` **during render**, not inside a `useEffect` — mock mode's phase starts at `'ready'` (no boot fetch needed), so React would run every descendant's mount-time effects *before* the parent `AuthGate`'s own effect fires, and an effect-time scope write would let those children's first render read/write `mezo.anon.*` instead of `mezo.<mockId>.*`. The render-time write is idempotent (same value every render), same safety argument as `tokenStore`'s own render-time reads.
- **Sign-out ordering ↔ `clearAllNightWake()` (S6, `mezo-qw37.6`).** *Contract:* `AuthGate`'s `authEvents.onSignedOut` handler calls `clearAllNightWake()` (a userScope-prefix key sweep) **before** `setCurrentUserId(null)`. The prune is scope-dependent — it reads `userScopedPrefix()` to find which keys belong to the signing-out account — so rebasing the scope to `mezo.anon.` first would make the sweep a silent no-op and leave the outgoing account's night-wake trace for the next signed-in user on a shared device.
- **Push ↔ endpoint re-bind (S6, `mezo-qw37.6`).** *Contract:* a push endpoint identifies one physical device; `PushSubscriptionService.register` soft-deletes any OTHER account's live row for the same `endpoint` before upserting the caller's own row (never an `UPDATE` of `created_by`, which is `updatable=false` on `OwnedEntity`) — one browser can never notify two accounts at once. See [`_platform-notifications.md`](_platform-notifications.md).
- **Admin ↔ `requireOwner()` (S3, `mezo-qw37.3`).** *Contract:* `AdminController`'s every method calls `currentUser.requireOwner()` before `AdminService` runs — invite mint/list/delete, user list, temp-password reset (which also stamps `tokensValidFrom` to revoke the target's existing sessions), enable/disable (blocked on self via `ADMIN_SELF_STATUS`). See §4 and [`beta-admin.md`](beta-admin.md).
- **LLM-usage ↔ owner-only + `byUser` (S3, `mezo-qw37.3`) / per-user filter (`mezo-qw37.7`).** *Contract:* the installation-wide `/api/llm-usage/*` surface is `requireOwner()`-gated and reports a `byUser` cost/token split (rows with `created_by IS NULL` — pre-S6 cron traffic, stream writes — land in an unattributed "background" bucket, never guessed at). The companion Memória/Audit panel's `GET /api/companion/memory/llm-usage` takes the opposite shape: no owner gate, but `MemoryObservatoryService.llmUsage(userId, days)` filters `created_by = :userId` so every account — owner or not — sees only its own spend; `created_by IS NULL` rows are excluded there too, never attributed to the caller. See [`beta-admin.md`](beta-admin.md) §9. On the frontend, `BeallitasokPage`'s `useLlmUsageSummary({ enabled: isOwner })` (`isOwner = useMe().data?.role === 'OWNER'`) skips the installation-wide-summary fetch entirely for a non-owner — unconditionally firing it used to guarantee a 403 for a plain `USER` (twice, with TanStack Query's default retry).

---

## 6. How to use it (consume)

**From the frontend — you usually consume auth *implicitly*.** Import a data hook from `@/data/hooks`; the request is already authenticated because `AuthGate` only renders `{children}` once a valid session is confirmed. You do not touch `setToken`/`apiFetch` yourself.

```tsx
// A view consuming an authenticated domain hook — auth is invisible.
import { useWeightLog } from '@/data/hooks'

function WeightCard() {
  const { data } = useWeightLog()      // real mode: Bearer attached automatically; mock mode: static data
  return <Trend points={data ?? []} />  // ghost-guard the null/empty case (no static fallback in real mode)
}
```

To read the signed-in account's own profile (role, onboarding, timezone), use `useMe()` (`frontend/src/data/auth/authHooks.ts`) rather than reaching into `AuthGate` — it is dual-mode like every other hook.

**From the backend — consume the owner identity in a controller.** Inject `CurrentUserId` (a `@Component` in `techcore/security`) and pass `.get()` into the service — unchanged from before S1:

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

**Owner-only endpoint?** Inject `CurrentUser` (not just `CurrentUserId`) and call `.requireOwner()` — it returns the entity when `role == OWNER`, otherwise throws 403 `AUTH_FORBIDDEN`:

```java
@RequiredArgsConstructor
public class InviteAdminController implements InviteAdminApi {
    private final CurrentUser currentUser;
    private final InviteService inviteService;

    @Override
    public InviteResponse mintInvite(CreateInviteRequest req) {
        AppUserEntity owner = currentUser.requireOwner();   // 403 AUTH_FORBIDDEN for a non-owner caller
        return toResponse(inviteService.create(owner.getId(), req.getLabel(), req.getExpiresAt()));
    }
}
```

Remember `CurrentUser`'s usage contract from §3: call it from the controller layer, never from inside an already-open (especially read-only) `@Transactional` method.

---

## 7. How to extend it

**Recipe — add a new protected, owner-scoped backend endpoint** (the established pattern; consult the referenced house standards *before* writing code):

1. **Contract-first** — add the path + schemas to `api/feature/<name>/<name>.yml`. Protected paths simply **omit** `security: []` (that key marks a path public, as on login/register). Merge via `cd api/generate && npm run generate:api`, then `cd frontend && pnpm generate:api`. See [`docs/references/api_contract_conventions.md`](../references/api_contract_conventions.md).
2. **Controller** `implements <Tag>Api`, `@RequiredArgsConstructor`, inject `private final CurrentUserId currentUserId;` (or `CurrentUser` if you need `requireOwner()` or the full entity). Package layout per [`docs/references/java_package_structure.md`](../references/java_package_structure.md); DI/`@Transactional` rules per [`docs/references/spring_patterns.md`](../references/spring_patterns.md).
3. **Owner key** — pass `currentUserId.get()` into the service. **Never** accept `created_by` from a request DTO.
4. **Persistence** — entity extends `OwnedEntity`; repository extends `OwnedRepository<T>`; reads via `findAllOwned(currentUserId.get())`; writes set `entity.setCreatedBy(currentUserId.get())`. Migration named `{YYYYMMDDHHMM}_{bd-id}_{desc}.sql` per [`docs/references/liquibase_conventions.md`](../references/liquibase_conventions.md); add the new table to `support/ResetDatabase` TRUNCATE list + a populator per [`docs/references/integration_test_framework.md`](../references/integration_test_framework.md).
5. **Config** — any tunable goes under `mezo:` in `application.yml` via a `@Validated` `*Properties` record; **never `@Value`** — see [`docs/references/configuration_conventions.md`](../references/configuration_conventions.md).
6. **Errors** — throw `SystemRuntimeErrorException` with a `SystemMessage` code registered in `messages.properties`; never hardcode user text — see [`docs/references/error_handling.md`](../references/error_handling.md).

**Swapping a mock hook to real** (e.g. Fuel/Insights/People): edit the matching branch in `frontend/src/data/hooks.ts` so the real branch calls a new `*Api.ts` client over `apiFetch`. The token is already there — no auth wiring needed. Add an MSW handler in `frontend/src/test/msw/handlers.ts` for the new path so real-mode tests pass. **Both modes must stay green** (`VITE_USE_MOCK=true pnpm test` and `VITE_USE_MOCK=false pnpm test`).

**The multi-user epic (`mezo-qw37`) at this HEAD — S1, S3, S4 and S6 are built; S2, S5 are not.** Design spec: [`docs/superpowers/specs/2026-09-02-multi-user-accounts-design.md`](../superpowers/specs/2026-09-02-multi-user-accounts-design.md).

- **S1 (`mezo-qw37.1`) — done:** the `app_user`/`invite` schema, the auth contract (register/login/me/change-password/onboarding-complete), the FE boot state machine (`AuthGate`).
- **S2 (`mezo-qw37.2`) — done:** the `onboarding` `AuthPhase` + `OnboardingPage` wizard (§2), `useOnboardingActions` (the profile → weight → onboarding-complete commit), the Beállítások **Fiók** group, and the move of `ProtocolSeedData`/`PeopleSeedData`/`GamificationDemoData`/`GoalReevaluateRunner` from prod `demodata` to opt-in `demofixtures`, so a registered account starts on a clean slate.
- **S3 (`mezo-qw37.3`) — done:** the owner admin surface. `InviteService.create` DOES now have a controller caller — `AdminController.createInvite` (verified: every `AdminController` method opens with `currentUser.requireOwner()`, §4) — plus invite list/delete, user list, temp-password reset (revokes the target's sessions), and enable/disable (`ADMIN_SELF_STATUS` blocks the owner locking themselves out). Also S3: the `/api/llm-usage/*` owner gate + `byUser` split, and `LlmActorContext` (§4/§5).
- **S4 (`mezo-qw37.4`) — done: the pantry catalog split.** See §4's "Ownership exception" note — `pantry_catalog` (shared definitions) now exists alongside per-user `pantry_item`; details in [`pantry.md`](pantry.md).
- **S5 (`mezo-qw37.5`) — done:** the exercise-catalog slice (media/edit permissions, `authoredByMe`, slug-race close).
- **S6 (`mezo-qw37.6`) — done:** `PromptPersona`/`PersonaContext`/`UserFanOut` (§4), the cron presence guard fix, push endpoint re-bind, `userScope` storage namespacing, the `useProfile`/`useMe` real-mode swap, and this doc itself.
- **Still genuinely ahead:**
  - **`mezo-qw37.8` — `apiSse` session-death detection is handshake-only.** `handleAuthFailure` (`frontend/src/data/_client/api.ts`) runs on the initial SSE response status; once a stream is open, a token expiring or an account being disabled mid-stream is not re-checked per frame — the session only dies on the NEXT request. Not yet fixed.
  - Per-account settings beyond the single `timezone` column (T1, stored but not consulted — §9) remain open-ended future work with no assigned slice.

---

## 8. Testing

**Backend (integration-first, real Postgres):**
- `…/feature/auth/AuthControllerIT` (extends `ApiIntegrationTest`): valid login → non-blank token; wrong password → 401 `AUTH_LOGIN_INVALID_CREDENTIALS`; disabled account → 403 `AUTH_ACCOUNT_DISABLED`; malformed email / empty password → 400 field errors (`VALIDATION_INVALID_EMAIL` + `VALIDATION_INVALID_VALUE`); **protected path w/o token → 401** ("security filter precedes routing — 401 even without a matching endpoint"); `ownerAuthHeaders()` → 200 on `/api/biometrics/weight`.
- `…/feature/auth/AuthRegisterIT`: valid invite → 200 + token; used/expired/unknown invite → 409 `AUTH_INVITE_INVALID`; duplicate email (pre-check and DB-race path) → 409 `AUTH_EMAIL_TAKEN`; password over the 72-byte BCrypt limit → 400 `VALIDATION_INVALID_VALUE`.
- `…/feature/auth/AuthMeIT`: `GET /api/auth/me` shape for both roles; disabled account → 403.
- `…/feature/auth/AuthIsolationIT`: a second registered account sees zero of the first account's owned rows — the ownership-isolation invariant now exercised through the real register flow rather than only `UserPopulator`.
- `…/feature/auth/AuthStartupGuardTest`: `mezo.auth.strict=true` + dev-default password or secret → boot refuses (`INTERNAL_ERROR`, offending keys named in the message); `strict=false` or non-default values → boots clean.
- `…/feature/auth/service/AuthServiceTest`, `…/feature/auth/service/CurrentUserIT`, `…/feature/auth/service/InviteServiceTest`: unit/slice coverage of login/register/change-password/onboarding, the per-request status check + `last_seen_at` 5-minute stamp + `requireOwner()`, and invite create/consume incl. the `FOR UPDATE` race.
- `…/feature/auth/OwnerSeedDataIT` (extends `AbstractIntegrationTest`): exactly one `OWNER` under `demodata`; re-running `ownerSeedData.run()` stays single; `TrainSeedData`, `ProtocolSeedData`, `PeopleSeedData`, `GamificationDemoData`, `GoalReevaluateRunner` beans absent unless `demofixtures` (S2 moved the last four out of prod).
- `…/feature/auth/AuthOnboardingIT` — a registered USER gets lazy per-user bootstraps (gamification ghost profile `ujonc`/0 coins, 15 habit defs) and no owner fixtures; the wizard's three-call sequence flips `onboarded`.
- `…/techcore/security/CorsConfigIT`: preflight echoes ACAO for `:5180`; disallowed origin → 403 no ACAO; authenticated real request carries ACAO.
- **Test seam — `ApiIntegrationTest.ownerAuthHeaders()`**: logs in as the `demodata` owner via the real `/api/auth/login` and returns `Bearer` headers. **`ApiIntegrationTest.registerUser(label)`** (new in S1): mints an invite as the owner, registers a second real account through `/api/auth/register`, and returns `RegisteredUser(id, email, headers)` — the seam for any test that needs a genuine *second* account rather than the shared owner (cross-account isolation, role/status behavior).
- `support/populator/UserPopulator`: find-or-create `AppUserEntity` by email (placeholder `password_hash = "x"`) — still used where a test only needs an FK-valid `created_by`, not a real login-capable account. **Since S6 (`mezo-qw37.6`), `createUser`/`createUser(email)` yields an `ACTIVE` + **onboarded** account** (`onboardedAt = Instant.now()`), because the cron fan-out (`UserFanOut`) requires both to visit a user — a populator-made user that a job IT expects to be **skipped** must say so explicitly: `user.setOnboardedAt(null)` (or `setStatus(DISABLED)`) + `save(user)` to model the excluded kind.
- **S3 role matrix (`AdminInviteIT`, `AdminUserIT`, `mezo-qw37.3`):** OWNER → 200 on every `/api/admin/*` endpoint; a registered `USER` (`registerUser`) → 403 `AUTH_FORBIDDEN` on the same paths. The `ADMIN_SELF_STATUS`/`ADMIN_INVITE_USED`/`ADMIN_INVITE_NOT_FOUND`/`ADMIN_USER_NOT_FOUND` domain-error paths are covered service-side (`AdminService` assumes the controller already gated ownership).
- **S6 fan-out + persona ITs (`mezo-qw37.6`):** `UserFanOutIT` (`feature/auth/service/`) — only `ACTIVE` + onboarded users visited, a `Throwable` from one user's body does not abort the run (the sneaky-throw case), `LlmActorContext.current()` is set for the duration of each body and restored after; `PromptPersonaIT` (`feature/auth/service/`) — `render` substitutes `{{NÉV}}` with the real `app_user.name`, falls back to `PersonaContext.FALLBACK` for an unknown/null user; `PushSubscriptionRebindIT` (`feature/notification/`) — registering the same `endpoint` under a second account soft-deletes the first account's row; `QuestJobIT` (`feature/quest/`) — `runGenerate` skips a user with `lastSeenAt == null` or older than `cronPresenceDays`, generates for one seen inside the window, and a quest row created THIS run does not itself satisfy the presence check on a later run (the latch regression test); `KonziliumUserFeedbackIT` (`feature/character/`) — the Szkeptikus/Integrátor prompts render `{{NÉV}}` and the wire marker is `FELHASZNÁLÓ VÁLASZA —`.
- `support/ResetDatabase`: `invite` is in the plain TRUNCATE list (it has no cross-test seed data to preserve); `app_user` is still handled selectively — `DELETE FROM app_user WHERE lower(email) <> lower(:ownerEmail)` keeps the seeded owner intact and drops every registered test account (their `invite.used_by` cascades to `SET NULL`, `invite.created_by` cascades to `DELETE` only if the test account itself minted invites). `user_profiles` is gone, so its former delete step is gone too.
- Deps (`backend/pom.xml`): `spring-boot-starter-security`, `spring-boot-starter-oauth2-resource-server` (brings resource-server + Nimbus jose), `spring-boot-starter-security-test`.

**Frontend:** MSW handlers at `frontend/src/test/msw/handlers.ts` cover `POST /api/auth/login`, `POST /api/auth/register`, `GET /api/auth/me`, `POST /api/auth/change-password`, `POST /api/auth/onboarding-complete` so real-mode tests (including `AuthGate`'s own boot-phase tests) run without a live backend. `AuthGate.test.tsx` and `authState.test.ts` cover the phase derivation directly, including the mock-mode render-time scope write, the `clearAllNightWake()`-before-`setCurrentUserId(null)` sign-out ordering (S6), and the S2 `onboarding` phase (wizard → app, and must-change-password outranking it); `OnboardingPage.test.tsx`/`onboardingSteps.test.ts`/`onboardingHooks.test.tsx` cover the wizard's three-call commit order, the contract-bound clamping and the inline commit error; `ChangePasswordSheet.test.tsx` and `BeallitasokPage.test.tsx` cover the Beállítások **Fiók** group (identity, sheet, mock-mode-hidden Kijelentkezés); `userScope.test.ts` covers the module-level scope (`setCurrentUserId`/`userScopedKey`/`userScopedPrefix`, `mezo.anon.` fallback); `meHooks.test.tsx` covers `useProfile` in both modes — real mode `null` until `useMe()` resolves, mock mode the static `today.ts` seed; `TranscriptTurn.test.tsx` asserts both the new `FELHASZNÁLÓ VÁLASZA —` prefix and the legacy `DANIEL VÁLASZA —` literal parse as a user turn. `LoginPage.test.tsx`/`RegisterPage.test.tsx`/`ChangePasswordPage.test.tsx` cover the forms, including the 72-byte password guard pinned client-side to match the backend. Both `VITE_USE_MOCK` modes must stay green.

**Commands:**
```bash
# Backend ITs (compose Postgres, or -Dmezo.test.use-testcontainers=true)
cd backend && ./mvnw clean test
# Frontend — BOTH modes must pass
cd frontend && VITE_USE_MOCK=false pnpm test    # real mode (MSW)
cd frontend && VITE_USE_MOCK=true pnpm test     # mock mode
```

---

## 9. Decisions, gotchas & deferred

**Gotchas:**
- HS256 header must be set **explicitly** on encode (Nimbus + symmetric secret) — see §4.
- `OwnerProperties.jwtSecret` `@Size(min=32)` fails at **bind/boot**, not at sign time; `AuthStartupGuard` additionally fails boot when `mezo.auth.strict=true` and the secret (or the owner password) is still the dev default — see §4.
- Filter-level 401 → **empty body**, not the `SystemMessage[]` envelope (only `AuthService`/`CurrentUser` 401s go through `GlobalExceptionHandler`). Tracked in `mezo-aus`.
- Token now lives in `localStorage` (`tokenStore`, key `mezo.auth.token`) — survives reload; `tokenStore.get()` re-reads storage every call (not cached) so a sign-out in another tab is picked up. A storage access that throws (private mode, blocked site data) falls back to an in-memory-only token for that tab. A dead session (401, or 403 `AUTH_ACCOUNT_DISABLED`) fires `authEvents.emitSignedOut(reason)`; `AuthGate` is the sole subscriber.
- `@Order(0)` on `OwnerSeedData` is load-bearing for `TrainSeedData` ordering; `AuthStartupGuard` runs at `@Order(-1)`, before it.
- `CurrentUser.get()`/`.id()` must be called from the controller layer, never from inside an already-open (especially read-only) `@Transactional` method — see §3/§6.
- The JWT carries no role/status claim; both are re-read from the DB every request, which is what lets a disable or role change take effect immediately rather than waiting out the 30-day token expiry — but it also means every protected request pays one extra `SELECT` (mitigated by the per-request `RequestAttributes` cache, not by any cross-request cache).
- **`UserPopulator` users are onboarded by default (S6).** A job IT that expects the cron fan-out to SKIP a populator-made user must say so explicitly (`onboardedAt = null` or `status = DISABLED` + `save`) — see §8.
- **Prompt templates carry `{{NÉV}}` (S6).** A golden test asserting a rendered prompt/transcript string must assert the SUBSTITUTED name, never the literal `Daniel` — the old hardcoded value is gone from every template.
- **Old conference transcripts keep the legacy `"DANIEL VÁLASZA — "` marker (S6).** Rows written before S6 still carry it; the frontend's `TranscriptTurn` (`USER_ANSWER_PREFIXES`) parses both the old literal and the new `"FELHASZNÁLÓ VÁLASZA — "` — never assume every stored transcript uses the current marker.
- **Pre-S6 un-namespaced storage keys are orphaned (S6).** Every per-user `localStorage`/`sessionStorage` key added before the `userScope` namespacing (`mezo.<userId>.…`) is now unreachable under its old bare name — a device upgrading mid-session loses that one piece of state once (e.g. a pending night-wake snooze), never migrated forward.
- **`UserFanOut.forEachActiveUser` catches `Throwable`, not `Exception` (S6).** A `Consumer<T>` cannot declare a checked exception, but a sneaky-throw can still escape a job body — catching only `Exception` would let it abort the whole cron run for every remaining user.
- **Sign-out order is load-bearing (S6).** `AuthGate` calls `clearAllNightWake()` before `setCurrentUserId(null)` — the sweep is scope-dependent, so clearing the scope first turns it into a silent no-op (see §5).
- **`AuthGate` writes the mock-mode user id during RENDER, not inside a `useEffect` (S6).** Mock mode starts at phase `'ready'`, so descendant effects run before the parent's own effect — an effect-time write would let children's first render observe `userId === null` and touch `mezo.anon.*` instead of the mock account's scope (see §5).

**Closed:**
- **`mezo-5h9` — fail-fast on default secrets.** ✅ CLOSED (S1, `AuthStartupGuard`). `mezo.auth.strict=true` (set in the k8s Deployment) now refuses to boot on a dev-default owner password or JWT secret. The 30-day JWT expiry itself remains open; a second revocation lever now exists alongside "disable the account" — changing a password stamps `tokens_valid_from` and revokes every token minted before it (mezo-qw37.1 review, Finding 4) — which is what makes S3's owner-driven password reset an actual compromise-recovery tool.
- **`mezo-qw37.7` — companion memory observatory's LLM-usage was cross-account.** ✅ CLOSED (`MemoryObservatoryService.llmUsage`/`LlmUsageService.perDay` gained a `created_by = :userId` filter) — see §5, [`beta-admin.md`](beta-admin.md) §9.

**Deferred bd issues (all OPEN):**
- **`mezo-aus` (P3) — filter-level 401s bypass the `SystemMessage[]` envelope**, plus a custom `authenticationEntryPoint` to fix it.
- **`mezo-8bq` (P4) — double `me()` on cold load** if two consumers race the boot check before `AuthGate` settles. Harmless (idempotent GET) but doubles auth traffic on first paint. Fix: memoize the in-flight promise.
- **T1 (`app_user.timezone`) is stored but not yet consulted** by any "today" logic — the beta stays HU-only server-global; a per-account timezone would need to touch 47+ `LocalDate.now()` call sites (ADR 0035).
- **L2 (monthly per-account LLM cost quota) was not adopted** — S6 shipped only the cost-visibility half (owner `byUser` split + per-user Memória/Audit panel); an enforced cap is future work (ADR 0035).

The full multi-user epic (`mezo-qw37`, S1–S6) is now complete; see [ADR 0035](../decisions/0035-multi-user-account-model.md) and the driving spec ([`docs/superpowers/specs/2026-09-02-multi-user-accounts-design.md`](../superpowers/specs/2026-09-02-multi-user-accounts-design.md)) for the full decision record.

**Operational / secrets:** prod env (`MEZO_JWT_SECRET`, `MEZO_OWNER_EMAIL`, `MEZO_OWNER_PASSWORD`, `MEZO_OWNER_NAME`, `MEZO_AUTH_STRICT`) comes from the `mezo-app` Kubernetes Secret, consumed in `k8s/backend/deployment.yaml` via `secretKeyRef`. It is committed as an **encrypted SealedSecret** (`k8s/backend/sealedsecret.yaml`, name `mezo-app`), decrypted in-cluster by the sealed-secrets controller; template `k8s/backend/secret.example.yaml`. `MEZO_AUTH_STRICT=true` in that Deployment means a real `MEZO_OWNER_PASSWORD` and `MEZO_JWT_SECRET` are now **mandatory** — the dev defaults will refuse to boot the pod. See [`docs/infrastructure/deployment-k3s-argocd.md`](../infrastructure/deployment-k3s-argocd.md) (Secrets table, `mezo-app` = "JWT + owner"; Sealed Secrets DONE note) and [`docs/infrastructure/runbook.md`](../infrastructure/runbook.md) (logins table, rotate-a-secret recipe, **back up the sealing key** — lose it on rebuild and `mezo-app`/the JWT secret must be re-sealed, which invalidates all existing tokens for every account). **`mezo-app` also now carries `VAPID_PUBLIC`/`VAPID_PRIVATE`** (the push-notification Web Push keypair, `mezo-h4wp.6.1`) — unrelated to auth/ownership, but sharing the same secret container as the `GEMINI_API_KEY` precedent; a leaked VAPID private key allows spoofed pushes to subscribed devices only (rotation = new keypair + re-subscribe), a materially smaller blast radius than a leaked JWT secret. See [`_platform-notifications.md`](_platform-notifications.md) and [ADR 0014](../decisions/0014-own-webpush-implementation.md).

---

## 10. Key files

**Backend — auth feature** (`backend/src/main/java/io/mrkuhne/mezo/feature/auth/`):
- `OwnerProperties.java` — `mezo.auth.*` credential config record (email/password/name/jwtSecret, validated).
- `AuthProperties.java` — `mezo.auth.strict` flag, consumed by `AuthStartupGuard`.
- `AuthStartupGuard.java` — `@Order(-1)` fail-fast on dev-default secrets under `mezo.auth.strict=true` (mezo-5h9).
- `OwnerSeedData.java` — `@Profile("demodata") @Order(0)` owner seeder (idempotent, `role=OWNER`).
- `controller/AuthController.java` — implements generated `AuthApi`; delegates to `AuthService`/`CurrentUser`.
- `entity/AppUserEntity.java` — `app_user` (role/status/timezone/onboarding, unchanged UUID PK + unique email + BCrypt hash).
- `entity/InviteEntity.java` — `invite` (one-shot registration code).
- `repository/AppUserRepository.java` — `findByEmail`, `existsByEmail`.
- `repository/InviteRepository.java` — `existsByCode`, `findByCodeForUpdate`.
- `service/AuthService.java` — login/register/me/changePassword/completeOnboarding + JWT issuance (HS256, 30d, sub=userId).
- `service/InviteService.java` — invite `create`/`consume` (row-lock race handling).
- `service/CurrentUser.java` — per-request account load, DISABLED→403, `last_seen_at` stamp, `requireOwner()`.
- `service/AdminService.java` (S3) — invite CRUD + user list/reset-password/status for the OWNER surface.
- `controller/AdminController.java` (S3) — `/api/admin/*`, every method opens with `requireOwner()`.
- `service/PromptPersona.java` (S6) — `{{NÉV}}` template substitution, `USER_TURN_LABEL`.
- `service/PersonaContext.java` (S6) — `record PersonaContext(String userName)` + `FALLBACK`.
- `service/UserFanOut.java` (S6) — `forEachActiveUser`, the cron replacement for `appUserRepository.findAll()`.

**Backend — security / ownership** (`backend/src/main/java/io/mrkuhne/mezo/techcore/`):
- `security/SecurityConfig.java` — filter chain, CORS, JwtEncoder/Decoder, PasswordEncoder, public allowlist (`login`, `register`, `/actuator/health`).
- `security/CurrentUserId.java` — thin delegate onto `CurrentUser.id()` — the `created_by` source every existing controller already used.
- `security/CorsProperties.java` — `mezo.cors.allowed-origins`.
- `security/LlmActorContext.java` (S3/S6) — `ThreadLocal<UUID>` acting-account for cron LLM calls; `runAs`.
- `persistence/OwnedEntity.java` / `persistence/OwnedRepository.java` — ownership base + owner-scoped finder.
- `exception/GlobalExceptionHandler.java` — maps `SystemRuntimeErrorException` (incl. 401s) + validation → `SystemMessage[]`.

**Contract & migration:**
- `api/feature/auth/auth.yml` — login/register/me/change-password/onboarding-complete + schemas.
- `api/feature/admin/admin.yml` (S3) — invite CRUD + user list/reset-password/status.
- `backend/src/main/resources/db/changelog/1.0.0/script/202606101200_mezo-v67_create_auth.sql` — original `app_user` + `user_profiles` DDL.
- `backend/src/main/resources/db/changelog/1.0.0/script/202609021200_mezo-qw37.1_multi_user_accounts.sql` — S1: role/status/timezone/onboarding columns, `invite` table, `user_profiles` drop, owner backfill.
- `backend/src/main/resources/messages.properties` — `AUTH_LOGIN_INVALID_CREDENTIALS`, `AUTH_TOKEN_MISSING`, `AUTH_ACCOUNT_DISABLED`, `AUTH_FORBIDDEN`, `AUTH_INVITE_INVALID`, `AUTH_EMAIL_TAKEN`, `ADMIN_*`, validation codes.
- `backend/src/main/resources/application.yml` — `mezo.auth.*` + `mezo.cors.*` defaults/env overrides; `/actuator` health exposure.

**Frontend:**
- `frontend/src/data/_client/api.ts` — `apiFetch`/`apiSse`, `setToken`, Bearer injection, `ApiError`, `handleAuthFailure` (401/403-disabled session-death detection).
- `frontend/src/data/_client/tokenStore.ts` — persisted (`localStorage`) token store, storage-throw fallback.
- `frontend/src/data/_client/authEvents.ts` — the sign-out event bus (`apiFetch`/`apiSse` → `AuthGate`).
- `frontend/src/data/_client/mode.ts` — `isMockMode()`.
- `frontend/src/data/auth/authApi.ts` — typed REST client (`login`/`register`/`me`/`changePassword`/`completeOnboarding`).
- `frontend/src/data/auth/authHooks.ts` — `useMe()` (dual-mode) + `useAuthActions()` (login/register/changePassword/completeOnboarding/logout, cache-clear semantics).
- `frontend/src/data/auth/authMock.ts` — mock-mode static identity.
- `frontend/src/app/auth/AuthGate.tsx` — the boot state machine; mounted inside `QueryProvider`, above the router; also the `userScope`/`clearAllNightWake` sign-out ordering (S6).
- `frontend/src/app/auth/authState.ts` — `AuthPhase` + `deriveFromMe`/`deriveFromError`.
- `frontend/src/shared/lib/userScope.ts` (S6) — module-level `userId`, `setCurrentUserId`/`currentUserId`/`userScopedKey`/`userScopedPrefix`.
- `frontend/src/features/auth/components/AuthShell.tsx` — the chrome-free layout the auth pages render into.
- `frontend/src/features/auth/pages/{LoginPage,RegisterPage,ChangePasswordPage}.tsx` — the auth screens.
- `frontend/src/features/auth/logic/authErrorText.ts` — error-code → Hungarian copy for the auth forms.
- `frontend/src/app/providers/QueryProvider.tsx` — mounts `AuthGate`.
- `frontend/.env.example` — API URL + mock flag (no owner creds).
- `frontend/src/test/msw/handlers.ts` — auth MSW handlers.

**Tests:**
- `backend/…/feature/auth/{AuthControllerIT,AuthRegisterIT,AuthMeIT,AuthIsolationIT,AuthStartupGuardTest,AdminInviteIT,AdminUserIT}.java`.
- `backend/…/feature/auth/service/{AuthServiceTest,CurrentUserIT,InviteServiceTest,PromptPersonaIT,UserFanOutIT}.java`.
- `backend/…/feature/quest/QuestJobIT.java`, `backend/…/feature/notification/PushSubscriptionRebindIT.java`, `backend/…/feature/character/KonziliumUserFeedbackIT.java`.
- `frontend/src/app/auth/AuthGate.test.tsx`, `frontend/src/shared/lib/userScope.test.ts`, `frontend/src/data/me/meHooks.test.tsx`, `frontend/src/features/character/components/TranscriptTurn.test.tsx`.
- `backend/…/feature/auth/OwnerSeedDataIT.java`.
- `backend/…/techcore/security/CorsConfigIT.java`.
- `backend/…/support/ApiIntegrationTest.java` (`ownerAuthHeaders()`, `registerUser()`), `support/ResetDatabase.java` (owner preservation, `invite` TRUNCATE), `support/populator/UserPopulator.java`.

**Infra / secrets:** `k8s/backend/deployment.yaml`, `k8s/backend/sealedsecret.yaml`, `k8s/backend/secret.example.yaml`, `k8s/README.md`, `docs/infrastructure/deployment-k3s-argocd.md`, `docs/infrastructure/runbook.md`.

**Design source:** `docs/superpowers/specs/2026-09-02-multi-user-accounts-design.md` (§5 — schema, contract table, transaction/lock detail, FE boot state machine); superseded original: `docs/superpowers/specs/2026-06-10-phase2-backend-design.md`.

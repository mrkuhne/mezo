# Security Conventions

House rules for authentication, identity and data ownership in mezo (bd mezo-ah18.2, finalized with
the multi-user epic mezo-qw37). Living detail: `docs/features/_platform-auth-security.md`; the why:
`docs/decisions/0035-multi-user-account-model.md`.

## Identity
- HS256 JWT, 30-day expiry, `sub` = `app_user.id`; issued by `AuthService.login/register`, validated
  by the resource-server filter. No refresh token, no server-side revocation: **disabling** is a
  per-request status check (`CurrentUser` → 403 `AUTH_ACCOUNT_DISABLED`).
- Controllers inject `CurrentUserId` (a `UUID`) or `CurrentUser` (entity, `requireOwner()`);
  **never** read identity from a request DTO, header or query parameter.
- Roles: `OWNER` (seeded founder, admin surface) and `USER`. Owner-only endpoints call
  `currentUser.requireOwner()` first — 403 `AUTH_FORBIDDEN`.
- Public allowlist is exactly `/api/auth/login`, `/api/auth/register`, `/actuator/health`.

## Ownership
- Every domain table carries `created_by uuid NOT NULL` (FK `app_user` cascade), set server-side.
  Reads filter `created_by = currentUser`; a foreign row is a **404** (`OwnershipGuard.ownedOrThrow`),
  never a 403 — existence must not leak.
- Catalog tables are the one exception: `exercise_catalog`, `pantry_catalog` rows with
  `created_by IS NULL` are master data visible to everyone; user-authored rows are visible to
  everyone but editable only by author or OWNER.
- Cron jobs iterate `UserFanOut.forEachActiveUser` (ACTIVE + onboarded) and run under
  `LlmActorContext.runAs(userId, …)`; never `appUserRepository.findAll()`.
- Push endpoints belong to one account: subscribing re-binds the endpoint to the caller.

## Soft delete
- `is_deleted` + `@SQLDelete`/`@SQLRestriction`; normal paths never hard-delete. Unique indexes
  are partial (`WHERE is_deleted = false`) so a soft-deleted row never blocks a re-create.

## Prompts and the user's name
- Prompt templates are `static final` and carry `{{NÉV}}`; `PromptPersona.render(userId, template)`
  is the only substitution, applied once before the LLM call. Transcript role label is
  `PromptPersona.USER_TURN_LABEL` (`Felhasználó: `); the konzílium marker is `FELHASZNÁLÓ VÁLASZA —`.

## Tests
- Every new endpoint: a no-token 401 test and a B-user (`registerUser`) 404/403 test.
- Owner/user matrix for admin and LLM-usage endpoints. No token forging: mint via `/api/auth/login`.

## Secrets
- Prod refuses to boot with the default JWT secret / owner password (`mezo.auth.strict`, mezo-5h9).
- Never log a push endpoint, a token or key material.

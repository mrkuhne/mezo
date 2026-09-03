---
title: Beta admin — invite codes, accounts, LLM-usage gate
type: feature-domain
status: done
updated: 2026-09-02
tags: [me, auth, admin, llmlog, backend, frontend, data-layer]
key_files:
  - api/feature/admin/admin.yml
  - backend/src/main/java/io/mrkuhne/mezo/feature/auth/service/AdminService.java
  - backend/src/main/java/io/mrkuhne/mezo/feature/auth/controller/AdminController.java
  - backend/src/main/java/io/mrkuhne/mezo/techcore/security/LlmActorContext.java
  - frontend/src/data/admin/adminHooks.ts
  - frontend/src/features/me/pages/BetaAdminPage.tsx
  - frontend/src/features/me/components/AiUserFilter.tsx
related: [_platform-auth-security, me, companion, _platform-api-backend, _platform-data-layer]
---

# Beta admin — Feature Documentation

> One-line: the owner's minimal console at route `/me/beallitasok/admin` ("Beta admin" row on Beállítások, OWNER-only) — invite codes, the account list, temp-password reset, enable/disable — plus the OWNER gate on `/api/llm-usage/*` with a per-account cost split and the `LlmActorContext` seam for cron attribution. **Status: ✅ backend · ✅ FE real · ✅ FE mock.** S3 of the multi-user epic (`mezo-qw37.3`).

## 1. Summary

A closed, invite-coded beta (spec decision A/A1, Q3a in [`2026-09-02-multi-user-accounts-design.md`](../superpowers/specs/2026-09-02-multi-user-accounts-design.md) §2, §7) needs exactly three admin gestures: hand out a code, look at who is in, and rescue or lock an account. There is no email infrastructure, so a password reset is the owner reading out a 12-character temporary password that forces a change at next login (S1's `must_change_password` → `ChangePasswordPage`). Everything is `role = OWNER`-only via `CurrentUser.requireOwner()` (S1). The same slice closes the cross-user leak in the AI-napló: `llm_log_history` holds every account's prompts, so `/api/llm-usage/*` is owner-only now and reports a `byUser` split instead of pretending "all rows are my rows". `LlmActorContext` (techcore ThreadLocal) is added so S6's cron fan-out can stamp `created_by` on background LLM calls.

## 2. User-facing behavior

- **Beállítások** (`/me/beallitasok`): two rows render only for an OWNER — `AI-napló` (its reads are owner-only now) and `Beta admin` (sub-line `meghívók · felhasználók`).
- **Beta admin** (`/me/beallitasok/admin`, Mozaik `lav`, back chip `‹ Beállítások`), two chip-tabs:
  - **Meghívók** — a `Címke` input + `Új kód` mints a `MEZO-XXXX-XXXX` code (no expiry from the UI; the contract allows `expiresInDays`), list newest first; each open row: code (mono), label, state (`nyitott` / `lejár: …` / `lejárt`), `Másolás` (clipboard, toast `Kód másolva`; falls back to a toast showing the code), `Törlés`. A used row shows `felhasználta: <név> · <idő>` and has no actions (409 `ADMIN_INVITE_USED` server-side). Empty: `Nincs nyitott meghívó.`
  - **Felhasználók** — one card per account: name, email, `tulajdonos` / `aktív` / `letiltva`, `utoljára: …` (or `még nem járt itt`), `· onboarding nyitva` while `onboardedAt` is null; `Jelszó-reset` opens **`TempPasswordSheet`** (`Ideiglenes jelszó`, shown once, `Megjegyeztem`); a `Letiltás: <név>` switch flips `ACTIVE ↔ DISABLED` — the server only rejects the caller's own row (409 `ADMIN_SELF_STATUS`); the switch is also hidden on any OWNER row (`AdminUserRow.tsx`), a UI-side choice, not a server rule, so a second OWNER account is not protected from another owner at the API level. A disabled account's next request is rejected with 403 `AUTH_ACCOUNT_DISABLED` and the S1 `AuthGate` signs it out.
- **AI-napló** (`/me/ai-usage`): a chip row under the model breakdown — `Mindenki`, one chip per account (`<név> <hívások>`), and a non-clickable `Háttér <n>` bucket for principal-less (cron/stream) rows. A chip narrows the LIST server-side (`userId`), the same way the feature/status/kind filters do.

## 3. Architecture & data flow

`BetaAdminPage` → `useAdminInvites()` / `useAdminUsers()` (`useDualQuery`; mock = static seed, real = `adminApi.list*`, honest `[]` while unresolved) and `useAdminActions()` (mock flavor edits the query cache in place so every button visibly does something; real flavor calls `adminApi.*` then invalidates). → `AdminController implements AdminApi` (every method `currentUser.requireOwner()` first) → `AdminService` → `InviteService.create` (S1, readable code, unique) / `InviteRepository` / `AppUserRepository` + `PasswordEncoder` (BCrypt of the temp password; clear text only in the response). Errors are `SystemRuntimeErrorException` codes (`ADMIN_*`) → `SystemMessageList` → FE `ApiError` → the QueryProvider mutation-cache toast.

LLM-usage: `LlmUsageController` injects `CurrentUser` and gates all four reads; `LlmUsageService.breakdown` adds `byUser` from `LlmLogRepository.aggregateByUserSince` (grouped by `created_by`, ad-hoc `left join AppUserEntity` for the name — no JPA association, the audit row must outlive the account); `listCalls` takes `userId` (`(:userId is null or l.createdBy = :userId)`); `LlmCallRow`/`LlmCallListItem` carry `createdBy`. Attribution: `EventPublishingLlmCallRecorder` resolves the actor on the calling thread via `LlmActorResolver` — JWT principal first, else `LlmActorContext.current()`, else null. `LlmActorContext.runAs(userId, body)` is a nesting, always-restoring ThreadLocal in `techcore/security`; S3 ships no production caller — S6's `UserFanOut` wraps each per-user cron iteration.

## 4. Data model & API

No schema change (S1 created `invite` and the `app_user` role/status/must_change_password/last_seen_at columns; `llm_log_history.created_by` stays nullable).

Contract `api/feature/admin/admin.yml` (tag `Admin` → `AdminApi`), all bearer + OWNER (403 `AUTH_FORBIDDEN`):

| Op | Path | → | Errors |
|---|---|---|---|
| `createInvite` | `POST /api/admin/invites` `{label?, expiresInDays? (1..365)}` | `InviteResponse{id, code, label?, createdAt, expiresAt?, usedBy?, usedByName?, usedAt?}` | 400 |
| `listInvites` | `GET /api/admin/invites` | `InviteResponse[]` newest first | |
| `deleteInvite` | `DELETE /api/admin/invites/{id}` | 204 | 404 `ADMIN_INVITE_NOT_FOUND`, 409 `ADMIN_INVITE_USED` |
| `listUsers` | `GET /api/admin/users` | `AdminUserResponse{id, email, name, role, status, createdAt, onboardedAt?, lastSeenAt?}[]` oldest first | |
| `resetPassword` | `POST /api/admin/users/{id}/reset-password` | `{temporaryPassword}` (12 chars, `must_change_password = true`) | 404 `ADMIN_USER_NOT_FOUND` |
| `setStatus` | `POST /api/admin/users/{id}/status` `{status: ACTIVE\|DISABLED}` | 204 | 400, 404, 409 `ADMIN_SELF_STATUS` |

`llm-usage.yml` changes: `LlmUsageBreakdownResponse.byUser: LlmUsageUserGroup{userId?, name?, callCount, totalTokens, costUsd?}[]` (cost-descending, unpriced last, null user = background); `GET /api/llm-usage/calls` gains `userId` (uuid, before `limit`); `LlmCallListItem.createdBy?`; every op documents 403.

FE: `data/admin/adminApi.ts` (types off `api.gen.ts`), `adminMock.ts` (`ADMIN_USERS_MOCK` Daniel/Anna/Béla, `ADMIN_INVITES_MOCK` one open + one used, `MOCK_TEMP_PASSWORD`), `adminHooks.ts`; `data/me/llmUsageHooks.ts` seeds gained `byUser` (sums to the totals, guarded by test) and `createdBy` on every mock call.

## 5. Integrations

- **← auth (S1)**: `CurrentUser.requireOwner()` is the whole authorization story; `InviteService.create` mints codes; `AuthService.register` consumes them; `MeResponse.role` drives the FE rows; `must_change_password` → `ChangePasswordPage`.
- **→ llmlog**: `LlmUsageController` gate + `byUser`/`userId`; `LlmActorResolver` reads `LlmActorContext`. Contract: `LlmUsageUserGroup`, `LlmCallFilters.userId`.
- **→ S6 (`mezo-qw37.6`)**: `UserFanOut.activeUsers()` wraps each iteration in `LlmActorContext.runAs(user.getId(), …)` — until then background rows stay in the `Háttér` bucket.
- **me**: Beállítások rows; AI-napló chip row (`AiUserFilter`).
- **companion memory observatory**: `GET /api/companion/memory/llm-usage` still aggregates every account's rows without an owner gate — see §9.

## 6. How to use it (consume)

```ts
import { useAdminInvites, useAdminUsers, useAdminActions, useMe } from '@/data/hooks'
const { data: invites, isPending, isError, refetch } = useAdminInvites()   // InviteResponse[]
const { createInvite, deleteInvite, resetPassword, setStatus, pending } = useAdminActions()
const temp = await resetPassword(userId)                                    // string — show it once
if (useMe().data?.role === 'OWNER') { /* render the admin entry */ }
```
Backend: any owner-only endpoint starts with `currentUser.requireOwner()`; any background LLM call that should be attributed runs inside `LlmActorContext.runAs(userId, () -> …)`.

## 7. How to extend it

Contract-first in `admin.yml` → `npm run generate:api` + `pnpm generate:api` → `AdminService` method + `AdminController` override (gate first) → IT in `feature/auth/Admin*IT.java` with `registerUser()` for the USER-403 case → `adminApi` + `useAdminActions` (mock flavor must mutate the cache) → MSW handler → page control → both-mode tests → this doc §2/§4. An expiry picker for invites is a UI-only addition (`expiresInDays` already exists).

## 8. Testing

Backend (`-Dmezo.test.use-testcontainers=true`): `AdminInviteIT` (401, USER→403 on all three ops, mint shape/expiry, used-code name, delete open, 409 used, 404), `AdminUserIT` (USER→403, list order, reset → old password 401 / temp 200 / `mustChangePassword`, 404, disable→403 on `/me`→re-enable, self 409, bad status 400), `LlmUsageControllerIT` (USER→403 on all four reads, `byUser` grouping + background bucket, `userId` list filter), `LlmActorContextTest`, `LlmActorResolverTest`, `ArchitectureTest`. Focused gate: `./mvnw test -Dtest='Admin*,LlmUsage*,LlmActor*,LlmCallList*,ArchitectureTest'`.
Frontend (both `VITE_USE_MOCK=true pnpm test` and `VITE_USE_MOCK=false pnpm test`): `adminHooks.test.tsx`, `BetaAdminPage.test.tsx`, `BeallitasokPage.test.tsx` (owner row / USER hides both rows), `AiUserFilter.test.tsx`, `AiUsagePage.test.tsx` (chip narrows the list), `llmUsageHooks.test.tsx` (`byUser` reconciles, `userId` filter), `hooks.reexport.test.ts`, `dualMode.guard.test.ts`.

## 9. Decisions, gotchas & deferred

- **`costUsd`, not the spec's `costHuf`** — the whole AI-napló is USD (`LlmUsageTotals.currency`); one screen, one currency. HUF conversion is a display concern for later.
- **`byUser` only on the breakdown**, not on `/summary`: the summary feeds the Beállítások one-liner; the chips live on the page that reads the breakdown.
- **Background bucket is not a filter**: `created_by IS NULL` is not expressible through `userId`; shown for honesty (it is usually the biggest spender), YAGNI until someone needs to list it.
- **Owner row never gets a toggle** (also covers mock mode where `mockMe.id ≠ MOCK_OWNER_ID`).
- **Deviation from spec §11**: the spec asks for 409 on the owner's own password reset too, mirroring `ADMIN_SELF_STATUS`; only the status-change guard exists (`resetPassword` has no self-check). Left unguarded deliberately — it is recoverable (the owner receives their own temp password and, since the session-revocation fix, their calling JWT stays valid because it is minted in the same second as the new `tokensValidFrom` watermark), unlike disabling your own account, which locks you out with no recovery path. Guard deferred; would need a contract change (`ADMIN_SELF_RESET` or similar).
- **Temp password is 12 chars from the readable alphabet + lowercase**, `SecureRandom`; the response is the only clear-text copy.
- **`LlmActorContext` is a plain ThreadLocal** — correct because the actor is resolved before the `@Async` audit hop; `CHAT_STREAM` calls completing on reactive threads keep a null actor (pre-existing).
- **`useLlmUsageSummary` still mounts for a USER** on Beállítások and fails silently into the honest empty; gating it on role is a small follow-up.
- **Deferred**: `GET /api/companion/memory/llm-usage` (memory observatory) is still ungated cross-user — the end-to-end `LlmActorContext` cron IT (job call's `created_by` is the user) needs S6's production `runAs` caller (`UserFanOut`), so S3 proves the seam with the resolver unit test only and leaves the cron IT to S6; file a bd issue and gate the memory observatory with `requireOwner()` alongside S6's doc rewrite — the AI-napló entry row in the S2 `EnHubPage` Profil card (if any) should follow the same `isOwner` guard.

## 10. Key files

- Contract: `api/feature/admin/admin.yml`, `api/feature/llm-usage/llm-usage.yml`, `api/generate/merge.yml`
- Backend: `feature/auth/service/AdminService.java`, `feature/auth/controller/AdminController.java`, `feature/llmlog/controller/LlmUsageController.java`, `feature/llmlog/service/{LlmUsageService,LlmActorResolver}.java`, `feature/llmlog/repository/{LlmLogRepository,LlmUserRow,LlmCallRow}.java`, `techcore/security/LlmActorContext.java`, `messages.properties` (`ADMIN_*`)
- Backend tests: `feature/auth/{AdminInviteIT,AdminUserIT}.java`, `feature/llmlog/controller/LlmUsageControllerIT.java`, `feature/llmlog/service/LlmActorResolverTest.java`, `techcore/security/LlmActorContextTest.java`
- Frontend: `data/admin/{adminApi,adminMock,adminHooks}.ts`, `features/me/pages/BetaAdminPage.tsx`, `features/me/components/{AdminInviteRow,AdminUserRow,AiUserFilter}.tsx`, `features/me/sheets/TempPasswordSheet.tsx`, `features/me/pages/{BeallitasokPage,AiUsagePage}.tsx`, `data/me/{llmUsageApi,llmUsageHooks}.ts`, `app/router.tsx`, `test/msw/handlers.ts`
- Docs: this file, `me.md` §2/§3, `_platform-api-backend.md`, `_platform-auth-security.md` (S1/S6), spec §7.

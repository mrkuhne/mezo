# S3 Beta admin + LLM-usage (mezo-qw37.3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the owner an in-app beta admin surface (invite codes, user list, password reset, disable toggle) behind an owner-only `/api/admin/*` contract, put every `/api/llm-usage/*` read behind the same owner gate with a per-user cost breakdown, and add the `LlmActorContext` seam that S6 will wrap the cron fan-out with.

**Architecture:** Admin lives inside `feature/auth` (it only touches `AppUserEntity`/`InviteEntity`, and every feature may depend on auth — ArchUnit): a new `AdminController implements AdminApi` → `AdminService` → the S1 repositories. Every method calls `CurrentUser.requireOwner()` first. `LlmUsageController` injects `CurrentUser` and calls `requireOwner()` per method; the breakdown gains a `byUser` rollup from a new grouped JPQL query that left-joins `AppUserEntity` for the display name, and the call list gains a `userId` filter (so the FE chip narrows the list, not just the header). `LlmActorContext` is a static ThreadLocal holder in `techcore/security`; `LlmActorResolver` falls back to it when there is no JWT principal — cron threads that S6 wraps with `runAs(userId, …)` therefore stamp `created_by`. Frontend: `data/admin/*` dual-mode hooks (mock mutates the query cache, real hits the API) → `BetaAdminPage` (two tabs) reached from a Beállítások row that only renders for `role === 'OWNER'`; `AiUsagePage` gets an `AiUserFilter` chip row fed by `byUser`.

**Tech Stack:** Spring Boot 4 / Spring Security 7, openapi-generator (contract-first), JUnit 5 + Testcontainers ITs, React 19 + TanStack Query 5 + Vitest + MSW.

**Spec:** `docs/superpowers/specs/2026-09-02-multi-user-accounts-design.md` §7 (S1 interfaces §5, terrain §14).

**Depends on S1 (`mezo-qw37.1`) having landed on main** — this plan uses, verbatim from `docs/superpowers/plans/2026-09-02-s1-account-foundation.md`: `InviteEntity {id, code, label, createdBy, createdAt, expiresAt, usedBy, usedAt, isUsed(), isExpired(Instant)}`, `InviteRepository.findAllByOrderByCreatedAtDesc()`, `InviteService.create(UUID createdBy, String label, Instant expiresAt)`, `AppUserEntity.{role: UserRole, status: UserStatus, mustChangePassword, lastSeenAt, onboardedAt, isOwner()}`, `CurrentUser.get()/id()/requireOwner()` (403 `AUTH_FORBIDDEN`), `ApiIntegrationTest.registerUser(String label) : RegisteredUser(id, email, headers)`, FE `useMe()` (`data/auth/authHooks.ts`, re-exported from `@/data/hooks`, `data.role`, `data.id`), `mockMe` (`data/auth/authMock.ts`, role `OWNER`, id `00000000-0000-0000-0000-00000000mock`), `setToken()` from `@/data/_client/api`, and the MSW `/api/auth/me` handler (role `OWNER`).

## Global Constraints

- Contract-first: edit `api/feature/admin/admin.yml` + `api/feature/llm-usage/llm-usage.yml`, register the new fragment in `api/generate/merge.yml`, then `cd api/generate && npm run generate:api` (merges into `api/openapi.yml`), then `cd frontend && pnpm generate:api`. Commit both generated files. Backend Java DTOs regenerate on every Maven build (`target/`, not committed).
- Every non-2xx response references `SystemMessageList`; new error codes go into `backend/src/main/resources/messages.properties` (`{DOMAIN}_{ACTION}_{REASON}`).
- No schema change in S3 (S1 created `invite` and the `app_user` columns; `llm_log_history.created_by` stays nullable).
- ArchUnit (`backend/src/test/java/io/mrkuhne/mezo/ArchitectureTest.java`): `@RestController` in `..controller..`, `@Service` in `..service..`, repositories in `..repository..`; constructor injection only (Lombok `@RequiredArgsConstructor`); no class-level `@Transactional`; no `@Value`; no raw `RuntimeException`/`IllegalStateException`/`IllegalArgumentException` outside `techcore`; every `@RestController` implements a generated `*Api`; feature slices cycle-free (auth may be depended on by anyone, `techcore` depends on no feature).
- Backend focused gate: `cd backend && ./mvnw test -Dtest='Admin*,LlmUsage*,LlmActor*,LlmCallList*,ArchitectureTest' -Dmezo.test.use-testcontainers=true` (Surefire matches simple class names — every new backend test class in this plan starts with `Admin`, `LlmUsage` or `LlmActor`).
- Frontend gate: both `VITE_USE_MOCK=true pnpm test` and `VITE_USE_MOCK=false pnpm test` (unset = mock!), then `pnpm build`.
- Docs: `node scripts/gen-codemap.mjs` and commit `docs/CODEMAP.md`; `node scripts/lint-docs.mjs --errors-only`.
- Conventional commits carry the bd id: `feat(admin): … (mezo-qw37.3)`. Branch: `feat/multi-user-s3-beta-admin`.
- Hungarian UI copy; routed leaves are `*Page`; sheets in `sheets/`; hooks consumed only via `@/data/hooks`; `isMockMode()` called inside hook/component bodies, never at module scope; dual-mode reads via `useDualQuery` (never the seed as a real-mode fallback — `dualMode.guard.test.ts` enforces it).
- Cost currency: the existing rollups use `costUsd` + `currency` (`LlmUsageGroup`, `LlmUsageTotals`). The spec's `byUser.costHuf` is **deliberately not introduced** — `byUser` follows the existing `callCount`/`costUsd` convention so one screen never shows two currencies (spec deviation, recorded in §9 of the feature doc).

---

## File Structure

**Contract**
- Create: `api/feature/admin/admin.yml` — tag `Admin` → `AdminApi` → `AdminController` (6 operations).
- Modify: `api/generate/merge.yml` (append the fragment), `api/feature/llm-usage/llm-usage.yml` (`byUser` on the breakdown, `userId` filter + `createdBy` on the list).
- Regenerate: `api/openapi.yml`, `frontend/src/data/_client/api.gen.ts`.

**Backend — create**
- `backend/src/main/java/io/mrkuhne/mezo/feature/auth/service/AdminService.java` — invites (create/list/delete), users (list/reset/status), temp-password generator.
- `backend/src/main/java/io/mrkuhne/mezo/feature/auth/controller/AdminController.java`
- `backend/src/main/java/io/mrkuhne/mezo/feature/llmlog/repository/LlmUserRow.java` — per-user rollup projection.
- `backend/src/main/java/io/mrkuhne/mezo/techcore/security/LlmActorContext.java` — static ThreadLocal `runAs`/`current`.
- Tests: `feature/auth/AdminInviteIT.java`, `feature/auth/AdminUserIT.java`, `feature/llmlog/controller/LlmUsageControllerIT.java`, `techcore/security/LlmActorContextTest.java`, `feature/llmlog/service/LlmActorResolverTest.java`.

**Backend — modify**
- `backend/src/main/resources/messages.properties` (`ADMIN_INVITE_NOT_FOUND`, `ADMIN_INVITE_USED`, `ADMIN_USER_NOT_FOUND`, `ADMIN_SELF_STATUS`)
- `feature/llmlog/controller/LlmUsageController.java` (`requireOwner()` per method), `feature/llmlog/service/LlmUsageService.java` (`byUser`, `userId` filter), `feature/llmlog/repository/LlmLogRepository.java` (`aggregateByUserSince`, `findCalls(+userId)`), `feature/llmlog/repository/LlmCallRow.java` (+`createdBy`), `feature/llmlog/service/LlmActorResolver.java` (context fallback).

**Frontend — create**
- `frontend/src/data/admin/adminApi.ts`, `adminMock.ts`, `adminHooks.ts` (+ `adminHooks.test.tsx`)
- `frontend/src/features/me/pages/BetaAdminPage.tsx` (+ `.test.tsx`), `frontend/src/features/me/components/AdminInviteRow.tsx`, `AdminUserRow.tsx`, `AiUserFilter.tsx` (+ `.test.tsx`), `frontend/src/features/me/sheets/TempPasswordSheet.tsx`.

**Frontend — modify**
- `frontend/src/data/hooks.ts` (+ `hooks.reexport.test.ts`), `frontend/src/test/msw/handlers.ts` (admin handlers), `frontend/src/data/me/llmUsageApi.ts` (`userId` filter), `frontend/src/data/me/llmUsageHooks.ts` (`byUser` seed, `createdBy` on calls, mock `userId` filter) + `.test.tsx`, `frontend/src/features/me/pages/AiUsagePage.tsx` (chip row), `frontend/src/features/me/pages/BeallitasokPage.tsx` (+ `.test.tsx`, owner-only row), `frontend/src/app/router.tsx` (`me/beallitasok/admin`).

**Docs**
- Create: `docs/features/beta-admin.md` (10-section feature doc). Modify: `docs/features/README.md` (index + feature→doc map rows), `docs/features/me.md` §2/§3 (AI-napló owner gate + per-user chips), `docs/features/_platform-api-backend.md` (admin rows; "ungated" → "owner-gated" on the four llm-usage rows), `docs/CODEMAP.md` (regenerated).

---

### Task 1: Contract — `admin.yml`, llm-usage `byUser` + `userId` filter, regenerate

**Files:**
- Create: `api/feature/admin/admin.yml`
- Modify: `api/generate/merge.yml`, `api/feature/llm-usage/llm-usage.yml`
- Regenerate: `api/openapi.yml`, `frontend/src/data/_client/api.gen.ts`

**Interfaces:**
- Produces generated Java `io.mrkuhne.mezo.api.controller.AdminApi` with `createInvite(CreateInviteRequest) : InviteResponse`, `listInvites() : List<InviteResponse>`, `deleteInvite(UUID) : void`, `listUsers() : List<AdminUserResponse>`, `resetPassword(UUID) : ResetPasswordResponse`, `setStatus(UUID, SetUserStatusRequest) : void`; DTOs `CreateInviteRequest{label?, expiresInDays?}`, `InviteResponse{id, code, label?, createdAt, expiresAt?, usedBy?, usedByName?, usedAt?}`, `AdminUserResponse{id, email, name, role, status, createdAt, onboardedAt?, lastSeenAt?}`, `ResetPasswordResponse{temporaryPassword}`, `SetUserStatusRequest{status}`.
- Produces `LlmUsageBreakdownResponse.byUser : List<LlmUsageUserGroup{userId?, name?, callCount, totalTokens, costUsd?}>`, `LlmUsageApi.listLlmCalls(period, feature, status, callKind, userId, limit)` (new `userId` param before `limit`), `LlmCallListItem.createdBy?`.

- [ ] **Step 1: Create `api/feature/admin/admin.yml`**

```yaml
openapi: 3.0.3
info: { title: mezo admin fragment, version: 1.0.0 }
tags:
  - name: Admin
    description: Beta admin (mezo-qw37.3) — invite codes and account management, every operation OWNER-only (403 AUTH_FORBIDDEN otherwise)
paths:
  /api/admin/invites:
    post:
      tags: [Admin]
      operationId: createInvite
      summary: Mint a one-shot invite code (Admin)
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/CreateInviteRequest' }
      responses:
        '200':
          description: The new code, shown once in full on the admin page
          content:
            application/json:
              schema: { $ref: '#/components/schemas/InviteResponse' }
        '400':
          description: Validation failure
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
        '403':
          description: Not the owner (AUTH_FORBIDDEN)
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
    get:
      tags: [Admin]
      operationId: listInvites
      summary: Every invite, open and used, newest first (Admin)
      responses:
        '200':
          description: Invites newest first
          content:
            application/json:
              schema:
                type: array
                items: { $ref: '#/components/schemas/InviteResponse' }
        '403':
          description: Not the owner (AUTH_FORBIDDEN)
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
  /api/admin/invites/{id}:
    delete:
      tags: [Admin]
      operationId: deleteInvite
      summary: Revoke an unused invite (Admin)
      parameters:
        - name: id
          in: path
          required: true
          schema: { type: string, format: uuid }
      responses:
        '204':
          description: Revoked
        '403':
          description: Not the owner (AUTH_FORBIDDEN)
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
        '404':
          description: Unknown invite (ADMIN_INVITE_NOT_FOUND)
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
        '409':
          description: Already used — the registration it produced must stay traceable (ADMIN_INVITE_USED)
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
  /api/admin/users:
    get:
      tags: [Admin]
      operationId: listUsers
      summary: Every account, oldest first (Admin)
      responses:
        '200':
          description: Accounts
          content:
            application/json:
              schema:
                type: array
                items: { $ref: '#/components/schemas/AdminUserResponse' }
        '403':
          description: Not the owner (AUTH_FORBIDDEN)
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
  /api/admin/users/{id}/reset-password:
    post:
      tags: [Admin]
      operationId: resetPassword
      summary: Replace the account's password with a temporary one and force a change at next login (Admin)
      parameters:
        - name: id
          in: path
          required: true
          schema: { type: string, format: uuid }
      responses:
        '200':
          description: The temporary password — returned exactly once, never stored in clear
          content:
            application/json:
              schema: { $ref: '#/components/schemas/ResetPasswordResponse' }
        '403':
          description: Not the owner (AUTH_FORBIDDEN)
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
        '404':
          description: Unknown account (ADMIN_USER_NOT_FOUND)
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
  /api/admin/users/{id}/status:
    post:
      tags: [Admin]
      operationId: setStatus
      summary: Enable or disable an account; a disabled account is rejected on its next request (Admin)
      parameters:
        - name: id
          in: path
          required: true
          schema: { type: string, format: uuid }
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/SetUserStatusRequest' }
      responses:
        '204':
          description: Status set
        '400':
          description: Validation failure
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
        '403':
          description: Not the owner (AUTH_FORBIDDEN)
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
        '404':
          description: Unknown account (ADMIN_USER_NOT_FOUND)
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
        '409':
          description: The owner cannot change their own status (ADMIN_SELF_STATUS)
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
components:
  schemas:
    CreateInviteRequest:
      type: object
      properties:
        label:
          type: string
          maxLength: 120
          nullable: true
          description: who the code is meant for — free text, shown in the list
          example: Csaba
        expiresInDays:
          type: integer
          format: int32
          minimum: 1
          maximum: 365
          nullable: true
          description: omitted = never expires
    InviteResponse:
      type: object
      required: [id, code, createdAt]
      properties:
        id: { type: string, format: uuid }
        code: { type: string, example: MEZO-7KQ2-XN4P }
        label: { type: string, nullable: true }
        createdAt: { type: string, format: date-time }
        expiresAt: { type: string, format: date-time, nullable: true }
        usedBy: { type: string, format: uuid, nullable: true }
        usedByName: { type: string, nullable: true, description: "display name of the account that consumed the code" }
        usedAt: { type: string, format: date-time, nullable: true }
    AdminUserResponse:
      type: object
      required: [id, email, name, role, status, createdAt]
      properties:
        id: { type: string, format: uuid }
        email: { type: string }
        name: { type: string }
        role: { type: string, description: OWNER or USER }
        status: { type: string, description: ACTIVE or DISABLED }
        createdAt: { type: string, format: date-time }
        onboardedAt: { type: string, format: date-time, nullable: true }
        lastSeenAt: { type: string, format: date-time, nullable: true, description: "stamped at most every 5 minutes by CurrentUser" }
    ResetPasswordResponse:
      type: object
      required: [temporaryPassword]
      properties:
        temporaryPassword: { type: string, description: "12 readable characters; must_change_password is set on the account" }
    SetUserStatusRequest:
      type: object
      required: [status]
      properties:
        status: { type: string, pattern: '^(ACTIVE|DISABLED)$' }
```

- [ ] **Step 2: Register the fragment in `api/generate/merge.yml`**

Append after the `diagnosis.yml` line:

```yaml
  - inputFile: ../feature/admin/admin.yml
```

- [ ] **Step 3: Extend `api/feature/llm-usage/llm-usage.yml`**

In `/api/llm-usage/calls` `get.parameters`, insert BEFORE the `limit` parameter:

```yaml
        - name: userId
          in: query
          required: false
          description: only calls made by this account (created_by); background rows (null owner) never match
          schema: { type: string, format: uuid }
```

Update the tag description (top of file) to end with: `— every operation OWNER-only since mezo-qw37.3 (403 AUTH_FORBIDDEN)`; and add to every operation's `responses` a `'403'` block identical to the admin fragment's (`description: Not the owner (AUTH_FORBIDDEN)`, `SystemMessageList`).

In `LlmUsageBreakdownResponse` change `required: [from, totals, features, models]` → `required: [from, totals, features, models, byUser]` and add after `models`:

```yaml
        byUser:
          type: array
          description: "one entry per calling account, cost-descending (unpriced last); the null-user entry is the background (cron/stream) traffic"
          items: { $ref: '#/components/schemas/LlmUsageUserGroup' }
```

Add the schema after `LlmUsageGroup`:

```yaml
    LlmUsageUserGroup:
      type: object
      required: [callCount, totalTokens]
      properties:
        userId: { type: string, format: uuid, nullable: true, description: "null = background traffic with no principal" }
        name: { type: string, nullable: true, description: "app_user.name; null for background traffic or a deleted account" }
        callCount: { type: integer, format: int64 }
        totalTokens: { type: integer, format: int64, description: "sum of total_tokens over the rows that reported it" }
        costUsd: { type: number, format: double, nullable: true }
```

In `LlmCallListItem.properties` add after `createdAt`:

```yaml
        createdBy: { type: string, format: uuid, nullable: true, description: "null for background (cron/stream) calls" }
```

- [ ] **Step 4: Regenerate and verify**

Run:
```bash
cd api/generate && npm run generate:api && cd ../../frontend && pnpm generate:api && cd ../backend && ./mvnw -q generate-sources && ls target/generated-sources/openapi/src/main/java/io/mrkuhne/mezo/api/controller/ | grep AdminApi && grep -n "LlmUsageUserGroup" ../frontend/src/data/_client/api.gen.ts | head -1
```
Expected: `AdminApi.java` listed; the FE type exists. (`./mvnw compile` fails until Tasks 2–4 implement `AdminApi` and the new `listLlmCalls` signature — expected.)

- [ ] **Step 5: Commit**

```bash
git add api/feature/admin/admin.yml api/generate/merge.yml api/feature/llm-usage/llm-usage.yml api/openapi.yml frontend/src/data/_client/api.gen.ts
git commit -m "feat(api): admin contract + llm-usage byUser rollup, userId filter, owner-only 403s (mezo-qw37.3)"
```

---
### Task 2: `AdminService` + `AdminController` — invites (create / list / delete)

**Files:**
- Modify: `backend/src/main/resources/messages.properties`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/auth/service/AdminService.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/auth/controller/AdminController.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/auth/AdminInviteIT.java`

**Interfaces:**
- Consumes: `InviteService.create(UUID, String, Instant)`, `InviteRepository.findAllByOrderByCreatedAtDesc()`, `CurrentUser.requireOwner()`, `ApiIntegrationTest.registerUser(label)`.
- Produces: `AdminService.createInvite(AppUserEntity owner, CreateInviteRequest) : InviteResponse`, `listInvites() : List<InviteResponse>`, `deleteInvite(UUID)`, and the user methods `listUsers()`, `resetPassword(UUID) : ResetPasswordResponse`, `setStatus(AppUserEntity actor, UUID, SetUserStatusRequest)` (the user methods are fully implemented here and tested in Task 3 — one class, one commit per test cycle).

- [ ] **Step 1: Add message codes**

Append to `messages.properties` after `PEOPLE_CANDIDATE_ALREADY_DECIDED`:

```properties
ADMIN_INVITE_NOT_FOUND=A meghívó nem található.
ADMIN_INVITE_USED=Ezt a meghívót már felhasználták, nem törölhető.
ADMIN_USER_NOT_FOUND=A felhasználó nem található.
ADMIN_SELF_STATUS=A saját fiókod státuszát nem változtathatod meg.
```

- [ ] **Step 2: Write the failing invite IT**

`backend/src/test/java/io/mrkuhne/mezo/feature/auth/AdminInviteIT.java`:

```java
package io.mrkuhne.mezo.feature.auth;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.CreateInviteRequest;
import io.mrkuhne.mezo.api.dto.InviteResponse;
import io.mrkuhne.mezo.api.dto.RegisterRequest;
import io.mrkuhne.mezo.api.dto.TokenResponse;
import io.mrkuhne.mezo.feature.auth.repository.InviteRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.time.OffsetDateTime;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;

/** /api/admin/invites (mezo-qw37.3): owner-only minting, listing and revoking of invite codes. */
class AdminInviteIT extends ApiIntegrationTest {

    private static final String URI = "/api/admin/invites";

    @Autowired private InviteRepository inviteRepository;

    @Test
    void testInvites_shouldReturn401_whenNoToken() {
        getForBody(URI, null, HttpStatus.UNAUTHORIZED, Void.class);
    }

    @Test
    void testInvites_shouldReturn403_whenCallerIsUser() {
        RegisteredUser anna = registerUser("Anna");
        String body = getForBody(URI, anna.headers(), HttpStatus.FORBIDDEN, String.class);
        assertHasRequestError(body, "AUTH_FORBIDDEN");
        String create = postForBody(URI, new CreateInviteRequest("x", null), anna.headers(), HttpStatus.FORBIDDEN, String.class);
        assertHasRequestError(create, "AUTH_FORBIDDEN");
        deleteAndExpect(URI + "/" + java.util.UUID.randomUUID(), anna.headers(), HttpStatus.FORBIDDEN);
    }

    @Test
    void testCreateInvite_shouldMintReadableCodeWithExpiry_whenOwner() {
        InviteResponse invite = postForBody(URI, new CreateInviteRequest("Csaba", 7), ownerAuthHeaders(),
            HttpStatus.OK, InviteResponse.class);

        assertThat(invite.getCode()).matches("MEZO-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}");
        assertThat(invite.getLabel()).isEqualTo("Csaba");
        assertThat(invite.getExpiresAt()).isAfter(OffsetDateTime.now().plusDays(6));
        assertThat(invite.getUsedBy()).isNull();
        assertThat(inviteRepository.findById(invite.getId())).isPresent();
    }

    @Test
    void testListInvites_shouldShowConsumerName_whenCodeWasUsed() {
        InviteResponse open = postForBody(URI, new CreateInviteRequest(null, null), ownerAuthHeaders(), HttpStatus.OK, InviteResponse.class);
        InviteResponse used = postForBody(URI, new CreateInviteRequest("Béla", null), ownerAuthHeaders(), HttpStatus.OK, InviteResponse.class);
        postForBody("/api/auth/register", new RegisterRequest(used.getCode(), "bela-admin@test.local", "teszt-jelszo-1", "Béla"),
            null, HttpStatus.OK, TokenResponse.class);

        List<InviteResponse> invites = getForList(URI, ownerAuthHeaders(), HttpStatus.OK, InviteResponse.class);

        // newest first: the used one was minted second
        assertThat(invites).extracting(InviteResponse::getId).containsExactly(used.getId(), open.getId());
        assertThat(invites.getFirst().getUsedByName()).isEqualTo("Béla");
        assertThat(invites.getFirst().getUsedAt()).isNotNull();
        assertThat(invites.get(1).getUsedBy()).isNull();
    }

    @Test
    void testDeleteInvite_shouldRemoveOpenCode_whenOwner() {
        InviteResponse open = postForBody(URI, new CreateInviteRequest(null, null), ownerAuthHeaders(), HttpStatus.OK, InviteResponse.class);
        deleteAndExpect(URI + "/" + open.getId(), ownerAuthHeaders(), HttpStatus.NO_CONTENT);
        assertThat(inviteRepository.findById(open.getId())).isEmpty();
    }

    @Test
    void testDeleteInvite_shouldReturn409_whenCodeAlreadyUsed() {
        InviteResponse used = postForBody(URI, new CreateInviteRequest(null, null), ownerAuthHeaders(), HttpStatus.OK, InviteResponse.class);
        postForBody("/api/auth/register", new RegisterRequest(used.getCode(), "used-admin@test.local", "teszt-jelszo-1", "Dóra"),
            null, HttpStatus.OK, TokenResponse.class);

        String body = exchangeForBody(org.springframework.http.HttpMethod.DELETE, URI + "/" + used.getId(), null,
            ownerAuthHeaders(), HttpStatus.CONFLICT, String.class);
        assertHasRequestError(body, "ADMIN_INVITE_USED");
        assertThat(inviteRepository.findById(used.getId())).isPresent();
    }

    @Test
    void testDeleteInvite_shouldReturn404_whenUnknown() {
        String body = exchangeForBody(org.springframework.http.HttpMethod.DELETE, URI + "/" + java.util.UUID.randomUUID(), null,
            ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);
        assertHasRequestError(body, "ADMIN_INVITE_NOT_FOUND");
    }
}
```

(Check the generated `CreateInviteRequest` all-args constructor order — `(label, expiresInDays)` per the schema's property order; use the builder if the order differs.)

- [ ] **Step 3: Run to verify it fails**

Run: `cd backend && ./mvnw test -Dtest='AdminInviteIT' -Dmezo.test.use-testcontainers=true`
Expected: compilation error — `AdminApi` not implemented (no `AdminController`).

- [ ] **Step 4: Implement `AdminService`**

```java
package io.mrkuhne.mezo.feature.auth.service;

import io.mrkuhne.mezo.api.dto.AdminUserResponse;
import io.mrkuhne.mezo.api.dto.CreateInviteRequest;
import io.mrkuhne.mezo.api.dto.InviteResponse;
import io.mrkuhne.mezo.api.dto.ResetPasswordResponse;
import io.mrkuhne.mezo.api.dto.SetUserStatusRequest;
import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.auth.entity.InviteEntity;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.auth.repository.InviteRepository;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Beta admin (mezo-qw37.3): invite codes and account management for the OWNER. Authorization is
 * the controller's job ({@code CurrentUser.requireOwner()} on every entry point) — this service
 * assumes an owner is calling and only enforces the domain rules (used codes are immutable
 * history, the owner cannot lock themselves out).
 */
@Service
@RequiredArgsConstructor
public class AdminService {

    /** Same readable alphabet as invite codes plus lowercase — a temp password is read out loud too. */
    static final String PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    static final int PASSWORD_LENGTH = 12;
    private static final SecureRandom RANDOM = new SecureRandom();

    private final InviteService inviteService;
    private final InviteRepository inviteRepository;
    private final AppUserRepository appUserRepository;
    private final PasswordEncoder passwordEncoder;

    // ── invites ──────────────────────────────────────────────────────────────────

    @Transactional
    public InviteResponse createInvite(AppUserEntity owner, CreateInviteRequest request) {
        Instant expiresAt = request.getExpiresInDays() == null
            ? null
            : Instant.now().plus(request.getExpiresInDays(), ChronoUnit.DAYS);
        InviteEntity invite = inviteService.create(owner.getId(), blankToNull(request.getLabel()), expiresAt);
        return toResponse(invite, Map.of());
    }

    @Transactional(readOnly = true)
    public List<InviteResponse> listInvites() {
        List<InviteEntity> invites = inviteRepository.findAllByOrderByCreatedAtDesc();
        List<UUID> consumerIds = invites.stream().map(InviteEntity::getUsedBy).filter(Objects::nonNull).toList();
        Map<UUID, String> names = appUserRepository.findAllById(consumerIds).stream()
            .collect(Collectors.toMap(AppUserEntity::getId, AppUserEntity::getName));
        return invites.stream().map(i -> toResponse(i, names)).toList();
    }

    @Transactional
    public void deleteInvite(UUID id) {
        InviteEntity invite = inviteRepository.findById(id)
            .orElseThrow(() -> new SystemRuntimeErrorException(
                SystemMessage.error("ADMIN_INVITE_NOT_FOUND").build(), HttpStatus.NOT_FOUND));
        if (invite.isUsed()) {
            throw new SystemRuntimeErrorException(
                SystemMessage.error("ADMIN_INVITE_USED").build(), HttpStatus.CONFLICT);
        }
        inviteRepository.delete(invite);
    }

    // ── users ────────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<AdminUserResponse> listUsers() {
        return appUserRepository.findAll().stream()
            .sorted(Comparator.comparing(AppUserEntity::getCreatedAt))
            .map(AdminService::toResponse)
            .toList();
    }

    /** The temp password exists in clear only in this response — the row stores the BCrypt hash. */
    @Transactional
    public ResetPasswordResponse resetPassword(UUID id) {
        AppUserEntity user = requireUser(id);
        String temporary = generateTemporaryPassword();
        user.setPasswordHash(passwordEncoder.encode(temporary));
        user.setMustChangePassword(true);
        appUserRepository.save(user);
        return ResetPasswordResponse.builder().temporaryPassword(temporary).build();
    }

    @Transactional
    public void setStatus(AppUserEntity actor, UUID id, SetUserStatusRequest request) {
        if (actor.getId().equals(id)) {
            throw new SystemRuntimeErrorException(
                SystemMessage.error("ADMIN_SELF_STATUS").build(), HttpStatus.CONFLICT);
        }
        AppUserEntity user = requireUser(id);
        user.setStatus(AppUserEntity.UserStatus.valueOf(request.getStatus())); // contract pattern guarantees the value
        appUserRepository.save(user);
    }

    static String generateTemporaryPassword() {
        StringBuilder sb = new StringBuilder(PASSWORD_LENGTH);
        for (int i = 0; i < PASSWORD_LENGTH; i++) {
            sb.append(PASSWORD_ALPHABET.charAt(RANDOM.nextInt(PASSWORD_ALPHABET.length())));
        }
        return sb.toString();
    }

    private AppUserEntity requireUser(UUID id) {
        return appUserRepository.findById(id)
            .orElseThrow(() -> new SystemRuntimeErrorException(
                SystemMessage.error("ADMIN_USER_NOT_FOUND").build(), HttpStatus.NOT_FOUND));
    }

    private static InviteResponse toResponse(InviteEntity i, Map<UUID, String> names) {
        return InviteResponse.builder()
            .id(i.getId())
            .code(i.getCode())
            .label(i.getLabel())
            .createdAt(at(i.getCreatedAt()))
            .expiresAt(at(i.getExpiresAt()))
            .usedBy(i.getUsedBy())
            .usedByName(i.getUsedBy() == null ? null : names.get(i.getUsedBy()))
            .usedAt(at(i.getUsedAt()))
            .build();
    }

    private static AdminUserResponse toResponse(AppUserEntity u) {
        return AdminUserResponse.builder()
            .id(u.getId())
            .email(u.getEmail())
            .name(u.getName())
            .role(u.getRole().name())
            .status(u.getStatus().name())
            .createdAt(at(u.getCreatedAt()))
            .onboardedAt(at(u.getOnboardedAt()))
            .lastSeenAt(at(u.getLastSeenAt()))
            .build();
    }

    private static OffsetDateTime at(Instant instant) {
        return instant == null ? null : instant.atOffset(ZoneOffset.UTC);
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
```

- [ ] **Step 5: Implement `AdminController`**

```java
package io.mrkuhne.mezo.feature.auth.controller;

import io.mrkuhne.mezo.api.controller.AdminApi;
import io.mrkuhne.mezo.api.dto.AdminUserResponse;
import io.mrkuhne.mezo.api.dto.CreateInviteRequest;
import io.mrkuhne.mezo.api.dto.InviteResponse;
import io.mrkuhne.mezo.api.dto.ResetPasswordResponse;
import io.mrkuhne.mezo.api.dto.SetUserStatusRequest;
import io.mrkuhne.mezo.feature.auth.service.AdminService;
import io.mrkuhne.mezo.feature.auth.service.CurrentUser;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.RestController;

/** /api/admin surface (mezo-qw37.3) — every method starts with the owner gate. */
@RestController
@RequiredArgsConstructor
public class AdminController implements AdminApi {

    private final AdminService adminService;
    private final CurrentUser currentUser;

    @Override
    public InviteResponse createInvite(CreateInviteRequest request) {
        return adminService.createInvite(currentUser.requireOwner(), request);
    }

    @Override
    public List<InviteResponse> listInvites() {
        currentUser.requireOwner();
        return adminService.listInvites();
    }

    @Override
    public void deleteInvite(UUID id) {
        currentUser.requireOwner();
        adminService.deleteInvite(id);
    }

    @Override
    public List<AdminUserResponse> listUsers() {
        currentUser.requireOwner();
        return adminService.listUsers();
    }

    @Override
    public ResetPasswordResponse resetPassword(UUID id) {
        currentUser.requireOwner();
        return adminService.resetPassword(id);
    }

    @Override
    public void setStatus(UUID id, SetUserStatusRequest request) {
        adminService.setStatus(currentUser.requireOwner(), id, request);
    }
}
```

- [ ] **Step 6: Run to verify it passes**

Run: `cd backend && ./mvnw test -Dtest='AdminInviteIT,ArchitectureTest' -Dmezo.test.use-testcontainers=true`
Expected: PASS (7 + ArchUnit). `LlmUsageController` still compiles because the generated `LlmUsageApi.listLlmCalls` signature changed — if the compiler complains, apply Task 4 Step 4's controller change now (the `userId` parameter pass-through) and keep going.

- [ ] **Step 7: Commit**

```bash
git add backend/src/main/resources/messages.properties backend/src/main/java/io/mrkuhne/mezo/feature/auth/service/AdminService.java backend/src/main/java/io/mrkuhne/mezo/feature/auth/controller/AdminController.java backend/src/test/java/io/mrkuhne/mezo/feature/auth/AdminInviteIT.java
git commit -m "feat(admin): AdminService/AdminController — owner-only invite mint/list/revoke (mezo-qw37.3)"
```

---

### Task 3: Admin users — list, reset password, set status (ITs)

**Files:**
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/auth/AdminUserIT.java`
- (Implementation already in Task 2's `AdminService`/`AdminController`; this task proves it and fixes whatever the IT reveals.)

**Interfaces:**
- Consumes: `AdminService.listUsers()/resetPassword()/setStatus()`, `AuthService` login via `/api/auth/login`, `/api/auth/me` (`MeResponse.mustChangePassword`), `AppUserEntity.UserStatus`.

- [ ] **Step 1: Write the failing user IT**

`backend/src/test/java/io/mrkuhne/mezo/feature/auth/AdminUserIT.java`:

```java
package io.mrkuhne.mezo.feature.auth;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.AdminUserResponse;
import io.mrkuhne.mezo.api.dto.LoginRequest;
import io.mrkuhne.mezo.api.dto.MeResponse;
import io.mrkuhne.mezo.api.dto.ResetPasswordResponse;
import io.mrkuhne.mezo.api.dto.SetUserStatusRequest;
import io.mrkuhne.mezo.api.dto.TokenResponse;
import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;

/** /api/admin/users (mezo-qw37.3): owner-only list, temp-password reset, enable/disable. */
class AdminUserIT extends ApiIntegrationTest {

    private static final String URI = "/api/admin/users";

    @Autowired private AppUserRepository appUserRepository;

    private UUID ownerId() {
        return appUserRepository.findByEmail("owner@mezo.local").orElseThrow().getId();
    }

    @Test
    void testUsers_shouldReturn403_whenCallerIsUser() {
        RegisteredUser anna = registerUser("Anna");
        assertHasRequestError(getForBody(URI, anna.headers(), HttpStatus.FORBIDDEN, String.class), "AUTH_FORBIDDEN");
        assertHasRequestError(postForBody(URI + "/" + anna.id() + "/reset-password", null, anna.headers(),
            HttpStatus.FORBIDDEN, String.class), "AUTH_FORBIDDEN");
        assertHasRequestError(postForBody(URI + "/" + anna.id() + "/status", new SetUserStatusRequest("DISABLED"),
            anna.headers(), HttpStatus.FORBIDDEN, String.class), "AUTH_FORBIDDEN");
    }

    @Test
    void testListUsers_shouldListOwnerFirstThenRegistered_whenOwner() {
        RegisteredUser anna = registerUser("Anna");
        List<AdminUserResponse> users = getForList(URI, ownerAuthHeaders(), HttpStatus.OK, AdminUserResponse.class);

        assertThat(users.getFirst().getRole()).isEqualTo("OWNER");
        AdminUserResponse annaRow = users.stream().filter(u -> u.getId().equals(anna.id())).findFirst().orElseThrow();
        assertThat(annaRow.getName()).isEqualTo("Anna");
        assertThat(annaRow.getStatus()).isEqualTo("ACTIVE");
        assertThat(annaRow.getOnboardedAt()).isNull();
        assertThat(annaRow.getLastSeenAt()).isNull(); // registration mints a token but makes no protected call
    }

    @Test
    void testResetPassword_shouldInvalidateOldAndForceChange_whenOwner() {
        RegisteredUser anna = registerUser("Anna");
        ResetPasswordResponse reset = postForBody(URI + "/" + anna.id() + "/reset-password", null, ownerAuthHeaders(),
            HttpStatus.OK, ResetPasswordResponse.class);
        assertThat(reset.getTemporaryPassword()).hasSize(12).matches("[A-HJ-NP-Za-hj-km-np-z2-9]+");

        // registerUser's password is "teszt-jelszo-1" (S1 helper) — it must no longer log in
        assertHasRequestError(postForBody("/api/auth/login", new LoginRequest(anna.email(), "teszt-jelszo-1"), null,
            HttpStatus.UNAUTHORIZED, String.class), "AUTH_LOGIN_INVALID_CREDENTIALS");

        TokenResponse token = postForBody("/api/auth/login", new LoginRequest(anna.email(), reset.getTemporaryPassword()),
            null, HttpStatus.OK, TokenResponse.class);
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token.getToken());
        MeResponse me = getForBody("/api/auth/me", headers, HttpStatus.OK, MeResponse.class);
        assertThat(me.getMustChangePassword()).isTrue();
    }

    @Test
    void testResetPassword_shouldReturn404_whenUnknownUser() {
        assertHasRequestError(postForBody(URI + "/" + UUID.randomUUID() + "/reset-password", null, ownerAuthHeaders(),
            HttpStatus.NOT_FOUND, String.class), "ADMIN_USER_NOT_FOUND");
    }

    @Test
    void testSetStatus_shouldDisableAndReenable_whenOwner() {
        RegisteredUser anna = registerUser("Anna");
        postForBody(URI + "/" + anna.id() + "/status", new SetUserStatusRequest("DISABLED"), ownerAuthHeaders(),
            HttpStatus.NO_CONTENT, Void.class);
        assertThat(appUserRepository.findById(anna.id()).orElseThrow().getStatus()).isEqualTo(AppUserEntity.UserStatus.DISABLED);
        // the disabled account's still-valid JWT is rejected by CurrentUser on its next request (S1)
        assertHasRequestError(getForBody("/api/auth/me", anna.headers(), HttpStatus.FORBIDDEN, String.class), "AUTH_ACCOUNT_DISABLED");

        postForBody(URI + "/" + anna.id() + "/status", new SetUserStatusRequest("ACTIVE"), ownerAuthHeaders(),
            HttpStatus.NO_CONTENT, Void.class);
        getForBody("/api/auth/me", anna.headers(), HttpStatus.OK, MeResponse.class);
    }

    @Test
    void testSetStatus_shouldReturn409_whenOwnerTargetsSelf() {
        String body = postForBody(URI + "/" + ownerId() + "/status", new SetUserStatusRequest("DISABLED"), ownerAuthHeaders(),
            HttpStatus.CONFLICT, String.class);
        assertHasRequestError(body, "ADMIN_SELF_STATUS");
        assertThat(appUserRepository.findById(ownerId()).orElseThrow().getStatus()).isEqualTo(AppUserEntity.UserStatus.ACTIVE);
    }

    @Test
    void testSetStatus_shouldReturn400_whenStatusUnknown() {
        RegisteredUser anna = registerUser("Anna");
        String body = postForBody(URI + "/" + anna.id() + "/status", new SetUserStatusRequest("BANNED"), ownerAuthHeaders(),
            HttpStatus.BAD_REQUEST, String.class);
        assertHasFieldError(body, "status", "VALIDATION_INVALID_VALUE");
    }
}
```

- [ ] **Step 2: Run to verify**

Run: `cd backend && ./mvnw test -Dtest='AdminUserIT' -Dmezo.test.use-testcontainers=true`
Expected: PASS on a correct Task 2. Likely first failures and their fixes: (a) `assertHasFieldError` naming — if the generated field error's `fieldName` is `status` but the handler reports `setStatus.request.status`, assert on the code only with `assertThat(body).contains("VALIDATION_INVALID_VALUE")`; (b) `lastSeenAt` not null because `registerUser` calls `/api/auth/me` — then drop that assertion line.

- [ ] **Step 3: Commit**

```bash
git add backend/src/test/java/io/mrkuhne/mezo/feature/auth/AdminUserIT.java
git commit -m "test(admin): user list, temp-password reset, status toggle + self-status 409 (mezo-qw37.3)"
```

---
### Task 4: LLM-usage — owner gate, `byUser` rollup, `userId` list filter

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/llmlog/repository/LlmUserRow.java`
- Modify: `feature/llmlog/repository/LlmCallRow.java`, `feature/llmlog/repository/LlmLogRepository.java`, `feature/llmlog/service/LlmUsageService.java`, `feature/llmlog/controller/LlmUsageController.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/llmlog/controller/LlmUsageControllerIT.java`

**Interfaces:**
- Consumes: `CurrentUser.requireOwner()`, `LlmLogPopulator.log(createdBy, kind, feature, model, prompt, candidates, snapshot, cost)`, `registerUser`.
- Produces: `LlmLogRepository.aggregateByUserSince(Instant) : List<LlmUserRow>`, `findCalls(since, feature, status, callKind, userId, pageable)`, `LlmUsageService.listCalls(period, feature, status, callKind, userId, limit)`, `LlmUsageBreakdownResponse.byUser`.

- [ ] **Step 1: Write the failing IT**

```java
package io.mrkuhne.mezo.feature.llmlog.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import io.mrkuhne.mezo.api.dto.LlmCallListResponse;
import io.mrkuhne.mezo.api.dto.LlmUsageBreakdownResponse;
import io.mrkuhne.mezo.api.dto.LlmUsageUserGroup;
import io.mrkuhne.mezo.feature.llmlog.entity.CallKind;
import io.mrkuhne.mezo.feature.llmlog.entity.PricingSnapshot;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.LlmLogPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;

/**
 * mezo-qw37.3: every /api/llm-usage read is OWNER-only (the log holds every account's prompts),
 * the breakdown carries a per-account rollup, and the list can be narrowed to one account.
 */
class LlmUsageControllerIT extends ApiIntegrationTest {

    @Autowired private LlmLogPopulator llmLogPopulator;

    @Test
    void testEveryRead_shouldReturn403_whenCallerIsUser() {
        RegisteredUser anna = registerUser("Anna");
        for (String uri : new String[] {
            "/api/llm-usage/summary",
            "/api/llm-usage/breakdown?period=DAY",
            "/api/llm-usage/calls?period=DAY",
            "/api/llm-usage/calls/" + java.util.UUID.randomUUID()}) {
            String body = getForBody(uri, anna.headers(), HttpStatus.FORBIDDEN, String.class);
            assertHasRequestError(body, "AUTH_FORBIDDEN");
        }
    }

    @Test
    void testGetBreakdown_shouldGroupByUserWithNameAndBackgroundBucket_whenMixedRows() {
        RegisteredUser anna = registerUser("Anna");
        llmLogPopulator.log(anna.id(), CallKind.CHAT, "companion_chat", "gemini-2.5-flash", 1_000, 100, snapshot(), new BigDecimal("0.010000"));
        llmLogPopulator.log(anna.id(), CallKind.CHAT, "meal_coach", "gemini-2.5-flash", 500, 50, snapshot(), new BigDecimal("0.002000"));
        llmLogPopulator.log(null, CallKind.CHAT, "proactive_briefing", "gemini-2.5-flash", 9_000, 500, snapshot(), new BigDecimal("0.030000"));

        LlmUsageBreakdownResponse body = getForBody("/api/llm-usage/breakdown?period=DAY", ownerAuthHeaders(),
            HttpStatus.OK, LlmUsageBreakdownResponse.class);

        assertThat(body.getByUser()).hasSize(2);
        // cost-descending: the background bucket (0.03) precedes Anna (0.012)
        LlmUsageUserGroup background = body.getByUser().getFirst();
        assertThat(background.getUserId()).isNull();
        assertThat(background.getName()).isNull();
        assertThat(background.getCallCount()).isEqualTo(1);
        LlmUsageUserGroup annaGroup = body.getByUser().get(1);
        assertThat(annaGroup.getUserId()).isEqualTo(anna.id());
        assertThat(annaGroup.getName()).isEqualTo("Anna");
        assertThat(annaGroup.getCallCount()).isEqualTo(2);
        assertThat(annaGroup.getTotalTokens()).isEqualTo(1_650);
        assertThat(annaGroup.getCostUsd()).isEqualTo(0.012, within(1e-9));
    }

    @Test
    void testListCalls_shouldNarrowToOneAccount_whenUserIdGiven() {
        RegisteredUser anna = registerUser("Anna");
        RegisteredUser bela = registerUser("Béla");
        llmLogPopulator.log(anna.id(), CallKind.CHAT, "companion_chat", "gemini-2.5-flash", 10, 5);
        llmLogPopulator.log(bela.id(), CallKind.CHAT, "companion_chat", "gemini-2.5-flash", 10, 5);
        llmLogPopulator.log(null, CallKind.CHAT, "proactive_briefing", "gemini-2.5-flash", 10, 5);

        LlmCallListResponse all = getForBody("/api/llm-usage/calls?period=DAY", ownerAuthHeaders(), HttpStatus.OK, LlmCallListResponse.class);
        assertThat(all.getItems()).hasSize(3);
        assertThat(all.getItems()).extracting(i -> i.getCreatedBy()).containsExactlyInAnyOrder(anna.id(), bela.id(), null);

        LlmCallListResponse onlyAnna = getForBody("/api/llm-usage/calls?period=DAY&userId=" + anna.id(), ownerAuthHeaders(),
            HttpStatus.OK, LlmCallListResponse.class);
        assertThat(onlyAnna.getItems()).singleElement().satisfies(i -> assertThat(i.getCreatedBy()).isEqualTo(anna.id()));
    }

    private static PricingSnapshot snapshot() {
        return new PricingSnapshot("gemini-2.5-flash", "USD",
            new BigDecimal("0.30"), new BigDecimal("2.50"), new BigDecimal("2.50"),
            new BigDecimal("0.075"), null, LocalDate.now());
    }
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && ./mvnw test -Dtest='LlmUsageControllerIT' -Dmezo.test.use-testcontainers=true`
Expected: compilation error (`LlmUsageController` does not implement the new `listLlmCalls` signature) or, once compiled, 200 instead of 403.

- [ ] **Step 3: Repository — `LlmUserRow`, `LlmCallRow.createdBy`, the two queries**

`repository/LlmUserRow.java`:

```java
package io.mrkuhne.mezo.feature.llmlog.repository;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Per-account rollup over {@code llm_log_history} (mezo-qw37.3). {@code userId == null} is the
 * background bucket (cron/stream rows with no principal); {@code name} is null there and for a
 * deleted account ({@code created_by} is {@code on delete set null}).
 */
public record LlmUserRow(UUID userId, String name, long callCount, long totalTokens, BigDecimal costUsd) {}
```

`repository/LlmCallRow.java`: add `UUID createdBy` as the **second** component (after `id`), keeping every other component in place. Update the class javadoc with one line: "`createdBy` (mezo-qw37.3) — the calling account, null for background rows."

`LlmLogRepository.java` — add after `aggregateByModelSince`:

```java
    /**
     * Per-account rollup (mezo-qw37.3). Ad-hoc left join onto {@code AppUserEntity} for the display
     * name — there is no JPA association from the audit row to the account on purpose (the row must
     * outlive the account). Background rows group under a null user.
     */
    @Query("""
        select new io.mrkuhne.mezo.feature.llmlog.repository.LlmUserRow(
            l.createdBy, u.name, count(l), coalesce(sum(l.totalTokens), 0L), sum(l.costUsd))
        from LlmLogEntity l
        left join AppUserEntity u on u.id = l.createdBy
        where l.createdAt >= :since
        group by l.createdBy, u.name
        """)
    List<LlmUserRow> aggregateByUserSince(@Param("since") Instant since);
```

Change `findCalls`: the constructor expression becomes `l.id, l.createdBy, l.createdAt, …` (matching the new record order), the `where` gains `and (:userId is null or l.createdBy = :userId)` after the `callKind` line, and the signature gains `@Param("userId") UUID userId` before `Pageable pageable`. Add `import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;` is NOT needed (JPQL references the entity by name), so no cross-package import appears in the repository.

- [ ] **Step 4: Service + controller**

`LlmUsageService.java`:
- `breakdown(...)`: add `.byUser(userGroups(llmLogRepository.aggregateByUserSince(since)))` after `.models(...)`.
- `listCalls` signature → `listCalls(String rawPeriod, String feature, String rawStatus, String rawCallKind, UUID userId, Integer rawLimit)`; pass `userId` into `findCalls` before the `PageRequest`.
- `toListItem`: add `.createdBy(row.createdBy())` after `.id(row.id())`.
- Add the helper next to `groups(...)`:

```java
    /** Same ordering rule as {@link #groups}: cost-descending, unpriced last, then call count. */
    private List<LlmUsageUserGroup> userGroups(List<LlmUserRow> rows) {
        return rows.stream()
            .sorted(Comparator
                .comparing(LlmUserRow::costUsd, Comparator.nullsLast(Comparator.reverseOrder()))
                .thenComparing(Comparator.comparingLong(LlmUserRow::callCount).reversed()))
            .map(r -> LlmUsageUserGroup.builder()
                .userId(r.userId())
                .name(r.name())
                .callCount(r.callCount())
                .totalTokens(r.totalTokens())
                .costUsd(toDouble(r.costUsd()))
                .build())
            .toList();
    }
```
(imports: `io.mrkuhne.mezo.api.dto.LlmUsageUserGroup`, `io.mrkuhne.mezo.feature.llmlog.repository.LlmUserRow`.) Replace the class javadoc paragraph "Reads the whole table … 'all rows' IS 'my rows'." with: "Reads the whole table, not the caller's slice: cron- and async-written rows have a null `created_by`, so an ownership filter would hide exactly the volume that costs the most. Since mezo-qw37.3 the surface is OWNER-only (the controller gates it) and the per-account split is reported explicitly via `byUser`."

`LlmUsageController.java` — inject `CurrentUser` and gate every method:

```java
package io.mrkuhne.mezo.feature.llmlog.controller;

import io.mrkuhne.mezo.api.controller.LlmUsageApi;
import io.mrkuhne.mezo.api.dto.LlmCallDetailResponse;
import io.mrkuhne.mezo.api.dto.LlmCallListResponse;
import io.mrkuhne.mezo.api.dto.LlmUsageBreakdownResponse;
import io.mrkuhne.mezo.api.dto.LlmUsageSummaryResponse;
import io.mrkuhne.mezo.feature.auth.service.CurrentUser;
import io.mrkuhne.mezo.feature.llmlog.service.LlmUsageService;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.RestController;

/**
 * /api/llm-usage surface (mezo-h3gb) — mappings come from the generated {@link LlmUsageApi}.
 *
 * <p>Deliberately NOT behind {@code mezo.feature.llm-log.enabled}: the switch governs whether calls
 * are RECORDED, while reading the history stays available either way.
 *
 * <p>OWNER-only since mezo-qw37.3: the log holds every account's prompts and responses, so the
 * rollup and the payloads are an admin view, gated per method by {@link CurrentUser#requireOwner()}.
 */
@RestController
@RequiredArgsConstructor
public class LlmUsageController implements LlmUsageApi {

    private final LlmUsageService service;
    private final CurrentUser currentUser;

    @Override
    public LlmUsageSummaryResponse getLlmUsageSummary() {
        currentUser.requireOwner();
        return service.summary();
    }

    @Override
    public LlmUsageBreakdownResponse getLlmUsageBreakdown(String period) {
        currentUser.requireOwner();
        return service.breakdown(period);
    }

    @Override
    public LlmCallListResponse listLlmCalls(String period, String feature, String status,
                                            String callKind, UUID userId, Integer limit) {
        currentUser.requireOwner();
        return service.listCalls(period, feature, status, callKind, userId, limit);
    }

    @Override
    public LlmCallDetailResponse getLlmCall(UUID id) {
        currentUser.requireOwner();
        return service.call(id);
    }
}
```

(Verify the generated parameter order with `grep -n "listLlmCalls" backend/target/generated-sources/openapi/src/main/java/io/mrkuhne/mezo/api/controller/LlmUsageApi.java` — the generator emits query parameters in contract order, which is why `userId` was inserted before `limit`.)

- [ ] **Step 5: Run the llmlog read ITs**

Run: `cd backend && ./mvnw test -Dtest='LlmUsage*,LlmCallList*,LlmCallDetailIT,ArchitectureTest' -Dmezo.test.use-testcontainers=true`
Expected: PASS. If Postgres answers `could not determine data type of parameter` for the null `userId` binding, change the predicate to `(:userId is null or l.createdBy = cast(:userId as uuid))` — the same null-parameter idiom the String filters already use, with the cast making the type explicit for the UUID column. `LlmCallListIT` still passes: it asserts on the list projection's existing fields only.

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/llmlog backend/src/test/java/io/mrkuhne/mezo/feature/llmlog/controller/LlmUsageControllerIT.java
git commit -m "feat(llmlog): owner-only llm-usage reads, byUser rollup, userId list filter (mezo-qw37.3)"
```

---

### Task 5: `LlmActorContext` (techcore) + `LlmActorResolver` fallback

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/techcore/security/LlmActorContext.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/llmlog/service/LlmActorResolver.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/techcore/security/LlmActorContextTest.java`, `backend/src/test/java/io/mrkuhne/mezo/feature/llmlog/service/LlmActorResolverTest.java`

**Interfaces:**
- Produces: `LlmActorContext.runAs(UUID userId, Runnable body)` (nests, always restores), `LlmActorContext.current() : UUID | null`. S6's `UserFanOut` wraps each per-user cron iteration in `runAs(user.getId(), () -> job.runFor(user))`; nothing in S3 calls `runAs` in production code.

- [ ] **Step 1: Write the failing unit tests**

`techcore/security/LlmActorContextTest.java`:

```java
package io.mrkuhne.mezo.techcore.security;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;

class LlmActorContextTest {

    @Test
    void testCurrent_shouldBeNull_whenOutsideRunAs() {
        assertThat(LlmActorContext.current()).isNull();
    }

    @Test
    void testRunAs_shouldExposeActorInsideAndRestoreAfter_whenNested() {
        UUID outer = UUID.randomUUID();
        UUID inner = UUID.randomUUID();
        AtomicReference<UUID> seenInner = new AtomicReference<>();
        AtomicReference<UUID> seenAfterInner = new AtomicReference<>();

        LlmActorContext.runAs(outer, () -> {
            LlmActorContext.runAs(inner, () -> seenInner.set(LlmActorContext.current()));
            seenAfterInner.set(LlmActorContext.current());
        });

        assertThat(seenInner.get()).isEqualTo(inner);
        assertThat(seenAfterInner.get()).isEqualTo(outer);
        assertThat(LlmActorContext.current()).isNull();
    }

    @Test
    void testRunAs_shouldClear_whenBodyThrows() {
        UUID id = UUID.randomUUID();
        try {
            LlmActorContext.runAs(id, () -> { throw new IllegalStateException("boom"); });
        } catch (IllegalStateException expected) {
            // the exception propagates — the context must not swallow it
        }
        assertThat(LlmActorContext.current()).isNull();
    }

    @Test
    void testRunAs_shouldNotLeakAcrossThreads_whenSet() throws InterruptedException {
        UUID id = UUID.randomUUID();
        AtomicReference<UUID> seenOnOtherThread = new AtomicReference<>(id);
        LlmActorContext.runAs(id, () -> {
            Thread t = new Thread(() -> seenOnOtherThread.set(LlmActorContext.current()));
            t.start();
            try { t.join(); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
        });
        assertThat(seenOnOtherThread.get()).isNull();
    }
}
```

`feature/llmlog/service/LlmActorResolverTest.java`:

```java
package io.mrkuhne.mezo.feature.llmlog.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.techcore.security.LlmActorContext;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.context.SecurityContextHolder;

/** No security context in a plain unit test — exactly the cron thread's situation. */
class LlmActorResolverTest {

    private final LlmActorResolver resolver = new LlmActorResolver();

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void testCurrentActor_shouldBeNull_whenNoPrincipalAndNoContext() {
        assertThat(resolver.currentActor()).isNull();
    }

    @Test
    void testCurrentActor_shouldReadLlmActorContext_whenNoPrincipal() {
        UUID id = UUID.randomUUID();
        AtomicReference<UUID> seen = new AtomicReference<>();
        LlmActorContext.runAs(id, () -> seen.set(resolver.currentActor()));
        assertThat(seen.get()).isEqualTo(id);
        assertThat(resolver.currentActor()).isNull();
    }
}
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd backend && ./mvnw test -Dtest='LlmActorContextTest,LlmActorResolverTest'`
Expected: compilation error — `LlmActorContext` missing.

- [ ] **Step 3: Implement `LlmActorContext`**

```java
package io.mrkuhne.mezo.techcore.security;

import java.util.UUID;

/**
 * The acting account on a thread that has NO request principal (mezo-qw37.3).
 *
 * <p>Cron jobs fan out over accounts and make LLM calls on the scheduler thread, where
 * {@code SecurityContextHolder} is empty; the audit log's {@code created_by} would stay null and
 * every per-account cost report would lump that traffic into the background bucket. The fan-out
 * (S6, {@code UserFanOut}) wraps each per-account iteration in {@link #runAs}, and
 * {@code LlmActorResolver} reads {@link #current()} when the JWT principal is absent.
 *
 * <p>Plain ThreadLocal, on purpose: the recorder resolves the actor on the CALLING thread before
 * the async audit hop, so no propagation into executors is needed. Nesting restores the previous
 * value; a throwing body still restores. Never leaks across threads.
 */
public final class LlmActorContext {

    private static final ThreadLocal<UUID> CURRENT = new ThreadLocal<>();

    private LlmActorContext() {}

    /** The account the current thread acts for, or null when nothing set it. */
    public static UUID current() {
        return CURRENT.get();
    }

    /** Runs {@code body} with {@code userId} as the acting account, then restores the previous value. */
    public static void runAs(UUID userId, Runnable body) {
        UUID previous = CURRENT.get();
        CURRENT.set(userId);
        try {
            body.run();
        } finally {
            if (previous == null) {
                CURRENT.remove();
            } else {
                CURRENT.set(previous);
            }
        }
    }
}
```

- [ ] **Step 4: Fall back in `LlmActorResolver`**

Replace the `currentActor()` body's early `return null;` with `return LlmActorContext.current();` (both the "no authentication / not a Jwt / no subject" branch and the `catch (IllegalArgumentException)` branch), add `import io.mrkuhne.mezo.techcore.security.LlmActorContext;`, and extend the javadoc's last sentence: "…returns null instead — unless the thread runs inside `LlmActorContext.runAs` (mezo-qw37.3), in which case that account is the actor; a request principal always wins over the context."

- [ ] **Step 5: Run to verify they pass, plus the existing recorder test and ArchUnit**

Run: `cd backend && ./mvnw test -Dtest='LlmActor*,EventPublishingLlmCallRecorderTest,ArchitectureTest'`
Expected: PASS (`techcore` gained a class with no feature import, so the dependency rules are untouched).

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/techcore/security/LlmActorContext.java backend/src/main/java/io/mrkuhne/mezo/feature/llmlog/service/LlmActorResolver.java backend/src/test/java/io/mrkuhne/mezo/techcore/security/LlmActorContextTest.java backend/src/test/java/io/mrkuhne/mezo/feature/llmlog/service/LlmActorResolverTest.java
git commit -m "feat(techcore): LlmActorContext ThreadLocal + LlmActorResolver fallback for principal-less threads (mezo-qw37.3)"
```

---
### Task 6: Frontend — `adminApi`, `adminMock`, `adminHooks`, MSW handlers, barrel export

**Files:**
- Create: `frontend/src/data/admin/adminApi.ts`, `frontend/src/data/admin/adminMock.ts`, `frontend/src/data/admin/adminHooks.ts`
- Modify: `frontend/src/data/hooks.ts`, `frontend/src/data/hooks.reexport.test.ts`, `frontend/src/test/msw/handlers.ts`
- Test: `frontend/src/data/admin/adminHooks.test.tsx`

**Interfaces:**
- Produces: `useAdminInvites()` → `{ data: InviteResponse[], isPending, isError, refetch }`, `useAdminUsers()` → `{ data: AdminUserResponse[], … }`, `useAdminActions()` → `{ createInvite(label?: string): Promise<InviteResponse>, deleteInvite(id): Promise<void>, resetPassword(id): Promise<string>, setStatus(id, status): Promise<void> }`; seeds `ADMIN_USERS_MOCK` (3 users), `ADMIN_INVITES_MOCK` (2 codes), `MOCK_OWNER_ID = '00000000-0000-4000-8000-000000000001'`, `MOCK_ANNA_ID = '…0002'`, `MOCK_BELA_ID = '…0003'`; query keys `ADMIN_INVITES_KEY = ['admin', 'invites']`, `ADMIN_USERS_KEY = ['admin', 'users']`.

- [ ] **Step 1: Write the failing hook tests**

`adminHooks.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { makeHookWrapper } from '@/test/queryWrapper'
import { useAdminInvites, useAdminUsers, useAdminActions } from '@/data/admin/adminHooks'
import { ADMIN_INVITES_MOCK, ADMIN_USERS_MOCK, MOCK_BELA_ID } from '@/data/admin/adminMock'

afterEach(() => vi.unstubAllEnvs())

describe('admin hooks (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))

  it('serves the seeds synchronously', () => {
    const wrapper = makeHookWrapper()
    expect(renderHook(() => useAdminInvites(), { wrapper }).result.current.data).toEqual(ADMIN_INVITES_MOCK)
    expect(renderHook(() => useAdminUsers(), { wrapper }).result.current.data).toEqual(ADMIN_USERS_MOCK)
  })

  it('createInvite prepends a fresh readable code to the cache without touching the network', async () => {
    const wrapper = makeHookWrapper()
    const invites = renderHook(() => useAdminInvites(), { wrapper })
    const actions = renderHook(() => useAdminActions(), { wrapper })
    await act(async () => { await actions.result.current.createInvite('Csaba') })
    expect(invites.result.current.data).toHaveLength(ADMIN_INVITES_MOCK.length + 1)
    expect(invites.result.current.data[0].code).toMatch(/^MEZO-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/)
    expect(invites.result.current.data[0].label).toBe('Csaba')
  })

  it('deleteInvite removes the row; setStatus flips it; resetPassword yields the demo password', async () => {
    const wrapper = makeHookWrapper()
    const invites = renderHook(() => useAdminInvites(), { wrapper })
    const users = renderHook(() => useAdminUsers(), { wrapper })
    const actions = renderHook(() => useAdminActions(), { wrapper })
    await act(async () => { await actions.result.current.deleteInvite(ADMIN_INVITES_MOCK[0].id) })
    expect(invites.result.current.data.map((i) => i.id)).not.toContain(ADMIN_INVITES_MOCK[0].id)
    await act(async () => { await actions.result.current.setStatus(MOCK_BELA_ID, 'ACTIVE') })
    expect(users.result.current.data.find((u) => u.id === MOCK_BELA_ID)?.status).toBe('ACTIVE')
    let pw = ''
    await act(async () => { pw = await actions.result.current.resetPassword(MOCK_BELA_ID) })
    expect(pw).toHaveLength(12)
  })
})

describe('admin hooks (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))

  it('starts from honest empties, then fetches both lists', async () => {
    const wrapper = makeHookWrapper()
    const invites = renderHook(() => useAdminInvites(), { wrapper })
    const users = renderHook(() => useAdminUsers(), { wrapper })
    expect(invites.result.current.data).toEqual([])
    expect(users.result.current.data).toEqual([])
    await waitFor(() => expect(invites.result.current.data).toHaveLength(ADMIN_INVITES_MOCK.length))
    await waitFor(() => expect(users.result.current.data).toHaveLength(ADMIN_USERS_MOCK.length))
  })

  it('createInvite POSTs the label and resetPassword returns the server password', async () => {
    let posted: unknown = null
    server.use(
      http.post(`${API_BASE}/api/admin/invites`, async ({ request }) => {
        posted = await request.json()
        return HttpResponse.json({ ...ADMIN_INVITES_MOCK[0], id: 'new-id', code: 'MEZO-AAAA-BBBB', label: 'Csaba' })
      }),
      http.post(`${API_BASE}/api/admin/users/:id/reset-password`, () => HttpResponse.json({ temporaryPassword: 'Xk3pQ9rT2mWn' })),
    )
    const { result } = renderHook(() => useAdminActions(), { wrapper: makeHookWrapper() })
    let created
    await act(async () => { created = await result.current.createInvite('Csaba') })
    expect(posted).toEqual({ label: 'Csaba', expiresInDays: null })
    expect(created).toMatchObject({ code: 'MEZO-AAAA-BBBB' })
    let pw = ''
    await act(async () => { pw = await result.current.resetPassword(MOCK_BELA_ID) })
    expect(pw).toBe('Xk3pQ9rT2mWn')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && VITE_USE_MOCK=false pnpm test src/data/admin/`
Expected: FAIL — modules missing.

- [ ] **Step 3: Implement `adminApi.ts`**

```ts
import { apiFetch } from '@/data/_client/api'
import type { components } from '@/data/_client/api.gen'

// Beta admin (mezo-qw37.3) — OWNER-only; every call answers 403 AUTH_FORBIDDEN for a USER,
// which apiFetch surfaces as ApiError and the mutation cache toasts.
export type InviteResponse = components['schemas']['InviteResponse']
export type AdminUserResponse = components['schemas']['AdminUserResponse']
export type CreateInviteRequest = components['schemas']['CreateInviteRequest']
export type SetUserStatusRequest = components['schemas']['SetUserStatusRequest']
type ResetPasswordResponse = components['schemas']['ResetPasswordResponse']

export type UserStatus = 'ACTIVE' | 'DISABLED'

export const adminApi = {
  listInvites: (): Promise<InviteResponse[]> => apiFetch<InviteResponse[]>('/api/admin/invites'),
  createInvite: (label: string | null): Promise<InviteResponse> =>
    apiFetch<InviteResponse>('/api/admin/invites', {
      method: 'POST',
      body: JSON.stringify({ label, expiresInDays: null } satisfies CreateInviteRequest),
    }),
  deleteInvite: (id: string): Promise<void> => apiFetch<void>(`/api/admin/invites/${id}`, { method: 'DELETE' }),
  listUsers: (): Promise<AdminUserResponse[]> => apiFetch<AdminUserResponse[]>('/api/admin/users'),
  resetPassword: async (id: string): Promise<string> =>
    (await apiFetch<ResetPasswordResponse>(`/api/admin/users/${id}/reset-password`, { method: 'POST' })).temporaryPassword,
  setStatus: (id: string, status: UserStatus): Promise<void> =>
    apiFetch<void>(`/api/admin/users/${id}/status`, {
      method: 'POST',
      body: JSON.stringify({ status } satisfies SetUserStatusRequest),
    }),
}
```

- [ ] **Step 4: Implement `adminMock.ts`**

```ts
import type { AdminUserResponse, InviteResponse } from '@/data/admin/adminApi'

// Mock-mode admin seed (spec §7): 2–3 fictive accounts + 2 codes. The owner id matches
// LLM_CALL_DETAIL_MOCK.createdBy so the AI-napló per-user chips and this list agree.
export const MOCK_OWNER_ID = '00000000-0000-4000-8000-000000000001'
export const MOCK_ANNA_ID = '00000000-0000-4000-8000-000000000002'
export const MOCK_BELA_ID = '00000000-0000-4000-8000-000000000003'

export const ADMIN_USERS_MOCK: AdminUserResponse[] = [
  { id: MOCK_OWNER_ID, email: 'daniel@mezo.local', name: 'Daniel', role: 'OWNER', status: 'ACTIVE',
    createdAt: '2026-06-01T08:00:00Z', onboardedAt: '2026-06-01T08:00:00Z', lastSeenAt: '2026-08-14T12:32:00Z' },
  { id: MOCK_ANNA_ID, email: 'anna@test.local', name: 'Anna', role: 'USER', status: 'ACTIVE',
    createdAt: '2026-08-02T18:20:00Z', onboardedAt: '2026-08-02T18:35:00Z', lastSeenAt: '2026-08-14T07:10:00Z' },
  { id: MOCK_BELA_ID, email: 'bela@test.local', name: 'Béla', role: 'USER', status: 'DISABLED',
    createdAt: '2026-08-05T09:00:00Z', onboardedAt: null, lastSeenAt: null },
]

export const ADMIN_INVITES_MOCK: InviteResponse[] = [
  { id: 'a1111111-1111-4111-8111-111111111111', code: 'MEZO-7KQ2-XN4P', label: 'Csaba',
    createdAt: '2026-08-13T10:00:00Z', expiresAt: '2026-09-12T10:00:00Z', usedBy: null, usedByName: null, usedAt: null },
  { id: 'a2222222-2222-4222-8222-222222222222', code: 'MEZO-B3RT-9WQA', label: 'Anna',
    createdAt: '2026-08-01T10:00:00Z', expiresAt: null, usedBy: MOCK_ANNA_ID, usedByName: 'Anna', usedAt: '2026-08-02T18:20:00Z' },
]

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
/** Client-side code for mock mode only — the real code is minted by InviteService. */
export function mockInviteCode(): string {
  const pick = () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]
  const block = () => pick() + pick() + pick() + pick()
  return `MEZO-${block()}-${block()}`
}

export const MOCK_TEMP_PASSWORD = 'Teszt-Jelszo'
```

- [ ] **Step 5: Implement `adminHooks.ts`**

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { isMockMode } from '@/data/_client/mode'
import { DEFAULT_QUERY_STALE_TIME_MS, useDualQuery } from '@/data/useDualQuery'
import { adminApi, type AdminUserResponse, type InviteResponse, type UserStatus } from '@/data/admin/adminApi'
import { ADMIN_INVITES_MOCK, ADMIN_USERS_MOCK, MOCK_TEMP_PASSWORD, mockInviteCode } from '@/data/admin/adminMock'

export const ADMIN_INVITES_KEY = ['admin', 'invites'] as const
export const ADMIN_USERS_KEY = ['admin', 'users'] as const

/** Invite list (mezo-qw37.3). Only mounted on BetaAdminPage, which only an OWNER reaches. */
export function useAdminInvites() {
  return useDualQuery<InviteResponse[]>({
    queryKey: ADMIN_INVITES_KEY,
    mockData: ADMIN_INVITES_MOCK,
    realFetch: adminApi.listInvites,
    realEmpty: [],
    realStaleTime: DEFAULT_QUERY_STALE_TIME_MS,
  })
}

export function useAdminUsers() {
  return useDualQuery<AdminUserResponse[]>({
    queryKey: ADMIN_USERS_KEY,
    mockData: ADMIN_USERS_MOCK,
    realFetch: adminApi.listUsers,
    realEmpty: [],
    realStaleTime: DEFAULT_QUERY_STALE_TIME_MS,
  })
}

/**
 * Admin mutations. Mock flavor edits the query cache in place (the demo surface must show the
 * consequence of every button — a code appearing, a row disappearing, a status flipping); real
 * flavor calls the API and invalidates the affected list. Errors are NOT swallowed — the
 * QueryProvider mutation cache toasts them (frontend_conventions §7a).
 */
export function useAdminActions() {
  const qc = useQueryClient()
  const mock = isMockMode()

  const createInvite = useMutation({
    mutationFn: async (label: string | null): Promise<InviteResponse> => {
      if (mock) {
        const invite: InviteResponse = {
          id: crypto.randomUUID(), code: mockInviteCode(), label, createdAt: new Date().toISOString(),
          expiresAt: null, usedBy: null, usedByName: null, usedAt: null,
        }
        qc.setQueryData<InviteResponse[]>(ADMIN_INVITES_KEY, (rows) => [invite, ...(rows ?? ADMIN_INVITES_MOCK)])
        return invite
      }
      return adminApi.createInvite(label)
    },
    onSettled: () => { if (!mock) qc.invalidateQueries({ queryKey: ADMIN_INVITES_KEY }) },
  })

  const deleteInvite = useMutation({
    mutationFn: async (id: string) => {
      if (mock) {
        qc.setQueryData<InviteResponse[]>(ADMIN_INVITES_KEY, (rows) => (rows ?? ADMIN_INVITES_MOCK).filter((i) => i.id !== id))
        return
      }
      await adminApi.deleteInvite(id)
    },
    onSettled: () => { if (!mock) qc.invalidateQueries({ queryKey: ADMIN_INVITES_KEY }) },
  })

  const resetPassword = useMutation({
    mutationFn: async (id: string): Promise<string> => (mock ? MOCK_TEMP_PASSWORD : adminApi.resetPassword(id)),
  })

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: UserStatus }) => {
      if (mock) {
        qc.setQueryData<AdminUserResponse[]>(ADMIN_USERS_KEY, (rows) =>
          (rows ?? ADMIN_USERS_MOCK).map((u) => (u.id === id ? { ...u, status } : u)))
        return
      }
      await adminApi.setStatus(id, status)
    },
    onSettled: () => { if (!mock) qc.invalidateQueries({ queryKey: ADMIN_USERS_KEY }) },
  })

  return {
    createInvite: (label?: string) => createInvite.mutateAsync(label?.trim() ? label.trim() : null),
    deleteInvite: (id: string) => deleteInvite.mutateAsync(id),
    resetPassword: (id: string) => resetPassword.mutateAsync(id),
    setStatus: (id: string, status: UserStatus) => setStatus.mutateAsync({ id, status }),
    pending: createInvite.isPending || deleteInvite.isPending || resetPassword.isPending || setStatus.isPending,
  }
}
```

- [ ] **Step 6: Barrel export, re-export test, MSW handlers**

Append to `frontend/src/data/hooks.ts` (after the `useLlmUsageSummary…` line):

```ts
export { useAdminInvites, useAdminUsers, useAdminActions } from '@/data/admin/adminHooks'
```

Append to `frontend/src/data/hooks.reexport.test.ts` (imports at the top, block at the end):

```ts
import { useAdminInvites as useAdminInvitesFromAdminHooks, useAdminActions as useAdminActionsFromAdminHooks } from '@/data/admin/adminHooks'

describe('hooks.ts re-exports the admin hooks (mezo-qw37.3)', () => {
  it('useAdminInvites / useAdminActions are the adminHooks implementations', () => {
    expect(hooks.useAdminInvites).toBe(useAdminInvitesFromAdminHooks)
    expect(hooks.useAdminActions).toBe(useAdminActionsFromAdminHooks)
  })
})
```

In `frontend/src/test/msw/handlers.ts` add the import `import { ADMIN_INVITES_MOCK, ADMIN_USERS_MOCK } from '@/data/admin/adminMock'` next to the `notificationPrefSeed` import, and after the `/api/llm-usage/summary` handler add:

```ts
  // Beta admin (mezo-qw37.3) — populated defaults mirroring the mock seed; tests override with
  // server.use() to capture payloads. The 403 USER path is a backend concern (AdminInviteIT).
  http.get(`${API_BASE}/api/admin/invites`, () => HttpResponse.json(ADMIN_INVITES_MOCK)),
  http.post(`${API_BASE}/api/admin/invites`, async ({ request }) => {
    const body = (await request.json()) as { label: string | null }
    return HttpResponse.json({ ...ADMIN_INVITES_MOCK[0], id: 'msw-invite', code: 'MEZO-MSWX-TEST', label: body.label })
  }),
  http.delete(`${API_BASE}/api/admin/invites/:id`, () => new HttpResponse(null, { status: 204 })),
  http.get(`${API_BASE}/api/admin/users`, () => HttpResponse.json(ADMIN_USERS_MOCK)),
  http.post(`${API_BASE}/api/admin/users/:id/reset-password`, () => HttpResponse.json({ temporaryPassword: 'MswTempPw2026' })),
  http.post(`${API_BASE}/api/admin/users/:id/status`, () => new HttpResponse(null, { status: 204 })),
```

- [ ] **Step 7: Run both modes**

Run: `cd frontend && VITE_USE_MOCK=false pnpm test src/data/admin/ src/data/hooks.reexport.test.ts && VITE_USE_MOCK=true pnpm test src/data/admin/ src/data/dualMode.guard.test.ts`
Expected: PASS in both modes; the guard test stays green (no `= SEED` destructure default).

- [ ] **Step 8: Commit**

```bash
git add frontend/src/data/admin frontend/src/data/hooks.ts frontend/src/data/hooks.reexport.test.ts frontend/src/test/msw/handlers.ts
git commit -m "feat(fe): admin data layer — adminApi/adminHooks with mock seed and MSW handlers (mezo-qw37.3)"
```

---
### Task 7: Frontend — `BetaAdminPage` (Meghívók / Felhasználók), `TempPasswordSheet`, route, owner-only Beállítások row

**Files:**
- Create: `frontend/src/features/me/pages/BetaAdminPage.tsx` (+ `.test.tsx`), `frontend/src/features/me/components/AdminInviteRow.tsx`, `frontend/src/features/me/components/AdminUserRow.tsx`, `frontend/src/features/me/sheets/TempPasswordSheet.tsx`
- Modify: `frontend/src/app/router.tsx`, `frontend/src/features/me/pages/BeallitasokPage.tsx` (+ `.test.tsx`)

**Interfaces:**
- Consumes: `useAdminInvites`, `useAdminUsers`, `useAdminActions`, `useMe` (all from `@/data/hooks`), `Sheet`, `Toggle`, `useToast`, Mozaik `MozaikPage/PageHead/PageHero/PageBody`.
- Produces: route `/me/beallitasok/admin`; UI strings asserted by tests: `Beta admin`, `Meghívók`, `Felhasználók`, `Új kód`, `Másolás`, `Törlés`, `Jelszó-reset`, `Ideiglenes jelszó`, `Letiltás: <név>` (toggle aria-label), `Nincs nyitott meghívó.`

- [ ] **Step 1: Write the failing page tests**

`BetaAdminPage.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { QueryWrapper } from '@/test/queryWrapper'
import { setToken } from '@/data/_client/api'
import { BetaAdminPage } from '@/features/me/pages/BetaAdminPage'
import { ADMIN_INVITES_MOCK, MOCK_TEMP_PASSWORD } from '@/data/admin/adminMock'

afterEach(() => { vi.unstubAllEnvs(); setToken(null) })

function renderPage() {
  return render(<MemoryRouter><BetaAdminPage /></MemoryRouter>, { wrapper: QueryWrapper })
}

describe('BetaAdminPage (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))

  it('opens on Meghívók with both seeded codes, the used one labelled with its consumer', () => {
    renderPage()
    expect(screen.getByText('Beta admin')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Meghívók' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('MEZO-7KQ2-XN4P')).toBeInTheDocument()
    expect(screen.getByText(/felhasználta: Anna/)).toBeInTheDocument()
    // a used code cannot be revoked — exactly one Törlés (the open code)
    expect(screen.getAllByRole('button', { name: /Törlés/ })).toHaveLength(1)
  })

  it('mints a new labelled code from the input and shows it on top', async () => {
    renderPage()
    fireEvent.change(screen.getByLabelText('Címke'), { target: { value: 'Csaba' } })
    fireEvent.click(screen.getByRole('button', { name: 'Új kód' }))
    await waitFor(() => expect(screen.getAllByText(/^MEZO-/)).toHaveLength(ADMIN_INVITES_MOCK.length + 1))
    expect(screen.getAllByText('Csaba')[0]).toBeInTheDocument()
  })

  it('revokes the open code', async () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /Törlés/ }))
    await waitFor(() => expect(screen.queryByText('MEZO-7KQ2-XN4P')).toBeNull())
  })

  it('lists the accounts on Felhasználók, resets a password into a sheet, and toggles a status', async () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Felhasználók' }))
    expect(screen.getByText('Anna')).toBeInTheDocument()
    expect(screen.getByText('Béla')).toBeInTheDocument()
    // the owner row has no toggle (self) — two toggles for the two USER rows
    expect(screen.getAllByRole('switch')).toHaveLength(2)
    expect(screen.getByRole('switch', { name: 'Letiltás: Béla' })).toHaveAttribute('aria-checked', 'true')

    fireEvent.click(screen.getByRole('switch', { name: 'Letiltás: Béla' }))
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Letiltás: Béla' })).toHaveAttribute('aria-checked', 'false'))

    fireEvent.click(screen.getAllByRole('button', { name: /Jelszó-reset/ })[0])
    await waitFor(() => expect(screen.getByText('Ideiglenes jelszó')).toBeInTheDocument())
    expect(screen.getByText(MOCK_TEMP_PASSWORD)).toBeInTheDocument()
  })
})

describe('BetaAdminPage (real mode)', () => {
  beforeEach(() => { vi.stubEnv('VITE_USE_MOCK', 'false'); setToken('t') })

  it('renders the MSW lists and POSTs a new code', async () => {
    let posted: unknown = null
    server.use(http.post(`${API_BASE}/api/admin/invites`, async ({ request }) => {
      posted = await request.json()
      return HttpResponse.json({ ...ADMIN_INVITES_MOCK[0], id: 'real-new', code: 'MEZO-REAL-CODE', label: 'Dóra' })
    }))
    renderPage()
    await waitFor(() => expect(screen.getByText('MEZO-7KQ2-XN4P')).toBeInTheDocument())
    fireEvent.change(screen.getByLabelText('Címke'), { target: { value: 'Dóra' } })
    fireEvent.click(screen.getByRole('button', { name: 'Új kód' }))
    await waitFor(() => expect(posted).toEqual({ label: 'Dóra', expiresInDays: null }))
  })

  it('shows the honest empty when there is no invite', async () => {
    server.use(http.get(`${API_BASE}/api/admin/invites`, () => HttpResponse.json([])))
    renderPage()
    await waitFor(() => expect(screen.getByText('Nincs nyitott meghívó.')).toBeInTheDocument())
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && VITE_USE_MOCK=true pnpm test src/features/me/pages/BetaAdminPage`
Expected: FAIL — module missing.

- [ ] **Step 3: `AdminInviteRow.tsx`**

```tsx
import { useToast } from '@/shared/ui/ToastProvider'
import { formatDateTime } from '@/features/me/logic/llmCallFormat'
import type { InviteResponse } from '@/data/admin/adminApi'

// One invite (mezo-qw37.3). A used code is history — no Törlés; the consumer's name is the fact
// that matters. Copy is best-effort: navigator.clipboard is absent under jsdom and on http
// origins, so the button falls back to a toast that just shows the code.

const ROW: React.CSSProperties = { justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', gap: 10 }
const CODE: React.CSSProperties = { fontFamily: 'var(--ff-mono, monospace)', fontSize: 13, fontWeight: 700, letterSpacing: '.04em' }
const BTN: React.CSSProperties = { minHeight: 36, borderRadius: 999, padding: '6px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer', border: '1px solid var(--border-subtle)', background: 'var(--surface-1)' }

export function AdminInviteRow({ invite, onDelete }: { invite: InviteResponse; onDelete: (id: string) => void }) {
  const { show } = useToast()
  const expired = invite.expiresAt != null && new Date(invite.expiresAt).getTime() < Date.now()
  const state = invite.usedAt
    ? `felhasználta: ${invite.usedByName ?? 'ismeretlen'} · ${formatDateTime(invite.usedAt)}`
    : expired ? 'lejárt' : invite.expiresAt ? `lejár: ${formatDateTime(invite.expiresAt)}` : 'nyitott'

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(invite.code)
      show({ kind: 'success', text: 'Kód másolva' })
    } catch {
      show({ kind: 'info', text: invite.code })
    }
  }

  return (
    <div className="card row" style={ROW}>
      <div className="col" style={{ minWidth: 0 }}>
        <span style={CODE}>{invite.code}</span>
        <span className="text-secondary" style={{ fontSize: 11 }}>{invite.label ?? '—'}</span>
        <span className="text-tertiary" style={{ fontSize: 10.5 }}>{state}</span>
      </div>
      <div className="row" style={{ gap: 6, flexShrink: 0 }}>
        {!invite.usedAt && (
          <button type="button" style={BTN} onClick={copy}>Másolás</button>
        )}
        {!invite.usedAt && (
          <button type="button" style={{ ...BTN, color: 'var(--error-deep)' }} aria-label={`Törlés: ${invite.code}`} onClick={() => onDelete(invite.id)}>
            Törlés
          </button>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: `AdminUserRow.tsx`**

```tsx
import { Toggle } from '@/shared/ui/Toggle'
import { formatDateTime } from '@/features/me/logic/llmCallFormat'
import type { AdminUserResponse } from '@/data/admin/adminApi'

// One account (mezo-qw37.3). `self` = the signed-in owner: no status toggle (the backend answers
// 409 ADMIN_SELF_STATUS anyway) — the UI simply does not offer a control that cannot succeed.

const BTN: React.CSSProperties = { minHeight: 36, borderRadius: 999, padding: '6px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer', border: '1px solid var(--border-subtle)', background: 'var(--surface-1)' }

export function AdminUserRow({ user, self, onReset, onToggleStatus }: {
  user: AdminUserResponse
  self: boolean
  onReset: (id: string) => void
  onToggleStatus: (id: string, next: 'ACTIVE' | 'DISABLED') => void
}) {
  const disabled = user.status === 'DISABLED'
  const seen = user.lastSeenAt ? `utoljára: ${formatDateTime(user.lastSeenAt)}` : 'még nem járt itt'
  const onboarding = user.onboardedAt ? '' : ' · onboarding nyitva'
  return (
    <div className="card col" style={{ padding: '10px 12px', gap: 6, opacity: disabled ? 0.7 : 1 }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
        <div className="col" style={{ minWidth: 0 }}>
          <span style={{ fontWeight: 700 }}>{user.name}</span>
          <span className="text-secondary" style={{ fontSize: 11 }}>{user.email}</span>
          <span className="text-tertiary" style={{ fontSize: 10.5 }}>
            {user.role === 'OWNER' ? 'tulajdonos' : disabled ? 'letiltva' : 'aktív'} · {seen}{onboarding}
          </span>
        </div>
        {!self && (
          <Toggle on={disabled} ariaLabel={`Letiltás: ${user.name}`}
            onToggle={() => onToggleStatus(user.id, disabled ? 'ACTIVE' : 'DISABLED')} />
        )}
      </div>
      <div className="row" style={{ gap: 6 }}>
        <button type="button" style={BTN} aria-label={`Jelszó-reset: ${user.name}`} onClick={() => onReset(user.id)}>
          Jelszó-reset
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: `TempPasswordSheet.tsx`**

```tsx
import { Sheet } from '@/shared/ui/Sheet'

// Shows a freshly minted temporary password ONCE (mezo-qw37.3) — the server stores only the
// hash, so closing this sheet is the last time anyone sees it. The owner reads it out to the
// user, who must change it at next login (must_change_password → S1's ChangePasswordPage).
export function TempPasswordSheet({ name, password, onClose }: { name: string; password: string; onClose: () => void }) {
  return (
    <Sheet onClose={onClose} labelledBy="temp-pw-title">
      {(close) => (
        <div className="col gap-sm" style={{ padding: '4px 4px 8px' }}>
          <h2 id="temp-pw-title" style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>Ideiglenes jelszó</h2>
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{name} ezzel lép be legközelebb, és rögtön újat kell választania.</span>
          <div style={{ padding: '12px', background: 'var(--surface-2)', borderRadius: 12, textAlign: 'center', fontFamily: 'var(--ff-mono, monospace)', fontSize: 18, fontWeight: 700, letterSpacing: '.08em', userSelect: 'all' }}>
            {password}
          </div>
          <span style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>Csak most látszik — a szerver csak a hash-t tárolja.</span>
          <button type="button" className="chip" onClick={close} style={{ alignSelf: 'flex-end', minHeight: 40 }}>Megjegyeztem</button>
        </div>
      )}
    </Sheet>
  )
}
```

- [ ] **Step 6: `BetaAdminPage.tsx`**

```tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAdminActions, useAdminInvites, useAdminUsers, useMe } from '@/data/hooks'
import { AdminInviteRow } from '@/features/me/components/AdminInviteRow'
import { AdminUserRow } from '@/features/me/components/AdminUserRow'
import { TempPasswordSheet } from '@/features/me/sheets/TempPasswordSheet'
import { GhostState } from '@/shared/ui/GhostState'
import { MozaikPage, PageBody, PageHead, PageHero } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'

// Beta admin (mezo-qw37.3, spec §7): the owner's minimal console — invite codes and accounts.
// Reached only from the OWNER-only row on BeallitasokPage; the backend gates every call with
// requireOwner() regardless, so a USER deep-linking here sees 403 toasts and empty lists.

type Tab = 'invites' | 'users'
const TABS: { key: Tab; label: string }[] = [
  { key: 'invites', label: 'Meghívók' },
  { key: 'users', label: 'Felhasználók' },
]
const INPUT: React.CSSProperties = { flex: 1, minHeight: 40, borderRadius: 10, border: '1px solid var(--border-subtle)', background: 'var(--surface-1)', padding: '0 12px', fontSize: 13, color: 'var(--text-primary)' }
const PRIMARY: React.CSSProperties = { minHeight: 40, borderRadius: 999, padding: '0 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none', background: 'var(--text-primary)', color: 'var(--surface-1)' }

export function BetaAdminPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('invites')
  const [label, setLabel] = useState('')
  const [reset, setReset] = useState<{ name: string; password: string } | null>(null)

  const me = useMe()
  const invites = useAdminInvites()
  const users = useAdminUsers()
  const actions = useAdminActions()

  const mint = async () => {
    await actions.createInvite(label)
    setLabel('')
  }
  const resetFor = async (id: string) => {
    const name = users.data.find((u) => u.id === id)?.name ?? ''
    const password = await actions.resetPassword(id)
    setReset({ name, password })
  }

  return (
    <MozaikPage tone="lav">
      <PageHead onBack={() => navigate('/me/beallitasok')} label="‹ Beállítások" />
      <PageHero icon="i-emberek" name="Beta admin" sub="meghívók · felhasználók" />
      <PageBody>
        <EntranceGroup className="col gap-md">
          <div className="row rise" style={{ gap: 6, '--d': '0ms' } as React.CSSProperties}>
            {TABS.map((t) => (
              <button key={t.key} type="button" className="chip" aria-pressed={tab === t.key} onClick={() => setTab(t.key)}
                style={tab === t.key ? { background: 'var(--text-primary)', color: 'var(--surface-1)', borderColor: 'transparent' } : undefined}>
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'invites' && (
            <div className="col gap-sm rise" style={{ '--d': '60ms' } as React.CSSProperties}>
              <div className="row" style={{ gap: 8 }}>
                <input aria-label="Címke" placeholder="Kinek szól? (opcionális)" value={label} style={INPUT}
                  onChange={(e) => setLabel(e.target.value)} />
                <button type="button" style={PRIMARY} disabled={actions.pending} onClick={mint}>Új kód</button>
              </div>
              {invites.isError ? (
                <GhostState message="Nem sikerült betölteni a meghívókat." ctaLabel="Újra" onCta={invites.refetch} />
              ) : invites.data.length === 0 ? (
                <GhostState message="Nincs nyitott meghívó." />
              ) : (
                invites.data.map((invite) => (
                  <AdminInviteRow key={invite.id} invite={invite} onDelete={(id) => { void actions.deleteInvite(id) }} />
                ))
              )}
            </div>
          )}

          {tab === 'users' && (
            <div className="col gap-sm rise" style={{ '--d': '60ms' } as React.CSSProperties}>
              {users.isError ? (
                <GhostState message="Nem sikerült betölteni a felhasználókat." ctaLabel="Újra" onCta={users.refetch} />
              ) : users.data.length === 0 ? (
                <GhostState message="Még nincs regisztrált felhasználó." />
              ) : (
                users.data.map((user) => (
                  <AdminUserRow key={user.id} user={user} self={user.id === me.data?.id}
                    onReset={(id) => { void resetFor(id) }}
                    onToggleStatus={(id, next) => { void actions.setStatus(id, next) }} />
                ))
              )}
            </div>
          )}
        </EntranceGroup>
      </PageBody>
      {reset && <TempPasswordSheet name={reset.name} password={reset.password} onClose={() => setReset(null)} />}
    </MozaikPage>
  )
}
```

`self` note: in mock mode `mockMe.id` (`…00000000mock`) differs from `MOCK_OWNER_ID`, so the owner row would get a toggle and the test's "two switches" assertion would fail. Fix at the source: in `AdminUserRow` treat `self || user.role === 'OWNER'` as no-toggle (`{!self && user.role !== 'OWNER' && (<Toggle …/>)}`) — the owner can never be disabled through this UI, which is also what the spec intends ("saját magára 409").

- [ ] **Step 7: Route + Beállítások row**

`frontend/src/app/router.tsx`: import `import { BetaAdminPage } from '@/features/me/pages/BetaAdminPage'` after the `BeallitasokPage` import, and add directly after the `me/beallitasok` route:

```tsx
      // Beta admin (mezo-qw37.3) — OWNER-only row on Beállítások; backend requireOwner() is the real gate.
      { path: 'me/beallitasok/admin', element: <BetaAdminPage /> },
```

`BeallitasokPage.tsx`: change the hooks import to `import { useLlmUsageSummary, useMe, useNotificationPrefs } from '@/data/hooks'`; after the `aiLine` derivation add `const isOwner = useMe().data?.role === 'OWNER'`; widen the `row` helper's icon type to `'i-ertesites' | 'i-erme' | 'i-emberek'`; after the `AI-napló` row add:

```tsx
            {isOwner && row('i-emberek', 'Beta admin', 'meghívók · felhasználók', '/me/beallitasok/admin')}
```

and update the hero `sub` to `"téma · értesítések · AI-napló · admin"`. Wrap the existing AI-napló row in the same `isOwner &&` guard — its reads are owner-only since Task 4, so for a USER it could only ever fail (403 toast + ghost state); a row that cannot succeed must not render. The `aiLine` derivation stays as is: `useLlmUsageSummary` is still mounted for everyone, and for a USER its real-mode fetch fails silently into `LLM_USAGE_EMPTY` — acceptable in S3, noted in the feature doc §9 as a follow-up (gate the query on role).

Append to `BeallitasokPage.test.tsx`:

```tsx
test('mock mode (owner): a Beta admin sor látszik és az admin oldalra visz', async () => {
  renderPage()
  await userEvent.click(screen.getByRole('button', { name: 'Beta admin' }))
  expect(screen.getByTestId('loc')).toHaveTextContent('/me/beallitasok/admin')
})

test('real mode (USER): sem a Beta admin, sem az AI-napló sor nem jelenik meg', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const { setToken } = await import('@/data/_client/api')
  const { http, HttpResponse } = await import('msw')
  const { server } = await import('@/test/msw/server')
  const { API_BASE } = await import('@/test/msw/handlers')
  setToken('t')
  server.use(http.get(`${API_BASE}/api/auth/me`, () => HttpResponse.json({
    id: '00000000-0000-0000-0000-000000000002', email: 'anna@test.local', name: 'Anna',
    role: 'USER', onboarded: true, mustChangePassword: false, timezone: 'Europe/Budapest',
  })))
  renderPage()
  await screen.findByRole('button', { name: 'Értesítések' })
  expect(screen.queryByRole('button', { name: 'Beta admin' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'AI-napló' })).toBeNull()
  setToken(null)
})
```

- [ ] **Step 8: Run both modes**

Run: `cd frontend && VITE_USE_MOCK=true pnpm test src/features/me/pages/BetaAdminPage src/features/me/pages/BeallitasokPage && VITE_USE_MOCK=false pnpm test src/features/me/pages/BetaAdminPage src/features/me/pages/BeallitasokPage`
Expected: PASS in both modes. (If `formatDateTime` throws on a null-free ISO string with `Z`, it is the same helper `AiCallRow` uses — leave it.)

- [ ] **Step 9: Commit**

```bash
git add frontend/src/features/me/pages/BetaAdminPage.tsx frontend/src/features/me/pages/BetaAdminPage.test.tsx frontend/src/features/me/components/AdminInviteRow.tsx frontend/src/features/me/components/AdminUserRow.tsx frontend/src/features/me/sheets/TempPasswordSheet.tsx frontend/src/app/router.tsx frontend/src/features/me/pages/BeallitasokPage.tsx frontend/src/features/me/pages/BeallitasokPage.test.tsx
git commit -m "feat(fe): BetaAdminPage — Meghívók/Felhasználók, temp-password sheet, owner-only Beállítások rows (mezo-qw37.3)"
```

---
### Task 8: Frontend — AI-napló per-user filter chips (`byUser` → `userId`)

**Files:**
- Modify: `frontend/src/data/me/llmUsageApi.ts`, `frontend/src/data/me/llmUsageHooks.ts`, `frontend/src/data/me/llmUsageHooks.test.tsx`, `frontend/src/features/me/pages/AiUsagePage.tsx`, `frontend/src/features/me/pages/AiUsagePage.test.tsx`
- Create: `frontend/src/features/me/components/AiUserFilter.tsx` (+ `.test.tsx`)

**Interfaces:**
- Consumes: generated `LlmUsageUserGroup`, `LlmCallListItem.createdBy`, `MOCK_OWNER_ID`/`MOCK_ANNA_ID` from `adminMock`.
- Produces: `LlmCallFilters.userId?: string`; `LLM_BREAKDOWN_MOCK.byUser` (3 groups summing to the totals); `AiUserFilter({ groups, selected, onSelect })`; UI strings `Mindenki`, `Háttér`.

- [ ] **Step 1: Write the failing tests**

Append to `llmUsageHooks.test.tsx` inside `describe('useLlmUsageBreakdown (mock mode)')`:

```tsx
  it('keeps byUser reconcilable too: the per-account groups sum to the totals, background is the null group', () => {
    const { totals, byUser } = LLM_BREAKDOWN_MOCK
    expect(byUser.reduce((n, g) => n + g.callCount, 0)).toBe(totals.callCount)
    expect(byUser.reduce((n, g) => n + (g.costUsd ?? 0), 0)).toBeCloseTo(totals.costUsd ?? 0, 6)
    expect(byUser.find((g) => g.userId == null)?.name).toBeNull()
  })
```

Append inside `describe('useLlmCalls (mock mode)')`:

```tsx
  it('narrows to one account on userId, like the server does', () => {
    const anna = renderHook(() => useLlmCalls('DAY', { userId: '00000000-0000-4000-8000-000000000002' }, 50), { wrapper: makeHookWrapper() })
    expect(anna.result.current.data.items.length).toBeGreaterThan(0)
    expect(anna.result.current.data.items.every((i) => i.createdBy === '00000000-0000-4000-8000-000000000002')).toBe(true)
  })
```

In the real-mode `useLlmCalls` "passes the filters" test add `userId: 'u-1'` to the filters object and `expect(seen).toContain('userId=u-1')`. In BOTH real-mode breakdown fixtures in this file (the `HttpResponse.json({ from: …, totals: …, features: …, models: … })` objects) add `byUser: []`.

`AiUserFilter.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { AiUserFilter } from '@/features/me/components/AiUserFilter'

const groups = [
  { userId: 'u-1', name: 'Daniel', callCount: 300, totalTokens: 900000, costUsd: 1.31 },
  { userId: null, name: null, callCount: 42, totalTokens: 200000, costUsd: 0.21 },
]

test('renders Mindenki + one chip per account + a non-clickable background bucket', () => {
  const onSelect = vi.fn()
  render(<AiUserFilter groups={groups} selected={null} onSelect={onSelect} />)
  expect(screen.getByRole('button', { name: 'Mindenki' })).toHaveAttribute('aria-pressed', 'true')
  fireEvent.click(screen.getByRole('button', { name: 'Daniel 300' }))
  expect(onSelect).toHaveBeenCalledWith('u-1')
  expect(screen.getByText('Háttér 42')).not.toHaveAttribute('role', 'button')
})

test('the active chip clears itself', () => {
  const onSelect = vi.fn()
  render(<AiUserFilter groups={groups} selected="u-1" onSelect={onSelect} />)
  fireEvent.click(screen.getByRole('button', { name: /Daniel 300/ }))
  expect(onSelect).toHaveBeenCalledWith(null)
})
```

Append to `AiUsagePage.test.tsx` inside `describe('AiUsagePage (mock mode)')`:

```tsx
  it('offers a per-user chip row from byUser and narrows the list on tap (mezo-qw37.3)', async () => {
    renderPage()
    const before = screen.getAllByRole('link').length
    fireEvent.click(screen.getByRole('button', { name: 'Anna 70' }))
    await waitFor(() => expect(screen.getAllByRole('link').length).toBeLessThan(before))
    fireEvent.click(screen.getByRole('button', { name: 'Mindenki' }))
    await waitFor(() => expect(screen.getAllByRole('link')).toHaveLength(before))
  })
```

Then `grep -rn "unpricedCount" frontend/src --include=*.test.tsx -l` and add `byUser: []` to every breakdown fixture object in those files that lacks it (the page's own real-mode fixtures, `AiUsageHero`/`AiFeatureBreakdown` tests pass `totals`/`groups` only and need nothing).

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && VITE_USE_MOCK=true pnpm test src/data/me/llmUsageHooks src/features/me/components/AiUserFilter src/features/me/pages/AiUsagePage`
Expected: FAIL — `byUser` undefined, `AiUserFilter` missing, `Anna 70` not found.

- [ ] **Step 3: `llmUsageApi.ts`**

Add `userId?: string` to `LlmCallFilters` (doc line: `/** created_by — only an account's own calls; background rows never match */`), and in `callsQuery` add `if (filters.userId) params.set('userId', filters.userId)`.

- [ ] **Step 4: `llmUsageHooks.ts`**

- `LLM_BREAKDOWN_EMPTY`: add `byUser: [],`.
- `LLM_BREAKDOWN_MOCK`: add after `models`:

```ts
  // Per-account split (mezo-qw37.3) — sums to the totals like features[]/models[]; the null
  // group is the cron/stream traffic that has no principal (ids match adminMock).
  byUser: [
    { userId: '00000000-0000-4000-8000-000000000001', name: 'Daniel', callCount: 300, totalTokens: 1_240_000, costUsd: 1.31 },
    { userId: '00000000-0000-4000-8000-000000000002', name: 'Anna', callCount: 70, totalTokens: 310_000, costUsd: 0.34 },
    { userId: null, name: null, callCount: 42, totalTokens: 380_000, costUsd: 0.21 },
  ],
```

- `LLM_CALLS_MOCK.items`: add `createdBy` to every item right after `createdAt` — rows 1, 2, 4, 6 → `'00000000-0000-4000-8000-000000000001'`; rows 3, 5 → `'00000000-0000-4000-8000-000000000002'`; row 7 (`proactive_briefing`) → `null`. (Row 2 must stay Daniel's: `LLM_CALL_DETAIL_MOCK.createdBy` is that id.)
- `LLM_CALL_DETAIL_EMPTY`/`LLM_CALL_DETAIL_MOCK`: unchanged (detail already carries `createdBy`).
- `mockCalls`: add `&& (filters.userId == null || call.createdBy === filters.userId)` to the predicate.
- `useLlmCalls` queryKey: insert `filters.userId ?? null` before `limit`.

- [ ] **Step 5: `AiUserFilter.tsx`**

```tsx
import type { components } from '@/data/_client/api.gen'

type UserGroup = components['schemas']['LlmUsageUserGroup']

// Per-account chips over the breakdown's byUser rollup (mezo-qw37.3). Same toggle idiom as
// AiCallFilters: the active chip clears itself. The background bucket (userId null) is shown
// for honesty — it is often the biggest spender — but is not a filter: the list endpoint
// narrows on created_by = :userId, and "created_by IS NULL" is not expressible there (YAGNI).

function chipStyle(active: boolean): React.CSSProperties {
  return {
    flexShrink: 0, fontSize: 11, fontWeight: 700, borderRadius: 999, padding: '6px 11px',
    cursor: 'pointer', border: '1px solid var(--border-subtle)',
    background: active ? 'var(--text-primary)' : 'var(--surface-1)',
    color: active ? 'var(--surface-1)' : 'var(--text-secondary)',
  }
}

export function AiUserFilter({ groups, selected, onSelect }: {
  groups: UserGroup[]
  selected: string | null
  onSelect: (userId: string | null) => void
}) {
  if (groups.length === 0) return null
  const accounts = groups.filter((g) => g.userId != null)
  const background = groups.find((g) => g.userId == null)
  return (
    <div className="row" style={{ gap: 6, overflowX: 'auto', padding: '8px 0 0' }}>
      <button type="button" style={chipStyle(selected === null)} aria-pressed={selected === null} onClick={() => onSelect(null)}>
        Mindenki
      </button>
      {accounts.map((g) => {
        const active = selected === g.userId
        return (
          <button key={g.userId!} type="button" style={chipStyle(active)} aria-pressed={active}
            onClick={() => onSelect(active ? null : g.userId!)}>
            {g.name ?? 'törölt fiók'} {g.callCount}{active ? ' ✕' : ''}
          </button>
        )
      })}
      {background && (
        <span style={{ ...chipStyle(false), cursor: 'default', opacity: 0.7 }} title="cron/háttér hívások — nincs bejelentkezett fiók">
          Háttér {background.callCount}
        </span>
      )}
    </div>
  )
}
```

- [ ] **Step 6: Wire it into `AiUsagePage.tsx`**

Import `import { AiUserFilter } from '@/features/me/components/AiUserFilter'`. Inside the non-error branch, after `<AiModelBreakdown groups={breakdown.data.models} />` add:

```tsx
              <AiUserFilter
                groups={breakdown.data.byUser}
                selected={filters.userId ?? null}
                onSelect={(userId) => changeFilters(userId ? { ...filters, userId } : omitUserId(filters))}
              />
```

and add next to `omitFeature`:

```ts
function omitUserId(filters: Filters): Filters {
  const { userId, ...rest } = filters
  return rest
}
```

Update the page's header comment: add one line "Per-user chips (mezo-qw37.3): `byUser` from the same breakdown read; the chosen `userId` is a server-side list filter like the others — the whole page is OWNER-only since S3."

- [ ] **Step 7: Run both modes**

Run: `cd frontend && VITE_USE_MOCK=true pnpm test src/data/me/llmUsageHooks src/features/me && VITE_USE_MOCK=false pnpm test src/data/me/llmUsageHooks src/features/me`
Expected: PASS in both modes (the `features/me` sweep catches every breakdown fixture that still lacks `byUser`).

- [ ] **Step 8: Commit**

```bash
git add frontend/src/data/me/llmUsageApi.ts frontend/src/data/me/llmUsageHooks.ts frontend/src/data/me/llmUsageHooks.test.tsx frontend/src/features/me/components/AiUserFilter.tsx frontend/src/features/me/components/AiUserFilter.test.tsx frontend/src/features/me/pages/AiUsagePage.tsx frontend/src/features/me/pages/AiUsagePage.test.tsx
git add -u frontend/src
git commit -m "feat(fe): AI-napló per-user filter chips from byUser + userId list filter (mezo-qw37.3)"
```

---
### Task 9: Docs — `beta-admin.md`, index rows, me.md / api-backend refresh, CODEMAP; full gates; push + PR

**Files:**
- Create: `docs/features/beta-admin.md`
- Modify: `docs/features/README.md`, `docs/features/me.md` (§2 AI-napló, §3 hooks), `docs/features/_platform-api-backend.md` (contract table + endpoint rows), `docs/CODEMAP.md` (regenerated)

- [ ] **Step 1: Write `docs/features/beta-admin.md`**

```markdown
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
  - **Felhasználók** — one card per account: name, email, `tulajdonos` / `aktív` / `letiltva`, `utoljára: …` (or `még nem járt itt`), `· onboarding nyitva` while `onboardedAt` is null; `Jelszó-reset` opens **`TempPasswordSheet`** (`Ideiglenes jelszó`, shown once, `Megjegyeztem`); a `Letiltás: <név>` switch flips `ACTIVE ↔ DISABLED` — absent on the owner's own row and on any OWNER row (server answers 409 `ADMIN_SELF_STATUS` regardless). A disabled account's next request is rejected with 403 `AUTH_ACCOUNT_DISABLED` and the S1 `AuthGate` signs it out.
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
- **Temp password is 12 chars from the readable alphabet + lowercase**, `SecureRandom`; the response is the only clear-text copy.
- **`LlmActorContext` is a plain ThreadLocal** — correct because the actor is resolved before the `@Async` audit hop; `CHAT_STREAM` calls completing on reactive threads keep a null actor (pre-existing).
- **`useLlmUsageSummary` still mounts for a USER** on Beállítások and fails silently into the honest empty; gating it on role is a small follow-up.
- **Deferred**: `GET /api/companion/memory/llm-usage` (memory observatory) is still ungated cross-user — file a bd issue and gate it with `requireOwner()` alongside S6's doc rewrite; the AI-napló entry row in the S2 `EnHubPage` Profil card (if any) should follow the same `isOwner` guard.

## 10. Key files

- Contract: `api/feature/admin/admin.yml`, `api/feature/llm-usage/llm-usage.yml`, `api/generate/merge.yml`
- Backend: `feature/auth/service/AdminService.java`, `feature/auth/controller/AdminController.java`, `feature/llmlog/controller/LlmUsageController.java`, `feature/llmlog/service/{LlmUsageService,LlmActorResolver}.java`, `feature/llmlog/repository/{LlmLogRepository,LlmUserRow,LlmCallRow}.java`, `techcore/security/LlmActorContext.java`, `messages.properties` (`ADMIN_*`)
- Backend tests: `feature/auth/{AdminInviteIT,AdminUserIT}.java`, `feature/llmlog/controller/LlmUsageControllerIT.java`, `feature/llmlog/service/LlmActorResolverTest.java`, `techcore/security/LlmActorContextTest.java`
- Frontend: `data/admin/{adminApi,adminMock,adminHooks}.ts`, `features/me/pages/BetaAdminPage.tsx`, `features/me/components/{AdminInviteRow,AdminUserRow,AiUserFilter}.tsx`, `features/me/sheets/TempPasswordSheet.tsx`, `features/me/pages/{BeallitasokPage,AiUsagePage}.tsx`, `data/me/{llmUsageApi,llmUsageHooks}.ts`, `app/router.tsx`, `test/msw/handlers.ts`
- Docs: this file, `me.md` §2/§3, `_platform-api-backend.md`, `_platform-auth-security.md` (S1/S6), spec §7.
```

- [ ] **Step 2: Index + cross-doc updates**

`docs/features/README.md`: add to the **Domain docs** table (after the `journal.md` row):

```markdown
| [`beta-admin.md`](beta-admin.md) | Beta admin (`/me/beallitasok/admin`, OWNER-only) | ✅ done (BE + FE real + FE mock) | Invite codes, account list, temp-password reset, enable/disable; OWNER gate + per-account split on the AI-napló; `LlmActorContext` seam for cron attribution (`mezo-qw37.3`). |
```
and to the **feature → doc map** table a row: `| Meghívó kódok / felhasználók / jelszó-reset / letiltás | `/me/beallitasok/admin` | [`beta-admin.md`](beta-admin.md) §2, §4 |` and `| AI-napló per-user chips, owner-only LLM-usage | `/me/ai-usage` | [`beta-admin.md`](beta-admin.md) §3 · [`me.md`](me.md) §2 |`.

`docs/features/me.md` §2 `AI-napló` paragraph: append one sentence — "**Since `mezo-qw37.3` the page is OWNER-only** (every `/api/llm-usage/*` read is behind `CurrentUser.requireOwner()`; the Beállítások row renders only for `role === 'OWNER'`), and an `AiUserFilter` chip row (`Mindenki` · one chip per account · a non-clickable `Háttér` bucket) narrows the list by `userId` off the breakdown's `byUser` split — see [`beta-admin.md`](beta-admin.md)." §3 hook bullets: `useLlmCalls` queryKey now includes `filters.userId ?? null`; `LLM_BREAKDOWN_MOCK` carries `byUser`. Add the `Beta admin` row to the Beállítások description in §2. Frontmatter `updated: 2026-09-02`.

`docs/features/_platform-api-backend.md`: in the contract table add a row after **LLM usage**: `| **Admin** (beta console) | \`api/feature/admin/admin.yml\` (tag \`Admin\` → \`AdminApi\`) | ✅ \`feature/auth\` — \`AdminController\`/\`AdminService\` (invites, users, temp-password reset, status), OWNER-only via \`CurrentUser.requireOwner()\` | \`data/admin/adminHooks.ts\` → \`useAdminInvites()\`/\`useAdminUsers()\`/\`useAdminActions()\` | 🟢 \`mezo-qw37.3\` — see [\`beta-admin.md\`](beta-admin.md) §4 |`; in the endpoint table add the six `/admin/*` rows (one line each, status codes as in the feature doc), and on the four `/llm-usage/*` rows replace "ungated" / "no ownership check … single-user app" with "**OWNER-only** (`mezo-qw37.3`, 403 `AUTH_FORBIDDEN`); still no `created_by` filter on the aggregates — background rows are reported in `byUser` as the null-user bucket" (breakdown row: mention `byUser`; calls row: mention `userId` + `createdBy`).

Run:
```bash
node scripts/gen-codemap.mjs && node scripts/lint-docs.mjs --errors-only
```
Expected: CODEMAP regenerated (new `AdminController`→`AdminApi`, `AdminService`, `LlmUserRow`, `LlmActorContext`, `data/admin`, the new pages/components), lint reports no errors for `beta-admin.md` (frontmatter keys present, `key_files` exist, `related:` resolve).

- [ ] **Step 3: Commit docs**

```bash
git add docs/features/beta-admin.md docs/features/README.md docs/features/me.md docs/features/_platform-api-backend.md docs/CODEMAP.md
git commit -m "docs(admin): beta-admin feature doc, me/api-backend refresh, CODEMAP (mezo-qw37.3)"
```

- [ ] **Step 4: Full gates**

```bash
cd frontend && VITE_USE_MOCK=true pnpm test && VITE_USE_MOCK=false pnpm test && pnpm build
cd ../backend && ./mvnw test -Dtest='Admin*,LlmUsage*,LlmActor*,LlmCallList*,LlmCallDetailIT,Auth*,CurrentUser*,ArchitectureTest' -Dmezo.test.use-testcontainers=true
node scripts/gen-codemap.mjs --check && node scripts/lint-docs.mjs --errors-only
```
Expected: all green. Typical breakages: a breakdown fixture in some test missing `byUser` (add `byUser: []`); `LlmCallListIT` comparing a full `LlmCallListItem` object (add `createdBy`); a Beállítások golden/visual test that now sees the extra row in mock mode (owner) — update the snapshot deliberately.

- [ ] **Step 5: Push, self-PR, CI**

```bash
git push -u origin feat/multi-user-s3-beta-admin
gh pr create --title "feat(admin): S3 beta admin + owner-only LLM-usage + LlmActorContext (mezo-qw37.3)" --body "$(cat <<'EOF'
S3 of the multi-user epic (mezo-qw37): /api/admin invites + users (OWNER-only), owner gate on every /api/llm-usage read with a byUser split and userId list filter, LlmActorContext ThreadLocal + LlmActorResolver fallback (S6 wraps the cron fan-out), BetaAdminPage (Meghívók / Felhasználók) behind an OWNER-only Beállítások row, AI-napló per-user chips, docs/features/beta-admin.md. Spec: docs/superpowers/specs/2026-09-02-multi-user-accounts-design.md §7.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
gh pr checks --watch
```
Expected: CI green (full backend IT suite, FE both modes, lint, contract drift, codemap check). Then the house merge recipe (`git pull --rebase` on main, `--no-ff` merge, push main), `bd close mezo-qw37.3`, `bd dolt push`.

---
## Self-Review

**Spec coverage (§7):** contract table (`createInvite`/`listInvites`/`deleteInvite` 409 `ADMIN_INVITE_USED`/`listUsers`/`resetPassword` 12 chars + `must_change_password`/`setStatus` 409 `ADMIN_SELF_STATUS`), `merge.yml` entry, `AdminController` behind `requireOwner()` → Tasks 1–3; new message codes → Task 2; `/api/llm-usage/*` owner-only, rollup `byUser`, `/calls/{id}` owner-only → Task 4 (`costUsd` instead of `costHuf` — recorded deviation, Global Constraints + feature doc §9; `byUser` on the breakdown only — §9); `llm_log_history.created_by` stays nullable, `LlmActorContext.runAs` ThreadLocal in techcore + `LlmActorResolver` fallback, S6 wraps the fan-out → Task 5; `BetaAdminPage` with Meghívók (mint with label, list, copy, delete) / Felhasználók (status, last activity, reset → temp password in a sheet, disable toggle), Beállítások row only for OWNER → Task 7; per-user chip row on the AI-napló → Task 8 (plus the `userId` list filter so the chip narrows the list, not just the header); mock-mode static seed (3 users, 2 codes) → Task 6; tests — `AdminInviteIT`/`AdminUserIT` (USER→403 everywhere, invite lifecycle, reset → old 401 / temp 200 + `mustChangePassword=true`, self-status 409), `LlmUsageControllerIT` USER→403, `LlmActorContextTest` → Tasks 2–5; FE tests both modes → Tasks 6–8; `docs/features/beta-admin.md` (10 sections), LLM-usage doc update (`me.md`, `_platform-api-backend.md`), CODEMAP regen → Task 9. The spec's "`LlmActorContext` cron-IT (job call's `created_by` is the user)" needs a production `runAs` caller, which is S6's `UserFanOut` — S3 proves the seam with the resolver unit test and leaves the end-to-end cron IT to S6 (noted in Task 5 Interfaces and feature doc §5).

**Placeholder scan:** none — every code step carries full content; the "check the generated constructor order" (Task 2), "verify the generated parameter order" (Task 4) and "`cast(:userId as uuid)` if Postgres complains" (Task 4) notes are verification instructions with the concrete fallback spelled out. Task 8's "add `byUser: []` to every breakdown fixture" names the grep that finds them.

**Type consistency:** `AdminService.createInvite(AppUserEntity, CreateInviteRequest)` / `setStatus(AppUserEntity, UUID, SetUserStatusRequest)` match `AdminController` (Task 2) and the generated `AdminApi` operation ids from Task 1 (`createInvite`, `listInvites`, `deleteInvite`, `listUsers`, `resetPassword`, `setStatus`); `LlmUserRow(userId, name, callCount, totalTokens, costUsd)` matches the JPQL constructor expression and `userGroups()` (Task 4); `LlmCallRow` gains `createdBy` as the second component and `findCalls` lists `l.id, l.createdBy, l.createdAt, …` accordingly; `LlmUsageService.listCalls(period, feature, status, callKind, userId, limit)` matches the controller pass-through and the contract's parameter order (`userId` before `limit`); FE `adminApi`/`adminHooks` names (`useAdminInvites`, `useAdminUsers`, `useAdminActions{createInvite, deleteInvite, resetPassword, setStatus, pending}`) are identical in Tasks 6, 7 and the feature doc; mock ids `MOCK_OWNER_ID`/`MOCK_ANNA_ID` (`…0001`/`…0002`) are the same literals used in `LLM_BREAKDOWN_MOCK.byUser` and `LLM_CALLS_MOCK.createdBy` (Task 8) so the `Anna 70` chip and the narrowed list agree; UI strings asserted in tests match the component copy (`Beta admin`, `Meghívók`, `Felhasználók`, `Címke`, `Új kód`, `Másolás`, `Törlés`, `Jelszó-reset`, `Ideiglenes jelszó`, `Megjegyeztem`, `Letiltás: <név>`, `Nincs nyitott meghívó.`, `Mindenki`, `Háttér`, `felhasználta: Anna`).

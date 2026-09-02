# S1 Fiók-alap (mezo-qw37.1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the single-owner auth into a multi-user foundation: `app_user` gains role/status/timezone/onboarding columns, an `invite` table gates registration, the API grows `register`/`me`/`change-password`/`onboarding-complete`, the frontend gets a persisted token, a Login/Register/ChangePassword gate, and 401/403 handling — while every existing owner-scoped endpoint keeps working unchanged.

**Architecture:** The HS256 JWT + `CurrentUserId` seam stays (spec decision M1). A new `CurrentUser` component in `feature/auth/service` loads the `AppUserEntity` behind the JWT subject once per request, rejects `DISABLED` accounts with 403, and exposes `requireOwner()`; `CurrentUserId.get()` delegates to it so the status check covers every protected request. The frontend keeps the token in `localStorage`, and a new `AuthGate` (inside `QueryProvider`) runs the boot state machine `pending → signedOut | mustChangePassword | ready | failed`, rendering the auth pages itself (no router involvement, so they have no app chrome).

**Tech Stack:** Spring Boot 4 / Spring Security 7 (resource-server JWT), Liquibase SQL changesets, openapi-generator (contract-first), JUnit 5 + Testcontainers ITs, React 19 + TanStack Query 5 + Vitest + MSW.

**Spec:** `docs/superpowers/specs/2026-09-02-multi-user-accounts-design.md` §5 (and §11–§12).

## Global Constraints

- Contract-first: edit `api/feature/auth/auth.yml`, then `cd api/generate && npm run generate:api` (merges into `api/openapi.yml`), then `cd frontend && pnpm generate:api`. Commit both generated files. Backend Java DTOs regenerate on every Maven build (`target/`, not committed).
- Every non-2xx response references `SystemMessageList`; new error codes go into `backend/src/main/resources/messages.properties` (`{DOMAIN}_{ACTION}_{REASON}`).
- Liquibase: file `backend/src/main/resources/db/changelog/1.0.0/script/{YYYYMMDDHHMM}_mezo-qw37.1_{desc}.sql`, registered in `1.0.0/1.0.0_master.yml`; constraint prefixes `pk_/fk_/uq_/ck_/idx_`; no `INSERT` (backfill `UPDATE` is fine); entity annotations mirror constraints.
- ArchUnit (`backend/src/test/java/io/mrkuhne/mezo/ArchitectureTest.java`): `@RestController` in `..controller..`, `@Service` in `..service..`, `@Entity` in `..entity..`, repositories in `..repository..`; constructor injection only (Lombok `@RequiredArgsConstructor`); no class-level `@Transactional`; no `@Value`; no raw `RuntimeException`/`IllegalStateException`/`IllegalArgumentException` outside `techcore`; every `@RestController` implements a generated `*Api`.
- Backend focused gate: `cd backend && ./mvnw test -Dtest='Auth*,CurrentUser*,OwnerSeedDataIT,ArchitectureTest' -Dmezo.test.use-testcontainers=true` (Surefire matches simple class names — every new test class in this plan starts with `Auth` or `CurrentUser`).
- Frontend gate: both `VITE_USE_MOCK=true pnpm test` and `VITE_USE_MOCK=false pnpm test` (unset = mock!), then `pnpm build`.
- After adding entities/tables: `node scripts/gen-codemap.mjs` and commit `docs/CODEMAP.md`; `node scripts/lint-docs.mjs --errors-only`; `node scripts/lint-liquibase.mjs`.
- Conventional commits carry the bd id: `feat(auth): … (mezo-qw37.1)`. Branch: `feat/multi-user-s1-account-foundation`.
- Hungarian UI copy; routed leaves are `*Page`; hooks are consumed only via `@/data/hooks`; `isMockMode()` is called inside hook/component bodies, never at module scope.

---

## File Structure

**Backend — create**
- `backend/src/main/resources/db/changelog/1.0.0/script/202609021200_mezo-qw37.1_multi_user_accounts.sql` — `app_user` columns, `invite` table, drop `user_profiles`.
- `backend/src/main/java/io/mrkuhne/mezo/feature/auth/entity/InviteEntity.java`
- `backend/src/main/java/io/mrkuhne/mezo/feature/auth/repository/InviteRepository.java`
- `backend/src/main/java/io/mrkuhne/mezo/feature/auth/service/InviteService.java` — code generation, create, consume (locked).
- `backend/src/main/java/io/mrkuhne/mezo/feature/auth/service/CurrentUser.java` — request-cached principal entity, status check, `requireOwner()`.
- `backend/src/main/java/io/mrkuhne/mezo/feature/auth/AuthStartupGuard.java` — `mezo-5h9` fail-fast.
- `backend/src/main/java/io/mrkuhne/mezo/feature/auth/AuthProperties.java` — binds `mezo.auth.strict`.
- Tests: `feature/auth/AuthRegisterIT.java`, `feature/auth/AuthMeIT.java`, `feature/auth/AuthIsolationIT.java`, `feature/auth/AuthStartupGuardTest.java`, `feature/auth/service/CurrentUserIT.java`, `feature/auth/service/InviteServiceTest.java`.

**Backend — modify**
- `api/feature/auth/auth.yml` (+ `api/openapi.yml`, `frontend/src/data/_client/api.gen.ts` regenerated)
- `feature/auth/entity/AppUserEntity.java`, `feature/auth/repository/AppUserRepository.java`
- `feature/auth/service/AuthService.java`, `feature/auth/controller/AuthController.java`
- `feature/auth/OwnerSeedData.java` (drop profile write, set role)
- `techcore/security/SecurityConfig.java` (permitAll register), `techcore/security/CurrentUserId.java` (delegate)
- `backend/src/main/resources/messages.properties`, `application.yml` (`mezo.auth.strict`)
- Delete: `feature/auth/entity/UserProfileEntity.java`, `feature/auth/repository/UserProfileRepository.java`
- Tests: `support/ResetDatabase.java`, `support/ApiIntegrationTest.java` (`registerUser`), `feature/auth/OwnerSeedDataIT.java`, `feature/auth/AuthControllerIT.java`
- `k8s/backend/deployment.yaml` (`MEZO_AUTH_STRICT=true`)

**Frontend — create**
- `frontend/src/data/_client/authEvents.ts` — tiny emitter for `signedOut`.
- `frontend/src/data/_client/tokenStore.ts` — localStorage-backed token.
- `frontend/src/data/auth/authApi.ts`, `frontend/src/data/auth/authHooks.ts` (`useMe`, `useAuthActions`)
- `frontend/src/app/auth/AuthGate.tsx`, `frontend/src/app/auth/authState.ts` (pure boot-state reducer)
- `frontend/src/features/auth/pages/LoginPage.tsx`, `RegisterPage.tsx`, `ChangePasswordPage.tsx`, `frontend/src/features/auth/components/AuthShell.tsx`
- Tests next to each file (`*.test.ts(x)`).

**Frontend — modify**
- `frontend/src/data/_client/api.ts` (token from store, 401/403 → signedOut), `frontend/src/app/providers/QueryProvider.tsx` (always provide client; mount `AuthGate`), `frontend/src/data/hooks.ts` (export auth hooks), `frontend/src/test/msw/handlers.ts`
- Delete: `frontend/src/data/_client/auth.ts`; remove `VITE_OWNER_*` from `frontend/.env.example`, `frontend/Dockerfile`, `.github/workflows/deploy.yml`, `frontend/src/vite-env.d.ts` if declared there.

**Docs**
- `docs/features/_platform-auth-security.md` §1–§3, §6–§7 refresh (multi-user reality; the full rewrite is S6).
- `docs/CODEMAP.md` regenerated.

---

### Task 1: Contract — register / me / change-password / onboarding-complete

**Files:**
- Modify: `api/feature/auth/auth.yml`
- Regenerate: `api/openapi.yml`, `frontend/src/data/_client/api.gen.ts`

**Interfaces:**
- Produces generated Java: `io.mrkuhne.mezo.api.dto.{RegisterRequest, MeResponse, ChangePasswordRequest}` and `AuthApi` methods `register(RegisterRequest) : TokenResponse`, `me() : MeResponse`, `changePassword(ChangePasswordRequest) : void`, `completeOnboarding() : void`.
- Produces FE types `components['schemas']['RegisterRequest' | 'MeResponse' | 'ChangePasswordRequest']`.

- [ ] **Step 1: Replace `api/feature/auth/auth.yml` with the extended contract**

```yaml
openapi: 3.0.3
info:
  title: ''
  version: ''
tags:
  - name: Auth
    description: Multi-user auth — invite-code registration, login, current-user profile
paths:
  /api/auth/login:
    post:
      tags: [Auth]
      operationId: login
      summary: Login with email + password, returns a JWT
      security: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/LoginRequest'
      responses:
        '200':
          description: JWT issued
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/TokenResponse'
        '400':
          description: Validation failure
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/SystemMessageList'
        '401':
          description: Invalid credentials (AUTH_LOGIN_INVALID_CREDENTIALS)
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/SystemMessageList'
        '403':
          description: Account disabled (AUTH_ACCOUNT_DISABLED)
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/SystemMessageList'
  /api/auth/register:
    post:
      tags: [Auth]
      operationId: register
      summary: Register with an invite code, returns a JWT
      security: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/RegisterRequest'
      responses:
        '200':
          description: Account created, JWT issued
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/TokenResponse'
        '400':
          description: Validation failure
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/SystemMessageList'
        '409':
          description: Invite invalid/used/expired (AUTH_INVITE_INVALID) or email taken (AUTH_EMAIL_TAKEN)
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/SystemMessageList'
  /api/auth/me:
    get:
      tags: [Auth]
      operationId: me
      summary: The authenticated user's account profile
      responses:
        '200':
          description: Current user
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/MeResponse'
        '401':
          description: Missing/invalid token
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/SystemMessageList'
        '403':
          description: Account disabled (AUTH_ACCOUNT_DISABLED)
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/SystemMessageList'
  /api/auth/change-password:
    post:
      tags: [Auth]
      operationId: changePassword
      summary: Change the authenticated user's password (also clears must-change-password)
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/ChangePasswordRequest'
      responses:
        '204':
          description: Password changed
        '400':
          description: Validation failure
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/SystemMessageList'
        '401':
          description: Current password wrong (AUTH_LOGIN_INVALID_CREDENTIALS)
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/SystemMessageList'
  /api/auth/onboarding-complete:
    post:
      tags: [Auth]
      operationId: completeOnboarding
      summary: Mark the authenticated user's onboarding as done
      responses:
        '204':
          description: Marked
        '401':
          description: Missing/invalid token
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/SystemMessageList'
components:
  schemas:
    LoginRequest:
      type: object
      required:
        - email
        - password
      properties:
        email:
          type: string
          format: email
          example: owner@mezo.local
        password:
          type: string
          minLength: 1
    TokenResponse:
      type: object
      required:
        - token
      properties:
        token:
          type: string
          description: HS256-signed JWT bearer token
    RegisterRequest:
      type: object
      required:
        - inviteCode
        - email
        - password
        - name
      properties:
        inviteCode:
          type: string
          minLength: 1
          maxLength: 32
          example: MEZO-7KQ2-XN4P
        email:
          type: string
          format: email
          maxLength: 255
        password:
          type: string
          minLength: 8
          maxLength: 72
        name:
          type: string
          minLength: 1
          maxLength: 120
    MeResponse:
      type: object
      required:
        - id
        - email
        - name
        - role
        - onboarded
        - mustChangePassword
        - timezone
      properties:
        id:
          type: string
          format: uuid
        email:
          type: string
        name:
          type: string
        role:
          type: string
          description: OWNER or USER
        onboarded:
          type: boolean
        mustChangePassword:
          type: boolean
        timezone:
          type: string
          example: Europe/Budapest
    ChangePasswordRequest:
      type: object
      required:
        - currentPassword
        - newPassword
      properties:
        currentPassword:
          type: string
          minLength: 1
        newPassword:
          type: string
          minLength: 8
          maxLength: 72
```

- [ ] **Step 2: Regenerate merged contract and FE types**

Run:
```bash
cd api/generate && npm run generate:api && cd ../../frontend && pnpm generate:api
```
Expected: `api/openapi.yml` and `frontend/src/data/_client/api.gen.ts` change; `grep -n "RegisterRequest" frontend/src/data/_client/api.gen.ts` shows the schema.

- [ ] **Step 3: Verify backend generation compiles the new interface**

Run: `cd backend && ./mvnw -q generate-sources && ls target/generated-sources/openapi/src/main/java/io/mrkuhne/mezo/api/dto/ | grep -E "RegisterRequest|MeResponse|ChangePasswordRequest"`
Expected: the three DTO files are listed. (Compilation of `AuthController` will fail until Task 5 — that is expected; do not run `compile` yet.)

- [ ] **Step 4: Commit**

```bash
git add api/feature/auth/auth.yml api/openapi.yml frontend/src/data/_client/api.gen.ts
git commit -m "feat(api): auth contract — register/me/change-password/onboarding-complete (mezo-qw37.1)"
```

---

### Task 2: Schema + entities — app_user columns, invite table, drop user_profiles

**Files:**
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202609021200_mezo-qw37.1_multi_user_accounts.sql`
- Modify: `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml` (append)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/auth/entity/AppUserEntity.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/auth/entity/InviteEntity.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/auth/repository/InviteRepository.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/auth/repository/AppUserRepository.java`
- Delete: `feature/auth/entity/UserProfileEntity.java`, `feature/auth/repository/UserProfileRepository.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/auth/OwnerSeedData.java`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/support/ResetDatabase.java`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/feature/auth/OwnerSeedDataIT.java`

**Interfaces:**
- Produces: `AppUserEntity` fields `role: UserRole`, `status: UserStatus`, `timezone: String`, `onboardedAt: Instant`, `mustChangePassword: boolean`, `lastSeenAt: Instant`; enums `UserRole {OWNER, USER}`, `UserStatus {ACTIVE, DISABLED}` as nested enums of `AppUserEntity`.
- Produces: `InviteEntity {id, code, label, createdBy, createdAt, expiresAt, usedBy, usedAt}`; `InviteRepository.findByCodeForUpdate(String)`, `findAllByOrderByCreatedAtDesc()`; `AppUserRepository.touchLastSeen(UUID, Instant)`.

- [ ] **Step 1: Write the failing seed test (role must be OWNER, no user_profiles)**

Edit `backend/src/test/java/io/mrkuhne/mezo/feature/auth/OwnerSeedDataIT.java` — add:

```java
    @Test
    void testSeed_shouldMarkOwnerRoleAndOnboarded_whenSeeded() {
        AppUserEntity owner = appUserRepository.findByEmail("owner@mezo.local").orElseThrow();
        assertThat(owner.getRole()).isEqualTo(AppUserEntity.UserRole.OWNER);
        assertThat(owner.getStatus()).isEqualTo(AppUserEntity.UserStatus.ACTIVE);
        assertThat(owner.getOnboardedAt()).isNotNull();
        assertThat(owner.getTimezone()).isEqualTo("Europe/Budapest");
    }
```
(add `import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;`)

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && ./mvnw test -Dtest='OwnerSeedDataIT' -Dmezo.test.use-testcontainers=true`
Expected: compilation error — `getRole()` undefined.

- [ ] **Step 3: Write the changeset**

`backend/src/main/resources/db/changelog/1.0.0/script/202609021200_mezo-qw37.1_multi_user_accounts.sql`:

```sql
-- Multi-user accounts S1 (mezo-qw37.1): account role/status/timezone/onboarding columns,
-- the invite table that gates registration, and the never-read user_profiles table goes.
-- Spec: docs/superpowers/specs/2026-09-02-multi-user-accounts-design.md §5.

ALTER TABLE app_user ADD COLUMN role                 VARCHAR(16)  NOT NULL DEFAULT 'USER';
ALTER TABLE app_user ADD COLUMN status               VARCHAR(16)  NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE app_user ADD COLUMN timezone             VARCHAR(64)  NOT NULL DEFAULT 'Europe/Budapest';
ALTER TABLE app_user ADD COLUMN onboarded_at         TIMESTAMPTZ;
ALTER TABLE app_user ADD COLUMN must_change_password BOOLEAN      NOT NULL DEFAULT false;
ALTER TABLE app_user ADD COLUMN last_seen_at         TIMESTAMPTZ;

ALTER TABLE app_user ADD CONSTRAINT ck_app_user_role   CHECK (role IN ('OWNER', 'USER'));
ALTER TABLE app_user ADD CONSTRAINT ck_app_user_status CHECK (status IN ('ACTIVE', 'DISABLED'));

-- Backfill: every pre-existing account is the founder — owner role, already onboarded.
UPDATE app_user SET role = 'OWNER', onboarded_at = COALESCE(onboarded_at, created_at);

CREATE TABLE invite (
    id         UUID         NOT NULL DEFAULT gen_random_uuid(),
    code       VARCHAR(32)  NOT NULL,
    label      VARCHAR(120),
    created_by UUID         NOT NULL,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ,
    used_by    UUID,
    used_at    TIMESTAMPTZ,
    CONSTRAINT pk_invite_id PRIMARY KEY (id),
    CONSTRAINT uq_invite_code UNIQUE (code),
    CONSTRAINT fk_invite_created_by_app_user_id FOREIGN KEY (created_by) REFERENCES app_user (id) ON DELETE CASCADE,
    CONSTRAINT fk_invite_used_by_app_user_id    FOREIGN KEY (used_by)    REFERENCES app_user (id) ON DELETE SET NULL
);
CREATE INDEX idx_invite_created_by ON invite (created_by);

-- user_profiles: written only by OwnerSeedData, read by nobody (name lives on app_user).
DROP TABLE user_profiles;
```

Append to `1.0.0/1.0.0_master.yml`:

```yaml
  - changeSet:
      id: "1.0.0:202609021200_mezo-qw37.1_multi_user_accounts"
      author: daniel.kuhne
      changes:
        - sqlFile:
            relativeToChangelogFile: true
            path: script/202609021200_mezo-qw37.1_multi_user_accounts.sql
```

Run: `node scripts/lint-liquibase.mjs` — Expected: PASS.

- [ ] **Step 4: Update `AppUserEntity`**

Replace the class body of `AppUserEntity.java`:

```java
package io.mrkuhne.mezo.feature.auth.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

@Getter
@Setter
@Entity
@Table(name = "app_user")
public class AppUserEntity {

    public enum UserRole { OWNER, USER }
    public enum UserStatus { ACTIVE, DISABLED }

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull @Size(max = 255)
    @Column(nullable = false, length = 255)
    private String email;

    @NotNull @Size(max = 100)
    @Column(name = "password_hash", nullable = false, length = 100)
    private String passwordHash;

    @NotNull @Size(max = 120)
    @Column(nullable = false, length = 120)
    private String name;

    /** DB CHECK ck_app_user_role. */
    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private UserRole role = UserRole.USER;

    /** DB CHECK ck_app_user_status. A DISABLED account is rejected on every request (CurrentUser). */
    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private UserStatus status = UserStatus.ACTIVE;

    /** T1 decision: stored for the future, not yet consulted by any "today" logic. */
    @NotNull @Size(max = 64)
    @Column(nullable = false, length = 64)
    private String timezone = "Europe/Budapest";

    @Column(name = "onboarded_at")
    private Instant onboardedAt;

    @Column(name = "must_change_password", nullable = false)
    private boolean mustChangePassword = false;

    @Column(name = "last_seen_at")
    private Instant lastSeenAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    public boolean isOwner() { return role == UserRole.OWNER; }
    public boolean isOnboarded() { return onboardedAt != null; }
}
```

- [ ] **Step 5: Create `InviteEntity` and `InviteRepository`**

`feature/auth/entity/InviteEntity.java`:

```java
package io.mrkuhne.mezo.feature.auth.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

/** One-shot invite code; consumed by {@code AuthService.register}. */
@Getter
@Setter
@Entity
@Table(name = "invite")
public class InviteEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull @Size(max = 32)
    @Column(nullable = false, length = 32)
    private String code;

    @Size(max = 120)
    @Column(length = 120)
    private String label;

    @NotNull
    @Column(name = "created_by", nullable = false, columnDefinition = "uuid")
    private UUID createdBy;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "expires_at")
    private Instant expiresAt;

    @Column(name = "used_by", columnDefinition = "uuid")
    private UUID usedBy;

    @Column(name = "used_at")
    private Instant usedAt;

    public boolean isUsed() { return usedAt != null; }
    public boolean isExpired(Instant now) { return expiresAt != null && expiresAt.isBefore(now); }
}
```

`feature/auth/repository/InviteRepository.java`:

```java
package io.mrkuhne.mezo.feature.auth.repository;

import io.mrkuhne.mezo.feature.auth.entity.InviteEntity;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface InviteRepository extends JpaRepository<InviteEntity, UUID> {

    /** Pessimistic row lock — two concurrent registrations with one code serialize here. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select i from InviteEntity i where i.code = :code")
    Optional<InviteEntity> findByCodeForUpdate(@Param("code") String code);

    boolean existsByCode(String code);

    List<InviteEntity> findAllByOrderByCreatedAtDesc();
}
```

- [ ] **Step 6: Extend `AppUserRepository`**

```java
package io.mrkuhne.mezo.feature.auth.repository;

import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

public interface AppUserRepository extends JpaRepository<AppUserEntity, UUID> {
    Optional<AppUserEntity> findByEmail(String email);
    boolean existsByEmail(String email);

    /** Cheap presence stamp — called by CurrentUser at most every 5 minutes per user. */
    @Modifying
    @Transactional
    @Query("update AppUserEntity u set u.lastSeenAt = :at where u.id = :id")
    void touchLastSeen(@Param("id") UUID id, @Param("at") Instant at);
}
```

- [ ] **Step 7: Delete `UserProfileEntity` + `UserProfileRepository`, update `OwnerSeedData`**

```bash
git rm backend/src/main/java/io/mrkuhne/mezo/feature/auth/entity/UserProfileEntity.java backend/src/main/java/io/mrkuhne/mezo/feature/auth/repository/UserProfileRepository.java
grep -rn "UserProfile" backend/src --include=*.java
```
Expected after the grep: no remaining references (fix any hit by deleting the usage).

`OwnerSeedData.java`:

```java
package io.mrkuhne.mezo.feature.auth;

import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import java.time.Instant;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

/** Seeds the founder account (role OWNER, already onboarded). Idempotent by email. */
@Component
@Profile("demodata")
@Order(0) // seeds the owner that later runners (e.g. TrainSeedData) depend on
@RequiredArgsConstructor
public class OwnerSeedData implements CommandLineRunner {

    private final AppUserRepository appUserRepository;
    private final PasswordEncoder passwordEncoder;
    private final OwnerProperties ownerProperties;

    @Override
    public void run(String... args) {
        if (appUserRepository.existsByEmail(ownerProperties.ownerEmail())) return;
        AppUserEntity owner = new AppUserEntity();
        owner.setEmail(ownerProperties.ownerEmail());
        owner.setName(ownerProperties.ownerName());
        owner.setPasswordHash(passwordEncoder.encode(ownerProperties.ownerPassword()));
        owner.setRole(AppUserEntity.UserRole.OWNER);
        owner.setOnboardedAt(Instant.now());
        appUserRepository.save(owner);
    }
}
```

- [ ] **Step 8: Update `ResetDatabase`**

In `resetExceptMasterData()`: add `invite, ` at the front of the TRUNCATE list (after `"TRUNCATE TABLE `), and delete the `user_profiles` DELETE statement entirely. Update the class Javadoc line "(the demodata-seeded owner and their profile)" → "(the demodata-seeded owner)".

- [ ] **Step 9: Run the seed IT + ArchUnit**

Run: `cd backend && ./mvnw test -Dtest='OwnerSeedDataIT,ArchitectureTest' -Dmezo.test.use-testcontainers=true`
Expected: PASS (note: `AuthController` still compiles because `AuthApi`'s new methods are not yet implemented — if the compiler complains about the missing interface methods, temporarily stub them in Task 5's shape now: `register` → `throw new SystemRuntimeErrorException(SystemMessage.error("INTERNAL_ERROR").build(), HttpStatus.NOT_IMPLEMENTED)` etc.; Task 5 replaces them).

- [ ] **Step 10: Regenerate CODEMAP and commit**

```bash
node scripts/gen-codemap.mjs
git add -A backend/src docs/CODEMAP.md
git commit -m "feat(auth): app_user role/status/timezone/onboarding, invite table, drop user_profiles (mezo-qw37.1)"
```

---

### Task 3: `InviteService` — code generation and consumption

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/auth/service/InviteService.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/auth/service/InviteServiceTest.java` (unit), consumption covered by `AuthRegisterIT` in Task 5.

**Interfaces:**
- Produces: `InviteService.create(UUID createdBy, String label, Instant expiresAt) : InviteEntity`, `InviteService.consume(String code, UUID usedBy) : InviteEntity` (throws 409 `AUTH_INVITE_INVALID`), `static String generateCode()` → `MEZO-XXXX-XXXX`.

- [ ] **Step 1: Write the failing unit test for code shape**

`InviteServiceTest.java`:

```java
package io.mrkuhne.mezo.feature.auth.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.HashSet;
import java.util.Set;
import org.junit.jupiter.api.Test;

class InviteServiceTest {

    @Test
    void testGenerateCode_shouldMatchReadableShape_whenCalled() {
        String code = InviteService.generateCode();
        assertThat(code).matches("MEZO-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}");
    }

    @Test
    void testGenerateCode_shouldBeUnique_whenCalledManyTimes() {
        Set<String> seen = new HashSet<>();
        for (int i = 0; i < 1000; i++) seen.add(InviteService.generateCode());
        assertThat(seen).hasSize(1000);
    }
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && ./mvnw test -Dtest='InviteServiceTest'`
Expected: compilation error — `InviteService` missing.

- [ ] **Step 3: Implement `InviteService`**

```java
package io.mrkuhne.mezo.feature.auth.service;

import io.mrkuhne.mezo.feature.auth.entity.InviteEntity;
import io.mrkuhne.mezo.feature.auth.repository.InviteRepository;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Invite codes: minted by the owner (S3 admin API), consumed once by registration. */
@Service
@RequiredArgsConstructor
public class InviteService {

    /** Readable alphabet — no 0/O/1/I, so a code survives being read out loud or handwritten. */
    private static final String ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final SecureRandom RANDOM = new SecureRandom();

    private final InviteRepository inviteRepository;

    public static String generateCode() {
        StringBuilder sb = new StringBuilder("MEZO-");
        for (int i = 0; i < 8; i++) {
            if (i == 4) sb.append('-');
            sb.append(ALPHABET.charAt(RANDOM.nextInt(ALPHABET.length())));
        }
        return sb.toString();
    }

    @Transactional
    public InviteEntity create(UUID createdBy, String label, Instant expiresAt) {
        String code;
        do { code = generateCode(); } while (inviteRepository.existsByCode(code));
        InviteEntity invite = new InviteEntity();
        invite.setCode(code);
        invite.setLabel(label);
        invite.setCreatedBy(createdBy);
        invite.setExpiresAt(expiresAt);
        return inviteRepository.save(invite);
    }

    /**
     * Locks the code row, validates it, and marks it used. Must run inside the caller's
     * transaction (AuthService.register) so the lock spans the user insert.
     */
    @Transactional
    public InviteEntity consume(String rawCode, UUID usedBy) {
        String code = rawCode == null ? "" : rawCode.trim().toUpperCase();
        InviteEntity invite = inviteRepository.findByCodeForUpdate(code)
            .filter(i -> !i.isUsed() && !i.isExpired(Instant.now()))
            .orElseThrow(() -> new SystemRuntimeErrorException(
                SystemMessage.error("AUTH_INVITE_INVALID").build(), HttpStatus.CONFLICT));
        invite.setUsedBy(usedBy);
        invite.setUsedAt(Instant.now());
        return inviteRepository.save(invite);
    }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd backend && ./mvnw test -Dtest='InviteServiceTest'`
Expected: 2 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/auth/service/InviteService.java backend/src/test/java/io/mrkuhne/mezo/feature/auth/service/InviteServiceTest.java
git commit -m "feat(auth): InviteService — readable one-shot codes, locked consumption (mezo-qw37.1)"
```

---

### Task 4: `CurrentUser` — request-cached principal, status check, `requireOwner()`

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/auth/service/CurrentUser.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/techcore/security/CurrentUserId.java`
- Modify: `backend/src/main/resources/messages.properties`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/auth/service/CurrentUserIT.java`

**Interfaces:**
- Produces: `CurrentUser.get() : AppUserEntity` (401 `AUTH_TOKEN_MISSING` without principal; 403 `AUTH_ACCOUNT_DISABLED` when disabled), `CurrentUser.id() : UUID`, `CurrentUser.requireOwner() : AppUserEntity` (403 `AUTH_FORBIDDEN`).
- `CurrentUserId.get()` now equals `currentUser.id()` — every existing controller inherits the status check.

- [ ] **Step 1: Add message codes**

Append to `messages.properties` after `AUTH_TOKEN_MISSING`:

```properties
AUTH_ACCOUNT_DISABLED=Ez a fiók le van tiltva.
AUTH_FORBIDDEN=Ehhez a művelethez nincs jogosultságod.
AUTH_INVITE_INVALID=Ez a meghívó kód nem érvényes.
AUTH_EMAIL_TAKEN=Ezzel az e-mail címmel már van fiók.
```

- [ ] **Step 2: Write the failing IT**

`CurrentUserIT.java` — uses a real login token, then flips status in the DB:

```java
package io.mrkuhne.mezo.feature.auth.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;

class CurrentUserIT extends ApiIntegrationTest {

    @Autowired private AppUserRepository appUserRepository;

    private AppUserEntity owner() {
        return appUserRepository.findByEmail("owner@mezo.local").orElseThrow();
    }

    @Test
    void testProtectedCall_shouldReturn403_whenAccountDisabled() {
        HttpHeaders headers = ownerAuthHeaders(); // token minted while ACTIVE
        AppUserEntity o = owner();
        o.setStatus(AppUserEntity.UserStatus.DISABLED);
        appUserRepository.saveAndFlush(o);
        try {
            String body = getForBody("/api/biometrics/weight", headers, HttpStatus.FORBIDDEN, String.class);
            assertHasRequestError(body, "AUTH_ACCOUNT_DISABLED");
        } finally {
            o.setStatus(AppUserEntity.UserStatus.ACTIVE);
            appUserRepository.saveAndFlush(o);
        }
    }

    @Test
    void testProtectedCall_shouldStampLastSeen_whenFirstSeen() {
        AppUserEntity o = owner();
        o.setLastSeenAt(null);
        appUserRepository.saveAndFlush(o);
        Instant before = Instant.now().minusSeconds(1);
        getForBody("/api/biometrics/weight", ownerAuthHeaders(), HttpStatus.OK, String.class);
        assertThat(owner().getLastSeenAt()).isAfter(before);
    }

    @Test
    void testProtectedCall_shouldNotRestampLastSeen_whenSeenRecently() {
        AppUserEntity o = owner();
        Instant recent = Instant.now().minusSeconds(60);
        o.setLastSeenAt(recent);
        appUserRepository.saveAndFlush(o);
        getForBody("/api/biometrics/weight", ownerAuthHeaders(), HttpStatus.OK, String.class);
        assertThat(owner().getLastSeenAt()).isEqualTo(recent);
    }
}
```

(Note: `ResetDatabase` never touches the owner row, so the `finally` restore matters — a disabled owner would 403 every later test.)

- [ ] **Step 3: Run to verify it fails**

Run: `cd backend && ./mvnw test -Dtest='CurrentUserIT' -Dmezo.test.use-testcontainers=true`
Expected: `testProtectedCall_shouldReturn403_whenAccountDisabled` FAILS (200 instead of 403); the last-seen tests fail on null.

- [ ] **Step 4: Implement `CurrentUser`**

```java
package io.mrkuhne.mezo.feature.auth.service;

import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestAttributes;
import org.springframework.web.context.request.RequestContextHolder;

/**
 * The authenticated account behind the JWT subject, loaded once per request.
 *
 * <p>Every protected request crosses {@link #get()} (via {@code CurrentUserId}), which is where
 * a DISABLED account is rejected — the JWT itself stays valid for 30 days, so this per-request
 * check is the revocation mechanism (spec M1). The loaded entity is cached as a request
 * attribute; on non-request threads (cron) no caching happens.
 */
@Component
@RequiredArgsConstructor
public class CurrentUser {

    static final String REQUEST_ATTR = "mezo.currentUser";
    static final Duration LAST_SEEN_STAMP_INTERVAL = Duration.ofMinutes(5);

    private final AppUserRepository appUserRepository;

    public AppUserEntity get() {
        RequestAttributes attrs = RequestContextHolder.getRequestAttributes();
        if (attrs != null) {
            Object cached = attrs.getAttribute(REQUEST_ATTR, RequestAttributes.SCOPE_REQUEST);
            if (cached instanceof AppUserEntity user) return user;
        }
        AppUserEntity user = load(subjectFromContext());
        if (attrs != null) attrs.setAttribute(REQUEST_ATTR, user, RequestAttributes.SCOPE_REQUEST);
        return user;
    }

    public UUID id() { return get().getId(); }

    public AppUserEntity requireOwner() {
        AppUserEntity user = get();
        if (!user.isOwner()) {
            throw new SystemRuntimeErrorException(
                SystemMessage.error("AUTH_FORBIDDEN").build(), HttpStatus.FORBIDDEN);
        }
        return user;
    }

    private UUID subjectFromContext() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof Jwt jwt)) {
            throw new SystemRuntimeErrorException(
                SystemMessage.error("AUTH_TOKEN_MISSING").build(), HttpStatus.UNAUTHORIZED);
        }
        return UUID.fromString(jwt.getSubject());
    }

    private AppUserEntity load(UUID id) {
        AppUserEntity user = appUserRepository.findById(id)
            .orElseThrow(() -> new SystemRuntimeErrorException(
                SystemMessage.error("AUTH_TOKEN_MISSING").build(), HttpStatus.UNAUTHORIZED));
        if (user.getStatus() == AppUserEntity.UserStatus.DISABLED) {
            throw new SystemRuntimeErrorException(
                SystemMessage.error("AUTH_ACCOUNT_DISABLED").build(), HttpStatus.FORBIDDEN);
        }
        Instant now = Instant.now();
        if (user.getLastSeenAt() == null || user.getLastSeenAt().plus(LAST_SEEN_STAMP_INTERVAL).isBefore(now)) {
            appUserRepository.touchLastSeen(user.getId(), now);
            user.setLastSeenAt(now);
        }
        return user;
    }
}
```

- [ ] **Step 5: Make `CurrentUserId` delegate**

Replace `techcore/security/CurrentUserId.java`:

```java
package io.mrkuhne.mezo.techcore.security;

import io.mrkuhne.mezo.feature.auth.service.CurrentUser;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * The owner key for every controller — the JWT subject, validated against the account row
 * (status check + last-seen stamp) by {@link CurrentUser}. Kept as the existing seam so no
 * controller changes; new code that needs the entity or {@code requireOwner()} injects
 * {@link CurrentUser} directly.
 */
@Component
@RequiredArgsConstructor
public class CurrentUserId {
    private final CurrentUser currentUser;

    public UUID get() {
        return currentUser.id();
    }
}
```

- [ ] **Step 6: Run the IT + ArchUnit + existing auth IT**

Run: `cd backend && ./mvnw test -Dtest='CurrentUserIT,AuthControllerIT,ArchitectureTest' -Dmezo.test.use-testcontainers=true`
Expected: PASS. If ArchUnit flags the techcore→feature import, move `CurrentUserId` next to `CurrentUser` is NOT allowed (would break 100+ imports) — instead add `techcore.security` to that rule's allowlist the same way `SecurityConfig`'s `OwnerProperties` import is tolerated (check the rule at `ArchitectureTest.java` and mirror the existing exception).

- [ ] **Step 7: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/auth/service/CurrentUser.java backend/src/main/java/io/mrkuhne/mezo/techcore/security/CurrentUserId.java backend/src/main/resources/messages.properties backend/src/test/java/io/mrkuhne/mezo/feature/auth/service/CurrentUserIT.java
git commit -m "feat(auth): CurrentUser — per-request account load, DISABLED→403, requireOwner (mezo-qw37.1)"
```

---

### Task 5: Register / login-disabled / me / change-password / onboarding-complete

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/auth/service/AuthService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/auth/controller/AuthController.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/techcore/security/SecurityConfig.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/auth/AuthRegisterIT.java`, `AuthMeIT.java`

**Interfaces:**
- Consumes: `InviteService.consume`, `CurrentUser.get()`.
- Produces: `AuthService.register(RegisterRequest) : TokenResponse`, `AuthService.me(AppUserEntity) : MeResponse`, `AuthService.changePassword(AppUserEntity, ChangePasswordRequest)`, `AuthService.completeOnboarding(AppUserEntity)`, `AuthService.issueToken(AppUserEntity) : TokenResponse`.

- [ ] **Step 1: Write the failing register IT**

`AuthRegisterIT.java`:

```java
package io.mrkuhne.mezo.feature.auth;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.LoginRequest;
import io.mrkuhne.mezo.api.dto.MeResponse;
import io.mrkuhne.mezo.api.dto.RegisterRequest;
import io.mrkuhne.mezo.api.dto.TokenResponse;
import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.auth.entity.InviteEntity;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.auth.repository.InviteRepository;
import io.mrkuhne.mezo.feature.auth.service.InviteService;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;

class AuthRegisterIT extends ApiIntegrationTest {

    @Autowired private InviteService inviteService;
    @Autowired private InviteRepository inviteRepository;
    @Autowired private AppUserRepository appUserRepository;

    private UUID ownerId() {
        return appUserRepository.findByEmail("owner@mezo.local").orElseThrow().getId();
    }

    private RegisterRequest req(String code, String email) {
        return new RegisterRequest(code, email, "titkos-jelszo-1", "Béla");
    }

    @Test
    void testRegister_shouldCreateUserAndConsumeInvite_whenCodeValid() {
        InviteEntity invite = inviteService.create(ownerId(), "Béla", null);
        TokenResponse token = postForBody("/api/auth/register", req(invite.getCode(), "bela@test.local"),
            null, HttpStatus.OK, TokenResponse.class);
        assertThat(token.getToken()).isNotBlank();

        AppUserEntity user = appUserRepository.findByEmail("bela@test.local").orElseThrow();
        assertThat(user.getRole()).isEqualTo(AppUserEntity.UserRole.USER);
        assertThat(user.getStatus()).isEqualTo(AppUserEntity.UserStatus.ACTIVE);
        assertThat(user.isOnboarded()).isFalse();
        InviteEntity used = inviteRepository.findById(invite.getId()).orElseThrow();
        assertThat(used.getUsedBy()).isEqualTo(user.getId());
        assertThat(used.getUsedAt()).isNotNull();

        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token.getToken());
        MeResponse me = getForBody("/api/auth/me", headers, HttpStatus.OK, MeResponse.class);
        assertThat(me.getEmail()).isEqualTo("bela@test.local");
        assertThat(me.getRole()).isEqualTo("USER");
        assertThat(me.getOnboarded()).isFalse();
    }

    @Test
    void testRegister_shouldLowercaseAndTrimCode_whenTyped() {
        InviteEntity invite = inviteService.create(ownerId(), null, null);
        postForBody("/api/auth/register", req("  " + invite.getCode().toLowerCase() + " ", "kis@test.local"),
            null, HttpStatus.OK, TokenResponse.class);
    }

    @Test
    void testRegister_shouldReturn409_whenCodeUnknown() {
        String body = postForBody("/api/auth/register", req("MEZO-XXXX-XXXX", "x@test.local"),
            null, HttpStatus.CONFLICT, String.class);
        assertHasRequestError(body, "AUTH_INVITE_INVALID");
    }

    @Test
    void testRegister_shouldReturn409_whenCodeAlreadyUsed() {
        InviteEntity invite = inviteService.create(ownerId(), null, null);
        postForBody("/api/auth/register", req(invite.getCode(), "first@test.local"), null, HttpStatus.OK, TokenResponse.class);
        String body = postForBody("/api/auth/register", req(invite.getCode(), "second@test.local"),
            null, HttpStatus.CONFLICT, String.class);
        assertHasRequestError(body, "AUTH_INVITE_INVALID");
        assertThat(appUserRepository.existsByEmail("second@test.local")).isFalse();
    }

    @Test
    void testRegister_shouldReturn409_whenCodeExpired() {
        InviteEntity invite = inviteService.create(ownerId(), null, Instant.now().minusSeconds(1));
        String body = postForBody("/api/auth/register", req(invite.getCode(), "late@test.local"),
            null, HttpStatus.CONFLICT, String.class);
        assertHasRequestError(body, "AUTH_INVITE_INVALID");
    }

    @Test
    void testRegister_shouldReturn409AndKeepInvite_whenEmailTaken() {
        InviteEntity invite = inviteService.create(ownerId(), null, null);
        String body = postForBody("/api/auth/register", req(invite.getCode(), "owner@mezo.local"),
            null, HttpStatus.CONFLICT, String.class);
        assertHasRequestError(body, "AUTH_EMAIL_TAKEN");
        assertThat(inviteRepository.findById(invite.getId()).orElseThrow().isUsed()).isFalse();
    }

    @Test
    void testRegister_shouldReturn400_whenPasswordTooShort() {
        InviteEntity invite = inviteService.create(ownerId(), null, null);
        String body = postForBody("/api/auth/register",
            new RegisterRequest(invite.getCode(), "short@test.local", "1234567", "Rövid"),
            null, HttpStatus.BAD_REQUEST, String.class);
        assertHasFieldError(body, "password", "VALIDATION_INVALID_VALUE");
    }

    @Test
    void testLogin_shouldReturn403_whenAccountDisabled() {
        InviteEntity invite = inviteService.create(ownerId(), null, null);
        postForBody("/api/auth/register", req(invite.getCode(), "off@test.local"), null, HttpStatus.OK, TokenResponse.class);
        AppUserEntity user = appUserRepository.findByEmail("off@test.local").orElseThrow();
        user.setStatus(AppUserEntity.UserStatus.DISABLED);
        appUserRepository.saveAndFlush(user);
        String body = postForBody("/api/auth/login", new LoginRequest("off@test.local", "titkos-jelszo-1"),
            null, HttpStatus.FORBIDDEN, String.class);
        assertHasRequestError(body, "AUTH_ACCOUNT_DISABLED");
    }
}
```

- [ ] **Step 2: Write the failing me / change-password / onboarding IT**

`AuthMeIT.java`:

```java
package io.mrkuhne.mezo.feature.auth;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.ChangePasswordRequest;
import io.mrkuhne.mezo.api.dto.LoginRequest;
import io.mrkuhne.mezo.api.dto.MeResponse;
import io.mrkuhne.mezo.api.dto.RegisterRequest;
import io.mrkuhne.mezo.api.dto.TokenResponse;
import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.auth.service.InviteService;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;

class AuthMeIT extends ApiIntegrationTest {

    @Autowired private InviteService inviteService;
    @Autowired private AppUserRepository appUserRepository;

    private HttpHeaders registerFresh(String email) {
        UUID ownerId = appUserRepository.findByEmail("owner@mezo.local").orElseThrow().getId();
        String code = inviteService.create(ownerId, null, null).getCode();
        TokenResponse token = postForBody("/api/auth/register",
            new RegisterRequest(code, email, "titkos-jelszo-1", "Teszt"), null, HttpStatus.OK, TokenResponse.class);
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token.getToken());
        return headers;
    }

    @Test
    void testMe_shouldReturnOwnerShape_whenOwnerToken() {
        MeResponse me = getForBody("/api/auth/me", ownerAuthHeaders(), HttpStatus.OK, MeResponse.class);
        assertThat(me.getEmail()).isEqualTo("owner@mezo.local");
        assertThat(me.getRole()).isEqualTo("OWNER");
        assertThat(me.getOnboarded()).isTrue();
        assertThat(me.getMustChangePassword()).isFalse();
        assertThat(me.getTimezone()).isEqualTo("Europe/Budapest");
    }

    @Test
    void testMe_shouldReturn401_whenNoToken() {
        getForBody("/api/auth/me", null, HttpStatus.UNAUTHORIZED, Void.class);
    }

    @Test
    void testChangePassword_shouldSwapCredentialAndClearFlag_whenCurrentCorrect() {
        HttpHeaders headers = registerFresh("pw@test.local");
        AppUserEntity user = appUserRepository.findByEmail("pw@test.local").orElseThrow();
        user.setMustChangePassword(true);
        appUserRepository.saveAndFlush(user);
        assertThat(getForBody("/api/auth/me", headers, HttpStatus.OK, MeResponse.class).getMustChangePassword()).isTrue();

        postForBody("/api/auth/change-password", new ChangePasswordRequest("titkos-jelszo-1", "uj-jelszo-2026"),
            headers, HttpStatus.NO_CONTENT, Void.class);

        postForBody("/api/auth/login", new LoginRequest("pw@test.local", "titkos-jelszo-1"), null, HttpStatus.UNAUTHORIZED, String.class);
        postForBody("/api/auth/login", new LoginRequest("pw@test.local", "uj-jelszo-2026"), null, HttpStatus.OK, TokenResponse.class);
        assertThat(getForBody("/api/auth/me", headers, HttpStatus.OK, MeResponse.class).getMustChangePassword()).isFalse();
    }

    @Test
    void testChangePassword_shouldReturn401_whenCurrentWrong() {
        HttpHeaders headers = registerFresh("pw2@test.local");
        String body = postForBody("/api/auth/change-password", new ChangePasswordRequest("rossz", "uj-jelszo-2026"),
            headers, HttpStatus.UNAUTHORIZED, String.class);
        assertHasRequestError(body, "AUTH_LOGIN_INVALID_CREDENTIALS");
    }

    @Test
    void testCompleteOnboarding_shouldFlipOnboarded_whenCalled() {
        HttpHeaders headers = registerFresh("ob@test.local");
        assertThat(getForBody("/api/auth/me", headers, HttpStatus.OK, MeResponse.class).getOnboarded()).isFalse();
        postForBody("/api/auth/onboarding-complete", null, headers, HttpStatus.NO_CONTENT, Void.class);
        assertThat(getForBody("/api/auth/me", headers, HttpStatus.OK, MeResponse.class).getOnboarded()).isTrue();
    }
}
```

- [ ] **Step 3: Run to verify they fail**

Run: `cd backend && ./mvnw test -Dtest='AuthRegisterIT,AuthMeIT' -Dmezo.test.use-testcontainers=true`
Expected: compilation failure (controller lacks the methods) or 401/501 responses.

- [ ] **Step 4: Implement `AuthService`**

```java
package io.mrkuhne.mezo.feature.auth.service;

import io.mrkuhne.mezo.api.dto.ChangePasswordRequest;
import io.mrkuhne.mezo.api.dto.LoginRequest;
import io.mrkuhne.mezo.api.dto.MeResponse;
import io.mrkuhne.mezo.api.dto.RegisterRequest;
import io.mrkuhne.mezo.api.dto.TokenResponse;
import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Locale;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final AppUserRepository appUserRepository;
    private final InviteService inviteService;
    private final PasswordEncoder passwordEncoder;
    private final JwtEncoder jwtEncoder;

    public TokenResponse login(LoginRequest req) {
        AppUserEntity user = appUserRepository.findByEmail(normalizeEmail(req.getEmail()))
            .filter(u -> passwordEncoder.matches(req.getPassword(), u.getPasswordHash()))
            .orElseThrow(() -> new SystemRuntimeErrorException(
                SystemMessage.error("AUTH_LOGIN_INVALID_CREDENTIALS").build(), HttpStatus.UNAUTHORIZED));
        if (user.getStatus() == AppUserEntity.UserStatus.DISABLED) {
            throw new SystemRuntimeErrorException(
                SystemMessage.error("AUTH_ACCOUNT_DISABLED").build(), HttpStatus.FORBIDDEN);
        }
        return issueToken(user);
    }

    /**
     * Invite-gated registration, one transaction: the invite row is locked first (so a racing
     * second registration with the same code waits, then sees it used), the email uniqueness is
     * checked, the account is inserted, the invite is marked used.
     */
    @Transactional
    public TokenResponse register(RegisterRequest req) {
        String email = normalizeEmail(req.getEmail());
        if (appUserRepository.existsByEmail(email)) {
            throw new SystemRuntimeErrorException(
                SystemMessage.error("AUTH_EMAIL_TAKEN").build(), HttpStatus.CONFLICT);
        }
        AppUserEntity user = new AppUserEntity();
        user.setEmail(email);
        user.setName(req.getName().trim());
        user.setPasswordHash(passwordEncoder.encode(req.getPassword()));
        user.setRole(AppUserEntity.UserRole.USER);
        user = appUserRepository.save(user);
        inviteService.consume(req.getInviteCode(), user.getId());
        return issueToken(user);
    }

    public MeResponse me(AppUserEntity user) {
        return new MeResponse(user.getId(), user.getEmail(), user.getName(), user.getRole().name(),
            user.isOnboarded(), user.isMustChangePassword(), user.getTimezone());
    }

    @Transactional
    public void changePassword(AppUserEntity user, ChangePasswordRequest req) {
        if (!passwordEncoder.matches(req.getCurrentPassword(), user.getPasswordHash())) {
            throw new SystemRuntimeErrorException(
                SystemMessage.error("AUTH_LOGIN_INVALID_CREDENTIALS").build(), HttpStatus.UNAUTHORIZED);
        }
        user.setPasswordHash(passwordEncoder.encode(req.getNewPassword()));
        user.setMustChangePassword(false);
        appUserRepository.save(user);
    }

    @Transactional
    public void completeOnboarding(AppUserEntity user) {
        if (user.getOnboardedAt() == null) {
            user.setOnboardedAt(Instant.now());
            appUserRepository.save(user);
        }
    }

    public TokenResponse issueToken(AppUserEntity user) {
        Instant now = Instant.now();
        JwtClaimsSet claims = JwtClaimsSet.builder()
            .subject(user.getId().toString())
            .issuedAt(now)
            .expiresAt(now.plus(30, ChronoUnit.DAYS))
            .claim("email", user.getEmail())
            .build();
        // NimbusJwtEncoder cannot infer the JWS algorithm from a symmetric ImmutableSecret,
        // so the HS256 header must be set explicitly (else "Failed to select a JWK signing key").
        JwsHeader header = JwsHeader.with(MacAlgorithm.HS256).build();
        String token = jwtEncoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();
        return new TokenResponse(token);
    }

    private static String normalizeEmail(String email) {
        return email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
    }
}
```

(Check the generated `MeResponse` all-args constructor order matches the schema property order `id, email, name, role, onboarded, mustChangePassword, timezone`; if the generator emits a builder instead, use `MeResponse.builder()…build()`.)

- [ ] **Step 5: Implement `AuthController`**

```java
package io.mrkuhne.mezo.feature.auth.controller;

import io.mrkuhne.mezo.api.controller.AuthApi;
import io.mrkuhne.mezo.api.dto.ChangePasswordRequest;
import io.mrkuhne.mezo.api.dto.LoginRequest;
import io.mrkuhne.mezo.api.dto.MeResponse;
import io.mrkuhne.mezo.api.dto.RegisterRequest;
import io.mrkuhne.mezo.api.dto.TokenResponse;
import io.mrkuhne.mezo.feature.auth.service.AuthService;
import io.mrkuhne.mezo.feature.auth.service.CurrentUser;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.RestController;

/** Implements the generated contract interface — mappings/validation come from {@link AuthApi}. */
@RestController
@RequiredArgsConstructor
public class AuthController implements AuthApi {

    private final AuthService authService;
    private final CurrentUser currentUser;

    @Override
    public TokenResponse login(LoginRequest loginRequest) {
        return authService.login(loginRequest);
    }

    @Override
    public TokenResponse register(RegisterRequest registerRequest) {
        return authService.register(registerRequest);
    }

    @Override
    public MeResponse me() {
        return authService.me(currentUser.get());
    }

    @Override
    public void changePassword(ChangePasswordRequest changePasswordRequest) {
        authService.changePassword(currentUser.get(), changePasswordRequest);
    }

    @Override
    public void completeOnboarding() {
        authService.completeOnboarding(currentUser.get());
    }
}
```

- [ ] **Step 6: Open `/api/auth/register` in `SecurityConfig`**

Change the permitAll line to:

```java
                .requestMatchers("/api/auth/login", "/api/auth/register", "/actuator/health").permitAll()
```

- [ ] **Step 7: Run the ITs**

Run: `cd backend && ./mvnw test -Dtest='AuthRegisterIT,AuthMeIT,AuthControllerIT,CurrentUserIT' -Dmezo.test.use-testcontainers=true`
Expected: all PASS.

- [ ] **Step 8: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/auth backend/src/main/java/io/mrkuhne/mezo/techcore/security/SecurityConfig.java backend/src/test/java/io/mrkuhne/mezo/feature/auth
git commit -m "feat(auth): invite-gated register, me, change-password, onboarding-complete, disabled login 403 (mezo-qw37.1)"
```

---

### Task 6: Test infrastructure — `registerUser()` helper + ownership-isolation smoke IT

**Files:**
- Modify: `backend/src/test/java/io/mrkuhne/mezo/support/ApiIntegrationTest.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/auth/AuthIsolationIT.java`
- Modify: `docs/references/integration_test_framework.md` §"Auth in API Tests"

**Interfaces:**
- Produces: `ApiIntegrationTest.registerUser(String label) : RegisteredUser` where `record RegisteredUser(UUID id, String email, HttpHeaders headers)`.

- [ ] **Step 1: Write the failing isolation IT**

`AuthIsolationIT.java`:

```java
package io.mrkuhne.mezo.feature.auth;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.LogWeightRequest;
import io.mrkuhne.mezo.api.dto.WeightLogResponse;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

/** Smoke proof that two real accounts never see each other's owned rows. */
class AuthIsolationIT extends ApiIntegrationTest {

    @Test
    void testWeightLogs_shouldBeInvisibleAcrossUsers_whenBothLog() {
        RegisteredUser anna = registerUser("Anna");
        RegisteredUser bela = registerUser("Béla");

        postForBody("/api/biometrics/weight", new LogWeightRequest(LocalDate.now(), new BigDecimal("61.0"), null),
            anna.headers(), HttpStatus.CREATED, WeightLogResponse.class);

        List<WeightLogResponse> belaSees = getForList("/api/biometrics/weight", bela.headers(), HttpStatus.OK, WeightLogResponse.class);
        assertThat(belaSees).isEmpty();
        List<WeightLogResponse> annaSees = getForList("/api/biometrics/weight", anna.headers(), HttpStatus.OK, WeightLogResponse.class);
        assertThat(annaSees).hasSize(1);
    }
}
```

(Verify the exact `LogWeightRequest` constructor and the create status code in `api/feature/weight/weight.yml` before running; adjust to the real contract if the field order differs.)

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && ./mvnw test -Dtest='AuthIsolationIT' -Dmezo.test.use-testcontainers=true`
Expected: compilation error — `registerUser`/`RegisteredUser` missing.

- [ ] **Step 3: Add the helper to `ApiIntegrationTest`**

Add imports `io.mrkuhne.mezo.api.dto.RegisterRequest`, `io.mrkuhne.mezo.feature.auth.repository.AppUserRepository`, `io.mrkuhne.mezo.feature.auth.service.InviteService`, `java.util.UUID`; add fields `@Autowired private InviteService inviteService; @Autowired private AppUserRepository appUserRepository;` and, after `ownerAuthHeaders()`:

```java
    /** A freshly registered non-owner account with ready-to-use Bearer headers. */
    protected record RegisteredUser(UUID id, String email, HttpHeaders headers) {}

    /**
     * Registers a brand-new USER through the real invite + register flow (no token forging):
     * the seeded owner mints an invite, the new account consumes it. Use this for every
     * ownership-isolation test — it is the only sanctioned way to obtain a second principal
     * at HTTP level.
     */
    protected RegisteredUser registerUser(String label) {
        UUID ownerId = appUserRepository.findByEmail(ownerProperties.ownerEmail()).orElseThrow().getId();
        String code = inviteService.create(ownerId, label, null).getCode();
        String email = label.toLowerCase().replaceAll("[^a-z0-9]", "") + "-" + UUID.randomUUID().toString().substring(0, 8) + "@test.local";
        TokenResponse token = postForBody("/api/auth/register",
            new RegisterRequest(code, email, "teszt-jelszo-1", label), null, HttpStatus.OK, TokenResponse.class);
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token.getToken());
        UUID id = appUserRepository.findByEmail(email).orElseThrow().getId();
        return new RegisteredUser(id, email, headers);
    }
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd backend && ./mvnw test -Dtest='AuthIsolationIT' -Dmezo.test.use-testcontainers=true`
Expected: PASS.

- [ ] **Step 5: Update the test-framework reference doc**

In `docs/references/integration_test_framework.md`, replace the bullet "Single-user model: no role matrix needed; …" with:

```markdown
- Multi-user model (S1, `mezo-qw37.1`): `registerUser("Anna")` runs the real invite → register
  flow and returns `RegisteredUser(id, email, headers)` — the sanctioned second principal for
  ownership-isolation tests. Roles: the seeded owner is `OWNER`; registered users are `USER`;
  owner-only endpoints get one `USER → 403 AUTH_FORBIDDEN` test each. `UserPopulator` stays for
  service-level tests that only need an FK-valid `created_by`.
```

- [ ] **Step 6: Commit**

```bash
git add backend/src/test/java/io/mrkuhne/mezo/support/ApiIntegrationTest.java backend/src/test/java/io/mrkuhne/mezo/feature/auth/AuthIsolationIT.java docs/references/integration_test_framework.md
git commit -m "test(auth): registerUser() helper + cross-user isolation smoke IT (mezo-qw37.1)"
```

---

### Task 7: `mezo-5h9` — fail-fast on default secrets when strict

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/auth/AuthProperties.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/auth/AuthStartupGuard.java`
- Modify: `backend/src/main/resources/application.yml` (`mezo.auth.strict`), `k8s/backend/deployment.yaml` (env `MEZO_AUTH_STRICT: "true"`)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/auth/AuthStartupGuardTest.java`

**Interfaces:**
- Produces: `AuthStartupGuard.check(OwnerProperties, boolean strict)` — throws `SystemRuntimeErrorException` (INTERNAL_ERROR) listing the offending keys.

- [ ] **Step 1: Write the failing unit test**

```java
package io.mrkuhne.mezo.feature.auth;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import org.junit.jupiter.api.Test;

class AuthStartupGuardTest {

    private static OwnerProperties props(String password, String secret) {
        return new OwnerProperties("owner@mezo.local", password, "Owner", secret);
    }

    @Test
    void testCheck_shouldThrow_whenStrictAndDefaultsActive() {
        assertThatThrownBy(() -> AuthStartupGuard.check(props("owner", AuthStartupGuard.DEFAULT_JWT_SECRET), true))
            .isInstanceOf(SystemRuntimeErrorException.class)
            .hasMessageContaining("owner-password")
            .hasMessageContaining("jwt-secret");
    }

    @Test
    void testCheck_shouldPass_whenStrictAndOverridden() {
        assertThatCode(() -> AuthStartupGuard.check(props("s3cret-pw", "a-real-32-byte-minimum-secret-value-xyz"), true))
            .doesNotThrowAnyException();
    }

    @Test
    void testCheck_shouldPass_whenNotStrict() {
        assertThatCode(() -> AuthStartupGuard.check(props("owner", AuthStartupGuard.DEFAULT_JWT_SECRET), false))
            .doesNotThrowAnyException();
    }
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && ./mvnw test -Dtest='AuthStartupGuardTest'`
Expected: compilation error.

- [ ] **Step 3: Implement properties + guard**

`AuthProperties.java`:

```java
package io.mrkuhne.mezo.feature.auth;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** Binds {@code mezo.auth.strict} — refuse to boot with the dev-default owner password / JWT secret. */
@ConfigurationProperties(prefix = "mezo.auth")
public record AuthProperties(boolean strict) {
}
```

(If `OwnerProperties` and `AuthProperties` clash on the same prefix at bind time, fold `strict` into `OwnerProperties` as a fifth component `boolean strict` instead and delete `AuthProperties` — adjust the test factory accordingly.)

`AuthStartupGuard.java`:

```java
package io.mrkuhne.mezo.feature.auth;

import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.util.ArrayList;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * mezo-5h9: with {@code mezo.auth.strict=true} (set in the k8s deployment) the app refuses to
 * start while the dev defaults for the owner password or the JWT secret are still active.
 * Runs before every seed runner.
 */
@Component
@Order(-1)
@RequiredArgsConstructor
public class AuthStartupGuard implements CommandLineRunner {

    static final String DEFAULT_OWNER_PASSWORD = "owner";
    static final String DEFAULT_JWT_SECRET = "dev-only-change-me-32-bytes-minimum-secret";

    private final OwnerProperties ownerProperties;
    private final AuthProperties authProperties;

    @Override
    public void run(String... args) {
        check(ownerProperties, authProperties.strict());
    }

    static void check(OwnerProperties props, boolean strict) {
        if (!strict) return;
        List<String> offending = new ArrayList<>();
        if (DEFAULT_OWNER_PASSWORD.equals(props.ownerPassword())) offending.add("mezo.auth.owner-password");
        if (DEFAULT_JWT_SECRET.equals(props.jwtSecret())) offending.add("mezo.auth.jwt-secret");
        if (!offending.isEmpty()) {
            throw new SystemRuntimeErrorException(SystemMessage.error("INTERNAL_ERROR")
                .message("mezo.auth.strict=true but dev defaults are active for: " + String.join(", ", offending))
                .build());
        }
    }
}
```

(If `SystemMessage.error(code).message(...)` is not a builder method, check `SystemMessage.java` for the field name — the builder is Lombok-generated from the fields `code/message/fieldName/exceptionTraceId`.)

Register the new properties class where `OwnerProperties` is enabled (grep `@EnableConfigurationProperties` / `@ConfigurationPropertiesScan` in `backend/src/main/java/io/mrkuhne/mezo`); add `AuthProperties.class` if it is an explicit list.

`application.yml` under `mezo.auth:` add:

```yaml
    # mezo-5h9: refuse to boot with dev-default owner password / JWT secret. true in k8s.
    strict: ${MEZO_AUTH_STRICT:false}
```

`k8s/backend/deployment.yaml`: next to the existing `TZ` env entry add:

```yaml
            - name: MEZO_AUTH_STRICT
              value: "true"
```

- [ ] **Step 4: Run the unit test + a context-boot IT**

Run: `cd backend && ./mvnw test -Dtest='AuthStartupGuardTest,AuthControllerIT' -Dmezo.test.use-testcontainers=true`
Expected: PASS (tests run non-strict).

- [ ] **Step 5: Close `mezo-5h9` and commit**

```bash
bd close mezo-5h9 --reason "AuthStartupGuard (mezo.auth.strict) — S1 multi-user foundation"
git add backend/src/main/java/io/mrkuhne/mezo/feature/auth/AuthProperties.java backend/src/main/java/io/mrkuhne/mezo/feature/auth/AuthStartupGuard.java backend/src/main/resources/application.yml k8s/backend/deployment.yaml backend/src/test/java/io/mrkuhne/mezo/feature/auth/AuthStartupGuardTest.java
git commit -m "feat(auth): fail-fast on dev-default secrets under mezo.auth.strict (mezo-qw37.1, closes mezo-5h9)"
```

---

### Task 8: Frontend — persisted token store, auth events, 401/403 handling in `apiFetch`/`apiSse`

**Files:**
- Create: `frontend/src/data/_client/tokenStore.ts`, `frontend/src/data/_client/authEvents.ts`
- Modify: `frontend/src/data/_client/api.ts`
- Test: `frontend/src/data/_client/tokenStore.test.ts`, `frontend/src/data/_client/api.auth.test.ts`

**Interfaces:**
- Produces: `tokenStore.get() : string | null`, `tokenStore.set(token: string | null)`, `tokenStore.clear()`; `authEvents.onSignedOut(cb: (reason: SignOutReason) => void) : () => void`, `authEvents.emitSignedOut(reason)`, `type SignOutReason = 'expired' | 'disabled' | 'manual'`.
- `api.ts` keeps exporting `setToken` (now writes the store) so existing imports/tests keep working.

- [ ] **Step 1: Write the failing token store test**

`tokenStore.test.ts`:

```ts
import { tokenStore, TOKEN_KEY } from '@/data/_client/tokenStore'

beforeEach(() => localStorage.clear())

test('set persists to localStorage and get reads it back', () => {
  tokenStore.set('abc')
  expect(localStorage.getItem(TOKEN_KEY)).toBe('abc')
  expect(tokenStore.get()).toBe('abc')
})

test('clear removes the token', () => {
  tokenStore.set('abc')
  tokenStore.clear()
  expect(tokenStore.get()).toBeNull()
  expect(localStorage.getItem(TOKEN_KEY)).toBeNull()
})

test('get survives a throwing storage (private mode) by returning the in-memory value', () => {
  tokenStore.set('mem')
  const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
  expect(tokenStore.get()).toBe('mem')
  spy.mockRestore()
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && VITE_USE_MOCK=true pnpm test src/data/_client/tokenStore.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `tokenStore.ts` and `authEvents.ts`**

`tokenStore.ts`:

```ts
/**
 * The bearer token, persisted so a reload does not need a fresh login (S1, mezo-qw37.1).
 * In-memory mirror first, localStorage second — a storage that throws (private mode,
 * blocked site data) degrades to session-only auth instead of crashing boot.
 */
export const TOKEN_KEY = 'mezo.auth.token'

let memory: string | null = null
let loaded = false

function readStorage(): string | null {
  try { return localStorage.getItem(TOKEN_KEY) } catch { return null }
}

export const tokenStore = {
  get(): string | null {
    if (!loaded) { memory = readStorage() ?? memory; loaded = true }
    return memory
  },
  set(token: string | null): void {
    memory = token
    loaded = true
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token)
      else localStorage.removeItem(TOKEN_KEY)
    } catch { /* session-only */ }
  },
  clear(): void { this.set(null) },
}
```

`authEvents.ts`:

```ts
export type SignOutReason = 'expired' | 'disabled' | 'manual'

type Listener = (reason: SignOutReason) => void
const listeners = new Set<Listener>()

/** Module-level bus: apiFetch/apiSse announce a dead session, AuthGate listens. */
export const authEvents = {
  onSignedOut(cb: Listener): () => void {
    listeners.add(cb)
    return () => { listeners.delete(cb) }
  },
  emitSignedOut(reason: SignOutReason): void {
    listeners.forEach((l) => l(reason))
  },
}
```

- [ ] **Step 4: Write the failing `apiFetch` auth test**

`api.auth.test.ts`:

```ts
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE, apiFetch, setToken } from '@/data/_client/api'
import { tokenStore } from '@/data/_client/tokenStore'
import { authEvents } from '@/data/_client/authEvents'

beforeEach(() => { localStorage.clear(); setToken(null) })

test('apiFetch attaches the persisted token as Bearer', async () => {
  let seen: string | null = null
  server.use(http.get(`${API_BASE}/api/ping`, ({ request }) => { seen = request.headers.get('authorization'); return HttpResponse.json({ ok: true }) }))
  tokenStore.set('persisted')
  await apiFetch('/api/ping')
  expect(seen).toBe('Bearer persisted')
})

test('a 401 clears the token and emits signedOut(expired)', async () => {
  server.use(http.get(`${API_BASE}/api/ping`, () => new HttpResponse(null, { status: 401 })))
  setToken('stale')
  const reasons: string[] = []
  const off = authEvents.onSignedOut((r) => reasons.push(r))
  await expect(apiFetch('/api/ping')).rejects.toMatchObject({ status: 401 })
  expect(tokenStore.get()).toBeNull()
  expect(reasons).toEqual(['expired'])
  off()
})

test('a 403 AUTH_ACCOUNT_DISABLED clears the token and emits signedOut(disabled)', async () => {
  server.use(http.get(`${API_BASE}/api/ping`, () =>
    HttpResponse.json([{ code: 'AUTH_ACCOUNT_DISABLED', message: 'x' }], { status: 403 })))
  setToken('t')
  const reasons: string[] = []
  const off = authEvents.onSignedOut((r) => reasons.push(r))
  await expect(apiFetch('/api/ping')).rejects.toMatchObject({ status: 403 })
  expect(tokenStore.get()).toBeNull()
  expect(reasons).toEqual(['disabled'])
  off()
})

test('a 403 AUTH_FORBIDDEN keeps the token (not a session problem)', async () => {
  server.use(http.get(`${API_BASE}/api/ping`, () =>
    HttpResponse.json([{ code: 'AUTH_FORBIDDEN', message: 'x' }], { status: 403 })))
  setToken('t')
  await expect(apiFetch('/api/ping')).rejects.toMatchObject({ status: 403 })
  expect(tokenStore.get()).toBe('t')
})

test('a 401 on /api/auth/login does NOT emit signedOut (wrong password is not a dead session)', async () => {
  server.use(http.post(`${API_BASE}/api/auth/login`, () =>
    HttpResponse.json([{ code: 'AUTH_LOGIN_INVALID_CREDENTIALS', message: 'x' }], { status: 401 })))
  const reasons: string[] = []
  const off = authEvents.onSignedOut((r) => reasons.push(r))
  await expect(apiFetch('/api/auth/login', { method: 'POST', body: '{}' })).rejects.toMatchObject({ status: 401 })
  expect(reasons).toEqual([])
  off()
})
```

- [ ] **Step 5: Run to verify it fails**

Run: `cd frontend && VITE_USE_MOCK=false pnpm test src/data/_client/api.auth.test.ts`
Expected: the Bearer test fails (module-level token ignores the store), the event tests fail.

- [ ] **Step 6: Modify `api.ts`**

Replace the token lines and the error branch:

```ts
import { tokenStore } from '@/data/_client/tokenStore'
import { authEvents } from '@/data/_client/authEvents'

/** Writes the persisted token store — kept as the historical name so callers/tests do not move. */
export function setToken(t: string | null) { tokenStore.set(t) }

/** Public auth paths where a 401 means "wrong credentials", never "your session died". */
const PUBLIC_AUTH_PATHS = ['/api/auth/login', '/api/auth/register', '/api/auth/change-password']

/**
 * Session-death detection shared by apiFetch and apiSse: a 401 anywhere protected, or a 403
 * carrying AUTH_ACCOUNT_DISABLED, drops the token and tells AuthGate to show the login screen.
 * A 403 AUTH_FORBIDDEN (owner-only endpoint) is a permission problem, not a session one.
 */
function handleAuthFailure(path: string, status: number, messages: SystemMessage[]): void {
  if (PUBLIC_AUTH_PATHS.includes(path)) return
  if (status === 401) { tokenStore.clear(); authEvents.emitSignedOut('expired'); return }
  if (status === 403 && messages.some((m) => m.code === 'AUTH_ACCOUNT_DISABLED')) {
    tokenStore.clear(); authEvents.emitSignedOut('disabled')
  }
}

function authHeader(): Record<string, string> {
  const token = tokenStore.get()
  return token ? { Authorization: `Bearer ${token}` } : {}
}
```

In `apiFetch`: replace `...(token ? { Authorization: \`Bearer ${token}\` } : {})` with `...authHeader()`, and in the `!res.ok` branch, after computing the messages array and before `throw`:

```ts
    const messages = Array.isArray(body) && body.length ? body : [{ code: 'INTERNAL_ERROR', message: `HTTP ${res.status}` }]
    handleAuthFailure(path, res.status, messages)
    throw new ApiError(messages, res.status)
```

Apply the same two changes inside `apiSse` (its header spread and its non-OK branch). Delete the old `let token` line.

- [ ] **Step 7: Run both test files + the existing SSE test**

Run: `cd frontend && VITE_USE_MOCK=false pnpm test src/data/_client/`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/data/_client/tokenStore.ts frontend/src/data/_client/authEvents.ts frontend/src/data/_client/api.ts frontend/src/data/_client/tokenStore.test.ts frontend/src/data/_client/api.auth.test.ts
git commit -m "feat(fe): persisted token store, signed-out bus, 401/403 session handling in apiFetch/apiSse (mezo-qw37.1)"
```

---

### Task 9: Frontend — `authApi`, `useMe` / `useAuthActions`, MSW handlers

**Files:**
- Create: `frontend/src/data/auth/authApi.ts`, `frontend/src/data/auth/authHooks.ts`, `frontend/src/data/auth/authMock.ts`
- Modify: `frontend/src/data/hooks.ts`, `frontend/src/test/msw/handlers.ts`
- Test: `frontend/src/data/auth/authHooks.test.tsx`

**Interfaces:**
- Produces: `authApi.login(LoginRequest)`, `authApi.register(RegisterRequest)`, `authApi.me()`, `authApi.changePassword(ChangePasswordRequest)`, `authApi.completeOnboarding()`; `useMe()` → `{ data: MeResponse | undefined, isPending, error }` (mock mode: static `mockMe`); `useAuthActions()` → `{ login, register, changePassword, completeOnboarding, logout }` mutations/functions; `ME_QUERY_KEY = ['auth', 'me']`.

- [ ] **Step 1: Write the failing hook test**

`authHooks.test.tsx`:

```tsx
import { renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { makeHookWrapper } from '@/test/queryWrapper'
import { API_BASE, setToken } from '@/data/_client/api'
import { useMe, useAuthActions } from '@/data/auth/authHooks'
import { tokenStore } from '@/data/_client/tokenStore'

afterEach(() => { vi.unstubAllEnvs(); localStorage.clear(); setToken(null) })

test('mock mode: useMe returns the static owner without fetching', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  const { result } = renderHook(() => useMe(), { wrapper: makeHookWrapper() })
  await waitFor(() => expect(result.current.data?.name).toBe('Daniel'))
  expect(result.current.data?.role).toBe('OWNER')
})

test('real mode: useMe fetches /api/auth/me', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  setToken('t')
  const { result } = renderHook(() => useMe(), { wrapper: makeHookWrapper() })
  await waitFor(() => expect(result.current.data?.email).toBe('owner@mezo.local'))
})

test('real mode: login stores the token', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  server.use(http.post(`${API_BASE}/api/auth/login`, () => HttpResponse.json({ token: 'fresh' })))
  const { result } = renderHook(() => useAuthActions(), { wrapper: makeHookWrapper() })
  await result.current.login({ email: 'a@b.c', password: 'x' })
  expect(tokenStore.get()).toBe('fresh')
})

test('logout clears the token and the query cache', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  setToken('t')
  const wrapper = makeHookWrapper()
  const me = renderHook(() => useMe(), { wrapper })
  await waitFor(() => expect(me.result.current.data).toBeDefined())
  const actions = renderHook(() => useAuthActions(), { wrapper })
  actions.result.current.logout()
  expect(tokenStore.get()).toBeNull()
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && VITE_USE_MOCK=false pnpm test src/data/auth/`
Expected: FAIL — modules missing.

- [ ] **Step 3: Add MSW handlers**

In `frontend/src/test/msw/handlers.ts`, after the existing login handler:

```ts
  http.post(`${API_BASE}/api/auth/register`, () => HttpResponse.json({ token: 'test-token' })),
  http.get(`${API_BASE}/api/auth/me`, () =>
    HttpResponse.json({
      id: '00000000-0000-0000-0000-000000000001', email: 'owner@mezo.local', name: 'Owner',
      role: 'OWNER', onboarded: true, mustChangePassword: false, timezone: 'Europe/Budapest',
    }),
  ),
  http.post(`${API_BASE}/api/auth/change-password`, () => new HttpResponse(null, { status: 204 })),
  http.post(`${API_BASE}/api/auth/onboarding-complete`, () => new HttpResponse(null, { status: 204 })),
```

- [ ] **Step 4: Implement `authApi.ts`, `authMock.ts`, `authHooks.ts`**

`authApi.ts`:

```ts
import { apiFetch, setToken } from '@/data/_client/api'
import type { components } from '@/data/_client/api.gen'

export type LoginRequest = components['schemas']['LoginRequest']
export type RegisterRequest = components['schemas']['RegisterRequest']
export type ChangePasswordRequest = components['schemas']['ChangePasswordRequest']
export type MeResponse = components['schemas']['MeResponse']
type TokenResponse = components['schemas']['TokenResponse']

export const authApi = {
  login: async (body: LoginRequest): Promise<void> => {
    const { token } = await apiFetch<TokenResponse>('/api/auth/login', { method: 'POST', body: JSON.stringify(body) })
    setToken(token)
  },
  register: async (body: RegisterRequest): Promise<void> => {
    const { token } = await apiFetch<TokenResponse>('/api/auth/register', { method: 'POST', body: JSON.stringify(body) })
    setToken(token)
  },
  me: (): Promise<MeResponse> => apiFetch<MeResponse>('/api/auth/me'),
  changePassword: (body: ChangePasswordRequest): Promise<void> =>
    apiFetch<void>('/api/auth/change-password', { method: 'POST', body: JSON.stringify(body) }),
  completeOnboarding: (): Promise<void> =>
    apiFetch<void>('/api/auth/onboarding-complete', { method: 'POST' }),
}
```

`authMock.ts`:

```ts
import type { MeResponse } from '@/data/auth/authApi'
import { user } from '@/data/today/today'

/** Mock-mode identity — mirrors the static `user` seed so the Én hero and headers stay in sync. */
export const mockMe: MeResponse = {
  id: '00000000-0000-0000-0000-00000000mock',
  email: 'daniel@mezo.local',
  name: user.name,
  role: 'OWNER',
  onboarded: true,
  mustChangePassword: false,
  timezone: 'Europe/Budapest',
}
```

`authHooks.ts`:

```ts
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { isMockMode } from '@/data/_client/mode'
import { tokenStore } from '@/data/_client/tokenStore'
import { authEvents } from '@/data/_client/authEvents'
import { authApi, type ChangePasswordRequest, type LoginRequest, type RegisterRequest } from '@/data/auth/authApi'
import { mockMe } from '@/data/auth/authMock'

export const ME_QUERY_KEY = ['auth', 'me'] as const

/**
 * The signed-in account. Mock mode: the static owner, synchronous. Real mode: GET /api/auth/me,
 * only enabled while a token exists (no token = signed out, nothing to ask). Never falls back
 * to the mock in real mode (dual-mode read invariant).
 */
export function useMe() {
  const mock = isMockMode()
  return useQuery({
    queryKey: ME_QUERY_KEY,
    queryFn: authApi.me,
    ...(mock
      ? { initialData: mockMe, staleTime: Infinity }
      : { enabled: tokenStore.get() != null, retry: false }),
  })
}

export function useAuthActions() {
  const client = useQueryClient()
  const refresh = () => client.invalidateQueries({ queryKey: ME_QUERY_KEY })
  return {
    login: async (body: LoginRequest) => { await authApi.login(body); await refresh() },
    register: async (body: RegisterRequest) => { await authApi.register(body); await refresh() },
    changePassword: async (body: ChangePasswordRequest) => { await authApi.changePassword(body); await refresh() },
    completeOnboarding: async () => { await authApi.completeOnboarding(); await refresh() },
    logout: () => { tokenStore.clear(); client.clear(); authEvents.emitSignedOut('manual') },
  }
}
```

Add to `frontend/src/data/hooks.ts`:

```ts
export { useMe, useAuthActions, ME_QUERY_KEY } from '@/data/auth/authHooks'
```

- [ ] **Step 5: Run to verify it passes**

Run: `cd frontend && VITE_USE_MOCK=false pnpm test src/data/auth/ && VITE_USE_MOCK=true pnpm test src/data/auth/`
Expected: PASS in both modes.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/data/auth frontend/src/data/hooks.ts frontend/src/test/msw/handlers.ts
git commit -m "feat(fe): authApi + useMe/useAuthActions with mock identity and MSW handlers (mezo-qw37.1)"
```

---

### Task 10: Frontend — boot state machine (`authState.ts`) + `AuthGate`

**Files:**
- Create: `frontend/src/app/auth/authState.ts`, `frontend/src/app/auth/AuthGate.tsx`
- Modify: `frontend/src/app/providers/QueryProvider.tsx`
- Delete: `frontend/src/data/_client/auth.ts`
- Test: `frontend/src/app/auth/authState.test.ts`, `frontend/src/app/auth/AuthGate.test.tsx`

**Interfaces:**
- Produces: `type AuthPhase = 'pending' | 'signedOut' | 'mustChangePassword' | 'ready' | 'failed'`; `deriveFromMe(me: MeResponse) : AuthPhase`; `deriveFromError(err: unknown) : AuthPhase` (401/403 → signedOut, network/5xx → failed); `<AuthGate>{children}</AuthGate>` renders `LoginPage`/`RegisterPage`/`ChangePasswordPage`/the degraded screen/children.
- Consumes: `useMe`, `useAuthActions`, `authEvents`, `tokenStore`, the pages from Task 11 (until Task 11 lands, AuthGate imports them — implement Task 11's pages in the same commit if the build breaks; the tasks are split for review, not for compilation).

- [ ] **Step 1: Write the failing pure-state tests**

`authState.test.ts`:

```ts
import { ApiError } from '@/data/_client/api'
import { deriveFromError, deriveFromMe } from '@/app/auth/authState'

const me = { id: '1', email: 'a@b.c', name: 'A', role: 'USER', onboarded: true, mustChangePassword: false, timezone: 'Europe/Budapest' }

test('an onboarded user with a fresh password is ready', () => {
  expect(deriveFromMe(me)).toBe('ready')
})

test('must-change-password wins over everything', () => {
  expect(deriveFromMe({ ...me, mustChangePassword: true, onboarded: false })).toBe('mustChangePassword')
})

test('a 401/403 on me means the session is dead', () => {
  expect(deriveFromError(new ApiError([{ code: 'AUTH_TOKEN_MISSING', message: '' }], 401))).toBe('signedOut')
  expect(deriveFromError(new ApiError([{ code: 'AUTH_ACCOUNT_DISABLED', message: '' }], 403))).toBe('signedOut')
})

test('a network error or 5xx is a degraded boot, not a logout', () => {
  expect(deriveFromError(new TypeError('Failed to fetch'))).toBe('failed')
  expect(deriveFromError(new ApiError([{ code: 'INTERNAL_ERROR', message: '' }], 503))).toBe('failed')
})
```

(`onboarded: false` maps to `'ready'` in S1 — the onboarding branch is S2's `OnboardingPage`; `deriveFromMe` gets the `onboarding` phase then.)

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && VITE_USE_MOCK=true pnpm test src/app/auth/authState.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement `authState.ts`**

```ts
import { ApiError } from '@/data/_client/api'
import type { MeResponse } from '@/data/auth/authApi'

export type AuthPhase = 'pending' | 'signedOut' | 'mustChangePassword' | 'ready' | 'failed'

/** Boot decision from a successful /api/auth/me. */
export function deriveFromMe(me: MeResponse): AuthPhase {
  if (me.mustChangePassword) return 'mustChangePassword'
  return 'ready'
}

/** Boot decision from a failed /api/auth/me: dead session vs unreachable backend. */
export function deriveFromError(err: unknown): AuthPhase {
  if (err instanceof ApiError && (err.status === 401 || err.status === 403)) return 'signedOut'
  return 'failed'
}
```

- [ ] **Step 4: Write the failing `AuthGate` test**

`AuthGate.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE, setToken } from '@/data/_client/api'
import { AuthGate } from '@/app/auth/AuthGate'
import { QueryWrapper } from '@/test/queryWrapper'
import { authEvents } from '@/data/_client/authEvents'

afterEach(() => { vi.unstubAllEnvs(); localStorage.clear(); setToken(null) })

const App = () => <div>APP</div>
const renderGate = () => render(<QueryWrapper><AuthGate><App /></AuthGate></QueryWrapper>)

test('mock mode renders the app immediately', () => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  renderGate()
  expect(screen.getByText('APP')).toBeInTheDocument()
})

test('no token → login page', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  renderGate()
  expect(await screen.findByRole('heading', { name: 'Bejelentkezés' })).toBeInTheDocument()
})

test('valid token → me → app', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  setToken('t')
  renderGate()
  expect(await screen.findByText('APP')).toBeInTheDocument()
})

test('must-change-password → change-password page', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  server.use(http.get(`${API_BASE}/api/auth/me`, () => HttpResponse.json({
    id: '1', email: 'a@b.c', name: 'A', role: 'USER', onboarded: true, mustChangePassword: true, timezone: 'Europe/Budapest',
  })))
  setToken('t')
  renderGate()
  expect(await screen.findByRole('heading', { name: 'Új jelszó' })).toBeInTheDocument()
})

test('backend unreachable → degraded screen with retry', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  server.use(http.get(`${API_BASE}/api/auth/me`, () => HttpResponse.error()))
  setToken('t')
  renderGate()
  expect(await screen.findByText('Nem érem el a szervert')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Újra' })).toBeInTheDocument()
})

test('a signedOut event while ready drops back to the login page', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  setToken('t')
  renderGate()
  await screen.findByText('APP')
  setToken(null)
  authEvents.emitSignedOut('expired')
  expect(await screen.findByRole('heading', { name: 'Bejelentkezés' })).toBeInTheDocument()
  expect(screen.getByText('A munkameneted lejárt, jelentkezz be újra.')).toBeInTheDocument()
})

test('login page → register link → register page and back', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  renderGate()
  await userEvent.click(await screen.findByRole('button', { name: 'Van meghívó kódod?' }))
  expect(await screen.findByRole('heading', { name: 'Regisztráció' })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Vissza a belépéshez' }))
  expect(await screen.findByRole('heading', { name: 'Bejelentkezés' })).toBeInTheDocument()
})
```

- [ ] **Step 5: Implement `AuthGate.tsx`**

```tsx
import { useEffect, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { isMockMode } from '@/data/_client/mode'
import { tokenStore } from '@/data/_client/tokenStore'
import { authEvents, type SignOutReason } from '@/data/_client/authEvents'
import { authApi } from '@/data/auth/authApi'
import { ME_QUERY_KEY } from '@/data/auth/authHooks'
import { deriveFromError, deriveFromMe, type AuthPhase } from '@/app/auth/authState'
import { LoginPage } from '@/features/auth/pages/LoginPage'
import { RegisterPage } from '@/features/auth/pages/RegisterPage'
import { ChangePasswordPage } from '@/features/auth/pages/ChangePasswordPage'

/** Backoff between boot attempts (mezo-l0k0 semantics kept from the old owner bootstrap). */
const BOOT_RETRY_DELAYS_MS = [500, 1500, 4000]
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const SIGN_OUT_NOTICE: Record<SignOutReason, string | undefined> = {
  expired: 'A munkameneted lejárt, jelentkezz be újra.',
  disabled: 'Ezt a fiókot letiltották.',
  manual: undefined,
}

/**
 * Boot gate (S1, mezo-qw37.1): decides between the auth pages and the app from the persisted
 * token + GET /api/auth/me. Mock mode short-circuits to the app. Renders the auth pages itself
 * (outside the router) so they carry no app chrome.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const mock = isMockMode()
  const client = useQueryClient()
  const [phase, setPhase] = useState<AuthPhase>(mock ? 'ready' : 'pending')
  const [authView, setAuthView] = useState<'login' | 'register'>('login')
  const [notice, setNotice] = useState<string | undefined>(undefined)
  const [attemptNonce, setAttemptNonce] = useState(0)

  // Boot: no token → login; token → me (with backoff on network failure).
  useEffect(() => {
    if (mock) return
    if (tokenStore.get() == null) { setPhase('signedOut'); return }
    let cancelled = false
    setPhase('pending')
    ;(async () => {
      for (let attempt = 0; ; attempt++) {
        try {
          const me = await authApi.me()
          client.setQueryData(ME_QUERY_KEY, me)
          if (!cancelled) setPhase(deriveFromMe(me))
          return
        } catch (err) {
          const next = deriveFromError(err)
          if (next === 'signedOut') { if (!cancelled) setPhase('signedOut'); return }
          console.error(`Auth boot failed (attempt ${attempt + 1})`, err)
          if (attempt >= BOOT_RETRY_DELAYS_MS.length) { if (!cancelled) setPhase('failed'); return }
          await sleep(BOOT_RETRY_DELAYS_MS[attempt])
          if (cancelled) return
        }
      }
    })()
    return () => { cancelled = true }
  }, [mock, attemptNonce, client])

  // A dead session announced by apiFetch/apiSse or a manual logout.
  useEffect(() => authEvents.onSignedOut((reason) => {
    setNotice(SIGN_OUT_NOTICE[reason])
    setAuthView('login')
    setPhase('signedOut')
  }), [])

  const onAuthenticated = async () => {
    setNotice(undefined)
    const me = await authApi.me()
    client.setQueryData(ME_QUERY_KEY, me)
    setPhase(deriveFromMe(me))
  }

  if (phase === 'pending') return null
  if (phase === 'signedOut') {
    return authView === 'login'
      ? <LoginPage notice={notice} onSuccess={onAuthenticated} onRegister={() => setAuthView('register')} />
      : <RegisterPage onSuccess={onAuthenticated} onBack={() => setAuthView('login')} />
  }
  if (phase === 'mustChangePassword') return <ChangePasswordPage forced onSuccess={onAuthenticated} />
  if (phase === 'failed') {
    return (
      <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 24, background: 'var(--surface-base, #FDFAF4)', color: 'var(--text-primary, #2B2118)' }}>
        <div style={{ textAlign: 'center', maxWidth: 320 }}>
          <p style={{ fontSize: 15, fontWeight: 700 }}>Nem érem el a szervert</p>
          <p style={{ fontSize: 12.5, lineHeight: 1.5, marginTop: 8, color: 'var(--text-secondary, #6E6257)' }}>
            Az app nem tud bejelentkezni — lehet, hogy a backend épp újraindul. Adatot most nem tudsz menteni.
          </p>
          <button type="button" className="cta-primary" style={{ marginTop: 16, padding: '10px 28px' }} onClick={() => setAttemptNonce((n) => n + 1)}>
            Újra
          </button>
        </div>
      </div>
    )
  }
  return <>{children}</>
}
```

- [ ] **Step 6: Slim `QueryProvider` to "always provide the client, gate inside"**

Replace `QueryProvider.tsx` body after the `client` definition with:

```tsx
export function QueryProvider({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={client}>
      <AuthGate>{children}</AuthGate>
    </QueryClientProvider>
  )
}
```

Remove the `useEffect/useState`, `bootstrapOwnerToken`, `isMockMode`, `BOOTSTRAP_RETRY_DELAYS_MS`, `sleep`, `BootState` and the degraded JSX (they moved into `AuthGate`). Add `import { AuthGate } from '@/app/auth/AuthGate'`. Keep the `MutationCache`/`defaultOptions` unchanged.

Delete `frontend/src/data/_client/auth.ts`:
```bash
git rm frontend/src/data/_client/auth.ts
grep -rn "bootstrapOwnerToken\|VITE_OWNER" frontend/src frontend/.env.example frontend/Dockerfile .github/workflows/deploy.yml
```
Fix every hit: remove the two `VITE_OWNER_*` lines from `.env.example`, the comment line in `Dockerfile`, the two `env:` lines in `deploy.yml`, and any `vite-env.d.ts` declarations.

- [ ] **Step 7: Run the gate tests (needs Task 11's pages — implement Task 11 now, then run)**

Run: `cd frontend && VITE_USE_MOCK=false pnpm test src/app/auth/ && VITE_USE_MOCK=true pnpm test src/app/auth/`
Expected: PASS once Task 11's pages exist.

- [ ] **Step 8: Commit (together with Task 11's files if built in one go)**

```bash
git add frontend/src/app/auth frontend/src/app/providers/QueryProvider.tsx frontend/.env.example frontend/Dockerfile .github/workflows/deploy.yml
git commit -m "feat(fe): AuthGate boot state machine replaces owner-token bootstrap (mezo-qw37.1)"
```

---

### Task 11: Frontend — `AuthShell`, `LoginPage`, `RegisterPage`, `ChangePasswordPage`

**Files:**
- Create: `frontend/src/features/auth/components/AuthShell.tsx`, `frontend/src/features/auth/pages/LoginPage.tsx`, `RegisterPage.tsx`, `ChangePasswordPage.tsx`, `frontend/src/features/auth/logic/authErrorText.ts`
- Test: `frontend/src/features/auth/pages/LoginPage.test.tsx`, `RegisterPage.test.tsx`, `ChangePasswordPage.test.tsx`, `frontend/src/features/auth/logic/authErrorText.test.ts`

**Interfaces:**
- Produces: `LoginPage({ notice?, onSuccess, onRegister })`, `RegisterPage({ onSuccess, onBack })`, `ChangePasswordPage({ forced?, onSuccess, onCancel? })`, `authErrorText(err: unknown) : string`.
- Consumes: `useAuthActions()` from `@/data/hooks`, `ApiError` from `@/data/_client/api`.

- [ ] **Step 1: Write the failing error-text test**

`authErrorText.test.ts`:

```ts
import { ApiError } from '@/data/_client/api'
import { authErrorText } from '@/features/auth/logic/authErrorText'

const api = (code: string, status: number) => new ApiError([{ code, message: 'server text' }], status)

test('maps the auth codes to Hungarian copy', () => {
  expect(authErrorText(api('AUTH_LOGIN_INVALID_CREDENTIALS', 401))).toBe('Hibás e-mail vagy jelszó.')
  expect(authErrorText(api('AUTH_ACCOUNT_DISABLED', 403))).toBe('Ezt a fiókot letiltották.')
  expect(authErrorText(api('AUTH_INVITE_INVALID', 409))).toBe('Ez a meghívó kód nem érvényes.')
  expect(authErrorText(api('AUTH_EMAIL_TAKEN', 409))).toBe('Ezzel az e-mail címmel már van fiók.')
})

test('field validation names the field', () => {
  const err = new ApiError([{ code: 'VALIDATION_INVALID_VALUE', message: 'x', fieldName: 'password' }], 400)
  expect(authErrorText(err)).toBe('A jelszó legalább 8 karakter legyen.')
})

test('anything else is a generic retry line', () => {
  expect(authErrorText(new TypeError('Failed to fetch'))).toBe('Nem sikerült kapcsolódni. Próbáld újra.')
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && VITE_USE_MOCK=true pnpm test src/features/auth/logic/`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement `authErrorText.ts`**

```ts
import { ApiError } from '@/data/_client/api'

const BY_CODE: Record<string, string> = {
  AUTH_LOGIN_INVALID_CREDENTIALS: 'Hibás e-mail vagy jelszó.',
  AUTH_ACCOUNT_DISABLED: 'Ezt a fiókot letiltották.',
  AUTH_INVITE_INVALID: 'Ez a meghívó kód nem érvényes.',
  AUTH_EMAIL_TAKEN: 'Ezzel az e-mail címmel már van fiók.',
}

const BY_FIELD: Record<string, string> = {
  password: 'A jelszó legalább 8 karakter legyen.',
  newPassword: 'A jelszó legalább 8 karakter legyen.',
  email: 'Adj meg egy érvényes e-mail címet.',
  inviteCode: 'Add meg a meghívó kódot.',
  name: 'Add meg a neved.',
}

/** Server error → one Hungarian line for the auth forms. Codes are the contract, not message text. */
export function authErrorText(err: unknown): string {
  if (err instanceof ApiError) {
    for (const m of err.messages) {
      if (m.fieldName && BY_FIELD[m.fieldName]) return BY_FIELD[m.fieldName]
      if (BY_CODE[m.code]) return BY_CODE[m.code]
    }
  }
  return 'Nem sikerült kapcsolódni. Próbáld újra.'
}
```

- [ ] **Step 4: Implement `AuthShell.tsx`**

```tsx
import type { ReactNode } from 'react'

/**
 * Chrome-free frame for the auth pages: full-height, centered card, same surface tokens the
 * degraded boot screen uses. No PhoneFrame — these render outside the router/AppLayout.
 */
export function AuthShell({ title, children, footer }: { title: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 24, background: 'var(--surface-base, #FDFAF4)', color: 'var(--text-primary, #2B2118)' }}>
      <div className="col gap-lg" style={{ width: '100%', maxWidth: 360 }}>
        <div className="col gap-xs" style={{ textAlign: 'center' }}>
          <span style={{ fontSize: 28, fontWeight: 800, letterSpacing: -0.5 }}>mezo</span>
          <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{title}</h1>
        </div>
        {children}
        {footer && <div style={{ textAlign: 'center', fontSize: 13 }}>{footer}</div>}
      </div>
    </div>
  )
}

export const fieldStyle: React.CSSProperties = {
  width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid var(--border-subtle, #E5DED2)',
  background: 'var(--surface-2, #FFFFFF)', color: 'inherit', fontSize: 15,
}

export function ErrorLine({ text }: { text?: string }) {
  if (!text) return null
  return <p role="alert" style={{ margin: 0, fontSize: 13, color: 'var(--coral-deep, #C2412D)' }}>{text}</p>
}
```

- [ ] **Step 5: Write the failing `LoginPage` test**

`LoginPage.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE, setToken } from '@/data/_client/api'
import { QueryWrapper } from '@/test/queryWrapper'
import { LoginPage } from '@/features/auth/pages/LoginPage'

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
afterEach(() => { vi.unstubAllEnvs(); setToken(null) })

test('submits email + password and calls onSuccess', async () => {
  const onSuccess = vi.fn()
  render(<QueryWrapper><LoginPage onSuccess={onSuccess} onRegister={() => {}} /></QueryWrapper>)
  await userEvent.type(screen.getByLabelText('E-mail'), 'a@b.c')
  await userEvent.type(screen.getByLabelText('Jelszó'), 'titkos-1')
  await userEvent.click(screen.getByRole('button', { name: 'Belépés' }))
  await waitFor(() => expect(onSuccess).toHaveBeenCalled())
})

test('shows the credential error inline on 401', async () => {
  server.use(http.post(`${API_BASE}/api/auth/login`, () =>
    HttpResponse.json([{ code: 'AUTH_LOGIN_INVALID_CREDENTIALS', message: 'x' }], { status: 401 })))
  render(<QueryWrapper><LoginPage onSuccess={() => {}} onRegister={() => {}} /></QueryWrapper>)
  await userEvent.type(screen.getByLabelText('E-mail'), 'a@b.c')
  await userEvent.type(screen.getByLabelText('Jelszó'), 'rossz')
  await userEvent.click(screen.getByRole('button', { name: 'Belépés' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Hibás e-mail vagy jelszó.')
})

test('renders the notice and the register link', async () => {
  const onRegister = vi.fn()
  render(<QueryWrapper><LoginPage notice="A munkameneted lejárt, jelentkezz be újra." onSuccess={() => {}} onRegister={onRegister} /></QueryWrapper>)
  expect(screen.getByText('A munkameneted lejárt, jelentkezz be újra.')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Van meghívó kódod?' }))
  expect(onRegister).toHaveBeenCalled()
})
```

- [ ] **Step 6: Implement `LoginPage.tsx`**

```tsx
import { useState, type FormEvent } from 'react'
import { useAuthActions } from '@/data/hooks'
import { AuthShell, ErrorLine, fieldStyle } from '@/features/auth/components/AuthShell'
import { authErrorText } from '@/features/auth/logic/authErrorText'

export function LoginPage({ notice, onSuccess, onRegister }: { notice?: string; onSuccess: () => void | Promise<void>; onRegister: () => void }) {
  const { login } = useAuthActions()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | undefined>()
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true); setError(undefined)
    try { await login({ email: email.trim(), password }); await onSuccess() }
    catch (err) { setError(authErrorText(err)) }
    finally { setBusy(false) }
  }

  return (
    <AuthShell title="Bejelentkezés" footer={<button type="button" onClick={onRegister} style={{ textDecoration: 'underline' }}>Van meghívó kódod?</button>}>
      <form className="col gap-md" onSubmit={submit}>
        {notice && <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary, #6E6257)', textAlign: 'center' }}>{notice}</p>}
        <label className="col gap-xs">E-mail
          <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} style={fieldStyle} />
        </label>
        <label className="col gap-xs">Jelszó
          <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} style={fieldStyle} />
        </label>
        <ErrorLine text={error} />
        <button type="submit" className="cta-primary" disabled={busy} style={{ padding: '12px 0' }}>Belépés</button>
      </form>
    </AuthShell>
  )
}
```

- [ ] **Step 7: Write the failing `RegisterPage` test and implement**

`RegisterPage.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE, setToken } from '@/data/_client/api'
import { QueryWrapper } from '@/test/queryWrapper'
import { RegisterPage } from '@/features/auth/pages/RegisterPage'

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
afterEach(() => { vi.unstubAllEnvs(); setToken(null) })

async function fill() {
  await userEvent.type(screen.getByLabelText('Meghívó kód'), 'MEZO-7KQ2-XN4P')
  await userEvent.type(screen.getByLabelText('Név'), 'Béla')
  await userEvent.type(screen.getByLabelText('E-mail'), 'bela@test.local')
  await userEvent.type(screen.getByLabelText('Jelszó (min. 8 karakter)'), 'titkos-jelszo-1')
}

test('registers and calls onSuccess', async () => {
  const onSuccess = vi.fn()
  render(<QueryWrapper><RegisterPage onSuccess={onSuccess} onBack={() => {}} /></QueryWrapper>)
  await fill()
  await userEvent.click(screen.getByRole('button', { name: 'Fiók létrehozása' }))
  await waitFor(() => expect(onSuccess).toHaveBeenCalled())
})

test('shows the invite error inline on 409', async () => {
  server.use(http.post(`${API_BASE}/api/auth/register`, () =>
    HttpResponse.json([{ code: 'AUTH_INVITE_INVALID', message: 'x' }], { status: 409 })))
  render(<QueryWrapper><RegisterPage onSuccess={() => {}} onBack={() => {}} /></QueryWrapper>)
  await fill()
  await userEvent.click(screen.getByRole('button', { name: 'Fiók létrehozása' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Ez a meghívó kód nem érvényes.')
})

test('back link returns to login', async () => {
  const onBack = vi.fn()
  render(<QueryWrapper><RegisterPage onSuccess={() => {}} onBack={onBack} /></QueryWrapper>)
  await userEvent.click(screen.getByRole('button', { name: 'Vissza a belépéshez' }))
  expect(onBack).toHaveBeenCalled()
})
```

`RegisterPage.tsx`:

```tsx
import { useState, type FormEvent } from 'react'
import { useAuthActions } from '@/data/hooks'
import { AuthShell, ErrorLine, fieldStyle } from '@/features/auth/components/AuthShell'
import { authErrorText } from '@/features/auth/logic/authErrorText'

export function RegisterPage({ onSuccess, onBack }: { onSuccess: () => void | Promise<void>; onBack: () => void }) {
  const { register } = useAuthActions()
  const [inviteCode, setInviteCode] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | undefined>()
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (password.length < 8) { setError('A jelszó legalább 8 karakter legyen.'); return }
    setBusy(true); setError(undefined)
    try { await register({ inviteCode: inviteCode.trim().toUpperCase(), name: name.trim(), email: email.trim(), password }); await onSuccess() }
    catch (err) { setError(authErrorText(err)) }
    finally { setBusy(false) }
  }

  return (
    <AuthShell title="Regisztráció" footer={<button type="button" onClick={onBack} style={{ textDecoration: 'underline' }}>Vissza a belépéshez</button>}>
      <form className="col gap-md" onSubmit={submit}>
        <label className="col gap-xs">Meghívó kód
          <input autoComplete="off" autoCapitalize="characters" required value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} placeholder="MEZO-XXXX-XXXX" style={{ ...fieldStyle, fontFamily: 'monospace', letterSpacing: 1 }} />
        </label>
        <label className="col gap-xs">Név
          <input autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} style={fieldStyle} />
        </label>
        <label className="col gap-xs">E-mail
          <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} style={fieldStyle} />
        </label>
        <label className="col gap-xs">Jelszó (min. 8 karakter)
          <input type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} style={fieldStyle} />
        </label>
        <ErrorLine text={error} />
        <button type="submit" className="cta-primary" disabled={busy} style={{ padding: '12px 0' }}>Fiók létrehozása</button>
      </form>
    </AuthShell>
  )
}
```

- [ ] **Step 8: Write the failing `ChangePasswordPage` test and implement**

`ChangePasswordPage.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE, setToken } from '@/data/_client/api'
import { QueryWrapper } from '@/test/queryWrapper'
import { ChangePasswordPage } from '@/features/auth/pages/ChangePasswordPage'

beforeEach(() => { vi.stubEnv('VITE_USE_MOCK', 'false'); setToken('t') })
afterEach(() => { vi.unstubAllEnvs(); setToken(null) })

test('forced mode explains why and submits', async () => {
  const onSuccess = vi.fn()
  render(<QueryWrapper><ChangePasswordPage forced onSuccess={onSuccess} /></QueryWrapper>)
  expect(screen.getByText('Ideiglenes jelszóval léptél be — válassz egy sajátot.')).toBeInTheDocument()
  await userEvent.type(screen.getByLabelText('Jelenlegi jelszó'), 'temp-12345')
  await userEvent.type(screen.getByLabelText('Új jelszó (min. 8 karakter)'), 'uj-jelszo-2026')
  await userEvent.type(screen.getByLabelText('Új jelszó még egyszer'), 'uj-jelszo-2026')
  await userEvent.click(screen.getByRole('button', { name: 'Jelszó mentése' }))
  await waitFor(() => expect(onSuccess).toHaveBeenCalled())
})

test('mismatched confirmation is caught client-side', async () => {
  render(<QueryWrapper><ChangePasswordPage onSuccess={() => {}} onCancel={() => {}} /></QueryWrapper>)
  await userEvent.type(screen.getByLabelText('Jelenlegi jelszó'), 'temp-12345')
  await userEvent.type(screen.getByLabelText('Új jelszó (min. 8 karakter)'), 'uj-jelszo-2026')
  await userEvent.type(screen.getByLabelText('Új jelszó még egyszer'), 'mas')
  await userEvent.click(screen.getByRole('button', { name: 'Jelszó mentése' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('A két új jelszó nem egyezik.')
})

test('wrong current password shows the server error', async () => {
  server.use(http.post(`${API_BASE}/api/auth/change-password`, () =>
    HttpResponse.json([{ code: 'AUTH_LOGIN_INVALID_CREDENTIALS', message: 'x' }], { status: 401 })))
  render(<QueryWrapper><ChangePasswordPage forced onSuccess={() => {}} /></QueryWrapper>)
  await userEvent.type(screen.getByLabelText('Jelenlegi jelszó'), 'rossz')
  await userEvent.type(screen.getByLabelText('Új jelszó (min. 8 karakter)'), 'uj-jelszo-2026')
  await userEvent.type(screen.getByLabelText('Új jelszó még egyszer'), 'uj-jelszo-2026')
  await userEvent.click(screen.getByRole('button', { name: 'Jelszó mentése' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Hibás e-mail vagy jelszó.')
})
```

`ChangePasswordPage.tsx`:

```tsx
import { useState, type FormEvent } from 'react'
import { useAuthActions } from '@/data/hooks'
import { AuthShell, ErrorLine, fieldStyle } from '@/features/auth/components/AuthShell'
import { authErrorText } from '@/features/auth/logic/authErrorText'

/** Forced (must_change_password after an admin reset) or voluntary (S2 wires it from Beállítások). */
export function ChangePasswordPage({ forced = false, onSuccess, onCancel }: { forced?: boolean; onSuccess: () => void | Promise<void>; onCancel?: () => void }) {
  const { changePassword, logout } = useAuthActions()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [again, setAgain] = useState('')
  const [error, setError] = useState<string | undefined>()
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (next.length < 8) { setError('A jelszó legalább 8 karakter legyen.'); return }
    if (next !== again) { setError('A két új jelszó nem egyezik.'); return }
    setBusy(true); setError(undefined)
    try { await changePassword({ currentPassword: current, newPassword: next }); await onSuccess() }
    catch (err) { setError(authErrorText(err)) }
    finally { setBusy(false) }
  }

  const footer = forced
    ? <button type="button" onClick={logout} style={{ textDecoration: 'underline' }}>Kijelentkezés</button>
    : onCancel && <button type="button" onClick={onCancel} style={{ textDecoration: 'underline' }}>Mégse</button>

  return (
    <AuthShell title="Új jelszó" footer={footer}>
      <form className="col gap-md" onSubmit={submit}>
        {forced && <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary, #6E6257)', textAlign: 'center' }}>Ideiglenes jelszóval léptél be — válassz egy sajátot.</p>}
        <label className="col gap-xs">Jelenlegi jelszó
          <input type="password" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} style={fieldStyle} />
        </label>
        <label className="col gap-xs">Új jelszó (min. 8 karakter)
          <input type="password" autoComplete="new-password" required minLength={8} value={next} onChange={(e) => setNext(e.target.value)} style={fieldStyle} />
        </label>
        <label className="col gap-xs">Új jelszó még egyszer
          <input type="password" autoComplete="new-password" required value={again} onChange={(e) => setAgain(e.target.value)} style={fieldStyle} />
        </label>
        <ErrorLine text={error} />
        <button type="submit" className="cta-primary" disabled={busy} style={{ padding: '12px 0' }}>Jelszó mentése</button>
      </form>
    </AuthShell>
  )
}
```

- [ ] **Step 9: Run all auth FE tests in both modes**

Run: `cd frontend && VITE_USE_MOCK=false pnpm test src/features/auth src/app/auth src/data/auth src/data/_client && VITE_USE_MOCK=true pnpm test src/features/auth src/app/auth src/data/auth src/data/_client`
Expected: PASS in both.

- [ ] **Step 10: Commit**

```bash
git add frontend/src/features/auth
git commit -m "feat(fe): Login/Register/ChangePassword pages on the chrome-free AuthShell (mezo-qw37.1)"
```

---

### Task 12: Full gates, docs refresh, CODEMAP, push, PR

**Files:**
- Modify: `docs/features/_platform-auth-security.md` (§1 Summary, §2 User-facing behavior, §3 Architecture, §6/§7 recipes), `docs/CODEMAP.md`
- Modify: `AGENTS.md` line ~159 ("Auth/ownership: single-user … No login UI in Phase 2")

- [ ] **Step 1: Frontend full gate**

Run:
```bash
cd frontend && VITE_USE_MOCK=true pnpm test && VITE_USE_MOCK=false pnpm test && pnpm build
```
Expected: both suites green, build succeeds. Typical breakages: tests that imported `bootstrapOwnerToken` (delete the import), tests that rendered `QueryProvider` expecting a `pending` null render in real mode (they now need `setToken('t')` before render, and MSW serves `/api/auth/me`).

- [ ] **Step 2: Backend focused gate**

Run:
```bash
cd backend && ./mvnw test -Dtest='Auth*,CurrentUser*,InviteServiceTest,OwnerSeedDataIT,ArchitectureTest' -Dmezo.test.use-testcontainers=true
```
Expected: PASS. Then a broad smoke on the biggest consumers of `CurrentUserId`:
```bash
cd backend && ./mvnw test -Dtest='WeightLogControllerIT,MealControllerIT,ExerciseCatalog*IT' -Dmezo.test.use-testcontainers=true
```
Expected: PASS (the status check is transparent for ACTIVE accounts). The full suite runs in CI.

- [ ] **Step 3: Docs refresh**

`docs/features/_platform-auth-security.md`:
- Frontmatter `updated: 2026-09-02`; add `backend/src/main/java/io/mrkuhne/mezo/feature/auth/service` and `frontend/src/app/auth` and `frontend/src/features/auth` to `key_files`; remove `frontend/src/data/_client/auth.ts`.
- §1 one-liner → "multi-user account model: invite-gated registration → 30-day HS256 JWT → resource-server filter → per-request `CurrentUser` status check → server-side `created_by`". Replace the "exactly one account" paragraph with: accounts are `OWNER` (seeded founder) or `USER` (registered with an invite code); `DISABLED` accounts are rejected with 403 on every request; the frontend persists the token in `localStorage` (`mezo.auth.token`) and `AuthGate` decides login / change-password / app at boot.
- §2 replace the cold-load bullets with the `AuthGate` phases (`pending → signedOut | mustChangePassword | ready | failed`), the sign-out notices, and "no owner credentials in the build".
- §3 login diagram: `AuthGate.useEffect → authApi.me()`; add the `register` flow (`InviteService.consume` under `FOR UPDATE`); the protected-request diagram gains `CurrentUserId.get() → CurrentUser.get() (status + last_seen)`.
- §6 backend recipe: mention `CurrentUser.requireOwner()` for owner-only endpoints; §7 replace the "Moving to multi-user" paragraph with a pointer to the spec and the S2–S6 issues.
- Add a §9 bullet: "`mezo-5h9` closed — `mezo.auth.strict` guard".

`AGENTS.md` ~line 159: reword to "Auth/ownership: multi-user (mezo-qw37) — invite-gated registration, JWT bearer, `created_by` resolved server-side from `CurrentUser`; login/register UI lives in `features/auth`."

Run:
```bash
node scripts/gen-codemap.mjs && node scripts/lint-docs.mjs --errors-only && node scripts/lint-liquibase.mjs
```
Expected: all PASS (stale findings on unrelated docs are advisory).

- [ ] **Step 4: Commit docs**

```bash
git add docs/features/_platform-auth-security.md docs/CODEMAP.md AGENTS.md
git commit -m "docs(auth): platform auth doc + AGENTS reflect the multi-user S1 model (mezo-qw37.1)"
```

- [ ] **Step 5: Push, open the self-PR, wait for CI**

```bash
git push -u origin feat/multi-user-s1-account-foundation
gh pr create --title "feat(auth): S1 account foundation — invites, register/me, AuthGate (mezo-qw37.1)" --body "$(cat <<'EOF'
S1 of the multi-user epic (mezo-qw37): app_user role/status/timezone/onboarding, invite table, register/me/change-password/onboarding-complete, per-request CurrentUser status check, persisted FE token + AuthGate + Login/Register/ChangePassword pages, mezo-5h9 strict guard. Spec: docs/superpowers/specs/2026-09-02-multi-user-accounts-design.md §5.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
gh pr checks --watch
```
Expected: CI green (full backend IT suite, FE both modes, lint, contract drift). Then the house merge recipe (detached temp worktree, `--no-ff`, push main), `bd close mezo-qw37.1`, `bd dolt push`.

---

## Self-Review

**Spec coverage (§5):** schema columns + backfill → Task 2; `invite` → Tasks 2–3; `user_profiles` drop → Task 2; contract table (register/login-403/me/change-password/onboarding-complete) → Tasks 1, 5; transaction + `FOR UPDATE` → Tasks 3, 5; `SecurityConfig` permitAll → Task 5; `CurrentUser` + `last_seen_at` 5-min stamp + `requireOwner` + `CurrentUserId` delegation → Task 4; `mezo-5h9` → Task 7; `OwnerSeedData` role → Task 2; message codes → Task 4; FE token in localStorage + `bootstrapOwnerToken`/`VITE_OWNER_*` removal → Tasks 8, 10; 401/403 → signedOut → Task 8; boot state machine → Task 10; `features/auth` pages + inline errors → Task 11; logout (token + `queryClient.clear()`) → Task 9 (`useAuthActions.logout`), surfaced in the UI by S2's Beállítások "Fiók" group; MSW handlers → Task 9; `registerUser` helper + isolation IT + `ResetDatabase` → Tasks 2, 6; docs → Task 12. The `onboarding` phase is deliberately S2 (noted in Task 10).

**Placeholder scan:** none; every code step has full content. Two "check the generated shape" notes (MeResponse constructor, `SystemMessage` builder) are verification instructions, not gaps.

**Type consistency:** `AppUserEntity.UserRole/UserStatus` used identically in Tasks 2, 4, 5; `RegisteredUser(id, email, headers)` in Task 6; `authApi`/`useAuthActions` names match between Tasks 9–11; `AuthPhase` values match between `authState.ts` and `AuthGate.tsx`; `SignOutReason` values match between `authEvents.ts`, `api.ts`, and `AuthGate.tsx`; UI strings asserted in tests match the page copy (`Bejelentkezés`, `Regisztráció`, `Új jelszó`, `Belépés`, `Fiók létrehozása`, `Jelszó mentése`, `Van meghívó kódod?`, `Vissza a belépéshez`, `Nem érem el a szervert`, `Újra`).

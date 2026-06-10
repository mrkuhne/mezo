# Phase 2 · Slice A — Foundation + Biometrics — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the symmetric monorepo + a Spring Boot 4.x / Postgres backend with thin single-user auth, then wire the three biometrics write-path hooks (`logWeight`, `logSleep`, `saveCheckIn`) end-to-end through real REST + TanStack Query — without changing any hook signature.

**Architecture:** `frontend/` (existing React 19 app, moved) + `backend/` (new Spring Boot 4.x, Maven, Java 21, `io.mrkuhne.mezo`, feature-based packages). Postgres via Docker Compose. App-level ownership (`created_by` from the JWT principal). Frontend hooks swap their internals from mock `useState` to `useQuery`/`useMutation`; their public return shape is unchanged so components and parity tests stay green.

**Tech Stack:** Spring Boot 4.x, Java 21, Maven, Spring Data JPA / Hibernate, Liquibase, Spring Security (OAuth2 resource server, HS256), MapStruct, Lombok, Testcontainers + AssertJ (backend tests); React 19, Vite, `@tanstack/react-query`, MSW (frontend tests).

**MANDATORY conventions — read before each backend task:** `docs/references/{java_package_structure,spring_patterns,error_handling,liquibase_conventions,testing_standards}.md` and the CLAUDE.md "Backend Development Conventions" section. Spec: `docs/superpowers/specs/2026-06-10-phase2-backend-design.md`.

**bd epic:** `mezo-v67`. Create a child issue per phase (P0–P4) before starting it; mark in_progress on start, close on completion.

---

## File Structure

**Phase 0 — monorepo (move, not rewrite):**
- Move: everything frontend at repo root → `frontend/` (`src/`, `public/`, `index.html`, `package.json`, `pnpm-lock.yaml`, `vite.config.ts`, `vite.config.js`, `tsconfig*.json`, `tests/`, `vite-env.d.ts`, `dist/` left behind/regenerated).
- Modify: `frontend/tests/parity/playwright.config.ts` (prototype path → env var, bd: mezo-ero).
- Keep at root: `.git/`, `.beads/`, `docs/`, `CLAUDE.md`, `README.md`, `.gitignore`.

**Phase 1–3 — backend (`backend/`):**
- `pom.xml`, `mvnw`, `compose.yaml`, `src/main/resources/application.yml`, `application-demodata.yml`
- `src/main/resources/db/changelog/db.changelog-master.yaml` + `1.0.0/1.0.0_master.yml` + `1.0.0/script/*.sql`
- `src/main/resources/messages.properties`
- `io/mrkuhne/mezo/MezoApplication.java`
- `io/mrkuhne/mezo/techcore/exception/{SystemMessage,Level,Type,SystemRuntimeErrorException,GlobalExceptionHandler}.java`
- `io/mrkuhne/mezo/techcore/security/{SecurityConfig,JwtService,CurrentUser,CurrentUserId}.java`
- `io/mrkuhne/mezo/techcore/persistence/OwnedEntity.java`
- `io/mrkuhne/mezo/feature/auth/{controller,service,repository,entity,dto,mapper}/...`
- `io/mrkuhne/mezo/feature/biometrics/{weight,sleep,checkin}/...` (controller/service/repository/entity/dto/mapper)
- `src/test/java/io/mrkuhne/mezo/...` integration tests + `support/DatabasePopulator.java` + `support/AbstractIntegrationTest.java`

**Phase 4 — frontend wiring:**
- Create: `frontend/src/app/providers/QueryProvider.tsx`, `frontend/src/lib/api.ts`, `frontend/src/lib/auth.ts`, `frontend/src/lib/biometricsApi.ts`, `frontend/.env`, `frontend/src/test/msw/{server,handlers}.ts`
- Modify: `frontend/src/data/hooks.ts` (`useGoals`, `useSleep`, `useCheckins`), `frontend/src/main.tsx` (wrap in providers), `frontend/src/data/*.test.tsx`

---

## PHASE 0 — Monorepo restructure

> bd: `bd create --title="Slice A · P0 monorepo restructure" --type=task -p 1` and `bd dep add <id> mezo-v67`, then `bd update <id> --claim`.

### Task 1: Move the frontend under `frontend/`

**Files:** all root frontend files → `frontend/`; modify `frontend/tests/parity/playwright.config.ts`.

- [ ] **Step 1: Confirm a clean tree and green baseline**

Run:
```bash
git status --short            # expect: clean (only this plan/spec already committed)
pnpm test                     # expect: all vitest green (baseline before move)
```
Expected: tests pass. If not, stop and fix before moving.

- [ ] **Step 2: Create `frontend/` and git-move the frontend files**

Run:
```bash
mkdir -p frontend
git mv src public tests index.html package.json pnpm-lock.yaml \
       vite.config.ts vite.config.js vite.config.d.ts \
       tsconfig.json tsconfig.node.json vite-env.d.ts frontend/ 2>/dev/null
# tsbuildinfo + dist are build artifacts — remove, they regenerate:
rm -f tsconfig.tsbuildinfo tsconfig.node.tsbuildinfo
rm -rf dist node_modules
git status --short
```
Expected: the listed paths show as renamed into `frontend/`.

- [ ] **Step 3: Reinstall and verify build/test from the new location**

Run:
```bash
cd frontend && pnpm install && pnpm build && pnpm test
```
Expected: install succeeds, `tsc -b && vite build` succeeds, vitest green. Paths inside the files are relative, so no config edits are needed for build/test. (If `vite.config.ts` references `tests/` or `public/` by absolute root path, fix to relative — verify by reading it.)

- [ ] **Step 4: Make the parity prototype path configurable (bd: mezo-ero)**

Read `frontend/tests/parity/playwright.config.ts`. Replace the hardcoded prototype path with an env var, defaulting to the current value. Example edit:
```ts
// before: const PROTOTYPE = '/Users/daniel.kuhne/Downloads/design_handoff_mezo/prototype/...'
const PROTOTYPE_DIR =
  process.env.MEZO_PROTOTYPE_DIR ??
  '/Users/daniel.kuhne/Downloads/design_handoff_mezo/prototype'
```
Then reference `PROTOTYPE_DIR` where the path was used. Verify by reading the file that no absolute prototype path remains hardcoded.

- [ ] **Step 5: Run parity to confirm the move didn't break screenshots**

Run:
```bash
cd frontend && pnpm parity
```
Expected: parity passes (or only known-diff). If the prototype dir differs on this machine, set `MEZO_PROTOTYPE_DIR` and rerun.

- [ ] **Step 6: Commit**

```bash
cd /Users/daniel.kuhne/MrKuhne/mezo
git add -A
git commit -m "refactor(repo): move frontend under frontend/ for monorepo split

Frontend now lives in frontend/; backend/ lands next. Parity prototype
path lifted to MEZO_PROTOTYPE_DIR env var (bd: mezo-ero).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

> Close the P0 bd task: `bd close <id> --reason="frontend moved under frontend/, build+test+parity green"`.

---

## PHASE 1 — Backend scaffold

> bd: create `Slice A · P1 backend scaffold`, dep on `mezo-v67`, claim it.

### Task 2: Generate the Spring Boot 4.x project

**Files:** create `backend/` from Spring Initializr.

- [ ] **Step 1: Generate via start.spring.io (always-current 4.x)**

Run from repo root:
```bash
curl -s https://start.spring.io/starter.tgz \
  -d type=maven-project -d language=java -d javaVersion=21 \
  -d bootVersion=4.0.0 \
  -d groupId=io.mrkuhne -d artifactId=mezo -d name=mezo \
  -d packageName=io.mrkuhne.mezo \
  -d dependencies=web,data-jpa,postgresql,liquibase,security,validation,testcontainers,lombok,actuator \
  | tar -xzf - -C . --one-top-level=backend
ls backend
```
Expected: `backend/pom.xml`, `backend/mvnw`, `backend/src/main/java/io/mrkuhne/mezo/MezoApplication.java`.
> If `bootVersion=4.0.0` is rejected, omit the `-d bootVersion=...` line — Initializr then uses its current default 4.x. Read `backend/pom.xml` and confirm `<parent>` is `spring-boot-starter-parent` 4.x.

- [ ] **Step 2: Add MapStruct + Testcontainers-Postgres to `pom.xml`**

In `backend/pom.xml`, add dependencies (Testcontainers BOM is already managed by the `testcontainers` starter; add the Postgres module + MapStruct):
```xml
<dependency>
  <groupId>org.mapstruct</groupId>
  <artifactId>mapstruct</artifactId>
  <version>1.6.3</version>
</dependency>
<dependency>
  <groupId>org.testcontainers</groupId>
  <artifactId>postgresql</artifactId>
  <scope>test</scope>
</dependency>
```
And register the MapStruct + Lombok annotation processors on the `maven-compiler-plugin` (Lombok first, then `lombok-mapstruct-binding` 0.2.0, then `mapstruct-processor` 1.6.3). Read the generated `pom.xml` first to find the existing compiler/Lombok setup and extend it.

- [ ] **Step 3: Verify it compiles**

Run:
```bash
cd backend && ./mvnw -q compile
```
Expected: BUILD SUCCESS.

- [ ] **Step 4: Commit**

```bash
git add backend
git commit -m "feat(backend): scaffold Spring Boot 4.x (Maven, Java 21, io.mrkuhne.mezo)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 3: Postgres + Liquibase + datasource config

**Files:** create `backend/compose.yaml`, `backend/src/main/resources/application.yml`, `db/changelog/db.changelog-master.yaml`, `db/changelog/1.0.0/1.0.0_master.yml`.

- [ ] **Step 1: Compose file for local Postgres**

Create `backend/compose.yaml`:
```yaml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: mezo
      POSTGRES_USER: mezo
      POSTGRES_PASSWORD: mezo
    ports: ["5432:5432"]
    volumes: ["mezo_pg:/var/lib/postgresql/data"]
volumes:
  mezo_pg:
```

- [ ] **Step 2: application.yml**

Replace `backend/src/main/resources/application.properties` (delete it) with `application.yml`:
```yaml
spring:
  application:
    name: mezo
  datasource:
    url: jdbc:postgresql://localhost:5432/mezo
    username: ${DB_USER:mezo}
    password: ${DB_PASSWORD:mezo}
  jpa:
    hibernate:
      ddl-auto: validate          # Liquibase owns the schema, never Hibernate
    open-in-view: false
  liquibase:
    change-log: classpath:db/changelog/db.changelog-master.yaml
mezo:
  auth:
    jwt-secret: ${MEZO_JWT_SECRET:dev-only-change-me-32-bytes-minimum-secret}
    owner-email: ${MEZO_OWNER_EMAIL:owner@mezo.local}
    owner-password: ${MEZO_OWNER_PASSWORD:owner}
    owner-name: ${MEZO_OWNER_NAME:Owner}
management:
  endpoints:
    web:
      exposure:
        include: health
```

- [ ] **Step 3: Liquibase master + version master**

Create `backend/src/main/resources/db/changelog/db.changelog-master.yaml`:
```yaml
databaseChangeLog:
  - include:
      file: db/changelog/1.0.0/1.0.0_master.yml
```
Create `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml`:
```yaml
databaseChangeLog: []   # changesets appended per task below
```

- [ ] **Step 4: Commit**

```bash
git add backend
git commit -m "feat(backend): Postgres compose + datasource + Liquibase wiring

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 4: techcore error handling (SystemMessage)

**Files:** create the five exception classes + `messages.properties`. Follow `docs/references/error_handling.md` exactly.

- [ ] **Step 1: Enums + SystemMessage**

Create `backend/src/main/java/io/mrkuhne/mezo/techcore/exception/Level.java`:
```java
package io.mrkuhne.mezo.techcore.exception;

public enum Level { ERROR, WARNING, INFO }
```
Create `.../exception/Type.java`:
```java
package io.mrkuhne.mezo.techcore.exception;

public enum Type { REQUEST, FIELD }
```
Create `.../exception/SystemMessage.java`:
```java
package io.mrkuhne.mezo.techcore.exception;

import java.util.List;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class SystemMessage {
    private Level level;
    private String code;
    private List<String> params;
    private String message;        // resolved from messages.properties
    private String fieldName;
    private Type type;
    private String exceptionTraceId;

    public static SystemMessage.SystemMessageBuilder error(String code) {
        return SystemMessage.builder().level(Level.ERROR).code(code).type(Type.REQUEST);
    }

    public static SystemMessage field(String code, String fieldName) {
        return SystemMessage.builder()
            .level(Level.ERROR).code(code).fieldName(fieldName).type(Type.FIELD).build();
    }
}
```

- [ ] **Step 2: SystemRuntimeErrorException**

Create `.../exception/SystemRuntimeErrorException.java`:
```java
package io.mrkuhne.mezo.techcore.exception;

import java.util.List;
import lombok.Getter;

@Getter
public class SystemRuntimeErrorException extends RuntimeException {
    private final List<SystemMessage> messages;

    public SystemRuntimeErrorException(SystemMessage message) {
        this(List.of(message));
    }

    public SystemRuntimeErrorException(List<SystemMessage> messages) {
        super(messages.isEmpty() ? "system error" : messages.get(0).getCode());
        this.messages = messages;
    }
}
```

- [ ] **Step 3: messages.properties**

Create `backend/src/main/resources/messages.properties`:
```properties
# {DOMAIN}_{ACTION}_{REASON}
AUTH_LOGIN_INVALID_CREDENTIALS=Invalid email or password.
AUTH_TOKEN_MISSING=Authentication required.
VALIDATION_REQUIRED_FIELD=This field is required.
INTERNAL_ERROR=Something went wrong. Please try again.
```

- [ ] **Step 4: GlobalExceptionHandler**

Create `.../exception/GlobalExceptionHandler.java`:
```java
package io.mrkuhne.mezo.techcore.exception;

import java.util.List;
import java.util.Locale;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.MessageSource;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@Slf4j
@RestControllerAdvice
@RequiredArgsConstructor
public class GlobalExceptionHandler {

    private final MessageSource messageSource;

    @ExceptionHandler(SystemRuntimeErrorException.class)
    public ResponseEntity<List<SystemMessage>> handle(SystemRuntimeErrorException ex) {
        String traceId = UUID.randomUUID().toString();
        log.error("Error [traceId={}]: {}", traceId, ex.getMessage(), ex);
        ex.getMessages().forEach(m -> {
            m.setExceptionTraceId(traceId);
            m.setMessage(resolve(m));
        });
        return ResponseEntity.badRequest().body(ex.getMessages());
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<List<SystemMessage>> handleUnexpected(Exception ex) {
        String traceId = UUID.randomUUID().toString();
        log.error("Unhandled [traceId={}]", traceId, ex);
        SystemMessage m = SystemMessage.error("INTERNAL_ERROR").build();
        m.setExceptionTraceId(traceId);
        m.setMessage(resolve(m));
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(List.of(m));
    }

    private String resolve(SystemMessage m) {
        Object[] params = m.getParams() == null ? new Object[0] : m.getParams().toArray();
        return messageSource.getMessage(m.getCode(), params, m.getCode(), Locale.ENGLISH);
    }
}
```
> Ensure `MessageSource` reads `messages.properties` (Spring Boot auto-configures `messages` basename by default — no extra config needed).

- [ ] **Step 5: Compile + commit**

Run: `cd backend && ./mvnw -q compile`  → Expected: BUILD SUCCESS.
```bash
git add backend && git commit -m "feat(backend): SystemMessage error handling + global advice

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 5: Integration test harness + context smoke test

**Files:** create `src/test/.../support/AbstractIntegrationTest.java`, `support/DatabasePopulator.java`, `MezoApplicationIT.java`.

- [ ] **Step 1: Abstract Testcontainers base**

Create `backend/src/test/java/io/mrkuhne/mezo/support/AbstractIntegrationTest.java`:
```java
package io.mrkuhne.mezo.support;

import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers
@SpringBootTest
public abstract class AbstractIntegrationTest {

    @Container
    static final PostgreSQLContainer<?> POSTGRES =
        new PostgreSQLContainer<>("postgres:16");

    @DynamicPropertySource
    static void props(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        r.add("spring.datasource.username", POSTGRES::getUsername);
        r.add("spring.datasource.password", POSTGRES::getPassword);
    }
}
```

- [ ] **Step 2: DatabasePopulator stub**

Create `backend/src/test/java/io/mrkuhne/mezo/support/DatabasePopulator.java`:
```java
package io.mrkuhne.mezo.support;

import org.springframework.stereotype.Component;

@Component
public class DatabasePopulator {
    // Per-feature populate methods are added by later tasks (e.g. populateOwner()).
    public void clear() { /* extended per feature with repository deletes */ }
}
```

- [ ] **Step 3: Context-loads smoke test**

Create `backend/src/test/java/io/mrkuhne/mezo/MezoApplicationIT.java`:
```java
package io.mrkuhne.mezo;

import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;

class MezoApplicationIT extends AbstractIntegrationTest {
    @Test
    void testContext_shouldLoad_whenStarted() { }
}
```

- [ ] **Step 4: Run it (Liquibase runs against the container)**

Run:
```bash
cd backend && ./mvnw -q test -Dtest=MezoApplicationIT
```
Expected: PASS — container starts, Liquibase applies the (empty 1.0.0) changelog, context loads.

- [ ] **Step 5: Commit**

```bash
git add backend && git commit -m "test(backend): Testcontainers integration harness + context smoke

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

> Close P1 bd task.

---

## PHASE 2 — Auth foundation (thin, single-user)

> bd: create `Slice A · P2 auth foundation`, dep on `mezo-v67`, claim it.

### Task 6: `app_user` + `user_profiles` schema and entities

**Files:** Liquibase script + `feature/auth/entity/{AppUserEntity,UserProfileEntity}.java` + `techcore/persistence/OwnedEntity.java`.

- [ ] **Step 1: Liquibase changeset**

Create `backend/src/main/resources/db/changelog/1.0.0/script/202606101200_mezo-v67_create_auth.sql`:
```sql
-- DDL: identity + profile (single-user; created_by lives on owned domain tables, not here)
CREATE TABLE app_user (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email         VARCHAR(255) NOT NULL,
    password_hash VARCHAR(100) NOT NULL,
    name          VARCHAR(120) NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_app_user_email UNIQUE (email)
);

CREATE TABLE user_profiles (
    created_by   UUID PRIMARY KEY,
    handle       VARCHAR(60),
    birth_date   DATE,
    member_since DATE NOT NULL DEFAULT current_date,
    streak_days  INT NOT NULL DEFAULT 0,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_user_profiles_created_by_app_user_id
        FOREIGN KEY (created_by) REFERENCES app_user(id) ON DELETE CASCADE
);
```
Register it in `1.0.0/1.0.0_master.yml`:
```yaml
databaseChangeLog:
  - changeSet:
      id: "1.0.0:202606101200_mezo-v67_create_auth"
      author: daniel.kuhne
      changes:
        - sqlFile:
            relativeToChangelogFile: true
            path: script/202606101200_mezo-v67_create_auth.sql
```

- [ ] **Step 2: OwnedEntity mapped superclass** (reused by every domain table)

Create `backend/src/main/java/io/mrkuhne/mezo/techcore/persistence/OwnedEntity.java`:
```java
package io.mrkuhne.mezo.techcore.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.MappedSuperclass;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

@Getter
@Setter
@MappedSuperclass
public abstract class OwnedEntity {

    @Column(name = "created_by", nullable = false, updatable = false)
    private UUID createdBy;

    @Column(name = "is_deleted", nullable = false)
    private boolean deleted = false;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
}
```

- [ ] **Step 3: AppUserEntity + UserProfileEntity**

Create `backend/src/main/java/io/mrkuhne/mezo/feature/auth/entity/AppUserEntity.java`:
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

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
}
```
Create `.../feature/auth/entity/UserProfileEntity.java`:
```java
package io.mrkuhne.mezo.feature.auth.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.UpdateTimestamp;

@Getter
@Setter
@Entity
@Table(name = "user_profiles")
public class UserProfileEntity {

    @Id
    @Column(name = "created_by", columnDefinition = "uuid")
    private UUID createdBy;

    @Column(length = 60)
    private String handle;

    @Column(name = "birth_date")
    private LocalDate birthDate;

    @Column(name = "member_since", nullable = false)
    private LocalDate memberSince = LocalDate.now();

    @Column(name = "streak_days", nullable = false)
    private int streakDays = 0;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
```

- [ ] **Step 4: Repositories**

Create `.../feature/auth/repository/AppUserRepository.java`:
```java
package io.mrkuhne.mezo.feature.auth.repository;

import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AppUserRepository extends JpaRepository<AppUserEntity, UUID> {
    Optional<AppUserEntity> findByEmail(String email);
    boolean existsByEmail(String email);
}
```

- [ ] **Step 5: Migrate + smoke**

Run: `cd backend && ./mvnw -q test -Dtest=MezoApplicationIT`
Expected: PASS (Hibernate `validate` matches the new tables → no schema mismatch).

- [ ] **Step 6: Commit**

```bash
git add backend && git commit -m "feat(auth): app_user + user_profiles schema + entities

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 7: Owner seed via `@Profile("demodata")`

**Files:** `feature/auth/OwnerSeedData.java`, `application-demodata.yml`. Per `liquibase_conventions.md` §Seed — Java, never SQL.

- [ ] **Step 1: Seed runner**

Create `backend/src/main/java/io/mrkuhne/mezo/feature/auth/OwnerSeedData.java`:
```java
package io.mrkuhne.mezo.feature.auth;

import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.auth.entity.UserProfileEntity;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.auth.repository.UserProfileRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
@Profile("demodata")
@RequiredArgsConstructor
public class OwnerSeedData implements CommandLineRunner {

    private final AppUserRepository appUserRepository;
    private final UserProfileRepository userProfileRepository;
    private final PasswordEncoder passwordEncoder;
    private final OwnerProperties ownerProperties;

    @Override
    public void run(String... args) {
        if (appUserRepository.existsByEmail(ownerProperties.email())) return;
        AppUserEntity owner = new AppUserEntity();
        owner.setEmail(ownerProperties.email());
        owner.setName(ownerProperties.name());
        owner.setPasswordHash(passwordEncoder.encode(ownerProperties.password()));
        owner = appUserRepository.save(owner);

        UserProfileEntity profile = new UserProfileEntity();
        profile.setCreatedBy(owner.getId());
        userProfileRepository.save(profile);
    }
}
```
Create `.../feature/auth/UserProfileRepository.java` under `repository/`:
```java
package io.mrkuhne.mezo.feature.auth.repository;

import io.mrkuhne.mezo.feature.auth.entity.UserProfileEntity;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserProfileRepository extends JpaRepository<UserProfileEntity, UUID> { }
```
Create `.../feature/auth/OwnerProperties.java` (typed config):
```java
package io.mrkuhne.mezo.feature.auth;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "mezo.auth")
public record OwnerProperties(String ownerEmail, String ownerPassword, String ownerName, String jwtSecret) {
    public String email() { return ownerEmail; }
    public String password() { return ownerPassword; }
    public String name() { return ownerName; }
}
```
Enable config props: add `@ConfigurationPropertiesScan` to `MezoApplication`.

- [ ] **Step 2: demodata profile config**

Create `backend/src/main/resources/application-demodata.yml`:
```yaml
# inherits application.yml; activate with -Dspring-boot.run.profiles=demodata
spring:
  jpa:
    hibernate:
      ddl-auto: validate
```

- [ ] **Step 3: Integration test for the seed**

Create `backend/src/test/java/io/mrkuhne/mezo/feature/auth/OwnerSeedDataIT.java`:
```java
package io.mrkuhne.mezo.feature.auth;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

@ActiveProfiles("demodata")
class OwnerSeedDataIT extends AbstractIntegrationTest {

    @Autowired private AppUserRepository appUserRepository;

    @Test
    void testSeed_shouldCreateOwnerOnce_whenProfileActive() {
        long count = appUserRepository.count();
        assertThat(count).isEqualTo(1);
        assertThat(appUserRepository.findByEmail("owner@mezo.local")).isPresent();
    }
}
```

- [ ] **Step 4: Run + commit**

Run: `cd backend && ./mvnw -q test -Dtest=OwnerSeedDataIT` → Expected: PASS.
> Note: this needs `PasswordEncoder` (defined in Task 8). If running before Task 8, add a temporary `@Bean BCryptPasswordEncoder` in a `@TestConfiguration`, or reorder to run after Task 8. Recommended: implement Task 8 Step 1 (SecurityConfig with the `PasswordEncoder` bean) before running this test.
```bash
git add backend && git commit -m "feat(auth): idempotent owner seed via @Profile(demodata)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 8: Spring Security + JWT login

**Files:** `techcore/security/{SecurityConfig,JwtService,CurrentUserId}.java`, `feature/auth/{controller/AuthController,service/AuthService,dto/{LoginRequest,TokenResponse}}.java`.

- [ ] **Step 1: SecurityConfig (resource server, HS256, PasswordEncoder)**

Create `backend/src/main/java/io/mrkuhne/mezo/techcore/security/SecurityConfig.java`:
```java
package io.mrkuhne.mezo.techcore.security;

import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
public class SecurityConfig {

    private final byte[] secret;

    public SecurityConfig(OwnerProperties props) {
        this.secret = props.jwtSecret().getBytes();
    }

    @Bean
    SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable())
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/auth/login", "/actuator/health").permitAll()
                .anyRequest().authenticated())
            .oauth2ResourceServer(o -> o.jwt(jwt -> {}));
        return http.build();
    }

    @Bean
    JwtDecoder jwtDecoder() {
        SecretKeySpec key = new SecretKeySpec(secret, "HmacSHA256");
        return NimbusJwtDecoder.withSecretKey(key).macAlgorithm(MacAlgorithm.HS256).build();
    }

    @Bean
    JwtEncoder jwtEncoder() {
        return new NimbusJwtEncoder(new com.nimbusds.jose.jwk.source.ImmutableSecret<>(secret));
    }

    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
```

- [ ] **Step 2: CurrentUserId resolver** (principal → UUID)

Create `.../techcore/security/CurrentUserId.java`:
```java
package io.mrkuhne.mezo.techcore.security;

import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.util.UUID;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;

@Component
public class CurrentUserId {
    public UUID get() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof Jwt jwt)) {
            throw new SystemRuntimeErrorException(SystemMessage.error("AUTH_TOKEN_MISSING").build());
        }
        return UUID.fromString(jwt.getSubject());
    }
}
```

- [ ] **Step 3: AuthService + DTOs**

Create `.../feature/auth/dto/LoginRequest.java`:
```java
package io.mrkuhne.mezo.feature.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record LoginRequest(@NotBlank @Email String email, @NotBlank String password) {}
```
Create `.../feature/auth/dto/TokenResponse.java`:
```java
package io.mrkuhne.mezo.feature.auth.dto;

public record TokenResponse(String token) {}
```
Create `.../feature/auth/service/AuthService.java`:
```java
package io.mrkuhne.mezo.feature.auth.service;

import io.mrkuhne.mezo.feature.auth.dto.LoginRequest;
import io.mrkuhne.mezo.feature.auth.dto.TokenResponse;
import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final AppUserRepository appUserRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtEncoder jwtEncoder;

    public TokenResponse login(LoginRequest req) {
        AppUserEntity user = appUserRepository.findByEmail(req.email())
            .filter(u -> passwordEncoder.matches(req.password(), u.getPasswordHash()))
            .orElseThrow(() -> new SystemRuntimeErrorException(
                SystemMessage.error("AUTH_LOGIN_INVALID_CREDENTIALS").build()));

        Instant now = Instant.now();
        JwtClaimsSet claims = JwtClaimsSet.builder()
            .subject(user.getId().toString())
            .issuedAt(now)
            .expiresAt(now.plus(30, ChronoUnit.DAYS))
            .claim("email", user.getEmail())
            .build();
        String token = jwtEncoder.encode(JwtEncoderParameters.from(claims)).getTokenValue();
        return new TokenResponse(token);
    }
}
```
Create `.../feature/auth/controller/AuthController.java`:
```java
package io.mrkuhne.mezo.feature.auth.controller;

import io.mrkuhne.mezo.feature.auth.dto.LoginRequest;
import io.mrkuhne.mezo.feature.auth.dto.TokenResponse;
import io.mrkuhne.mezo.feature.auth.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/login")
    public TokenResponse login(@Valid @RequestBody LoginRequest req) {
        return authService.login(req);
    }
}
```

- [ ] **Step 4: Auth integration test**

Create `backend/src/test/java/io/mrkuhne/mezo/feature/auth/AuthControllerIT.java`:
```java
package io.mrkuhne.mezo.feature.auth;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.auth.dto.LoginRequest;
import io.mrkuhne.mezo.feature.auth.dto.TokenResponse;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.*;
import org.springframework.test.context.ActiveProfiles;

@ActiveProfiles("demodata")
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class AuthControllerIT extends AbstractIntegrationTest {

    @Autowired private TestRestTemplate rest;

    @Test
    void testLogin_shouldReturnToken_whenCredentialsValid() {
        var resp = rest.postForEntity("/api/auth/login",
            new LoginRequest("owner@mezo.local", "owner"), TokenResponse.class);
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(resp.getBody().token()).isNotBlank();
    }

    @Test
    void testLogin_shouldReturn400_whenPasswordWrong() {
        var resp = rest.postForEntity("/api/auth/login",
            new LoginRequest("owner@mezo.local", "wrong"), String.class);
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void testProtectedEndpoint_shouldReturn401_whenNoToken() {
        var resp = rest.getForEntity("/api/biometrics/weight", String.class);
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }
}
```
> The third assertion needs the weight endpoint (Task 10). Until then, point it at any authenticated path or add it after Task 10. Recommended: keep the first two now; add the 401 case after Task 10.

- [ ] **Step 5: Run + commit**

Run: `cd backend && ./mvnw -q test -Dtest=AuthControllerIT,OwnerSeedDataIT` → Expected: PASS.
```bash
git add backend && git commit -m "feat(auth): JWT login (HS256 resource server) + current-user resolver

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

> Close P2 bd task.

---

## PHASE 3 — Biometrics backend (weight / sleep / check_in)

> bd: create `Slice A · P3 biometrics backend`, dep on `mezo-v67`, claim it. Read `spring_patterns.md` + `java_package_structure.md` before each task.

### Task 9: Shared `OwnedRepository` base

**Files:** `techcore/persistence/OwnedRepository.java`.

- [ ] **Step 1: Base repository (owner-scoped reads)**

Create `backend/src/main/java/io/mrkuhne/mezo/techcore/persistence/OwnedRepository.java`:
```java
package io.mrkuhne.mezo.techcore.persistence;

import java.util.List;
import java.util.UUID;
import org.springframework.data.repository.NoRepositoryBean;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

@NoRepositoryBean
public interface OwnedRepository<T extends OwnedEntity> extends JpaRepository<T, UUID> {
    @Query("select e from #{#entityName} e where e.createdBy = :createdBy and e.deleted = false")
    List<T> findAllOwned(@Param("createdBy") UUID createdBy);
}
```
> `e.deleted = false` plus a Hibernate `@SQLRestriction("is_deleted = false")` on each entity gives defense in depth. Use both.

- [ ] **Step 2: Compile + commit**

Run: `cd backend && ./mvnw -q compile` → Expected: SUCCESS.
```bash
git add backend && git commit -m "feat(persistence): owner-scoped OwnedRepository base

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 10: `weight_log` end-to-end

**Files:** Liquibase script; `feature/biometrics/weight/{entity/WeightLogEntity, repository/WeightLogRepository, dto/{WeightLogResponse,LogWeightRequest}, mapper/WeightLogMapper, service/WeightLogService, controller/WeightLogController}.java`; test `WeightLogControllerIT.java`.

- [ ] **Step 1: Failing ownership integration test**

Create `backend/src/test/java/io/mrkuhne/mezo/feature/biometrics/weight/WeightLogServiceIT.java`:
```java
package io.mrkuhne.mezo.feature.biometrics.weight;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.biometrics.weight.dto.LogWeightRequest;
import io.mrkuhne.mezo.feature.biometrics.weight.service.WeightLogService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class WeightLogServiceIT extends AbstractIntegrationTest {

    @Autowired private WeightLogService service;

    @Test
    void testList_shouldReturnOnlyOwnRows_whenTwoUsersLog() {
        UUID userA = UUID.randomUUID();
        UUID userB = UUID.randomUUID();
        service.log(userA, new LogWeightRequest(LocalDate.parse("2026-06-01"), new BigDecimal("82.5"), null));
        service.log(userB, new LogWeightRequest(LocalDate.parse("2026-06-01"), new BigDecimal("70.0"), null));

        assertThat(service.list(userA)).hasSize(1)
            .first().extracting("value").isEqualTo(new BigDecimal("82.5"));
        assertThat(service.list(userB)).hasSize(1);
    }
}
```

- [ ] **Step 2: Run — verify it fails to compile/needs the classes**

Run: `cd backend && ./mvnw -q test -Dtest=WeightLogServiceIT`
Expected: FAIL (classes don't exist yet).

- [ ] **Step 3: Liquibase changeset**

Create `db/changelog/1.0.0/script/202606101300_mezo-v67_create_weight_log.sql`:
```sql
CREATE TABLE weight_log (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by UUID NOT NULL,
    date       DATE NOT NULL,
    weight_kg  NUMERIC(5,2) NOT NULL,
    note       VARCHAR(500),
    is_deleted BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_weight_log_created_by_app_user_id
        FOREIGN KEY (created_by) REFERENCES app_user(id) ON DELETE CASCADE
);
CREATE INDEX idx_weight_log_created_by_date ON weight_log (created_by, date);
```
Append the changeset to `1.0.0_master.yml` (same `sqlFile` pattern, id `1.0.0:202606101300_mezo-v67_create_weight_log`).

- [ ] **Step 4: Entity**

Create `.../weight/entity/WeightLogEntity.java`:
```java
package io.mrkuhne.mezo.feature.biometrics.weight.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

@Getter
@Setter
@Entity
@Table(name = "weight_log")
@SQLDelete(sql = "update weight_log set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class WeightLogEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull
    @Column(nullable = false)
    private LocalDate date;

    @NotNull
    @Column(name = "weight_kg", nullable = false, precision = 5, scale = 2)
    private BigDecimal weightKg;

    @Column(length = 500)
    private String note;
}
```

- [ ] **Step 5: Repository**

Create `.../weight/repository/WeightLogRepository.java`:
```java
package io.mrkuhne.mezo.feature.biometrics.weight.repository;

import io.mrkuhne.mezo.feature.biometrics.weight.entity.WeightLogEntity;
import io.mrkuhne.mezo.techcore.persistence.OwnedRepository;

public interface WeightLogRepository extends OwnedRepository<WeightLogEntity> { }
```

- [ ] **Step 6: DTOs + mapper**

Create `.../weight/dto/LogWeightRequest.java`:
```java
package io.mrkuhne.mezo.feature.biometrics.weight.dto;

import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;

public record LogWeightRequest(@NotNull LocalDate date, @NotNull BigDecimal weightKg, String note) {}
```
Create `.../weight/dto/WeightLogResponse.java`:
```java
package io.mrkuhne.mezo.feature.biometrics.weight.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record WeightLogResponse(UUID id, LocalDate date, BigDecimal value, String note) {}
```
Create `.../weight/mapper/WeightLogMapper.java`:
```java
package io.mrkuhne.mezo.feature.biometrics.weight.mapper;

import io.mrkuhne.mezo.feature.biometrics.weight.dto.WeightLogResponse;
import io.mrkuhne.mezo.feature.biometrics.weight.entity.WeightLogEntity;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface WeightLogMapper {
    @Mapping(target = "value", source = "weightKg")
    WeightLogResponse toResponse(WeightLogEntity entity);
}
```
> The response field is `value` to match the frontend `WeightEntry { date, value, note }` shape.

- [ ] **Step 7: Service**

Create `.../weight/service/WeightLogService.java`:
```java
package io.mrkuhne.mezo.feature.biometrics.weight.service;

import io.mrkuhne.mezo.feature.biometrics.weight.dto.LogWeightRequest;
import io.mrkuhne.mezo.feature.biometrics.weight.dto.WeightLogResponse;
import io.mrkuhne.mezo.feature.biometrics.weight.entity.WeightLogEntity;
import io.mrkuhne.mezo.feature.biometrics.weight.mapper.WeightLogMapper;
import io.mrkuhne.mezo.feature.biometrics.weight.repository.WeightLogRepository;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class WeightLogService {

    private final WeightLogRepository repository;
    private final WeightLogMapper mapper;

    public List<WeightLogResponse> list(UUID createdBy) {
        return repository.findAllOwned(createdBy).stream().map(mapper::toResponse).toList();
    }

    @Transactional
    public WeightLogResponse log(UUID createdBy, LogWeightRequest req) {
        WeightLogEntity e = new WeightLogEntity();
        e.setCreatedBy(createdBy);           // server-side from principal, never from client
        e.setDate(req.date());
        e.setWeightKg(req.weightKg());
        e.setNote(req.note());
        return mapper.toResponse(repository.save(e));
    }
}
```

- [ ] **Step 8: Controller**

Create `.../weight/controller/WeightLogController.java`:
```java
package io.mrkuhne.mezo.feature.biometrics.weight.controller;

import io.mrkuhne.mezo.feature.biometrics.weight.dto.LogWeightRequest;
import io.mrkuhne.mezo.feature.biometrics.weight.dto.WeightLogResponse;
import io.mrkuhne.mezo.feature.biometrics.weight.service.WeightLogService;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/biometrics/weight")
@RequiredArgsConstructor
public class WeightLogController {

    private final WeightLogService service;
    private final CurrentUserId currentUserId;

    @GetMapping
    public List<WeightLogResponse> list() {
        return service.list(currentUserId.get());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public WeightLogResponse log(@Valid @RequestBody LogWeightRequest req) {
        return service.log(currentUserId.get(), req);
    }
}
```

- [ ] **Step 9: Run the ownership test — verify pass**

Run: `cd backend && ./mvnw -q test -Dtest=WeightLogServiceIT` → Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add backend && git commit -m "feat(biometrics): weight_log end-to-end + ownership isolation test

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 11: `sleep_log` end-to-end

**Files:** mirror Task 10 under `feature/biometrics/sleep/`. Frontend shape: `SleepLogInput { date, bedtime, wakeup, durationH, quality, awakenings, note? }` → `SleepEntry { date, bedtime, wakeup, duration, quality, awakenings, mealToSleep, notes }`.

- [ ] **Step 1: Failing service IT**

Create `.../feature/biometrics/sleep/SleepLogServiceIT.java`:
```java
package io.mrkuhne.mezo.feature.biometrics.sleep;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.biometrics.sleep.dto.LogSleepRequest;
import io.mrkuhne.mezo.feature.biometrics.sleep.service.SleepLogService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class SleepLogServiceIT extends AbstractIntegrationTest {

    @Autowired private SleepLogService service;

    @Test
    void testList_shouldReturnOnlyOwnRows_whenTwoUsersLog() {
        UUID userA = UUID.randomUUID();
        UUID userB = UUID.randomUUID();
        service.log(userA, new LogSleepRequest(
            LocalDate.parse("2026-06-01"), "23:10", "06:40",
            new BigDecimal("7.5"), 8, 1, null));
        service.log(userB, new LogSleepRequest(
            LocalDate.parse("2026-06-01"), "00:30", "07:00",
            new BigDecimal("6.5"), 6, 2, null));
        assertThat(service.list(userA)).hasSize(1);
        assertThat(service.list(userB)).hasSize(1);
    }
}
```

- [ ] **Step 2: Run — expect FAIL.** `./mvnw -q test -Dtest=SleepLogServiceIT`

- [ ] **Step 3: Liquibase changeset**

Create `db/changelog/1.0.0/script/202606101310_mezo-v67_create_sleep_log.sql`:
```sql
CREATE TABLE sleep_log (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by  UUID NOT NULL,
    date        DATE NOT NULL,
    bedtime     VARCHAR(5),
    wakeup      VARCHAR(5),
    duration_h  NUMERIC(4,2),
    quality     INT,
    awakenings  INT,
    notes       VARCHAR(500),
    is_deleted  BOOLEAN NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_sleep_log_created_by_app_user_id
        FOREIGN KEY (created_by) REFERENCES app_user(id) ON DELETE CASCADE,
    CONSTRAINT ck_sleep_log_quality_range CHECK (quality IS NULL OR quality BETWEEN 1 AND 10)
);
CREATE INDEX idx_sleep_log_created_by_date ON sleep_log (created_by, date);
```
Append to `1.0.0_master.yml` (id `1.0.0:202606101310_mezo-v67_create_sleep_log`).

- [ ] **Step 4: Entity**

Create `.../sleep/entity/SleepLogEntity.java`:
```java
package io.mrkuhne.mezo.feature.biometrics.sleep.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

@Getter
@Setter
@Entity
@Table(name = "sleep_log")
@SQLDelete(sql = "update sleep_log set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class SleepLogEntity extends OwnedEntity {

    @Id @GeneratedValue @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull @Column(nullable = false)
    private LocalDate date;

    @Column(length = 5) private String bedtime;
    @Column(length = 5) private String wakeup;
    @Column(name = "duration_h", precision = 4, scale = 2) private BigDecimal durationH;
    private Integer quality;
    private Integer awakenings;
    @Column(length = 500) private String notes;
}
```

- [ ] **Step 5: Repository / DTOs / mapper / service / controller**

`.../sleep/repository/SleepLogRepository.java`:
```java
package io.mrkuhne.mezo.feature.biometrics.sleep.repository;

import io.mrkuhne.mezo.feature.biometrics.sleep.entity.SleepLogEntity;
import io.mrkuhne.mezo.techcore.persistence.OwnedRepository;

public interface SleepLogRepository extends OwnedRepository<SleepLogEntity> { }
```
`.../sleep/dto/LogSleepRequest.java`:
```java
package io.mrkuhne.mezo.feature.biometrics.sleep.dto;

import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;

public record LogSleepRequest(
    @NotNull LocalDate date, String bedtime, String wakeup,
    BigDecimal durationH, Integer quality, Integer awakenings, String note) {}
```
`.../sleep/dto/SleepLogResponse.java` (matches `SleepEntry`):
```java
package io.mrkuhne.mezo.feature.biometrics.sleep.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record SleepLogResponse(
    UUID id, LocalDate date, String bedtime, String wakeup,
    BigDecimal duration, Integer quality, Integer awakenings,
    int mealToSleep, String notes) {}
```
`.../sleep/mapper/SleepLogMapper.java`:
```java
package io.mrkuhne.mezo.feature.biometrics.sleep.mapper;

import io.mrkuhne.mezo.feature.biometrics.sleep.dto.SleepLogResponse;
import io.mrkuhne.mezo.feature.biometrics.sleep.entity.SleepLogEntity;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface SleepLogMapper {
    @Mapping(target = "duration", source = "durationH")
    @Mapping(target = "mealToSleep", constant = "0")
    SleepLogResponse toResponse(SleepLogEntity entity);
}
```
`.../sleep/service/SleepLogService.java`:
```java
package io.mrkuhne.mezo.feature.biometrics.sleep.service;

import io.mrkuhne.mezo.feature.biometrics.sleep.dto.LogSleepRequest;
import io.mrkuhne.mezo.feature.biometrics.sleep.dto.SleepLogResponse;
import io.mrkuhne.mezo.feature.biometrics.sleep.entity.SleepLogEntity;
import io.mrkuhne.mezo.feature.biometrics.sleep.mapper.SleepLogMapper;
import io.mrkuhne.mezo.feature.biometrics.sleep.repository.SleepLogRepository;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class SleepLogService {

    private final SleepLogRepository repository;
    private final SleepLogMapper mapper;

    public List<SleepLogResponse> list(UUID createdBy) {
        return repository.findAllOwned(createdBy).stream().map(mapper::toResponse).toList();
    }

    @Transactional
    public SleepLogResponse log(UUID createdBy, LogSleepRequest req) {
        SleepLogEntity e = new SleepLogEntity();
        e.setCreatedBy(createdBy);
        e.setDate(req.date());
        e.setBedtime(req.bedtime());
        e.setWakeup(req.wakeup());
        e.setDurationH(req.durationH());
        e.setQuality(req.quality());
        e.setAwakenings(req.awakenings());
        e.setNotes(req.note());
        return mapper.toResponse(repository.save(e));
    }
}
```
`.../sleep/controller/SleepLogController.java`:
```java
package io.mrkuhne.mezo.feature.biometrics.sleep.controller;

import io.mrkuhne.mezo.feature.biometrics.sleep.dto.LogSleepRequest;
import io.mrkuhne.mezo.feature.biometrics.sleep.dto.SleepLogResponse;
import io.mrkuhne.mezo.feature.biometrics.sleep.service.SleepLogService;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/biometrics/sleep")
@RequiredArgsConstructor
public class SleepLogController {

    private final SleepLogService service;
    private final CurrentUserId currentUserId;

    @GetMapping
    public List<SleepLogResponse> list() { return service.list(currentUserId.get()); }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public SleepLogResponse log(@Valid @RequestBody LogSleepRequest req) {
        return service.log(currentUserId.get(), req);
    }
}
```

- [ ] **Step 6: Run + commit**

Run: `cd backend && ./mvnw -q test -Dtest=SleepLogServiceIT` → Expected: PASS.
```bash
git add backend && git commit -m "feat(biometrics): sleep_log end-to-end + ownership isolation test

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 12: `check_in` end-to-end

**Files:** mirror under `feature/biometrics/checkin/`. Frontend: `CheckinSlot { time, state, values:{energy,stress,body,mental}|null, note, savedAt? }`, 4 daily slots. Mapping: one `check_in` row per slot, keyed by `(created_by, date, slot_time)`; `saveCheckIn` upserts a slot.

- [ ] **Step 1: Failing service IT (upsert by slot)**

Create `.../feature/biometrics/checkin/CheckInServiceIT.java`:
```java
package io.mrkuhne.mezo.feature.biometrics.checkin;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.biometrics.checkin.dto.SaveCheckInRequest;
import io.mrkuhne.mezo.feature.biometrics.checkin.service.CheckInService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class CheckInServiceIT extends AbstractIntegrationTest {

    @Autowired private CheckInService service;

    @Test
    void testSave_shouldUpsertSlot_whenSavedTwice() {
        UUID user = UUID.randomUUID();
        LocalDate day = LocalDate.parse("2026-06-01");
        service.save(user, new SaveCheckInRequest(day, "09:00", "done", 7, 4, 6, 8, null));
        service.save(user, new SaveCheckInRequest(day, "09:00", "done", 8, 3, 7, 9, "better"));

        var rows = service.listForDay(user, day);
        assertThat(rows).hasSize(1);
        assertThat(rows.get(0).energy()).isEqualTo(8);
        assertThat(rows.get(0).note()).isEqualTo("better");
    }
}
```

- [ ] **Step 2: Run — expect FAIL.** `./mvnw -q test -Dtest=CheckInServiceIT`

- [ ] **Step 3: Liquibase changeset**

Create `db/changelog/1.0.0/script/202606101320_mezo-v67_create_check_in.sql`:
```sql
CREATE TABLE check_in (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by  UUID NOT NULL,
    date        DATE NOT NULL,
    slot_time   VARCHAR(5) NOT NULL,
    state       VARCHAR(10) NOT NULL,
    energy      INT,
    stress      INT,
    body        INT,
    mental      INT,
    note        VARCHAR(500),
    saved_at    TIMESTAMPTZ,
    is_deleted  BOOLEAN NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_check_in_created_by_app_user_id
        FOREIGN KEY (created_by) REFERENCES app_user(id) ON DELETE CASCADE,
    CONSTRAINT uq_check_in_created_by_date_slot UNIQUE (created_by, date, slot_time),
    CONSTRAINT ck_check_in_state CHECK (state IN ('done','now','skipped','pending'))
);
CREATE INDEX idx_check_in_created_by_date ON check_in (created_by, date);
```
Append to `1.0.0_master.yml` (id `1.0.0:202606101320_mezo-v67_create_check_in`).

- [ ] **Step 4: Entity**

Create `.../checkin/entity/CheckInEntity.java`:
```java
package io.mrkuhne.mezo.feature.biometrics.checkin.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

@Getter
@Setter
@Entity
@Table(name = "check_in")
@SQLDelete(sql = "update check_in set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class CheckInEntity extends OwnedEntity {

    @Id @GeneratedValue @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull @Column(nullable = false) private LocalDate date;
    @NotNull @Column(name = "slot_time", nullable = false, length = 5) private String slotTime;
    @NotNull @Column(nullable = false, length = 10) private String state;
    private Integer energy;
    private Integer stress;
    private Integer body;
    private Integer mental;
    @Column(length = 500) private String note;
    @Column(name = "saved_at") private Instant savedAt;
}
```

- [ ] **Step 5: Repository / DTOs / mapper / service / controller**

`.../checkin/repository/CheckInRepository.java`:
```java
package io.mrkuhne.mezo.feature.biometrics.checkin.repository;

import io.mrkuhne.mezo.feature.biometrics.checkin.entity.CheckInEntity;
import io.mrkuhne.mezo.techcore.persistence.OwnedRepository;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CheckInRepository extends OwnedRepository<CheckInEntity> {
    List<CheckInEntity> findByCreatedByAndDateOrderBySlotTime(UUID createdBy, LocalDate date);
    Optional<CheckInEntity> findByCreatedByAndDateAndSlotTime(UUID createdBy, LocalDate date, String slotTime);
}
```
`.../checkin/dto/SaveCheckInRequest.java`:
```java
package io.mrkuhne.mezo.feature.biometrics.checkin.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;

public record SaveCheckInRequest(
    @NotNull LocalDate date, @NotBlank String slotTime, @NotBlank String state,
    Integer energy, Integer stress, Integer body, Integer mental, String note) {}
```
`.../checkin/dto/CheckInResponse.java`:
```java
package io.mrkuhne.mezo.feature.biometrics.checkin.dto;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record CheckInResponse(
    UUID id, LocalDate date, String slotTime, String state,
    Integer energy, Integer stress, Integer body, Integer mental,
    String note, Instant savedAt) {}
```
`.../checkin/mapper/CheckInMapper.java`:
```java
package io.mrkuhne.mezo.feature.biometrics.checkin.mapper;

import io.mrkuhne.mezo.feature.biometrics.checkin.dto.CheckInResponse;
import io.mrkuhne.mezo.feature.biometrics.checkin.entity.CheckInEntity;
import org.mapstruct.Mapper;

@Mapper(componentModel = "spring")
public interface CheckInMapper {
    CheckInResponse toResponse(CheckInEntity entity);
}
```
`.../checkin/service/CheckInService.java`:
```java
package io.mrkuhne.mezo.feature.biometrics.checkin.service;

import io.mrkuhne.mezo.feature.biometrics.checkin.dto.CheckInResponse;
import io.mrkuhne.mezo.feature.biometrics.checkin.dto.SaveCheckInRequest;
import io.mrkuhne.mezo.feature.biometrics.checkin.entity.CheckInEntity;
import io.mrkuhne.mezo.feature.biometrics.checkin.mapper.CheckInMapper;
import io.mrkuhne.mezo.feature.biometrics.checkin.repository.CheckInRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class CheckInService {

    private final CheckInRepository repository;
    private final CheckInMapper mapper;

    public List<CheckInResponse> listForDay(UUID createdBy, LocalDate date) {
        return repository.findByCreatedByAndDateOrderBySlotTime(createdBy, date)
            .stream().map(mapper::toResponse).toList();
    }

    @Transactional
    public CheckInResponse save(UUID createdBy, SaveCheckInRequest req) {
        CheckInEntity e = repository
            .findByCreatedByAndDateAndSlotTime(createdBy, req.date(), req.slotTime())
            .orElseGet(CheckInEntity::new);
        e.setCreatedBy(createdBy);
        e.setDate(req.date());
        e.setSlotTime(req.slotTime());
        e.setState(req.state());
        e.setEnergy(req.energy());
        e.setStress(req.stress());
        e.setBody(req.body());
        e.setMental(req.mental());
        e.setNote(req.note());
        e.setSavedAt(Instant.now());
        return mapper.toResponse(repository.save(e));
    }
}
```
`.../checkin/controller/CheckInController.java`:
```java
package io.mrkuhne.mezo.feature.biometrics.checkin.controller;

import io.mrkuhne.mezo.feature.biometrics.checkin.dto.CheckInResponse;
import io.mrkuhne.mezo.feature.biometrics.checkin.dto.SaveCheckInRequest;
import io.mrkuhne.mezo.feature.biometrics.checkin.service.CheckInService;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/biometrics/checkin")
@RequiredArgsConstructor
public class CheckInController {

    private final CheckInService service;
    private final CurrentUserId currentUserId;

    @GetMapping
    public List<CheckInResponse> listForDay(
        @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return service.listForDay(currentUserId.get(), date);
    }

    @PostMapping
    public CheckInResponse save(@Valid @RequestBody SaveCheckInRequest req) {
        return service.save(currentUserId.get(), req);
    }
}
```

- [ ] **Step 6: Run + commit**

Run: `cd backend && ./mvnw -q test -Dtest=CheckInServiceIT` → Expected: PASS.
Then run the full backend suite: `./mvnw -q test` → Expected: all green.
```bash
git add backend && git commit -m "feat(biometrics): check_in end-to-end (slot upsert) + isolation test

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

> Close P3 bd task.

---

## PHASE 4 — Frontend integration (TanStack Query)

> bd: create `Slice A · P4 frontend wiring`, dep on `mezo-v67`, claim it. All work under `frontend/`.

### Task 13: Query client + API client + auth bootstrap + MSW

**Files:** create `frontend/src/app/providers/QueryProvider.tsx`, `frontend/src/lib/{api,auth,biometricsApi}.ts`, `frontend/.env`, `frontend/src/test/msw/{server,handlers}.ts`; modify `frontend/src/main.tsx`.

- [ ] **Step 1: Install deps**

Run:
```bash
cd frontend && pnpm add @tanstack/react-query && pnpm add -D msw
```

- [ ] **Step 2: Env + API client**

Create `frontend/.env`:
```
VITE_API_URL=http://localhost:8080
VITE_OWNER_EMAIL=owner@mezo.local
VITE_OWNER_PASSWORD=owner
VITE_USE_MOCK=true
```
Create `frontend/src/lib/api.ts`:
```ts
const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8080'

export interface SystemMessage {
  code: string; message: string; fieldName?: string; exceptionTraceId?: string
}
export class ApiError extends Error {
  constructor(public messages: SystemMessage[]) {
    super(messages[0]?.message ?? messages[0]?.code ?? 'API error')
  }
}

let token: string | null = null
export function setToken(t: string | null) { token = t }

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => [])) as SystemMessage[]
    throw new ApiError(Array.isArray(body) ? body : [{ code: 'INTERNAL_ERROR', message: 'error' }])
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T)
}
```
Create `frontend/src/lib/auth.ts`:
```ts
import { apiFetch, setToken } from './api'

export async function bootstrapOwnerToken(): Promise<void> {
  const { token } = await apiFetch<{ token: string }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: import.meta.env.VITE_OWNER_EMAIL,
      password: import.meta.env.VITE_OWNER_PASSWORD,
    }),
  })
  setToken(token)
}
```

- [ ] **Step 3: QueryProvider + auth bootstrap, wired in main.tsx**

Create `frontend/src/app/providers/QueryProvider.tsx`:
```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect, useState, type ReactNode } from 'react'
import { bootstrapOwnerToken } from '@/lib/auth'

const client = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
})
const useMock = import.meta.env.VITE_USE_MOCK === 'true'

export function QueryProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(useMock)
  useEffect(() => {
    if (useMock) return
    bootstrapOwnerToken().then(() => setReady(true)).catch(() => setReady(true))
  }, [])
  if (!ready) return null
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
```
Modify `frontend/src/main.tsx` — wrap the app:
```tsx
import { QueryProvider } from '@/app/providers/QueryProvider'
// ... inside render:
//   <QueryProvider><App /></QueryProvider>
```
Read `main.tsx` first and wrap the existing `<App/>` (or router) in `<QueryProvider>`.

- [ ] **Step 4: MSW server for tests**

Create `frontend/src/test/msw/handlers.ts`:
```ts
import { http, HttpResponse } from 'msw'

const base = 'http://localhost:8080'
export const handlers = [
  http.post(`${base}/api/auth/login`, () => HttpResponse.json({ token: 'test-token' })),
  http.get(`${base}/api/biometrics/weight`, () =>
    HttpResponse.json([{ id: 'w1', date: '2026-06-01', value: 82.5, note: null }])),
  http.post(`${base}/api/biometrics/weight`, async ({ request }) => {
    const b = (await request.json()) as { date: string; weightKg: number; note?: string }
    return HttpResponse.json(
      { id: 'w2', date: b.date, value: b.weightKg, note: b.note ?? null },
      { status: 201 })
  }),
]
```
Create `frontend/src/test/msw/server.ts`:
```ts
import { setupServer } from 'msw/node'
import { handlers } from './handlers'

export const server = setupServer(...handlers)
```
Register lifecycle in the vitest setup file (read `frontend/src/test/` for the existing setup; add):
```ts
import { server } from './msw/server'
beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
```

- [ ] **Step 5: Commit**

```bash
cd /Users/daniel.kuhne/MrKuhne/mezo
git add frontend && git commit -m "feat(frontend): TanStack Query provider + API client + auth bootstrap + MSW

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 14: Wire `useGoals` (weight) to the API

**Files:** create `frontend/src/lib/biometricsApi.ts`; modify `frontend/src/data/hooks.ts` (`useGoals`); modify the goals data test.

- [ ] **Step 1: API functions**

Create `frontend/src/lib/biometricsApi.ts`:
```ts
import { apiFetch } from './api'
import type { WeightEntry, WeightLogInput } from '@/data/types'

export const weightApi = {
  list: () => apiFetch<WeightEntry[]>('/api/biometrics/weight'),
  log: (input: WeightLogInput) =>
    apiFetch<WeightEntry>('/api/biometrics/weight', {
      method: 'POST',
      body: JSON.stringify({ date: input.date, weightKg: input.weightKg, note: input.note }),
    }),
}
```

- [ ] **Step 2: Failing test — hook returns server data and posts**

Modify the goals test (find it: `frontend/src/data/*.test.tsx` covering `useGoals`; if none, create `frontend/src/data/goalsHooks.test.tsx`):
```tsx
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useGoals } from './hooks'

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

test('useGoals loads weightLog from API and logWeight posts', async () => {
  const { result } = renderHook(() => useGoals(), { wrapper })
  await waitFor(() => expect(result.current.weightLog.length).toBeGreaterThan(0))
  expect(result.current.weightLog[0].value).toBe(82.5)

  await act(async () => {
    result.current.logWeight({ date: '2026-06-02', weightKg: 81.9 })
  })
  await waitFor(() =>
    expect(result.current.weightLog.some(w => w.date === '2026-06-02')).toBe(true))
})
```

- [ ] **Step 3: Run — expect FAIL** (`useGoals` still returns mock useState).

Run: `cd frontend && pnpm test -- goalsHooks` → Expected: FAIL.

- [ ] **Step 4: Rewrite `useGoals` internals (signature unchanged)**

In `frontend/src/data/hooks.ts`, replace the `useGoals` body:
```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { weightApi } from '@/lib/biometricsApi'
// ...

export function useGoals() {
  const qc = useQueryClient()
  const { data: weightLog = [] } = useQuery({
    queryKey: ['weightLog'],
    queryFn: weightApi.list,
  })
  const mutation = useMutation({
    mutationFn: weightApi.log,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['weightLog'] }),
  })
  const logWeight = useCallback((input: WeightLogInput) => mutation.mutate(input), [mutation])
  return { goal, weightLog, weightTrends, linkedMesocycles, logWeight }
}
```
> `goal`, `weightTrends`, `linkedMesocycles` stay as their imported mock values for now (Train slice replaces them). Only `weightLog` + `logWeight` go live. The return shape is byte-identical to before.

- [ ] **Step 5: Run — expect PASS**

Run: `cd frontend && pnpm test -- goalsHooks` → Expected: PASS.

- [ ] **Step 6: Full FE test + parity, then commit**

Run: `cd frontend && pnpm test && pnpm parity` → Expected: green (parity unaffected — UI shape unchanged).
```bash
cd /Users/daniel.kuhne/MrKuhne/mezo
git add frontend && git commit -m "feat(frontend): wire useGoals weightLog/logWeight to REST via TanStack Query

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 15: Wire `useSleep` to the API

**Files:** extend `biometricsApi.ts`; modify `useSleep` in `hooks.ts`; add MSW handlers + test.

- [ ] **Step 1: Add sleep API + MSW handlers**

Append to `frontend/src/lib/biometricsApi.ts`:
```ts
import type { SleepEntry, SleepLogInput } from '@/data/types'

export const sleepApi = {
  list: () => apiFetch<SleepEntry[]>('/api/biometrics/sleep'),
  log: (input: SleepLogInput) =>
    apiFetch<SleepEntry>('/api/biometrics/sleep', {
      method: 'POST',
      body: JSON.stringify({
        date: input.date, bedtime: input.bedtime, wakeup: input.wakeup,
        durationH: input.durationH, quality: input.quality,
        awakenings: input.awakenings, note: input.note,
      }),
    }),
}
```
Append handlers to `frontend/src/test/msw/handlers.ts`:
```ts
  http.get(`${base}/api/biometrics/sleep`, () =>
    HttpResponse.json([{ id: 's1', date: '2026-06-01', bedtime: '23:10', wakeup: '06:40',
      duration: 7.5, quality: 8, awakenings: 1, mealToSleep: 0, notes: null }])),
  http.post(`${base}/api/biometrics/sleep`, async ({ request }) => {
    const b = (await request.json()) as any
    return HttpResponse.json({ id: 's2', date: b.date, bedtime: b.bedtime, wakeup: b.wakeup,
      duration: b.durationH, quality: b.quality, awakenings: b.awakenings,
      mealToSleep: 0, notes: b.note ?? null }, { status: 201 })
  }),
```

- [ ] **Step 2: Failing test**

Create `frontend/src/data/sleepHooks.test.tsx` (same `wrapper` pattern as Task 14):
```tsx
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useSleep } from './hooks'

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

test('useSleep loads from API and logSleep posts', async () => {
  const { result } = renderHook(() => useSleep(), { wrapper })
  await waitFor(() => expect(result.current.sleepLog.length).toBeGreaterThan(0))
  await act(async () => {
    result.current.logSleep({ date: '2026-06-02', bedtime: '23:00', wakeup: '06:30',
      durationH: 7.5, quality: 7, awakenings: 0 })
  })
  await waitFor(() =>
    expect(result.current.sleepLog.some(s => s.date === '2026-06-02')).toBe(true))
})
```

- [ ] **Step 3: Run — expect FAIL.** `cd frontend && pnpm test -- sleepHooks`

- [ ] **Step 4: Rewrite `useSleep` internals**

Replace `useSleep` body in `hooks.ts`:
```ts
export function useSleep() {
  const qc = useQueryClient()
  const { data: sleepLog = [] } = useQuery({ queryKey: ['sleepLog'], queryFn: sleepApi.list })
  const mutation = useMutation({
    mutationFn: sleepApi.log,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sleepLog'] }),
  })
  const logSleep = useCallback((input: SleepLogInput) => mutation.mutate(input), [mutation])
  return { sleepLog, sleepTrends, lastNight: sleepLog[sleepLog.length - 1], logSleep }
}
```
(Import `sleepApi` at top.)

- [ ] **Step 5: Run — expect PASS**, then full + commit

Run: `cd frontend && pnpm test && pnpm parity` → Expected: green.
```bash
cd /Users/daniel.kuhne/MrKuhne/mezo
git add frontend && git commit -m "feat(frontend): wire useSleep to REST via TanStack Query

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 16: Wire `useCheckins` to the API

**Files:** extend `biometricsApi.ts`; modify `useCheckins` in `hooks.ts`; MSW + test. The slot-index mapping: today's 4 slots come from `initialCheckins` (keeps slot times/labels); `saveCheckIn(idx, data)` POSTs the slot identified by `checkins[idx].time`.

- [ ] **Step 1: Add checkin API + MSW handlers**

Append to `frontend/src/lib/biometricsApi.ts`:
```ts
import type { CheckinSlot } from '@/data/types'

export interface SaveCheckInBody {
  date: string; slotTime: string; state: string
  energy?: number; stress?: number; body?: number; mental?: number; note?: string
}
export const checkinApi = {
  listForDay: (date: string) =>
    apiFetch<any[]>(`/api/biometrics/checkin?date=${date}`),
  save: (body: SaveCheckInBody) =>
    apiFetch<any>('/api/biometrics/checkin', { method: 'POST', body: JSON.stringify(body) }),
}
```
Append MSW handlers (return one saved slot):
```ts
  http.get(`${base}/api/biometrics/checkin`, () => HttpResponse.json([])),
  http.post(`${base}/api/biometrics/checkin`, async ({ request }) => {
    const b = (await request.json()) as any
    return HttpResponse.json({ id: 'c1', ...b, savedAt: '2026-06-01T09:00:00Z' })
  }),
```

- [ ] **Step 2: Failing test — saveCheckIn posts and reflects locally**

Create `frontend/src/data/checkinHooks.test.tsx`:
```tsx
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useCheckins } from './hooks'

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

test('useCheckins saveCheckIn updates the slot and posts', async () => {
  const { result } = renderHook(() => useCheckins(), { wrapper })
  expect(result.current.checkins.length).toBe(4)
  await act(async () => {
    result.current.saveCheckIn(0, { state: 'done',
      values: { energy: 8, stress: 3, body: 7, mental: 9 } })
  })
  await waitFor(() => expect(result.current.checkins[0].state).toBe('done'))
})
```

- [ ] **Step 3: Run — expect PASS for the local-state part already** (current `useCheckins` is local useState). To make this a true wiring test, assert the POST fired:

Add a spy in the test — count POSTs via an MSW handler override at the top of the test file:
```tsx
import { server } from '@/test/msw/server'
import { http, HttpResponse } from 'msw'

let posted = 0
beforeEach(() => {
  posted = 0
  server.use(http.post('http://localhost:8080/api/biometrics/checkin', async ({ request }) => {
    posted++
    const b = await request.json()
    return HttpResponse.json({ id: 'c1', ...(b as object), savedAt: '2026-06-01T09:00:00Z' })
  }))
})
```
And add `await waitFor(() => expect(posted).toBe(1))` after the `act`. Run: `pnpm test -- checkinHooks` → expect FAIL (no POST yet).

- [ ] **Step 4: Rewrite `useCheckins` internals (keep slots, add POST on save)**

Replace `useCheckins` in `hooks.ts`:
```ts
export function useCheckins() {
  const [checkins, setCheckins] = useState<CheckinSlot[]>(initialCheckins)
  const mutation = useMutation({ mutationFn: checkinApi.save })
  const saveCheckIn = useCallback((idx: number, data: Partial<CheckinSlot>) => {
    setCheckins(prev => {
      const next = prev.map((c, i) => (i === idx ? { ...c, ...data } : c))
      const slot = next[idx]
      const v = slot.values
      const today = new Date().toISOString().slice(0, 10)
      mutation.mutate({
        date: today, slotTime: slot.time, state: slot.state ?? 'done',
        energy: v?.energy, stress: v?.stress, body: v?.body, mental: v?.mental,
        note: slot.note ?? undefined,
      })
      return next
    })
  }, [mutation])
  return { checkins, saveCheckIn }
}
```
> Optimistic local update preserved (UI behavior identical); the POST is fire-and-forget for now. Slot list still seeds from `initialCheckins` so times/labels/parity are unchanged.

- [ ] **Step 5: Run — expect PASS**, full + commit

Run: `cd frontend && pnpm test && pnpm parity` → Expected: green.
```bash
cd /Users/daniel.kuhne/MrKuhne/mezo
git add frontend && git commit -m "feat(frontend): wire useCheckins saveCheckIn POST via TanStack Query

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 17: Slice A end-to-end verification + checkpoint

- [ ] **Step 1: Backend up with seed**

Run:
```bash
cd backend && docker compose -f compose.yaml up -d
./mvnw spring-boot:run -Dspring-boot.run.profiles=demodata &
sleep 20
curl -s -X POST localhost:8080/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"owner@mezo.local","password":"owner"}'
```
Expected: a JSON `{"token":"..."}`.

- [ ] **Step 2: Real round-trip smoke (manual)**

Run (substitute the token):
```bash
TOKEN=<paste>
curl -s -X POST localhost:8080/api/biometrics/weight -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"date":"2026-06-10","weightKg":81.4}'
curl -s localhost:8080/api/biometrics/weight -H "Authorization: Bearer $TOKEN"
```
Expected: POST returns the row; GET returns a list containing it.

- [ ] **Step 3: Frontend against real backend (mock off)**

Run:
```bash
cd frontend
# set VITE_USE_MOCK=false in .env, then:
pnpm dev
```
Manually: open the app, go to Me → Cél, log a weight; Me → Alvás, log sleep; Today, save a check-in. Confirm they persist across refresh (data comes from Postgres).

- [ ] **Step 4: Full suites green**

Run:
```bash
cd backend && ./mvnw -q test
cd ../frontend && pnpm test && pnpm parity
```
Expected: all green.

- [ ] **Step 5: Final commit + close epic-slice**

```bash
cd /Users/daniel.kuhne/MrKuhne/mezo
git add -A && git commit -m "chore(slice-a): end-to-end verification — biometrics persisted to Postgres

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>" --allow-empty
```
> bd: close all Slice A child tasks. Add a parity sign-off note on `mezo-v67` and leave it open for slices B–E. Then run the session-close protocol (git pull --rebase, bd dolt push, git push).

---

## Self-Review (author checklist — done at write time)

**1. Spec coverage:**
- Monorepo split → Task 1 ✓ · Spring Boot 4.x Maven scaffold → Task 2 ✓ · Postgres+Liquibase → Task 3 ✓ · SystemMessage error handling → Task 4 ✓ · Testcontainers integration harness → Task 5 ✓ · thin auth (app_user/user_profiles, owner seed @Profile demodata, JWT) → Tasks 6–8 ✓ · app-level ownership (created_by from principal, OwnedRepository) → Tasks 9–12 ✓ · UUID PK / soft-delete / jsonb-ready conventions → entities ✓ (jsonb itself first appears in Train, Slice B) · biometrics trio end-to-end → Tasks 10–12 ✓ · TanStack Query + hook swap with unchanged signatures → Tasks 13–16 ✓ · MSW frontend tests → Tasks 14–16 ✓ · `VITE_USE_MOCK` fallback → Task 13 ✓ · parity after slice → Task 17 ✓.
- Liquibase naming uses `{timestamp}_{bd-id}_{desc}` (mezo-v67) ✓ · explicit constraint names (`pk_/fk_/uq_/ck_/idx_`) ✓ · seed in Java not SQL ✓ · constructor injection + method-level `@Transactional` ✓ · AssertJ + `test{Method}_should{Result}_when{Condition}` ✓ · MapStruct mappers ✓.

**2. Placeholder scan:** no TBD/TODO; every code step has full code. Two ordering notes flagged inline (OwnerSeed needs the Task 8 `PasswordEncoder`; the 401 assertion needs the Task 10 endpoint) with explicit resolution — not placeholders.

**3. Type consistency:** `list`/`log`/`save` service method names match across tests and services; response field `value` (weight) and `duration` (sleep) deliberately match the frontend `WeightEntry.value` / `SleepEntry.duration` shapes the hooks already return; `createdBy` set server-side everywhere; `OwnedRepository.findAllOwned` used by both weight and sleep services.

**Known risk to watch during execution:** exact Spring Boot 4.x / Spring Security 7 API surface (the resource-server DSL and Nimbus encoder/decoder beans). If a 4.x signature differs, adjust the `SecurityConfig` beans to the generated version — the structure (permit `/api/auth/login`, stateless, JWT resource server, HS256 secret) stays the same.

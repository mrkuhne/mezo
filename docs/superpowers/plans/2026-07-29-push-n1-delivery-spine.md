# Push N1 — Delivery Spine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** a real Web Push notification, sent by the mezo backend, appears on Daniel's home-screen-installed iPhone PWA.

**Architecture:** a dependency-free `techcore/webpush` package implements the Web Push protocol (VAPID ES256 JWT + RFC 8291 `aes128gcm` payload encryption) and posts over the existing `RestClient`. A thin `feature/notification` package owns the `push_subscription` table and the subscribe/unsubscribe/test-push HTTP surface. On the frontend, a `push-sw.js` imported into the existing vite-plugin-pwa `generateSW` worker renders the notification, and a new `/me/ertesitesek` page owns the opt-in with an iOS standalone install-gate.

**Tech Stack:** Java 21 · Spring Boot 4 · Maven · Postgres 16 + Liquibase · JDK `java.security`/`javax.crypto` (no BouncyCastle) · WireMock · React 19 + Vite + TanStack Query · vite-plugin-pwa (Workbox)

**Spec of record:** [`docs/superpowers/specs/2026-07-29-push-notifications-design.md`](../specs/2026-07-29-push-notifications-design.md) — §3 architecture, §4 `techcore/webpush`, §5 data model, §7 frontend, §9 switches, §11 contract, §12 testing.

**bd:** `mezo-h4wp.6.1` (parent `mezo-h4wp.6`). Claim with `bd update mezo-h4wp.6.1 --claim` before Task 1.

## Global Constraints

- **Zero new Maven dependencies.** No BouncyCastle, no jose4j, no `nl.martijndwars:web-push`. Everything from the JDK + what the pom already has (spec §4).
- **Base package** `io.mrkuhne.mezo`. Backend package layout `feature/{name}/{controller,service,repository,entity,dto,mapper}` + `techcore/` (`java_package_structure.md`).
- **Constructor injection only** via `@RequiredArgsConstructor` — never field injection. `@Transactional` on methods only (`spring_patterns.md`).
- **No `@Value`, ever.** Every tunable is a `@Validated` `@ConfigurationProperties` record under the `mezo:` root (`configuration_conventions.md`).
- **UUID primary keys** (`gen_random_uuid()`), `created_by uuid` set server-side from the principal (never from the client), `is_deleted` + `@SQLRestriction`/`@SQLDelete` soft delete (project adaptations in `CLAUDE.md`).
- **Liquibase:** new script per change, named `{YYYYMMDDHHMM}_mezo-h4wp.6.1_{desc}.sql`, explicit constraint names (`pk_`/`fk_`/`uq_`/`ck_`/`idx_`). Never modify a released changeset. Seed data in Java `@Profile("demodata")`, never SQL (`liquibase_conventions.md`).
- **Contract-first:** edit `api/feature/notification/notification.yml` BEFORE any Java or TS; the backend implements the generated `NotificationApi` and uses `io.mrkuhne.mezo.api.dto` models; the FE takes types from `src/data/_client/api.gen.ts`. Never hand-write a boundary DTO (`api_contract_conventions.md`).
- **Errors:** `SystemRuntimeErrorException` + a `SystemMessage` code registered in `message.properties`. No hardcoded user-facing text, no stack traces to the client (`error_handling.md`).
- **Integration tests over mocks:** extend `ApiIntegrationTest` (HTTP) / `AbstractIntegrationTest` (service); AssertJ only; naming `test{Method}_should{Result}_when{Condition}`; **no `@MockBean`, no H2**. Every new owned table joins the `ResetDatabase` TRUNCATE list in the same change (`testing_standards.md`, `integration_test_framework.md`).
- **Frontend:** four layers, `*Page`/`*Section`/`*Sheet` naming, deep absolute `@/*` imports, **no barrels except `data/hooks.ts`**, colocated tests, `shared/ui` stays domain-free (`docs/references/frontend_conventions.md` — read it before touching `frontend/src`).
- **Both FE test modes must be green:** `pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test`.
- **Never commit a private key.** The VAPID private key exists only as a k8s SealedSecret + a local untracked `.env`. `VITE_VAPID_PUBLIC` (public half) is committable.
- **Web Push hard platform rules:** `userVisibleOnly: true` is mandatory and every push MUST display a notification; iOS delivers Web Push only to a **home-screen-installed** PWA. Payload budget ~4 KB.
- **Always `./mvnw clean test`** — never without `clean` (Lombok+MapStruct incremental compile is flaky).
- **Commit style:** conventional subject carrying the bd id, e.g. `feat(notification): add push_subscription table (mezo-h4wp.6.1)`. Stage explicit paths + `--no-verify` (the beads hook force-stages a stray root `issues.jsonl`); verify the net diff carries no root `issues.jsonl`.

## File Structure

**Backend — new**

| File | Responsibility |
|---|---|
| `techcore/webpush/WebPushProperties.java` | `mezo.webpush.*` validated config record |
| `feature/notification/config/NotificationProperties.java` | `mezo.notification.*` validated record (N1 uses `bodyMaxChars`; N2 extends the same record) |
| `techcore/webpush/VapidSigner.java` | ES256 JWT for the `Authorization: vapid` header; DER→JOSE conversion |
| `techcore/webpush/Aes128GcmEncryptor.java` | ECDH P-256 + HKDF-SHA256 + AES-128-GCM + RFC 8188 framing |
| `techcore/webpush/WebPushClient.java` | HTTP POST; maps 201/404/410/413/429 to `WebPushResult` |
| `techcore/webpush/WebPushResult.java` | `enum { SENT, GONE, TOO_LARGE, THROTTLED, FAILED }` |
| `techcore/webpush/WebPushSubscriptionKeys.java` | `record (String endpoint, String p256dh, String auth)` — the transport-agnostic input |
| `feature/notification/entity/PushSubscriptionEntity.java` | the owned table |
| `feature/notification/repository/PushSubscriptionRepository.java` | owner-scoped finders |
| `feature/notification/service/PushSubscriptionService.java` | register/unregister/list-live/soft-delete-gone |
| `feature/notification/service/PushSender.java` | fan-out to every live subscription + GONE pruning |
| `feature/notification/controller/NotificationController.java` | implements the generated `NotificationApi` |

**Backend — modified:** `techcore/configuration/FeaturesConfiguration.java` (2 switch constants) · `src/main/resources/application.yml` (`mezo.feature.notification`, `mezo.techcore.cron.notification-dispatch-job`, `mezo.webpush.*`, `mezo.notification.body-max-chars`) · `src/test/.../support/ResetDatabase.java` (TRUNCATE list) · `src/test/.../support/DatabasePopulator.java` (+`NotificationPopulator`)

**No new `SystemMessage` code in N1.** Every endpoint here is 204/200; request-shape violations are caught by the generated DTO's bean validation and rendered by the existing `GlobalExceptionHandler`. A push send never surfaces an error to the client (`WebPushResult` is mapped and logged, never thrown) — so `message.properties` is deliberately untouched. N2 adds codes when the pref write path gains real conflict states.

**API contract — new:** `api/feature/notification/notification.yml`; **modified:** `api/generate/merge.yml`, `api/openapi.yml` (generated), `frontend/src/data/_client/api.gen.ts` (generated)

**Frontend — new**

| File | Responsibility |
|---|---|
| `public/push-sw.js` | `push` + `notificationclick` handlers |
| `src/data/notification/notificationApi.ts` | REST client + wire→domain mapping |
| `src/data/notification/notificationHooks.ts` | `usePushSubscription()` |
| `src/data/notification/notificationMock.ts` | deterministic mock state |
| `src/features/me/pages/NotificationsPage.tsx` | the opt-in page |
| `src/features/me/components/PushInstallGate.tsx` | the iOS standalone gate |

**Frontend — modified:** `vite.config.ts` (`workbox.importScripts`) · `src/app/router.tsx` (route) · `src/features/me/pages/tabs.ts` (tab) · `src/data/hooks.ts` (re-export) · `src/data/types.ts` (domain types) · `.env.example`

**Docs — new:** `docs/features/_platform-notifications.md`, `docs/decisions/0014-own-webpush-implementation.md`; **modified:** `docs/infrastructure/deployment-k3s-argocd.md`

---

### Task 1: API contract fragment

**Files:**
- Create: `api/feature/notification/notification.yml`
- Modify: `api/generate/merge.yml` (append one `inputFile` line, before `output:`)
- Generated (commit the result): `api/openapi.yml`, `frontend/src/data/_client/api.gen.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: generated Java interface `io.mrkuhne.mezo.api.controller.NotificationApi` with methods `void registerPushSubscription(PushSubscriptionRequest)`, `void unregisterPushSubscription(String endpoint)`, `PushTestResponse sendTestPush()`; generated DTOs `PushSubscriptionRequest{endpoint,p256dh,auth,userAgent}`, `PushTestResponse{sent,attempted}`. FE wire types `components['schemas']['PushSubscriptionRequest' | 'PushTestResponse']`.

- [ ] **Step 1: Write the fragment**

Create `api/feature/notification/notification.yml`:

```yaml
openapi: 3.0.3
info: { title: mezo notification fragment, version: 1.0.0 }
paths:
  /api/notification/subscription:
    post:
      tags: [Notification]
      operationId: registerPushSubscription
      summary: Register (idempotent) this device's Web Push subscription (Notification)
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/PushSubscriptionRequest' }
      responses:
        '204':
          description: Registered; repeating the same endpoint is a no-op
        '400':
          description: VALIDATION_ERROR
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
        '401':
          description: Missing/invalid token
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
    delete:
      tags: [Notification]
      operationId: unregisterPushSubscription
      summary: Remove this device's subscription (Notification)
      parameters:
        - { name: endpoint, in: query, required: true, schema: { type: string } }
      responses:
        '204':
          description: Removed; unknown endpoint is also 204 (idempotent)
        '401':
          description: Missing/invalid token
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
  /api/notification/test:
    post:
      tags: [Notification]
      operationId: sendTestPush
      summary: Send a fixed test notification to every registered device (Notification)
      responses:
        '200':
          description: How many devices were attempted and how many accepted
          content:
            application/json:
              schema: { $ref: '#/components/schemas/PushTestResponse' }
        '401':
          description: Missing/invalid token
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
components:
  schemas:
    PushSubscriptionRequest:
      type: object
      required: [endpoint, p256dh, auth]
      properties:
        endpoint: { type: string, maxLength: 1000, example: "https://web.push.apple.com/QF..." }
        p256dh: { type: string, maxLength: 120, description: "subscription public key, base64url" }
        auth: { type: string, maxLength: 40, description: "subscription auth secret, base64url" }
        userAgent: { type: string, maxLength: 300, nullable: true }
    PushTestResponse:
      type: object
      required: [attempted, sent]
      properties:
        attempted: { type: integer, example: 1 }
        sent: { type: integer, example: 1 }
```

- [ ] **Step 2: Register the fragment in the merge**

In `api/generate/merge.yml`, add as the last `inputFile` entry (immediately before the `output:` line):

```yaml
  - inputFile: ../feature/notification/notification.yml
```

- [ ] **Step 3: Merge and regenerate**

Run:
```bash
cd api/generate && npm run generate:api
cd ../../frontend && pnpm generate:api
```
Expected: `api/openapi.yml` gains the three `/api/notification/*` paths and the two schemas; `frontend/src/data/_client/api.gen.ts` gains `PushSubscriptionRequest` + `PushTestResponse`.

- [ ] **Step 4: Verify the backend interface generates**

Run:
```bash
cd backend && ./mvnw clean generate-sources -q
ls target/generated-sources/openapi/src/main/java/io/mrkuhne/mezo/api/controller/NotificationApi.java
```
Expected: the file exists (this is the interface Task 6 implements).

- [ ] **Step 5: Commit**

```bash
git add api/feature/notification/notification.yml api/generate/merge.yml api/openapi.yml frontend/src/data/_client/api.gen.ts
git commit --no-verify -m "feat(api): notification contract fragment — subscription + test push (mezo-h4wp.6.1)"
```

---

### Task 2: `push_subscription` table, entity, repository

**Files:**
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202607291000_mezo-h4wp.6.1_create_push_subscription.sql`
- Modify: `backend/src/main/resources/db/changelog/1.0.0/changelog-1.0.0.xml` (register the script — follow the existing `<include>`/`<sqlFile>` idiom used by its neighbours)
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/notification/entity/PushSubscriptionEntity.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/notification/repository/PushSubscriptionRepository.java`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/support/ResetDatabase.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/notification/PushSubscriptionRepositoryIT.java`

**Interfaces:**
- Consumes: `io.mrkuhne.mezo.techcore.persistence.OwnedEntity` (provides `createdBy`, `deleted`, `createdAt`).
- Produces: `PushSubscriptionEntity` with getters/setters for `id, endpoint, p256dh, auth, userAgent, lastSuccessAt`; `PushSubscriptionRepository` with `List<PushSubscriptionEntity> findByCreatedBy(UUID createdBy)` and `Optional<PushSubscriptionEntity> findByCreatedByAndEndpoint(UUID createdBy, String endpoint)`.

- [ ] **Step 1: Write the migration**

Create the SQL file:

```sql
-- Web Push device subscriptions (bd mezo-h4wp.6.1): one live row per device endpoint per user.
-- The endpoint is the push service URL; p256dh/auth are the browser-supplied RFC 8291 key material.
-- last_success_at is a diagnostic (last 201 from the push service), never a delivery gate.
create table push_subscription (
    id              uuid         not null default gen_random_uuid(),
    created_by      uuid         not null,
    endpoint        text         not null,
    p256dh          varchar(120) not null,
    auth            varchar(40)  not null,
    user_agent      varchar(300),
    last_success_at timestamptz,
    is_deleted      boolean      not null default false,
    created_at      timestamptz  not null default now(),
    constraint pk_push_subscription primary key (id),
    constraint fk_push_subscription_created_by_app_user_id
        foreign key (created_by) references app_user (id) on delete cascade
);

-- One LIVE subscription per (user, endpoint): re-subscribing the same device must not duplicate,
-- while a soft-deleted row never blocks a fresh registration (the briefing partial-unique idiom).
create unique index uq_push_subscription_created_by_endpoint
    on push_subscription (created_by, endpoint) where is_deleted = false;
```

- [ ] **Step 2: Write the failing repository IT**

Create `PushSubscriptionRepositoryIT.java`:

```java
package io.mrkuhne.mezo.feature.notification;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.notification.entity.PushSubscriptionEntity;
import io.mrkuhne.mezo.feature.notification.repository.PushSubscriptionRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class PushSubscriptionRepositoryIT extends AbstractIntegrationTest {

    @Autowired private PushSubscriptionRepository repository;

    @Test
    void testFindByCreatedByAndEndpoint_shouldReturnRow_whenLiveRowExists() {
        UUID owner = ownerId();
        PushSubscriptionEntity e = new PushSubscriptionEntity();
        e.setCreatedBy(owner);
        e.setEndpoint("https://web.push.apple.com/abc");
        e.setP256dh("BOr1a2b3");
        e.setAuth("c3VwZXJzZWNyZXQ");
        repository.save(e);

        assertThat(repository.findByCreatedByAndEndpoint(owner, "https://web.push.apple.com/abc"))
            .isPresent();
        assertThat(repository.findByCreatedBy(owner)).hasSize(1);
    }

    @Test
    void testFindByCreatedBy_shouldExcludeRow_whenSoftDeleted() {
        UUID owner = ownerId();
        PushSubscriptionEntity e = new PushSubscriptionEntity();
        e.setCreatedBy(owner);
        e.setEndpoint("https://web.push.apple.com/gone");
        e.setP256dh("BOr1a2b3");
        e.setAuth("c3VwZXJzZWNyZXQ");
        repository.save(e);
        repository.delete(e); // @SQLDelete → soft delete

        assertThat(repository.findByCreatedBy(owner)).isEmpty();
    }
}
```

**Note:** `ownerId()` — use whatever accessor `AbstractIntegrationTest` already exposes for the seeded owner's id. Open `backend/src/test/java/io/mrkuhne/mezo/support/AbstractIntegrationTest.java` and use its real helper name; do not invent one.

- [ ] **Step 3: Run it to confirm it fails**

Run: `cd backend && ./mvnw clean test -Dtest=PushSubscriptionRepositoryIT`
Expected: compilation failure — `PushSubscriptionEntity` / `PushSubscriptionRepository` do not exist.

- [ ] **Step 4: Write the entity**

```java
package io.mrkuhne.mezo.feature.notification.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

/** One device's Web Push subscription (bd mezo-h4wp.6.1). Soft-deleted when the push service says GONE. */
@Getter
@Setter
@Entity
@Table(name = "push_subscription")
@SQLDelete(sql = "update push_subscription set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class PushSubscriptionEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull
    @Column(name = "endpoint", nullable = false)
    private String endpoint;

    @NotNull
    @Column(name = "p256dh", nullable = false, length = 120)
    private String p256dh;

    @NotNull
    @Column(name = "auth", nullable = false, length = 40)
    private String auth;

    @Column(name = "user_agent", length = 300)
    private String userAgent;

    @Column(name = "last_success_at")
    private Instant lastSuccessAt;
}
```

- [ ] **Step 5: Write the repository**

```java
package io.mrkuhne.mezo.feature.notification.repository;

import io.mrkuhne.mezo.feature.notification.entity.PushSubscriptionEntity;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** Owner-scoped subscription lookups. Not OwnedRepository — this entity has no `date` field. */
public interface PushSubscriptionRepository extends JpaRepository<PushSubscriptionEntity, UUID> {

    List<PushSubscriptionEntity> findByCreatedBy(UUID createdBy);

    Optional<PushSubscriptionEntity> findByCreatedByAndEndpoint(UUID createdBy, String endpoint);
}
```

- [ ] **Step 6: Add the table to the reset list**

In `ResetDatabase.resetExceptMasterData()`, add `push_subscription` to the first `TRUNCATE TABLE` list (put it right after `gamification_profile,` so it stays near the front of the owned-table group).

- [ ] **Step 7: Run the tests to confirm they pass**

Run: `cd backend && ./mvnw clean test -Dtest=PushSubscriptionRepositoryIT`
Expected: 2 tests PASS.

- [ ] **Step 8: Commit**

```bash
git add backend/src/main/resources/db/changelog backend/src/main/java/io/mrkuhne/mezo/feature/notification backend/src/test/java/io/mrkuhne/mezo/feature/notification backend/src/test/java/io/mrkuhne/mezo/support/ResetDatabase.java
git commit --no-verify -m "feat(notification): push_subscription table + entity + repository (mezo-h4wp.6.1)"
```

---

### Task 3: `WebPushProperties` + `VapidSigner`

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/techcore/webpush/WebPushProperties.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/techcore/webpush/VapidSigner.java`
- Modify: `backend/src/main/resources/application.yml`
- Test: `backend/src/test/java/io/mrkuhne/mezo/techcore/webpush/VapidSignerTest.java`

**Interfaces:**
- Consumes: nothing.
- Produces: `WebPushProperties(String subject, String publicKey, String privateKey, int defaultTtlSeconds)`; `VapidSigner` with `String authorizationHeader(String pushOrigin, Instant now)` returning the full `vapid t=<jwt>, k=<publicKey>` header value, and `static byte[] derToJose(byte[] der)` (package-visible for the test).

- [ ] **Step 1: Write the properties record**

```java
package io.mrkuhne.mezo.techcore.webpush;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * Web Push (RFC 8030/8291/8292) tunables. The private key is a k8s SealedSecret in production and
 * an untracked local env var in development — never a committed literal.
 *
 * @param subject VAPID `sub` claim — a mailto: or https: contact for the push service operator
 * @param publicKey  VAPID public key, base64url, uncompressed P-256 point (65 bytes, 0x04-prefixed)
 * @param privateKey VAPID private key, base64url, 32-byte P-256 scalar
 */
@Validated
@ConfigurationProperties(prefix = "mezo.webpush")
public record WebPushProperties(
    @NotBlank String subject,
    @NotBlank String publicKey,
    @NotBlank String privateKey,
    @Min(0) @Max(2419200) int defaultTtlSeconds) {}
```

- [ ] **Step 2: Add the config block**

In `application.yml`, under the `mezo:` root (alongside `mezo.ritual`), add:

```yaml
  # Web Push (RFC 8030/8291/8292) — bd mezo-h4wp.6.1. The private key NEVER has a real default:
  # production supplies it from the mezo-app SealedSecret, local dev from an untracked .env.
  # The dummy default keeps the context bootable with the notification feature switched off.
  webpush:
    subject: mailto:daniel.kuhne@intuitech.studio
    public-key: ${VAPID_PUBLIC:dummy-vapid-public}
    private-key: ${VAPID_PRIVATE:dummy-vapid-private}
    default-ttl-seconds: 3600
```

Register the record where the project registers its other property records (`@EnableConfigurationProperties` / `@ConfigurationPropertiesScan` — check how `RitualProperties` is picked up and mirror it exactly).

- [ ] **Step 3: Write the failing test**

Create `VapidSignerTest.java`. It generates its own P-256 keypair, so it needs no external vector:

```java
package io.mrkuhne.mezo.techcore.webpush;

import static org.assertj.core.api.Assertions.assertThat;

import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.Signature;
import java.security.interfaces.ECPrivateKey;
import java.security.interfaces.ECPublicKey;
import java.security.spec.ECGenParameterSpec;
import java.time.Instant;
import java.util.Base64;
import org.junit.jupiter.api.Test;

class VapidSignerTest {

    private static final Base64.Decoder B64URL = Base64.getUrlDecoder();

    @Test
    void testAuthorizationHeader_shouldProduceVerifiableEs256Jwt_whenSignedWithTheConfiguredKey() throws Exception {
        KeyPairGenerator g = KeyPairGenerator.getInstance("EC");
        g.initialize(new ECGenParameterSpec("secp256r1"));
        KeyPair kp = g.generateKeyPair();

        String pub = Base64.getUrlEncoder().withoutPadding()
            .encodeToString(VapidSigner.encodePublicKey((ECPublicKey) kp.getPublic()));
        String priv = Base64.getUrlEncoder().withoutPadding()
            .encodeToString(VapidSigner.encodePrivateKey((ECPrivateKey) kp.getPrivate()));

        VapidSigner signer = new VapidSigner(
            new WebPushProperties("mailto:a@b.c", pub, priv, 3600));

        String header = signer.authorizationHeader("https://web.push.apple.com", Instant.parse("2026-07-29T06:00:00Z"));

        assertThat(header).startsWith("vapid t=").contains(", k=" + pub);
        String jwt = header.substring("vapid t=".length(), header.indexOf(", k="));
        String[] parts = jwt.split("\\.");
        assertThat(parts).hasSize(3);

        // The JOSE signature must be exactly 64 raw bytes (r‖s), NOT DER.
        byte[] sig = B64URL.decode(parts[2]);
        assertThat(sig).hasSize(64);

        // And it must verify against the public key once converted back to DER.
        Signature v = Signature.getInstance("SHA256withECDSA");
        v.initVerify(kp.getPublic());
        v.update((parts[0] + "." + parts[1]).getBytes("UTF-8"));
        assertThat(v.verify(VapidSigner.joseToDer(sig))).isTrue();

        String payload = new String(B64URL.decode(parts[1]), "UTF-8");
        assertThat(payload).contains("\"aud\":\"https://web.push.apple.com\"")
            .contains("\"sub\":\"mailto:a@b.c\"")
            .contains("\"exp\":");
    }
}
```

- [ ] **Step 4: Run it to confirm it fails**

Run: `cd backend && ./mvnw clean test -Dtest=VapidSignerTest`
Expected: compilation failure — `VapidSigner` does not exist.

- [ ] **Step 5: Implement `VapidSigner`**

Requirements the test pins, plus what the protocol needs:
- JWT header `{"typ":"JWT","alg":"ES256"}`, base64url-no-padding.
- Claims `{"aud":"<pushOrigin>","exp":<now+12h epoch seconds>,"sub":"<subject>"}`. `exp` must be ≤ 24h ahead (RFC 8292); use 12h.
- Sign `header + "." + claims` with `SHA256withECDSA`, then **convert the DER signature to JOSE `r‖s`** (two 32-byte big-endian integers, left-zero-padded, stripping DER's sign bytes). This is the single most common Web Push bug — a DER signature makes every push 401.
- Header value: `"vapid t=" + jwt + ", k=" + publicKey`.
- Expose `static byte[] encodePublicKey(ECPublicKey)` → 65-byte uncompressed point (`0x04 ‖ X32 ‖ Y32`), `static byte[] encodePrivateKey(ECPrivateKey)` → 32-byte scalar (left-pad `getS().toByteArray()`, strip a leading 0x00), `static byte[] derToJose(byte[])`, `static byte[] joseToDer(byte[])`, and `static ECPrivateKey decodePrivateKey(String base64url)` / `static ECPublicKey decodePublicKey(byte[] uncompressed)` (Task 4 needs the latter two).
- Bean: `@Component @RequiredArgsConstructor` taking `WebPushProperties`.

Implement with `java.security.KeyFactory.getInstance("EC")`, `ECPrivateKeySpec`/`ECPublicKeySpec` and the `secp256r1` parameters obtained via `AlgorithmParameters.getInstance("EC")` + `getParameterSpec(ECParameterSpec.class)`. No external crypto provider.

- [ ] **Step 6: Run the test to confirm it passes**

Run: `cd backend && ./mvnw clean test -Dtest=VapidSignerTest`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/techcore/webpush backend/src/test/java/io/mrkuhne/mezo/techcore/webpush backend/src/main/resources/application.yml
git commit --no-verify -m "feat(webpush): VAPID ES256 signer with DER->JOSE conversion (mezo-h4wp.6.1)"
```

---

### Task 4: `Aes128GcmEncryptor` — RFC 8291 payload encryption

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/techcore/webpush/Aes128GcmEncryptor.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/techcore/webpush/Aes128GcmEncryptorTest.java`

**Interfaces:**
- Consumes: `VapidSigner.decodePublicKey(byte[])` from Task 3.
- Produces two overloads:
  - **production path** — `byte[] encrypt(String p256dhBase64Url, String authBase64Url, byte[] plaintext)`: generates a fresh 16-byte salt and a fresh ephemeral P-256 keypair per call, `recordSize = 4096`.
  - **test seam** — `byte[] encrypt(byte[] uaPublicKey, byte[] authSecret, byte[] plaintext, byte[] salt, byte[] asPublicKey, byte[] asPrivateKey, int recordSize)`: every random input is injected. It takes the sender public key **explicitly** rather than deriving it from the private scalar — the RFC vector supplies both halves, and EC point multiplication is not available through plain JDK APIs. The production overload calls this one after generating its own keypair.

- [ ] **Step 1: Obtain the official test vector — do NOT write it from memory**

Fetch RFC 8291 §5 ("Push Message Encryption Example"):

```
https://www.rfc-editor.org/rfc/rfc8291#section-5
```

Transcribe verbatim into the test as constants: the plaintext (`"When I grow up, I want to be a watermelon"`), the user-agent public key, the auth secret, the sender (application server) private + public key, the salt, and the **expected encrypted body**. These base64url blobs must be copied from the RFC text — a value reconstructed from memory would make this test assert the wrong thing, which is worse than having no test.

- [ ] **Step 2: Write the failing vector test**

```java
package io.mrkuhne.mezo.techcore.webpush;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Base64;
import org.junit.jupiter.api.Test;

class Aes128GcmEncryptorTest {

    private static final Base64.Decoder D = Base64.getUrlDecoder();

    // === RFC 8291 §5 — transcribed from the RFC, not from memory (see plan Task 4 Step 1) ===
    private static final String PLAINTEXT = "When I grow up, I want to be a watermelon";
    private static final String UA_PUBLIC   = "<rfc8291 §5 receiver public key>";
    private static final String AUTH_SECRET = "<rfc8291 §5 auth secret>";
    private static final String AS_PUBLIC   = "<rfc8291 §5 sender public key>";
    private static final String AS_PRIVATE  = "<rfc8291 §5 sender private key>";
    private static final String SALT        = "<rfc8291 §5 salt>";
    private static final String EXPECTED_BODY = "<rfc8291 §5 encrypted body>";

    @Test
    void testEncrypt_shouldMatchRfc8291Vector_whenSaltAndEphemeralKeyArePinned() throws Exception {
        Aes128GcmEncryptor encryptor = new Aes128GcmEncryptor();

        byte[] body = encryptor.encrypt(
            D.decode(UA_PUBLIC),
            D.decode(AUTH_SECRET),
            PLAINTEXT.getBytes("UTF-8"),
            D.decode(SALT),
            D.decode(AS_PUBLIC),
            D.decode(AS_PRIVATE),
            4096);

        assertThat(Base64.getUrlEncoder().withoutPadding().encodeToString(body))
            .isEqualTo(EXPECTED_BODY);
    }

    @Test
    void testEncrypt_shouldProduceDistinctBodies_whenCalledTwiceWithRandomSalt() throws Exception {
        Aes128GcmEncryptor encryptor = new Aes128GcmEncryptor();
        byte[] a = encryptor.encrypt(UA_PUBLIC, AUTH_SECRET, PLAINTEXT.getBytes("UTF-8"));
        byte[] b = encryptor.encrypt(UA_PUBLIC, AUTH_SECRET, PLAINTEXT.getBytes("UTF-8"));
        assertThat(a).isNotEqualTo(b); // fresh salt + ephemeral key per call
        assertThat(a.length).isGreaterThan(PLAINTEXT.length() + 86); // header + GCM tag overhead
    }
}
```

Both sender key halves come straight from the vector — no point derivation anywhere in the codebase.

- [ ] **Step 3: Run it to confirm it fails**

Run: `cd backend && ./mvnw clean test -Dtest=Aes128GcmEncryptorTest`
Expected: compilation failure — `Aes128GcmEncryptor` does not exist.

- [ ] **Step 4: Implement the encryptor**

The exact RFC 8291 §3.4 derivation — every string below is byte-for-byte significant:

1. `ecdhSecret = ECDH(asPrivate, uaPublic)` — `KeyAgreement.getInstance("ECDH")`.
2. `prkKey = HKDF(salt = authSecret, ikm = ecdhSecret, info = "WebPush: info" ‖ 0x00 ‖ uaPublic ‖ asPublic, len = 32)`
3. `cek = HKDF(salt = salt, ikm = prkKey, info = "Content-Encoding: aes128gcm" ‖ 0x00, len = 16)`
4. `nonce = HKDF(salt = salt, ikm = prkKey, info = "Content-Encoding: nonce" ‖ 0x00, len = 12)`
5. Pad the plaintext with the record delimiter `0x02` (single record, so the *last*-record delimiter).
6. `ciphertext = AES/GCM/NoPadding(cek, nonce, padded)` — 128-bit tag, `GCMParameterSpec(128, nonce)`.
7. Body = `salt (16)` ‖ `recordSize (4, big-endian)` ‖ `idlen (1) = 65` ‖ `asPublic (65)` ‖ `ciphertext` (RFC 8188 header).

HKDF is not in Java 21's public API — implement it over `Mac.getInstance("HmacSHA256")`:

```java
private static byte[] hkdf(byte[] salt, byte[] ikm, byte[] info, int length) throws GeneralSecurityException {
    Mac mac = Mac.getInstance("HmacSHA256");
    mac.init(new SecretKeySpec(salt.length == 0 ? new byte[32] : salt, "HmacSHA256"));
    byte[] prk = mac.doFinal(ikm);                       // extract
    mac.init(new SecretKeySpec(prk, "HmacSHA256"));      // expand (length <= 32 → one block)
    mac.update(info);
    mac.update((byte) 1);
    byte[] okm = mac.doFinal();
    return Arrays.copyOf(okm, length);
}
```

Bean: `@Component` (stateless). Use one `SecureRandom` instance field for salt + ephemeral key generation.

- [ ] **Step 5: Run the tests to confirm they pass**

Run: `cd backend && ./mvnw clean test -Dtest=Aes128GcmEncryptorTest`
Expected: both PASS. If the vector test fails, the bug is in step 2's `info` string or in the byte order of the header — do **not** "fix" it by relaxing the assertion.

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/techcore/webpush backend/src/test/java/io/mrkuhne/mezo/techcore/webpush
git commit --no-verify -m "feat(webpush): RFC 8291 aes128gcm payload encryption, vector-tested (mezo-h4wp.6.1)"
```

---

### Task 5: `WebPushClient`

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/techcore/webpush/WebPushResult.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/techcore/webpush/WebPushSubscriptionKeys.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/techcore/webpush/WebPushClient.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/techcore/webpush/WebPushClientIT.java`

**Interfaces:**
- Consumes: `VapidSigner.authorizationHeader(String, Instant)`, `Aes128GcmEncryptor.encrypt(String, String, byte[])`.
- Produces: `WebPushResult send(WebPushSubscriptionKeys keys, String payloadJson)`; `enum WebPushResult { SENT, GONE, TOO_LARGE, THROTTLED, FAILED }`; `record WebPushSubscriptionKeys(String endpoint, String p256dh, String auth)`.

- [ ] **Step 1: Write the failing WireMock IT**

```java
package io.mrkuhne.mezo.techcore.webpush;

import static com.github.tomakehurst.wiremock.client.WireMock.aResponse;
import static com.github.tomakehurst.wiremock.client.WireMock.post;
import static com.github.tomakehurst.wiremock.client.WireMock.urlPathMatching;
import static org.assertj.core.api.Assertions.assertThat;

import com.github.tomakehurst.wiremock.WireMockServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class WebPushClientIT {

    private WireMockServer server;
    private WebPushClient client;

    @BeforeEach
    void setUp() {
        server = new WireMockServer(0);
        server.start();
        client = TestWebPush.clientWithGeneratedKeys(); // see Step 2
    }

    @AfterEach
    void tearDown() { server.stop(); }

    private WebPushSubscriptionKeys keys() {
        return new WebPushSubscriptionKeys(
            server.baseUrl() + "/push/abc", TestWebPush.UA_PUBLIC, TestWebPush.AUTH);
    }

    @Test
    void testSend_shouldReturnSent_when201() {
        server.stubFor(post(urlPathMatching("/push/.*")).willReturn(aResponse().withStatus(201)));
        assertThat(client.send(keys(), "{\"title\":\"t\"}")).isEqualTo(WebPushResult.SENT);
    }

    @Test
    void testSend_shouldReturnGone_when410() {
        server.stubFor(post(urlPathMatching("/push/.*")).willReturn(aResponse().withStatus(410)));
        assertThat(client.send(keys(), "{\"title\":\"t\"}")).isEqualTo(WebPushResult.GONE);
    }

    @Test
    void testSend_shouldReturnGone_when404() {
        server.stubFor(post(urlPathMatching("/push/.*")).willReturn(aResponse().withStatus(404)));
        assertThat(client.send(keys(), "{\"title\":\"t\"}")).isEqualTo(WebPushResult.GONE);
    }

    @Test
    void testSend_shouldSendVapidAndAes128gcmHeaders_when201() {
        server.stubFor(post(urlPathMatching("/push/.*")).willReturn(aResponse().withStatus(201)));
        client.send(keys(), "{\"title\":\"t\"}");

        var sent = server.getAllServeEvents().getFirst().getRequest();
        assertThat(sent.getHeader("Authorization")).startsWith("vapid t=");
        assertThat(sent.getHeader("Content-Encoding")).isEqualTo("aes128gcm");
        assertThat(sent.getHeader("TTL")).isEqualTo("3600");
        assertThat(sent.getBody()).isNotEmpty();
    }

    @Test
    void testSend_shouldReturnFailed_when500() {
        server.stubFor(post(urlPathMatching("/push/.*")).willReturn(aResponse().withStatus(500)));
        assertThat(client.send(keys(), "{\"title\":\"t\"}")).isEqualTo(WebPushResult.FAILED);
    }
}
```

- [ ] **Step 2: Write the test helper**

Create `backend/src/test/java/io/mrkuhne/mezo/techcore/webpush/TestWebPush.java`: generates a P-256 VAPID keypair and a P-256 "user agent" keypair plus a 16-byte auth secret, exposes them as base64url `UA_PUBLIC` / `AUTH` constants, and builds a `WebPushClient` over a real `VapidSigner` + `Aes128GcmEncryptor` + `RestClient.builder().build()`. Keep it plain (no Spring context) — these are unit-level.

- [ ] **Step 3: Run to confirm it fails**

Run: `cd backend && ./mvnw clean test -Dtest=WebPushClientIT`
Expected: compilation failure — `WebPushClient` does not exist.

- [ ] **Step 4: Implement the result enum, keys record, and client**

```java
package io.mrkuhne.mezo.techcore.webpush;

/** Outcome of one push POST. GONE means the caller must soft-delete that subscription. */
public enum WebPushResult { SENT, GONE, TOO_LARGE, THROTTLED, FAILED }
```

```java
package io.mrkuhne.mezo.techcore.webpush;

/** Transport-agnostic subscription input — keeps techcore free of any feature entity. */
public record WebPushSubscriptionKeys(String endpoint, String p256dh, String auth) {}
```

`WebPushClient`: `@Component @RequiredArgsConstructor` over `VapidSigner`, `Aes128GcmEncryptor`, `WebPushProperties`, and a `RestClient` (build one in the constructor from `RestClient.Builder`, following how other clients in the project obtain theirs — check `feature/pantry`'s `OffClient` and mirror it).

`send(...)`:
1. Derive the push origin from `keys.endpoint()` with `URI.create(endpoint)` → `scheme://host[:port]`.
2. `body = encryptor.encrypt(keys.p256dh(), keys.auth(), payloadJson.getBytes(UTF_8))`.
3. POST to `endpoint` with headers `Authorization: <vapidSigner.authorizationHeader(origin, Instant.now())>`, `Content-Encoding: aes128gcm`, `Content-Type: application/octet-stream`, `TTL: <defaultTtlSeconds>`, `Urgency: normal`.
4. Map the status: `201`/`200`/`202` → `SENT`; `404`/`410` → `GONE`; `413` → `TOO_LARGE`; `429` → `THROTTLED`; anything else or an exception → `FAILED` (log at `warn` with the endpoint's first 40 chars only — never the full endpoint, it is a capability URL).

Use `.retrieve().toBodilessEntity()` with `.onStatus(status -> true, (req, res) -> {})` so non-2xx does not throw and can be mapped. **Never let a push failure propagate** — this is called in a loop over devices.

- [ ] **Step 5: Run the tests to confirm they pass**

Run: `cd backend && ./mvnw clean test -Dtest=WebPushClientIT`
Expected: 5 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/techcore/webpush backend/src/test/java/io/mrkuhne/mezo/techcore/webpush
git commit --no-verify -m "feat(webpush): RestClient push transport with GONE/throttle mapping (mezo-h4wp.6.1)"
```

---

### Task 6: `feature/notification` service, sender, controller, switches

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/notification/service/PushSubscriptionService.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/notification/service/PushSender.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/notification/controller/NotificationController.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/techcore/configuration/FeaturesConfiguration.java`
- Modify: `backend/src/main/resources/application.yml`
- Create: `backend/src/test/java/io/mrkuhne/mezo/support/populator/NotificationPopulator.java` (mirror the package/idiom of the existing populators — check `DatabasePopulator`'s fields for where they live)
- Modify: `backend/src/test/java/io/mrkuhne/mezo/support/DatabasePopulator.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/notification/NotificationApiIT.java`

**Interfaces:**
- Consumes: `PushSubscriptionRepository`, `WebPushClient.send(...)`, `WebPushResult`, `CurrentUserId.get()`.
- Produces: `PushSubscriptionService.register(UUID owner, String endpoint, String p256dh, String auth, String userAgent)`, `.unregister(UUID owner, String endpoint)`, `.liveFor(UUID owner)`; `PushSender.sendToAllDevices(UUID owner, String title, String body, String url)` returning `record PushFanOut(int attempted, int sent)`.

- [ ] **Step 1: Add the switch constants**

In `FeaturesConfiguration`, append:

```java
    /** Push notifications (bd mezo-h4wp.6) — off ⇒ no notification beans, /api/notification/* 404s. */
    public static final String NOTIFICATION_SWITCH = "mezo.feature.notification.enabled";

    /** Per-minute push dispatch job (N2; schedule: mezo.notification.dispatch-cron) — techcore cron zone. */
    public static final String NOTIFICATION_DISPATCH_JOB_SWITCH =
            "mezo.techcore.cron.notification-dispatch-job.enabled";
```

In `application.yml` add `mezo.feature.notification.enabled: true` (next to `ritual`) and `mezo.techcore.cron.notification-dispatch-job.enabled: false` (N2 turns it on — N1 must not schedule anything).

- [ ] **Step 2: Write the failing API IT**

```java
package io.mrkuhne.mezo.feature.notification;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.PushSubscriptionRequest;
import io.mrkuhne.mezo.feature.notification.repository.PushSubscriptionRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;

class NotificationApiIT extends ApiIntegrationTest {

    @Autowired private PushSubscriptionRepository repository;

    private PushSubscriptionRequest request(String endpoint) {
        PushSubscriptionRequest r = new PushSubscriptionRequest();
        r.setEndpoint(endpoint);
        r.setP256dh("BOr1a2b3");
        r.setAuth("c3VwZXJzZWNyZXQ");
        r.setUserAgent("iPhone");
        return r;
    }

    @Test
    void testRegisterPushSubscription_shouldPersistOneRow_whenCalledTwiceWithTheSameEndpoint() {
        postForBody("/api/notification/subscription", request("https://p.example/a"),
                ownerAuthHeaders(), HttpStatus.NO_CONTENT, Void.class);
        postForBody("/api/notification/subscription", request("https://p.example/a"),
                ownerAuthHeaders(), HttpStatus.NO_CONTENT, Void.class);

        assertThat(repository.findAll()).hasSize(1);
    }

    @Test
    void testUnregisterPushSubscription_shouldSoftDeleteRow_whenEndpointMatches() {
        postForBody("/api/notification/subscription", request("https://p.example/b"),
                ownerAuthHeaders(), HttpStatus.NO_CONTENT, Void.class);

        deleteAndExpect("/api/notification/subscription?endpoint=https://p.example/b",
                ownerAuthHeaders(), HttpStatus.NO_CONTENT);

        assertThat(repository.findAll()).isEmpty(); // @SQLRestriction hides the soft-deleted row
    }

    @Test
    void testUnregisterPushSubscription_shouldSucceed_whenEndpointUnknown() {
        deleteAndExpect("/api/notification/subscription?endpoint=https://p.example/nope",
                ownerAuthHeaders(), HttpStatus.NO_CONTENT);
    }

    @Test
    void testRegisterPushSubscription_shouldReturn401_whenUnauthenticated() {
        postForBody("/api/notification/subscription", request("https://p.example/c"),
                new org.springframework.http.HttpHeaders(), HttpStatus.UNAUTHORIZED, String.class);
    }
}
```

- [ ] **Step 3: Run to confirm it fails**

Run: `cd backend && ./mvnw clean test -Dtest=NotificationApiIT`
Expected: 404s / compile failure — the controller does not exist.

- [ ] **Step 4: Implement `PushSubscriptionService`**

`@Service @RequiredArgsConstructor`. `register` is an **upsert**: `findByCreatedByAndEndpoint` → if present, refresh `p256dh`/`auth`/`userAgent` and save; else insert a new entity with `createdBy` from the argument. `unregister`: find → `repository.delete(entity)` (soft delete via `@SQLDelete`); absent → no-op, no exception. `liveFor`: `findByCreatedBy`. `markGone(UUID id)`: load + delete. `markSuccess(UUID id)`: set `lastSuccessAt = Instant.now()`. Annotate the mutating methods `@Transactional`. Gate the bean with `@ConditionalOnProperty(name = FeaturesConfiguration.NOTIFICATION_SWITCH, havingValue = "true")`.

- [ ] **Step 5: Implement `PushSender`**

`@Service @RequiredArgsConstructor @Slf4j`, same switch gate. One public method:

```java
public PushFanOut sendToAllDevices(UUID owner, String title, String body, String url) {
    List<PushSubscriptionEntity> devices = subscriptionService.liveFor(owner);
    int sent = 0;
    for (PushSubscriptionEntity d : devices) {
        WebPushResult result = webPushClient.send(
            new WebPushSubscriptionKeys(d.getEndpoint(), d.getP256dh(), d.getAuth()),
            payload(title, body, url));
        switch (result) {
            case SENT -> { sent++; subscriptionService.markSuccess(d.getId()); }
            case GONE -> subscriptionService.markGone(d.getId());
            default -> log.warn("Push to {} returned {}", shortEndpoint(d.getEndpoint()), result);
        }
    }
    return new PushFanOut(devices.size(), sent);
}
```

`payload(...)` builds `{"title":…,"body":…,"url":…}` with the injected `ObjectMapper` (never string concatenation — the title/body carry Hungarian text and quotes). Truncate `body` to `mezo.notification.body-max-chars`; for N1 read it from a `NotificationProperties` record (`@Validated`, prefix `mezo.notification`, fields `int bodyMaxChars`) and add `mezo.notification.body-max-chars: 300` to `application.yml` — N2 extends the same record rather than inventing a second one.

`record PushFanOut(int attempted, int sent)` — nest it inside `PushSender`.

- [ ] **Step 6: Implement the controller**

```java
package io.mrkuhne.mezo.feature.notification.controller;

import io.mrkuhne.mezo.api.controller.NotificationApi;
import io.mrkuhne.mezo.api.dto.PushSubscriptionRequest;
import io.mrkuhne.mezo.api.dto.PushTestResponse;
import io.mrkuhne.mezo.feature.notification.service.PushSender;
import io.mrkuhne.mezo.feature.notification.service.PushSubscriptionService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.RestController;

/** /api/notification surface (bd mezo-h4wp.6.1) — thin delegation; gated on NOTIFICATION_SWITCH. */
@RestController
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.NOTIFICATION_SWITCH, havingValue = "true")
public class NotificationController implements NotificationApi {

    private final PushSubscriptionService subscriptionService;
    private final PushSender pushSender;
    private final CurrentUserId currentUserId;

    @Override
    public void registerPushSubscription(PushSubscriptionRequest request) {
        subscriptionService.register(currentUserId.get(), request.getEndpoint(),
                request.getP256dh(), request.getAuth(), request.getUserAgent());
    }

    @Override
    public void unregisterPushSubscription(String endpoint) {
        subscriptionService.unregister(currentUserId.get(), endpoint);
    }

    @Override
    public PushTestResponse sendTestPush() {
        PushSender.PushFanOut out = pushSender.sendToAllDevices(currentUserId.get(),
                "Mezo · teszt", "A push működik. Ezt a mezo küldte.", "/today");
        PushTestResponse response = new PushTestResponse();
        response.setAttempted(out.attempted());
        response.setSent(out.sent());
        return response;
    }
}
```

Match the generated interface exactly — if `NotificationApi` declares `ResponseEntity<Void>` returns, adapt the signatures to what was generated rather than changing the contract.

- [ ] **Step 7: Add the populator**

`NotificationPopulator` with `PushSubscriptionEntity subscription(UUID owner, String endpoint)` that persists a live row with fixed key material. Wire it into `DatabasePopulator` the same way the existing populators are exposed.

- [ ] **Step 8: Run the tests to confirm they pass**

Run: `cd backend && ./mvnw clean test -Dtest=NotificationApiIT`
Expected: 4 tests PASS.

- [ ] **Step 9: Run the full focused backend suite**

Run: `cd backend && ./mvnw clean test -Dtest='Notification*,WebPush*,VapidSigner*,Aes128Gcm*,PushSubscription*'`
Expected: all green. (The full suite is CI's job — see the ship flow at the end.)

- [ ] **Step 10: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/notification backend/src/main/java/io/mrkuhne/mezo/techcore backend/src/main/resources/application.yml backend/src/test/java/io/mrkuhne/mezo
git commit --no-verify -m "feat(notification): subscription API + push fan-out with GONE pruning (mezo-h4wp.6.1)"
```

---

### Task 7: Service-worker push handler

**Files:**
- Create: `frontend/public/push-sw.js`
- Modify: `frontend/vite.config.ts` (the `VitePWA({ workbox: … })` block)

**Interfaces:**
- Consumes: the payload shape `PushSender.payload` emits — `{title, body, url}`.
- Produces: nothing importable; a runtime behaviour the spike verifies.

- [ ] **Step 1: Write the handler**

Create `frontend/public/push-sw.js`:

```js
// Web Push handlers, imported into the vite-plugin-pwa (Workbox generateSW) service worker via
// workbox.importScripts. Kept as a separate plain file so the generated worker — precache manifest,
// autoUpdate, the woff2 globs — stays owned by the plugin (bd mezo-h4wp.6.1).
//
// Payload contract (backend PushSender.payload): { title, body, url }.
// iOS requires a notification to be shown for EVERY push (userVisibleOnly) — so there is no
// silent path here, and no early return before showNotification.
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = {}
  }
  const title = data.title || 'Mezo'
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: '/pwa-192x192.png',
      badge: '/pwa-64x64.png',
      // One notification per logical event: a re-sent duplicate replaces rather than stacks.
      tag: data.url || 'mezo',
      data: { url: data.url || '/today' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = (event.notification.data && event.notification.data.url) || '/today'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          if ('navigate' in client) client.navigate(target)
          return client.focus()
        }
      }
      return self.clients.openWindow(target)
    }),
  )
})
```

- [ ] **Step 2: Import it into the generated worker**

In `frontend/vite.config.ts`, extend the existing `workbox` option (do not replace `globPatterns`):

```ts
      workbox: {
        // Extend the default precache globs (js/wasm/css/html) with ico/png/svg/woff2 so
        // the self-hosted brand fonts (public/fonts/*.woff2) are precached — the app
        // then renders Bricolage + Jakarta offline instead of falling back to system.
        globPatterns: ['**/*.{js,wasm,css,html,ico,png,svg,woff2}'],
        // Web Push handlers live in their own plain file so the generateSW strategy stays
        // intact (switching to injectManifest would mean owning the whole worker for two
        // event listeners) — bd mezo-h4wp.6.1.
        importScripts: ['push-sw.js'],
      },
```

- [ ] **Step 3: Verify the built worker imports it**

Run:
```bash
cd frontend && pnpm build && grep -n "push-sw.js" dist/sw.js && ls dist/push-sw.js
```
Expected: `dist/sw.js` contains an `importScripts` referencing `push-sw.js`, and `dist/push-sw.js` exists (it is a `public/` passthrough).

- [ ] **Step 4: Commit**

```bash
git add frontend/public/push-sw.js frontend/vite.config.ts
git commit --no-verify -m "feat(pwa): push + notificationclick handlers on the generated worker (mezo-h4wp.6.1)"
```

---

### Task 8: Frontend data layer

**Files:**
- Create: `frontend/src/data/notification/notificationApi.ts`
- Create: `frontend/src/data/notification/notificationMock.ts`
- Create: `frontend/src/data/notification/notificationHooks.ts`
- Test: `frontend/src/data/notification/notificationHooks.test.tsx`
- Modify: `frontend/src/data/hooks.ts`, `frontend/src/data/types.ts`, `frontend/.env.example`

**Interfaces:**
- Consumes: `apiFetch` from `@/data/_client/api`, `isMockMode` from `@/data/_client/mode`, wire types from `@/data/_client/api.gen`.
- Produces: `usePushSubscription(): PushSubscriptionState` where

```ts
export interface PushSubscriptionState {
  supported: boolean       // 'serviceWorker' in navigator && 'PushManager' in window
  standalone: boolean      // display-mode: standalone (iOS gate)
  permission: NotificationPermission
  enabled: boolean         // a live PushSubscription exists on this device
  busy: boolean
  subscribe: () => Promise<boolean>
  unsubscribe: () => Promise<void>
  sendTest: () => Promise<{ attempted: number; sent: number }>
}
```

- [ ] **Step 1: Add the env var**

Append to `frontend/.env.example`:

```
# VAPID public key (safe to expose — the private half lives only in the mezo-app SealedSecret).
# Generate a pair with: openssl ecparam -genkey -name prime256v1 -noout -out vapid.pem
VITE_VAPID_PUBLIC=
```

- [ ] **Step 2: Add the domain type**

In `frontend/src/data/types.ts`, add the `PushSubscriptionState` interface above (types live here, not in the feature).

- [ ] **Step 3: Write the API client**

```ts
import { apiFetch } from '@/data/_client/api'
import type { components } from '@/data/_client/api.gen'

type SubscriptionRequest = components['schemas']['PushSubscriptionRequest']
type TestResponse = components['schemas']['PushTestResponse']

export const notificationApi = {
  register: (body: SubscriptionRequest) =>
    apiFetch<void>('/api/notification/subscription', {
      method: 'POST',
      body: JSON.stringify(body satisfies SubscriptionRequest),
    }),
  unregister: (endpoint: string) =>
    apiFetch<void>(`/api/notification/subscription?endpoint=${encodeURIComponent(endpoint)}`, {
      method: 'DELETE',
    }),
  test: () => apiFetch<TestResponse>('/api/notification/test', { method: 'POST' }),
}
```

- [ ] **Step 4: Write the mock**

`notificationMock.ts` exports a module-level mutable `mockPushState = { enabled: false }` plus `resetMockPushState()`. Mock mode must **never** touch `Notification`, `navigator.serviceWorker` or `PushManager` — jsdom has none of them, and both test modes have to pass.

- [ ] **Step 5: Write the failing hook test**

```tsx
import { renderHook, act } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { usePushSubscription } from '@/data/notification/notificationHooks'
import { isMockMode } from '@/data/_client/mode'

describe('usePushSubscription', () => {
  it('reports unsupported in jsdom without crashing', () => {
    const { result } = renderHook(() => usePushSubscription())
    // jsdom has no PushManager in either mode → the hook must degrade, never throw.
    expect(result.current.supported).toBe(false)
    expect(result.current.enabled).toBe(false)
    expect(typeof result.current.subscribe).toBe('function')
  })

  it('subscribe() resolves false when unsupported', async () => {
    const { result } = renderHook(() => usePushSubscription())
    let outcome: boolean | undefined
    await act(async () => { outcome = await result.current.subscribe() })
    expect(outcome).toBe(false)
  })

  it('mock mode never reports a live subscription', () => {
    if (!isMockMode()) return
    const { result } = renderHook(() => usePushSubscription())
    expect(result.current.enabled).toBe(false)
  })
})
```

- [ ] **Step 6: Run to confirm it fails**

Run: `cd frontend && pnpm test notificationHooks`
Expected: FAIL — module `@/data/notification/notificationHooks` not found.

- [ ] **Step 7: Implement the hook**

Port the shape of `weekly-planner`'s `usePush` (`/Users/daniel.kuhne/MrKuhne/weekly-planner/src/hooks/usePush.js`) — it is the proven flow — with mezo's conventions:

- `supported` = `'serviceWorker' in navigator && 'PushManager' in window` (guard `typeof window !== 'undefined'`).
- `standalone` = `window.matchMedia?.('(display-mode: standalone)').matches || (window.navigator as { standalone?: boolean }).standalone === true`.
- On mount, when supported: `navigator.serviceWorker.ready` → `getSubscription()` → `setEnabled(!!sub)`.
- `subscribe()`: `Notification.requestPermission()` → if not `granted`, return `false`; else `reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8Array(import.meta.env.VITE_VAPID_PUBLIC) })` → `sub.toJSON()` → `notificationApi.register({ endpoint, p256dh: keys.p256dh, auth: keys.auth, userAgent: navigator.userAgent })` → `setEnabled(true)`.
- `unsubscribe()`: `getSubscription()` → `notificationApi.unregister(sub.endpoint)` → `sub.unsubscribe()` → `setEnabled(false)`.
- Mock mode short-circuits `subscribe`/`unsubscribe`/`sendTest` against `mockPushState` and never calls the API.
- Include the `urlB64ToUint8Array` helper locally (`atob` + padding fix), as the weekly-planner hook does.

- [ ] **Step 8: Re-export through the barrel**

In `frontend/src/data/hooks.ts`, add `export { usePushSubscription } from '@/data/notification/notificationHooks'` — features import from `@/data/hooks` only.

- [ ] **Step 9: Run both modes**

Run:
```bash
cd frontend && pnpm test notificationHooks && VITE_USE_MOCK=true pnpm test notificationHooks
```
Expected: green in both.

- [ ] **Step 10: Commit**

```bash
git add frontend/src/data/notification frontend/src/data/hooks.ts frontend/src/data/types.ts frontend/.env.example
git commit --no-verify -m "feat(notification): dual-mode push subscription hook + REST client (mezo-h4wp.6.1)"
```

---

### Task 9: Settings page, route, tab, install gate

**Files:**
- Create: `frontend/src/features/me/components/PushInstallGate.tsx`
- Create: `frontend/src/features/me/pages/NotificationsPage.tsx`
- Test: `frontend/src/features/me/pages/NotificationsPage.test.tsx`
- Modify: `frontend/src/app/router.tsx`, `frontend/src/features/me/pages/tabs.ts`

**Interfaces:**
- Consumes: `usePushSubscription` from `@/data/hooks`.
- Produces: the `/me/ertesitesek` route; N2 extends this page with the category list, N3 with the preview header.

- [ ] **Step 1: Write the failing page test**

```tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import { NotificationsPage } from '@/features/me/pages/NotificationsPage'

const wrap = (ui: React.ReactNode) => (
  <QueryClientProvider client={new QueryClient()}>
    <MemoryRouter>{ui}</MemoryRouter>
  </QueryClientProvider>
)

describe('NotificationsPage', () => {
  it('shows the iOS install instruction instead of a toggle when not standalone', () => {
    render(wrap(<NotificationsPage />))
    // jsdom is never standalone → the gate replaces the master toggle (a toggle that
    // cannot work must not be offered).
    expect(screen.getByText(/kezdőképernyő/i)).toBeInTheDocument()
    expect(screen.queryByRole('switch')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run to confirm it fails**

Run: `cd frontend && pnpm test NotificationsPage`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `PushInstallGate`**

A presentational component — no `@/data/*` import, so it may live in `features/me/components/`. Styling follows the mockup's `.gate` block (amber wash, `--amber-deep` text):

```tsx
/** iOS grants Web Push to home-screen-installed PWAs only — so when the app is not standalone
 *  this REPLACES the master toggle rather than sitting next to it (a toggle that cannot work
 *  must not be offered). bd mezo-h4wp.6.1 */
export function PushInstallGate() {
  return (
    <div className="card" style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
      <span aria-hidden="true" style={{ fontSize: 15 }}>📲</span>
      <p style={{ font: '400 12.5px/1.55 var(--ff-body)', color: 'var(--amber-deep)' }}>
        <strong>iOS:</strong> a push csak akkor jön meg, ha a mezo a{' '}
        <strong>kezdőképernyőn</strong> van (Megosztás → Főképernyőhöz). Safari-fülön az Apple
        nem engedi.
      </p>
    </div>
  )
}
```

Before writing it, check what `@/shared/ui` already exposes (`Card`, `Stack`, …) and prefer those primitives over the inline styles above — the inline version is the fallback if no primitive fits. Inline `style` on a token value is acceptable here only because there is no existing utility class for an amber-wash callout; if one exists, use it.

- [ ] **Step 4: Implement `NotificationsPage`**

```tsx
import { useState } from 'react'
import { usePushSubscription } from '@/data/hooks'
import { PushInstallGate } from '@/features/me/components/PushInstallGate'

/** Me → Értesítések (bd mezo-h4wp.6.1). N1 owns the master opt-in only; N2 adds the category
 *  list, N3 the volume-preview header. */
export function NotificationsPage() {
  const push = usePushSubscription()
  const [testResult, setTestResult] = useState<string | null>(null)

  if (!push.supported || !push.standalone) {
    return (
      <div>
        <PushInstallGate />
      </div>
    )
  }

  const statusLine =
    push.permission === 'denied'
      ? 'Az eszközön letiltva — az iOS beállításokban engedélyezhető újra.'
      : push.enabled
        ? 'iPhone · engedélyezve'
        : 'Nincs engedélyezve'

  const onToggle = async () => {
    if (push.enabled) await push.unsubscribe()
    else await push.subscribe()
  }

  const onTest = async () => {
    const { attempted, sent } = await push.sendTest()
    setTestResult(
      sent > 0
        ? `Elküldve ${sent}/${attempted} eszközre.`
        : `Egyik eszköz sem fogadta el (${attempted} próbálkozás).`,
    )
  }

  return (
    <div>
      <div className="card">
        <div>
          <b>Push értesítések</b>
          <span>{statusLine}</span>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={push.enabled}
          aria-label="Push értesítések"
          disabled={push.busy || push.permission === 'denied'}
          onClick={onToggle}
        />
      </div>

      {push.enabled && (
        <div className="card">
          <button type="button" onClick={onTest} disabled={push.busy}>
            Teszt értesítés küldése
          </button>
          {testResult && <p>{testResult}</p>}
        </div>
      )}
    </div>
  )
}
```

The `role="switch"` + `aria-checked` is what the Step 1 test asserts on (`queryByRole('switch')`), and it is also the accessible form of the mockup's `.switch` element. Replace the raw `<button className="card">` scaffolding with the project's actual primitives and token classes where they exist — the structure and the ARIA contract are what matter, not these class names.

- [ ] **Step 5: Register route + tab**

`router.tsx`: import `NotificationsPage` and add `{ path: 'ertesitesek', element: <NotificationsPage /> }` to the `me` children array (after `knowledge`).
`tabs.ts`: append `{ id: 'notifications', to: '/me/ertesitesek', label: 'Értesítés' }` to `ME_TABS`.

- [ ] **Step 6: Run the gate**

Run:
```bash
cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test
```
Expected: all green in both modes. If `test-visual` goldens exist for the Me sub-nav, a new tab shifts them — regenerate per the ship-flow note at the end of this plan.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/features/me frontend/src/app/router.tsx
git commit --no-verify -m "feat(notification): Me -> Ertesitesek opt-in page + iOS install gate (mezo-h4wp.6.1)"
```

---

### Task 10: Documentation

**Files:**
- Create: `docs/features/_platform-notifications.md`
- Create: `docs/decisions/0014-own-webpush-implementation.md`
- Modify: `docs/infrastructure/deployment-k3s-argocd.md`

**Interfaces:** none (docs).

- [ ] **Step 1: Write the living feature doc**

**Deliberately NOT in this slice:** `docs/features/proactive.md` (the "H2 deferred" epic-status rows) and `docs/milestones/roadmap.md` (the Phase-4 "Web Push infra H2 DEFERRED" line) are updated in **N3**, when all 11 categories are live and H2 is genuinely done. Flipping them at N1 would claim a capability that does not exist yet.

`docs/features/_platform-notifications.md` following the 10-section template in `docs/features/README.md`, with frontmatter `title / type: feature-platform / status / updated / tags / key_files / related: [proactive, today, ritual, me, _platform-api-backend]`. `key_files` must list `backend/.../techcore/webpush`, `backend/.../feature/notification`, `api/feature/notification/notification.yml`, `frontend/public/push-sw.js`, `frontend/src/data/notification`, `frontend/src/features/me/pages/NotificationsPage.tsx`, and the migration script. Content: the §3 architecture diagram, the delivery layer, the **§6 copy rules verbatim** (they are the guardrail a later slice must not regress), the iOS constraints, and an explicit "N2/N3 not yet shipped" status block.

- [ ] **Step 2: Write the ADR**

`docs/decisions/0014-own-webpush-implementation.md` using the template in `docs/README.md`. Context: Web Push needs VAPID ES256 + RFC 8291 `aes128gcm`. Decision: own `techcore/webpush`, zero new dependencies. Consequences: ~250 lines to maintain, correctness pinned by the RFC 8291 vector test; rejected `nl.martijndwars:web-push` (unmaintained since ~2022, no Spring Boot 4 / Java 21 validation, drags BouncyCastle + jose4j).

- [ ] **Step 3: Update the infrastructure doc**

Add to `docs/infrastructure/deployment-k3s-argocd.md`: the `VAPID_PUBLIC`/`VAPID_PRIVATE` pair joins the **existing `mezo-app` SealedSecret** + the backend Deployment env (the `GEMINI_API_KEY` precedent); the backend pod needs **egress to `*.push.apple.com` and `fcm.googleapis.com`** (no NetworkPolicy today — record it so a future one does not silently kill push); and a warning that **`TZ=Europe/Budapest` (`k8s/backend/deployment.yaml:34`) is now load-bearing for notification timing**, not only date bucketing.

- [ ] **Step 4: Run the doc lint**

Run: `node scripts/lint-docs.mjs`
Expected: no errors; no stale-flag on the new docs.

- [ ] **Step 5: Commit**

```bash
git add docs/features/_platform-notifications.md docs/decisions/0014-own-webpush-implementation.md docs/infrastructure/deployment-k3s-argocd.md
git commit --no-verify -m "docs(notification): platform feature doc + ADR 0014 + infra notes (mezo-h4wp.6.1)"
```

---

### Task 11: Ship the branch

**Files:** none (process).

- [ ] **Step 1: Confirm the diff carries no stray beads file**

Run:
```bash
git log --oneline origin/main..HEAD
git diff --name-only origin/main..HEAD | grep -c '^issues.jsonl' || echo "clean"
```
Expected: only intended files; `clean`.

- [ ] **Step 2: Push and open the self-PR**

Run:
```bash
git push -u origin feat/push-notifications-n1
gh pr create --fill --title "Push N1: Web Push delivery spine — techcore/webpush + subscription + SW handler (mezo-h4wp.6.1)"
```

- [ ] **Step 3: Wait for CI green**

Run: `gh pr checks --watch`
Expected: all checks pass. The PR is the authoritative full-suite gate — the 16 GB dev machine cannot run the backend IT suite locally.

**If `test-visual` is red:** the new Me tab moved a golden. Regenerate **linux** with `gh workflow run update-visual-baselines.yml -r feat/push-notifications-n1`, approve the resulting `action_required` run (`gh api --method POST repos/mrkuhne/mezo/actions/runs/<id>/approve`), then `git pull`. Regenerate **darwin** locally with `pnpm test:visual:update -g "<name>"`. Commit only the goldens this change legitimately moved.

**If the PR shows CONFLICTING:** no CI runs at all. Merge `origin/main` into the branch (not rebase), resolving `.beads/issues.jsonl` via `bd dolt pull && bd export -o .beads/issues.jsonl`, then push.

- [ ] **Step 4: Merge with `--no-ff` and clean up**

Run:
```bash
git checkout main && git pull --rebase
git merge --no-ff feat/push-notifications-n1
git push origin main
git branch -d feat/push-notifications-n1 && git push origin --delete feat/push-notifications-n1
```

- [ ] **Step 5: Close the bd issue**

Run: `bd close mezo-h4wp.6.1 && bd dolt push && git push`

---

### Task 12: Real-device spike — REQUIRES DANIEL AND A DEPLOY

**Files:** none (manual verification). **This task cannot be completed by an agent** — it needs a VAPID keypair in the cluster and a physical iPhone.

**Why it exists:** the RFC vector proves the crypto; it does not prove the platform. VAPID + `aes128gcm` + iOS-standalone delivery is exactly where this class of feature fails, and every preceding task is verifiable without it.

- [ ] **Step 1: Generate the VAPID keypair** (Daniel, once)

```bash
openssl ecparam -genkey -name prime256v1 -noout -out vapid-private.pem
# public key, base64url, uncompressed point:
openssl ec -in vapid-private.pem -pubout -outform DER | tail -c 65 | base64 | tr '+/' '-_' | tr -d '=\n'
# private scalar, base64url:
openssl ec -in vapid-private.pem -outform DER | tail -c +8 | head -c 32 | base64 | tr '+/' '-_' | tr -d '=\n'
```
Never commit `vapid-private.pem`. Delete it after sealing.

- [ ] **Step 2: Seal the private key into `mezo-app`** and add `VAPID_PUBLIC`/`VAPID_PRIVATE` to the backend Deployment env (the `GEMINI_API_KEY` precedent). Put the public half in the frontend build's `VITE_VAPID_PUBLIC`.
- [ ] **Step 3: Install the PWA** on the iPhone (Megosztás → Főképernyőhöz) — Web Push does not work in a Safari tab.
- [ ] **Step 4: Open `/me/ertesitesek`**, enable push, confirm iOS grants permission.
- [ ] **Step 5: Tap „Teszt értesítés küldése"** and confirm the notification appears on the lock screen, and that tapping it opens the app on Today.
- [ ] **Step 6: Report the outcome** — on success N1's exit criterion is met and N2 is unblocked; on failure capture the backend log line from `WebPushClient` (it logs the mapped `WebPushResult`) before changing anything.

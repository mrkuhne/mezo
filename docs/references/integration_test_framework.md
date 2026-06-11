# Integration Test Framework

Complements `testing_standards.md` (which defines WHAT to test and how to name/assert).
This document defines the REUSABLE INFRASTRUCTURE every backend integration test builds on.
Adapted from the company `IntegrationTestBase` lineage; the live code under
`backend/src/test/java/io/mrkuhne/mezo/support/` IS the reference implementation.

## Package Layout

```
src/test/java/io/mrkuhne/mezo/
  support/
    AbstractIntegrationTest.java   # base for ALL integration tests (context + clean DB)
    ApiIntegrationTest.java        # base for HTTP-level tests (random port + verb helpers + auth)
    ResetDatabase.java             # between-test cleanup, preserves master data
    DatabasePopulator.java         # facade over the per-aggregate populators
    populator/
      UserPopulator.java           # one factory per aggregate (grows with each slice)
```

Test classes live next to the feature they test (`feature/{name}/...IT.java`) and extend
one of the two bases. Never `@SpringBootTest` directly in a test class.

## Two Base Classes — pick by what you test

| Base | Use for | Transaction model |
|---|---|---|
| `AbstractIntegrationTest` | service/repository-level tests | subclass adds `@Transactional` → own writes roll back |
| `ApiIntegrationTest` | controller/HTTP-level tests (security filter, status codes, JSON contract) | NO `@Transactional` (requests commit server-side) → cleanup via `ResetDatabase` |

Rules:
- `AbstractIntegrationTest` boots the full context against a real Postgres (fixed `mezo_test`
  compose DB by default; Testcontainers opt-in via `-Dmezo.test.use-testcontainers=true`).
- `ApiIntegrationTest` adds `RANDOM_PORT`, `TestRestTemplate`, the `demodata` profile
  (so the owner exists for login) and the helpers below.
- HTTP-level test classes must NOT be `@Transactional` — the server handles requests in its
  own transactions; a test-side transaction would just hide committed state from cleanup.

## Database Reset — every test starts clean

`ResetDatabase.resetExceptMasterData()` runs in `@BeforeEach` of `AbstractIntegrationTest`:

- `TRUNCATE TABLE <owned domain tables> CASCADE` — fast, FK-safe.
- Deletes all users/profiles EXCEPT master data (the demodata-seeded owner) — mirrors the
  company `deleteEverythingExceptMasterData()` idea: seeded master data is part of the
  application contract, test garbage is not.
- This makes test classes order-independent on the shared fixed `mezo_test` DB.

Rules:
- **Growth rule (MANDATORY):** every new owned domain table added by a migration MUST be added
  to the TRUNCATE list in the same change. A table missing here = leaked state between tests.
- Never clean up with repository `deleteAll()` loops in test classes — that knowledge belongs
  in `ResetDatabase` only.
- Service-level tests still use `@Transactional` rollback for their own writes; the reset is a
  belt-and-braces floor under both styles.

## Populators — Java test data factories

One `<Aggregate>Populator` per aggregate in `support/populator/`, annotated `@TestComponent`
(registered via `@Import` on `AbstractIntegrationTest`). Layered overloads, from
"give me any valid X" down to full control:

```java
@TestComponent
@RequiredArgsConstructor
public class UserPopulator {

    private final AppUserRepository appUserRepository;

    /** Creates a user with an auto-generated unique email. */
    public AppUserEntity createUser() {
        String unique = UUID.randomUUID().toString().substring(0, 8);
        return createUser("test-" + unique + "@test.local");
    }

    /** Find-or-create by email — idempotent, FK-valid owner for created_by columns. */
    public AppUserEntity createUser(String email) { ... }
}
```

Rules:
- **Persist via repository `saveAndFlush`** — rows must hit the DB so constraints fire.
- **Unique-by-default:** no-arg variants generate unique identities (UUID fragment) so tests
  never collide on unique constraints.
- **Find-or-create for shared identities** (e.g. the FK-valid `created_by` user) — idempotent
  within a test.
- Populators create VALID entities; invalid input belongs in the request DTO of the test itself.
- `DatabasePopulator` is the facade (`populateUser(email)` → id); tests may autowire it or the
  specific populators directly.
- **Growth rule:** each new aggregate (Slice B: mesocycle, workout session…) gets its own
  populator in the same change that introduces the entity.
- SQL scripts for test data remain FORBIDDEN (see `testing_standards.md`).

## HTTP Verb Helpers (`ApiIntegrationTest`)

Tests never call `rest.exchange(...)` and assert status by hand. The base provides
verb helpers where **the expected status is always a parameter and always asserted**,
and the failure message includes method, URI and the actual response body:

```java
// happy path: deserialize the body
TokenResponse token = postForBody("/api/auth/login", request, null, HttpStatus.OK, TokenResponse.class);
List<WeightLogResponse> logs = getForList("/api/biometrics/weight", ownerAuthHeaders(), HttpStatus.OK, WeightLogResponse.class);

// error path: grab the raw body for SystemMessage asserts
String body = postForBody("/api/auth/login", badRequest, null, HttpStatus.BAD_REQUEST, String.class);

// no body expected
getForBody("/api/biometrics/weight", null, HttpStatus.UNAUTHORIZED, Void.class);
deleteAndExpect("/api/biometrics/weight/" + id, ownerAuthHeaders(), HttpStatus.NO_CONTENT);
```

Available: `getForBody`, `getForList`, `postForBody`, `putForBody`, `deleteAndExpect`,
plus the generic `exchangeForBody(method, uri, request, headers, expectedStatus, bodyType)`.
Add further variants (PATCH, multipart, response-header access) to the base when a slice
first needs them — never inline in a test class.

## Auth in API Tests

- `ownerAuthHeaders()` logs in as the demodata owner (credentials from `OwnerProperties`,
  never hardcoded in the helper) and returns ready-to-use Bearer headers.
- Unauthenticated calls pass `null` headers — every protected endpoint gets at least one
  `401`-without-token test.
- Single-user model: no role matrix needed; if multi-user ownership must be proven at HTTP
  level, create the second user via `UserPopulator` and mint its token through the login
  endpoint (no token forging in tests).

## Error-Contract Assertions

`GlobalExceptionHandler` returns `List<SystemMessage>`; tests assert on it through the base
helpers (never by string-matching the resolved message text — codes are the contract):

```java
String body = postForBody("/api/auth/login", new LoginRequest("not-an-email", ""), null,
    HttpStatus.BAD_REQUEST, String.class);
assertHasFieldError(body, "email", "VALIDATION_INVALID_EMAIL");
assertHasFieldError(body, "password", "VALIDATION_REQUIRED_FIELD");

String body401 = postForBody("/api/auth/login", wrongPassword, null, HttpStatus.UNAUTHORIZED, String.class);
assertHasRequestError(body401, "AUTH_LOGIN_INVALID_CREDENTIALS");
```

## Deliberately NOT Adopted (yet)

From the company original (`IntegrationTestBase`), intentionally left out until needed:
- **WireMock** for external HTTP dependencies — bring in with the first real external API
  (Phase 3 AI providers), as a `support/` concern stubbed in the API base, never per-test servers.
- **Mail box / Firebase / RabbitMQ mocks, multi-application-type header matrix** — no such
  infrastructure in mezo's single-user PWA.
- `@MockitoBean` of infra producers — stays FORBIDDEN per `testing_standards.md`; if an
  unavoidable external boundary appears, prefer WireMock over mocking beans.

## Checklist

- [ ] Test extends `AbstractIntegrationTest` (service-level, + `@Transactional`) or
      `ApiIntegrationTest` (HTTP-level, no `@Transactional`) — never raw `@SpringBootTest`
- [ ] Test data via `*Populator` / `DatabasePopulator` only (no inline entity setup, no SQL)
- [ ] New domain table → added to `ResetDatabase` TRUNCATE list in the same change
- [ ] New aggregate → new `*Populator` in the same change
- [ ] HTTP calls via verb helpers with explicit expected status; auth via `ownerAuthHeaders()`
- [ ] Error responses asserted by SystemMessage code/field via `assertHas*Error` helpers
- [ ] Missing helper (PATCH, multipart, WireMock…) → extend the `support/` base, don't inline

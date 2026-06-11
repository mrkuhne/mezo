# API Contract Conventions (OpenAPI, contract-first)

The frontend↔backend boundary is defined ONCE, in OpenAPI, under the top-level `api/` module.
Backend DTOs + controller interfaces and frontend types are GENERATED from it — drift between
the two sides becomes a compile error, not a runtime surprise.

## Module Layout

```
api/
  base.yml                  # info, servers, global bearerAuth security — merge base
  common/
    common-schemas.yml      # SystemMessage / SystemMessageList error contract
  feature/
    <name>/<name>.yml       # one fragment per feature: paths + schemas (grows per slice)
  generate/
    package.json            # openapi-merge-cli
    merge.yml               # ordered input list — every new fragment MUST be added here
  openapi.yml               # MERGED OUTPUT — committed, consumed by both generators
```

## Workflow (slice development)

1. **Contract first:** write/extend `api/feature/<name>/<name>.yml` BEFORE backend or frontend code.
2. Merge: `cd api/generate && npm run generate:api` → regenerates `api/openapi.yml`. Commit it.
3. Backend: `./mvnw clean test` regenerates Java sources automatically (generate-sources phase).
4. Frontend: `cd frontend && pnpm generate:api` → regenerates `src/lib/api.gen.ts`. Commit it.
5. Both generated artifacts (`api/openapi.yml`, `frontend/src/lib/api.gen.ts`) are committed;
   the Java output under `backend/target/` is NOT (regenerated every build).

## Contract Authoring Rules

- **OpenAPI 3.0.3**, one fragment per feature; each fragment is a complete mini-document
  (`openapi/info/paths/components`) so openapi-merge-cli can combine them.
- **Schema names = generated class names** (`LogWeightRequest`, `WeightLogResponse`…); requests
  end in `Request`, responses in `Response`.
- **operationId = controller method name** (`listWeightLogs`, `logWeight`); **tag = generated
  interface name** (tag `Weight` → `WeightApi`).
- **Validation lives in the contract:** `required`, `minLength`, `minimum/maximum` (+
  `exclusiveMinimum`), `pattern`, `format` — the generator turns these into JSR-303 on the
  backend; never re-add hand-written validation that the spec can express.
  - `@NotBlank` has no OpenAPI equivalent: use `required` + `minLength: 1`. Note: an empty
    string then fails as `Size` → `VALIDATION_INVALID_VALUE` (not `VALIDATION_REQUIRED_FIELD`,
    which only fires for null/missing).
  - Prefer `pattern` over `enum` for request fields validated with 400 FIELD errors — an
    invalid `enum` value fails Jackson deserialization (500), a `pattern` fails bean
    validation (400).
- **Every non-2xx response** references `SystemMessageList` (the GlobalExceptionHandler
  contract, defined once in `common/common-schemas.yml`). Document expected statuses per
  operation (400 validation, 401 auth, 404, …).
- Login-style public endpoints override global security with `security: []`.

## Backend Consumption

`openapi-generator-maven-plugin` (`spring` generator) in `backend/pom.xml`:
`interfaceOnly` + `skipDefaultInterface` + `useResponseEntity=false` + `useSpringBoot4`,
output packages `io.mrkuhne.mezo.api.controller` (interfaces) and `io.mrkuhne.mezo.api.dto`
(models, with Lombok `@Builder/@NoArgsConstructor/@AllArgsConstructor`).

```java
@RestController
@RequiredArgsConstructor
public class WeightLogController implements WeightApi {   // mappings + @Valid come from the interface

    private final WeightLogService service;
    private final CurrentUserId currentUserId;

    @Override
    public List<WeightLogResponse> listWeightLogs() {
        return service.list(currentUserId.get());
    }
}
```

Rules:
- Controllers implement the generated `<Tag>Api` interface; NO `@RequestMapping`/`@PostMapping`/
  `@Valid` on the implementation — the interface carries them (including `@ResponseStatus`
  derived from the first 2xx response code).
- The security principal is NEVER a contract parameter — inject `CurrentUserId` (bean) and
  resolve inside the method.
- Services and MapStruct mappers use the generated `api.dto` types directly; entities stay
  hand-written. Type bridges (e.g. entity `Instant` → contract `OffsetDateTime`) live in the
  mapper as `default` methods.
- The techcore `SystemMessage` (exception layer) stays hand-written — the generated
  `api.dto.SystemMessage` is the wire contract only; they must stay field-compatible
  (guarded by `assertHas*Error` ITs).
- Do NOT edit generated sources; they live under `target/generated-sources/openapi`.

## Frontend Consumption

`openapi-typescript` generates types only (no client, no hooks) into `src/lib/api.gen.ts`:

```ts
import type { components } from './api.gen'
type LogWeightRequest = components['schemas']['LogWeightRequest']

body: JSON.stringify({ date, weightKg, note } satisfies LogWeightRequest)
```

Rules:
- The thin `lib/*Api.ts` modules type every request body with `satisfies <Request>` and every
  response with the generated response type — tsc then checks compatibility with the domain
  types consumed by the hook layer.
- The hand-written dual-mode hook layer (`data/hooks.ts`) is NOT generated — hook signatures
  are the frontend's own stable contract. Generators that emit TanStack Query hooks (orval
  etc.) are deliberately not used.
- Where a domain type is stricter than the contract (legacy mock-era types), bridge with an
  EXPLICIT documented cast and file a bd issue — never silently re-widen `apiFetch<T>`.

## Versioning & Compatibility

- `info.version` in `base.yml` tracks the contract (bump minor per slice).
- Within Phase 2 (single deployable, FE+BE released together) breaking changes are allowed but
  must land in ONE commit that regenerates both sides green.
- Removing/renaming a field or endpoint after Phase 2 ships = breaking change → needs a
  deprecation note in the fragment first.

## Checklist

- [ ] New/changed endpoint started in `api/feature/<name>/<name>.yml`, fragment listed in `merge.yml`
- [ ] `npm run generate:api` (merge) + `pnpm generate:api` (FE types) run; both outputs committed
- [ ] Validation expressed in the spec, not re-added by hand; errors reference `SystemMessageList`
- [ ] Controller implements `<Tag>Api`, no duplicate mapping/validation annotations
- [ ] FE request bodies `satisfies` the generated request type; responses typed from `api.gen.ts`
- [ ] Backend `./mvnw clean test` and frontend tests (both modes) green after regeneration

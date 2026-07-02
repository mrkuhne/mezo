# Error Handling

> Examples below use the **real** classes in `techcore/exception/` — `SystemMessage` (static
> builders), `SystemRuntimeErrorException` (carries an `HttpStatus`), `GlobalExceptionHandler`.
> Message texts live in `backend/src/main/resources/messages.properties`.

## Core Pattern

All errors use `SystemRuntimeErrorException` with `SystemMessage`. No hardcoded user-facing text.

## SystemMessage Structure

The hand-written class (`techcore/exception/SystemMessage.java`) is `@Data @Builder` with two
static builder entry points — these are the ONLY sanctioned way to construct one:

```java
@Data
@Builder
public class SystemMessage {
    private Level level;           // ERROR, WARNING, INFO
    private String code;           // "RESOURCE_NOT_FOUND" — key into messages.properties
    private List<String> params;   // optional MessageFormat params for the resolved text
    private String message;        // resolved server-side from messages.properties — never set at throw site
    private String fieldName;      // "email" or "personalInfo.email" (FIELD type only)
    private Type type;             // REQUEST or FIELD
    private String exceptionTraceId;

    public static SystemMessageBuilder error(String code) { ... }                    // REQUEST-level
    public static SystemMessageBuilder field(String code, String fieldName) { ... }  // FIELD-level
}
```

> **Two `SystemMessage` classes exist:** this hand-written techcore one (used in Java code) and
> the generated `api.dto.SystemMessage` (the wire contract from `api/openapi.yml`). They must
> stay field-compatible — guarded by the `assertHas*Error` IT helpers
> (see `integration_test_framework.md`).

## Throwing Errors

Always use the static builders — never a raw constructor, never literal user-facing text:

```java
// REQUEST-level error (HTTP status defaults to 400)
throw new SystemRuntimeErrorException(SystemMessage.error("RESOURCE_NOT_FOUND").build());

// With explicit HTTP status
throw new SystemRuntimeErrorException(
    SystemMessage.error("RESOURCE_NOT_FOUND").build(), HttpStatus.NOT_FOUND);

// FIELD-level error — fieldName must match the request DTO hierarchy
throw new SystemRuntimeErrorException(
    SystemMessage.field("VALIDATION_INVALID_EMAIL", "email").build());

// Nested field, for request { "personalInfo": { "email": "..." } }
throw new SystemRuntimeErrorException(
    SystemMessage.field("VALIDATION_INVALID_EMAIL", "personalInfo.email").build());
```

The `message` field is NEVER set at the throw site. `GlobalExceptionHandler` resolves it from
`messages.properties` by `code` (with `params` as message arguments) and stamps the
`exceptionTraceId`.

## HTTP Status Mapping

`SystemRuntimeErrorException` carries an `HttpStatus` (constructor overloads; default
`BAD_REQUEST`), and `GlobalExceptionHandler` returns it:

| Situation | Status | Typical code |
|---|---|---|
| Validation / bad input | 400 (default) | `VALIDATION_*` |
| Missing/invalid token | 401 | `AUTH_TOKEN_MISSING` |
| Not found — including a row owned by another user | 404 | `RESOURCE_NOT_FOUND` |
| Domain state conflict | 400 | e.g. `TRAIN_WORKOUT_NOT_ACTIVE` |
| Unhandled exception | 500 | `INTERNAL_ERROR` |

`GlobalExceptionHandler` also maps framework exceptions onto the same wire contract:
`MethodArgumentNotValidException` and `ConstraintViolationException` → FIELD messages with
`VALIDATION_*` codes; `NoResourceFoundException` → 404 `RESOURCE_NOT_FOUND`; any other
exception → 500 `INTERNAL_ERROR`. New cross-cutting handlers belong there — never map
exceptions in controllers.

## Error Code Convention

Format: `{DOMAIN}_{ACTION}_{REASON}` in SCREAMING_SNAKE_CASE.

Real examples from `messages.properties`:

| Code | Meaning |
|---|---|
| `AUTH_LOGIN_INVALID_CREDENTIALS` | Bad email/password on login |
| `VALIDATION_REQUIRED_FIELD` | Required field missing |
| `RESOURCE_NOT_FOUND` | Not found (or owned by someone else) |
| `TRAIN_WORKOUT_NOT_ACTIVE` | Workout already completed |

Rules: SCREAMING_SNAKE_CASE, English, unique and descriptive. **Every code MUST have an entry
in `messages.properties`** — a code without an entry falls back to rendering the code itself.

## Type: REQUEST vs FIELD

| Type | When | Display |
|---|---|---|
| `REQUEST` | General error | Top/bottom of form |
| `FIELD` | Field-specific | Under the specific field |

## Validation Pattern (Multiple Errors)

Collect all problems, throw once — the client gets the full list:

```java
public void validate(CreateRecipeRequest request, UUID userId) {
    List<SystemMessage> errors = new ArrayList<>();

    if (recipeRepository.existsByCreatedByAndName(userId, request.getName())) {
        errors.add(SystemMessage.field("RECIPE_CREATE_DUPLICATE_NAME", "name").build());
    }

    if (!errors.isEmpty()) {
        throw new SystemRuntimeErrorException(errors);   // 400, all messages in one response
    }
}
```

## Logging & Trace ID

`GlobalExceptionHandler` centrally generates the `exceptionTraceId` (UUID), logs the error with
it server-side, resolves the message text, and returns the traceId to the client. **Do not
duplicate any of this in services** — just throw.

**DON'T:**
- Send stack traces to the client
- Expose internal error details
- Hardcode user-facing text — all messages go through `SystemMessage.code` + `messages.properties`

## No Hardcoded Text Rule

Error messages, fallback strings, or any text that may reach the UI MUST go through
`SystemMessage.code` + `messages.properties`. Never inline "Unknown error", "Failed to...", etc.

## Frontend Consumption

The wire shape is `List<SystemMessage>` (`SystemMessageList` in the OpenAPI contract). FIELD
messages map to a form field via `fieldName`; REQUEST messages render at form level;
`exceptionTraceId` is support metadata. The FE-side surfacing conventions live with the
frontend error-handling work (see `frontend_conventions.md`).

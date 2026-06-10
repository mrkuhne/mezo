# Error Handling

## Core Pattern

All errors use `SystemRuntimeErrorException` with `SystemMessage`. No hardcoded user-facing text.

## SystemMessage Structure

```java
public class SystemMessage {
    private Level level;           // ERROR, WARNING, INFO
    private String code;           // "USER_NOT_FOUND"
    private List<String> params;   // ["John", "123"]
    private String message;        // Translated message (from message.properties)
    private String fieldName;      // "email" or "personalInfo.email"
    private Type type;             // REQUEST or FIELD
    private String exceptionTraceId;
}
```

## Throwing Errors

**Simple error:**
```java
throw new SystemRuntimeErrorException(
    SystemMessage.error("USER_NOT_FOUND").build()
);
```

**Field-specific error:**
```java
throw new SystemRuntimeErrorException(
    new SystemMessage(Level.ERROR, "INVALID_EMAIL", "Invalid email format", "email", Type.FIELD)
);
```

**Nested field (must match DTO hierarchy):**
```java
// For request: { "personalInfo": { "email": "..." } }
throw new SystemRuntimeErrorException(
    new SystemMessage(Level.ERROR, "INVALID_EMAIL", "Invalid email", "personalInfo.email", Type.FIELD)
);
```

## Error Code Convention

Format: `{DOMAIN}_{ACTION}_{REASON}` in SCREAMING_SNAKE_CASE.

| Code | Meaning |
|---|---|
| `USER_NOT_FOUND` | User not found |
| `USER_CREATE_DUPLICATE_EMAIL` | Email exists on create |
| `PAYMENT_PROCESS_INSUFFICIENT_FUNDS` | Not enough funds |
| `VALIDATION_REQUIRED_FIELD` | Required field missing |

Rules: SCREAMING_SNAKE_CASE, English, unique and descriptive.

## Type: REQUEST vs FIELD

| Type | When | Display |
|---|---|---|
| `REQUEST` | General error | Top/bottom of form |
| `FIELD` | Field-specific | Under the specific field |

## Validation Pattern (Multiple Errors)

```java
public void validateUser(CreateUserRequest request) {
    List<SystemMessage> errors = new ArrayList<>();

    if (userRepository.existsByEmail(request.getEmail())) {
        errors.add(new SystemMessage(
            Level.ERROR, "USER_CREATE_DUPLICATE_EMAIL",
            "Email already exists", "email", Type.FIELD
        ));
    }

    if (!errors.isEmpty()) {
        throw new SystemRuntimeErrorException(errors);
    }
}
```

## Logging Rules

**DO:**
- Generate `exceptionTraceId` (UUID) for each error
- Log error with traceId server-side
- Return traceId to client

```java
String traceId = UUID.randomUUID().toString();
log.error("Error [traceId={}]: {}", traceId, ex.getMessage(), ex);
systemMessage.setExceptionTraceId(traceId);
```

**DON'T:**
- Send stack trace to client
- Expose internal error details
- Hardcode user-facing text — all messages go through `SystemMessage.code` + `message.properties`

## No Hardcoded Text Rule

Error messages, fallback strings, or any text that may reach the UI MUST go through `SystemMessage.code` + `message.properties`. Never inline "Unknown error", "Failed to...", etc.
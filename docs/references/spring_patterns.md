# Spring Patterns

## Dependency Injection

**REQUIRED:** Constructor injection via Lombok `@RequiredArgsConstructor`

```java
@Service
@RequiredArgsConstructor
public class UserService {
    private final UserRepository userRepository;
    private final EmailService emailService;
}
```

**FORBIDDEN:** Field injection (`@Autowired` on fields) — never, in any class.

**Bean injection by name:** If variable name matches bean name, `@Qualifier` is unnecessary. Spring resolves by name automatically.

```java
// Spring injects the bean named "gitLabRestClient"
private final RestClient gitLabRestClient;
```

## @Transactional Rules

Method-level ONLY. Never class-level, not even `readOnly = true`.

| Location | Rule |
|---|---|
| Class level | ❌ NEVER (not even `readOnly = true`) |
| Write methods | `@Transactional` |
| Read methods | No annotation (non-transactional by default) |
| Controllers | ❌ NEVER |
| Repositories | Not needed (Spring Data handles it) |

```java
@Service
@RequiredArgsConstructor
public class UserService {

    // Read — no annotation
    public UserDto getUser(Long id) { ... }

    // Write — explicit @Transactional
    @Transactional
    public UserDto createUser(CreateUserRequest req) { ... }
}
```

**Why no class-level `@Transactional(readOnly = true)`?** It opens a transaction for every method including cache-only reads and pure in-memory mapping. Method-level keeps intent visible and avoids unnecessary overhead.

## Controller Rules

```java
@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {
    private final UserService userService;

    @GetMapping("/{id}")
    public UserDto getUser(@PathVariable Long id) {
        return userService.getUser(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public UserDto createUser(@Valid @RequestBody CreateUserRequest req) {
        return userService.createUser(req);
    }
}
```

- Request/response handling ONLY — no business logic
- Use `@Valid` for request validation
- Set proper HTTP status codes (`@ResponseStatus`)
- No `@Transactional` on controllers

## Repository Patterns

```java
public interface UserRepository extends JpaRepository<UserEntity, Long> {

    // Derived query (preferred)
    Optional<UserEntity> findByEmail(String email);

    // JPQL (preferred over native)
    @Query("SELECT u FROM UserEntity u WHERE u.department.id = :deptId")
    List<UserEntity> findByDepartmentId(@Param("deptId") Long deptId);

    // Exists check (efficient)
    boolean existsByEmail(String email);

    // Native SQL (last resort, flag for review)
    @Query(value = "SELECT * FROM users WHERE email LIKE %:p%", nativeQuery = true)
    List<UserEntity> searchByPattern(@Param("p") String pattern);
}
```

Preference order: Derived queries → JPQL → Native SQL (last resort).

## MapStruct Mapping

```java
@Mapper(componentModel = "spring")
public interface UserMapper {
    UserDto toDto(UserEntity entity);
    UserEntity toEntity(CreateUserRequest request);

    @Mapping(target = "id", ignore = true)
    void updateEntity(@MappingTarget UserEntity entity, UpdateUserRequest req);
}
```

## Lombok Annotations

| Annotation | Use |
|---|---|
| `@RequiredArgsConstructor` | Constructor injection (services, controllers) |
| `@Slf4j` | Logger |
| `@Data` | DTOs (getter, setter, equals, hashCode) |
| `@Builder` | Builder pattern |
| `@Value` | Immutable objects |

## Entity ↔ DB Sync

Every DB-level constraint (NOT NULL, length, CHECK) MUST be mirrored on the JPA entity:

```java
@Column(nullable = false, length = 255)
@NotNull
@Size(max = 255)
private String email;
```

Entity and Liquibase must stay in sync — the entity is not just a read projection.

## Async After Commit

```java
@TransactionalEventListener(phase = AFTER_COMMIT)
@Async("taskExecutor")
public void handleEvent(UserCreatedEvent event) { ... }
```

**FORBIDDEN:** Manual `TransactionSynchronizationManager.registerSynchronization()`

## Concurrency

Mark shared fields as `volatile` in async/SSE streaming contexts:

```java
private volatile SseEmitter emitter;
```

## AOP Self-Invocation Limitation

Self-invocation bypasses aspects — call through the proxy:

```java
@Service
public class MyService {
    @LogExecutionTime
    public void methodA() { ... }

    public void methodB() {
        methodA();  // ❌ AOP won't run (self-invocation)
    }
}
```

## Method Ordering

Public methods at top of class, private methods at bottom.

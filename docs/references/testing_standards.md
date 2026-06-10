# Testing Standards

## Priority

**Integration tests (HIGH)** > Unit tests (LOW)

Default to integration tests. Only use unit tests for pure utility logic with no Spring dependencies.

## Test Naming

```
test{Method}_should{Result}_when{Condition}
```

Always use `test` prefix. Examples:

```java
testGetUser_shouldReturnUser_whenUserExists()
testCreateUser_shouldThrowException_whenEmailDuplicate()
testDeactivateUser_shouldSetActiveFalse_whenUserActive()
```

## Integration Tests

```java
@SpringBootTest
@Transactional
class UserServiceIntegrationTest {

    @Autowired
    private UserService userService;

    @Autowired
    private DatabasePopulator databasePopulator;

    @BeforeEach
    void setUp() {
        databasePopulator.populate();
    }

    @Test
    void testGetUser_shouldReturnUser_whenUserExists() {
        var result = userService.getUser(1L);
        assertThat(result).isNotNull();
        assertThat(result.getEmail()).isEqualTo("test@example.com");
    }
}
```

## Rules

**REQUIRED:**
- `@SpringBootTest` for integration tests
- Real database (not H2 if avoidable)
- Java-based test data via `DatabasePopulator`
- AssertJ (`assertThat`) for all assertions

**FORBIDDEN:**
- JUnit assertions (`assertEquals`, `assertTrue`) — always AssertJ
- Mocking in integration tests
- SQL scripts for test data
- Test order dependencies
- `@MockBean` in integration tests (use real beans)

## AssertJ Examples

```java
// Basic
assertThat(result).isNotNull();
assertThat(result.getName()).isEqualTo("John");

// Collections
assertThat(users).hasSize(3);
assertThat(users).extracting("email").contains("john@test.com");

// Exceptions
assertThatThrownBy(() -> userService.getUser(999L))
    .isInstanceOf(SystemRuntimeErrorException.class);
```

## When Uncertain

- **Unsure about test type?** Default to integration test (`@SpringBootTest`).
- **Pure utility with no Spring deps?** Unit test is OK.
- **Legacy code has mocks?** Don't refactor unless asked, but write new tests as integration tests.

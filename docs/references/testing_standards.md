# Testing Standards

> Reusable infrastructure (base classes, populators, DB reset, HTTP verb helpers) is defined
> in `integration_test_framework.md` — read both when writing integration tests.

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

Never put `@SpringBootTest` on a test class directly — extend one of the two shared bases
(`AbstractIntegrationTest` for service-level, `ApiIntegrationTest` for HTTP-level), which carry
the Spring context, the Postgres wiring, and the between-test DB reset. Full base-class and
populator API: `integration_test_framework.md`.

```java
@Transactional
class RecipeServiceIT extends AbstractIntegrationTest {

    @Autowired
    private RecipeService recipeService;

    @Autowired
    private RecipePopulator recipePopulator;

    @Test
    void testGetRecipe_shouldReturnRecipe_whenOwnedByCurrentUser() {
        RecipeEntity saved = recipePopulator.recipe();

        var result = recipeService.get(saved.getId());   // ids are UUID in this project

        assertThat(result).isNotNull();
        assertThat(result.getName()).isEqualTo(saved.getName());
    }
}
```

## Rules

**REQUIRED:**
- Extend `AbstractIntegrationTest` (service-level) or `ApiIntegrationTest` (HTTP-level)
- Real Postgres — never H2 (fixed `mezo_test` DB locally, Testcontainers opt-in/CI)
- Java-based test data via the `*Populator` factories
- AssertJ (`assertThat`) for all assertions

**FORBIDDEN:**
- Raw `@SpringBootTest` on a test class (creates a second Spring context; use the bases)
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
assertThatThrownBy(() -> recipeService.get(UUID.randomUUID()))
    .isInstanceOf(SystemRuntimeErrorException.class);
```

## When Uncertain

- **Unsure about test type?** Default to an integration test extending a base class.
- **Pure utility with no Spring deps?** Unit test is OK.
- **Legacy code has mocks?** Don't refactor unless asked, but write new tests as integration tests.

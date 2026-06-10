package io.mrkuhne.mezo.support;

import org.springframework.boot.test.context.TestComponent;

/**
 * Java-based test data provider for integration tests (see testing_standards.md).
 * Per-feature populate methods are added by later tasks (e.g. populateOwner()).
 * Registered into the test context via {@code @Import} on {@link AbstractIntegrationTest},
 * so subclasses can simply {@code @Autowired} it.
 */
@TestComponent
public class DatabasePopulator {

    /** Extended per feature with repository deletes to reset state between tests. */
    public void clear() {
        // no-op until features add repositories
    }
}

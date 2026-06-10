package io.mrkuhne.mezo.support;

import io.mrkuhne.mezo.TestcontainersConfiguration;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

/**
 * Base class for all integration tests.
 *
 * <p>Boots the full Spring context against a real Postgres provided by
 * {@link TestcontainersConfiguration} (a {@code @ServiceConnection}-wired
 * Testcontainers {@code PostgreSQLContainer}), which auto-configures the
 * datasource — no {@code @DynamicPropertySource} wiring needed on Spring Boot 4.
 *
 * <p>{@link DatabasePopulator} is imported so subclasses can {@code @Autowired} it
 * for Java-based test data (see testing_standards.md).
 */
@SpringBootTest
@Import({TestcontainersConfiguration.class, DatabasePopulator.class})
public abstract class AbstractIntegrationTest {
}

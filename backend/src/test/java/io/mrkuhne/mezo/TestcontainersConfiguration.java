package io.mrkuhne.mezo;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

@TestConfiguration(proxyBeanMethods = false)
public class TestcontainersConfiguration {

	/**
	 * Opt-in throwaway Postgres for CI / machines without the compose stack
	 * ({@code -Dmezo.test.use-testcontainers=true}). By default tests hit the fixed
	 * {@code mezo_test} compose DB (see src/test/resources/application.properties);
	 * a property-based switch (not a profile) so it composes with
	 * {@code @ActiveProfiles("demodata")} test classes.
	 */
	@Bean
	@ServiceConnection
	@ConditionalOnProperty(name = "mezo.test.use-testcontainers", havingValue = "true")
	PostgreSQLContainer postgresContainer() {
		// pgvector-enabled Postgres 16 mirroring compose + k3s (V2.1) — a compatible postgres superset.
		return new PostgreSQLContainer(
				DockerImageName.parse("pgvector/pgvector:pg16").asCompatibleSubstituteFor("postgres"));
	}

}

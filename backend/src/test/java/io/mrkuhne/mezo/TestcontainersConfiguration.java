package io.mrkuhne.mezo;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.concurrent.atomic.AtomicInteger;
import liquibase.Contexts;
import liquibase.LabelExpression;
import liquibase.Liquibase;
import liquibase.database.Database;
import liquibase.database.DatabaseFactory;
import liquibase.database.jvm.JdbcConnection;
import liquibase.resource.ClassLoaderResourceAccessor;
import org.springframework.beans.factory.DisposableBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.jdbc.autoconfigure.JdbcConnectionDetails;
import org.springframework.boot.test.context.TestConfiguration;
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
	 *
	 * <p><b>One container per JVM, one database per ApplicationContext</b> (mezo-dubmh). The
	 * suite builds ~235 distinct contexts (every {@code @TestPropertySource} combination is its
	 * own cache key). The container used to be a per-context {@code @ServiceConnection} bean, so
	 * each of them started its own Postgres and replayed the whole changelog on it — ~10 of the
	 * CI job's ~59 minutes. Now the server starts once, the changelog runs once into a template
	 * database, and each context gets a {@code CREATE DATABASE … TEMPLATE} clone. Isolation is
	 * unchanged: no two contexts ever share a database. Spring's own Liquibase still runs on
	 * every clone, so the template is only an accelerator — a context whose Liquibase settings
	 * differ simply applies what is missing.
	 */
	@Bean
	@ConditionalOnProperty(name = "mezo.test.use-testcontainers", havingValue = "true")
	JdbcConnectionDetails throwawayDatabase() {
		return SharedPostgres.newDatabase();
	}

	/** JVM-wide Postgres holder; Testcontainers' Ryuk reaps the container when the JVM exits. */
	static final class SharedPostgres {

		private static final String CHANGELOG = "db/changelog/db.changelog-master.yaml";
		private static final String TEMPLATE = "mezo_template";
		private static final AtomicInteger SEQUENCE = new AtomicInteger();
		private static PostgreSQLContainer container;

		private SharedPostgres() {
		}

		static synchronized ThrowawayDatabase newDatabase() {
			if (container == null) {
				container = start();
				buildTemplate();
			}
			String name = "ctx_" + SEQUENCE.incrementAndGet();
			admin("CREATE DATABASE " + name + " TEMPLATE " + TEMPLATE);
			return new ThrowawayDatabase(name, url(name), container.getUsername(), container.getPassword());
		}

		private static PostgreSQLContainer start() {
			// pgvector-enabled Postgres 16 mirroring compose + k3s (V2.1) — a compatible postgres superset.
			PostgreSQLContainer pg = new PostgreSQLContainer(
					DockerImageName.parse("pgvector/pgvector:pg16").asCompatibleSubstituteFor("postgres"));
			// Throwaway data: durability off (every test TRUNCATEs — fsync was pure cost). The
			// context cache keeps up to 32 contexts alive, each with a Hikari pool of up to 5
			// (application.properties), all on this ONE server now — hence max_connections.
			pg.withCommand("postgres", "-c", "fsync=off", "-c", "synchronous_commit=off",
					"-c", "full_page_writes=off", "-c", "max_connections=400");
			pg.start();
			return pg;
		}

		private static void buildTemplate() {
			admin("CREATE DATABASE " + TEMPLATE);
			try (Connection connection = DriverManager.getConnection(url(TEMPLATE), container.getUsername(),
					container.getPassword())) {
				Database database = DatabaseFactory.getInstance()
						.findCorrectDatabaseImplementation(new JdbcConnection(connection));
				new Liquibase(CHANGELOG, new ClassLoaderResourceAccessor(), database)
						.update(new Contexts(), new LabelExpression());
			} catch (Exception e) {
				throw new IllegalStateException("Could not build the Liquibase template database", e);
			}
		}

		static void drop(String name) {
			// FORCE: the context is closing; its Hikari pool may be destroyed after this bean.
			admin("DROP DATABASE IF EXISTS " + name + " WITH (FORCE)");
		}

		private static synchronized void admin(String sql) {
			try (Connection connection = DriverManager.getConnection(url("postgres"), container.getUsername(),
					container.getPassword()); Statement statement = connection.createStatement()) {
				statement.execute(sql);
			} catch (SQLException e) {
				throw new IllegalStateException("Test Postgres admin statement failed: " + sql, e);
			}
		}

		private static String url(String database) {
			return "jdbc:postgresql://" + container.getHost() + ":"
					+ container.getMappedPort(PostgreSQLContainer.POSTGRESQL_PORT) + "/" + database;
		}
	}

	/** A context's private database; dropped when the context closes (cache eviction, JVM exit). */
	record ThrowawayDatabase(String name, String jdbcUrl, String username, String password)
			implements JdbcConnectionDetails, DisposableBean {

		@Override
		public String getJdbcUrl() {
			return jdbcUrl;
		}

		@Override
		public String getUsername() {
			return username;
		}

		@Override
		public String getPassword() {
			return password;
		}

		@Override
		public void destroy() {
			SharedPostgres.drop(name);
		}
	}

}

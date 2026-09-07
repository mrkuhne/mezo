package io.mrkuhne.mezo.feature.admin.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.admin.config.AdminProperties;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** information_schema-driven allowlist for the admin data browser (mezo-d5iy). */
class AdminTableCatalogIT extends AbstractIntegrationTest {

    @Autowired private AdminTableCatalog catalog;
    @Autowired private AdminProperties properties;

    @Test
    void testTables_shouldIncludeOwnedTablesAndAppUser_whenBuiltFromInformationSchema() {
        assertThat(catalog.tables()).containsKeys("workout_session", "meal", "memory_item", "app_user", "llm_log_history");
    }

    @Test
    void testTables_shouldHideSecretColumns_always() {
        assertThat(catalog.require("app_user").hasColumn("password_hash")).isFalse();
        assertThat(catalog.require("app_user").hasColumn("email")).isTrue();
        // invite.code (the invite secret) is owner-visible by design: the shipped Admin API
        // already returns it (InviteResponse.code) so the owner can send it on to a beta
        // tester, so the filter deliberately does not hide it here. Do not "fix" this back.
        assertThat(catalog.require("invite").hasColumn("code")).isTrue();
    }

    @Test
    void testRequire_shouldThrowTableUnknown_whenTableIsNotBrowsable() {
        assertThatThrownBy(() -> catalog.require("databasechangelog"))
                .isInstanceOf(SystemRuntimeErrorException.class)
                .hasMessageContaining("ADMIN_TABLE_UNKNOWN");
        assertThatThrownBy(() -> catalog.require("pg_class; drop table app_user"))
                .isInstanceOf(SystemRuntimeErrorException.class);
    }

    @Test
    void testRequireColumn_shouldThrowColumnUnknown_whenColumnIsHiddenOrAbsent() {
        var appUser = catalog.require("app_user");
        assertThatThrownBy(() -> catalog.requireColumn(appUser, "password_hash"))
                .isInstanceOf(SystemRuntimeErrorException.class)
                .hasMessageContaining("ADMIN_COLUMN_UNKNOWN");
        assertThatThrownBy(() -> catalog.requireColumn(appUser, "nope")).isInstanceOf(SystemRuntimeErrorException.class);
    }

    @Test
    void testForeignKeys_shouldBeResolved_whenTableReferencesAnother() {
        var set = catalog.require("exercise_set").column("workout_session_id").orElseThrow();
        assertThat(set.foreignKey()).isTrue();
        assertThat(set.referencesTable()).isEqualTo("workout_session");
    }

    @Test
    void testFeatureMap_shouldNameColumnsThatExist_forEveryConfiguredFeature() {
        properties.featureMap().forEach((key, source) -> {
            var table = catalog.require(source.table());
            assertThat(table.column(source.timestampColumn()))
                    .as("feature %s -> %s.%s", key, source.table(), source.timestampColumn())
                    .isPresent();
        });
    }

    @Test
    void testSoftDelete_shouldBeAbsent_forLlmLogHistory() {
        assertThat(catalog.require("llm_log_history").hasColumn("is_deleted")).isFalse();
        assertThat(catalog.require("workout_session").hasColumn("is_deleted")).isTrue();
    }

    @Test
    void testPgvectorColumns_shouldBeHiddenFromCatalog_whenTypeIsUserDefined() {
        // Pgvector columns (vector(768)) are reported by information_schema as USER-DEFINED
        // type, not a concrete SQL type. They are hidden from the browsable catalog because:
        // a 768-float array is not human-readable, JSON serialization would bloat responses,
        // and the JDBC driver has no default mapping for it, risking runtime failure rather
        // than a clean 400 on read. They are dropped the same way credential columns are,
        // so they can never be selected, sorted, or filtered on.
        var memoryVector = catalog.require("memory_vector");
        assertThat(memoryVector.hasColumn("embedding"))
                .as("pgvector embedding column should be hidden from catalog")
                .isFalse();
        // Verify the table itself is browsable and other columns are visible (not a vacuous
        // test: this guards against the whole table being dropped for an unrelated reason).
        assertThat(memoryVector.hasColumn("provider"))
                .as("normal column in same table should remain visible")
                .isTrue();
    }
}

package io.mrkuhne.mezo.feature.biometrics.sleep;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.ClassPathResource;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

/**
 * The B1 "one night per date" migration (mezo-r36n9.11). The test DB already carries the unique index,
 * so each case drops it inside its (rolled-back) transaction, seeds duplicate live rows, then executes
 * the real dedup changeset SQL from the classpath and asserts the outcome.
 */
@Transactional
class SleepLogDedupMigrationIT extends AbstractIntegrationTest {

    private static final LocalDate D = LocalDate.parse("2026-11-09");
    private static final String DEDUP = "db/changelog/1.1.0/script/202611111040_mezo-r36n9.11_sleep_log_dedup.sql";

    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private JdbcTemplate jdbc;

    private void seed(UUID user, LocalDate date, String source, Integer quality, Integer sqp, Integer awakenings,
                      String createdAt) {
        jdbc.update("""
            insert into sleep_log (created_by, date, source, quality, source_quality_pct, awakenings, created_at)
            values (?, ?, ?, ?, ?, ?, ?::timestamptz)""", user, date, source, quality, sqp, awakenings, createdAt);
    }

    private void runDedup() throws Exception {
        String sql = new String(new ClassPathResource(DEDUP).getInputStream().readAllBytes(), StandardCharsets.UTF_8);
        jdbc.execute(sql);
    }

    private List<Map<String, Object>> live(UUID user) {
        return jdbc.queryForList("select date, source, quality, source_quality_pct, awakenings from sleep_log "
            + "where created_by = ? and is_deleted = false order by date", user);
    }

    @Test
    void dedupLeavesOneLiveRowWithMergedSubjectiveFields() throws Exception {
        UUID user = databasePopulator.populateUser("a@test.local");
        jdbc.execute("drop index uq_sleep_log_owner_date_live");
        seed(user, D, "manual", 6, null, 2, "2026-11-09T07:00:00Z");
        seed(user, D, "apple_health", null, null, null, "2026-11-09T08:00:00Z");
        seed(user, D, "screenshot", 8, 77, null, "2026-11-09T09:00:00Z");
        seed(user, D.minusDays(1), "manual", 7, null, null, "2026-11-08T07:00:00Z"); // untouched single

        runDedup();

        List<Map<String, Object>> rows = live(user);
        assertThat(rows).hasSize(2);
        Map<String, Object> merged = rows.get(1);
        assertThat(merged.get("source")).isEqualTo("apple_health");
        assertThat(merged.get("quality")).isEqualTo(8);               // best-ranked loser first (screenshot)
        assertThat(merged.get("source_quality_pct")).isEqualTo(77);
        assertThat(merged.get("awakenings")).isEqualTo(2);            // only the manual loser had it
        assertThat(rows.get(0).get("quality")).isEqualTo(7);
        assertThat(jdbc.queryForObject("select count(*) from sleep_log where created_by = ? and is_deleted = true",
            Integer.class, user)).isEqualTo(2);
    }

    @Test
    void newestCreatedAtBreaksATieAndWinnerKeepsItsOwnValues() throws Exception {
        UUID user = databasePopulator.populateUser("a@test.local");
        jdbc.execute("drop index uq_sleep_log_owner_date_live");
        seed(user, D, "manual", 4, 50, 1, "2026-11-09T07:00:00Z");
        seed(user, D, "manual", 9, null, null, "2026-11-09T10:00:00Z");

        runDedup();

        List<Map<String, Object>> rows = live(user);
        assertThat(rows).hasSize(1);
        assertThat(rows.get(0).get("quality")).isEqualTo(9);          // newest wins, keeps its quality
        assertThat(rows.get(0).get("source_quality_pct")).isEqualTo(50); // filled from the loser
        assertThat(rows.get(0).get("awakenings")).isEqualTo(1);
    }

    @Test
    void uniqueIndexRejectsASecondLiveRow() {
        UUID user = databasePopulator.populateUser("a@test.local");
        seed(user, D, "manual", 5, null, null, "2026-11-09T07:00:00Z");
        assertThatThrownBy(() -> seed(user, D, "manual", 6, null, null, "2026-11-09T08:00:00Z"))
            .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void uniqueIndexAllowsASoftDeletedRowBesideALiveOne() {
        UUID user = databasePopulator.populateUser("a@test.local");
        seed(user, D, "manual", 5, null, null, "2026-11-09T07:00:00Z");
        jdbc.update("update sleep_log set is_deleted = true where created_by = ?", user);
        seed(user, D, "manual", 6, null, null, "2026-11-09T08:00:00Z");
        assertThat(live(user)).hasSize(1);
    }
}

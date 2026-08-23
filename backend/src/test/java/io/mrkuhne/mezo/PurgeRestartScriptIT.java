package io.mrkuhne.mezo;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.HabitPopulator;
import io.mrkuhne.mezo.support.populator.PantryItemPopulator;
import io.mrkuhne.mezo.support.populator.WeightLogPopulator;
import java.io.IOException;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Statement;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.ConnectionCallback;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Exercises scripts/purge-restart.sql (bd mezo-rcsy) against the real schema:
 * dry run touches nothing; live run truncates everything outside the whitelist
 * and provably keeps the whitelist rows. Guards the script against schema drift
 * (a renamed kept table makes the script's whitelist-existence check raise).
 */
class PurgeRestartScriptIT extends AbstractIntegrationTest {

    @Autowired private JdbcTemplate jdbc;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private PantryItemPopulator pantryItemPopulator;
    @Autowired private WeightLogPopulator weightLogPopulator;
    @Autowired private HabitPopulator habitPopulator;

    private static final Path SCRIPT = Path.of("..", "scripts", "purge-restart.sql");

    private UUID seed() {
        UUID owner = databasePopulator.populateUser("purge@test.local");
        pantryItemPopulator.createFood(owner, "purge-keep-food", LocalDate.parse("2027-01-01"));
        weightLogPopulator.createWeightLog(owner, LocalDate.parse("2026-08-01"), new BigDecimal("80.00"));
        habitPopulator.pendingDay(owner, LocalDate.parse("2026-08-01")); // seeds chains+defs+day rows
        return owner;
    }

    private long count(String table) {
        return jdbc.queryForObject("SELECT count(*) FROM " + table, Long.class);
    }

    /** Runs SET + script + RESET on ONE pooled connection (a plain JdbcTemplate.execute
     *  per statement may hit different pool connections, leaking the GUC). */
    private void runScript(boolean live) throws IOException {
        String sql = Files.readString(SCRIPT);
        jdbc.execute((ConnectionCallback<Void>) con -> {
            try (Statement st = con.createStatement()) {
                if (live) {
                    st.execute("SET purge.dry_run = 'off'");
                }
                st.execute(sql);
                st.execute("RESET purge.dry_run");
            }
            return null;
        });
    }

    @Test
    void testDryRun_shouldDeleteNothing_whenGucUnset() throws IOException {
        seed();
        long pantry = count("pantry_item");
        long weight = count("weight_log");
        long habitDays = count("habit_day");
        assertThat(weight).isPositive();

        runScript(false);

        assertThat(count("pantry_item")).isEqualTo(pantry);
        assertThat(count("weight_log")).isEqualTo(weight);
        assertThat(count("habit_day")).isEqualTo(habitDays);
    }

    @Test
    void testLiveRun_shouldPurgeComplementAndKeepWhitelist_whenGucOff() throws IOException {
        seed();
        long users = count("app_user");
        long pantry = count("pantry_item");
        long chains = count("habit_chain");
        long defs = count("habit_def");
        assertThat(count("weight_log")).isPositive();
        assertThat(count("habit_day")).isPositive();

        runScript(true);

        // purged side: logs gone, routine day-ticks gone
        assertThat(count("weight_log")).isZero();
        assertThat(count("habit_day")).isZero();
        // kept side: identity, pantry, routine definitions untouched
        assertThat(count("app_user")).isEqualTo(users);
        assertThat(count("pantry_item")).isEqualTo(pantry);
        assertThat(count("habit_chain")).isEqualTo(chains);
        assertThat(count("habit_def")).isEqualTo(defs);
        assertThat(count("databasechangelog")).isPositive(); // Liquibase history intact
    }
}

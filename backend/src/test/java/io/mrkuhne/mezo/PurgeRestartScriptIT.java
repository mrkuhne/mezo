package io.mrkuhne.mezo;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.HabitPopulator;
import io.mrkuhne.mezo.support.populator.PantryItemPopulator;
import io.mrkuhne.mezo.support.populator.RecipePopulator;
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
    @Autowired private RecipePopulator recipePopulator;
    @Autowired private WeightLogPopulator weightLogPopulator;
    @Autowired private HabitPopulator habitPopulator;

    private static final Path SCRIPT = Path.of("..", "scripts", "purge-restart.sql");

    private UUID seed() {
        UUID owner = databasePopulator.populateUser("purge@test.local");
        PantryItemEntity food = pantryItemPopulator.createFood(owner, "purge-keep-food", LocalDate.parse("2027-01-01"));
        recipePopulator.createRecipe(owner, food.getId()); // seeds recipe + 2 recipe_ingredient lines
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
                try {
                    st.execute(sql);
                } finally {
                    // Always reset, even if the script raised — otherwise a failure hands the
                    // pool back a connection stuck in live mode for whichever test runs next.
                    st.execute("RESET purge.dry_run");
                }
            }
            return null;
        });
    }

    @Test
    void testDryRun_shouldDeleteNothing_whenGucUnset() throws IOException {
        seed();
        long pantry = count("pantry_item");
        long pantryCatalog = count("pantry_catalog");
        long recipes = count("recipe");
        long recipeIngredients = count("recipe_ingredient");
        long weight = count("weight_log");
        long habitDays = count("habit_day");
        assertThat(weight).isPositive();

        runScript(false);

        assertThat(count("pantry_item")).isEqualTo(pantry);
        assertThat(count("pantry_catalog")).isEqualTo(pantryCatalog);
        assertThat(count("recipe")).isEqualTo(recipes);
        assertThat(count("recipe_ingredient")).isEqualTo(recipeIngredients);
        assertThat(count("weight_log")).isEqualTo(weight);
        assertThat(count("habit_day")).isEqualTo(habitDays);
    }

    @Test
    void testLiveRun_shouldPurgeComplementAndKeepWhitelist_whenGucOff() throws IOException {
        seed();
        long users = count("app_user");
        long pantry = count("pantry_item");
        long pantryCatalog = count("pantry_catalog");
        long recipes = count("recipe");
        long recipeIngredients = count("recipe_ingredient");
        long chains = count("habit_chain");
        long defs = count("habit_def");
        assertThat(count("weight_log")).isPositive();
        assertThat(count("habit_day")).isPositive();
        assertThat(pantryCatalog).isPositive();

        runScript(true);

        // purged side: logs gone, routine day-ticks gone
        assertThat(count("weight_log")).isZero();
        assertThat(count("habit_day")).isZero();
        // kept side: identity, pantry, recipes (+ ingredients), routine definitions untouched.
        // pantry_catalog (mezo-qw37.4) is the pantry's definition half — dropping it from the
        // whitelist empties the kept pantry_item through the catalog_id FK's TRUNCATE CASCADE,
        // so pin both halves here.
        assertThat(count("app_user")).isEqualTo(users);
        assertThat(count("pantry_item")).isEqualTo(pantry);
        assertThat(count("pantry_catalog")).isEqualTo(pantryCatalog);
        assertThat(count("recipe")).isEqualTo(recipes);
        assertThat(count("recipe_ingredient")).isEqualTo(recipeIngredients);
        assertThat(count("habit_chain")).isEqualTo(chains);
        assertThat(count("habit_def")).isEqualTo(defs);
        assertThat(count("databasechangelog")).isPositive(); // Liquibase history intact
    }
}

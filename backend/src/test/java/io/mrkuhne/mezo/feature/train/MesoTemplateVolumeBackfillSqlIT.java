package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * mezo-gbo7 review carry: the {@code meso_template} jsonb backfill statement inside
 * {@code 202608241200_mezo-gbo7_exercise_counts_toward_volume.sql} runs against zero rows in
 * every other IT (fresh test schema), so neither of the two edge cases the reviewer flagged is
 * exercised there: (1) a template whose {@code days} is the column's own {@code '[]'} default
 * must stay {@code '[]'}, not become SQL NULL (the day-level {@code jsonb_agg} needs its own
 * {@code coalesce}, mirroring the exercise-level one a few lines below); (2) a day object with
 * no {@code exercises} key at all must pass through unchanged, not gain an injected {@code
 * exercises: []}.
 *
 * <p>The repo has no precedent for driving a changelog script as a unit under test, so this
 * loads the actual migration file off the classpath and executes only its {@code update
 * meso_template ...} statement (the {@code alter table} / {@code update exercise} statements
 * ran once already, during schema migration, and would fail to re-run against the same schema)
 * — any future edit to that statement is exercised here rather than duplicated inline.
 */
class MesoTemplateVolumeBackfillSqlIT extends AbstractIntegrationTest {

    private static final String SCRIPT_PATH =
        "db/changelog/1.0.0/script/202608241200_mezo-gbo7_exercise_counts_toward_volume.sql";

    @Autowired private OwnerProperties ownerProperties;
    @Autowired private io.mrkuhne.mezo.support.DatabasePopulator databasePopulator;
    @Autowired private JdbcTemplate jdbcTemplate;

    @Test
    void testBackfill_shouldKeepEmptyDaysArray_whenTemplateHasNoDays() {
        UUID owner = ownerId();
        UUID templateId = insertTemplate(owner, "[]");

        jdbcTemplate.update(mesoTemplateUpdateStatement());

        String days = jdbcTemplate.queryForObject(
            "select days::text from meso_template where id = ?", String.class, templateId);
        assertThat(days).isEqualTo("[]");
    }

    @Test
    void testBackfill_shouldLeaveDayUnchanged_whenExercisesKeyIsAbsent() {
        UUID owner = ownerId();
        String daysWithoutExercisesKey = "[{\"label\": \"Hét\", \"location\": \"gym\"}]";
        UUID templateId = insertTemplate(owner, daysWithoutExercisesKey);

        jdbcTemplate.update(mesoTemplateUpdateStatement());

        String days = jdbcTemplate.queryForObject(
            "select days::text from meso_template where id = ?", String.class, templateId);
        assertThat(days).isEqualTo(daysWithoutExercisesKey);
    }

    private UUID insertTemplate(UUID owner, String daysJson) {
        UUID id = UUID.randomUUID();
        jdbcTemplate.update(
            "insert into meso_template (id, created_by, title, weeks, days) "
                + "values (?, ?, 'mezo-gbo7 regression', 4, ?::jsonb)",
            id, owner, daysJson);
        return id;
    }

    /** Find-or-create yields the demodata-seeded owner's id — the single-user principal. */
    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    /**
     * Extracts the {@code update meso_template ...} statement from the real migration file so
     * this test fails if that statement regresses, without re-running the {@code alter table} /
     * {@code update exercise} statements that already applied during schema migration.
     */
    private static String mesoTemplateUpdateStatement() {
        String script = readScript();
        int start = script.indexOf("update meso_template");
        if (start < 0) {
            throw new IllegalStateException("update meso_template statement not found in " + SCRIPT_PATH);
        }
        int end = script.indexOf(';', start);
        if (end < 0) {
            throw new IllegalStateException("unterminated update meso_template statement in " + SCRIPT_PATH);
        }
        return script.substring(start, end + 1);
    }

    private static String readScript() {
        try {
            byte[] bytes = new ClassPathResource(SCRIPT_PATH).getContentAsByteArray();
            return new String(bytes, StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}

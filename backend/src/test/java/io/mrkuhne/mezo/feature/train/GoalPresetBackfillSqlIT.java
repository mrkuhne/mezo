package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

/** mezo-dq60: the goal_preset backfill maps the known GOAL_PRESETS descriptions, leaves the rest NULL. */
class GoalPresetBackfillSqlIT extends AbstractIntegrationTest {

    @Autowired private OwnerProperties ownerProperties;
    @Autowired private io.mrkuhne.mezo.support.DatabasePopulator databasePopulator;
    @Autowired JdbcTemplate jdbcTemplate;

    @Test
    void testBackfill_shouldMapKnownDescription_andLeaveUnknownNull() throws Exception {
        UUID owner = ownerId();
        UUID known = insertTemplate(owner, "Volumen-driven · MAV/MRV progresszió · klasszikus RP hypertrophy blokk");
        UUID edited = insertTemplate(owner, "saját szöveg, átírva");
        UUID noGoal = insertTemplate(owner, null);

        for (String stmt : backfillStatements()) jdbcTemplate.update(stmt);

        assertThat(preset(known)).isEqualTo("hypertrophy");
        assertThat(preset(edited)).isNull();
        assertThat(preset(noGoal)).isNull();
    }

    /**
     * The hypertrophy arm above is the only one the original test exercised — a typo in any of
     * the other 5 CASE literals would silently leave the column NULL. Descriptions copied
     * verbatim from the migration file (202608242315_mezo-dq60_goal_preset.sql), not from the FE
     * GOAL_PRESETS table, so this test actually pins the SQL rather than re-deriving it.
     */
    @Test
    void testBackfill_shouldMapEveryRemainingKnownDescription() throws Exception {
        UUID owner = ownerId();
        UUID strength = insertTemplate(owner, "Intenzitás-driven · 3-6 reps · alacsonyabb volumen · hosszabb pihenő");
        UUID cutPrep = insertTemplate(owner, "Volumen-tartás · izom-megőrzés · deficit nélkül");
        UUID recovery = insertTemplate(owner, "Isoláció-fokú · alacsony fatigue · niggle-aware substitúció");
        UUID sport = insertTemplate(owner, "Vertikális teljesítmény · vállstabilitás · plyo-integráció");
        UUID erohipertrofia = insertTemplate(owner, "Kevés gyakorlat · 6-8 rep RIR 0 · plyo-vezérelt láb + felső");

        for (String stmt : backfillStatements()) jdbcTemplate.update(stmt);

        assertThat(preset(strength)).isEqualTo("strength");
        assertThat(preset(cutPrep)).isEqualTo("cut-prep");
        assertThat(preset(recovery)).isEqualTo("recovery");
        assertThat(preset(sport)).isEqualTo("sport");
        assertThat(preset(erohipertrofia)).isEqualTo("erohipertrofia");
    }

    private UUID insertTemplate(UUID owner, String goal) {
        UUID id = UUID.randomUUID();
        jdbcTemplate.update("""
            insert into meso_template (id, created_by, title, goal, weeks, phase_curve, days)
            values (?, ?, 'T', ?, 6, '{MEV}', '[]'::jsonb)""", id, owner, goal);
        return id;
    }

    private String preset(UUID id) {
        return jdbcTemplate.queryForObject(
            "select goal_preset from meso_template where id = ?", String.class, id);
    }

    /** Find-or-create yields the demodata-seeded owner's id — the single-user principal. */
    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    private java.util.List<String> backfillStatements() throws Exception {
        String sql = Files.readString(Path.of(
            "src/main/resources/db/changelog/1.0.0/script/202608242315_mezo-dq60_goal_preset.sql"));
        return java.util.Arrays.stream(sql.split(";"))
            .map(String::trim).filter(s -> s.toLowerCase().startsWith("update")).toList();
    }
}

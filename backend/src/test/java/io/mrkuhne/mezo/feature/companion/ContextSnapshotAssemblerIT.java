package io.mrkuhne.mezo.feature.companion;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.service.ContextSnapshotAssembler;
import io.mrkuhne.mezo.feature.goal.entity.GoalPrescriptionJson;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.BiometricProfilePopulator;
import io.mrkuhne.mezo.support.populator.GoalPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import io.mrkuhne.mezo.support.populator.WeightLogPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

/**
 * V0.3 context snapshot — deterministic, LLM-free (spec §4). The fake profile keeps the
 * Gemini adapter out of the context; the assembler itself never touches the port.
 */
@Transactional
@ActiveProfiles("companion-fake")
class ContextSnapshotAssemblerIT extends AbstractIntegrationTest {

    @Autowired private ContextSnapshotAssembler assembler;
    @Autowired private UserPopulator userPopulator;
    @Autowired private BiometricProfilePopulator biometricProfilePopulator;
    @Autowired private WeightLogPopulator weightLogPopulator;
    @Autowired private GoalPopulator goalPopulator;

    @Test
    void testRender_shouldRenderAllBlocksWithNincsAdat_whenUserHasNoData() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate today = LocalDate.now();

        String block = assembler.render(owner, today);

        assertThat(block).startsWith("\n\nAKTUÁLIS ÁLLAPOT (pillanatkép — " + today + "):");
        // all six blocks present, in spec §4 order
        int profil = block.indexOf("[Profil]");
        int cel = block.indexOf("[Cél]");
        int edzes = block.indexOf("[Edzés]");
        int fuel = block.indexOf("[Mai üzemanyag]");
        int med = block.indexOf("[Gyógyszer]");
        int rege = block.indexOf("[Regeneráció]");
        assertThat(profil).isPositive();
        assertThat(cel).isGreaterThan(profil);
        assertThat(edzes).isGreaterThan(cel);
        assertThat(fuel).isGreaterThan(edzes);
        assertThat(med).isGreaterThan(fuel);
        assertThat(rege).isGreaterThan(med);
        // absences are explicit, never invented (spec §4) — a zero weight-trend would be a fabricated number
        assertThat(block)
            .contains("[Profil] nincs adat")
            .contains("súlytrend: nincs adat")
            .contains("[Cél] nincs adat")
            .contains("mezociklus: nincs adat")
            .contains("gym-rend: nincs adat")
            .contains("sport-rend: nincs adat")
            .contains("0 gym-edzés, 0 sportalkalom, 0 futás")
            .contains("protokoll: nincs adat, mai bevitel: 0")
            .contains("[Gyógyszer] nincs adat")
            .contains("alvás: nincs adat")
            .contains("check-in: nincs adat");
        // fuel targets come from config, so the fuel line renders numbers even on an empty day
        assertThat(block).contains("[Mai üzemanyag] 0/");
    }

    @Test
    void testRender_shouldRenderProfileAndTrend_whenProfileAndWeightsExist() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate today = LocalDate.now();
        biometricProfilePopulator.create(owner);
        for (int i = 14; i >= 0; i--) {
            weightLogPopulator.createWeightLog(owner, today.minusDays(i),
                new BigDecimal("85.00").subtract(new BigDecimal("0.05").multiply(BigDecimal.valueOf(14 - i))));
        }

        String block = assembler.render(owner, today);

        assertThat(block).contains("[Profil] ").doesNotContain("[Profil] nincs adat");
        assertThat(block).contains(" cm").contains(" év");
        assertThat(block).contains("súlytrend: ").contains(" kg");
        assertThat(block).doesNotContain("súlytrend: nincs adat");
    }

    @Test
    void testRender_shouldPickCurrentWeekSegmentAndPlanner_whenActiveGoalWithPrescription() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate today = LocalDate.now();
        GoalPrescriptionJson prescription = new GoalPrescriptionJson(null, "formula",
            List.of(
                new GoalPrescriptionJson.Segment(1, 2, "bevezető", 2300, 170,
                    new BigDecimal("7.5"), List.of(5, 6), null, null),
                new GoalPrescriptionJson.Segment(3, 6, "vágás", 2100, 180,
                    new BigDecimal("7.5"), List.of(5, 6), null, null)),
            null, null);
        // started 2 weeks + 1 day ago → day 15 → week 3 → the second segment
        goalPopulator.createGoalFull(owner, today.minusWeeks(2).minusDays(1), today.plusWeeks(6),
            prescription, 4, "06:30", "22:30");

        String block = assembler.render(owner, today);

        assertThat(block).contains("[Cél] Nyári cut (cut): 84.2 → 80 kg");
        assertThat(block).contains("3. hét");
        assertThat(block).contains("e heti recept: 2100 kcal, 180 g fehérje, alvás 7.5 h, pihenőnap: Szo, V");
        assertThat(block).contains("étkezés/nap: 4, ébredés: 06:30, lefekvés: 22:30");
    }

    @Test
    void testRender_shouldBeDeterministic_whenCalledTwice() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate today = LocalDate.now();

        assertThat(assembler.render(owner, today)).isEqualTo(assembler.render(owner, today));
    }
}

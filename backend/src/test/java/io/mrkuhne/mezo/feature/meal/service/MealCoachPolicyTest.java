package io.mrkuhne.mezo.feature.meal.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.nutrition.entity.MealBreakdownJson;
import io.mrkuhne.mezo.feature.nutrition.entity.MealBreakdownJson.NovaDetail;
import io.mrkuhne.mezo.feature.nutrition.entity.MealBreakdownJson.NovaStackRow;
import io.mrkuhne.mezo.feature.nutrition.service.DailyTargets;
import io.mrkuhne.mezo.feature.nutrition.service.MealRole;
import io.mrkuhne.mezo.feature.nutrition.service.MealScoringService;
import io.mrkuhne.mezo.feature.nutrition.service.NovaRule;
import io.mrkuhne.mezo.feature.nutrition.service.Sensitivity;
import io.mrkuhne.mezo.feature.nutrition.service.SensitivityLevel;
import io.mrkuhne.mezo.feature.nutrition.service.SensitivityProfile;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/**
 * The coach policy of Boop B4 (mezo-r36n9.14, owner decisions 8 and 17): the old "never name a
 * food sensitivity" rule is reversed to "name only what the structured profile lists", and the
 * processed-food line fires only when NOVA 3-4 carries the larger part of the meal's kcal. No test
 * pinned the old wording, which is why it could drift; these pin the new one.
 */
class MealCoachPolicyTest {

    private static final LocalDate DATE = LocalDate.of(2026, 11, 13);
    private static final DailyTargets TARGETS = new DailyTargets(2000, 150, 200, 60, "goal", null);
    private static final String QUIET_MARKER = "FELDOLGOZOTTSÁG";

    @Test
    void promptAllowsNamingKnownSensitivities() {
        for (String prompt : List.of(MealCoachService.SYSTEM_PROMPT, MealCoachService.SYSTEM_PROMPT_NEUTRAL)) {
            assertThat(prompt)
                .doesNotContain("ne nevezz meg ételérzékenységet")
                .doesNotContain("SOHA ne diagnosztizálj és ne nevezz meg")
                .contains("CSAK az ÉRZÉKENYSÉGEK listában szereplő")
                .contains("ne találj ki újat")
                .contains("SOHA ne diagnosztizálj");
        }
    }

    @Test
    void processedLineOnlyWhenDominant() {
        SensitivityProfile profile = new SensitivityProfile(List.of(), new NovaRule(true, 2));

        // NOVA 3+4 carry 70% of the kcal -> the quiet line
        assertThat(message(profile, breakdown(10, 20, 30, 40))).contains(QUIET_MARKER);
        // one small processed item (15%) -> silence
        assertThat(message(profile, breakdown(50, 35, 10, 5))).doesNotContain(QUIET_MARKER);
        // exactly half is not "the larger part"
        assertThat(message(profile, breakdown(25, 25, 25, 25))).doesNotContain(QUIET_MARKER);
        // the NOVA rule is off -> never
        assertThat(message(new SensitivityProfile(List.of(), new NovaRule(false, 2)), breakdown(0, 0, 50, 50)))
            .doesNotContain(QUIET_MARKER);
        // no profile known -> never
        assertThat(message(null, breakdown(0, 0, 50, 50))).doesNotContain(QUIET_MARKER);
    }

    @Test
    void processedLineNeverFiresWithoutNovaData() {
        SensitivityProfile profile = new SensitivityProfile(List.of(
            new Sensitivity("lactose", SensitivityLevel.INTOLERANCE, null)), new NovaRule(true, 2));
        MealBreakdownJson noNova = new MealBreakdownJson(new BigDecimal("0.5"), new BigDecimal("0.5"), null,
            null, List.of(), List.of(), List.of(), MealScoringService.FORMULA_VERSION);

        assertThat(message(profile, noNova)).doesNotContain(QUIET_MARKER);
    }

    private static String message(SensitivityProfile profile, MealBreakdownJson breakdown) {
        MealCoachContextReader.PersonContext person = MealCoachContextReader.PersonContext.empty()
            .withSensitivity(profile);
        MealCoachPrompt.MealBlock block = new MealCoachPrompt.MealBlock(UUID.randomUUID(), "Ebéd", "lunch",
            LocalTime.of(12, 30), 1, breakdown, MealRole.STANDARD, BigDecimal.ZERO, BigDecimal.ZERO,
            BigDecimal.ZERO, BigDecimal.ZERO);
        return MealCoachPrompt.userMessage(DATE, TARGETS, List.of(), List.of(block), person);
    }

    /** A breakdown whose nova dimension carries the given kcal shares of NOVA 1..4. */
    static MealBreakdownJson breakdown(int n1, int n2, int n3, int n4) {
        NovaDetail nova = new NovaDetail(3, List.of(new NovaStackRow(1, n1, "a"), new NovaStackRow(2, n2, "b"),
            new NovaStackRow(3, n3, "c"), new NovaStackRow(4, n4, "d")), List.of());
        return new MealBreakdownJson(new BigDecimal("0.5"), new BigDecimal("0.8"), null, null,
            List.of(new MealBreakdownJson.Dimension("nova", "Feldolgozottság", new BigDecimal("0.1"),
                new BigDecimal("0.5"), BigDecimal.ONE, "detail", null, null, nova, null, null, null)),
            List.of(), List.of(), MealScoringService.FORMULA_VERSION);
    }
}

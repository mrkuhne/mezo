package io.mrkuhne.mezo.feature.companion.flags.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.flags.service.FlagVerdict.ClearEvidence;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

class FlagTraceCopyTest {

    /** Every metric a rule can hand back — read off the ClearEvidence call sites in service/rule/. */
    private static final List<String> METRICS = List.of(
        "deficit_hours", "stress_days_over", "bad_checkins", "load_avg_min", "fuel_arms_fired",
        "weight_trend_pct_wk", "trajectory", "shoulder_strain_avg", "tomorrow_muscle",
        "nudge_run_nights", "late_meal_days", "stale_domains", "longest_missed_run",
        "habits_recent_avg", "missed_gym_days", "signals_matched", "quiet_days",
        "other_flags_raised");

    @Test
    void every_clear_metric_renders_a_hungarian_sentence_not_the_raw_key() {
        for (String metric : METRICS) {
            String text = FlagTraceCopy.clearText(new ClearEvidence(metric, 1.0, 2.0, "x"));
            assertThat(text).as(metric).isNotBlank().doesNotContain(metric);
        }
    }

    @Test
    void a_numeric_clear_names_the_observed_value_and_the_threshold() {
        String text = FlagTraceCopy.clearText(new ClearEvidence("deficit_hours", 0.4, 1.0, null));
        assertThat(text).contains("0,4").contains("1,0");
    }

    /**
     * Morning-feed defect (bd mezo-btmc): the quiet half of the same mislabel. {@code
     * SleepDebtRule} hands this metric its CUMULATIVE window deficit and its CUMULATIVE
     * threshold ({@code d.deficitHours()} vs {@code cfg.deficitHours()}), so neither number may
     * be printed with a per-night unit. {@code ClearEvidence} carries no logged-night count, so
     * no per-night average is derivable here — and this family never estimates one.
     */
    @Test
    void testClearText_shouldStateTheSleepDeficitAsAWindowTotalNotAPerNightRate() {
        String text = FlagTraceCopy.clearText(new ClearEvidence("deficit_hours", 0.4, 1.0, null));

        assertThat(text)
            .isEqualTo("Alvásadósság: az ablakban összesen 0,4 óra hiány — a 1,0 órás "
                + "összesített küszöb alatt.");
        assertThat(text).doesNotContain("óra/éjszaka");
    }

    @Test
    void a_non_numeric_clear_carries_its_detail_and_no_fabricated_number() {
        String text = FlagTraceCopy.clearText(new ClearEvidence("trajectory", null, null, "cut"));
        assertThat(text).contains("cut");
        assertThat(FlagTraceCopy.clearFacts(new ClearEvidence("trajectory", null, null, "cut")))
            .hasSize(1);
    }

    @Test
    void a_numeric_clear_adds_a_measured_versus_threshold_evidence_row() {
        assertThat(FlagTraceCopy.clearFacts(new ClearEvidence("deficit_hours", 0.4, 1.0, null)))
            .hasSize(2)
            .last().asString().contains("0,4").contains("1,0");
    }

    @Test
    void an_unknown_metric_falls_back_instead_of_throwing() {
        assertThat(FlagTraceCopy.clearText(new ClearEvidence("round_two_metric", 1.0, 2.0, null)))
            .isNotBlank();
        assertThat(FlagTraceCopy.clearText(null)).isNotBlank();
    }

    @ParameterizedTest
    @EnumSource(UnavailableReason.class)
    void every_unavailable_reason_has_its_own_sentence(UnavailableReason reason) {
        String code = reason.name().toLowerCase();
        assertThat(FlagTraceCopy.unavailableText(code)).as(code).isNotBlank().doesNotContain(code);
    }

    @Test
    void a_suppressed_raise_with_a_frozen_payload_says_when_the_numbers_are_from() {
        String text = FlagTraceCopy.suppressedRaiseText(LocalDate.of(2026, 9, 3));
        assertThat(text).startsWith(FlagTraceCopy.suppressedRaiseText());
        assertThat(text).contains("2026. 09. 03-i");
    }

    @Test
    void the_frozen_numbers_row_dates_the_evidence_and_denies_it_is_todays() {
        String fact = FlagTraceCopy.frozenNumbersFact(LocalDate.of(2026, 1, 9));
        assertThat(fact).contains("2026. 01. 09-i").contains("nem mai mérés");
    }

    @Test
    void the_two_raised_sentences_are_distinct_and_hungarian() {
        assertThat(FlagTraceCopy.raisedText()).isNotBlank()
            .isNotEqualTo(FlagTraceCopy.suppressedRaiseText());
        assertThat(FlagTraceCopy.suppressedRaiseText()).contains("csendben maradt");
    }

    @Test
    void the_read_side_not_evaluated_yet_state_has_a_sentence_too() {
        assertThat(FlagTraceCopy.unavailableText(FlagTraceCopy.NOT_EVALUATED_YET))
            .isNotBlank().doesNotContain("_");
        assertThat(FlagTraceCopy.unavailableText("something_new")).isNotBlank();
    }
}

package io.mrkuhne.mezo.feature.companion.flags.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.flags.service.FlagVerdict.ClearEvidence;
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
    void the_read_side_not_evaluated_yet_state_has_a_sentence_too() {
        assertThat(FlagTraceCopy.unavailableText(FlagTraceCopy.NOT_EVALUATED_YET))
            .isNotBlank().doesNotContain("_");
        assertThat(FlagTraceCopy.unavailableText("something_new")).isNotBlank();
    }
}

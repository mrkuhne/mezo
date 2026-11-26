package io.mrkuhne.mezo.feature.train.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.CoverageDraftDay;
import io.mrkuhne.mezo.feature.train.service.CoverageRules.Day;
import io.mrkuhne.mezo.feature.train.service.CoverageRules.Row;
import java.util.List;
import org.junit.jupiter.api.Test;

/** The proposal's day and slot type (mezo-r36n9.114). */
class CoverageServiceTest {

    private static CoverageDraftDay draft(int index, Integer minutes) {
        return new CoverageDraftDay().dayIndex(index).minutesEstimate(minutes).catalogIds(List.of());
    }

    private static Row row(String muscle, String pattern, String... secondary) {
        return new Row(muscle, pattern, List.of(secondary), "compound");
    }

    @Test
    void pickDay_shouldTakeTheShortestDayTrainingTheGroup() {
        List<CoverageDraftDay> d = List.of(draft(0, 70), draft(3, 45), draft(5, 20));
        List<Day> days = List.of(new Day(0, List.of(row("ham", "hinge"))), new Day(3, List.of(row("ham", "hinge"))),
            new Day(5, List.of(row("chest-mid", "horizontal-push"))));

        assertThat(CoverageService.pickDay(d, days, "ham")).isEqualTo(3);
    }

    @Test
    void pickDay_shouldCountASecondaryOfAKnownPattern() {
        List<CoverageDraftDay> d = List.of(draft(0, 30), draft(2, 60));
        List<Day> days = List.of(new Day(0, List.of(row("quad", "squat"))),
            new Day(2, List.of(row("back-wide", "vertical-pull", "biceps-short"))));

        assertThat(CoverageService.pickDay(d, days, "biceps")).isEqualTo(2);
    }

    @Test
    void pickDay_shouldFallBackToATrainingDay_neverAnEmptyOne() {
        List<CoverageDraftDay> d = List.of(draft(0, 10), draft(2, 60), draft(4, 40));
        List<Day> days = List.of(new Day(0, List.of()), new Day(2, List.of(row("quad", "squat"))),
            new Day(4, List.of(row("chest-mid", "horizontal-push"))));

        assertThat(CoverageService.pickDay(d, days, "ham")).isEqualTo(4);
        assertThat(CoverageService.pickDay(List.of(draft(0, 10)), List.of(new Day(0, List.of())), "ham")).isNull();
    }

    @Test
    void pickDay_shouldSortNullMinutesLast_andBreakTiesByWeekday() {
        List<CoverageDraftDay> d = List.of(draft(1, null), draft(4, 30), draft(2, 30));
        List<Day> days = List.of(new Day(1, List.of(row("ham", "hinge"))), new Day(4, List.of(row("ham", "hinge"))),
            new Day(2, List.of(row("ham", "hinge"))));

        assertThat(CoverageService.pickDay(d, days, "ham")).isEqualTo(2);
    }

    @Test
    void preferredType_shouldBeIsolation_forSingleJointPatterns() {
        for (String p : List.of("knee-flexion", "knee-extension", "raise", "fly", "elbow-flexion", "elbow-extension")) {
            assertThat(CoverageService.preferredType(p)).isEqualTo("isolation");
        }
        for (String p : List.of("hinge", "horizontal-pull", "vertical-pull")) {
            assertThat(CoverageService.preferredType(p)).isEqualTo("compound");
        }
    }
}

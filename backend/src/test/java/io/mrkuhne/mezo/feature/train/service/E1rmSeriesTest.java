package io.mrkuhne.mezo.feature.train.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.train.entity.ExerciseSetEntity;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

/**
 * The strength story curve's contract: one point per session, oldest first, each point that
 * session's best ELIGIBLE e1RM, capped at the newest {@link E1rmSeries#MAX_POINTS}, and a
 * session with nothing eligible omitted entirely (a gap, never a zero).
 */
class E1rmSeriesTest {

    private static final Instant BASE = Instant.parse("2026-01-05T10:00:00Z");

    private static Instant day(int offset) {
        return BASE.plusSeconds(offset * 86_400L);
    }

    private static LocalDate dayDate(int offset) {
        return day(offset).atZone(java.time.ZoneId.systemDefault()).toLocalDate();
    }

    private static ExerciseSetEntity set(String weightKg, Integer reps, Instant doneAt) {
        return set("working", false, weightKg, reps, doneAt);
    }

    private static ExerciseSetEntity set(
        String kind, boolean skipped, String weightKg, Integer reps, Instant doneAt) {
        ExerciseSetEntity s = new ExerciseSetEntity();
        s.setKind(kind);
        s.setSkipped(skipped);
        s.setWeightKg(weightKg == null ? null : new BigDecimal(weightKg));
        s.setReps(reps);
        s.setDoneAt(doneAt);
        return s;
    }

    @Test
    void emptyHistory_yieldsAnEmptySeries() {
        assertThat(E1rmSeries.from(List.of())).isEmpty();
    }

    @Test
    void oneSessionCarriesItsBestEligibleE1rm_atOneDecimal() {
        List<List<ExerciseSetEntity>> sessions = List.of(List.of(
            set("100", 5, day(0)),   // 116.6667
            set("100", 12, day(0)),  // 140.0000 — the best
            set("110", 3, day(0))    // 121.0000
        ));

        List<E1rmSeries.Point> series = E1rmSeries.from(sessions);

        assertThat(series).hasSize(1);
        assertThat(series.get(0).date()).isEqualTo(dayDate(0));
        assertThat(series.get(0).e1rm()).isEqualByComparingTo("140.0");
    }

    @Test
    void sessionsComeOutOldestFirst_whateverTheInputOrder() {
        List<List<ExerciseSetEntity>> sessions = List.of(
            List.of(set("120", 5, day(10))),
            List.of(set("100", 5, day(0))),
            List.of(set("110", 5, day(5))));

        List<E1rmSeries.Point> series = E1rmSeries.from(sessions);

        assertThat(series).extracting(E1rmSeries.Point::date)
            .containsExactly(dayDate(0), dayDate(5), dayDate(10));
        assertThat(series).extracting(p -> p.e1rm().stripTrailingZeros().toPlainString())
            .containsExactly("116.7", "128.3", "140");
    }

    @Test
    void theCapKeepsTheNewestPoints_whenHistoryIsLonger() {
        List<List<ExerciseSetEntity>> sessions = new ArrayList<>();
        for (int i = 0; i < E1rmSeries.MAX_POINTS + 8; i++) {
            sessions.add(List.of(set(String.valueOf(100 + i), 1, day(i))));
        }

        List<E1rmSeries.Point> series = E1rmSeries.from(sessions);

        assertThat(series).hasSize(E1rmSeries.MAX_POINTS);
        // the 8 oldest sessions (offsets 0..7) are dropped, the newest survive, still oldest-first
        assertThat(series.get(0).date()).isEqualTo(dayDate(8));
        assertThat(series.get(series.size() - 1).date())
            .isEqualTo(dayDate(E1rmSeries.MAX_POINTS + 7));
    }

    @Test
    void aSessionWithNoEligibleSet_isOmittedEntirely_neverZeroed() {
        List<List<ExerciseSetEntity>> sessions = List.of(
            List.of(set("100", 5, day(0))),
            List.of(set("60", 20, day(1)), set("55", 15, day(1))), // all above REP_CAP
            List.of(set("105", 5, day(2))));

        List<E1rmSeries.Point> series = E1rmSeries.from(sessions);

        assertThat(series).hasSize(2);
        assertThat(series).extracting(E1rmSeries.Point::date)
            .containsExactly(dayDate(0), dayDate(2));
        assertThat(series).noneMatch(p -> p.e1rm().signum() == 0);
    }

    @Test
    void repsAboveTheCapAreIgnored_withinAnOtherwiseEligibleSession() {
        List<List<ExerciseSetEntity>> sessions = List.of(List.of(
            set("80", 20, day(0)),  // would be the biggest Epley number — but ineligible
            set("100", 5, day(0))));

        List<E1rmSeries.Point> series = E1rmSeries.from(sessions);

        assertThat(series).hasSize(1);
        assertThat(series.get(0).e1rm()).isEqualByComparingTo("116.7"); // 100 × 35/30
    }

    @Test
    void warmupAndSkippedSetsAreExcluded() {
        List<List<ExerciseSetEntity>> sessions = List.of(
            List.of(
                set("warmup", false, "200", 5, day(0)),  // heavier, but a warmup
                set("working", true, "180", 5, day(0)),  // heavier, but skipped
                set("working", false, "100", 5, day(0))),
            List.of(
                set("warmup", false, "200", 5, day(1)),
                set("working", true, "180", 5, day(1)))); // nothing eligible -> a gap

        List<E1rmSeries.Point> series = E1rmSeries.from(sessions);

        assertThat(series).hasSize(1);
        assertThat(series.get(0).date()).isEqualTo(dayDate(0));
        assertThat(series.get(0).e1rm()).isEqualByComparingTo("116.7");
    }

    @Test
    void aBodyweightSessionIsAGap_notAZero() {
        List<List<ExerciseSetEntity>> sessions = List.of(
            List.of(set(null, 10, day(0)), set(null, 12, day(0))), // no load -> no honest e1RM
            List.of(set("100", 5, day(1))));

        List<E1rmSeries.Point> series = E1rmSeries.from(sessions);

        assertThat(series).hasSize(1);
        assertThat(series.get(0).date()).isEqualTo(dayDate(1));
    }

    @Test
    void aSessionIsDatedByItsLatestContributingSet_andUndatableSetsAreIgnored() {
        ExerciseSetEntity undated = set("300", 1, null); // neither doneAt nor createdAt
        List<List<ExerciseSetEntity>> sessions = List.of(
            List.of(undated, set("100", 5, day(3)), set("100", 4, day(2))));

        List<E1rmSeries.Point> series = E1rmSeries.from(sessions);

        assertThat(series).hasSize(1);
        assertThat(series.get(0).date()).isEqualTo(dayDate(3));
        assertThat(series.get(0).e1rm()).isEqualByComparingTo("116.7"); // the 300 kg row is undatable
    }

    @Test
    void emptySessionGroupsAreIgnored() {
        List<List<ExerciseSetEntity>> sessions = List.of(List.of(), List.of(set("100", 5, day(0))));

        assertThat(E1rmSeries.from(sessions)).hasSize(1);
    }
}

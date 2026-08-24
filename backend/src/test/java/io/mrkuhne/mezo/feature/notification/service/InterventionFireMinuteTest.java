package io.mrkuhne.mezo.feature.notification.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.OptionalInt;
import org.junit.jupiter.api.Test;

/**
 * Pure table coverage for {@link AnchorResolver#interventionFireMinute} (W5.2, bd mezo-b3pp.19) —
 * the DueEvaluator-testability idiom this file's neighbor {@link AnchorResolverExcerptTest} also
 * follows: a plain unit test, no Spring context, for what is a pure function of its five
 * arguments. Every case fixes {@code quietStart=22:00, quietEnd=07:00} (the default, wraps
 * midnight) unless noted; D is an arbitrary day, D+1 the day after.
 */
class InterventionFireMinuteTest {

    private static final LocalTime QUIET_START = LocalTime.of(22, 0);
    private static final LocalTime QUIET_END = LocalTime.of(7, 0);
    private static final LocalDate D = LocalDate.of(2026, 8, 24);
    private static final LocalDate D_PLUS_1 = D.plusDays(1);

    private static LocalDateTime on(LocalDate date, int hour, int minute) {
        return date.atTime(hour, minute);
    }

    @Test
    void testInterventionFireMinute_shouldFireSameDay_whenGeneratedInDaytime() {
        LocalDateTime generatedAt = on(D, 14, 37);

        assertThat(AnchorResolver.interventionFireMinute(generatedAt, D, false, QUIET_START, QUIET_END))
                .hasValue(14 * 60 + 37);
        assertThat(AnchorResolver.interventionFireMinute(generatedAt, D_PLUS_1, false, QUIET_START, QUIET_END))
                .isEqualTo(OptionalInt.empty());
    }

    @Test
    void testInterventionFireMinute_shouldDeferToNextDayQuietEnd_whenGeneratedLateEvening() {
        LocalDateTime generatedAt = on(D, 23, 10);

        assertThat(AnchorResolver.interventionFireMinute(generatedAt, D, false, QUIET_START, QUIET_END))
                .isEqualTo(OptionalInt.empty());
        assertThat(AnchorResolver.interventionFireMinute(generatedAt, D_PLUS_1, false, QUIET_START, QUIET_END))
                .hasValue(7 * 60);
    }

    @Test
    void testInterventionFireMinute_shouldDeferToSameDayQuietEnd_whenGeneratedEarlyMorning() {
        LocalDateTime generatedAt = on(D, 6, 30);

        assertThat(AnchorResolver.interventionFireMinute(generatedAt, D, false, QUIET_START, QUIET_END))
                .hasValue(7 * 60);
        assertThat(AnchorResolver.interventionFireMinute(generatedAt, D_PLUS_1, false, QUIET_START, QUIET_END))
                .isEqualTo(OptionalInt.empty());
    }

    @Test
    void testInterventionFireMinute_shouldTreatQuietStartAsInsideTheWindow_atTheExactBoundary() {
        LocalDateTime generatedAt = on(D, 22, 0);

        assertThat(AnchorResolver.interventionFireMinute(generatedAt, D_PLUS_1, false, QUIET_START, QUIET_END))
                .hasValue(7 * 60);
    }

    @Test
    void testInterventionFireMinute_shouldTreatQuietEndAsOutsideTheWindow_atTheExactBoundary() {
        LocalDateTime generatedAt = on(D, 7, 0);

        assertThat(AnchorResolver.interventionFireMinute(generatedAt, D, false, QUIET_START, QUIET_END))
                .hasValue(7 * 60);
    }

    @Test
    void testInterventionFireMinute_shouldFireImmediately_whenExempt() {
        LocalDateTime generatedAt = on(D, 23, 10);

        assertThat(AnchorResolver.interventionFireMinute(generatedAt, D, true, QUIET_START, QUIET_END))
                .hasValue(23 * 60 + 10);
    }

    @Test
    void testInterventionFireMinute_shouldNeverDefer_whenStartEqualsEnd() {
        LocalTime noQuietHours = LocalTime.of(7, 0);
        LocalDateTime generatedAt = on(D, 23, 10);

        assertThat(AnchorResolver.interventionFireMinute(generatedAt, D, false, noQuietHours, noQuietHours))
                .hasValue(23 * 60 + 10);
    }
}

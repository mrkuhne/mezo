package io.mrkuhne.mezo.feature.companion.reflection;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

import io.mrkuhne.mezo.feature.companion.entity.PatternEventEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEventPayloadEnvelope;
import io.mrkuhne.mezo.feature.companion.reflection.config.ReflectionProperties;
import io.mrkuhne.mezo.feature.companion.reflection.service.ObservationBudget;
import io.mrkuhne.mezo.feature.companion.repository.PatternEventRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

/**
 * Reflexió S4 (mezo-eq85.4) Step 2: {@link ObservationBudget} guards {@code notice.maxPerDay},
 * {@code notice.minGapHours} and the quiet-hours window from {@link ReflectionProperties.Notice}.
 * Stubbed {@link PatternEventRepository} — no DB, per the brief.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ObservationBudgetTest {

    private static final UUID USER_ID = UUID.randomUUID();
    private static final ZoneId ZONE = ZoneId.systemDefault();
    /** Midday — clear of the 22:00-07:00 default quiet window in every test that isn't ABOUT it. */
    private static final Instant NOON = LocalDate.of(2026, 9, 7).atTime(12, 0).atZone(ZONE).toInstant();

    @Mock
    private PatternEventRepository patternEventRepository;

    @Test
    void allows_whenUnderCapAndGapElapsedAndNotQuiet() {
        stubSurfacedEvents(List.of(NOON.minus(5, ChronoUnit.HOURS)));
        ObservationBudget budget = budget(notice(2, 4, "22:00", "07:00"));

        assertThat(budget.allows(USER_ID, NOON)).isTrue();
    }

    @Test
    void disallows_whenAtDailyCap() {
        stubSurfacedEvents(List.of(NOON.minus(6, ChronoUnit.HOURS), NOON.minus(5, ChronoUnit.HOURS)));
        ObservationBudget budget = budget(notice(2, 4, "22:00", "07:00"));

        assertThat(budget.allows(USER_ID, NOON)).isFalse();
    }

    @Test
    void disallows_whenMinGapNotElapsed() {
        stubSurfacedEvents(List.of(NOON.minus(1, ChronoUnit.HOURS)));
        ObservationBudget budget = budget(notice(2, 4, "22:00", "07:00"));

        assertThat(budget.allows(USER_ID, NOON)).isFalse();
    }

    @Test
    void ignoresUnsurfacedEvents_forBothCapAndGap() {
        PatternEventEntity unsurfaced = event(NOON.minus(10, ChronoUnit.MINUTES), false);
        when(patternEventRepository.findByCreatedByAndKindAndOccurredAtAfterAndDeletedFalse(
                eq(USER_ID), eq(PatternEventEntity.KIND_OBSERVATION), any(Instant.class)))
                .thenReturn(List.of(unsurfaced));
        ObservationBudget budget = budget(notice(2, 4, "22:00", "07:00"));

        assertThat(budget.allows(USER_ID, NOON)).isTrue();
        assertThat(budget.remainingToday(USER_ID, NOON)).isEqualTo(2);
    }

    @Test
    void disallows_duringQuietHoursWrappingMidnight() {
        stubSurfacedEvents(List.of());
        ObservationBudget budget = budget(notice(2, 0, "22:00", "07:00"));

        Instant lateNight = LocalDate.of(2026, 9, 7).atTime(23, 0).atZone(ZONE).toInstant();
        Instant earlyMorning = LocalDate.of(2026, 9, 7).atTime(3, 0).atZone(ZONE).toInstant();
        Instant daytime = LocalDate.of(2026, 9, 7).atTime(12, 0).atZone(ZONE).toInstant();

        assertThat(budget.allows(USER_ID, lateNight)).as("22:00 quiet start (inclusive)").isFalse();
        assertThat(budget.allows(USER_ID, earlyMorning)).as("inside the wrapped window").isFalse();
        assertThat(budget.allows(USER_ID, daytime)).as("outside the window").isTrue();
    }

    @Test
    void allows_exactlyAtQuietEnd_becauseItIsExclusive() {
        stubSurfacedEvents(List.of());
        ObservationBudget budget = budget(notice(2, 0, "22:00", "07:00"));

        Instant quietEnd = LocalDate.of(2026, 9, 7).atTime(7, 0).atZone(ZONE).toInstant();
        assertThat(budget.allows(USER_ID, quietEnd)).isTrue();
    }

    @Test
    void remainingToday_isMaxPerDayMinusSurfacedCount_neverNegative() {
        stubSurfacedEvents(List.of(NOON.minus(6, ChronoUnit.HOURS), NOON.minus(5, ChronoUnit.HOURS)));
        ObservationBudget budget = budget(notice(1, 0, "22:00", "07:00"));

        assertThat(budget.remainingToday(USER_ID, NOON)).isZero();
    }

    private void stubSurfacedEvents(List<Instant> occurredAts) {
        List<PatternEventEntity> events = occurredAts.stream().map(at -> event(at, true)).toList();
        when(patternEventRepository.findByCreatedByAndKindAndOccurredAtAfterAndDeletedFalse(
                eq(USER_ID), eq(PatternEventEntity.KIND_OBSERVATION), any(Instant.class)))
                .thenReturn(events);
    }

    private PatternEventEntity event(Instant occurredAt, boolean surfaced) {
        PatternEventEntity event = new PatternEventEntity();
        event.setId(UUID.randomUUID());
        event.setPatternId(UUID.randomUUID());
        event.setKind(PatternEventEntity.KIND_OBSERVATION);
        event.setOccurredAt(occurredAt);
        event.setPayload(PatternEventPayloadEnvelope.observation("text", List.of(), surfaced));
        return event;
    }

    private ObservationBudget budget(ReflectionProperties.Notice notice) {
        ReflectionProperties properties = new ReflectionProperties(
                true, "0 40 3 * * *", 7, notice,
                new ReflectionProperties.Propose(2),
                new ReflectionProperties.Lifecycle(3, 3, 30, 0.3, 0.15));
        return new ObservationBudget(patternEventRepository, properties);
    }

    private ReflectionProperties.Notice notice(int maxPerDay, int minGapHours, String quietFrom, String quietTo) {
        // `pushEnabled` is the push switch (silent launch, mezo-eq85.4) — the budget never reads it
        return new ReflectionProperties.Notice(
                true, maxPerDay, minGapHours, LocalTime.parse(quietFrom), LocalTime.parse(quietTo));
    }
}

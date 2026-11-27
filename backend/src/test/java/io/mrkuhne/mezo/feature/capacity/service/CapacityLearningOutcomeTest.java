package io.mrkuhne.mezo.feature.capacity.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.mrkuhne.mezo.feature.capacity.entity.CapacityProposalEntity;
import io.mrkuhne.mezo.feature.capacity.repository.CalendarEventScoreRepository;
import io.mrkuhne.mezo.feature.capacity.service.CapacityPatterns.MoveFact;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** Boop B7 K4 review minors (mezo-r36n9.17): pending nights, the bounded move window, the job's clock. */
class CapacityLearningOutcomeTest {

    static final LocalDate TODAY = LocalDate.of(2026, 11, 27);

    static CapacityProposalEntity proposal(LocalDate day, String status, String kind, Map<String, Object> outcome) {
        CapacityProposalEntity p = new CapacityProposalEntity();
        p.setDay(day);
        p.setStatus(status);
        p.setKind(kind);
        p.setOutcome(outcome);
        return p;
    }

    /** A partial sleep row synced before 03:30 must not judge yesterday's move: the night is still pending. */
    @Test
    void partialNightStaysPendingAndDoesNotSpoilGood() {
        CapacityProposalEntity p = proposal(TODAY.minusDays(1), "accepted", "SHIFT_BEDTIME", null);
        Map<String, Object> o = CapacityLearningService.outcome(p, List.of(TODAY.minusDays(1)), null, Map.of(), null,
            200, 480, TODAY);
        assertThat(o).containsEntry("sleepPending", true).containsEntry("good", true);

        // the night after is behind him → judged with the sleep it got
        Map<String, Object> later = CapacityLearningService.outcome(p, List.of(TODAY.minusDays(1)), null, Map.of(),
            null, 200, 480, TODAY.plusDays(1));
        assertThat(later).containsEntry("sleepPending", false).containsEntry("good", false);
    }

    /** The move-kind patterns read only the pattern window's settled accepted moves. */
    @Test
    void moveFactsAreBoundedAndSkipPendingOutcomes() {
        LocalDate from = TODAY.minusDays(CapacityLearningService.PATTERN_WINDOW_DAYS);
        List<MoveFact> facts = CapacityLearningService.moveFacts(List.of(
            proposal(TODAY.minusDays(3), "accepted", "MOVE_SESSION_DAY", Map.of("good", true, "sleepPending", false)),
            proposal(TODAY.minusDays(1), "accepted", "MOVE_SESSION_DAY", Map.of("good", false, "sleepPending", true)),
            proposal(from.minusDays(1), "accepted", "MOVE_SESSION_DAY", Map.of("good", false, "sleepPending", false)),
            proposal(TODAY.minusDays(4), "declined", "MOVE_SESSION_DAY", Map.of("good", false, "sleepPending", false)),
            proposal(TODAY.minusDays(5), "accepted", "MOVE_SESSION_DAY", null)), from);
        assertThat(facts).containsExactly(new MoveFact("MOVE_SESSION_DAY", true));
    }

    /** The nightly job asks for scored owners against the service clock, not the wall clock. */
    @Test
    void outcomeJobUsesTheServiceClock() {
        CapacityLearningService learning = mock(CapacityLearningService.class);
        CalendarEventScoreRepository scores = mock(CalendarEventScoreRepository.class);
        Instant fixed = Instant.parse("2020-03-04T02:30:00Z");
        when(learning.now()).thenReturn(fixed);
        when(learning.today()).thenReturn(LocalDate.of(2020, 3, 4));
        when(scores.ownersSince(any())).thenReturn(List.of());
        when(learning.owners(any(), any())).thenReturn(List.of());

        new OutcomeJob(learning, scores).run();

        verify(scores).ownersSince(fixed.minus(OutcomeJob.SCORED_OWNER_DAYS, ChronoUnit.DAYS));
    }
}

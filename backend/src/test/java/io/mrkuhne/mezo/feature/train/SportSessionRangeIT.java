package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.api.dto.SportSessionResponse;
import io.mrkuhne.mezo.feature.train.config.TrainProperties;
import io.mrkuhne.mezo.feature.train.service.TrainService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

/**
 * The optional inclusive {@code from}/{@code to} window on the sport-session log
 * (mezo-d20.7.1 — the Sport Napló 4-week idő+RPE trend). Pins that the no-param read is
 * unchanged, that a multi-week window filters on both ends, that the bounds are validated,
 * and that every branch stays ownership-scoped.
 */
@Transactional
class SportSessionRangeIT extends AbstractIntegrationTest {

    private static final LocalDate ANCHOR = LocalDate.of(2026, 3, 15); // fixed — no "today" drift

    @Autowired private TrainService trainService;
    @Autowired private TrainPopulator trainPopulator;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private TrainProperties trainProperties;

    /** Sessions on the anchor and 7/21/60 days before it — spans well past a 4-week window. */
    private UUID seedFourSessions(String email) {
        UUID user = databasePopulator.populateUser(email);
        trainPopulator.createSportSession(user, ANCHOR);
        trainPopulator.createSportSession(user, ANCHOR.minusDays(7));
        trainPopulator.createSportSession(user, ANCHOR.minusDays(21));
        trainPopulator.createSportSession(user, ANCHOR.minusDays(60));
        return user;
    }

    private static List<LocalDate> datesOf(List<SportSessionResponse> sessions) {
        return sessions.stream().map(SportSessionResponse::getDate).toList();
    }

    @Test
    void testListSportSessions_shouldReturnWholeLogNewestFirst_whenNoBoundsGiven() {
        UUID user = seedFourSessions("sport-range-default@test.local");

        List<SportSessionResponse> all = trainService.listSportSessions(user, null, null);

        assertThat(datesOf(all)).containsExactly(
            ANCHOR, ANCHOR.minusDays(7), ANCHOR.minusDays(21), ANCHOR.minusDays(60));
    }

    @Test
    void testListSportSessions_shouldKeepOnlyTheWindow_whenRangeSpansFourWeeks() {
        UUID user = seedFourSessions("sport-range-window@test.local");

        List<SportSessionResponse> window =
            trainService.listSportSessions(user, ANCHOR.minusDays(27), ANCHOR);

        // The 60-days-ago session falls outside; both inclusive bounds are kept.
        assertThat(datesOf(window)).containsExactly(
            ANCHOR, ANCHOR.minusDays(7), ANCHOR.minusDays(21));
    }

    @Test
    void testListSportSessions_shouldIncludeBothBounds_whenRangeIsASingleDay() {
        UUID user = seedFourSessions("sport-range-single-day@test.local");

        assertThat(datesOf(trainService.listSportSessions(user, ANCHOR, ANCHOR)))
            .containsExactly(ANCHOR);
    }

    @Test
    void testListSportSessions_shouldStayUnboundedOnTheOtherSide_whenOnlyOneBoundGiven() {
        UUID user = seedFourSessions("sport-range-open-ended@test.local");

        assertThat(datesOf(trainService.listSportSessions(user, ANCHOR.minusDays(21), null)))
            .containsExactly(ANCHOR, ANCHOR.minusDays(7), ANCHOR.minusDays(21));
        assertThat(datesOf(trainService.listSportSessions(user, null, ANCHOR.minusDays(21))))
            .containsExactly(ANCHOR.minusDays(21), ANCHOR.minusDays(60));
    }

    @Test
    void testListSportSessions_shouldThrowInvalidDateRange_whenFromIsAfterTo() {
        UUID user = seedFourSessions("sport-range-reversed@test.local");

        assertThatThrownBy(() -> trainService.listSportSessions(user, ANCHOR, ANCHOR.minusDays(1)))
            .isInstanceOf(SystemRuntimeErrorException.class)
            .satisfies(e -> assertThat(((SystemRuntimeErrorException) e).getMessages())
                .singleElement()
                .satisfies(m -> assertThat(m.getCode()).isEqualTo("TRAIN_INVALID_DATE_RANGE")));
    }

    @Test
    void testListSportSessions_shouldThrowRangeTooWide_whenSpanExceedsTheConfiguredMax() {
        UUID user = seedFourSessions("sport-range-too-wide@test.local");
        LocalDate from = ANCHOR.minusDays(trainProperties.sportSessionMaxSpanDays()); // span = max + 1

        assertThatThrownBy(() -> trainService.listSportSessions(user, from, ANCHOR))
            .isInstanceOf(SystemRuntimeErrorException.class)
            .satisfies(e -> assertThat(((SystemRuntimeErrorException) e).getMessages())
                .singleElement()
                .satisfies(m -> assertThat(m.getCode()).isEqualTo("TRAIN_DATE_RANGE_TOO_WIDE")));

        // The widest still-accepted window is exactly max days, inclusive.
        assertThat(trainService.listSportSessions(user, from.plusDays(1), ANCHOR)).isNotEmpty();
    }

    @Test
    void testListSportSessions_shouldNeverLeakAnotherUsersLog_whenRangeOverlaps() {
        UUID owner = seedFourSessions("sport-range-owner@test.local");
        UUID intruder = databasePopulator.populateUser("sport-range-intruder@test.local");
        trainPopulator.createSportSession(intruder, ANCHOR);
        trainPopulator.createSportSession(intruder, ANCHOR.minusDays(7));

        assertThat(trainService.listSportSessions(intruder, ANCHOR.minusDays(27), ANCHOR)).hasSize(2);
        assertThat(trainService.listSportSessions(owner, ANCHOR.minusDays(27), ANCHOR)).hasSize(3);
        assertThat(trainService.listSportSessions(intruder, null, null)).hasSize(2);
    }
}

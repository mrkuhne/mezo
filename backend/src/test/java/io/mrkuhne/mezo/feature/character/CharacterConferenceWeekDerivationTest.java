package io.mrkuhne.mezo.feature.character;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.character.service.CharacterConferenceJob;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;

/**
 * Pins {@link CharacterConferenceJob#latestWeekStart(LocalDate)} against hardcoded dates
 * (mezo-1gim.5): the IT re-derives the target week with the SAME expression the job uses, which
 * proves idempotency/row-existence but is tautological about the formula itself — a shared bug
 * (e.g. {@code minusDays(7)} instead of {@code minusDays(6)}) would stay green there while the
 * deployed Sunday cron targeted the wrong ISO week. This plain, Spring-free test pins the
 * DIRECTION of "Sunday targets the week that is ending" against fixed expectations instead.
 */
class CharacterConferenceWeekDerivationTest {

    @Test
    void latestWeekStart_sunday_targetsTheWeekThatIsEnding() {
        assertThat(CharacterConferenceJob.latestWeekStart(LocalDate.of(2026, 9, 6)))
                .isEqualTo(LocalDate.of(2026, 8, 31));
    }

    @Test
    void latestWeekStart_monday_targetsThePreviousFinishedWeek() {
        assertThat(CharacterConferenceJob.latestWeekStart(LocalDate.of(2026, 8, 31)))
                .isEqualTo(LocalDate.of(2026, 8, 24));
    }

    @Test
    void latestWeekStart_midWeekThursday_targetsThePreviousFinishedWeek() {
        assertThat(CharacterConferenceJob.latestWeekStart(LocalDate.of(2026, 9, 3)))
                .isEqualTo(LocalDate.of(2026, 8, 24));
    }

    @Test
    void latestWeekStart_saturday_targetsThePreviousFinishedWeek() {
        assertThat(CharacterConferenceJob.latestWeekStart(LocalDate.of(2026, 9, 5)))
                .isEqualTo(LocalDate.of(2026, 8, 24));
    }
}

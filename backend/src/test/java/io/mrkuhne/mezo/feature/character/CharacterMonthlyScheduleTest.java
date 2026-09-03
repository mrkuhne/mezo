package io.mrkuhne.mezo.feature.character;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.character.service.CharacterMonthlyJob;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;

/**
 * Pins {@link CharacterMonthlyJob#isDeepReadDay(LocalDate)} against hardcoded dates (Karakter S4,
 * mezo-1gim.6): Spring's cron day-of-month + day-of-week fields are OR'd (not AND'ed) when both
 * are restricted, so a cron expression alone cannot reliably express "the month's FIRST Sunday" —
 * hence the plain Sunday cron plus this code-level guard. This plain, Spring-free test pins the
 * guard's own logic against fixed expectations, independent of the cron string in application.yml.
 */
class CharacterMonthlyScheduleTest {

    @Test
    void isDeepReadDay_firstSundayOfMonth_isTrue() {
        assertThat(CharacterMonthlyJob.isDeepReadDay(LocalDate.of(2026, 9, 6))).isTrue();
    }

    @Test
    void isDeepReadDay_secondSundayOfMonth_isFalse() {
        assertThat(CharacterMonthlyJob.isDeepReadDay(LocalDate.of(2026, 9, 13))).isFalse();
    }

    @Test
    void isDeepReadDay_mondayInFirstWeek_isFalse() {
        assertThat(CharacterMonthlyJob.isDeepReadDay(LocalDate.of(2026, 9, 7))).isFalse();
    }

    @Test
    void isDeepReadDay_firstSundayOfOctober_isTrue() {
        assertThat(CharacterMonthlyJob.isDeepReadDay(LocalDate.of(2026, 10, 4))).isTrue();
    }

    @Test
    void isDeepReadDay_firstSundayIsTheFirstOfTheMonth_isTrue() {
        assertThat(CharacterMonthlyJob.isDeepReadDay(LocalDate.of(2026, 11, 1))).isTrue();
    }
}

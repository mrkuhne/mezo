package io.mrkuhne.mezo.feature.penz.service.engine;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/** Mirrors the old app's {@code src/domain/recurrence.test.ts} 1:1 (7 cases). */
class PenzRecurrenceTest {

    private static LocalDate d(String s) {
        return LocalDate.parse(s);
    }

    private static List<LocalDate> ds(String... s) {
        return java.util.Arrays.stream(s).map(LocalDate::parse).toList();
    }

    private static RecurringRuleInput rule(Frequency f, String start, String end, String lastMat, boolean active) {
        return new RecurringRuleInput(UUID.nameUUIDFromBytes("r1".getBytes()), RuleKind.EXPENSE, 1000, f,
            d(start), end == null ? null : d(end), lastMat == null ? null : d(lastMat), active);
    }

    private static RecurringRuleInput rule(Frequency f, String start) {
        return rule(f, start, null, null, true);
    }

    // recurrence.test.ts > occurrencesInRange > clamps monthly to month end
    @Test
    void clampsMonthlyToMonthEnd() {
        assertThat(Recurrence.occurrencesInRange(rule(Frequency.MONTHLY, "2026-01-31"), d("2026-02-01"), d("2026-04-30")))
            .isEqualTo(ds("2026-02-28", "2026-03-31", "2026-04-30"));
    }

    // recurrence.test.ts > occurrencesInRange > weekly
    @Test
    void weekly() {
        assertThat(Recurrence.occurrencesInRange(rule(Frequency.WEEKLY, "2026-11-02"), d("2026-11-01"), d("2026-11-30")))
            .isEqualTo(ds("2026-11-02", "2026-11-09", "2026-11-16", "2026-11-23", "2026-11-30"));
    }

    // recurrence.test.ts > occurrencesInRange > yearly leap
    @Test
    void yearlyLeap() {
        assertThat(Recurrence.occurrencesInRange(rule(Frequency.YEARLY, "2024-02-29"), d("2025-01-01"), d("2025-12-31")))
            .isEqualTo(ds("2025-02-28"));
    }

    // recurrence.test.ts > occurrencesInRange > respects start and end
    @Test
    void respectsStartAndEnd() {
        assertThat(Recurrence.occurrencesInRange(rule(Frequency.MONTHLY, "2026-12-10"), d("2026-11-01"), d("2026-11-30")))
            .isEmpty();
        assertThat(Recurrence.occurrencesInRange(rule(Frequency.MONTHLY, "2026-01-10", "2026-03-10", null, true),
            d("2026-01-01"), d("2026-12-31")))
            .isEqualTo(ds("2026-01-10", "2026-02-10", "2026-03-10"));
    }

    // recurrence.test.ts > dueOccurrences > catches up
    @Test
    void dueCatchesUp() {
        assertThat(Recurrence.dueOccurrences(rule(Frequency.MONTHLY, "2026-09-10"), d("2026-11-12")))
            .isEqualTo(ds("2026-09-10", "2026-10-10", "2026-11-10"));
    }

    // recurrence.test.ts > dueOccurrences > is bounded by last_materialized_date
    @Test
    void dueIsBoundedByLastMaterializedDate() {
        assertThat(Recurrence.dueOccurrences(rule(Frequency.MONTHLY, "2026-09-10", null, "2026-11-10", true), d("2026-11-12")))
            .isEmpty();
    }

    // recurrence.test.ts > dueOccurrences > ignores inactive
    @Test
    void dueIgnoresInactive() {
        assertThat(Recurrence.dueOccurrences(rule(Frequency.MONTHLY, "2026-09-10", null, null, false), d("2026-11-12")))
            .isEmpty();
    }
}

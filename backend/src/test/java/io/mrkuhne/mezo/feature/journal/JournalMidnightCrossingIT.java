package io.mrkuhne.mezo.feature.journal;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.CreateJournalEntryRequest;
import io.mrkuhne.mezo.api.dto.JournalEntryResponse;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.journal.entity.JournalEntryEntity;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.JournalPopulator;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.TimeZone;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;

/**
 * The executable proof for the "double now" instability class (bd mezo-pk63): it makes a midnight
 * fall BETWEEN a test's two clock reads on demand, and pins both halves of the fix pattern against
 * it. This is the repo's reproduction — without it the pattern's correctness would only be arguable
 * from a PR body, and the ordinary suite (which almost never spans a real midnight) cannot show it.
 *
 * <p><b>How the crossing is forced.</b> {@code LocalDate.now()} resolves {@code
 * TimeZone.getDefault()} on EVERY call, so moving the JVM default zone forward by 60 seconds while
 * local wall time sits at 23:59:30 advances "now" past midnight without touching the server's clock
 * (spec §5: no {@code Clock} bean). Each test first asserts that the crossing really happened —
 * otherwise the assertions after it would be vacuously green.
 *
 * <p>Both tests then assert the SAME contrast: the naive form (comparing against a second, later
 * {@code LocalDate.now()}) is wrong here, and the pattern the 15 amended ITs adopted is right.
 */
class JournalMidnightCrossingIT extends ApiIntegrationTest {

    /** Local wall time to hold just before the simulated rollover, and the shift that crosses it. */
    private static final LocalTime JUST_BEFORE_MIDNIGHT = LocalTime.of(23, 59, 30);
    private static final int CROSSING_SHIFT_SECONDS = 60;

    @Autowired private JournalPopulator journalPopulator;
    @Autowired private OwnerProperties ownerProperties;

    private final TimeZone originalZone = TimeZone.getDefault();

    @AfterEach
    void restoreDefaultZone() {
        TimeZone.setDefault(originalZone);
    }

    /** The offset that puts the JVM's default-zone wall clock at {@code JUST_BEFORE_MIDNIGHT}. */
    private static int offsetJustBeforeMidnight() {
        int offset = JUST_BEFORE_MIDNIGHT.toSecondOfDay() - LocalTime.now(ZoneOffset.UTC).toSecondOfDay();
        if (offset < -18 * 3600) {
            offset += 24 * 3600;
        }
        if (offset > 18 * 3600) {
            offset -= 24 * 3600;
        }
        return offset;
    }

    private static void setDefaultZone(int offsetSeconds) {
        TimeZone.setDefault(TimeZone.getTimeZone(ZoneOffset.ofTotalSeconds(offsetSeconds)));
    }

    @Test
    void testCreateJournalEntry_shouldStillMatchTheCapturedDay_whenMidnightFallsBetweenTheTwoReads() {
        int base = offsetJustBeforeMidnight();
        setDefaultZone(base);

        LocalDate dayBefore = LocalDate.now();
        JournalEntryResponse created = postForBody("/api/journal",
            CreateJournalEntryRequest.builder().text("Éjfélen írva.").source("quickinput").build(),
            ownerAuthHeaders(), HttpStatus.CREATED, JournalEntryResponse.class);
        setDefaultZone(base + CROSSING_SHIFT_SECONDS);
        LocalDate dayAfter = LocalDate.now();

        // the crossing really happened — everything below is vacuous without this
        assertThat(dayAfter).isEqualTo(dayBefore.plusDays(1));
        // THE BUG: a second, independent read names tomorrow, so `isEqualTo(LocalDate.now())` breaks
        assertThat(created.getOccurredOn()).isNotEqualTo(dayAfter);
        // THE FIX: the server-stamped day is always one of the two days bracketing the call
        assertThat(created.getOccurredOn()).isIn(dayBefore, dayAfter);
    }

    @Test
    void testListJournalEntries_shouldStillCoverTheSeededDay_whenMidnightFallsBetweenTheTwoReads() {
        UUID owner = databasePopulator.populateUser(ownerProperties.ownerEmail());
        int base = offsetJustBeforeMidnight();
        setDefaultZone(base);

        LocalDate today = LocalDate.now(); // the pattern's degenerate case: read ONCE, reuse
        JournalEntryEntity entry = journalPopulator.createEntry(owner, today,
            "Éjfél előtt rögzítve.", JournalEntryEntity.SOURCE_QUICKINPUT);
        setDefaultZone(base + CROSSING_SHIFT_SECONDS);
        LocalDate reReadToday = LocalDate.now();

        // the crossing really happened — everything below is vacuous without this
        assertThat(reReadToday).isEqualTo(today.plusDays(1));
        // THE FIX: the hoisted day still selects the row it seeded
        assertThat(entriesBetween(today, today)).extracting(JournalEntryResponse::getId)
            .contains(entry.getId());
        // THE BUG: a window built from a SECOND read misses the row entirely
        assertThat(entriesBetween(reReadToday, reReadToday)).extracting(JournalEntryResponse::getId)
            .doesNotContain(entry.getId());
    }

    private List<JournalEntryResponse> entriesBetween(LocalDate from, LocalDate to) {
        return getForList("/api/journal?from=" + from + "&to=" + to, ownerAuthHeaders(),
            HttpStatus.OK, JournalEntryResponse.class);
    }
}

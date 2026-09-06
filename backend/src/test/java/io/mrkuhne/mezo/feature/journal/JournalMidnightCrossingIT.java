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
 * TimeZone.getDefault()} on EVERY call, so moving the JVM default zone forward by 10 minutes while
 * local wall time sits at 23:55:00 advances "now" past midnight without touching the server's clock
 * (spec §5: no {@code Clock} bean). Each test first asserts that the crossing really happened —
 * otherwise the assertions after it would be vacuously green.
 *
 * <p>Both tests then assert the SAME contrast: the naive form (comparing against a second, later
 * {@code LocalDate.now()}) is wrong here, and the pattern the 15 amended ITs adopted is right.
 */
class JournalMidnightCrossingIT extends ApiIntegrationTest {

    /**
     * Local wall time to hold just before the simulated rollover, and the shift that crosses it.
     *
     * <p>Parked 5 minutes shy of midnight rather than seconds away: the real wall clock keeps
     * advancing under the synthetic offset too, so a slow first request (cold Spring context) could
     * otherwise cross midnight on its own before the test explicitly shifts the zone, making the
     * later "did it really cross" assertion false for the wrong reason. A multi-minute margin costs
     * nothing here — the crossing is forced by re-pinning the offset, never by waiting for it.
     */
    private static final LocalTime JUST_BEFORE_MIDNIGHT = LocalTime.of(23, 55, 0);

    /** Package-private (not {@code private}): shared with {@code JournalMidnightCrossingOffsetArithmeticTest}. */
    static final int CROSSING_SHIFT_SECONDS = 10 * 60;

    @Autowired private JournalPopulator journalPopulator;
    @Autowired private OwnerProperties ownerProperties;

    private final TimeZone originalZone = TimeZone.getDefault();

    @AfterEach
    void restoreDefaultZone() {
        TimeZone.setDefault(originalZone);
    }

    /** The offset that puts the JVM's default-zone wall clock at {@code JUST_BEFORE_MIDNIGHT}. */
    private static int offsetJustBeforeMidnight() {
        return computeParkedOffset(LocalTime.now(ZoneOffset.UTC).toSecondOfDay());
    }

    /**
     * Pure arithmetic core of {@link #offsetJustBeforeMidnight()}, split out so
     * {@code JournalMidnightCrossingOffsetArithmeticTest} can drive it with all 86400 possible UTC
     * seconds-of-day instead of only whichever single second the wall clock happens to read.
     */
    static int computeParkedOffset(int utcNowSecondOfDay) {
        int offset = JUST_BEFORE_MIDNIGHT.toSecondOfDay() - utcNowSecondOfDay;
        return wrapParkedOffset(offset);
    }

    /**
     * {@code ZoneOffset} only supports ±18h ({@code ±64800s}); wraps by a day either way so any
     * offset value resolves instead of throwing {@code DateTimeException}.
     *
     * <p>Only {@link #setDefaultZone(int)} calls this now, for the already-shifted value, which is
     * in range by construction (see {@link #wrapParkedOffset(int)}) so this branch never actually
     * fires there — it stays as a defensive clamp rather than being removed.
     */
    private static int wrapToValidOffset(int offsetSeconds) {
        if (offsetSeconds < -18 * 3600) {
            offsetSeconds += 24 * 3600;
        }
        if (offsetSeconds > 18 * 3600) {
            offsetSeconds -= 24 * 3600;
        }
        return offsetSeconds;
    }

    /**
     * Wraps the raw parked offset the same way {@link #wrapToValidOffset} does, EXCEPT the top
     * threshold is {@code 64800 - CROSSING_SHIFT_SECONDS}, not {@code 64800}. That guarantees
     * {@code parked + CROSSING_SHIFT_SECONDS} lands at {@code 64800} at most — never past it — so
     * the shifted call in {@link #setDefaultZone(int)} never itself needs the upper wrap.
     *
     * <p>That distinction is the fix. Wrapping the SHIFTED value (subtracting 86400 once it
     * exceeds 64800) preserves local time-of-day but rewinds the local DATE by one day, silently
     * cancelling the very midnight crossing this test exists to force. Fix round 2 hit exactly
     * this: widening the shift to 600s meant any parked offset in {@code (64200, 64800]} pushed
     * {@code base + shift} past 64800 into that cancelling wrap — a 10-minute-wide window of UTC
     * "now" (05:55:00–06:05:00) where the test failed every day. Wrapping the park point 600s
     * earlier removes that window instead of merely shrinking it; see
     * {@code JournalMidnightCrossingOffsetArithmeticTest} for the exhaustive proof.
     */
    static int wrapParkedOffset(int offsetSeconds) {
        if (offsetSeconds < -18 * 3600) {
            offsetSeconds += 24 * 3600;
        }
        if (offsetSeconds > 18 * 3600 - CROSSING_SHIFT_SECONDS) {
            offsetSeconds -= 24 * 3600;
        }
        return offsetSeconds;
    }

    private static void setDefaultZone(int offsetSeconds) {
        TimeZone.setDefault(TimeZone.getTimeZone(ZoneOffset.ofTotalSeconds(wrapToValidOffset(offsetSeconds))));
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

package io.mrkuhne.mezo.feature.train.service.sport;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.train.service.WorkoutWindowQueryService.Window;
import java.time.LocalTime;
import java.util.List;
import org.junit.jupiter.api.Test;

/** Which of today's not-done sport windows is "tonight" (final review, mezo-r36n9.202). Values invented. */
class SportTonightPickTest {

    private static Window w(String start, String end, boolean done) {
        return new Window(LocalTime.parse(start), LocalTime.parse(end), "sport", done, "volleyball");
    }

    @Test
    void testPending_shouldPassAnEarlierMissedWindow_whenALaterOneIsStillAhead() {
        Window cross = w("10:00", "11:00", false);
        Window vb = w("19:00", "20:30", false);
        assertThat(SportReadService.pending(List.of(cross, vb), LocalTime.parse("18:00"))).contains(vb);
    }

    @Test
    void testPending_shouldKeepAWindowForTwoHoursAfterItsEnd_whenThePreFillCanStillArrive() {
        Window vb = w("19:00", "20:30", false);
        assertThat(SportReadService.pending(List.of(vb), LocalTime.parse("22:00"))).contains(vb);
    }

    @Test
    void testPending_shouldFallBackToTheLastNotDoneWindow_whenEveryWindowIsLongOver() {
        Window cross = w("10:00", "11:00", false);
        Window vb = w("13:00", "14:00", false);
        assertThat(SportReadService.pending(List.of(cross, vb), LocalTime.parse("23:30"))).contains(vb);
    }

    @Test
    void testPending_shouldSkipDoneWindows_whenTheEveningOneIsLogged() {
        Window vb = w("19:00", "20:30", true);
        assertThat(SportReadService.pending(List.of(vb), LocalTime.parse("21:00"))).isEmpty();
    }
}

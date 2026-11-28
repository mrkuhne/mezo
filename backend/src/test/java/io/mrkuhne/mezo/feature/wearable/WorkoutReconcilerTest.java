package io.mrkuhne.mezo.feature.wearable;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.train.service.LoggedSession;
import io.mrkuhne.mezo.feature.train.service.LoggedSession.Kind;
import io.mrkuhne.mezo.feature.wearable.service.WorkoutReconciler;
import io.mrkuhne.mezo.feature.wearable.service.WorkoutReconciler.HealthWorkout;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class WorkoutReconcilerTest {

    private static final Instant T0 = Instant.parse("2026-11-10T17:00:00Z");
    private final WorkoutReconciler reconciler = new WorkoutReconciler(0.5, 20);

    private static Instant at(int minutes) {
        return T0.plusSeconds(minutes * 60L);
    }

    private static HealthWorkout health(String type, int startMin, int endMin) {
        return new HealthWorkout(type, at(startMin), at(endMin), 300, 120);
    }

    private static LoggedSession gym(int startMin, Integer endMin) {
        return new LoggedSession(Kind.GYM, UUID.randomUUID(), null, at(startMin),
            endMin == null ? null : at(endMin), endMin == null ? 0 : endMin - startMin, null);
    }

    private static LoggedSession sport(String sport, Integer startMin, int duration) {
        return new LoggedSession(Kind.SPORT, UUID.randomUUID(), sport, startMin == null ? null : at(startMin),
            startMin == null ? null : at(startMin + duration), duration, null);
    }

    @Test
    void overlapOfHalfTheShorterIntervalMatches() {
        LoggedSession g = gym(0, 60);
        // Health 40..70: starts 40 min apart (> 20), overlap 20 of shorter 30 = 67 %.
        assertThat(reconciler.match(health("strength", 40, 70), List.of(g))).contains(g);
    }

    @Test
    void tooLittleOverlapAndFarStartDoesNotMatch() {
        LoggedSession g = gym(0, 60);
        // Health 50..110: start 50 apart, overlap 10 of shorter 60 = 17 %.
        assertThat(reconciler.match(health("strength", 50, 110), List.of(g))).isEmpty();
    }

    @Test
    void startsWithinTwentyMinutesMatchEvenWithoutOverlapShare() {
        LoggedSession shortG = gym(0, 15);
        assertThat(reconciler.match(health("strength", 20, 80), List.of(shortG))).contains(shortG);
        assertThat(reconciler.match(health("strength", 21, 80), List.of(shortG))).isEmpty();
    }

    @Test
    void activityMismatchNeverMatches() {
        assertThat(reconciler.match(health("running", 0, 60), List.of(gym(0, 60)))).isEmpty();
        assertThat(reconciler.match(health("volleyball", 0, 60), List.of(gym(0, 60)))).isEmpty();
        assertThat(reconciler.match(health("strength", 0, 60),
            List.of(sport("volleyball", 0, 60)))).isEmpty();
    }

    @Test
    void autoClosedGymSessionUsesItsResolvedEnd() {
        // The port resolves started_at + active_seconds (50 min) when finished_at is null.
        LoggedSession autoClosed = gym(0, 50);
        // Health 20..80: starts 20 apart -> match; Health 30..90: 30 apart, overlap 20 of 50 = 40 % -> no.
        assertThat(reconciler.match(health("strength", 20, 80), List.of(autoClosed)))
            .contains(autoClosed);
        assertThat(reconciler.match(health("strength", 30, 90), List.of(autoClosed))).isEmpty();
    }

    @Test
    void gymSessionWithNoEndMatchesOnStartGapOnly() {
        LoggedSession startOnly = gym(5, null);
        assertThat(reconciler.match(health("hiit", 0, 60), List.of(startOnly)))
            .contains(startOnly);
        assertThat(reconciler.match(health("hiit", 40, 100), List.of(startOnly))).isEmpty();
    }

    @Test
    void sportMatchesOnTimeAndDuration() {
        LoggedSession v = sport("volleyball", 0, 90);
        assertThat(reconciler.match(health("volleyball", 10, 95), List.of(v))).contains(v);
        assertThat(reconciler.match(health("other", 10, 95), List.of(v))).contains(v);
    }

    @Test
    void crossAndTrxSportsFitStrengthActivities() {
        LoggedSession c = sport("cross", 0, 45);
        assertThat(reconciler.match(health("hiit", 0, 45), List.of(c))).contains(c);
        assertThat(reconciler.match(health("volleyball", 0, 45), List.of(c))).isEmpty();
    }

    @Test
    void sportWithoutClockTimeNeverMatches() {
        assertThat(reconciler.match(health("volleyball", 0, 90), List.of(sport("volleyball", null, 90)))).isEmpty();
    }

    @Test
    void twoCandidatesLargestOverlapWins() {
        LoggedSession small = gym(0, 30);   // overlap with 10..70 = 20
        LoggedSession large = gym(15, 75);  // overlap = 55
        assertThat(reconciler.match(health("strength", 10, 70), List.of(small, large)))
            .contains(large);
    }

    @Test
    void theWireCodesTheClientSendsMatchTheirSessions() {
        LoggedSession g = gym(0, 60);
        assertThat(reconciler.match(health("strength", 0, 60), List.of(g))).contains(g);
        assertThat(reconciler.match(health("hiit", 0, 60), List.of(g))).contains(g);
        assertThat(reconciler.match(health("other", 0, 60), List.of(g))).contains(g);
        assertThat(reconciler.match(health("walking", 0, 60), List.of(g))).isEmpty();
        LoggedSession v = sport("volleyball", 0, 60);
        assertThat(reconciler.match(health("volleyball", 0, 60), List.of(v))).contains(v);
        assertThat(reconciler.match(health("other", 0, 60), List.of(v))).contains(v);
        assertThat(reconciler.match(health("strength", 0, 60), List.of(v))).isEmpty();
        LoggedSession trx = sport("trx", 0, 60);
        assertThat(reconciler.match(health("strength", 0, 60), List.of(trx))).contains(trx);
        assertThat(reconciler.match(health("hiit", 0, 60), List.of(trx))).contains(trx);
    }
}

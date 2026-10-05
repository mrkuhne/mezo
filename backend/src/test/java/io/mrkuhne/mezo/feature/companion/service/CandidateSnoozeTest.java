package io.mrkuhne.mezo.feature.companion.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import org.junit.jupiter.api.Test;

/** S9 final-review fix (mezo-d6ivw.10): „Később” on a merge proposal sleeps until the NEXT weekly
 *  sweep (Monday 07:30 Europe/Budapest), not the generic 14 days. */
class CandidateSnoozeTest {

    @Test
    void nextMergeSweep_shouldBeComingMonday0730Budapest_fromMidweek() {
        // Wednesday 2026-09-30 12:00 Budapest (CEST, UTC+2)
        Instant now = Instant.parse("2026-09-30T10:00:00Z");

        assertThat(CandidateSnooze.nextMergeSweep(now)).isEqualTo(Instant.parse("2026-10-05T05:30:00Z"));
    }

    @Test
    void nextMergeSweep_shouldBeSameMorning_whenMondayBeforeTheSweep() {
        // Monday 2026-10-05 07:00 Budapest
        Instant now = Instant.parse("2026-10-05T05:00:00Z");

        assertThat(CandidateSnooze.nextMergeSweep(now)).isEqualTo(Instant.parse("2026-10-05T05:30:00Z"));
    }

    @Test
    void nextMergeSweep_shouldBeNextWeek_whenAtOrAfterThisMondaysSweep() {
        assertThat(CandidateSnooze.nextMergeSweep(Instant.parse("2026-10-05T05:30:00Z")))
                .isEqualTo(Instant.parse("2026-10-12T05:30:00Z"));
        assertThat(CandidateSnooze.nextMergeSweep(Instant.parse("2026-10-05T08:00:00Z")))
                .isEqualTo(Instant.parse("2026-10-12T05:30:00Z"));
    }

    @Test
    void nextMergeSweep_shouldFollowWinterTime_acrossTheDstSwitch() {
        // Wednesday 2026-10-21 Budapest; the clocks go back on 2026-10-25 → Monday 26th is CET (UTC+1)
        assertThat(CandidateSnooze.nextMergeSweep(Instant.parse("2026-10-21T10:00:00Z")))
                .isEqualTo(Instant.parse("2026-10-26T06:30:00Z"));
    }
}

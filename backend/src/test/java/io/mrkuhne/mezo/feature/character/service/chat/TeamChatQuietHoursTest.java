package io.mrkuhne.mezo.feature.character.service.chat;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.character.config.TeamChatProperties;
import io.mrkuhne.mezo.feature.notification.config.NotificationProperties;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import org.junit.jupiter.api.Test;

/**
 * mezo-tielp: the REAL quiet-window arithmetic — integration tests run with the window off
 * ({@code TestTeamChatQuietHours}), so its wrap-aware edges are pinned here with explicit times.
 */
class TeamChatQuietHoursTest {

    private static final ZoneId ZONE = ZoneId.of("Europe/Budapest");

    private static TeamChatQuietHours window(String start, String end) {
        TeamChatProperties properties = new TeamChatProperties(ZONE, 7, 12, 2, new BigDecimal("1.00"),
                "0 10 4 * * *", "0 20 * * * *", "0 0 7 * * *", 4, 20, 30, 4, 0);
        NotificationProperties notification = new NotificationProperties(160, "09:00", "20:00", 240,
                "0 * * * * *", 5, 5, new NotificationProperties.QuietHours(start, end));
        return new TeamChatQuietHours(notification, properties);
    }

    private static Instant at(int hour, int minute) {
        return LocalDate.of(2026, 9, 26).atTime(hour, minute).atZone(ZONE).toInstant();
    }

    @Test
    void contains_coversBothSidesOfMidnight_startInclusive_endExclusive() {
        TeamChatQuietHours quiet = window("22:00", "07:00");
        assertThat(quiet.contains(at(21, 59))).isFalse();
        assertThat(quiet.contains(at(22, 0))).isTrue();
        assertThat(quiet.contains(at(23, 59))).isTrue();
        assertThat(quiet.contains(at(0, 0))).isTrue();
        assertThat(quiet.contains(at(6, 59))).isTrue();
        assertThat(quiet.contains(at(7, 0))).isFalse();
        assertThat(quiet.contains(at(12, 0))).isFalse();
    }

    @Test
    void inEvening_isOnlyThePartBeforeMidnight() {
        TeamChatQuietHours quiet = window("22:00", "07:00");
        assertThat(quiet.inEvening(at(22, 0))).isTrue();
        assertThat(quiet.inEvening(at(0, 0))).isFalse();
        assertThat(quiet.inEvening(at(6, 59))).isFalse();
    }

    @Test
    void aWindowThatDoesNotWrapMidnight_orIsEmpty_neverBlocks() {
        for (TeamChatQuietHours quiet : new TeamChatQuietHours[] {window("09:00", "17:00"), window("00:00", "00:00")}) {
            assertThat(quiet.contains(at(12, 0))).isFalse();
            assertThat(quiet.contains(at(23, 0))).isFalse();
            assertThat(quiet.inEvening(at(23, 0))).isFalse();
        }
    }
}

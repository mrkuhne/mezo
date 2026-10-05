package io.mrkuhne.mezo.feature.character.service.chat;

import io.mrkuhne.mezo.feature.character.config.TeamChatProperties;
import io.mrkuhne.mezo.feature.notification.config.NotificationProperties;
import java.time.Instant;
import java.time.LocalTime;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * The csapatfal's reading of the do-not-disturb window ({@code mezo.notification.quiet-hours},
 * in the team chat's zone): no ügy opens inside it, and an ügy opened in its evening part never
 * pushes. Wrap-aware — only a window that wraps midnight (start after end) is a quiet window here;
 * a same-day window or start == end ("no quiet hours") never blocks.
 *
 * <p>Its own bean (mezo-tielp) because it is the ONE wall-clock decision on the open path: the
 * async {@link TeamChatEventListener} opens at {@code Instant.now()}, so every integration test
 * that raises through it used to pass or fail by the hour CI ran at. The test profile replaces
 * this bean with one that is off unless a test turns it on.
 */
@Component
@RequiredArgsConstructor
public class TeamChatQuietHours {

    private final NotificationProperties notificationProperties;
    private final TeamChatProperties properties;

    /** {@code at} falls inside the quiet window. */
    public boolean contains(Instant at) {
        LocalTime quietStart = LocalTime.parse(notificationProperties.quietHours().start());
        LocalTime quietEnd = LocalTime.parse(notificationProperties.quietHours().end());
        if (!quietStart.isAfter(quietEnd)) {
            return false;
        }
        LocalTime local = at.atZone(properties.zone()).toLocalTime();
        return !local.isBefore(quietStart) || local.isBefore(quietEnd);
    }

    /** Spec D3 / final review C1: {@code at} falls in the part of the quiet window BEFORE local
     *  midnight (the {@code AnchorResolver.interventionFireMinute} reading) — the feed-anchored
     *  push path defers the after-midnight part's rings to the window's end instead. */
    public boolean inEvening(Instant at) {
        LocalTime quietStart = LocalTime.parse(notificationProperties.quietHours().start());
        LocalTime quietEnd = LocalTime.parse(notificationProperties.quietHours().end());
        if (!quietStart.isAfter(quietEnd)) {
            return false;
        }
        return !at.atZone(properties.zone()).toLocalTime().isBefore(quietStart);
    }
}

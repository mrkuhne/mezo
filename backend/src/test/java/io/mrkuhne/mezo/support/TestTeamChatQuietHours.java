package io.mrkuhne.mezo.support;

import io.mrkuhne.mezo.feature.character.config.TeamChatProperties;
import io.mrkuhne.mezo.feature.character.service.chat.TeamChatQuietHours;
import io.mrkuhne.mezo.feature.notification.config.NotificationProperties;
import java.time.Instant;
import org.springframework.boot.test.context.TestComponent;
import org.springframework.context.annotation.Primary;

/**
 * mezo-tielp: the csapatfal's quiet window, OFF in integration tests unless a test turns it on.
 *
 * <p>The async {@code TeamChatEventListener} opens an ügy at {@code Instant.now()}, so with the
 * real window (22:00–07:00) every test that raises a flag found nothing whenever CI ran at night —
 * 21 cases across five classes, repeatedly reddening main. A test that is ABOUT the window calls
 * {@link #enforce()} and passes explicit clock times; {@code AbstractIntegrationTest} switches it
 * back off before every test.
 */
@TestComponent
@Primary
public class TestTeamChatQuietHours extends TeamChatQuietHours {

    private volatile boolean enforced;

    public TestTeamChatQuietHours(NotificationProperties notificationProperties, TeamChatProperties properties) {
        super(notificationProperties, properties);
    }

    /** Apply the real, configured quiet window for the rest of this test. */
    public void enforce() {
        enforced = true;
    }

    public void reset() {
        enforced = false;
    }

    @Override
    public boolean contains(Instant at) {
        return enforced && super.contains(at);
    }

    @Override
    public boolean inEvening(Instant at) {
        return enforced && super.inEvening(at);
    }
}

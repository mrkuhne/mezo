package io.mrkuhne.mezo.feature.proactive;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.FeedMessageResponse;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import io.mrkuhne.mezo.support.populator.DailySummaryPopulator;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

/**
 * The lazy feed read's retry window (mezo-7ahl8). The frontend polls {@code GET
 * /api/proactive/feed} every minute; an attempt that left no row must not be repeated on the
 * next poll. Uses a freshly registered user so the in-memory attempt map cannot be primed by
 * another test in a shared context.
 */
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = "mezo.proactive.feed.lazy-retry-minutes=15")
class ProactiveFeedLazyRetryIT extends ApiIntegrationTest {

    @Autowired private DailySummaryPopulator dailySummaryPopulator;
    @Autowired private CheckInPopulator checkInPopulator;

    @Test
    void testGetFeed_shouldNotRetryMorning_whenLastAttemptLeftNoRowWithinTheWindow() {
        RegisteredUser user = registerUser("Lazy Retry");
        UUID userId = user.id();
        LocalDate today = LocalDate.now();

        // 1st read: no narrative memory -> the morning attempt yields nothing, and is remembered
        assertThat(feed(user)).isEmpty();

        // everything a successful morning needs now exists (ProactiveApiFeedIT's fixture) ...
        dailySummaryPopulator.summary(userId, today.minusDays(1), "Tegnap pihenőnap volt.");
        checkInPopulator.createCheckIn(userId, today, "06:30", 4, 2,
                "[fake-feed-morning:{\"eyebrow\":\"Jó reggelt\",\"body\":[\"Mai terv.\"],\"refIndexes\":[]}]");

        // ... but the 2nd read falls inside the retry window: no new attempt, still no morning
        assertThat(feed(user)).extracting(FeedMessageResponse::getKind)
                .doesNotContain(FeedMessageResponse.KindEnum.MORNING);
    }

    private List<FeedMessageResponse> feed(RegisteredUser user) {
        return getForList("/api/proactive/feed", user.headers(), HttpStatus.OK, FeedMessageResponse.class);
    }
}
